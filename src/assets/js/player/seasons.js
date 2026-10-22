/*!
 * Trình diễn Pháo hoa – trình phát: mùa và thời tiết của cảnh
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Mùa của cảnh (kịch bản lưu `season`) và thời tiết (`weather`), dùng chung cho trình phát (scenery.js vẽ) và builder (ô
// chọn). Không lưu mùa: mùa hạ (cảnh như trước khi có mùa).
export const SEASONS = [
    { value: 'auto', name: 'Theo ngày xem', icon: '📅', hint: 'Mùa theo ngày người nhận mở xem: Xuân từ lập xuân (4/2), Hạ từ lập hạ (6/5), Thu từ lập thu (8/8), Đông từ lập đông (7/11).' },
    { value: 'spring', name: 'Xuân', icon: '🌸', hint: 'Cây đâm lộc non, hoa đào nở, cánh hoa bay theo gió trôi trên mặt nước, cỏ lấm tấm hoa, bướm lượn ven bờ.' },
    { value: '', name: 'Hạ', icon: '🌿', hint: 'Cây lá xanh um, sen nở trên mặt nước, đom đóm chớp tắt ven bờ.' },
    { value: 'autumn', name: 'Thu', icon: '🍂', hint: 'Lá vàng, lá đỏ; lá rụng bay theo gió, rơi xuống trôi trên mặt nước; cỏ úa, lau trắng ven bờ.' },
    { value: 'winter', name: 'Đông', icon: '❄️', hint: 'Cây trơ cành đọng tuyết, bờ phủ tuyết trắng, mặt nước đóng băng.' }
];

export const WEATHERS = [
    { value: '', name: 'Trời quang', icon: '✨', hint: 'Không mưa, không tuyết.' },
    { value: 'rain', name: 'Mưa', icon: '🌧️', hint: 'Mưa rơi xiên theo gió, hạt mưa lăn tăn gợn vòng trên mặt nước, lóe sáng khi pháo nổ.' },
    { value: 'snow', name: 'Tuyết rơi', icon: '🌨️', hint: 'Bông tuyết lả tả bay theo gió, gần to xa nhỏ, rơi xuống mặt nước thì tan.' }
];

export const validSeason = value => (SEASONS.some(season => season.value === value) ? value : '');
export const validWeather = value => (WEATHERS.some(weather => weather.value === value) ? value : '');

// Mùa theo tiết khí như cách gọi mùa ở Việt Nam: lập xuân (4/2), lập hạ (6/5), lập thu (8/8), lập đông (7/11)
export function seasonOfDate(date) {
    const day = (date.getMonth() + 1) * 100 + date.getDate();
    if (day >= 204 && day < 506) return 'spring';
    if (day >= 506 && day < 808) return 'summer';
    if (day >= 808 && day < 1107) return 'autumn';
    return 'winter';
}

// Mùa để vẽ ('spring' | 'summer' | 'autumn' | 'winter'): theo ngày xem hoặc mùa đã chọn
export const resolveSeason = (value, date = new Date()) => (value === 'auto' ? seasonOfDate(date) : validSeason(value) || 'summer');
