/*!
 * Trình diễn Pháo hoa – builder (hằng số)
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Danh mục dùng chung: màu, loại pháo, kiểu phóng, khung bắt đầu, khung ảnh, hiệu ứng lấp lánh.

export const COLOR = {
    Red: '#ff0043',
    Green: '#14fc56',
    Blue: '#1e7fff',
    Purple: '#e60aff',
    Gold: '#ffbf36',
    White: '#ffffff'
};

// Thứ tự hiển thị trong lưới chọn loại pháo. Gồm cả các loại trình phát hỗ trợ nhưng trước đây builder thiếu
// (Con bướm, Cỏ 3 lá, Cỏ 4 lá): kịch bản dùng chúng sẽ không còn bị hiện nhầm thành "Hoa cúc".
export const SHELL_TYPES = [
    "Hoa cúc", "Liễu", "Cây cọ", "Xoay vòng", "Xoắn ốc", "Cháy lâu", "Vòng nhẫn", "Nổ chéo", "Nổ lách tách",
    "Nhấp nháy", "Đuôi ngựa", "Ma", "Nổ nhiều lần", "Trái tim", "Ngôi sao", "Kim cương", "Bông tuyết", "Bông sen",
    "Hành tinh", "Con bướm", "Cỏ 3 lá", "Cỏ 4 lá", "Mặt cười", "Mặt mèo", "Văn bản", "Hình ảnh", "Lời nhắn", "Tạm dừng"
];

export const SHELL_ICONS = {
    'Hoa cúc': '🌼', 'Liễu': '🌿', 'Cây cọ': '🌴', 'Xoay vòng': '🎡', 'Xoắn ốc': '🌀', 'Cháy lâu': '🕯️',
    'Vòng nhẫn': '⭕', 'Nổ chéo': '✖️', 'Nổ lách tách': '🎇', 'Nhấp nháy': '✨', 'Đuôi ngựa': '🐎', 'Ma': '👻',
    'Nổ nhiều lần': '💥', 'Trái tim': '❤️', 'Ngôi sao': '⭐', 'Kim cương': '💎', 'Bông tuyết': '❄️',
    'Bông sen': '🌸', 'Hành tinh': '🪐', 'Con bướm': '🦋', 'Cỏ 3 lá': '☘️', 'Cỏ 4 lá': '🍀', 'Mặt cười': '😊',
    'Mặt mèo': '🐱', 'Văn bản': '🔤', 'Hình ảnh': '🖼️', 'Lời nhắn': '💬', 'Tạm dừng': '⏸️'
};

// Hiệu ứng luôn có sẵn trong loại pháo (trình phát tự bật), hiển thị dạng đã tích và khóa trong mục Nâng cao
export const SHELL_BUILTIN_EFFECTS = {
    'Nổ lách tách': ['crackle'],
    'Nổ chéo': ['crossette'],
    'Vòng nhẫn': ['ring'],
    'Nhấp nháy': ['strobe'],
    'Đuôi ngựa': ['horsetail'],
    'Ma': ['streamers'],
    'Cháy lâu': ['hang']
};

// Kiểu bắn: cách quả pháo bay lên điểm nổ, dùng được cho mọi loại pháo.
// Giá trị khớp với LAUNCH_STYLES trong trình phát (script.js); thêm kiểu mới thì thêm ở cả hai nơi.
export const LAUNCH_STYLES = [
    { value: '', name: 'Theo loại pháo', icon: '🎆', hint: 'Bay thẳng lên; riêng pháo "Xoắn ốc" bay xoắn đôi.' },
    { value: 'straight', name: 'Bay thẳng', icon: '⬆️', hint: 'Bay thẳng một mạch lên điểm nổ.' },
    { value: 'spiral', name: 'Xoắn đôi', icon: '➰', hint: 'Hai vệt sáng uốn lượn quấn vào nhau như lò xo khi bay lên.' },
    { value: 'popping', name: 'Nổ dọc đường', icon: '🎉', hint: 'Vừa bay lên vừa nổ lụp bụp từng chùm nhỏ.' },
    { value: 'stages', name: 'Bay nhiều tầng', icon: '🚀', hint: 'Bay chậm dần, nổ một chùm rồi vọt lên tầng tiếp theo, lặp lại trước khi nổ chính. Bay lâu hơn khoảng 2 giây.' },
    { value: 'wander', name: 'Bay lượn', icon: '〰️', hint: 'Chao qua chao lại ngẫu nhiên, không theo đường thẳng.' },
    { value: 'stealth', name: 'Đạn tàng hình', icon: '👂', hint: 'Không thấy đường đạn bay lên, chỉ nghe tiếng phóng rồi pháo bất ngờ nổ giữa trời.' }
];

// Khung bắt đầu: màn hình người xem thấy trước khi màn trình diễn bắt đầu.
// Giá trị khớp với START_FRAMES trong trình phát (script.js); thêm khung mới thì thêm ở cả hai nơi.
export const START_FRAMES = [
    { value: '', name: 'Thiệp chào', icon: '💌', hint: 'Thiệp với lời mời và nút "Mở quà".' },
    { value: 'gift', name: 'Hộp quà', icon: '🎁', hint: 'Hộp quà phóng nhẹ vào giữa, vệt sáng vàng quét qua, rung rinh; chạm vào thì bung nắp, nổ tung ruy băng và pháo giấy rồi mới bắt đầu.' },
    { value: 'lixi', name: 'Bao lì xì', icon: '🧧', hint: 'Bao lì xì rơi xuống nảy nhẹ, viền vàng lóe sáng, nghiêng qua lại; chạm vào thì nắp lật lên, thiệp lộc nhô ra, xu vàng bung lên.' },
    { value: 'tree', name: 'Cây thông', icon: '🎄', hint: 'Hộp quà rơi xuống gốc thông, dây đèn sáng lần lượt, ngôi sao sáng sau cùng; chạm vào thì nắp hộp bật lên, tia sáng bay lên như sao.' },
    { value: 'cake', name: 'Bánh sinh nhật', icon: '🎂', hint: 'Bánh hai tầng, nến thắp lần lượt, bóng bay hai bên; chạm vào thì lửa nến bùng sáng, pháo giấy bung từ hai bên màn hình.' },
    { value: 'letter', name: 'Thư tình', icon: '💌', hint: 'Trái tim vẽ dần bằng ánh sáng, phong thư có dấu sáp hình tim; chạm vào thì nắp thư lật lên, lá thư nhô ra, tim tan thành cánh hoa.' },
    { value: 'invite', name: 'Thiệp cưới', icon: '💍', hint: 'Thiệp màu kem viền vàng, dấu sáp ở giữa; chạm vào thì hai cánh thiệp mở ra, đôi nhẫn sáng lên, vệt sáng champagne, cánh hoa rơi.' },
    { value: 'cap', name: 'Mũ tốt nghiệp', icon: '🎓', hint: 'Mũ tốt nghiệp rơi xuống, tua rua đung đưa, cuộn bằng bên dưới; chạm vào thì mũ tung lên, cuộn bằng mở ra, pháo giấy bung.' },
    { value: 'flower', name: 'Hoa nở', icon: '🌷', hint: 'Nụ hoa nở dần từng cánh, nhụy sáng, hoa đung đưa; chạm vào thì cánh hoa tỏa ra, nhụy sáng bừng, cánh hoa bay.' },
    { value: 'book', name: 'Sách tri ân', icon: '📖', hint: 'Cuốn sách mở bìa, nhành hoa bên cạnh; chạm vào thì thiệp tri ân nâng lên khỏi trang sách, vệt sáng vàng chạy lên.' },
    { value: 'lantern', name: 'Đèn lồng', icon: '🏮', hint: 'Trăng hiện sau mây, đèn lồng sáng dần, đung đưa; chạm vào thì đèn bừng sáng, vòng sáng lan rộng.' }
];

// Biểu tượng khung vẽ bằng SVG nét viền: emoji không có hình bo góc hay "không khung" đúng nghĩa
const frameIcon = shape => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true">${shape}</svg>`;

export const FRAME_TYPES = [
    // Phát bắn chưa chọn khung (frame trống) thực tế hiển thị không khung, nên cần một lựa chọn tương ứng
    { name: 'Không khung', value: '', icon: frameIcon('<rect x="3" y="3" width="18" height="18" stroke-dasharray="3 3"/>') },
    { name: 'Trái tim', value: 'heart', icon: frameIcon('<path d="M12 20.5 4.2 12.9A4.9 4.9 0 0 1 12 6.6a4.9 4.9 0 0 1 7.8 6.3Z"/>') },
    { name: 'Ngôi sao', value: 'star', icon: frameIcon('<path d="m12 2.5 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5-4.8-4.6 6.6-.9Z"/>') },
    { name: 'Tròn', value: 'circle', icon: frameIcon('<circle cx="12" cy="12" r="9"/>') },
    { name: 'Bo góc', value: 'rounded', icon: frameIcon('<rect x="3" y="3" width="18" height="18" rx="5.5"/>') },
    { name: 'Vuông', value: 'square', icon: frameIcon('<rect x="3" y="3" width="18" height="18"/>') },
    { name: 'Tam giác', value: 'triangle', icon: frameIcon('<path d="M12 3.5 21.5 20h-19Z"/>') }
];

export const GLITTER_TYPES = [
    { name: "Mặc định", value: "" },
    { name: "Nhẹ (Light)", value: "light" },
    { name: "Vừa (Medium)", value: "medium" },
    { name: "Dày (Heavy)", value: "heavy" },
    { name: "Đặc (Thick)", value: "thick" },
    { name: "Dải sáng (Streamer)", value: "streamer" },
    { name: "Liễu (Willow)", value: "willow" }
];

export const COLORS = [
    { name: "Ngẫu nhiên", value: "Ngẫu nhiên" },
    { name: "Đỏ (Red)", value: "Red" },
    { name: "Xanh lá (Green)", value: "Green" },
    { name: "Xanh dương (Blue)", value: "Blue" },
    { name: "Tím (Purple)", value: "Purple" },
    { name: "Vàng (Gold)", value: "Gold" },
    { name: "Trắng (White)", value: "White" },
];
