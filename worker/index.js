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
// - mỗi ngày lúc 7h05 sáng (wrangler.jsonc: triggers): xóa bản Xem thử cũ, bộ đếm giới hạn đã hết hạn, ảnh, nhạc không kịch bản nào dùng
// Kịch bản mẫu (dist/configs, có trong configs_index.json) không ghi đè, không xóa được (như bản PHP: "riêng tư").
// Mỗi máy chỉ được lưu, tải lên, báo mở quà một số lần (LIMITS) để một người phá không làm hết hạn mức miễn phí của cả
// trang.

import { renderSharePage, shareMetaFromConfig } from '../share-page.js';
import {
    TRACK_DEVICES, TRACK_EVENTS, canModify, checkKey, createKey, deleteConfig, deleteOldPreviews, deleteOldQuota, getConfig,
    getConfigText, hasKey, listConfigs, loadOpens, now, putConfig, randomHex, recordOpen, sha256, unusedMedia, useQuota, validTrackId
} from './db.js';
import { deleteMedia, hasMedia, listMedia, putMedia, serveMedia } from './media.js';

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
// Giới hạn mỗi máy
// ---------------------------------------------------------------------------

const DAY = 86400;
// [tối đa, trong bao nhiêu giây] cho mỗi máy. Hạn mức miễn phí của cả trang mỗi ngày: KV (ảnh, nhạc, ảnh thiệp) 1.000
// lần ghi, 1 GB; D1 (kịch bản) 100.000 dòng ghi, 500 MB. Người tạo thiệp bình thường chỉ dùng một phần nhỏ.
const LIMITS = {
    save: [[30, 600], [300, DAY]], // Lưu, Xem thử
    saveKB: [[50 * 1024, DAY]], // tổng dung lượng kịch bản đã gửi
    upload: [[20, 600], [60, DAY]], // tải ảnh, nhạc lên
    uploadKB: [[150 * 1024, DAY]],
    open: [[60, 600]] // báo mở quà (mỗi lần xem quà gửi tối đa 3 lần)
};

// Máy gửi: địa chỉ IP Cloudflare ghi vào CF-Connecting-IP, IPv6 tính theo khối /64 (nhà mạng thường cấp cả khối cho
// một thuê bao). Trả về bản băm, không lưu địa chỉ thật.
function clientId(request) {
    let ip = request.headers.get('cf-connecting-ip') || 'unknown';
    if (ip.includes(':') && !ip.includes('.')) {
        const [head, tail] = ip.split('::');
        const a = head ? head.split(':') : [];
        const b = tail ? tail.split(':') : [];
        const groups = tail === undefined ? a : [...a, ...Array(Math.max(0, 8 - a.length - b.length)).fill('0'), ...b];
        ip = `${groups.slice(0, 4).map(g => (parseInt(g, 16) || 0).toString(16)).join(':')}::/64`;
    }
    return sha256(`hanabi:${ip}`).then(hash => hash.slice(0, 24));
}

// Dùng hạn mức của máy gửi request; vượt thì trả về câu báo (đọc sau "Lỗi: " trong builder), không thì null
async function overQuota(request, env, items, what) {
    const over = await useQuota(env, await clientId(request), items, LIMITS);
    if (!over) return null;
    const minutes = Math.max(1, Math.ceil((over.end - Date.now() / 1000) / 60));
    return `Máy này đã ${what} quá nhiều lần, hãy thử lại ${over.per >= DAY ? 'sau 7 giờ sáng (giờ Việt Nam)' : `sau ${minutes} phút`}.`;
}

const limited = message => fail(message, { code: 'rate_limited' });

// Hết hạn mức ghi KV của cả trang trong ngày (Cloudflare báo "... limit exceeded ...")
const isDailyLimit = e => /limit/i.test(e && e.message);
const MEDIA_FULL = 'Hôm nay trang đã dùng hết lượt lưu ảnh, nhạc của gói miễn phí, hãy thử lại sau 7 giờ sáng (giờ Việt Nam).';

// ---------------------------------------------------------------------------
// Dọn ảnh, nhạc
// ---------------------------------------------------------------------------

// Ảnh, nhạc tải lên (xem upload): uploads/<tên>/img_<16 số hex>.<đuôi>, uploads/music/<tên>/music_<16 số hex>.<đuôi>
const UPLOAD_PATH = /uploads\/(?:music\/)?[a-z0-9_-]+\/(?:img|music)_[a-f0-9]{16}\.[a-z0-9]+/g;
// File chưa kịch bản nào dùng mà còn mới thì giữ: có thể nằm trong bản nháp builder chưa lưu (bản nháp giữ mãi)
const ORPHAN_DAYS = 30;

// Xóa kịch bản: xóa luôn ảnh, nhạc tải lên dưới tên kịch bản và file kịch bản có dùng, trừ file kịch bản khác còn dùng
// (vd đã lưu thành bản mới từ kịch bản này). text: kịch bản vừa xóa dạng JSON
async function deleteMediaOf(env, name, text) {
    const prefixes = [`uploads/${name}/img_`, `uploads/music/${name}/music_`];
    const own = (await Promise.all(prefixes.map(async prefix => (await listMedia(env, prefix)).map(f => f.key)
        // Tên kịch bản là tiền tố của tên khác (vd "music"): chỉ lấy đúng file của kịch bản này
        .filter(key => /^[a-f0-9]{16}\.[a-z0-9]+$/.test(key.slice(prefix.length)))))).flat();
    const keys = [...new Set([...own, ...(text.match(UPLOAD_PATH) || [])])];
    for (const key of await unusedMedia(env, keys)) await deleteMedia(env, key);
}

// Hằng ngày: ảnh, nhạc tải lên quá ORPHAN_DAYS ngày mà không kịch bản nào dùng (tải lên rồi bỏ, đổi ảnh khác, kịch bản xóa
// từ trước, spam), tối đa 500 file mỗi lần (KV miễn phí có 1.000 lần xóa mỗi ngày)
async function deleteOrphanMedia(env) {
    // Kiểm thử (tests/worker/run.mjs) đặt ORPHAN_DAYS = 0 qua biến môi trường
    const old = now() - Number(env.ORPHAN_DAYS ?? ORPHAN_DAYS) * 86400;
    const keys = (await listMedia(env, 'uploads/', 5)).filter(f => f.time < old).map(f => f.key).slice(0, 2000);
    for (const key of (await unusedMedia(env, keys)).slice(0, 500)) await deleteMedia(env, key);
}

async function daily(env) {
    await deleteOldPreviews(env);
    await deleteOldQuota(env);
    if (hasMedia(env)) await deleteOrphanMedia(env);
}

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
    const quota = await overQuota(request, env, [['save', 1], ['saveKB', Math.ceil(text.length / 1024)]], 'lưu');
    if (quota) return limited(quota);

    if (isPreview) await deleteOldPreviews(env);
    const existing = await getConfig(env, filename);
    // Kịch bản do máy khác tạo: không ghi đè (builder tự lưu thành bản mới)
    if (existing && !(await canModify(env, filename, key))) {
        return fail('Kịch bản này do máy khác tạo, chỉ máy đó mới lưu đè được. Hãy lưu với tên khác.', { code: 'not_owner' });
    }

    // Ảnh xem trước khi chia sẻ link (builder vẽ sẵn, dạng data:image/jpeg;base64,...): configs/<tên>.jpg. Ảnh giống
    // lần lưu trước thì không ghi lại (mỗi lần ghi tốn một lượt trong 1.000 lượt ghi KV mỗi ngày); hết lượt ghi thì vẫn
    // lưu kịch bản, giữ ảnh cũ.
    let image = existing ? existing.image : false;
    let thumb = existing ? existing.thumb : null;
    const m = !isPreview && typeof data.shareImage === 'string' ? /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(data.shareImage) : null;
    const hash = m && hasMedia(env) ? await sha256(m[1]) : null;
    if (hash && !(image && thumb === hash)) {
        const bytes = Uint8Array.from(atob(m[1]), c => c.charCodeAt(0));
        if (bytes.length <= 2 * 1024 * 1024 && bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
            try {
                await putMedia(env, `configs/${filename}.jpg`, bytes, 'image/jpeg');
                image = true;
                thumb = hash;
            } catch (e) {
                if (!isDailyLimit(e)) throw e;
            }
        }
    }
    await putConfig(env, filename, config, text, image, thumb);
    const response = { success: true, message: 'Đã lưu kịch bản thành công!', filename };
    // Kịch bản mới: tạo mã theo dõi mở quà, chỉ trả về lần này (trình soạn của người gửi giữ lại)
    const trackKey = !existing && !isPreview ? await createKey(env, filename) : null;
    if (trackKey) response.trackKey = trackKey;
    return json(response);
}

async function manageConfigs(request, env, url) {
    const action = url.searchParams.get('action');
    if (action === 'list') {
        // Kịch bản mẫu (configs_index.json) và kịch bản đã lưu của trình duyệt gửi mã chủ (POST { keys: { tên: mã } })
        const body = request.method === 'POST' ? await request.json().catch(() => null) : null;
        const keys = body && body.keys && typeof body.keys === 'object' ? body.keys : {};
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
        const saved = (await listConfigs(env, keys)).filter(s => !samples.some(t => t.id === s.id));
        return json([...samples, ...saved]);
    }
    if (action === 'delete') {
        const data = await request.json().catch(() => ({}));
        const filename = cleanName(data && data.filename);
        const key = data && typeof data.key === 'string' ? data.key : '';
        if (!filename) return fail('Thiếu tên file.');
        if (!/^[a-z0-9_-]{1,80}$/.test(filename)) return fail('Tên file không hợp lệ.');
        if (await isTemplate(env, url, filename)) return fail('Kịch bản này là riêng tư và không thể xóa.');
        const saved = await getConfig(env, filename);
        if (!saved) return fail('File không tồn tại.');
        if (!(await canModify(env, filename, key))) return fail('Chỉ máy đã tạo kịch bản này mới xóa được.', { code: 'not_owner' });
        await deleteConfig(env, filename);
        if (hasMedia(env)) {
            await deleteMedia(env, `configs/${filename}.jpg`);
            // Lỗi khi dọn thì vẫn báo đã xóa: lần dọn hằng ngày xóa nốt
            await deleteMediaOf(env, filename, JSON.stringify(saved.data)).catch(e => console.error(e));
        }
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
        if (await overQuota(request, env, [['open', 1]], 'báo mở quà')) return json({ success: false, code: 'rate_limited' });
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
    const quota = await overQuota(request, env, [['upload', 1], ['uploadKB', Math.ceil(bytes.length / 1024)]], 'tải ảnh, nhạc lên');
    if (quota) return limited(quota);
    const key = audio ? `uploads/music/${name}/music_${randomHex(8)}.${type[0]}` : `uploads/${name}/img_${randomHex(8)}.${type[0]}`;
    try {
        await putMedia(env, key, bytes, type[1]);
    } catch (e) {
        if (isDailyLimit(e)) return fail(MEDIA_FULL);
        throw e;
    }
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
    // Trang chỉ có tiêu đề, ảnh xem trước (cho Facebook, Zalo... đọc) và chuyển sang trình phát: trình duyệt giữ 1 giờ, mở
    // lại link không phải gọi máy chủ
    return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
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
    // Kịch bản đã lưu (kịch bản mẫu là file tĩnh, không tới đây). Trình duyệt hỏi lại mỗi lần mở (người tạo sửa xong là
    // người nhận thấy ngay), chưa đổi thì trả 304 không kèm kịch bản. Bản Xem thử không bao giờ đổi (mỗi lần một tên mới).
    m = /^\/configs\/([a-z0-9_-]+)\.json$/.exec(path);
    if (m) {
        const asked = request.headers.get('if-none-match');
        let saved = await getConfigText(env, m[1], !asked);
        if (!saved) return notFound(env, url);
        const etag = `"${saved.updated}-${saved.size}"`;
        const headers = { etag, 'cache-control': m[1].startsWith('preview_temp') ? 'private, max-age=86400' : 'no-cache' };
        if (asked === etag) return new Response(null, { status: 304, headers });
        if (saved.data === undefined) saved = await getConfigText(env, m[1]);
        if (!saved) return notFound(env, url);
        return new Response(saved.data, { headers: { 'content-type': 'application/json; charset=utf-8', ...headers } });
    }
    m = /^\/configs\/([a-z0-9_-]+)\.jpg$/.exec(path);
    // ?v=<lúc lưu> (link ảnh trong trang chia sẻ): ảnh của đúng lần lưu đó, không bao giờ đổi
    if (m && hasMedia(env)) return (await serveMedia(env, request, `configs/${m[1]}.jpg`, { immutable: url.searchParams.has('v') })) || notFound(env, url);
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
    },
    async scheduled(controller, env, ctx) {
        ctx.waitUntil(daily(env));
    }
};
