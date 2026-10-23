/*!
 * Hanabi – trình phát (màu trời)
 * Phần bổ sung và chỉnh sửa © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Màu trời sáng lên theo pháo đang nổ: một phần sáng đều cả trời (ánh sáng tán trong không khí, màu nền khung), phần còn
// lại là vầng sáng quanh chỗ nổ (sky-light.js). currentSkyColor: độ sáng chung của cả trời, cho khói, người ngắm pháo,
// mưa tuyết.

import { INVISIBLE, QUALITY_HIGH } from '../env.js';
import { isLowQuality, quality } from '../state.js';
import { COLOR_TUPLES } from '../colors.js';
import { BurstFlash, Spark, Star } from '../particles.js';
import { SkyLight } from '../sky-light.js';
import { appNodes, skyCanvas, skyLightingSelector } from '../../script.js';

// Phần sáng đều cả trời, so với độ sáng chung
const AMBIENT = 0.4;
// Một tia lửa sáng chừng ấy phần một hạt pháo (kim tuyến, tia lửa nhỏ, mờ hơn hạt pháo nhiều nhưng rất đông: pháo "Lá
// rơi" toàn kim tuyến vàng cũng làm trời ửng vàng). Chất lượng thấp giãn tia lửa thưa hơn nên mỗi tia tính sáng hơn
const SPARK_LIGHT = 0.025;
// Hạt pháo đang tàn, tia lửa đang nguội sáng yếu dần (theo các mức tàn trong render-loop.js)
const STAR_FADE_LIGHT = [1, 0.75, 0.5, 0.28];
const SPARK_FADE_LIGHT = [1, 0.75, 0.45];
const ambient = { r: 0, g: 0, b: 0 };
const flashes = [];

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

// speed: số khung 60Hz đã trôi; width, height: cỡ sân khấu; horizon: mép nước (0-1, 1: không có mặt nước)
export function colorSky(speed, width, height, horizon) {
    // Hạt pháo, tia lửa dưới mép nước (đã bị bờ che) không rọi sáng trời
    const waterline = height * horizon;
    SkyLight.begin(width, height, horizon);
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
    // Mỗi hạt đang sáng (không nhấp nháy tắt) cũng là một nguồn sáng tại chỗ của nó
    Object.keys(Star.active).forEach(color => {
        if (color === INVISIBLE || color === '_pool') return;
        const stars = Star.active[color];
        const count = stars.length;
        if (!count) return;
        const tuple = colorTuple(color);
        totalStarCount += count;
        targetSkyColor.r += tuple.r * count;
        targetSkyColor.g += tuple.g * count;
        targetSkyColor.b += tuple.b * count;
        for (let i = 0; i < count; i++) {
            const star = stars[i];
            if (star.visible && star.y <= waterline) SkyLight.add(star.x, star.y, tuple.r, tuple.g, tuple.b, STAR_FADE_LIGHT[star.fade] ?? 1);
        }
    });
    // Tia lửa, kim tuyến
    const sparkLight = SPARK_LIGHT * QUALITY_HIGH / quality;
    Object.keys(Spark.active).forEach(color => {
        if (color === INVISIBLE || color === '_pool') return;
        const sparks = Spark.active[color];
        if (!sparks.length) return;
        const tuple = colorTuple(color);
        let sum = 0;
        for (let i = 0; i < sparks.length; i++) {
            const spark = sparks[i];
            const w = sparkLight * (SPARK_FADE_LIGHT[spark.fade] ?? 1);
            sum += w;
            if (spark.y <= waterline) SkyLight.add(spark.x, spark.y, tuple.r, tuple.g, tuple.b, w);
        }
        totalStarCount += sum;
        targetSkyColor.r += tuple.r * sum;
        targetSkyColor.g += tuple.g * sum;
        targetSkyColor.b += tuple.b * sum;
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
    // nổ cùng lúc thì sáng hơn nhưng có giới hạn. Chớp nhỏ (hạt nổ lách tách, hoa con) tính theo diện tích: vài chục chớp li
    // ti cùng khung không làm cả trời lóe như một quả nổ lớn. Không gọi tới đây khi giảm chớp sáng
    let flash = 0;
    flashes.length = 0;
    BurstFlash.active.forEach(bf => {
        if (!Number.isFinite(bf.x) || !Number.isFinite(bf.y) || !(bf.radius > 0)) return;
        const r = bf.radius * Math.min(1, bf.radius / 60);
        flash += r;
        // Chớp lóe sáng nhất quanh chỗ nổ (sky-light.js)
        flashes.push({ x: bf.x, y: bf.y, lift: (1 - Math.exp(-r / 120)) * maxSkySaturation });
    });
    if (flash > 0) {
        const lift = (1 - Math.exp(-flash / 120)) * maxSkySaturation;
        const cap = maxSkySaturation * 1.6;
        currentSkyColor.r = Math.min(cap, Math.max(currentSkyColor.r, targetSkyColor.r) + lift);
        currentSkyColor.g = Math.min(cap, Math.max(currentSkyColor.g, targetSkyColor.g) + lift * 0.86);
        currentSkyColor.b = Math.min(cap, Math.max(currentSkyColor.b, targetSkyColor.b) + lift * 0.66);
    }

    // Phần sáng đều cả trời làm màu nền khung; vầng sáng quanh chỗ nổ vẽ lên canvas trời (nằm trên nền, ghép "lighten")
    ambient.r = currentSkyColor.r * AMBIENT;
    ambient.g = currentSkyColor.g * AMBIENT;
    ambient.b = currentSkyColor.b * AMBIENT;
    appNodes.stageContainer.style.backgroundColor = `rgb(${ambient.r | 0}, ${ambient.g | 0}, ${ambient.b | 0})`;
    SkyLight.finish(speed, maxSkySaturation, flashes, ambient, skyCanvas, isLowQuality);
}

// Trời thôi sáng theo pháo (tắt "Ánh sáng bầu trời", giảm chớp sáng): xóa cả vầng sáng
export function clearSkyLight() {
    SkyLight.clear(skyCanvas);
}
