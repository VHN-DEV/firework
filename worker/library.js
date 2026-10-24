/*!
 * Hanabi – Cloudflare Worker: kho nhạc, kho ảnh
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Kho nhạc, kho ảnh của builder. Danh sách gốc là file tĩnh library/<loại>/index.json đi kèm bản build (xem
// src/static/library/README.md). Trang quản trị thêm bài, ảnh (file lưu ở KV/R2 dưới library/<loại>/<file>), sửa tên,
// nhãn, ẩn bớt mục có sẵn; ghi trong bảng library của D1 (mục có sẵn chỉ lưu phần sửa). Builder vẫn đọc
// library/<loại>/index.json: Worker trả danh sách đã gộp (wrangler.jsonc: run_worker_first).

import { database } from './db.js';

export const LIBRARY_KINDS = ['music', 'images'];
// Trường người quản trị sửa được của mỗi loại
export const LIBRARY_FIELDS = { music: ['name', 'artist', 'tags', 'license', 'source'], images: ['name', 'tags'] };

const parse = text => {
    try {
        const value = JSON.parse(text);
        return value && typeof value === 'object' ? value : {};
    } catch (e) {
        return {};
    }
};

async function staticItems(env, url, kind) {
    const response = await env.ASSETS.fetch(new Request(new URL(`/library/${kind}/index.json`, url)));
    const items = response.ok ? await response.json().catch(() => []) : [];
    return Array.isArray(items) ? items.filter(item => item && typeof item.id === 'string' && typeof item.file === 'string') : [];
}

// Mọi mục của kho, kể cả mục đã ẩn: [{ ...mục, uploaded: tự thêm qua trang quản trị, hidden }]
export async function libraryItems(env, url, kind) {
    const [base, { results }] = await Promise.all([
        staticItems(env, url, kind),
        (await database(env)).prepare('SELECT id, data, uploaded, hidden FROM library WHERE kind = ? ORDER BY created').bind(kind).all()
    ]);
    const rows = new Map(results.map(row => [row.id, row]));
    const items = base.map(item => {
        const row = rows.get(item.id);
        return { ...item, ...(row ? parse(row.data) : {}), id: item.id, file: item.file, uploaded: false, hidden: !!(row && row.hidden) };
    });
    results.filter(row => row.uploaded).forEach(row => {
        const data = parse(row.data);
        if (typeof data.file === 'string') items.push({ ...data, id: row.id, uploaded: true, hidden: !!row.hidden });
    });
    return items;
}

// library/<loại>/index.json cho builder: bỏ mục đã ẩn
export async function libraryIndex(env, url, kind) {
    const items = (await libraryItems(env, url, kind)).filter(item => !item.hidden).map(({ uploaded, hidden, ...item }) => item);
    return new Response(JSON.stringify(items), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-cache' } });
}

// Ghi phần sửa (mục có sẵn) hoặc cả mục (mục tự thêm)
export async function saveLibraryRow(env, kind, id, data, { uploaded, hidden }) {
    await (await database(env)).prepare('INSERT INTO library (kind, id, data, uploaded, hidden, created) VALUES (?, ?, ?, ?, ?, ?) '
        + 'ON CONFLICT(kind, id) DO UPDATE SET data = excluded.data, hidden = excluded.hidden')
        .bind(kind, id, JSON.stringify(data), uploaded ? 1 : 0, hidden ? 1 : 0, Math.floor(Date.now() / 1000)).run();
}

export async function libraryRow(env, kind, id) {
    const row = await (await database(env)).prepare('SELECT data, uploaded, hidden FROM library WHERE kind = ? AND id = ?').bind(kind, id).first();
    return row ? { data: parse(row.data), uploaded: !!row.uploaded, hidden: !!row.hidden } : null;
}

export async function deleteLibraryRow(env, kind, id) {
    await (await database(env)).prepare('DELETE FROM library WHERE kind = ? AND id = ?').bind(kind, id).run();
}
