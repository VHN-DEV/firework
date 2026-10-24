/*!
 * Hanabi – trình phát: kiểu bờ bên kia mặt nước
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Kiểu bờ bên kia mặt nước (kịch bản lưu `bank`), dùng chung cho trình phát (scenery.js vẽ) và builder (ô chọn).
// Thêm kiểu mới: thêm một mục ở đây, cách vẽ thân bờ trong BANK_BODIES và phần nhô lên trời trong BANK_SKYLINES
// (scenery.js).
export const BANK_STYLES = [
    { value: '', name: 'Bờ đất', icon: '🌾', hint: 'Bờ đất phủ cỏ, lau sậy đung đưa theo gió, đom đóm chớp tắt.' },
    { value: 'brick', name: 'Kè gạch', icon: '🧱', hint: 'Kè gạch có lan can sắt, cột đèn cổ sáng ấm, hàng cây xanh: bờ sông thành phố.' },
    { value: 'stone', name: 'Kè đá, liễu', icon: '🪨', hint: 'Kè đá phủ rêu, hàng liễu rủ đung đưa như bên hồ Gươm.' },
    { value: 'sand', name: 'Bãi cát', icon: '🏝️', hint: 'Bãi cát, hàng dừa lắc lư theo gió, sóng vỗ bọt trắng dọc bờ.' },
    { value: 'oldtown', name: 'Phố cổ', icon: '🏮', hint: 'Dãy nhà phố cổ mái ngói, cửa sổ sáng đèn, đèn lồng nhiều màu đung đưa.' },
    { value: 'bridge', name: 'Cầu nhiều vòm', icon: '🌉', hint: 'Cây cầu đá cổ nhiều vòm bắc qua sông, vòm giữa cao nhất, trụ cầu đứng dưới nước, đèn trên cầu; mỗi vòm cùng bóng dưới nước khép thành vòng tròn.' },
    { value: 'arch', name: 'Cầu vòm cong', icon: '🌙', hint: 'Một cây cầu đá vòm cong ở giữa, lan can trụ đá, liễu rủ bên cầu; vòm cầu và bóng dưới nước khép thành vòng tròn.' },
    { value: 'city', name: 'Thành phố', icon: '🏙️', hint: 'Thành phố về đêm bên sông như Sài Gòn: tháp cao mặt kính sáng đèn, đỉnh tháp rực vàng, mặt kính đèn LED đổi màu, đèn đỏ nóc nhà cao tầng nhấp nháy, dãy nhà ven sông sáng vàng, thuyền neo giăng đèn sát bờ.' },
    { value: 'none', name: 'Biển khơi', icon: '🌊', hint: 'Không có bờ: mặt nước trải tới tận chân trời như ngoài biển.' }
];

// Kịch bản cũ chọn cầu sắt (đã bỏ) thì thành kiểu thành phố
const ALIASES = { steel: 'city' };

export const validBankStyle = value => {
    const v = ALIASES[value] || value;
    return BANK_STYLES.some(style => style.value === v) ? v : '';
};
