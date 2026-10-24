/*!
 * Hanabi – nút đăng nhập bằng Google
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Nút "Đăng nhập bằng Google" (Google Identity Services, chỉ tải khi cần hiện nút): builder (builder/account.js) và trang
// quản trị (admin.js). Google trả mã đăng nhập (credential), trang gửi lên api/account.php?action=login để máy chủ kiểm.

const GIS_URL = 'https://accounts.google.com/gsi/client';
let loading = null;
let readyFor = '';
let onCredential = null;

function loadGoogle() {
    if (!loading) {
        loading = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = GIS_URL;
            script.async = true;
            script.onload = () => resolve(window.google);
            script.onerror = () => {
                loading = null;
                reject(new Error('Không tải được Google'));
            };
            document.head.appendChild(script);
        });
    }
    return loading;
}

// Vẽ nút vào box; Google trả mã đăng nhập thì gọi callback(credential)
export async function renderGoogleButton(box, clientId, callback) {
    onCredential = callback;
    box.innerHTML = '<div class="spinner"></div>';
    try {
        const google = await loadGoogle();
        if (readyFor !== clientId) {
            google.accounts.id.initialize({ client_id: clientId, callback: r => onCredential && onCredential(r.credential), ux_mode: 'popup', auto_select: false });
            readyFor = clientId;
        }
        box.innerHTML = '';
        google.accounts.id.renderButton(box, { theme: 'filled_black', size: 'large', shape: 'pill', text: 'signin_with', locale: 'vi', width: 260 });
    } catch (e) {
        box.innerHTML = '<p class="account-error">Không tải được nút đăng nhập Google. Kiểm tra mạng rồi mở lại.</p>';
    }
}

// Đăng xuất: Google không tự chọn lại tài khoản vừa dùng
export function forgetGoogleChoice() {
    if (window.google && window.google.accounts) window.google.accounts.id.disableAutoSelect();
}
