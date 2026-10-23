/*!
 * Hanabi – trình phát: kiểu bắn
 * Phần bổ sung và chỉnh sửa © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Kiểu bắn: cách pháo bay lên trước khi nổ (thẳng, xoắn đôi, nổ dọc đường, nhiều tầng, bay lượn, tàng hình).
// Thêm kiểu mới: thêm một mục vào LAUNCH_STYLES và một dòng trong LAUNCH_STYLES của builder.

import MyMath from '../MyMath.js';
import { INVISIBLE, COLOR, IS_MOBILE, PI_2 } from './env.js';
import { randomColor } from './colors.js';
import { createBurst } from './effects.js';
import { Star, BurstFlash } from './particles.js';
import { quality } from './state.js';
import { soundManager } from './audio.js';

// ---------------------------------------------------------------------------
// KIỂU BẮN: cách quả pháo bay từ mặt đất lên điểm nổ, độc lập với loại pháo (cách nổ).
// Mỗi kiểu có hàm setup(shell, comet, launch) chạy lúc phóng: gắn thêm hành vi cho sao chổi
// (comet.onUpdate chạy mỗi khung hình) và có thể trả về { beforeBurst(comet) } chạy ngay trước khi nổ.
// `launch`: { x, y } điểm phóng, { burstX, burstY } điểm nổ, { angle, velocity } hướng và vận tốc phóng.
// Thêm kiểu mới: thêm một mục vào LAUNCH_STYLES ở đây và vào danh sách LAUNCH_STYLES của builder.
// ---------------------------------------------------------------------------

// Lệch sao ngang một đoạn `offset` so với đường bay vật lý (đường bay gốc không đổi nên vẫn tới đúng điểm nổ)
function setLateralOffset(star, offset) {
    star.x += offset - star.lateralOffset;
    star.lateralOffset = offset;
}

// Màu cho các chùm nổ phụ trên đường bay: theo màu của quả pháo
function launchPopColor(shell) {
    const color = Array.isArray(shell.color) ? shell.color[(Math.random() * shell.color.length) | 0] : shell.color;
    return !color || color === 'random' || color === INVISIBLE ? randomColor() : color;
}

// Chùm nổ nhỏ trên đường bay
function launchPop(x, y, color, count, speed, life, sound) {
    createBurst(count, (angle, speedMult) => {
        const star = Star.add(x, y, color, angle, speedMult * speed, life + Math.random() * life * 0.3);
        star.sparkFreq = 120 / quality;
        star.sparkSpeed = 0.3;
        star.sparkLife = 320;
        star.sparkLifeVariation = 1.5;
        star.sparkColor = COLOR.Gold;
        star.sparkTimer = Math.random() * star.sparkFreq;
    });
    BurstFlash.add(x, y, 18 + count * 2);
    if (sound) soundManager.playSound(sound);
}

// Đặt lại vận tốc để sao bay từ vị trí hiện tại tới (toX, toY) rồi chậm dần ở đó (cùng công thức với lúc phóng)
function aimStar(star, toX, toY) {
    const dx = toX - star.x;
    const dy = toY - star.y;
    const velocity = Math.pow(Math.hypot(dx, dy) * 0.04, 0.64);
    const angle = Math.atan2(dy, dx);
    star.speedX = Math.cos(angle) * velocity;
    star.speedY = Math.sin(angle) * velocity;
}

export const LAUNCH_STYLES = {
    // Bay thẳng lên điểm nổ
    straight: {},

    // Xoắn đôi: sao chổi và một vệt sáng phụ cùng đường bay, lệch pha nửa vòng nên quấn vào nhau như lò xo
    spiral: {
        setup(shell, comet, launch) {
            const amp = (IS_MOBILE ? 9 : 13) + Math.min(shell.shellSize || 1, 4) * 2;
            const twist = (startPhase) => {
                let phase = startPhase;
                return (star, timeStep, speed) => {
                    phase += 0.17 * speed;
                    setLateralOffset(star, Math.sin(phase) * amp);
                };
            };
            const strandColor = typeof shell.glitterColor === 'string' && shell.glitterColor !== 'random' && shell.glitterColor !== INVISIBLE
                ? shell.glitterColor : COLOR.Gold;
            comet.spinRadius = 0;
            comet.onUpdate = twist(0);
            // Sống lâu hơn sao chổi để chỉ bị tắt khi sao chổi nổ (không bao giờ chết trước rồi bị tái sử dụng)
            const strand = Star.add(launch.x, launch.y, strandColor, launch.angle, launch.velocity, comet.life * 1.5);
            strand.heavy = true;
            strand.onUpdate = twist(Math.PI);
            strand.sparkFreq = comet.sparkFreq;
            strand.sparkSpeed = comet.sparkSpeed;
            strand.sparkLife = comet.sparkLife;
            strand.sparkLifeVariation = comet.sparkLifeVariation;
            strand.sparkColor = strandColor;
            return { beforeBurst: () => { strand.life = 0; } };
        }
    },

    // Nổ dọc đường: vừa bay lên vừa nổ lụp bụp từng chùm nhỏ
    popping: {
        setup(shell, comet) {
            let timer = 320;
            comet.onUpdate = (star, timeStep) => {
                timer -= timeStep;
                if (timer <= 0) {
                    timer += 240 + Math.random() * 120;
                    launchPop(star.x, star.y, launchPopColor(shell), 8, 1.3, 420, 'burstSmall');
                }
            };
        }
    },

    // Bay nhiều tầng: bay lên chậm dần, nổ một chùm rồi được đẩy tiếp lên tầng trên, lặp lại trước khi nổ chính
    stages: {
        setup(shell, comet, launch) {
            const rise = launch.y - launch.burstY;
            const stops = rise > 260 ? [0.42, 0.72] : [0.6];
            const points = stops.map(f => ({
                x: launch.x + (launch.burstX - launch.x) * f,
                y: launch.y - rise * f
            }));
            let next = 0;
            // Các tầng giữa không nổ theo độ cao đích: chỉ tầng cuối mới nổ chính
            comet.targetY = undefined;
            comet.life = comet.fullLife = 30000;
            comet.secondColor = null;
            aimStar(comet, points[0].x, points[0].y);
            comet.onUpdate = (star) => {
                if (next >= points.length) return;
                // Tới tầng hoặc đã chậm gần như dừng lại
                if (star.y <= points[next].y || star.speedY > -0.15) {
                    launchPop(star.x, star.y, launchPopColor(shell), 22, 2.6, 700, 'burstSoft');
                    next++;
                    if (next < points.length) {
                        aimStar(star, points[next].x, points[next].y);
                    } else {
                        aimStar(star, launch.burstX, launch.burstY);
                        star.targetY = launch.burstY;
                    }
                    soundManager.playSound('liftSoft');
                }
            };
        }
    },

    // Bay lượn: chao qua chao lại ngẫu nhiên, không theo một đường cố định
    wander: {
        setup(shell, comet) {
            const scale = IS_MOBILE ? 0.7 : 1;
            const waves = [0, 1, 2].map(() => ({
                amp: MyMath.random(10, 22) * scale,
                freq: MyMath.random(0.05, 0.2),
                phase: Math.random() * PI_2
            }));
            let t = 0;
            comet.spinRadius = 0;
            comet.onUpdate = (star, timeStep, speed) => {
                t += speed;
                // Biên độ tăng dần từ lúc rời mặt đất
                const ramp = Math.min(1, t / 30);
                setLateralOffset(star, ramp * waves.reduce((sum, w) => sum + Math.sin(w.phase + w.freq * t) * w.amp, 0));
            };
        }
    },

    // Đạn tàng hình: không thấy đường đạn bay, chỉ nghe tiếng phóng rồi pháo bất ngờ nổ giữa trời
    stealth: {
        setup(shell, comet) {
            // Không vẽ đầu đạn và không tóe tia lửa dọc đường; vẫn bay đúng quỹ đạo tới điểm nổ
            comet.visible = false;
            comet.sparkFreq = 0;
            comet.spinRadius = 0;
        }
    }
};
