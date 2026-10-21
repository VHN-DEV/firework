/*!
 * Trình diễn Pháo hoa – trình phát: pha mặt trăng
 * Phần bổ sung và chỉnh sửa © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Pha mặt trăng theo ngày: tuổi trăng = (thời điểm - một kỳ trăng mới đã biết) chia lấy dư cho tháng giao hội.
// Sai số vài giờ (quỹ đạo Mặt Trăng không tròn đều), đủ để vẽ đúng hình trăng của đêm đó.
// Không phụ thuộc DOM: dùng được cả trong trình phát, builder và kiểm thử Node.

// Tháng giao hội trung bình (ngày)
export const SYNODIC_MONTH = 29.530588853;
// Kỳ trăng mới 06/01/2000 18:14 UTC
const REFERENCE_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);

// 8 pha: fraction là vị trí trong chu kỳ (0 trăng mới, 0,5 trăng tròn)
export const MOON_PHASES = [
    { emoji: '🌑', name: 'Trăng mới', fraction: 0 },
    { emoji: '🌒', name: 'Trăng lưỡi liềm đầu chu kỳ', fraction: 0.125 },
    { emoji: '🌓', name: 'Bán nguyệt đầu tháng', fraction: 0.25 },
    { emoji: '🌔', name: 'Trăng khuyết lớn dần', fraction: 0.375 },
    { emoji: '🌕', name: 'Trăng tròn', fraction: 0.5 },
    { emoji: '🌖', name: 'Trăng khuyết nhỏ dần', fraction: 0.625 },
    { emoji: '🌗', name: 'Bán nguyệt cuối tháng', fraction: 0.75 },
    { emoji: '🌘', name: 'Trăng lưỡi liềm cuối chu kỳ', fraction: 0.875 }
];

// Vị trí trong chu kỳ (0..1) của một thời điểm
export function moonFraction(date = new Date()) {
    const days = (date.getTime() - REFERENCE_NEW_MOON) / 86400000;
    const age = ((days % SYNODIC_MONTH) + SYNODIC_MONTH) % SYNODIC_MONTH;
    return age / SYNODIC_MONTH;
}

// Pha gần nhất trong 8 pha (0..7)
export function moonPhaseIndex(fraction) {
    return Math.round(fraction * 8) % 8;
}

// Phần đĩa trăng được chiếu sáng (0..1)
export function moonIllumination(fraction) {
    return (1 - Math.cos(fraction * Math.PI * 2)) / 2;
}
