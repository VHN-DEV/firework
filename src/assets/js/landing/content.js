/*!
 * Hanabi – trang chủ: thông tin liên hệ, video giới thiệu
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Sửa ở đây rồi build lại. Kịch bản mẫu và kịch bản nổi bật trên trang chủ lấy từ src/static/configs/configs_index.json
// (mục có "featured": true là nổi bật, xem README trong thư mục đó).
export const CONTACT = {
    email: 'vuhoainam18032002@gmail.com',
    // Số điện thoại Zalo (vd '0912345678') hoặc link (vd 'https://zalo.me/0912345678'). Để trống thì ẩn nút Zalo
    zalo: '',
    // Link Messenger của trang Facebook (vd 'https://m.me/ten-trang') hoặc link trang. Để trống thì ẩn nút Messenger
    facebook: ''
};

// Video giới thiệu trên YouTube: link (youtube.com/watch?v=..., youtu.be/..., youtube.com/shorts/...) hoặc mã video.
// Có thì mục "Xem thử" thêm thẻ "Video giới thiệu" đứng đầu; để trống thì chỉ chạy thử các kịch bản nổi bật.
export const YOUTUBE = '';
