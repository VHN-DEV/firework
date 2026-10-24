/*!
 * Hanabi – Cloudflare Worker: hạn mức Cloudflare
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Hạn mức Cloudflare đã dùng hôm nay (trang quản trị, Bảng điều khiển): lượt gọi Worker, dòng đọc/ghi D1, thao tác KV,
// dung lượng, tính từ 0h giờ quốc tế (7h sáng giờ Việt Nam, lúc Cloudflare đặt lại hạn mức ngày), đọc qua GraphQL
// Analytics API. Cần hai Secret của Worker: CF_ACCOUNT_ID (mã tài khoản Cloudflare) và CF_API_TOKEN (API token chỉ có quyền
// Account Analytics: Read). Hạn mức tính cho cả tài khoản (mọi Worker, mọi cơ sở dữ liệu), nên cộng tất cả.

const ENDPOINT = 'https://api.cloudflare.com/client/v4/graphql';
const MB = 1024 * 1024;
// Gói miễn phí (developers.cloudflare.com: Workers, D1, KV limits)
const LIMITS = {
    requests: 100000, d1RowsRead: 5000000, d1RowsWritten: 100000, d1Storage: 500 * MB,
    kvRead: 100000, kvWrite: 1000, kvDelete: 1000, kvList: 1000, kvStorage: 1024 * MB
};

// Mỗi nhóm số liệu một câu hỏi riêng: một nhóm lỗi (tên trường đổi, chưa có dữ liệu) không làm hỏng nhóm khác
const QUERIES = {
    workers: ({ start, end }) => `workersInvocationsAdaptive(limit: 10000, filter: { datetime_geq: "${start}", datetime_leq: "${end}" }) {
        sum { requests errors } }`,
    d1: ({ date }) => `d1AnalyticsAdaptiveGroups(limit: 10000, filter: { date_geq: "${date}", date_leq: "${date}" }) {
        sum { readQueries writeQueries rowsRead rowsWritten } }`,
    d1Storage: ({ since, date }) => `d1StorageAdaptiveGroups(limit: 10000, filter: { date_geq: "${since}", date_leq: "${date}" }, orderBy: [date_DESC]) {
        max { databaseSizeBytes } dimensions { date databaseId } }`,
    kv: ({ date }) => `kvOperationsAdaptiveGroups(limit: 10000, filter: { date_geq: "${date}", date_leq: "${date}" }) {
        sum { requests } dimensions { actionType } }`,
    kvStorage: ({ since, date }) => `kvStorageAdaptiveGroups(limit: 10000, filter: { date_geq: "${since}", date_leq: "${date}" }, orderBy: [date_DESC]) {
        max { byteCount keyCount } dimensions { date namespaceId } }`
};

// Số liệu vừa đọc: giữ 1 phút (mở lại trang không hỏi Cloudflare lần nữa)
let cached = null;

async function ask(env, account, name, range) {
    const query = `{ viewer { accounts(filter: { accountTag: "${account}" }) { ${QUERIES[name](range)} } } }`;
    const response = await fetch(env.CF_GRAPHQL_URL || ENDPOINT, {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.CF_API_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
    });
    const data = await response.json().catch(() => null);
    const error = !response.ok ? `HTTP ${response.status}` : data && data.errors && data.errors.length ? data.errors[0].message : '';
    if (error || !data || !data.data) throw new Error(error || 'Cloudflare không trả số liệu');
    const accounts = data.data.viewer && data.data.viewer.accounts;
    if (!accounts || !accounts.length) throw new Error('Không thấy tài khoản (kiểm tra CF_ACCOUNT_ID, quyền của token)');
    return Object.values(accounts[0])[0] || [];
}

const total = (rows, pick) => rows.reduce((sum, row) => sum + (Number(pick(row)) || 0), 0);

// Dung lượng: mỗi cơ sở dữ liệu, mỗi namespace lấy ngày gần nhất rồi cộng
function latestSize(rows, idKey, sizeKey) {
    const seen = new Set();
    return rows.reduce((sum, row) => {
        const id = row.dimensions && row.dimensions[idKey];
        if (seen.has(id)) return sum;
        seen.add(id);
        return sum + (Number(row.max && row.max[sizeKey]) || 0);
    }, 0);
}

export async function cloudflareUsage(env) {
    const account = String(env.CF_ACCOUNT_ID || '').trim();
    if (!/^[a-f0-9]{32}$/.test(account) || !env.CF_API_TOKEN) return { configured: false };
    if (cached && cached.until > Date.now()) return cached.value;
    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    const range = {
        date, start: `${date}T00:00:00Z`, end: now.toISOString().replace(/\.\d+Z$/, 'Z'),
        // Dung lượng ghi theo ngày, có hôm chưa có số: lấy trong 3 ngày gần nhất
        since: new Date(now.getTime() - 2 * 86400000).toISOString().slice(0, 10)
    };
    const names = Object.keys(QUERIES);
    const results = await Promise.allSettled(names.map(name => ask(env, account, name, range)));
    const got = Object.fromEntries(names.map((name, i) => [name, results[i]]));
    const item = (key, label, hint, source, read, unit = 'count') => {
        const result = got[source];
        return result.status === 'fulfilled'
            ? { key, label, hint, unit, used: read(result.value), limit: LIMITS[key] }
            : { key, label, hint, unit, used: null, limit: LIMITS[key], error: result.reason.message };
    };
    const kvAction = action => rows => total(rows.filter(row => row.dimensions && row.dimensions.actionType === action), row => row.sum && row.sum.requests);
    const tomorrow = new Date(`${date}T00:00:00Z`).getTime() + 86400000;
    const value = {
        configured: true,
        at: now.toISOString(),
        resetAt: new Date(tomorrow).toISOString(),
        items: [
            item('requests', 'Lượt gọi Worker', 'Mở quà, lưu, tải lên, trang chia sẻ, API (file tĩnh không tính)', 'workers', rows => total(rows, row => row.sum && row.sum.requests)),
            item('d1RowsRead', 'D1: dòng đọc', 'Đọc kịch bản, danh sách, tìm kiếm', 'd1', rows => total(rows, row => row.sum && row.sum.rowsRead)),
            item('d1RowsWritten', 'D1: dòng ghi', 'Lưu kịch bản, báo mở quà, đếm chống spam', 'd1', rows => total(rows, row => row.sum && row.sum.rowsWritten)),
            item('kvRead', 'KV: lượt đọc', 'Ảnh, nhạc người xem tải', 'kv', kvAction('read')),
            item('kvWrite', 'KV: lượt ghi', 'Ảnh, nhạc tải lên, ảnh thiệp khi lưu', 'kv', kvAction('write')),
            item('kvDelete', 'KV: lượt xóa', 'Xóa kịch bản, dọn file hằng ngày', 'kv', kvAction('delete')),
            item('kvList', 'KV: lượt liệt kê', 'Dọn ảnh, nhạc khi xóa kịch bản, hằng ngày', 'kv', kvAction('list')),
            item('d1Storage', 'D1: dung lượng', 'Kịch bản, tài khoản, lượt mở, lời cảm ơn', 'd1Storage', rows => latestSize(rows, 'databaseId', 'databaseSizeBytes'), 'bytes'),
            item('kvStorage', 'KV: dung lượng', 'Ảnh, nhạc tải lên, ảnh thiệp, kho', 'kvStorage', rows => latestSize(rows, 'namespaceId', 'byteCount'), 'bytes')
        ]
    };
    cached = { value, until: Date.now() + 60000 };
    return value;
}
