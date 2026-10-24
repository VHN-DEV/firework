/*!
 * Hanabi – Cloudflare Worker: quản trị
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Trang quản trị (/admin: admin.html, src/assets/js/admin.js): chỉ tài khoản Google có email trong ADMIN_EMAILS
// (wrangler.jsonc: vars, nhiều email cách nhau dấu phẩy) dùng được, đăng nhập như builder (account.js).
// api/admin.php?action=... (POST): overview, usage (hạn mức Cloudflare hôm nay: usage.js); scripts, script, deleteScript;
// users, lockUser, deleteUser; library, libraryAdd (form có file), libraryUpdate, libraryDelete; replies (gom theo kịch
// bản), deleteReply.

import { currentUser } from './account.js';
import { database, deleteUser, now, randomHex } from './db.js';
import { LIBRARY_FIELDS, LIBRARY_KINDS, deleteLibraryRow, libraryItems, libraryRow, saveLibraryRow } from './library.js';
import { audioType, deleteMedia, imageType, putMedia } from './media.js';
import { cloudflareUsage } from './usage.js';

const PAGE_SIZE = 50;
// Xóa người dùng kèm kịch bản: mỗi lần gọi xóa tối đa chừng này kịch bản (D1 miễn phí chỉ cho 50 câu lệnh mỗi lần gọi
// Worker), trang quản trị gọi tiếp tới khi hết
const DELETE_BATCH = 8;

export function isAdmin(env, user) {
    const emails = String(env.ADMIN_EMAILS || '').split(',').map(email => email.trim().toLowerCase()).filter(Boolean);
    return !!(user && user.email && emails.includes(user.email.toLowerCase()));
}

const parse = text => {
    try {
        return JSON.parse(text);
    } catch (e) {
        return null;
    }
};

// Tìm gần đúng trong câu LIKE (thoát %, _); dùng kèm ESCAPE '\'
const like = text => `%${String(text).replace(/[\\%_]/g, c => `\\${c}`)}%`;
const pageOf = value => Math.max(1, Math.floor(Number(value)) || 1);
const text = (value, max) => (typeof value === 'string' ? value.replace(/[\x00-\x1F\x7F]/g, '').trim().slice(0, max) : '');

// ---- Kịch bản ----

async function scriptRows(env, { q = '', user = '', page = 1, size = PAGE_SIZE }) {
    const db = await database(env);
    const where = ["c.id NOT LIKE 'preview_temp%'"];
    const binds = [];
    if (q) {
        where.push("(c.id LIKE ? ESCAPE '\\' OR c.title LIKE ? ESCAPE '\\' OR c.author LIKE ? ESCAPE '\\')");
        binds.push(like(q), like(q), like(q));
    }
    if (user) {
        where.push('c.id IN (SELECT id FROM user_keys WHERE user = ?)');
        binds.push(user);
    }
    const [rows, total] = await db.batch([
        db.prepare('SELECT c.id, c.title, c.author, c.events, c.updated, c.image, length(c.data) AS size, '
            + "(SELECT group_concat(u.email, ', ') FROM user_keys k JOIN users u ON u.id = k.user WHERE k.id = c.id) AS owners, "
            + '(SELECT count(*) FROM replies r WHERE r.id = c.id) AS replies, '
            + "json_extract(o.data, '$.counts.view') AS views, json_extract(o.data, '$.counts.open') AS opens "
            + `FROM configs c LEFT JOIN opens o ON o.id = c.id WHERE ${where.join(' AND ')} ORDER BY c.updated DESC LIMIT ? OFFSET ?`)
            .bind(...binds, size, (page - 1) * size),
        db.prepare(`SELECT count(*) AS n FROM configs c WHERE ${where.join(' AND ')}`).bind(...binds)
    ]);
    const items = rows.results.map(r => ({
        id: r.id, title: r.title || r.id, author: r.author || '', events: r.events, updated: r.updated, image: !!r.image,
        size: r.size, owners: r.owners || '', replies: r.replies, views: r.views || 0, opens: r.opens || 0
    }));
    return { items, total: total.results[0].n, page, pageSize: size };
}

async function scriptDetail(env, id) {
    const db = await database(env);
    const [config, opens, replies, owners] = await db.batch([
        db.prepare('SELECT data, updated, image FROM configs WHERE id = ?').bind(id),
        db.prepare('SELECT data FROM opens WHERE id = ?').bind(id),
        db.prepare('SELECT n, t, name, message FROM replies WHERE id = ? ORDER BY n DESC').bind(id),
        db.prepare('SELECT u.id, u.email, u.name FROM user_keys k JOIN users u ON u.id = k.user WHERE k.id = ?').bind(id)
    ]);
    const row = config.results[0];
    if (!row) return null;
    const open = opens.results[0] ? parse(opens.results[0].data) : null;
    return {
        id, config: parse(row.data) || {}, updated: row.updated, image: !!row.image,
        opens: open ? { counts: open.counts || {}, first: open.first || {}, events: (open.events || []).slice(-50) } : null,
        replies: replies.results, owners: owners.results
    };
}

// ---- Người dùng ----

async function userRows(env, { q = '', page = 1 }) {
    const db = await database(env);
    const where = q ? "WHERE u.email LIKE ? ESCAPE '\\' OR u.name LIKE ? ESCAPE '\\'" : '';
    const binds = q ? [like(q), like(q)] : [];
    const [rows, total] = await db.batch([
        db.prepare('SELECT u.id, u.email, u.name, u.picture, u.created, u.seen, u.locked, '
            + '(SELECT count(*) FROM user_keys k JOIN configs c ON c.id = k.id WHERE k.user = u.id) AS scripts '
            + `FROM users u ${where} ORDER BY u.created DESC LIMIT ? OFFSET ?`).bind(...binds, PAGE_SIZE, (page - 1) * PAGE_SIZE),
        db.prepare(`SELECT count(*) AS n FROM users u ${where}`).bind(...binds)
    ]);
    const items = rows.results.map(r => ({ ...r, locked: !!r.locked, admin: isAdmin(env, r) }));
    return { items, total: total.results[0].n, page, pageSize: PAGE_SIZE };
}

async function findUser(env, id) {
    return (await database(env)).prepare('SELECT id, email FROM users WHERE id = ?').bind(typeof id === 'string' ? id : '').first();
}

// ---- Kho nhạc, kho ảnh ----

// "Bánh sinh nhật" -> "banh-sinh-nhat"
const slug = value => value.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

// Các trường gửi lên (chỉ trường có trong source): tên, nghệ sĩ, nhãn (chuỗi cách dấu phẩy hoặc mảng), giấy phép, nguồn
function libraryFields(kind, source) {
    const fields = {};
    for (const key of LIBRARY_FIELDS[kind]) {
        if (!(key in source)) continue;
        if (key === 'tags') {
            const list = Array.isArray(source.tags) ? source.tags : String(source.tags || '').split(',');
            fields.tags = [...new Set(list.map(tag => text(tag, 30)).filter(Boolean))].slice(0, 8);
        } else if (key === 'source') {
            const url = text(source.source, 300);
            fields.source = /^https?:\/\//.test(url) ? url : '';
        } else {
            fields[key] = text(source[key], 80);
        }
    }
    return fields;
}

async function libraryWithUsage(env, url, kind) {
    const items = await libraryItems(env, url, kind);
    const paths = items.map(item => `library/${kind}/${item.file}`);
    const { results } = await (await database(env)).prepare(
        'SELECT value, (SELECT count(*) FROM configs WHERE instr(data, value) > 0) AS n FROM json_each(?)'
    ).bind(JSON.stringify(paths)).all();
    const used = Object.fromEntries(results.map(r => [r.value, r.n]));
    return items.map(item => ({ ...item, used: used[`library/${kind}/${item.file}`] || 0 }));
}

async function libraryAdd(request, env, { json, fail }) {
    const form = await request.formData().catch(() => null);
    const kind = form && form.get('kind');
    if (!LIBRARY_KINDS.includes(kind)) return fail('Kho không hợp lệ.');
    const file = form.get('file');
    if (!file || typeof file === 'string') return fail('Chưa chọn file.');
    const music = kind === 'music';
    if (file.size > (music ? 20 : 10) * 1024 * 1024) return fail(music ? 'File nhạc quá lớn (tối đa 20MB).' : 'Ảnh quá lớn (tối đa 10MB).');
    const bytes = new Uint8Array(await file.arrayBuffer());
    const type = music ? audioType(bytes) : imageType(bytes);
    if (!type) return fail(music ? 'Chỉ nhận MP3, M4A, OGG, WAV.' : 'Chỉ nhận JPG, PNG, WEBP, GIF.');
    const fields = libraryFields(kind, Object.fromEntries(form.entries()));
    if (!fields.name) return fail('Hãy đặt tên.');
    const id = `${slug(fields.name) || kind}-${randomHex(3)}`;
    const data = { file: `${id}.${type[0]}`, ...fields };
    const duration = Math.round(Number(form.get('duration')));
    if (music && duration > 0) data.duration = duration;
    await putMedia(env, `library/${kind}/${data.file}`, bytes, type[1]);
    await saveLibraryRow(env, kind, id, data, { uploaded: true, hidden: false });
    return json({ success: true, item: { ...data, id, uploaded: true, hidden: false, used: 0 } });
}

// ---- Lời cảm ơn ----

// Gom theo kịch bản (ai tặng ai, ai cảm ơn), kịch bản có lời mới nhất trước: [{ id, title, author, recipient, owners,
// total, replies: [{ n, t, name, message }] }]
const REPLY_GROUPS = 20;

async function replyGroups(env, { page = 1 }) {
    const db = await database(env);
    const [groups, total] = await db.batch([
        db.prepare("SELECT r.id, c.title, c.author, json_extract(c.data, '$.recipient') AS recipient, count(*) AS total, max(r.n) AS last, "
            + "(SELECT group_concat(u.email, ', ') FROM user_keys k JOIN users u ON u.id = k.user WHERE k.id = r.id) AS owners "
            + 'FROM replies r LEFT JOIN configs c ON c.id = r.id GROUP BY r.id ORDER BY last DESC LIMIT ? OFFSET ?')
            .bind(REPLY_GROUPS, (page - 1) * REPLY_GROUPS),
        db.prepare('SELECT count(DISTINCT id) AS n FROM replies')
    ]);
    const ids = groups.results.map(group => group.id);
    const { results } = await db.prepare('SELECT n, id, t, name, message FROM replies WHERE id IN (SELECT value FROM json_each(?)) ORDER BY n DESC')
        .bind(JSON.stringify(ids)).all();
    const items = groups.results.map(group => ({
        id: group.id, title: group.title || group.id, author: group.author || '', recipient: group.recipient || '',
        owners: group.owners || '', total: group.total, replies: results.filter(reply => reply.id === group.id)
    }));
    return { items, total: total.results[0].n, page, pageSize: REPLY_GROUPS };
}

// ---------------------------------------------------------------------------

// tools (của index.js): json, fail, removeScript(env, id) xóa kịch bản cùng ảnh, nhạc chỉ nó dùng
export async function admin(request, env, url, tools) {
    const { json, fail, removeScript } = tools;
    const user = await currentUser(request, env);
    if (!user) return json({ success: false, code: 'login', message: 'Hãy đăng nhập bằng tài khoản quản trị.' }, { status: 401 });
    if (!isAdmin(env, user)) return json({ success: false, code: 'forbidden', message: `Tài khoản ${user.email} không có quyền quản trị.` }, { status: 403 });
    if (request.method !== 'POST') return fail('Phương thức không hợp lệ.');
    const action = url.searchParams.get('action');
    if (action === 'libraryAdd') return libraryAdd(request, env, tools);
    const body = await request.json().catch(() => null) || {};
    const db = await database(env);
    const id = typeof body.id === 'string' ? body.id : '';

    switch (action) {
    case 'overview': {
        const weekAgo = now() - 7 * 86400;
        const counts = await db.prepare('SELECT '
            + "(SELECT count(*) FROM configs WHERE id NOT LIKE 'preview_temp%') AS scripts, "
            + "(SELECT count(*) FROM configs WHERE id NOT LIKE 'preview_temp%' AND updated > ?1) AS scriptsWeek, "
            + "(SELECT count(*) FROM configs WHERE id LIKE 'preview_temp%') AS previews, "
            + '(SELECT count(*) FROM users) AS users, (SELECT count(*) FROM users WHERE created > ?1) AS usersWeek, '
            + '(SELECT count(*) FROM users WHERE locked = 1) AS locked, (SELECT count(*) FROM replies) AS replies, '
            + "(SELECT count(*) FROM replies WHERE t > ?3) AS repliesWeek, "
            + "(SELECT coalesce(sum(json_extract(data, '$.counts.open')), 0) FROM opens) AS opens, "
            + "(SELECT coalesce(sum(json_extract(data, '$.counts.view')), 0) FROM opens) AS views, "
            + '(SELECT count(*) FROM sessions WHERE expires > ?2) AS sessions')
            .bind(weekAgo, now(), new Date(weekAgo * 1000).toISOString()).first();
        const scripts = await scriptRows(env, { size: 6 });
        const users = await userRows(env, {});
        return json({ success: true, counts, scripts: scripts.items, users: users.items.slice(0, 6), me: user.email });
    }
    case 'usage':
        return json({ success: true, ...(await cloudflareUsage(env)) });
    case 'scripts':
        return json({ success: true, ...(await scriptRows(env, { q: text(body.q, 80), user: text(body.user, 120), page: pageOf(body.page) })) });
    case 'script': {
        const detail = await scriptDetail(env, id);
        return detail ? json({ success: true, ...detail }) : fail('Không có kịch bản này.');
    }
    case 'deleteScript':
        if (!(await removeScript(env, id))) return fail('Không có kịch bản này.');
        return json({ success: true });
    case 'users':
        return json({ success: true, ...(await userRows(env, { q: text(body.q, 80), page: pageOf(body.page) })) });
    case 'lockUser': {
        const target = await findUser(env, id);
        if (!target) return fail('Không có người dùng này.');
        if (isAdmin(env, target)) return fail('Không khóa được tài khoản quản trị.');
        const locked = body.locked !== false;
        await db.batch([
            db.prepare('UPDATE users SET locked = ? WHERE id = ?').bind(locked ? 1 : 0, id),
            // Khóa: đăng xuất ngay trên mọi máy
            ...(locked ? [db.prepare('DELETE FROM sessions WHERE user = ?').bind(id)] : [])
        ]);
        return json({ success: true, locked });
    }
    case 'deleteUser': {
        const target = await findUser(env, id);
        if (!target) return fail('Không có người dùng này.');
        if (isAdmin(env, target)) return fail('Không xóa được tài khoản quản trị.');
        if (body.scripts) {
            const { results } = await db.prepare('SELECT k.id FROM user_keys k JOIN configs c ON c.id = k.id WHERE k.user = ? LIMIT ?')
                .bind(id, DELETE_BATCH + 1).all();
            for (const row of results.slice(0, DELETE_BATCH)) await removeScript(env, row.id);
            if (results.length > DELETE_BATCH) return json({ success: true, remaining: true });
        }
        await deleteUser(env, id);
        return json({ success: true, remaining: false });
    }
    case 'library': {
        if (!LIBRARY_KINDS.includes(body.kind)) return fail('Kho không hợp lệ.');
        return json({ success: true, items: await libraryWithUsage(env, url, body.kind) });
    }
    case 'libraryUpdate': {
        const { kind } = body;
        if (!LIBRARY_KINDS.includes(kind)) return fail('Kho không hợp lệ.');
        const item = (await libraryItems(env, url, kind)).find(entry => entry.id === id);
        if (!item) return fail('Không có mục này.');
        const fields = libraryFields(kind, body);
        if ('name' in fields && !fields.name) return fail('Tên không được để trống.');
        const row = await libraryRow(env, kind, id);
        const hidden = typeof body.hidden === 'boolean' ? body.hidden : item.hidden;
        await saveLibraryRow(env, kind, id, { ...(row ? row.data : {}), ...fields }, { uploaded: item.uploaded, hidden });
        return json({ success: true });
    }
    case 'libraryDelete': {
        const { kind } = body;
        if (!LIBRARY_KINDS.includes(kind)) return fail('Kho không hợp lệ.');
        const item = (await libraryWithUsage(env, url, kind)).find(entry => entry.id === id);
        if (!item) return fail('Không có mục này.');
        if (!item.uploaded) return fail('Mục có sẵn của trang không xóa được, hãy ẩn đi.');
        if (item.used) return fail(`Đang có ${item.used} kịch bản dùng, hãy ẩn thay vì xóa.`);
        await deleteMedia(env, `library/${kind}/${item.file}`);
        await deleteLibraryRow(env, kind, id);
        return json({ success: true });
    }
    case 'replies':
        return json({ success: true, ...(await replyGroups(env, { page: pageOf(body.page) })) });
    case 'deleteReply':
        await db.prepare('DELETE FROM replies WHERE n = ?').bind(Math.floor(Number(body.n)) || 0).run();
        return json({ success: true });
    default:
        return fail('Hành động không hợp lệ.');
    }
}
