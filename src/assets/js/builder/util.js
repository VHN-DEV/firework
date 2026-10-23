/*!
 * Trình diễn Pháo hoa – builder (tiện ích)
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Tiện ích giao diện dùng chung: thoát HTML, đường dẫn, thông báo, màn chờ, hỏi xác nhận, định dạng số, hộp thoại.

import { sendPreview, setPreviewMode, updateMiniInfo } from './preview.js';

// Thoát ký tự HTML trước khi chèn dữ liệu người dùng (chữ, màu, tên kịch bản...) vào innerHTML.
// Tránh vỡ giao diện khi chữ có dấu nháy và tránh chạy mã độc từ kịch bản do người khác lưu.
export function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function normalizeAssetPath(path) {
    if (!path) return path;

    // Ảnh dạng data:/blob: (ảnh lưu cục bộ trên GitHub Pages) và URL tuyệt đối thì giữ nguyên
    if (/^(data:|blob:|https?:|\/)/i.test(path)) return path;

    // Xử lý đường dẫn tương đối
    let cleanPath = path.replace(/^\.\//, '');

    if (import.meta.env.DEV) {
        // Trong môi trường dev, đảm bảo có 'src/assets/'
        if (cleanPath.startsWith('assets/')) {
            cleanPath = 'src/' + cleanPath;
        }
    } else if (cleanPath.startsWith('src/assets/')) {
        // Trong bản build, chuyển 'src/assets/' thành 'assets/'
        cleanPath = cleanPath.replace('src/assets/', 'assets/');
    }
    // Đảm bảo đường dẫn là tương đối từ gốc site
    return './' + cleanPath.replace(/^dist\//, '');
}

// Link xem/chia sẻ kịch bản, tính từ vị trí builder.html hiện tại (đúng cả khi URL không có ".html")
export function getShowUrl(filename) {
    const url = new URL('demo.html', window.location.href);
    url.searchParams.set('config', filename);
    return url.href;
}

// Đồng bộ chế độ xem nhanh và nút "Chạy kịch bản" với ô "Tự động lặp lại",
// kể cả khi ô này được đổi bằng code (tạo mới, mở/nhập kịch bản) vì khi đó không có sự kiện 'change'.
export function syncLoopState() {
    const isLoop = document.getElementById('loop').checked;
    setPreviewMode(isLoop ? 'loop' : 'idle');
    document.getElementById('btn-play-mini')?.classList.toggle('hide', isLoop);
    updateMiniInfo();
    sendPreview(true);
}

export function notify(message, type = 'info') {
    const container = document.getElementById('notification-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = 'info-circle';
    if (type === 'success') icon = 'check-circle';
    if (type === 'error') icon = 'exclamation-circle';
    if (type === 'warning') icon = 'exclamation-triangle';

    toast.innerHTML = `
        <i class="fas fa-${icon}"></i>
        <span>${escapeHtml(message)}</span>
    `;

    container.appendChild(toast);

    // Auto remove
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

export function showLoading(message = 'Đang xử lý...') {
    const loader = document.getElementById('global-loading');
    const msgEl = document.getElementById('loading-message');
    if (loader && msgEl) {
        msgEl.innerText = message;
        loader.classList.remove('hide');
    }
}

export function hideLoading() {
    const loader = document.getElementById('global-loading');
    if (loader) {
        loader.classList.add('hide');
    }
}

export function confirmAction(message, onConfirm) {
    const modal = document.getElementById('confirm-modal');
    const msgEl = document.getElementById('confirm-message');
    const yesBtn = document.getElementById('btn-confirm-yes');
    const noBtn = document.getElementById('btn-confirm-no');

    msgEl.innerText = message;
    modal.classList.remove('hide');

    const handleYes = () => {
        cleanup();
        onConfirm();
    };

    const handleNo = () => {
        cleanup();
    };

    const cleanup = () => {
        modal.classList.add('hide');
        yesBtn.removeEventListener('click', handleYes);
        noBtn.removeEventListener('click', handleNo);
    };

    yesBtn.addEventListener('click', handleYes);
    noBtn.addEventListener('click', handleNo);
}

// Một bộ định dạng dùng chung: toLocaleString tạo bộ định dạng mới mỗi lần gọi, vẽ danh sách dài rất chậm
const NUMBER_FORMAT = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 });

export function formatDuration(ms) {
    const seconds = Math.round(ms / 100) / 10;
    if (seconds < 60) return `${NUMBER_FORMAT.format(seconds)} giây`;
    const minutes = Math.floor(seconds / 60);
    const rest = Math.round(seconds - minutes * 60);
    return rest ? `${minutes} phút ${rest} giây` : `${minutes} phút`;
}

export function formatNumber(value) {
    return NUMBER_FORMAT.format(Number(value ?? 0));
}

// Utils
export function showModal(id) {
    document.getElementById(id).classList.remove('hide');
}

export function hideModal(id) {
    document.getElementById(id).classList.add('hide');
}
