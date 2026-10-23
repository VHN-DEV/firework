/*!
 * Hanabi – trình phát (chọn pháo)
 * Phần bổ sung và chỉnh sửa © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Chọn loại pháo ngẫu nhiên hoặc theo cài đặt, pháo nhanh cho chuỗi bắn dày.

import { IS_HEADER } from '../env.js';
import { shellNames, shellTypes } from '../shells.js';
import { shellNameSelector } from '../../script.js';

function randomShellName() {
    return Math.random() < 0.5 ? 'Hoa cúc' : shellNames[(Math.random() * (shellNames.length - 1) + 1) | 0];
}

export function randomShell(size) {
    // Lựa chọn đặc biệt cho tiêu đề.
    if (IS_HEADER) return randomFastShell()(size);
    // Hoạt động bình thường
    return shellTypes[randomShellName()](size);
}

export function shellFromConfig(size) {
    return shellTypes[shellNameSelector()](size);
}

// Nhận một shell ngẫu nhiên, không bao gồm việc xử lý các biến thể chuyên sâu
// Lưu ý rằng điều này chỉ ngẫu nhiên khi shell "Ngẫu nhiên" được chọn trong config.
// Ngoài ra, điều này không tạo ra shell, chỉ trả về hàm xuất xưởng.
const fastShellBlacklist = ['Lá rơi', 'Hoa', 'Liễu', 'Cháy lâu'];

export function randomFastShell() {
    const isRandom = shellNameSelector() === 'Ngẫu nhiên';
    let shellName = isRandom ? randomShellName() : shellNameSelector();
    if (isRandom) {
        while (fastShellBlacklist.includes(shellName)) {
            shellName = randomShellName();
        }
    }
    return shellTypes[shellName];
}
