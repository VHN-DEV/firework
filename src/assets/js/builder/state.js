/*!
 * Trình diễn Pháo hoa – builder (trạng thái)
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Kịch bản đang soạn (state) và môi trường chạy.

import { resolveScreenTheme } from '../player/screen-themes.js';
import { NATURE_VOLUME } from '../player/nature/scene.js';

export const state = {
    events: [],
    nextId: 1,
    currentFilename: '',
    activeEventId: null,
    miniPreviewEnabled: false,
    showBackground: false,
    // Khói pháo: '' tắt, 'light' nhẹ, 'heavy' dày
    smoke: '',
    // Cảnh vật: mặt nước ('' không, 'third' 1/3, 'half' nửa màn hình), trang trí ('lanterns', 'balloons', 'both')
    water: '',
    // Kiểu mặt nước ('lake' hồ tĩnh lặng, 'river' sông chảy), vật trôi ('' / 'lanterns' hoa đăng / 'petals' cánh hoa)
    waterStyle: 'lake',
    // Kiểu bờ bên kia mặt nước ('' = bờ đất), xem player/bank-styles.js
    bank: '',
    // Người ngắm pháo đứng ở bờ bên này ('' không, 'man', 'woman', 'couple'), xem player/people-options.js
    people: '',
    // Có bờ bên này (tắt: người ngắm pháo đứng ở bờ bên kia, bờ có cầu thì đi lên giữa cầu)
    nearBank: true,
    // Mùa ('' hạ, 'auto' theo ngày xem, 'spring', 'autumn', 'winter') và thời tiết ('' / 'rain' / 'snow'), xem player/seasons.js
    season: '',
    weather: '',
    floating: '',
    // Chim, cá, khúc gỗ trên mặt nước
    // Trên mặt nước, bật/tắt riêng từng thứ: cò, vịt trời, cá, khúc gỗ trôi, lá bèo, đá và gò đất giữa dòng, thuyền
    waterBirds: true,
    waterDucks: true,
    waterFish: true,
    waterLogs: true,
    waterFrogs: true,
    waterPlants: true,
    waterRocks: true,
    waterBoats: true,
    // Cách xem đặt sẵn: quality ('1'-'3'), skyLighting ('0', '1'), scaleFactor, hideControls (false), fullscreen (true)
    viewer: {},
    // Người xem chạm vào trời thì bắn pháo (tắt: chỉ xem)
    tapToLaunch: true,
    // Người nhận chụp khoảnh khắc, tạo video, chia sẻ link (tắt: quà riêng tư)
    receiverShare: true,
    // Bầu trời đêm: trang trí (danh sách), sao ('' / 'few' / 'many'), Dải Ngân Hà ('' / 'faint' / 'bright'), sao băng
    // ('' / 'few' / 'shower'), trăng ({ phase: 'auto' | 0-7, x, y } hoặc null)
    decor: [],
    stars: '',
    milkyWay: '',
    meteors: '',
    // Mây trôi trên trời ('' / 'few' / 'many')
    clouds: '',
    moon: null,
    background: null,
    // Nhạc nền { url, name, volume (0-1), start (giây) } và âm lượng tiếng pháo (0-1)
    music: null,
    effectsVolume: 1,
    // Âm thanh thiên nhiên của cảnh: bật/tắt, âm lượng (0-1), các nhóm tiếng tắt (xem player/nature/scene.js)
    natureSound: true,
    natureVolume: NATURE_VOLUME,
    natureOff: [],
    // Khung bắt đầu ('' = thiệp chào), xem START_FRAMES
    startFrame: '',
    // Giao diện màn mở quà & màn kết (đầy đủ, xem screen-themes.js); lưu vào kịch bản phần khác bộ đã chọn
    screenTheme: resolveScreenTheme(),
    // Hẹn giờ mở quà: thời điểm ISO ('' = không hẹn) và cách mở khi tới giờ ('lock' | 'countdown')
    openAt: '',
    openMode: 'lock',
    // Báo cho người gửi khi người nhận mở quà (cần máy chủ PHP)
    notifyOpen: true,
    // Giảm chớp sáng cho cả màn trình diễn
    reduceFlashing: false,
    // Ảnh khi chia sẻ: 'auto' = thiệp pháo hoa tự vẽ, 'custom' = ảnh người dùng chọn
    seo: { mode: 'auto', image: null, imageText: true, imagePosition: 50, axis: 'y' }
};

export const isStaticEnv = window.location.hostname.includes('github.io') ||
    window.location.hostname.includes('vercel.app') ||
    window.location.hostname.includes('netlify.app') ||
    window.location.protocol === 'file:';
