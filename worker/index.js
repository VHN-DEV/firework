/*!
 * Hanabi – Cloudflare Worker
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Phần máy chủ khi triển khai lên Cloudflare Workers (wrangler.jsonc), thay cho các file PHP trong src/static/api: cùng
// đường dẫn, cùng dữ liệu gửi nhận nên trang (builder, trình phát, theo dõi quà) không phải sửa. File trong dist phục vụ
// thẳng; Worker chạy trước cho api/*, s/* (wrangler.jsonc: run_worker_first) và khi không có file tĩnh:
// - api/save_config.php, manage_configs.php (list, delete), opens.php (record, status), upload_image.php,
//   upload_audio.php, share.php
// - s/<tên>: trang chia sẻ có ảnh, tiêu đề xem trước (share-page.js), cả kịch bản mẫu lẫn kịch bản lưu
// - configs/<tên>.json, configs/<tên>.jpg, uploads/...: kịch bản, ảnh, nhạc đã lưu (D1, KV/R2)
// Kịch bản mẫu (dist/configs, có trong configs_index.json) không ghi đè, không xóa được (như bản PHP: "riêng tư").

import { renderSharePage, shareMetaFromConfig } from '../share-page.js';
import {
    TRACK_DEVICES, TRACK_EVENTS, canModify, checkKey, createKey, deleteConfig, deleteOldPreviews, getConfig, hasKey,
    listConfigs, loadOpens, putConfig, randomHex, recordOpen, validTrackId
} from './db.js';
import { deleteMedia, hasMedia, putMedia, serveMedia } from './media.js';

const json = (data, init = {}) => new Response(JSON.stringify(data), {
    ...init,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...(init.headers || {}) }
});

const fail = (message, extra = {}) => json({ success: false, message, ...extra });

// Tên kịch bản như bản PHP: chữ, số, gạch dưới, gạch ngang, chữ thường
const cleanName = value => (typeof value === 'string' ? value : '').replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase();

// File tĩnh trong dist (kịch bản mẫu, ảnh của mẫu...): Response hoặc null
async function asset(env, url, path, method = 'GET') {
    const response = await env.ASSETS.fetch(new Request(new URL(path, url), { method }));
    return response.ok ? response : null;
}

const isTemplate = async (env, url, id) => !!(await asset(env, url, `/configs/${id}.json`, 'HEAD'));

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

async function saveConfig(request, env, url) {
    const data = await request.json().catch(() => null);
    if (!data || typeof data !== 'object') return fail('Dữ liệu không hợp lệ.');
    const config = data.config;
    const key = typeof data.key === 'string' ? data.key : '';
    // Nút "Xem thử": mỗi lần một bản tạm tên ngẫu nhiên (hai người cùng xem thử không thấy kịch bản của nhau)
    const isPreview = !!data.preview;
    let filename = isPreview ? `preview_temp_${randomHex(8)}` : data.filename;
    if (!filename || !config) return fail('Thiếu tên file hoặc nội dung cấu hình.');
    if (typeof config !== 'object' || Array.isArray(config) || !Array.isArray(config.events)) return fail('Nội dung kịch bản không hợp lệ.');
    // "Riêng tư" chỉ dành cho kịch bản mẫu của trang, không nhận từ trình duyệt
    delete config.status;
    filename = cleanName(filename);
    if (!filename) return fail('Tên file không hợp lệ.');
    if (filename.length > 80) return fail('Tên file quá dài (tối đa 80 ký tự).');
    if (!isPreview && filename.startsWith('preview_temp')) return fail('Tên file này dành cho bản xem thử, hãy đặt tên khác.');
    // Trùng tên kịch bản mẫu: builder tự lưu thành bản mới (code not_owner)
    if (!isPreview && await isTemplate(env, url, filename)) {
        return fail('Tên này trùng kịch bản mẫu của trang, hãy đặt tên khác.', { code: 'not_owner' });
    }
    const text = JSON.stringify(config);
    if (text.length > 1900000) return fail('Kịch bản quá lớn để lưu (tối đa ~1,9 MB).');

    if (isPreview) await deleteOldPreviews(env);
    const existing = await getConfig(env, filename);
    // Kịch bản do máy khác tạo: không ghi đè (builder tự lưu thành bản mới)
    if (existing && !(await canModify(env, filename, key))) {
        return fail('Kịch bản này do máy khác tạo, chỉ máy đó mới lưu đè được. Hãy lưu với tên khác.', { code: 'not_owner' });
    }

    // Ảnh xem trước khi chia sẻ link (builder vẽ sẵn, dạng data:image/jpeg;base64,...): configs/<tên>.jpg
    let image = existing ? existing.image : false;
    const m = !isPreview && typeof data.shareImage === 'string' ? /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(data.shareImage) : null;
    if (m && hasMedia(env)) {
        const bytes = Uint8Array.from(atob(m[1]), c => c.charCodeAt(0));
        if (bytes.length <= 2 * 1024 * 1024 && bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
            await putMedia(env, `configs/${filename}.jpg`, bytes, 'image/jpeg');
            image = true;
        }
    }
    await putConfig(env, filename, config, image);
    const response = { success: true, message: 'Đã lưu kịch bản thành công!', filename };
    // Kịch bản mới: tạo mã theo dõi mở quà, chỉ trả về lần này (trình soạn của người gửi giữ lại)
    const trackKey = !existing && !isPreview ? await createKey(env, filename) : null;
    if (trackKey) response.trackKey = trackKey;
    return json(response);
}

async function manageConfigs(request, env, url) {
    const action = url.searchParams.get('action');
    if (action === 'list') {
        // Kịch bản mẫu (configs_index.json) và kịch bản đã lưu
        let templates = [];
        try {
            const index = await asset(env, url, '/configs/configs_index.json');
            templates = index ? await index.json() : [];
        } catch (e) {
            templates = [];
        }
        const samples = (Array.isArray(templates) ? templates : []).filter(t => t && typeof t.id === 'string').map(t => ({
            id: t.id, title: t.title || t.id, author: t.author || 'Unknown', eventCount: t.eventCount || 0,
            status: t.status === 'private' ? 'private' : 'public', locked: false
        }));
        const saved = (await listConfigs(env)).filter(s => !samples.some(t => t.id === s.id));
        return json([...samples, ...saved]);
    }
    if (action === 'delete') {
        const data = await request.json().catch(() => ({}));
        const filename = cleanName(data && data.filename);
        const key = data && typeof data.key === 'string' ? data.key : '';
        if (!filename) return fail('Thiếu tên file.');
        if (!/^[a-z0-9_-]{1,80}$/.test(filename)) return fail('Tên file không hợp lệ.');
        if (await isTemplate(env, url, filename)) return fail('Kịch bản này là riêng tư và không thể xóa.');
        if (!(await getConfig(env, filename))) return fail('File không tồn tại.');
        if (!(await canModify(env, filename, key))) return fail('Chỉ máy đã tạo kịch bản này mới xóa được.', { code: 'not_owner' });
        await deleteConfig(env, filename);
        if (hasMedia(env)) await deleteMedia(env, `configs/${filename}.jpg`);
        return json({ success: true, message: 'Đã xóa kịch bản thành công!' });
    }
    return fail('Hành động không hợp lệ.');
}

async function opens(request, env, url) {
    const action = url.searchParams.get('action');
    const body = await request.json().catch(() => ({})) || {};
    if (action === 'record') {
        const id = typeof body.id === 'string' ? body.id.toLowerCase() : '';
        const device = TRACK_DEVICES.includes(body.device) ? body.device : 'desktop';
        if (!validTrackId(id) || !TRACK_EVENTS.includes(body.event)) return json({ success: false }, { status: 400 });
        // Chỉ ghi cho kịch bản có thật, có mã theo dõi và người gửi đã bật "Báo cho tôi khi người nhận mở quà"
        const saved = await getConfig(env, id);
        if (!saved || !saved.data.notifyOpen || !(await hasKey(env, id))) return json({ success: false });
        return json({ success: await recordOpen(env, id, body.event, device) });
    }
    if (action === 'status') {
        const items = Array.isArray(body.items) ? body.items.slice(0, 100) : [];
        const result = [];
        for (const item of items) {
            const id = item && typeof item.id === 'string' ? item.id.toLowerCase() : '';
            const key = item && typeof item.key === 'string' ? item.key : '';
            if (!(await checkKey(env, id, key))) {
                result.push({ id, ok: false });
                continue;
            }
            const data = await loadOpens(env, id);
            result.push({ id, ok: true, counts: data.counts, first: data.first, events: data.events.slice(-50) });
        }
        return json({ success: true, items: result });
    }
    return json({ success: false, message: 'Hành động không hợp lệ.' }, { status: 400 });
}

// Loại file từ NỘI DUNG (không tin tên file, MIME do trình duyệt gửi)
function imageType(b) {
    if (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return ['jpg', 'image/jpeg'];
    if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) return ['png', 'image/png'];
    if (String.fromCharCode(...b.slice(0, 4)) === 'GIF8') return ['gif', 'image/gif'];
    if (String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP') return ['webp', 'image/webp'];
    return null;
}

function audioType(b) {
    const ascii = (from, to) => String.fromCharCode(...b.slice(from, to));
    if (b.length < 12) return null;
    if (ascii(0, 3) === 'ID3') return ['mp3', 'audio/mpeg'];
    // Khung MPEG audio không có thẻ ID3: 11 bit đồng bộ, layer khác 0
    if (b[0] === 0xFF && (b[1] & 0xE0) === 0xE0 && (b[1] & 0x06) !== 0) return ['mp3', 'audio/mpeg'];
    if (ascii(4, 8) === 'ftyp') return ['m4a', 'audio/mp4'];
    if (ascii(0, 4) === 'OggS') return ['ogg', 'audio/ogg'];
    if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WAVE') return ['wav', 'audio/wav'];
    return null;
}

async function upload(request, env, kind) {
    if (request.method !== 'POST') return fail('Phương thức không hợp lệ.');
    if (!hasMedia(env)) return fail('Máy chủ chưa có nơi lưu ảnh, nhạc.');
    const audio = kind === 'audio';
    const form = await request.formData().catch(() => null);
    const name = cleanName(form && form.get('filename'));
    if (!name) return fail('Thiếu tên kịch bản.');
    const file = form.get(audio ? 'audio' : 'image');
    if (!file || typeof file === 'string') return fail(audio ? 'Không tìm thấy file nhạc.' : 'Không tìm thấy file ảnh.');
    if (file.size > (audio ? 20 : 10) * 1024 * 1024) return fail(audio ? 'File nhạc quá lớn (tối đa 20MB).' : 'Ảnh quá lớn (tối đa 10MB).');
    const bytes = new Uint8Array(await file.arrayBuffer());
    const type = audio ? audioType(bytes) : imageType(bytes);
    if (!type) {
        return fail(audio ? 'Định dạng không được hỗ trợ. Hãy dùng file MP3, M4A, OGG hoặc WAV.' : 'Loại file không được hỗ trợ. Chỉ cho phép JPG, PNG, WEBP, GIF.');
    }
    const key = audio ? `uploads/music/${name}/music_${randomHex(8)}.${type[0]}` : `uploads/${name}/img_${randomHex(8)}.${type[0]}`;
    await putMedia(env, key, bytes, type[1]);
    if (!audio) return json({ success: true, message: 'Tải ảnh lên thành công!', url: `./${key}` });
    // Tên bài để hiển thị trong builder: bỏ ký tự điều khiển, tối đa 120 ký tự
    const display = [...String(file.name || '').replace(/[\x00-\x1F\x7F]/g, '')].slice(0, 120).join('');
    return json({ success: true, message: 'Tải nhạc lên thành công!', url: `./${key}`, name: display });
}

// ---------------------------------------------------------------------------
// Trang chia sẻ, file đã lưu
// ---------------------------------------------------------------------------

async function sharePage(env, url, id) {
    let config = null;
    let imageUrl = `${url.origin}/og-default.jpg`;
    const saved = id ? await getConfig(env, id) : null;
    if (saved) {
        config = saved.data;
        if (saved.image) imageUrl = `${url.origin}/configs/${id}.jpg?v=${saved.updated}`;
    } else if (id) {
        const file = await asset(env, url, `/configs/${id}.json`);
        config = file ? await file.json().catch(() => null) : null;
        if (await asset(env, url, `/configs/${id}.jpg`, 'HEAD')) imageUrl = `${url.origin}/configs/${id}.jpg`;
    }
    if (!config || !Array.isArray(config.events)) return Response.redirect(new URL('/', url).href, 302);
    const html = renderSharePage({ id, ...shareMetaFromConfig(config), shareUrl: `${url.origin}/s/${id}`, imageUrl });
    return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' } });
}

async function notFound(env, url) {
    const page = await asset(env, url, '/404');
    return new Response(page ? page.body : 'Not found', { status: 404, headers: { 'content-type': 'text/html; charset=utf-8' } });
}

async function route(request, env, url) {
    const path = url.pathname;
    if (path.startsWith('/api/')) {
        const name = path.slice(5);
        if (name === 'save_config.php' && request.method === 'POST') return saveConfig(request, env, url);
        if (name === 'manage_configs.php') return manageConfigs(request, env, url);
        if (name === 'opens.php') return opens(request, env, url);
        if (name === 'upload_image.php') return upload(request, env, 'image');
        if (name === 'upload_audio.php') return upload(request, env, 'audio');
        if (name === 'share.php') return sharePage(env, url, cleanName(url.searchParams.get('c')));
        return json({ success: false, message: 'Không có API này.' }, { status: 404 });
    }
    let m = /^\/s\/([A-Za-z0-9_-]+)(?:\.html)?$/.exec(path);
    if (m) return sharePage(env, url, cleanName(m[1]));
    // Kịch bản đã lưu (kịch bản mẫu là file tĩnh, không tới đây)
    m = /^\/configs\/([a-z0-9_-]+)\.json$/.exec(path);
    if (m) {
        const saved = await getConfig(env, m[1]);
        if (saved) return json(saved.data, { headers: { 'cache-control': 'no-cache' } });
        return notFound(env, url);
    }
    m = /^\/configs\/([a-z0-9_-]+)\.jpg$/.exec(path);
    if (m && hasMedia(env)) return (await serveMedia(env, request, `configs/${m[1]}.jpg`)) || notFound(env, url);
    if (path.startsWith('/uploads/') && hasMedia(env)) {
        return (await serveMedia(env, request, decodeURIComponent(path.slice(1)), { immutable: true })) || notFound(env, url);
    }
    return notFound(env, url);
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        try {
            return await route(request, env, url);
        } catch (e) {
            console.error(e);
            if (url.pathname.startsWith('/api/')) return json({ success: false, message: `Lỗi máy chủ: ${e.message}` }, { status: 500 });
            return new Response('Lỗi máy chủ', { status: 500 });
        }
    }
};
