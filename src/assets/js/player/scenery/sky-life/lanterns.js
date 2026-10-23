/*!
 * Hanabi – trình phát: cảnh vật (đèn trời)
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Đèn trời: đèn giấy (trắng, vàng, đỏ) có nan và đường ghép, ngọn lửa ở đáy rọi sáng giấy từ dưới lên (đáy sáng, đỉnh
// tối), lửa chập chờn; đèn xoay chậm, lắc nhẹ, trôi theo gió (trên cao gió mạnh hơn), càng lên cao càng chậm. Thả theo
// từng tốp từ vài chỗ trên bờ; cháy hết dầu thì lửa lụi dần, đèn tối đi rồi khuất.

import { IS_MOBILE } from '../../env.js';
import { hdSprite, rand, sprites } from '../util.js';
import { drawGlow } from './light.js';

// Giấy: màu đỉnh (xa lửa), giữa, đáy (sát lửa), quầng sáng; tỉ lệ gặp
const PAPERS = [
    { top: '#b5501c', mid: '#ff9a35', bottom: '#fff0bf', halo: '255, 170, 80', share: 0.5 },
    { top: '#a4461a', mid: '#ff8418', bottom: '#ffdf86', halo: '255, 150, 50', share: 0.3 },
    { top: '#6e130f', mid: '#dc3a1c', bottom: '#ffae6a', halo: '255, 105, 60', share: 0.2 }
];

// Số múi giấy quanh đèn và số khung xoay vẽ sẵn cho một múi (xoay hết một múi thì lặp lại)
const PANELS = 6;
const SPIN_FRAMES = 6;

// Chỗ thả đèn trên bờ (tỉ lệ bề ngang)
const RELEASE = [0.2, 0.47, 0.76];

const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);

function pickPaper() {
    let r = Math.random();
    for (let i = 0; i < PAPERS.length; i++) {
        r -= PAPERS[i].share;
        if (r <= 0) return i;
    }
    return 0;
}

// Nửa bề ngang thân đèn ở độ cao y (khung thiết kế 40×56): chóp tròn, thân thuôn nhẹ xuống đáy
const halfWidth = y => (y >= 17 ? 11 - 2 * (y - 17) / 27 : 11 * Math.sqrt(Math.max(0, 1 - ((17 - y) / 11) ** 2)));

function bodyPath(g) {
    g.beginPath();
    g.moveTo(11, 44);
    g.lineTo(9, 17);
    g.bezierCurveTo(9, 9, 14, 6, 20, 6);
    g.bezierCurveTo(26, 6, 31, 9, 31, 17);
    g.lineTo(29, 44);
    g.ellipse(20, 44, 9, 2.2, 0, 0, Math.PI, false);
    g.closePath();
}

// Thân đèn vẽ sẵn theo màu giấy và góc xoay (đường ghép giữa các múi trôi ngang khi đèn xoay)
function bodySprite(paper, frame) {
    const key = `skyLantern:${paper}:${frame}`;
    if (sprites[key]) return sprites[key];
    const p = PAPERS[paper];
    const [c, g] = hdSprite(40, 56);
    g.save();
    bodyPath(g);
    g.clip();
    const fill = g.createLinearGradient(0, 6, 0, 46);
    fill.addColorStop(0, p.top);
    fill.addColorStop(0.55, p.mid);
    fill.addColorStop(1, p.bottom);
    g.fillStyle = fill;
    g.fillRect(0, 0, 40, 56);
    // Thân tròn: hai mép tối hơn
    const side = g.createLinearGradient(9, 0, 31, 0);
    side.addColorStop(0, 'rgba(40, 8, 0, 0.42)');
    side.addColorStop(0.3, 'rgba(40, 8, 0, 0)');
    side.addColorStop(0.7, 'rgba(40, 8, 0, 0)');
    side.addColorStop(1, 'rgba(40, 8, 0, 0.42)');
    g.fillStyle = side;
    g.fillRect(0, 0, 40, 56);
    // Đường ghép giữa các múi (chỉ thấy nửa trước), mờ dần ra mép
    const spin = frame / SPIN_FRAMES * (Math.PI * 2 / PANELS);
    g.lineWidth = 0.55;
    for (let j = 0; j < PANELS; j++) {
        const a = j * Math.PI * 2 / PANELS + spin;
        if (Math.cos(a) <= 0.05) continue;
        g.strokeStyle = `rgba(90, 28, 0, ${0.32 * Math.cos(a)})`;
        g.beginPath();
        for (let y = 6.5; y <= 45; y += 0.5) {
            const x = 20 + halfWidth(y) * Math.sin(a);
            if (y === 6.5) g.moveTo(x, y);
            else g.lineTo(x, y);
        }
        g.stroke();
    }
    // Ánh lửa trong lòng đèn: sáng nhất sát đáy
    g.globalCompositeOperation = 'lighter';
    const inner = g.createRadialGradient(20, 43, 1, 20, 40, 24);
    inner.addColorStop(0, 'rgba(255, 245, 210, 0.6)');
    inner.addColorStop(0.5, 'rgba(255, 190, 110, 0.18)');
    inner.addColorStop(1, 'rgba(255, 160, 80, 0)');
    g.fillStyle = inner;
    g.fillRect(0, 0, 40, 56);
    g.restore();
    // Vòng tre ở miệng đèn, dây thép chéo giữ cục dầu
    g.strokeStyle = 'rgba(70, 30, 10, 0.85)';
    g.lineWidth = 0.8;
    g.beginPath();
    g.ellipse(20, 44, 9, 2.2, 0, 0, Math.PI * 2);
    g.stroke();
    g.lineWidth = 0.4;
    g.beginPath();
    g.moveTo(11.5, 44.6);
    g.lineTo(28.5, 43.4);
    g.moveTo(13, 42.6);
    g.lineTo(27, 45.4);
    g.stroke();
    sprites[key] = c;
    return c;
}

export const Lanterns = {
    populate(env) {
        const count = IS_MOBILE ? 9 : 16;
        return Array.from({ length: count }, () => this.spawn(env, true));
    },

    // initial: đã bay sẵn trên trời lúc mở màn; không thì vừa được thả từ bờ (đợi một lúc mới thả)
    spawn(env, initial) {
        const z = Math.random();
        const life = rand(45000, 90000);
        const x = initial ? rand(0.05, 0.95) * env.width : RELEASE[(Math.random() * RELEASE.length) | 0] * env.width + rand(-30, 30);
        return {
            kind: Lanterns, z,
            size: (6 + 11 * z) * (IS_MOBILE ? 0.85 : 1),
            x, y: initial ? rand(0.1, 0.95) * env.ground : env.ground + 4,
            paper: pickPaper(), spin: rand(0, Math.PI * 2), spinRate: rand(0.0003, 0.0009) * (Math.random() < 0.5 ? -1 : 1),
            sway: rand(0, Math.PI * 2), swayRate: rand(0.0006, 0.0012), flick: [rand(0, 7), rand(0, 7), rand(0, 7)],
            life, age: initial ? rand(1500, life * 0.6) : 0, wait: initial ? 0 : rand(0, 6000)
        };
    },

    respawn(item, env) {
        return this.spawn(env, false);
    },

    update(item, dt, env) {
        if (item.wait > 0) {
            item.wait -= dt;
            return true;
        }
        item.age += dt;
        // Lên cao: bay chậm lại, gió mạnh hơn
        const high = clamp01(1 - item.y / env.ground);
        item.y -= (0.007 + 0.012 * item.z) * (1 - 0.45 * high) * dt;
        item.x += env.wind * (0.6 + 0.9 * item.z) * (0.6 + 0.8 * high) * dt;
        item.sway += item.swayRate * dt;
        item.spin += item.spinRate * dt;
        return !(item.y < -30 || item.x < -40 || item.x > env.width + 40 || item.age > item.life + 2500);
    },

    draw(ctx, item, view) {
        if (item.wait > 0) return;
        const t = view.time;
        const burn = item.age / item.life;
        // Cháy gần hết dầu: lửa lụi dần; tắt hẳn thì đèn tối đi rồi khuất
        const fuel = burn < 0.85 ? 1 : clamp01((1 - burn) / 0.15);
        const flicker = view.calm ? 0.92
            : 0.86 + 0.08 * Math.sin(t * 0.011 + item.flick[0]) + 0.05 * Math.sin(t * 0.029 + item.flick[1]) + 0.03 * Math.sin(t * 0.071 + item.flick[2]);
        const flame = fuel * flicker;
        const alpha = Math.min(1, item.age / 1500) * clamp01(item.y / (view.ground * 0.12)) * (burn < 1 ? 1 : clamp01(1 - (item.age - item.life) / 2500));
        if (alpha <= 0.01) return;
        const p = PAPERS[item.paper];
        const w = item.size;
        const h = w * 56 / 40;
        const x = item.x + Math.sin(item.sway) * (1 + 1.5 * item.z);
        const tilt = 0.07 * Math.sin(item.sway * 1.3);
        ctx.globalCompositeOperation = 'lighter';
        drawGlow(ctx, p.halo, x, item.y, w * 2.4, alpha * flame * 0.5);
        ctx.globalCompositeOperation = 'source-over';
        const step = Math.PI * 2 / PANELS;
        const frame = Math.floor((((item.spin % step) + step) % step) / step * SPIN_FRAMES) % SPIN_FRAMES;
        ctx.save();
        ctx.translate(x, item.y);
        ctx.rotate(tilt);
        ctx.globalAlpha = alpha * (0.2 + 0.8 * flame);
        ctx.drawImage(bodySprite(item.paper, frame), -w / 2, -h * 0.62, w, h);
        ctx.restore();
        // Ngọn lửa ở đáy (theo độ nghiêng của đèn)
        ctx.globalCompositeOperation = 'lighter';
        drawGlow(ctx, '255, 196, 110', x - Math.sin(tilt) * h * 0.17, item.y + Math.cos(tilt) * h * 0.17, w * 0.5, alpha * flame);
        ctx.globalCompositeOperation = 'source-over';
    }
};
