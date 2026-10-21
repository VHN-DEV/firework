/*!
 * Trình diễn Pháo hoa – trình phát: trạng thái dùng chung
 * Phần bổ sung và chỉnh sửa © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Trạng thái các module của trình phát cùng đọc: cỡ sân khấu, chất lượng đồ họa, tốc độ mô phỏng.
// Biến import chỉ đọc được, nên trình phát đổi chúng qua các hàm set... bên dưới.

import { QUALITY_LOW, QUALITY_NORMAL, QUALITY_HIGH } from './env.js';

// Các giá trị chiều rộng/chiều cao có tính đến tỷ lệ. SỬ DỤNG NHỮNG ĐIỀU NÀY ĐỂ VẼ VỊ TRÍ
export let stageW;
export let stageH;

export function setStageSize(width, height) {
    stageW = width;
    stageH = height;
}

// Chất lượng đồ họa, cập nhật thông qua `configDidUpdate` của trình phát
export let quality = 1;
export let isLowQuality = false;
let isNormalQuality = true;
export let isHighQuality = false;

export function setQuality(value) {
    quality = value;
    isLowQuality = quality === QUALITY_LOW;
    isNormalQuality = quality === QUALITY_NORMAL;
    isHighQuality = quality === QUALITY_HIGH;
}

// Tốc độ mô phỏng (thanh tốc độ ở đáy màn hình), 1 là bình thường
export let simSpeed = 1;

export function setSimSpeed(value) {
    simSpeed = value;
}


// Người xem có đang cho phát tiếng không (bật âm thanh, không tạm dừng, không mở menu). Trình phát cắm hàm thật vào lúc khởi động.
export let canPlaySound = () => true;

export function setCanPlaySound(check) {
    canPlaySound = check;
}

// Đang giảm chớp sáng không (người xem tự bật, hoặc kịch bản bật sẵn). Trình phát cắm hàm thật vào lúc khởi động.
export let reduceFlashing = () => false;

export function setReduceFlashing(check) {
    reduceFlashing = check;
}

// Cài đặt của người xem trong menu (cỡ pháo, chữ tùy chỉnh...). Trình phát cắm hàm đọc cài đặt vào lúc khởi động.
export let settings = () => ({});

export function setSettings(read) {
    settings = read;
}

// Màn trình diễn đang chạy (không tạm dừng, không mở menu). Trình phát cắm hàm thật vào lúc khởi động.
export let isRunning = () => true;

export function setIsRunning(check) {
    isRunning = check;
}
