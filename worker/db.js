/*!
 * Hanabi – Cloudflare Worker: cơ sở dữ liệu
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Cơ sở dữ liệu D1 (binding DB) thay cho file JSON của bản PHP: kịch bản lưu từ builder (configs), mã chủ của máy đã tạo
// kịch bản (owners, chỉ lưu bản băm: cũng là mã theo dõi mở quà), lịch sử mở quà (opens, xem api/tracking.inc.php). Bảng
// tạo khi cần (lần đầu mỗi isolate), không phải chạy lệnh tạo bảng.

const SCHEMA = [
    'CREATE TABLE IF NOT EXISTS configs (id TEXT PRIMARY KEY, data TEXT NOT NULL, title TEXT, author TEXT, events INTEGER NOT NULL DEFAULT 0, updated INTEGER NOT NULL, image INTEGER NOT NULL DEFAULT 0)',
    'CREATE TABLE IF NOT EXISTS owners (id TEXT PRIMARY KEY, hash TEXT NOT NULL, created TEXT NOT NULL)',
    'CREATE TABLE IF NOT EXISTS opens (id TEXT PRIMARY KEY, data TEXT NOT NULL)'
];

export const TRACK_EVENTS = ['view', 'open', 'finish'];
export const TRACK_DEVICES = ['mobile', 'tablet', 'desktop'];
// Giữ tối đa chừng này sự kiện gần nhất mỗi kịch bản (số đếm vẫn cộng dồn)
const TRACK_MAX_EVENTS = 300;
// Chống gửi dồn: tối đa chừng này sự kiện mỗi phút cho một kịch bản
const TRACK_MAX_PER_MINUTE = 20;

let ready = null;

async function database(env) {
    if (!env.DB) throw new Error('Chưa gắn cơ sở dữ liệu D1 (binding DB trong wrangler.jsonc)');
    if (!ready) {
        ready = env.DB.batch(SCHEMA.map(sql => env.DB.prepare(sql))).catch(e => {
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

async function sha256(text) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// ---- Kịch bản ----

// { data: kịch bản, updated: giây, image: có ảnh xem trước configs/<tên>.jpg } hoặc null
export async function getConfig(env, id) {
    const row = await (await database(env)).prepare('SELECT data, updated, image FROM configs WHERE id = ?').bind(id).first();
    if (!row) return null;
    let data = null;
    try {
        data = JSON.parse(row.data);
    } catch (e) {
        // Dữ liệu hỏng: coi như không có
    }
    return data ? { data, updated: row.updated, image: !!row.image } : null;
}

export async function putConfig(env, id, config, image) {
    const db = await database(env);
    const text = (v, fallback) => (typeof v === 'string' ? v : fallback);
    await db.prepare('INSERT INTO configs (id, data, title, author, events, updated, image) VALUES (?, ?, ?, ?, ?, ?, ?) '
        + 'ON CONFLICT(id) DO UPDATE SET data = excluded.data, title = excluded.title, author = excluded.author, '
        + 'events = excluded.events, updated = excluded.updated, image = excluded.image')
        .bind(id, JSON.stringify(config), text(config.title, id), text(config.author, 'Unknown'), config.events.length, now(), image ? 1 : 0)
        .run();
}

// Danh sách kịch bản đã lưu (bỏ bản tạm của nút Xem thử): { id, title, author, eventCount, status, locked }
export async function listConfigs(env) {
    const { results } = await (await database(env)).prepare(
        "SELECT c.id, c.title, c.author, c.events, o.id AS owner FROM configs c LEFT JOIN owners o ON o.id = c.id WHERE c.id NOT LIKE 'preview_temp%'"
    ).all();
    return results.map(r => ({ id: r.id, title: r.title || r.id, author: r.author || 'Unknown', eventCount: r.events, status: 'public', locked: !!r.owner }));
}

// Xóa kịch bản cùng mã chủ, lịch sử mở quà
export async function deleteConfig(env, id) {
    const db = await database(env);
    await db.batch(['configs', 'owners', 'opens'].map(table => db.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(id)));
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
