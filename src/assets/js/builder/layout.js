/*!
 * Trình diễn Pháo hoa – builder (bố cục)
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Thanh bên, menu thêm.

let lastToggleTime = 0;

// Mở/đóng ngăn "Cấu hình chung" (dạng ngăn trượt trên tablet/điện thoại; trên máy tính là cột cố định)
export function toggleSidebar(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }

    // Ngăn chặn double click/tap quá nhanh gây bật-tắt tức thì
    const now = Date.now();
    if (now - lastToggleTime < 300) return;
    lastToggleTime = now;

    closeMoreMenu();
    const panel = document.getElementById('settings-panel');
    const overlay = document.getElementById('sidebar-overlay');
    const open = !panel.classList.contains('open');
    panel.classList.toggle('open', open);
    overlay.classList.toggle('show', open);
}

export function toggleMoreMenu() {
    document.getElementById('more-menu').classList.toggle('hide');
}

export function closeMoreMenu() {
    document.getElementById('more-menu')?.classList.add('hide');
}

/**
 * XEM NHANH
 * Chạy chính trình phát thật (index.html?preview=1) trong iframe, builder gửi kịch bản sang qua postMessage.
 * Nhờ vậy những gì thấy khi soạn giống hệt khi trình diễn: vật lý, hình dạng, ảnh, nền, cách xử lý riêng cho điện thoại.
 */
