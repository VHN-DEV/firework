/*!
 * Trình diễn Pháo hoa – trình phát: môi trường và hằng số
 * Phần bổ sung và chỉnh sửa © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Môi trường chạy (máy tính/điện thoại, xem nhanh, quay video), hằng số vật lý, chất lượng, ánh sáng bầu trời, màu gốc.
// Không phụ thuộc module nào khác của trình phát.

export const IS_MOBILE = window.innerWidth <= 640;
export const IS_DESKTOP = window.innerWidth > 800;
export const IS_HEADER = IS_DESKTOP && window.innerHeight < 300;

// Chế độ xem nhanh nhúng trong builder (index.html?preview=1): kịch bản được builder gửi sang qua postMessage
export const IS_PREVIEW = new URLSearchParams(window.location.search).has('preview');

// Quay video (index.html?record=1&scale=..., builder > Xuất video): khung có cỡ như màn hình thật, canvas vẽ phóng lên
// `scale` lần để ra đúng độ phân giải video (Stage đọc devicePixelRatio khi tạo canvas)
export const IS_RECORD = !IS_PREVIEW && new URLSearchParams(window.location.search).has('record');

if (IS_RECORD) {
    const scale = Number(new URLSearchParams(window.location.search).get('scale'));
    if (scale > 0) Object.defineProperty(window, 'devicePixelRatio', { value: scale, configurable: true });
}

// Phát hiện các thiết bị cao cấp. Đây sẽ là một mục tiêu di động.
export const IS_HIGH_END_DEVICE = (() => {
    const hwConcurrency = navigator.hardwareConcurrency;
    if (!hwConcurrency) {
        return false;
    }
    // Màn hình lớn cho thấy máy tính có kích thước đầy đủ, ngày nay thường có siêu phân luồng.
    // Vì vậy, một máy tính để bàn lõi tứ có 8 lõi. Chúng tôi sẽ đặt ngưỡng tối thiểu cao hơn ở đó.
    // Máy tính bảng (chạm là chính, vd iPad xoay ngang rộng hơn 1024px) giữ ngưỡng như điện thoại: Safari chỉ báo 4 lõi cho
    // máy dưới 8 lõi, ngưỡng 8 xếp iPad vào máy yếu, vẽ pháo 720p rồi kéo giãn (nhòe)
    const tablet = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    const minCount = window.innerWidth <= 1024 || tablet ? 4 : 8;
    return hwConcurrency >= minCount;
})();

// Ngăn không cho canvas trở nên quá lớn trên các kích thước màn hình lố bịch.
// 8K - có thể hạn chế điều này nếu cần
export const MAX_WIDTH = 7680;
export const MAX_HEIGHT = 4320;
export const GRAVITY = 0.9; // Gia tốc tính bằng px/s

export function getDefaultScaleFactor() {
    const isMobile = window.innerWidth <= 640;
    if (isMobile) {
        // Tỷ lệ động dựa trên chiều rộng màn hình (chuẩn hóa quanh 450px) để tránh tràn viền trên mobile.
        // Làm tròn 2 chữ số để khớp với giá trị trong ô chọn "Tỉ lệ".
        return Math.round(Math.min(0.9, window.innerWidth / 450) * 100) / 100;
    }
    if (IS_HEADER) return 0.75;
    return 1;
}

export const QUALITY_LOW = 1;
export const QUALITY_NORMAL = 2;
export const QUALITY_HIGH = 3;

export const SKY_LIGHT_NONE = 0;
export const SKY_LIGHT_DIM = 1;
export const SKY_LIGHT_NORMAL = 2;

export const COLOR = {
    Red: '#ff0043',
    Green: '#14fc56',
    Blue: '#1e7fff',
    Purple: '#e60aff',
    Gold: '#ffbf36',
    White: '#ffffff'
};

// Màu vô hình đặc biệt (không được hiển thị và do đó không có trong bản đồ MÀU)
export const INVISIBLE = '_INVISIBLE_';
export const PI_2 = Math.PI * 2;
export const PI_HALF = Math.PI * 0.5;

// Tải kịch bản ngay khi mở trang (không đợi bấm nút): kịp cá nhân hóa màn mở quà
// và chỉ tải những âm thanh kịch bản thật sự dùng.
export const CONFIG_NAME = (() => {
    const name = new URLSearchParams(window.location.search).get('config');
    return name && name !== 'undefined' ? name : null;
})();
