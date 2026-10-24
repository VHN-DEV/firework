/*!
 * Hanabi – kịch bản gói trong link
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Trang tĩnh (GitHub Pages, Cloudflare Pages...) không có máy chủ lưu kịch bản: bấm Lưu thì kịch bản chỉ nằm trong
// trình duyệt của người tạo. Link chia sẻ ở đó chứa luôn cả kịch bản (JSON nén deflate, mã base64url) sau dấu #
// (demo#k=...): phần sau # không gửi lên máy chủ nên không vướng giới hạn độ dài đường dẫn, mở ở máy nào cũng xem đúng
// như người tạo đã lưu. Dùng chung cho builder (tạo link) và trình phát (đọc link).

const KEY = 'k';

// Trang tĩnh (không có máy chủ lưu kịch bản, ảnh, nhạc, báo mở quà): dùng chung cho builder và trình phát
const host = window.location.hostname;
export const isStaticSite = ['github.io', 'vercel.app', 'netlify.app', 'pages.dev'].some(name => host.includes(name))
    || window.location.protocol === 'file:';

// Trình duyệt nén, giải nén được (Chrome 80+, Firefox 113+, Safari 16.4+)
export const canPackConfig = typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';

const toBase64Url = bytes => {
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64Url = text => {
    const s = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
    return bytes;
};

const through = async (bytes, stream) => new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());

// Ảnh người tạo tự tải lên ở trang tĩnh (dạng data:, có khi hàng trăm KB) không gói vào link được: bỏ đi, kèm số ảnh đã bỏ
export function withoutLocalMedia(config) {
    let dropped = 0;
    const clean = JSON.parse(JSON.stringify(config), (key, value) => {
        if (typeof value === 'string' && /^(data|blob):/i.test(value)) {
            dropped++;
            return undefined;
        }
        return value;
    });
    return { config: clean, dropped };
}

export async function packConfig(config) {
    return toBase64Url(await through(new TextEncoder().encode(JSON.stringify(config)), new CompressionStream('deflate')));
}

export async function unpackConfig(text) {
    return JSON.parse(new TextDecoder().decode(await through(fromBase64Url(text), new DecompressionStream('deflate'))));
}

// Kịch bản gói trong link đang mở (demo#k=...), không có thì null
export function packedConfigInLink(hash = window.location.hash) {
    const match = new RegExp(`[#&]${KEY}=([A-Za-z0-9_-]+)`).exec(hash);
    return match ? match[1] : null;
}

// Link xem chứa sẵn kịch bản (bỏ ảnh tự tải lên): { url, dropped: số ảnh đã bỏ }
export async function packedShowUrl(config, base = window.location.href) {
    const { config: clean, dropped } = withoutLocalMedia(config);
    const url = new URL('demo', base);
    url.hash = `${KEY}=${await packConfig(clean)}`;
    return { url: url.href, dropped };
}
