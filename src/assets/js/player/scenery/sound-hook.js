/*!
 * Trình diễn Pháo hoa – trình phát: cảnh vật (báo tiếng)
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Cảnh vật báo sự việc có tiếng (ếch kêu, cá quẫy, vịt kêu, cò cất cánh, bong bóng vỡ...) kèm chỗ xảy ra: u (0-1 theo
// bề ngang), d (độ xa: 0 xa - 1 gần), extra (chi tiết). Trình phát quyết định có phát hay không (player/nature/), cảnh
// vật không cần biết gì về âm thanh.

let listener = null;

export function setSceneSoundListener(fn) {
    listener = fn;
}

export function sceneSound(name, u, d, extra) {
    if (listener) listener(name, u, d, extra);
}
