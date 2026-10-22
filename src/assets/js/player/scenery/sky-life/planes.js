/*!
 * Trình diễn Pháo hoa – trình phát: cảnh vật (máy bay)
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Máy bay đêm như thật: chỉ thấy đèn. Đèn hàng hải đỏ ở đầu cánh trái, xanh ở đầu cánh phải (cánh gần người xem thấp
// hơn), đèn trắng ở đuôi; đèn đỏ chống va chạm chớp trên thân; đèn trắng đầu cánh chớp đôi (có loại chớp đơn). Máy bay
// đường dài bay cao, nhỏ, hơi lên hay xuống; đêm có trăng thì thấy vệt khói trắng kéo dài, loang dần. Máy bay sắp hạ
// cánh bay thấp hơn, to hơn, đang hạ dần, bật đèn pha sáng chói phía trước, thấy cả dãy cửa sổ khoang khách.

import { rand } from '../util.js';
import { drawGlow } from './light.js';

const RED = '255, 70, 60';
const GREEN = '80, 255, 140';
const WHITE = '255, 255, 255';
const WARM = '255, 214, 150';

const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);

export const Planes = {
    populate(env) {
        return [this.spawn(env, rand(1000, 4000))];
    },

    // wait: đợi bao lâu (ms) mới bay vào khung
    spawn(env, wait = rand(8000, 22000)) {
        const dir = Math.random() < 0.5 ? -1 : 1;
        const landing = Math.random() < 0.3;
        return {
            kind: Planes, wait, dir, landing,
            z: landing ? 0.9 : 0.3,
            x: dir > 0 ? -30 : env.width + 30,
            y: (landing ? rand(0.22, 0.42) : rand(0.05, 0.28)) * env.ground,
            vx: dir * (landing ? rand(0.03, 0.045) : rand(0.018, 0.03)),
            vy: landing ? rand(0.0008, 0.0016) : rand(-0.0005, 0.0005),
            scale: landing ? rand(1.3, 1.8) : rand(0.7, 1.05),
            // Kiểu đèn chớp đầu cánh, lệch nhịp đèn chớp
            double: Math.random() < 0.65, t: rand(0, 1500),
            trail: [], trailIn: 0
        };
    },

    respawn(item, env) {
        return this.spawn(env);
    },

    update(item, dt, env) {
        if (item.wait > 0) {
            item.wait -= dt;
            return true;
        }
        item.t += dt;
        item.x += item.vx * dt;
        item.y += item.vy * dt;
        // Vệt khói: ghi lại đường bay (chỉ máy bay đường dài, bay cao; chỉ thấy khi có trăng)
        if (!item.landing && env.light > 0.12) {
            item.trailIn -= dt;
            if (item.trailIn <= 0) {
                item.trailIn = 160;
                item.trail.push([item.x, item.y, item.t]);
            }
            item.trail = item.trail.filter(p => item.t - p[2] < 32000);
        } else {
            item.trail = [];
        }
        // Bay khỏi khung, đợi vệt khói tan rồi mới có chiếc khác
        const gone = item.x < -40 || item.x > env.width + 40;
        return !(gone && !item.trail.some(p => item.t - p[2] < 30000 && p[0] > -10 && p[0] < env.width + 10));
    },

    draw(ctx, item, view) {
        if (item.wait > 0) return;
        const { dir, scale: s, t } = item;
        const dim = 1 - 0.3 * view.light;
        ctx.globalCompositeOperation = 'lighter';

        // Vệt khói dưới ánh trăng: mờ dần, loang rộng, trôi nhẹ theo gió. Vẽ thành từng khúc liền (mỗi khúc một độ mờ),
        // không vẽ từng đoạn ngắn kẻo chỗ nối đậm lên thành nét chấm
        if (item.trail.length > 1 && view.light > 0.12) {
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.strokeStyle = 'rgb(200, 210, 230)';
            const chunk = 12;
            for (let start = 0; start < item.trail.length - 1; start += chunk) {
                const part = item.trail.slice(start, start + chunk + 1);
                const t0 = part[Math.floor(part.length / 2)][2];
                const age = (t - t0) / 32000;
                ctx.globalAlpha = clamp01(0.22 * view.light * (1 - age) * Math.min(1, (t - t0) / 1500));
                ctx.lineWidth = 0.6 + 2.6 * age;
                ctx.beginPath();
                part.forEach(([x, y, tp], i) => {
                    const drift = (t - tp) * view.wind * 0.15;
                    if (i) ctx.lineTo(x + drift, y);
                    else ctx.moveTo(x + drift, y);
                });
                ctx.stroke();
            }
        }
        if (item.x < -40 || item.x > view.width + 40) {
            ctx.globalCompositeOperation = 'source-over';
            return;
        }

        // Vị trí đèn (đơn vị máy bay, nhân s): đầu cánh gần người xem thấp hơn, đầu cánh xa cao hơn
        const at = (dx, dy) => [item.x + dx * dir * s, item.y + dy * s];
        const [nx, ny] = at(-1, 2.3);
        const [fx, fy] = at(-1.6, -1.9);
        const [tx, ty] = at(-7, -0.5);
        // Bay sang phải thấy cánh phải (xanh) ở gần; bay sang trái thấy cánh trái (đỏ) ở gần
        const near = dir > 0 ? GREEN : RED;
        const far = dir > 0 ? RED : GREEN;
        drawGlow(ctx, near, nx, ny, 3.2 * s, 0.85 * dim);
        drawGlow(ctx, far, fx, fy, 2.8 * s, 0.7 * dim);
        drawGlow(ctx, WHITE, tx, ty, 2.2 * s, 0.5 * dim);

        if (item.landing) {
            // Dãy cửa sổ khoang khách, đèn pha trước mũi chiếu tới trước
            for (let i = 0; i < 9; i++) {
                const [wx, wy] = at(-4.5 + i * 1.1, -0.15);
                drawGlow(ctx, WARM, wx, wy, 0.7 * s, 0.28 * dim);
            }
            const [lx, ly] = at(2.4, 0.4);
            drawGlow(ctx, WHITE, lx + dir * 4 * s, ly, 9 * s, 0.22);
            drawGlow(ctx, WHITE, lx, ly, 4.5 * s, 0.95);
        }
        if (!view.calm) {
            // Đèn đỏ chống va chạm trên, dưới thân: chớp khoảng một giây một lần
            if (t % 1050 < 90) {
                const [bx, by] = at(0, -0.6);
                drawGlow(ctx, RED, bx, by, 3.6 * s, 1);
            }
            // Đèn trắng đầu cánh: chớp đôi (hoặc chớp đơn)
            const strobe = t % 1300;
            if (strobe < 55 || (item.double && strobe > 150 && strobe < 205)) {
                drawGlow(ctx, WHITE, nx, ny, 5 * s, 1);
                drawGlow(ctx, WHITE, fx, fy, 4.4 * s, 0.9);
            }
        }
        ctx.globalCompositeOperation = 'source-over';
    }
};
