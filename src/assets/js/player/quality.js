/*!
 * Trình diễn Pháo hoa – trình phát: các mức chất lượng khi xem
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Chất lượng khi xem theo độ phân giải như trang xem phim. Số là số điểm ảnh ở cạnh ngắn của khung vẽ pháo (cạnh dọc
// khi xem ngang): 720p vẽ 720 điểm ảnh; mức cao hơn màn hình thì vẽ bằng độ phân giải gốc của màn hình.
// tier: mức hiệu ứng cho các module hạt pháo. Từ 1080p trở lên vẽ đầy đủ; 720p bớt tia lửa lúc dày đặc nhất; 480p trở
// xuống bớt thêm và không có khói.
// sparks: số tia lửa tối đa cùng lúc (chỉ chạm tới lúc pháo dày đặc nhất).
// Dùng chung cho trình phát (Cài đặt) và builder (nhóm "Khi người nhận xem").

import { IS_MOBILE, QUALITY_LOW, QUALITY_NORMAL, QUALITY_HIGH } from './env.js';

export const QUALITY_AUTO = 'auto';

export const QUALITY_LEVELS = [
    { value: '4320', label: '4320p · 8K UHD', tier: QUALITY_HIGH, sparks: Infinity },
    { value: '2160', label: '2160p · 4K UHD', tier: QUALITY_HIGH, sparks: Infinity },
    { value: '1440', label: '1440p · 2K QHD', tier: QUALITY_HIGH, sparks: Infinity },
    { value: '1080', label: '1080p · Full HD', tier: QUALITY_HIGH, sparks: Infinity },
    { value: '720', label: '720p · HD', tier: QUALITY_NORMAL, sparks: IS_MOBILE ? 9000 : 18000 },
    { value: '480', label: '480p · SD', tier: QUALITY_LOW, sparks: IS_MOBILE ? 5000 : 9000 },
    { value: '360', label: '360p · Trung bình thấp', tier: QUALITY_LOW, sparks: IS_MOBILE ? 4000 : 7000 },
    { value: '240', label: '240p · Thấp', tier: QUALITY_LOW, sparks: IS_MOBILE ? 3000 : 5000 },
    { value: '144', label: '144p · Rất thấp', tier: QUALITY_LOW, sparks: IS_MOBILE ? 2000 : 3500 }
];

// Bản lưu của người xem và kịch bản cũ ghi Thấp / Vừa / Cao (1-3)
const LEGACY_QUALITY = { 1: '480', 2: '720', 3: '2160' };

export const qualityLevel = value => QUALITY_LEVELS.find(level => level.value === String(value));

// 'auto' hoặc một mức hợp lệ (giá trị cũ đổi sang mức tương ứng); không hợp lệ thì 'auto'
export function validQuality(value) {
    const v = LEGACY_QUALITY[value] || String(value);
    return v === QUALITY_AUTO || qualityLevel(v) ? v : QUALITY_AUTO;
}
