/*!
 * Hanabi – trình phát (toàn màn hình)
 * Phần bổ sung và chỉnh sửa © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Bật, tắt toàn màn hình.

import fscreen from '../../fscreen@1.0.1.js';

// Trình trợ giúp toàn màn hình, sử dụng Fscreen cho tiền tố.
export function fullscreenEnabled() {
    return fscreen.fullscreenEnabled;
}

// Lưu ý rằng trạng thái toàn màn hình được đồng bộ hóa với cửa hàng và cửa hàng phải là nguồn
// sự thật về việc ứng dụng có ở chế độ toàn màn hình hay không.
export function isFullscreen() {
    return !!fscreen.fullscreenElement;
}

// Cố gắng chuyển đổi chế độ toàn màn hình.
export function toggleFullscreen() {
    if (fullscreenEnabled()) {
        if (isFullscreen()) {
            fscreen.exitFullscreen();
        } else {
            fscreen.requestFullscreen(document.documentElement);
        }
    }
}
