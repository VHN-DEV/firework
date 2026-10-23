/*!
 * Trình diễn Pháo hoa – trình phát (giải thích cài đặt)
 * Phần bổ sung và chỉnh sửa © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Nội dung giải thích các mục cài đặt trong menu.

import { quality } from '../state.js';
import { renderResolution } from './quality-tuning.js';

// Nội dung trợ giúp
export const helpContent = {
    quality: {
        header: 'Chất lượng',
        body: 'Như trang xem phim: số càng lớn hình càng nét nhưng càng nặng máy. Tự động (khuyên dùng): bắt đầu theo màn hình và '
            + 'cấu hình máy, nếu thấy giật thì tự hạ xuống, mượt trở lại thì nâng lên. Từ 1080p trở lên vẽ đầy đủ mọi hiệu ứng; '
            + '720p bớt tia lửa lúc pháo dày đặc nhất; 480p trở xuống nhẹ nhất cho máy yếu, không có khói pháo và quầng sáng quanh pháo. Màn hình không '
            + 'hiện được nhiều điểm ảnh hơn chính nó: chọn mức cao hơn màn hình thì máy tính mạnh vẽ dư tới gấp đôi rồi thu nhỏ '
            + 'cho mịn, rõ hơn (nặng máy hơn nhiều); điện thoại, máy yếu vẽ bằng độ phân giải gốc của màn hình. '
            + 'Muốn thật sự 4K thì cần màn hình 4K.',
        // Dòng thêm cuối: độ phân giải màn hình này và độ phân giải đang vẽ
        extra: () => {
            const res = renderResolution();
            return `Màn hình này: ${res.screen} điểm ảnh. Đang vẽ: ${res.drawn}${res.extra ? ' (vẽ dư rồi thu nhỏ)' : ''}.`;
        }
    },
    skyLighting: {
        header: 'Ánh sáng bầu trời',
        body: 'Bầu trời sáng lên theo màu pháo khi pháo nổ, sáng nhất quanh chỗ nổ rồi nhạt dần ra xa. Nếu nền trông quá sáng trên màn hình của bạn, hãy chọn "Mờ" hoặc "Tắt".'
    },
    scaleFactor: {
        header: 'Thu phóng',
        body: 'Phóng to hoặc thu nhỏ toàn bộ pháo hoa, giống như đứng gần hay xa hơn. Trên điện thoại, thu nhỏ một chút giúp những quả pháo lớn không tràn khỏi màn hình.'
    },
    natureSound: {
        header: 'Âm thanh thiên nhiên',
        body: 'Tiếng của khung cảnh: nước chảy, sóng vỗ bờ, gió lùa qua lá, dế kêu, ếch kêu, vịt, cò, cá quẫy nước, mưa rơi. '
            + 'Chỉ có tiếng của những thứ đang có trong cảnh, nhỏ hơn tiếng pháo. Tắt nếu chỉ muốn nghe pháo và nhạc. Nút loa '
            + 'tắt hết mọi âm thanh.'
    },
    fullscreen: {
        header: 'Toàn màn hình',
        body: 'Bật/tắt chế độ toàn màn hình.'
    },
    reduceFlashing: {
        header: 'Giảm chớp sáng',
        body: 'Dành cho người nhạy cảm với ánh sáng nhấp nháy: hạt pháo không chớp tắt hay lấp lánh, không có quầng chớp lúc nổ, bầu trời không đổi màu theo pháo. Pháo hoa vẫn nổ đầy đủ.'
    },
    hideControls: {
        header: 'Ẩn nút điều khiển',
        body: 'Ẩn các nút tạm dừng, âm thanh và cài đặt ở phía trên màn hình để xem trọn vẹn. Trên máy tính, đưa chuột lên mép trên là các nút hiện lại; trên điện thoại, chạm vào góc trên bên phải để mở lại bảng này.'
    }
};
