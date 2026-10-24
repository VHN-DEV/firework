/*!
 * Hanabi – builder (tài khoản)
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Đăng nhập bằng Google (bản chạy trên Cloudflare, worker/account.js), không bắt buộc: tài khoản giữ hộ mã chủ của các
// kịch bản. Đăng nhập thì mã trên máy này gửi lên tài khoản, mã tài khoản đang giữ ghi vào máy này (firework_owner_keys),
// nên Của tôi, sửa, xóa, Báo mở quà chạy như với kịch bản tự tạo trên máy. Đăng xuất thì bỏ các mã đó khỏi máy (máy dùng
// chung không còn thấy kịch bản của mình). Bản PHP (api/account.php luôn trả "chưa bật"), trang tĩnh: không hiện nút
// đăng nhập.

import { getOwnerKeys, removeOwnerKey, saveOwnerKey } from '../gift-tracking.js';
import { isStaticEnv } from './state.js';
import { confirmAction, escapeHtml, hideModal, notify, showModal } from './util.js';

const GIS_URL = 'https://accounts.google.com/gsi/client';

// enabled: máy chủ có đăng nhập (đã đặt GOOGLE_CLIENT_ID); user: { email, name, picture } khi đã đăng nhập
let account = { enabled: false, clientId: '', user: null };
let gisLoading = null;
let gisReady = false;

async function call(action, extra = {}) {
    const response = await fetch(`api/account.php?action=${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys: getOwnerKeys(), ...extra })
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
}

// Mã tài khoản đang giữ: ghi vào máy này
function applyKeys(keys) {
    const local = getOwnerKeys();
    Object.entries(keys || {}).forEach(([id, key]) => {
        if (local[id] !== key) saveOwnerKey(id, key);
    });
}

function avatar(user) {
    if (user.picture) return `<img src="${escapeHtml(user.picture)}" alt="" referrerpolicy="no-referrer">`;
    return `<span>${escapeHtml((user.name || user.email || '?').trim().charAt(0).toUpperCase())}</span>`;
}

function render() {
    const { enabled, user } = account;
    const button = document.getElementById('btn-account');
    const item = document.getElementById('menu-account');
    button.classList.toggle('hide', !enabled);
    item.classList.toggle('hide', !enabled);
    if (!enabled) return;
    button.innerHTML = user ? avatar(user) : '<i class="fas fa-user"></i>';
    button.title = user ? `Tài khoản: ${user.email}` : 'Đăng nhập để giữ kịch bản trên mọi máy';
    button.classList.toggle('signed-in', !!user);
    item.innerHTML = `<i class="fas fa-user"></i> ${user ? 'Tài khoản' : 'Đăng nhập'}`;
    item.title = button.title;
}

function setAccount(data) {
    account = { enabled: !!data.enabled, clientId: data.clientId || '', user: data.user || null };
    applyKeys(data.keys);
    render();
}

export async function initAccount() {
    if (isStaticEnv) return;
    try {
        const data = await call('me');
        if (data.success) setAccount(data);
    } catch (e) {
        // Mất mạng, máy chủ lỗi: không hiện đăng nhập
    }
}

function loadGoogle() {
    if (!gisLoading) {
        gisLoading = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = GIS_URL;
            script.async = true;
            script.onload = () => resolve(window.google);
            script.onerror = () => {
                gisLoading = null;
                reject(new Error('Không tải được Google'));
            };
            document.head.appendChild(script);
        });
    }
    return gisLoading;
}

async function renderGoogleButton(box) {
    box.innerHTML = '<div class="spinner"></div>';
    try {
        const google = await loadGoogle();
        if (!gisReady) {
            google.accounts.id.initialize({ client_id: account.clientId, callback: r => accountLogin(r.credential), ux_mode: 'popup', auto_select: false });
            gisReady = true;
        }
        box.innerHTML = '';
        google.accounts.id.renderButton(box, { theme: 'filled_black', size: 'large', shape: 'pill', text: 'signin_with', locale: 'vi', width: 260 });
    } catch (e) {
        box.innerHTML = '<p class="account-error">Không tải được nút đăng nhập Google. Kiểm tra mạng rồi mở lại.</p>';
    }
}

// Hộp Tài khoản: chưa đăng nhập thì nút Google, đã đăng nhập thì tên, email, Đăng xuất, Xóa tài khoản
export function openAccount() {
    const body = document.getElementById('account-body');
    const { user } = account;
    if (user) {
        body.innerHTML = `
            <div class="account-user">${avatar(user)}<div><strong>${escapeHtml(user.name || user.email)}</strong><small>${escapeHtml(user.email)}</small></div></div>
            <p>Kịch bản của bạn được giữ trong tài khoản: đăng nhập ở máy khác là mở, sửa, xem Báo mở quà được.</p>
            <div class="account-actions">
                <button type="button" class="btn secondary" onclick="hideModal('account-modal'); openScriptsModal()"><i class="fas fa-folder-open"></i> Kịch bản của tôi</button>
                <button type="button" class="btn primary" onclick="accountLogout()"><i class="fas fa-right-from-bracket"></i> Đăng xuất</button>
            </div>
            <button type="button" class="account-delete" onclick="accountDelete()">Xóa tài khoản</button>`;
    } else {
        body.innerHTML = `
            <p>Đăng nhập để giữ kịch bản và Báo mở quà trên mọi máy: đổi máy hay xóa dữ liệu trình duyệt vẫn mở lại được.
                Không đăng nhập vẫn dùng bình thường.</p>
            <div id="google-button" class="google-button"></div>
            <p class="account-note">Trang chỉ nhận tên, email và ảnh đại diện Google của bạn
                (<a href="privacy#tai-khoan" target="_blank" rel="noopener">Chính sách riêng tư</a>).</p>`;
        renderGoogleButton(body.querySelector('#google-button'));
    }
    showModal('account-modal');
}

// Google trả mã đăng nhập (credential): máy chủ kiểm tra, tạo phiên, trả về các mã tài khoản giữ hộ
export async function accountLogin(credential) {
    try {
        const data = await call('login', { credential });
        if (!data.success) {
            notify(data.message || 'Đăng nhập không thành công, hãy thử lại.', 'error');
            return false;
        }
        setAccount(data);
        hideModal('account-modal');
        const count = Object.keys(data.keys || {}).length;
        notify(count ? `Đã đăng nhập. Tài khoản đang giữ ${count} kịch bản của bạn.` : 'Đã đăng nhập. Kịch bản bạn lưu từ giờ được giữ trong tài khoản.', 'success');
        return true;
    } catch (e) {
        notify('Không đăng nhập được, hãy thử lại.', 'error');
        return false;
    }
}

function signedOut() {
    account = { ...account, user: null };
    if (window.google && window.google.accounts) window.google.accounts.id.disableAutoSelect();
    render();
    hideModal('account-modal');
}

export async function accountLogout() {
    try {
        const data = await call('logout');
        // Bỏ khỏi máy này mã của các kịch bản tài khoản giữ (máy dùng chung không còn sửa, xóa được)
        Object.keys(data.keys || {}).forEach(removeOwnerKey);
    } catch (e) {
        notify('Không đăng xuất được, hãy thử lại.', 'error');
        return;
    }
    signedOut();
    notify('Đã đăng xuất. Kịch bản trong tài khoản không còn hiện trên máy này, đăng nhập lại để mở.', 'success');
}

export function accountDelete() {
    confirmAction('Xóa tài khoản? Trang xóa tên, email và danh sách kịch bản tài khoản đang giữ. Kịch bản đã lưu vẫn còn, máy này vẫn sửa được.', async () => {
        try {
            const data = await call('delete');
            if (!data.success) throw new Error(data.message);
        } catch (e) {
            notify('Không xóa được tài khoản, hãy thử lại.', 'error');
            return;
        }
        signedOut();
        notify('Đã xóa tài khoản.', 'success');
    });
}
