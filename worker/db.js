/*!
 * Hanabi – Cloudflare Worker: cơ sở dữ liệu
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Cơ sở dữ liệu D1 (binding DB) thay cho file JSON của bản PHP: kịch bản lưu từ builder (configs), mã chủ của máy đã tạo
// kịch bản (owners, chỉ lưu bản băm: cũng là mã theo dõi mở quà), lịch sử mở quà (opens), lời cảm ơn của người nhận
// (replies), xem api/tracking.inc.php. Bảng
// tạo khi cần (lần đầu mỗi isolate), không phải chạy lệnh tạo bảng. Bảng quota đếm số lần lưu, tải lên của mỗi máy (xem
// useQuota). Tài khoản (account.js): users (người dùng Google; locked: bị quản trị khóa), sessions (phiên đăng nhập, chỉ lưu
// bản băm của mã phiên), user_keys (mã chủ các kịch bản tài khoản giữ hộ). Kho nhạc, kho ảnh: library (library.js).

const SCHEMA = [
    'CREATE TABLE IF NOT EXISTS configs (id TEXT PRIMARY KEY, data TEXT NOT NULL, title TEXT, author TEXT, events INTEGER NOT NULL DEFAULT 0, updated INTEGER NOT NULL, image INTEGER NOT NULL DEFAULT 0)',
    'CREATE TABLE IF NOT EXISTS owners (id TEXT PRIMARY KEY, hash TEXT NOT NULL, created TEXT NOT NULL)',
    'CREATE TABLE IF NOT EXISTS opens (id TEXT PRIMARY KEY, data TEXT NOT NULL)',
    'CREATE TABLE IF NOT EXISTS quota (key TEXT PRIMARY KEY, used INTEGER NOT NULL, expires INTEGER NOT NULL)',
    'CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT, name TEXT, picture TEXT, created INTEGER NOT NULL)',
    'CREATE TABLE IF NOT EXISTS sessions (hash TEXT PRIMARY KEY, user TEXT NOT NULL, expires INTEGER NOT NULL)',
    'CREATE TABLE IF NOT EXISTS user_keys (user TEXT NOT NULL, id TEXT NOT NULL, key TEXT NOT NULL, PRIMARY KEY (user, id))',
    'CREATE TABLE IF NOT EXISTS replies (n INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL, t TEXT NOT NULL, name TEXT, message TEXT NOT NULL)',
    'CREATE INDEX IF NOT EXISTS replies_id ON replies (id)',
    'CREATE TABLE IF NOT EXISTS library (kind TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, uploaded INTEGER NOT NULL DEFAULT 0, '
        + 'hidden INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL, PRIMARY KEY (kind, id))'
];
// Cột thêm sau khi đã có bảng: thumb (bản băm ảnh thiệp đang lưu, để không ghi lại ảnh không đổi), seen (lần đăng nhập gần
// nhất), locked (tài khoản bị khóa)
const COLUMNS = [
    'ALTER TABLE configs ADD COLUMN thumb TEXT',
    'ALTER TABLE users ADD COLUMN seen INTEGER',
    'ALTER TABLE users ADD COLUMN locked INTEGER NOT NULL DEFAULT 0'
];

export const TRACK_EVENTS = ['view', 'open', 'finish'];
export const TRACK_DEVICES = ['mobile', 'tablet', 'desktop'];
// Giữ tối đa chừng này sự kiện gần nhất mỗi kịch bản (số đếm vẫn cộng dồn)
const TRACK_MAX_EVENTS = 300;
// Chống gửi dồn: tối đa chừng này sự kiện mỗi phút cho một kịch bản
const TRACK_MAX_PER_MINUTE = 20;
// Lời cảm ơn: giữ chừng này lời gần nhất mỗi kịch bản, trạng thái gửi về chừng này lời mới nhất
const REPLY_MAX = 50;
const REPLY_SHOWN = 20;

let ready = null;

export async function database(env) {
    if (!env.DB) throw new Error('Chưa gắn cơ sở dữ liệu D1 (binding DB trong wrangler.jsonc)');
    if (!ready) {
        ready = env.DB.batch(SCHEMA.map(sql => env.DB.prepare(sql)))
            // Cột đã có thì lệnh báo lỗi trùng cột: bỏ qua
            .then(() => Promise.all(COLUMNS.map(sql => env.DB.prepare(sql).run().catch(() => {}))))
            .catch(e => {
                ready = null;
                throw e;
            });
    }
    await ready;
    return env.DB;
}

export const now = () => Math.floor(Date.now() / 1000);

export function randomHex(bytes) {
    return [...crypto.getRandomValues(new Uint8Array(bytes))].map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function sha256(text) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// ---- Kịch bản ----

// { data: kịch bản, updated: giây, image: có ảnh xem trước configs/<tên>.jpg, thumb: bản băm ảnh đó } hoặc null
export async function getConfig(env, id) {
    const row = await (await database(env)).prepare('SELECT data, updated, image, thumb FROM configs WHERE id = ?').bind(id).first();
    if (!row) return null;
    let data = null;
    try {
        data = JSON.parse(row.data);
    } catch (e) {
        // Dữ liệu hỏng: coi như không có
    }
    return data ? { data, updated: row.updated, image: !!row.image, thumb: row.thumb || null } : null;
}

// Kịch bản dạng JSON như đã lưu (gửi thẳng cho trình phát, không phải đọc ra rồi ghi lại): { data, updated, size } hoặc
// null. withData = false: chỉ lấy lúc lưu và độ dài (để biết trình duyệt đang giữ bản mới nhất chưa)
export async function getConfigText(env, id, withData = true) {
    return (await database(env)).prepare(`SELECT ${withData ? 'data, ' : ''}updated, length(data) AS size FROM configs WHERE id = ?`).bind(id).first();
}

// text: kịch bản dạng JSON (đã có sẵn khi kiểm tra dung lượng)
export async function putConfig(env, id, config, text, image, thumb) {
    const db = await database(env);
    const field = (v, fallback) => (typeof v === 'string' ? v : fallback);
    await db.prepare('INSERT INTO configs (id, data, title, author, events, updated, image, thumb) VALUES (?, ?, ?, ?, ?, ?, ?, ?) '
        + 'ON CONFLICT(id) DO UPDATE SET data = excluded.data, title = excluded.title, author = excluded.author, '
        + 'events = excluded.events, updated = excluded.updated, image = excluded.image, thumb = excluded.thumb')
        .bind(id, text, field(config.title, id), field(config.author, 'Unknown'), config.events.length, now(), image ? 1 : 0, thumb || null)
        .run();
}

// Kịch bản đã lưu mà trình duyệt gửi đúng mã chủ (keys: { tên: mã }) và kịch bản chưa có mã (lưu trước khi có mã chủ);
// kịch bản của người khác không liệt kê. Bỏ bản tạm của nút Xem thử: { id, title, author, eventCount, status, locked }
export async function listConfigs(env, keys) {
    const ids = Object.keys(keys).filter(validTrackId).slice(0, 500);
    const { results } = await (await database(env)).prepare(
        "SELECT c.id, c.title, c.author, c.events, o.hash FROM configs c LEFT JOIN owners o ON o.id = c.id "
        + "WHERE c.id NOT LIKE 'preview_temp%' AND (o.id IS NULL OR c.id IN (SELECT value FROM json_each(?)))"
    ).bind(JSON.stringify(ids)).all();
    const list = [];
    for (const r of results) {
        const key = keys[r.id];
        if (r.hash && !(typeof key === 'string' && /^[a-f0-9]{32}$/.test(key) && r.hash === await sha256(key))) continue;
        list.push({ id: r.id, title: r.title || r.id, author: r.author || 'Unknown', eventCount: r.events, status: 'public', locked: !!r.hash });
    }
    return list;
}

// Xóa kịch bản cùng mã chủ, lịch sử mở quà, lời cảm ơn, mã tài khoản giữ hộ
export async function deleteConfig(env, id) {
    const db = await database(env);
    await db.batch(['configs', 'owners', 'opens', 'replies', 'user_keys'].map(table => db.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(id)));
}

// Trong các file keys (uploads/...), những file không còn kịch bản nào (kể cả bản Xem thử) nhắc tới
export async function unusedMedia(env, keys) {
    if (!keys.length) return [];
    const db = await database(env);
    const chunks = [];
    for (let i = 0; i < keys.length; i += 50) chunks.push(keys.slice(i, i + 50));
    const results = await db.batch(chunks.map(chunk => db.prepare(
        'SELECT value FROM json_each(?) WHERE NOT EXISTS (SELECT 1 FROM configs WHERE instr(data, value) > 0)'
    ).bind(JSON.stringify(chunk))));
    return results.flatMap(r => r.results.map(row => row.value));
}

// Bản tạm của nút Xem thử cũ hơn 1 ngày
export async function deleteOldPreviews(env) {
    await (await database(env)).prepare("DELETE FROM configs WHERE id LIKE 'preview_temp%' AND updated < ?").bind(now() - 86400).run();
}

// ---- Mã chủ (mã theo dõi mở quà) ----

// Bản tạm của nút Xem thử không có mã theo dõi, không ghi lịch sử mở quà
export const validTrackId = id => typeof id === 'string' && /^[a-z0-9_-]{1,80}$/.test(id) && !id.startsWith('preview_temp');

// Kịch bản mới: tạo mã, trả về mã (chỉ một lần duy nhất). Đã có mã thì trả về null (hai lần lưu cùng lúc không cùng nhận mã)
export async function createKey(env, id) {
    if (!validTrackId(id)) return null;
    const key = randomHex(16);
    const result = await (await database(env)).prepare('INSERT INTO owners (id, hash, created) VALUES (?, ?, ?) ON CONFLICT(id) DO NOTHING')
        .bind(id, await sha256(key), new Date().toISOString()).run();
    return result.meta && result.meta.changes ? key : null;
}

export async function hasKey(env, id) {
    if (!validTrackId(id)) return false;
    return !!(await (await database(env)).prepare('SELECT 1 FROM owners WHERE id = ?').bind(id).first());
}

export async function checkKey(env, id, key) {
    if (!validTrackId(id) || typeof key !== 'string' || !/^[a-f0-9]{32}$/.test(key)) return false;
    const row = await (await database(env)).prepare('SELECT hash FROM owners WHERE id = ?').bind(id).first();
    return !!row && row.hash === await sha256(key);
}

// Kịch bản đã có mã chỉ máy giữ mã mới lưu đè, xóa được; chưa có mã thì ai cũng sửa được
export async function canModify(env, id, key) {
    return !(await hasKey(env, id)) || checkKey(env, id, key);
}

// ---- Lịch sử mở quà ----

const emptyOpens = () => ({ events: [], counts: { view: 0, open: 0, finish: 0 }, first: {} });

export async function loadOpens(env, id) {
    const row = await (await database(env)).prepare('SELECT data FROM opens WHERE id = ?').bind(id).first();
    try {
        const data = row ? JSON.parse(row.data) : null;
        if (data && Array.isArray(data.events)) return data;
    } catch (e) {
        // Dữ liệu hỏng: bắt đầu lại
    }
    return emptyOpens();
}

// Trạng thái nhiều món quà một lượt (ba câu lệnh cho mọi món: D1 miễn phí chỉ cho 50 câu lệnh mỗi lần gọi Worker).
// items: [{ id, key }] -> [{ id, ok, counts, first, events, replies: [{ t, name, message }] }] (mã sai: { id, ok: false })
export async function openStatus(env, items) {
    const db = await database(env);
    const ids = JSON.stringify([...new Set(items.map(item => item.id).filter(validTrackId))]);
    const [owners, opens, replies] = await db.batch([
        db.prepare('SELECT id, hash FROM owners WHERE id IN (SELECT value FROM json_each(?))').bind(ids),
        db.prepare('SELECT id, data FROM opens WHERE id IN (SELECT value FROM json_each(?))').bind(ids),
        db.prepare('SELECT id, t, name, message FROM replies WHERE id IN (SELECT value FROM json_each(?)) ORDER BY n').bind(ids)
    ]);
    const hashes = Object.fromEntries(owners.results.map(r => [r.id, r.hash]));
    const result = [];
    for (const { id, key } of items) {
        if (!hashes[id] || !/^[a-f0-9]{32}$/.test(key) || hashes[id] !== await sha256(key)) {
            result.push({ id, ok: false });
            continue;
        }
        let data = emptyOpens();
        try {
            const row = opens.results.find(r => r.id === id);
            const parsed = row ? JSON.parse(row.data) : null;
            if (parsed && Array.isArray(parsed.events)) data = parsed;
        } catch (e) {
            // Dữ liệu hỏng: như chưa có lượt mở
        }
        const said = replies.results.filter(r => r.id === id).slice(-REPLY_SHOWN).map(({ t, name, message }) => ({ t, name: name || '', message }));
        result.push({ id, ok: true, counts: data.counts, first: data.first, events: data.events.slice(-50), replies: said });
    }
    return result;
}

// Lời cảm ơn của người nhận (đã kiểm tra độ dài); chỉ giữ REPLY_MAX lời gần nhất
export async function addReply(env, id, name, message) {
    const db = await database(env);
    await db.batch([
        db.prepare('INSERT INTO replies (id, t, name, message) VALUES (?, ?, ?, ?)').bind(id, new Date().toISOString(), name, message),
        db.prepare('DELETE FROM replies WHERE id = ? AND n NOT IN (SELECT n FROM replies WHERE id = ? ORDER BY n DESC LIMIT ?)').bind(id, id, REPLY_MAX)
    ]);
}

export async function recordOpen(env, id, event, device) {
    const data = await loadOpens(env, id);
    const minuteAgo = Date.now() - 60000;
    if (data.events.filter(item => Date.parse(item.t) > minuteAgo).length >= TRACK_MAX_PER_MINUTE) return false;
    const t = new Date().toISOString();
    data.events.push({ t, e: event, d: device });
    if (data.events.length > TRACK_MAX_EVENTS) data.events = data.events.slice(-TRACK_MAX_EVENTS);
    data.counts[event] = (data.counts[event] || 0) + 1;
    if (!data.first[event]) data.first[event] = t;
    await (await database(env)).prepare('INSERT INTO opens (id, data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data')
        .bind(id, JSON.stringify(data)).run();
    return true;
}

// ---- Giới hạn mỗi máy (chống spam) ----

// Cộng số lần (hoặc dung lượng) của từng mục [tên, lượng] vào khung giờ hiện tại của mỗi luật [tối đa, số giây] trong
// limits[tên]. Khung tính tròn theo giờ quốc tế (khung một ngày bắt đầu lúc 7h sáng giờ Việt Nam, cùng lúc Cloudflare đặt
// lại hạn mức). who: bản băm địa chỉ máy (không lưu địa chỉ thật). Còn trong hạn mức trả về null, vượt thì trả về
// { end: lúc hết khung đang vượt (giây), per: độ dài khung đó }. Lần bị chặn vẫn được cộng.
export async function useQuota(env, who, items, limits) {
    const db = await database(env);
    const t = now();
    const rules = items.flatMap(([name, amount]) => limits[name].map(([max, per]) => ({ name, amount, max, per, end: (Math.floor(t / per) + 1) * per })));
    const results = await db.batch(rules.map(r => db.prepare(
        'INSERT INTO quota (key, used, expires) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET used = used + excluded.used RETURNING used'
    ).bind(`${r.name}:${r.per}:${r.end}:${who}`, r.amount, r.end)));
    const over = rules.filter((r, i) => results[i].results[0].used > r.max).sort((a, b) => b.end - a.end)[0];
    return over ? { end: over.end, per: over.per } : null;
}

export async function deleteOldQuota(env) {
    await (await database(env)).prepare('DELETE FROM quota WHERE expires < ?').bind(now()).run();
}

// ---- Tài khoản ----

// Đăng nhập: tạo hoặc cập nhật người dùng. Tài khoản bị khóa thì không cập nhật, trả về false
export async function upsertUser(env, user) {
    const db = await database(env);
    const row = await db.prepare('SELECT locked FROM users WHERE id = ?').bind(user.id).first();
    if (row && row.locked) return false;
    await db.prepare('INSERT INTO users (id, email, name, picture, created, seen) VALUES (?, ?, ?, ?, ?, ?) '
        + 'ON CONFLICT(id) DO UPDATE SET email = excluded.email, name = excluded.name, picture = excluded.picture, seen = excluded.seen')
        .bind(user.id, user.email, user.name, user.picture, now(), now()).run();
    return true;
}

// Phiên đăng nhập mới: trả về mã phiên (chỉ một lần, vào cookie), máy chủ giữ bản băm
export async function createSession(env, user, seconds) {
    const token = randomHex(32);
    await (await database(env)).prepare('INSERT INTO sessions (hash, user, expires) VALUES (?, ?, ?)')
        .bind(await sha256(token), user, now() + seconds).run();
    return token;
}

// { id, email, name, picture } của phiên còn hạn, hoặc null
export async function sessionUser(env, token) {
    if (!/^[a-f0-9]{64}$/.test(token)) return null;
    return (await database(env)).prepare('SELECT u.id, u.email, u.name, u.picture FROM sessions s JOIN users u ON u.id = s.user '
        + 'WHERE s.hash = ? AND s.expires > ? AND u.locked = 0').bind(await sha256(token), now()).first();
}

export async function deleteSession(env, token) {
    if (!/^[a-f0-9]{64}$/.test(token)) return;
    await (await database(env)).prepare('DELETE FROM sessions WHERE hash = ?').bind(await sha256(token)).run();
}

// Xóa tài khoản: thông tin người dùng, mọi phiên, mã giữ hộ (kịch bản vẫn còn, máy đang giữ mã vẫn sửa được)
export async function deleteUser(env, user) {
    const db = await database(env);
    await db.batch([['users', 'id'], ['sessions', 'user'], ['user_keys', 'user']]
        .map(([table, column]) => db.prepare(`DELETE FROM ${table} WHERE ${column} = ?`).bind(user)));
}

export async function deleteOldSessions(env) {
    await (await database(env)).prepare('DELETE FROM sessions WHERE expires < ?').bind(now()).run();
}

// Tài khoản giữ thêm các mã chủ đúng trong keys ({ tên kịch bản: mã }); trả về mọi mã tài khoản đang giữ (của kịch bản còn
// tồn tại). Mã đã giữ rồi thì không ghi lại.
export async function syncUserKeys(env, user, keys) {
    const db = await database(env);
    const { results } = await db.prepare('SELECT k.id, k.key FROM user_keys k JOIN owners o ON o.id = k.id WHERE k.user = ?').bind(user).all();
    const held = Object.fromEntries(results.map(r => [r.id, r.key]));
    const offered = Object.entries(keys)
        .filter(([id, key]) => validTrackId(id) && typeof key === 'string' && /^[a-f0-9]{32}$/.test(key) && held[id] !== key)
        .slice(0, 500);
    if (!offered.length) return held;
    const { results: owners } = await db.prepare('SELECT id, hash FROM owners WHERE id IN (SELECT value FROM json_each(?))')
        .bind(JSON.stringify(offered.map(([id]) => id))).all();
    const hashes = Object.fromEntries(owners.map(r => [r.id, r.hash]));
    const valid = [];
    for (const [id, key] of offered) {
        if (hashes[id] && hashes[id] === await sha256(key)) valid.push([id, key]);
    }
    if (valid.length) {
        await db.batch(valid.map(([id, key]) => db.prepare(
            'INSERT INTO user_keys (user, id, key) VALUES (?, ?, ?) ON CONFLICT(user, id) DO UPDATE SET key = excluded.key'
        ).bind(user, id, key)));
        valid.forEach(([id, key]) => { held[id] = key; });
    }
    return held;
}
