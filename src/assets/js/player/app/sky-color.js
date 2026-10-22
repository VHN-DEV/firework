/*!
 * Trình diễn Pháo hoa – trình phát (màu trời)
 * Phần bổ sung và chỉnh sửa © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Màu trời sáng lên theo pháo đang nổ.

import { INVISIBLE } from '../env.js';
import { COLOR_TUPLES } from '../colors.js';
import { Star } from '../particles.js';
import { appNodes, skyLightingSelector } from '../../script.js';

// Vẽ lớp phủ màu dựa trên độ sáng kết hợp của các ngôi sao (thắp sáng bầu trời!)
// Lưu ý: điều này được áp dụng cho màu nền của vùng chứa canvas, vì vậy nó nằm phía sau các hạt
export const currentSkyColor = { r: 0, g: 0, b: 0 };

const targetSkyColor = { r: 0, g: 0, b: 0 };

export function colorSky(speed) {
    // Giá trị r, g hoặc b tối đa sẽ được sử dụng (255 sẽ không biểu thị mức tối đa)
    const maxSkySaturation = skyLightingSelector() * 15;
    // Tổng cộng cần bao nhiêu ngôi sao để đạt được độ sáng bầu trời tối đa
    const maxStarCount = 500;
    let totalStarCount = 0;
    // Khởi tạo bầu trời có màu đen
    targetSkyColor.r = 0;
    targetSkyColor.g = 0;
    targetSkyColor.b = 0;
    // Thêm từng màu đã biết vào bầu trời, nhân với số lượng hạt của màu đó. Điều này sẽ khiến các giá trị RGB vượt quá giới hạn nhưng chúng tôi sẽ điều chỉnh lại chúng sau.
    // Đồng thời cộng tổng số sao.
    Object.keys(Star.active).forEach(color => {
        if (color === INVISIBLE || color === '_pool') return;
        let tuple = COLOR_TUPLES[color];
        if (!tuple) {
            // Phân tích màu rgb/hex nếu không có trong COLOR_TUPLES
            if (color.startsWith('rgb')) {
                const match = color.match(/\d+/g);
                if (match) tuple = { r: parseInt(match[0]), g: parseInt(match[1]), b: parseInt(match[2]) };
            } else if (color.startsWith('#')) {
                const hex = color.substring(1);
                tuple = {
                    r: parseInt(hex.substring(0, 2), 16),
                    g: parseInt(hex.substring(2, 4), 16),
                    b: parseInt(hex.substring(4, 6), 16)
                };
            }
        }
        if (!tuple) tuple = { r: 255, g: 255, b: 255 };

        const count = Star.active[color].length;
        totalStarCount += count;
        targetSkyColor.r += tuple.r * count;
        targetSkyColor.g += tuple.g * count;
        targetSkyColor.b += tuple.b * count;
    });

    // Cường độ kẹp ở mức 1,0 và ánh xạ tới đường cong phi tuyến tính tùy chỉnh. Điều này cho phép một số ngôi sao sáng lên bầu trời một cách rõ ràng, trong khi nhiều ngôi sao hơn tiếp tục tăng độ sáng nhưng với tốc độ thấp hơn. Điều này phù hợp hơn với nhận thức độ sáng phi tuyến tính của con người.
    const intensity = Math.pow(Math.min(1, totalStarCount / maxStarCount), 0.3);
    // Tìm ra thành phần màu nào có giá trị cao nhất để chúng ta có thể chia tỷ lệ chúng mà không ảnh hưởng đến tỷ lệ.
    // Ngăn chặn việc sử dụng 0 để chúng ta không chia cho 0 ở bước tiếp theo.
    const maxColorComponent = Math.max(1, targetSkyColor.r, targetSkyColor.g, targetSkyColor.b);
    // Chia tỷ lệ tất cả các thành phần màu lên mức tối đa `maxSkySaturation` và áp dụng cường độ.
    targetSkyColor.r = targetSkyColor.r / maxColorComponent * maxSkySaturation * intensity;
    targetSkyColor.g = targetSkyColor.g / maxColorComponent * maxSkySaturation * intensity;
    targetSkyColor.b = targetSkyColor.b / maxColorComponent * maxSkySaturation * intensity;

    // Tạo hiệu ứng thay đổi màu sắc để làm mượt các chuyển tiếp.
    const colorChange = 10;
    currentSkyColor.r += (targetSkyColor.r - currentSkyColor.r) / colorChange * speed;
    currentSkyColor.g += (targetSkyColor.g - currentSkyColor.g) / colorChange * speed;
    currentSkyColor.b += (targetSkyColor.b - currentSkyColor.b) / colorChange * speed;

    appNodes.stageContainer.style.backgroundColor = `rgb(${currentSkyColor.r | 0}, ${currentSkyColor.g | 0}, ${currentSkyColor.b | 0})`;
}
