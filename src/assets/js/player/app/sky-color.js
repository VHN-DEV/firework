/*!
 * Trình diễn Pháo hoa – trình phát (màu trời)
 * Phần bổ sung và chỉnh sửa © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Màu trời sáng lên theo pháo đang nổ.

import { INVISIBLE } from '../env.js';
import { COLOR_TUPLES } from '../colors.js';
import { BurstFlash, Star } from '../particles.js';
import { appNodes, skyLightingSelector } from '../../script.js';

// Vẽ lớp phủ màu dựa trên độ sáng kết hợp của các ngôi sao (thắp sáng bầu trời!)
// Lưu ý: điều này được áp dụng cho màu nền của vùng chứa canvas, vì vậy nó nằm phía sau các hạt
export const currentSkyColor = { r: 0, g: 0, b: 0 };

const targetSkyColor = { r: 0, g: 0, b: 0 };

// Màu hạt tự chọn (#f00, #ff0000, rgb(...), tên màu...) quy ra { r, g, b } qua fillStyle của một canvas nhỏ (trình duyệt
// chuẩn hóa mọi kiểu ghi màu CSS), ghi nhớ theo chuỗi màu. Màu không hợp lệ thì coi như trắng: tự tách mã hex thì "#f00"
// ra kênh xanh NaN, cả bầu trời mất màu xanh tới hết buổi xem
const parsedColors = new Map();
let colorProbe = null;

function colorTuple(color) {
    let tuple = COLOR_TUPLES[color] || parsedColors.get(color);
    if (tuple) return tuple;
    if (!colorProbe) colorProbe = document.createElement('canvas').getContext('2d');
    colorProbe.fillStyle = '#ffffff';
    colorProbe.fillStyle = color;
    const value = colorProbe.fillStyle;
    const hex = value.match(/^#([0-9a-f]{6})$/i);
    const rgb = value.match(/\d+(\.\d+)?/g);
    const n = hex ? parseInt(hex[1], 16) : 0;
    tuple = hex ? { r: n >> 16, g: (n >> 8) & 255, b: n & 255 }
        : rgb && rgb.length >= 3 ? { r: +rgb[0], g: +rgb[1], b: +rgb[2] } : { r: 255, g: 255, b: 255 };
    parsedColors.set(color, tuple);
    return tuple;
}

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
        const count = Star.active[color].length;
        if (!count) return;
        const tuple = colorTuple(color);
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

    // Quả vừa nổ (quầng chớp chưa vẽ): cả bầu trời chợt lóe ánh trắng ấm rồi tối lại theo nhịp làm mượt ở trên. Nhiều quả
    // nổ cùng lúc thì sáng hơn nhưng có giới hạn. Không gọi tới đây khi giảm chớp sáng
    let flash = 0;
    for (let i = 0; i < BurstFlash.active.length; i++) flash += BurstFlash.active[i].radius;
    if (flash > 0) {
        const lift = (1 - Math.exp(-flash / 120)) * maxSkySaturation;
        const cap = maxSkySaturation * 1.6;
        currentSkyColor.r = Math.min(cap, Math.max(currentSkyColor.r, targetSkyColor.r) + lift);
        currentSkyColor.g = Math.min(cap, Math.max(currentSkyColor.g, targetSkyColor.g) + lift * 0.86);
        currentSkyColor.b = Math.min(cap, Math.max(currentSkyColor.b, targetSkyColor.b) + lift * 0.66);
    }

    appNodes.stageContainer.style.backgroundColor = `rgb(${currentSkyColor.r | 0}, ${currentSkyColor.g | 0}, ${currentSkyColor.b | 0})`;
}
