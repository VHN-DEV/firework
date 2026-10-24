/*!
 * Hanabi – Cloudflare Worker: ảnh, nhạc
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Ảnh, nhạc người tạo tải lên (uploads/...) và ảnh xem trước khi chia sẻ (configs/<tên>.jpg): R2 (binding MEDIA) nếu có,
// không thì KV (binding MEDIA_KV: không cần thẻ thanh toán, mỗi file tối đa 25 MiB, 1.000 lần ghi mỗi ngày). Trả về hỗ trợ
// tải từng đoạn (Range) để thẻ <audio> tua được nhạc, Safari phát được.

const now = () => Math.floor(Date.now() / 1000);

export const hasMedia = env => !!(env.MEDIA || env.MEDIA_KV);

export async function putMedia(env, key, bytes, type) {
    if (env.MEDIA) await env.MEDIA.put(key, bytes, { httpMetadata: { contentType: type } });
    // t: lúc tải lên (giây), để lần dọn hằng ngày biết file đã cũ chưa (R2 tự ghi)
    else if (env.MEDIA_KV) await env.MEDIA_KV.put(key, bytes, { metadata: { type, t: now() } });
    else throw new Error('Chưa gắn nơi lưu ảnh, nhạc (binding MEDIA_KV hoặc MEDIA trong wrangler.jsonc)');
}

export async function deleteMedia(env, key) {
    if (env.MEDIA) await env.MEDIA.delete(key);
    else if (env.MEDIA_KV) await env.MEDIA_KV.delete(key);
}

// File có tên bắt đầu bằng prefix: [{ key, time: lúc tải lên (giây, 0 nếu không rõ) }], đọc tối đa pages trang danh
// sách (mỗi trang 1.000 file; KV miễn phí có 1.000 lần đọc danh sách mỗi ngày)
export async function listMedia(env, prefix, pages = 1) {
    const items = [];
    let cursor;
    for (let i = 0; i < pages; i++) {
        if (env.MEDIA) {
            const page = await env.MEDIA.list({ prefix, cursor });
            items.push(...page.objects.map(o => ({ key: o.key, time: Math.floor(o.uploaded.getTime() / 1000) })));
            if (!page.truncated) break;
            cursor = page.cursor;
        } else if (env.MEDIA_KV) {
            const page = await env.MEDIA_KV.list({ prefix, cursor });
            items.push(...page.keys.map(k => ({ key: k.name, time: (k.metadata && k.metadata.t) || 0 })));
            if (page.list_complete) break;
            cursor = page.cursor;
        } else {
            break;
        }
    }
    return items;
}

// Đoạn được yêu cầu trong header Range (bytes=a-b, bytes=a-, bytes=-n) của file size byte: { start, end } hoặc null
function parseRange(header, size) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(header || '');
    if (!m || (!m[1] && !m[2])) return null;
    let start;
    let end;
    if (!m[1]) {
        start = Math.max(0, size - Number(m[2]));
        end = size - 1;
    } else {
        start = Number(m[1]);
        end = m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
    }
    return start <= end && start < size ? { start, end } : null;
}

// Trả file key (null nếu không có). immutable: tên file không bao giờ đổi nội dung (ảnh, nhạc tải lên mang tên ngẫu nhiên).
// Có mã phiên bản (ETag): trình duyệt hỏi lại thì trả 304 không kèm file, và giữ được các đoạn nhạc đã tải (Range) nên
// lần xem sau không tải lại.
export async function serveMedia(env, request, key, { immutable = false } = {}) {
    const headers = new Headers({
        'accept-ranges': 'bytes',
        'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'public, max-age=86400'
    });
    let range = request.headers.get('range');
    const ifRange = request.headers.get('if-range');
    if (env.MEDIA) {
        const head = range || ifRange ? await env.MEDIA.head(key) : null;
        // If-Range: đoạn trình duyệt đang giữ thuộc bản cũ thì gửi cả file
        if (head && ifRange && ifRange !== head.httpEtag) range = null;
        const part = head && range ? parseRange(range, head.size) : null;
        const object = await env.MEDIA.get(key, { onlyIf: request.headers, ...(part ? { range: { offset: part.start, length: part.end - part.start + 1 } } : {}) });
        if (!object) return null;
        object.writeHttpMetadata(headers);
        headers.set('etag', object.httpEtag);
        if (!('body' in object)) return new Response(null, { status: 304, headers });
        if (part) {
            headers.set('content-range', `bytes ${part.start}-${part.end}/${object.size}`);
            headers.set('content-length', String(part.end - part.start + 1));
            return new Response(request.method === 'HEAD' ? null : object.body, { status: 206, headers });
        }
        headers.set('content-length', String(object.size));
        return new Response(request.method === 'HEAD' ? null : object.body, { headers });
    }
    if (!env.MEDIA_KV) return null;
    const { value, metadata } = await env.MEDIA_KV.getWithMetadata(key, 'arrayBuffer');
    if (!value) return null;
    headers.set('content-type', (metadata && metadata.type) || 'application/octet-stream');
    // Mã phiên bản: lúc ghi và dung lượng (ảnh thiệp ghi đè cùng tên thì đổi mã)
    const etag = `"${(metadata && metadata.t) || 0}-${value.byteLength}"`;
    headers.set('etag', etag);
    if (request.headers.get('if-none-match') === etag) return new Response(null, { status: 304, headers });
    const part = range && (!ifRange || ifRange === etag) ? parseRange(range, value.byteLength) : null;
    if (part) {
        headers.set('content-range', `bytes ${part.start}-${part.end}/${value.byteLength}`);
        headers.set('content-length', String(part.end - part.start + 1));
        // Không chép đoạn file (nhạc tới 20 MB): chỉ trỏ vào đoạn cần gửi, đỡ thời gian xử lý
        return new Response(request.method === 'HEAD' ? null : new Uint8Array(value, part.start, part.end - part.start + 1), { status: 206, headers });
    }
    headers.set('content-length', String(value.byteLength));
    return new Response(request.method === 'HEAD' ? null : value, { headers });
}
