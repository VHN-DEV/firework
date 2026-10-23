/*!
 * Trình diễn Pháo hoa – trình phát: hiệu ứng nổ
 * Phần bổ sung và chỉnh sửa © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Rải hạt theo vòng cung/chùm cầu và các hiệu ứng lúc hạt tàn: nổ chéo, hoa nở, lá rơi, lách tách.

import { PI_2, PI_HALF, INVISIBLE, COLOR } from './env.js';
import { Star, BurstFlash, Spark } from './particles.js';
import { quality, isHighQuality } from './state.js';
import { soundManager } from './audio.js';

// Trình trợ giúp được sử dụng để phân tán các hạt bán ngẫu nhiên trên một vòng cung
// Các giá trị rất linh hoạt - `start` và `arcLength` có thể âm và `randomness` chỉ đơn giản là một hệ số nhân cho phép cộng ngẫu nhiên.
export function createParticleArc(start, arcLength, count, randomness, particleFactory) {
    // Số hạt âm, dưới 1 hay không phải số: góc không bao giờ tới điểm cuối, vòng lặp chạy mãi (treo trang)
    if (!(count >= 1 && count < Infinity)) return;
    const angleDelta = arcLength / count;
    // Đôi khi có thêm một phần tử ở cuối, quá gần phần đầu. Trừ một nửa gócDelta đảm bảo rằng nó bị bỏ qua.
    // Sẽ rất tốt nếu khắc phục điều này một cách tốt hơn.
    const end = start + arcLength - (angleDelta * 0.5);

    if (end > start) {
        // Tối ưu hóa: `angle=angle+angleDelta` so với góc+=angleDelta
        // V8 hủy tối ưu hóa bằng phép gán phức hợp let
        for (let angle = start; angle < end; angle = angle + angleDelta) {
            particleFactory(angle + Math.random() * angleDelta * randomness);
        }
    } else {
        for (let angle = start; angle > end; angle = angle + angleDelta) {
            particleFactory(angle + Math.random() * angleDelta * randomness);
        }
    }
}


/**
 * Helper used to create a spherical burst of particles.
 *
 * @param  {Number} count               The desired number of stars/particles. This value is a suggestion, and the
 *                                      created burst may have more particles. The current algorithm can't perfectly
 *                                      distribute a specific number of points evenly on a sphere's surface.
 * @param  {Function} particleFactory   Called once per star/particle generated. Passed two arguments:
 *                                        `angle`: The direction of the star/particle.
 *                                        `speed`: A multipler for the particle speed, from 0.0 to 1.0.
 * @param  {Number} startAngle=0        For segmented bursts, you can generate only a partial arc of particles. This
 *                                      allows setting the starting arc angle (radians).
 * @param  {Number} arcLength=TAU       The length of the arc (radians). Defaults to a full circle.
 *
 * @return {void}              Returns nothing; it's up to `particleFactory` to use the given data.
 */
export function createBurst(count, particleFactory, startAngle = 0, arcLength = PI_2) {
    // Giả sử hình cầu có diện tích bề mặt là `count`, hãy tính các
    // thuộc tính của quả cầu nói trên (đơn vị là ngôi sao).
    // Bán kính
    const R = 0.5 * Math.sqrt(count / Math.PI);
    // Đường tròn
    const C = 2 * R * Math.PI;
    // Nửa chu vi
    const C_HALF = C / 2;

    // Tạo một loạt các vòng, kích thước chúng như thể chúng cách đều nhau
    // dọc theo bề mặt cong của hình cầu.
    for (let i = 0; i <= C_HALF; i++) {
        const ringAngle = i / C_HALF * PI_HALF;
        const ringSize = Math.cos(ringAngle);
        const partsPerFullRing = C * ringSize;
        const partsPerArc = partsPerFullRing * (arcLength / PI_2);

        const angleInc = PI_2 / partsPerFullRing;
        const angleOffset = Math.random() * angleInc + startAngle;
        // Mỗi hạt cần một chút ngẫu nhiên để cải thiện hình thức.
        const maxRandomAngleOffset = angleInc * 0.33;

        for (let i = 0; i < partsPerArc; i++) {
            const randomAngleOffset = Math.random() * maxRandomAngleOffset;
            let angle = angleInc * i + angleOffset + randomAngleOffset;
            particleFactory(angle, ringSize);
        }
    }
}

// Hiệu ứng sao khác nhau.
// Chúng được thiết kế để gắn vào sự kiện `onDeath` của một ngôi sao.

// Crossette chia ngôi sao thành bốn mảnh cùng màu, phân nhánh thành hình chữ thập. Mảnh văng ra mang theo đà của hạt mẹ
// (chữ thập trôi tiếp theo hướng hạt đang bay) và đi đủ xa cho thấy rõ chữ thập
export function crossetteEffect(star) {
    const startAngle = Math.random() * PI_HALF;
    createParticleArc(startAngle, PI_2, 4, 0.5, (angle) => {
        Star.add(
            star.x,
            star.y,
            star.color,
            angle,
            Math.random() * 0.6 + 1.1,
            700,
            star.speedX,
            star.speedY
        );
    });
}

// Hoa giống như một chiếc vỏ nhỏ
export function floralEffect(star) {
    const count = 12 + 6 * quality;
    createBurst(count, (angle, speedMult) => {
        Star.add(
            star.x,
            star.y,
            star.color,
            angle,
            speedMult * 2.4,
            1000 + Math.random() * 300,
            star.speedX,
            star.speedY
        );
    });
    // Kết xuất flash hàng đợi
    BurstFlash.add(star.x, star.y, 46);
    soundManager.playSound('burstSmall');
}

// Hoa nở sao liễu
export function fallingLeavesEffect(star) {
    createBurst(7, (angle, speedMult) => {
        const newStar = Star.add(
            star.x,
            star.y,
            INVISIBLE,
            angle,
            speedMult * 2.4,
            2400 + Math.random() * 600,
            star.speedX,
            star.speedY
        );

        newStar.sparkColor = COLOR.Gold;
        newStar.sparkFreq = 144 / quality;
        newStar.sparkSpeed = 0.28;
        newStar.sparkLife = 750;
        newStar.sparkLifeVariation = 3.2;
    });
    // Kết xuất flash hàng đợi
    BurstFlash.add(star.x, star.y, 46);
    soundManager.playSound('burstSmall');
}

// Crackle biến thành một đám mây nhỏ có tia lửa vàng. Như hạt lách tách thật: mỗi hạt "tách" lóe một chớp nhỏ, vài tia
// trắng nóng tắt nhanh lẫn trong tia vàng
export function crackleEffect(star) {
    const count = isHighQuality ? 32 : 16;
    createParticleArc(0, PI_2, count, 1.8, (angle) => {
        const white = Math.random() < 0.3;
        Spark.add(
            star.x,
            star.y,
            white ? COLOR.White : COLOR.Gold,
            angle,
            // áp dụng lượng rơi gần khối để tăng tốc độ (đặt nhiều hạt hơn về phía bên ngoài)
            Math.pow(Math.random(), 0.45) * 2.4,
            white ? 150 + Math.random() * 100 : 300 + Math.random() * 200
        );
    });
    BurstFlash.add(star.x, star.y, 12);
}
