/*!
 * Trình diễn Pháo hoa – trình phát: cảnh vật (khinh khí cầu)
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Khinh khí cầu bay đêm: bóng có các múi vải tròn khối (sọc, cầu vồng, dải răng cưa, vương miện), đêm tối chỉ thấy lờ
// mờ; lò đốt phụt lửa thì cả bóng sáng bừng từ bên trong (sáng nhất ở thấp, giữa bóng), không khí nóng lên nên bóng nổi
// dần, thôi đốt thì nguội và hạ dần. Giỏ treo dưới bóng đung đưa nhẹ, ánh lửa hắt lên giỏ. Trôi theo gió, gần thì to và
// trôi nhanh hơn.

import { IS_MOBILE } from '../../env.js';
import { hdSprite, rand, sprites } from '../util.js';
import { drawGlow } from './light.js';

// Mẫu vải: kiểu hoa văn và màu
const DESIGNS = [
    { kind: 'stripes', colors: ['#e63946', '#f1faee'] },
    { kind: 'rainbow', colors: ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93', '#ff924c'] },
    { kind: 'band', colors: ['#1d3557', '#ffb703', '#e63946'] },
    { kind: 'crown', colors: ['#ff006e', '#fb5607', '#ffbe0b'] },
    { kind: 'stripes', colors: ['#06d6a0', '#118ab2'] },
    { kind: 'band', colors: ['#7b2cbf', '#ffd60a', '#ffffff'] }
];

// Khung thiết kế 100×120: bóng từ đỉnh (y 2) phình to nhất ở y 46, thuôn xuống miệng bóng (y 108, rộng 20)
const W = 100;
const H = 120;
const THROAT = 108;

const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);

const radius = y => (y <= 46
    ? 47 * Math.sqrt(Math.max(0, 1 - ((46 - y) / 44) ** 2))
    : 10 + 37 * Math.pow(Math.cos((y - 46) / (THROAT - 46) * Math.PI / 2), 1.3));

function envelopePath(g) {
    g.beginPath();
    for (let y = THROAT; y >= 2; y -= 1) g.lineTo(50 - radius(y), y);
    for (let y = 2; y <= THROAT; y += 1) g.lineTo(50 + radius(y), y);
    g.closePath();
}

// Múi vải giữa hai đường kinh tuyến a, b (góc, nửa trước của bóng)
function gorePath(g, a, b) {
    g.beginPath();
    for (let y = 2; y <= THROAT; y += 1.5) g.lineTo(50 + radius(y) * Math.sin(a), y);
    for (let y = THROAT; y >= 2; y -= 1.5) g.lineTo(50 + radius(y) * Math.sin(b), y);
    g.closePath();
}

// Bóng vẽ sẵn theo mẫu vải: lit = lúc lò đốt rọi sáng từ bên trong, không thì bóng đêm lờ mờ
function envelopeSprite(design, lit) {
    const key = `balloon:${design}:${lit ? 1 : 0}`;
    if (sprites[key]) return sprites[key];
    const d = DESIGNS[design];
    const [c, g] = hdSprite(W, H);
    g.save();
    envelopePath(g);
    g.clip();
    const step = Math.PI / 6;
    for (let j = 0; j < 6; j++) {
        const color = d.kind === 'rainbow' ? d.colors[j % d.colors.length]
            : d.kind === 'stripes' || d.kind === 'crown' ? d.colors[j % 2] : d.colors[0];
        g.fillStyle = color;
        gorePath(g, -Math.PI / 2 + j * step - 0.01, -Math.PI / 2 + (j + 1) * step + 0.01);
        g.fill();
    }
    if (d.kind === 'band') {
        // Dải răng cưa quanh bụng bóng, viền màu thứ ba
        const zig = (y0, y1) => {
            const pts = [];
            for (let x = 0, i = 0; x <= W; x += 8, i++) pts.push([x, i % 2 ? y1 : y0]);
            return pts;
        };
        const top = zig(42, 50);
        const bottom = zig(58, 66).reverse();
        g.fillStyle = d.colors[1];
        g.beginPath();
        [...top, ...bottom].forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
        g.closePath();
        g.fill();
        g.strokeStyle = d.colors[2];
        g.lineWidth = 1.6;
        [top, bottom].forEach(line => {
            g.beginPath();
            line.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
            g.stroke();
        });
    } else if (d.kind === 'crown') {
        g.fillStyle = d.colors[2];
        g.fillRect(0, 52, W, H);
        g.strokeStyle = d.colors[0];
        g.lineWidth = 2.2;
        [52, 80].forEach(y => {
            g.beginPath();
            g.moveTo(0, y);
            g.lineTo(W, y);
            g.stroke();
        });
    }
    // Đường may giữa các múi, dây đai ngang
    g.strokeStyle = 'rgba(0, 0, 0, 0.28)';
    g.lineWidth = 0.5;
    for (let j = 1; j < 6; j++) {
        const a = -Math.PI / 2 + j * step;
        g.beginPath();
        for (let y = 2; y <= THROAT; y += 1.5) g.lineTo(50 + radius(y) * Math.sin(a), y);
        g.stroke();
    }
    g.strokeStyle = 'rgba(0, 0, 0, 0.14)';
    [24, 66, 90].forEach(y => {
        g.beginPath();
        g.ellipse(50, y, radius(y), 2.2, 0, 0, Math.PI);
        g.stroke();
    });
    // Khối tròn: mép tối, đỉnh tối
    const limb = g.createRadialGradient(46, 44, 10, 50, 50, 58);
    limb.addColorStop(0, 'rgba(0, 0, 0, 0)');
    limb.addColorStop(1, `rgba(0, 0, 0, ${lit ? 0.38 : 0.55})`);
    g.fillStyle = limb;
    g.fillRect(0, 0, W, H);
    if (lit) {
        // Vải mỏng, lửa bên trong rọi qua: sáng ấm nhất ở thấp, giữa bóng
        const top = g.createLinearGradient(0, 0, 0, 50);
        top.addColorStop(0, 'rgba(0, 0, 0, 0.3)');
        top.addColorStop(1, 'rgba(0, 0, 0, 0)');
        g.fillStyle = top;
        g.fillRect(0, 0, W, H);
        g.globalCompositeOperation = 'lighter';
        const inner = g.createRadialGradient(50, 88, 4, 50, 70, 70);
        inner.addColorStop(0, 'rgba(255, 225, 160, 0.55)');
        inner.addColorStop(0.45, 'rgba(255, 190, 120, 0.2)');
        inner.addColorStop(1, 'rgba(255, 170, 100, 0)');
        g.fillStyle = inner;
        g.fillRect(0, 0, W, H);
    } else {
        // Đêm tối: chỉ thấy lờ mờ màu vải
        g.fillStyle = 'rgba(6, 10, 24, 0.72)';
        g.fillRect(0, 0, W, H);
    }
    g.restore();
    // Váy bóng dưới miệng
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = lit ? 'rgba(120, 60, 30, 0.9)' : 'rgba(25, 18, 20, 0.9)';
    g.beginPath();
    g.moveTo(40, THROAT - 1);
    g.lineTo(60, THROAT - 1);
    g.lineTo(57, THROAT + 7);
    g.lineTo(43, THROAT + 7);
    g.closePath();
    g.fill();
    sprites[key] = c;
    return c;
}

export const Balloons = {
    populate(env) {
        const count = IS_MOBILE ? 2 : 3;
        return Array.from({ length: count }, (_, i) => this.spawn(env, true, i, count));
    },

    spawn(env, initial, index = 0, count = 1) {
        const z = initial ? 0.25 + 0.75 * (index + Math.random() * 0.6) / count : rand(0.25, 1);
        const size = (28 + 46 * z) * (IS_MOBILE ? 0.8 : 1);
        const dir = env.wind < 0 ? -1 : 1;
        return {
            kind: Balloons, z, size,
            x: initial ? (index + 0.5) / count * env.width + rand(-40, 40) : dir > 0 ? -size : env.width + size,
            y: rand(0.15, 0.5) * env.ground,
            design: (Math.random() * DESIGNS.length) | 0,
            heat: rand(0.4, 0.6), vy: 0, burning: 0, nextBurn: rand(1500, 7000), glow: 0,
            swing: rand(0, Math.PI * 2), flick: rand(0, 7)
        };
    },

    respawn(item, env) {
        return this.spawn(env, false);
    },

    update(item, dt, env) {
        item.x += env.wind * (0.7 + 0.9 * item.z) * dt;
        // Lò đốt từng đợt: đốt thì không khí trong bóng nóng lên, nổi dần; thôi đốt thì nguội, hạ dần. Xuống thấp quá thì
        // đốt sớm, lên cao quá thì đốt muộn
        if (item.burning > 0) {
            item.burning -= dt;
            item.heat = Math.min(1, item.heat + dt * 0.00022);
            if (item.burning <= 0) item.nextBurn = rand(4000, 10000) * (item.y < env.ground * 0.14 ? 1.8 : 1);
        } else {
            item.nextBurn -= dt;
            item.heat = Math.max(0, item.heat - dt * 0.00005);
            if (item.nextBurn <= 0 || item.y > env.ground * 0.6) item.burning = rand(1500, 3800);
        }
        const target = (0.5 - item.heat) * 0.008;
        item.vy += (target - item.vy) * Math.min(1, dt * 0.0015);
        item.y = Math.min(env.ground * 0.7, Math.max(env.ground * 0.08, item.y + item.vy * dt));
        // Bóng sáng lên nhanh khi lửa phụt, tối đi chậm hơn
        const want = item.burning > 0 ? 1 : 0;
        item.glow += (want - item.glow) * Math.min(1, dt / (want > item.glow ? 120 : 420));
        item.swing += dt * 0.0011;
        return !(item.x < -item.size * 2 || item.x > env.width + item.size * 2);
    },

    draw(ctx, item, view) {
        const w = item.size;
        const h = w * H / W;
        const top = item.y - h * 0.5;
        const throatY = top + h * THROAT / H;
        const fire = item.burning > 0 ? (view.calm ? 1 : 0.85 + 0.15 * Math.sin(view.time * 0.05 + item.flick)) : 0;
        const lit = clamp01(0.07 + 0.2 * view.light + item.glow * 0.95 * (view.calm ? 1 : 0.9 + 0.1 * fire) + view.flash * 0.25);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 0.95;
        ctx.drawImage(envelopeSprite(item.design, false), item.x - w / 2, top, w, h);
        ctx.globalAlpha = lit;
        ctx.drawImage(envelopeSprite(item.design, true), item.x - w / 2, top, w, h);

        // Giỏ treo đung đưa dưới miệng bóng, dây treo
        const swing = 0.035 * Math.sin(item.swing);
        const len = w * 0.2;
        const bx = item.x + Math.sin(swing) * len;
        const by = throatY + w * 0.07 + Math.cos(swing) * len;
        const bw = w * 0.15;
        const bh = w * 0.085;
        ctx.globalAlpha = 0.95;
        // Dây treo: ánh lửa hắt vào thì sáng lên
        ctx.strokeStyle = `rgba(${Math.round(90 + 120 * item.glow)}, ${Math.round(70 + 80 * item.glow)}, 50, 0.75)`;
        ctx.lineWidth = Math.max(0.4, w * 0.008);
        ctx.beginPath();
        ctx.moveTo(item.x - w * 0.07, throatY + w * 0.06);
        ctx.lineTo(bx - bw / 2, by - bh / 2);
        ctx.moveTo(item.x + w * 0.07, throatY + w * 0.06);
        ctx.lineTo(bx + bw / 2, by - bh / 2);
        ctx.stroke();
        ctx.save();
        ctx.translate(bx, by);
        ctx.rotate(swing);
        ctx.fillStyle = '#3b2616';
        ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
        // Ánh lửa hắt lên mép trên của giỏ
        ctx.globalAlpha = 0.2 + 0.7 * item.glow;
        ctx.fillStyle = '#e09a55';
        ctx.fillRect(-bw / 2, -bh / 2, bw, bh * 0.25);
        ctx.restore();

        // Lửa lò đốt phụt từ trên giỏ lên tận miệng bóng: chân xanh, lõi trắng vàng, ngọn cam loe ra, chập chờn
        if (fire > 0) {
            const fy = by - bh / 2 - w * 0.01;
            const reach = (fy - throatY) * (0.85 + 0.15 * fire);
            ctx.globalCompositeOperation = 'lighter';
            drawGlow(ctx, '255, 170, 90', bx, fy - reach * 0.75, w * 0.2, 0.5 * fire);
            for (let i = 0; i < 4; i++) {
                const q = i / 3;
                drawGlow(ctx, q < 0.5 ? '255, 240, 200' : '255, 190, 110', bx + Math.sin(view.time * 0.03 + i) * w * 0.006, fy - reach * q, w * (0.05 + 0.05 * q), (0.95 - 0.35 * q) * fire);
            }
            drawGlow(ctx, '120, 160, 255', bx, fy, w * 0.04, 0.6 * fire);
            ctx.globalCompositeOperation = 'source-over';
        }
    }
};
