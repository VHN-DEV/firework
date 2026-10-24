/*!
 * Hanabi – Cloudflare Worker: tài khoản
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Đăng nhập bằng Google (không bắt buộc): tài khoản giữ hộ mã chủ của các kịch bản người dùng đã tạo, nên đăng nhập ở máy
// nào thì máy đó có lại mã (builder ghi vào firework_owner_keys như khi tự tạo): sửa, xóa kịch bản, Báo mở quà, link theo
// dõi chạy như cũ. Builder lấy mã Google (ID token) bằng Google Identity Services rồi gửi lên đây; Worker kiểm chữ ký bằng
// khóa công khai của Google, tạo phiên đăng nhập (cookie hanabi_session, chỉ Worker đọc được, 30 ngày).
// Bật bằng biến GOOGLE_CLIENT_ID (wrangler.jsonc: vars); không có thì builder không hiện nút đăng nhập.

import { createSession, deleteSession, deleteUser, now, sessionUser, syncUserKeys, upsertUser } from './db.js';

export const SESSION_COOKIE = 'hanabi_session';
const SESSION_DAYS = 30;
const GOOGLE_CERTS = 'https://www.googleapis.com/oauth2/v3/certs';
const GOOGLE_ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];

// Khóa công khai của Google (đổi định kỳ): giữ theo thời hạn Google ghi trong cache-control
let certs = null;

async function googleKeys(env, fresh = false) {
    if (!fresh && certs && certs.until > Date.now()) return certs.keys;
    // GOOGLE_CERTS_URL: chỉ kiểm thử dùng (khóa giả của tests/worker/run.mjs)
    const response = await fetch(env.GOOGLE_CERTS_URL || GOOGLE_CERTS);
    if (!response.ok) throw new Error('Không tải được khóa của Google');
    const { keys } = await response.json();
    const maxAge = Number((/max-age=(\d+)/.exec(response.headers.get('cache-control') || '') || [])[1]) || 3600;
    certs = { keys: Array.isArray(keys) ? keys : [], until: Date.now() + maxAge * 1000 };
    return certs.keys;
}

const base64url = text => Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(text.length / 4) * 4, '=')),
    c => c.charCodeAt(0));
const decodePart = part => JSON.parse(new TextDecoder().decode(base64url(part)));

// Thông tin người dùng trong mã Google nếu mã đúng chữ ký, đúng trang (aud), còn hạn, email đã xác minh; không thì null
async function verifyGoogleToken(env, token, clientId) {
    const parts = typeof token === 'string' ? token.split('.') : [];
    if (parts.length !== 3) return null;
    let header;
    let claims;
    try {
        header = decodePart(parts[0]);
        claims = decodePart(parts[1]);
    } catch (e) {
        return null;
    }
    if (!header || header.alg !== 'RS256' || !claims) return null;
    let jwk = (await googleKeys(env)).find(k => k.kid === header.kid);
    // Google vừa đổi khóa: tải lại một lần
    if (!jwk) jwk = (await googleKeys(env, true)).find(k => k.kid === header.kid);
    if (!jwk) return null;
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const signed = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, base64url(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
    const verified = claims.email_verified === true || claims.email_verified === 'true';
    if (!signed || !GOOGLE_ISSUERS.includes(claims.iss) || claims.aud !== clientId || !(claims.exp > now()) || !verified) return null;
    return typeof claims.sub === 'string' && claims.sub ? claims : null;
}

export function readCookie(request, name) {
    const match = (request.headers.get('cookie') || '').split(/;\s*/).find(part => part.startsWith(`${name}=`));
    return match ? decodeURIComponent(match.slice(name.length + 1)) : '';
}

// Cookie phiên: HttpOnly (mã trang không đọc được), SameSite=Lax (trang khác không gửi kèm khi gọi API), Secure trên https
function sessionCookie(url, token, maxAge) {
    const secure = url.protocol === 'https:' ? '; Secure' : '';
    return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure}`;
}

// Người dùng đang đăng nhập (theo cookie) hoặc null
export async function currentUser(request, env) {
    const token = readCookie(request, SESSION_COOKIE);
    return token ? sessionUser(env, token) : null;
}

const publicUser = user => ({ email: user.email || '', name: user.name || '', picture: user.picture || '' });

// api/account.php?action=...: me (trạng thái, đồng bộ mã), login, logout, delete (xóa tài khoản, giữ kịch bản). Mọi action
// gửi kèm keys: { tên kịch bản: mã chủ } trong trình duyệt để tài khoản giữ thêm (chỉ nhận mã đúng).
// json, fail, overQuota: của index.js (cùng kiểu trả lời với các API khác)
export async function account(request, env, url, { json, fail, overQuota }) {
    if (request.method !== 'POST') return fail('Phương thức không hợp lệ.');
    const clientId = env.GOOGLE_CLIENT_ID || '';
    const body = await request.json().catch(() => null) || {};
    const keys = body.keys && typeof body.keys === 'object' ? body.keys : {};
    const action = url.searchParams.get('action');
    const user = await currentUser(request, env);
    const signedIn = async target => ({ success: true, enabled: true, clientId, user: publicUser(target), keys: await syncUserKeys(env, target.id, keys) });

    if (action === 'me') {
        if (!user) return json({ success: true, enabled: !!clientId, clientId, user: null });
        return json(await signedIn(user));
    }
    if (action === 'login') {
        if (!clientId) return fail('Trang chưa bật đăng nhập.');
        const limit = await overQuota(request, env, [['login', 1]], 'đăng nhập');
        if (limit) return fail(limit, { code: 'rate_limited' });
        const claims = await verifyGoogleToken(env, body.credential, clientId);
        if (!claims) return fail('Đăng nhập Google không thành công, hãy thử lại.');
        const target = {
            id: `google:${claims.sub}`,
            email: typeof claims.email === 'string' ? claims.email : '',
            name: typeof claims.name === 'string' ? claims.name.slice(0, 120) : '',
            picture: typeof claims.picture === 'string' && claims.picture.startsWith('https://') ? claims.picture : ''
        };
        await upsertUser(env, target);
        if (user) await deleteSession(env, readCookie(request, SESSION_COOKIE));
        const token = await createSession(env, target.id, SESSION_DAYS * 86400);
        return json(await signedIn(target), { headers: { 'set-cookie': sessionCookie(url, token, SESSION_DAYS * 86400) } });
    }
    if (action === 'logout' || action === 'delete') {
        const token = readCookie(request, SESSION_COOKIE);
        // Đăng xuất: trả về các mã tài khoản giữ để builder bỏ khỏi máy này. Xóa tài khoản thì máy giữ nguyên mã (kịch bản
        // vẫn còn, máy này vẫn sửa được)
        const keys = action === 'logout' && user ? await syncUserKeys(env, user.id, {}) : {};
        if (action === 'delete' && user) await deleteUser(env, user.id);
        else if (token) await deleteSession(env, token);
        return json({ success: true, keys }, { headers: { 'set-cookie': sessionCookie(url, '', 0) } });
    }
    return fail('Hành động không hợp lệ.');
}
