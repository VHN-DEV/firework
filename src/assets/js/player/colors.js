/*!
 * Trình diễn Pháo hoa – trình phát: màu sắc
 * Phần bổ sung và chỉnh sửa © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Bảng màu pháo, chọn màu ngẫu nhiên, đổi tên màu trong kịch bản ("Gold", "Ngẫu nhiên"...) ra mã màu.

import { COLOR, INVISIBLE } from './env.js';

// Đạo hàm hằng số
const COLOR_NAMES = Object.keys(COLOR);
const COLOR_CODES = COLOR_NAMES.map(colorName => COLOR[colorName]);
// Những ngôi sao vô hình cần một bộ nhận dạng, ngay cả khi chúng không được hiển thị - vật lý vẫn được áp dụng.
export const COLOR_CODES_W_INVIS = [...COLOR_CODES, INVISIBLE];
// Ánh xạ mã màu tới chỉ mục của chúng trong mảng. Hữu ích để xác định nhanh xem màu đã được cập nhật trong vòng lặp hay chưa.
const COLOR_CODE_INDEXES = COLOR_CODES_W_INVIS.reduce((obj, code, i) => {
    obj[code] = i;
    return obj;
}, {});
// Bộ dữ liệu là một khóa ánh xạ theo mã màu (hex) với các giá trị của bộ dữ liệu { r, g, b } (vẫn chỉ là đối tượng).
export const COLOR_TUPLES = {};
COLOR_CODES.forEach(hex => {
    COLOR_TUPLES[hex] = {
        r: parseInt(hex.substr(1, 2), 16),
        g: parseInt(hex.substr(3, 2), 16),
        b: parseInt(hex.substr(5, 2), 16),
    };
});

// Nhận một màu ngẫu nhiên.
function randomColorSimple() {
    return COLOR_CODES[Math.random() * COLOR_CODES.length | 0];
}

// Nhận màu ngẫu nhiên, với một số tùy chọn tùy chỉnh có sẵn.
let lastColor;
export function randomColor(options) {
    const notSame = options && options.notSame;
    const notColor = options && options.notColor;
    const limitWhite = options && options.limitWhite;
    let color = randomColorSimple();

    // giới hạn số lượng màu trắng được chọn ngẫu nhiên
    if (limitWhite && color === COLOR.White && Math.random() < 0.6) {
        color = randomColorSimple();
    }

    if (notSame) {
        while (color === lastColor) {
            color = randomColorSimple();
        }
    }
    else if (notColor) {
        while (color === notColor) {
            color = randomColorSimple();
        }
    }

    lastColor = color;
    return color;
}

export function whiteOrGold() {
    return Math.random() < 0.5 ? COLOR.Gold : COLOR.White;
}

// Đổi màu trong kịch bản (tên như "Red", mã hex, "Ngẫu nhiên" hoặc mảng màu) sang dạng bộ vẽ hiểu được.
// "Ngẫu nhiên" ở cấp ngoài cùng thành 'random' (mỗi hạt một màu).
export function resolveEventColor(color) {
    if (Array.isArray(color)) return color.map(c => resolveSingleColor(c));
    if (color === 'Ngẫu nhiên' || color === 'random') return 'random';
    return COLOR[color] || color;
}

// Màu đơn (màu chuyển, nhụy, nhấp nháy, phần tử trong mảng màu): "Ngẫu nhiên" được chọn sẵn một màu cụ thể.
export function resolveSingleColor(color) {
    if (color === 'Ngẫu nhiên' || color === 'random') return randomColor();
    return COLOR[color] || color;
}


// Người trợ giúp vỏ
export function makePistilColor(shellColor) {
    return (shellColor === COLOR.White || shellColor === COLOR.Gold) ? randomColor({ notColor: shellColor }) : whiteOrGold();
}
