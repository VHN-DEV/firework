/*!
 * Trình diễn Pháo hoa – trình phát: cảnh vật (bờ đất)
 * Phần bổ sung và chỉnh sửa © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Phần nhô lên của bờ đất: cỏ, lau sậy, bụi cây theo mùa; đom đóm, bướm; gọi kiểu bờ khác khi có.

import { IS_MOBILE } from '../env.js';
import { season as sceneSeason } from '../state.js';
import { fireflyGlow, hash } from './util.js';
import { BANK_SEASONS, bankDip, bankStyle } from './bank.js';
import { drawStyledSkyline } from './skylines.js';
import { makeCanvas, seededRandom } from '../utils.js';

// Những gì nhô lên trên bờ (điểm ảnh CSS): cỏ ngắn lún phún, bụi cỏ cao, khóm lau sậy có bông cỏ nến, bụi cây thấp ở
// xa, đom đóm. Rải lại khi đổi cỡ khung; cỏ ngắn và bụi cây đứng yên nên dựng sẵn đường vẽ.
let bankLifeCache = { key: -1 };

function bankLife(cssW, season = 'summer') {
    const key = `${Math.round(cssW)}_${season}`;
    if (bankLifeCache.key === key) return bankLifeCache;
    const look = BANK_SEASONS[season] || BANK_SEASONS.summer;
    const rnd = seededRandom(71);
    const fringeColors = look.fringe;
    const fringe = fringeColors.map(() => new Path2D());
    for (let x = 0; x < cssW; x += 0.7 + rnd() * 2) {
        const base = bankDip(x) + 0.6;
        const h = 0.8 + rnd() * 2.8;
        const lean = (rnd() - 0.5) * 1.6;
        const path = fringe[(rnd() * 4) | 0];
        path.moveTo(x, base);
        path.quadraticCurveTo(x + lean * 0.3, base - h * 0.6, x + lean, base - h);
    }
    // Bụi cây thấp ở xa: nhiều chùm lá nhỏ chen nhau thành khối xum xuê, mép lởm chởm; chùm trên cùng hứng ánh trăng
    const bushes = new Path2D();
    const bushLight = new Path2D();
    for (let x = 40 + rnd() * 120; x < cssW; x += 110 + rnd() * 260) {
        const w = 10 + rnd() * 22;
        const h = 5 + rnd() * 8;
        const base = bankDip(x) + 0.5;
        for (let i = 0; i < 26; i++) {
            const u = rnd() * 2 - 1;
            const top = h * Math.sqrt(1 - u * u * 0.85);
            const lx = x + u * w * 0.5;
            const ly = base - rnd() * top;
            const lr = 0.9 + rnd() * Math.min(2.6, h * 0.3);
            bushes.moveTo(lx + lr, ly);
            bushes.arc(lx, ly, lr, 0, Math.PI * 2);
            if (base - ly > top * 0.65 && rnd() < 0.7) {
                bushLight.moveTo(lx - lr * 0.2 + lr * 0.55, ly - lr * 0.3);
                bushLight.arc(lx - lr * 0.2, ly - lr * 0.3, lr * 0.55, 0, Math.PI * 2);
            }
        }
    }
    // Bụi cỏ, khóm lau (có bông cỏ nến): mỗi bụi dùng một trong các mẫu bụi, đung đưa theo nhịp riêng
    const templates = [];
    for (let i = 0; i < TUFT_GRASS + TUFT_REEDS; i++) {
        const reed = i >= TUFT_GRASS;
        const tall = reed ? 9 + rnd() * 9 : 3 + rnd() * 6;
        const n = 3 + ((rnd() * (reed ? 4 : 5)) | 0);
        templates.push({
            reed,
            blades: Array.from({ length: n }, () => ({
                dx: (rnd() - 0.5) * (reed ? 4 : 5), h: tall * (0.55 + rnd() * 0.5), lean: (rnd() - 0.5) * (reed ? 1.5 : 3),
                color: (rnd() * 4) | 0, cattail: reed && rnd() < 0.45
            }))
        });
    }
    const tufts = [];
    for (let x = rnd() * 10; x < cssW; x += 5 + rnd() * 16) {
        const reed = rnd() < look.reeds;
        tufts.push({ x, phase: rnd() * 6, base: bankDip(x) + 0.6, template: reed ? TUFT_GRASS + ((rnd() * TUFT_REEDS) | 0) : (rnd() * TUFT_GRASS) | 0 });
    }
    // Đom đóm chỉ có mùa hạ
    const flies = look.flies ? Array.from({ length: Math.max(4, Math.round(cssW / (IS_MOBILE ? 60 : 110))) }, () => ({
        x: rnd() * cssW, h: 3 + rnd() * 22, roam: 10 + rnd() * 30, speed: 0.00015 + rnd() * 0.0003, phase: rnd() * 100,
        rate: 0.0012 + rnd() * 0.0016, size: 1.6 + rnd() * 1.4
    })) : [];
    // Mùa xuân: hoa dại lấm tấm trên bờ cỏ (hồng, trắng, vàng, tím nhạt dưới ánh trăng)
    const flowerColors = ['#c98aa0', '#d8ccd4', '#cdb860', '#a87cb4'];
    const flowers = flowerColors.map(() => new Path2D());
    if (look.flowers) {
        for (let x = rnd() * 6; x < cssW; x += 1.5 + rnd() * 6) {
            const y = bankDip(x) + 0.4 - rnd() * 2.6;
            const r = 0.45 + rnd() * 0.35;
            const path = flowers[(rnd() * flowerColors.length) | 0];
            path.moveTo(x + r, y);
            path.arc(x, y, r, 0, Math.PI * 2);
        }
    }
    // Mùa đông: tuyết đọng thành gò nhỏ dọc mặt bờ, cỏ khô lún phún nhô lên
    const drifts = new Path2D();
    if (look.snow) {
        for (let x = 0; x < cssW; x += 2 + rnd() * 6) {
            const w = 3 + rnd() * 7;
            drifts.moveTo(x + w, bankDip(x) + 0.8);
            drifts.ellipse(x, bankDip(x) + 0.8, w, 0.8 + rnd() * 1.1, 0, Math.PI, Math.PI * 2);
        }
    }
    bankLifeCache = { key, season, look, fringe, fringeColors, bushes, bushLight, templates, tufts, flies, flowers, flowerColors, drifts };
    return bankLifeCache;
}

// Cỏ ngắn, bụi cây đứng yên: vẽ sẵn một lần vào ảnh riêng theo cỡ khung và mật độ điểm ảnh, mỗi khung chỉ dán lại
let bankStillCache = { key: '', canvas: null };

const BANK_STILL_UP = 18;

function bankStill(life, cssW, k) {
    const key = `${life.key}_${k.toFixed(3)}`;
    if (bankStillCache.key === key) return bankStillCache.canvas;
    const [c, g] = makeCanvas(Math.ceil(cssW * k), Math.ceil((BANK_STILL_UP + 4) * k));
    g.setTransform(k, 0, 0, k, 0, BANK_STILL_UP * k);
    g.lineCap = 'round';
    g.fillStyle = life.look.bush;
    g.fill(life.bushes);
    g.fillStyle = life.look.bushLight;
    g.fill(life.bushLight);
    if (life.look.snow) {
        g.fillStyle = '#b8c0d2';
        g.fill(life.drifts);
    }
    g.lineWidth = 0.6;
    life.fringe.forEach((path, i) => {
        // Mùa đông chỉ còn lác đác cỏ khô nhô khỏi tuyết
        if (life.look.snow && i % 2) return;
        g.strokeStyle = life.fringeColors[i];
        g.stroke(path);
    });
    life.flowers.forEach((path, i) => {
        g.fillStyle = life.flowerColors[i];
        g.fill(path);
    });
    bankStillCache = { key, canvas: c };
    return c;
}

// Bụi cỏ, khóm lau đung đưa: mỗi mẫu bụi dựng sẵn ở TUFT_STEPS mức ngả theo gió (một tấm ảnh chung, mỗi hàng một mẫu),
// mỗi khung chỉ dán đúng mức ngả của từng bụi. Vẽ lại vài trăm lá cỏ bằng đường mỗi khung rất tốn (card đồ họa vẽ đường
// nhiều mảnh nhỏ chậm), làm cả lớp bầu trời và bóng phản chiếu chậm theo.
const TUFT_GRASS = 10;

const TUFT_REEDS = 4;

const TUFT_STEPS = 24;

const TUFT_SWAY = [-0.45, 1.6];

// Ô của mỗi hình (điểm ảnh CSS): gốc bụi ở giữa, cách đáy TUFT_FOOT
const TUFT_W = 36;

const TUFT_H = 24;

const TUFT_FOOT = 3;

let tuftAtlasCache = { key: '', canvas: null };

function tuftAtlas(life, k) {
    const key = `${life.key}_${k.toFixed(3)}`;
    if (tuftAtlasCache.key === key) return tuftAtlasCache.canvas;
    const [c, g] = makeCanvas(Math.ceil(TUFT_STEPS * TUFT_W * k), Math.ceil(life.templates.length * TUFT_H * k));
    g.setTransform(k, 0, 0, k, 0, 0);
    life.templates.forEach((tpl, row) => {
        for (let step = 0; step < TUFT_STEPS; step++) {
            const sway = TUFT_SWAY[0] + (TUFT_SWAY[1] - TUFT_SWAY[0]) * step / (TUFT_STEPS - 1);
            const ox = step * TUFT_W + TUFT_W / 2;
            const base = row * TUFT_H + TUFT_H - TUFT_FOOT;
            // Lá thon: chân rộng, ngọn nhọn, uốn theo đường cong qua điểm giữa
            const look = life.look;
            // Mùa đông: gò tuyết dưới gốc bụi
            if (look.snow) {
                g.fillStyle = '#9ea7ba';
                g.beginPath();
                g.ellipse(ox, base + 0.6, tpl.reed ? 4 : 5, 1.8, 0, Math.PI, Math.PI * 2);
                g.fill();
            }
            tpl.blades.forEach((blade, bi) => {
                const bx = ox + blade.dx;
                const bend = (sway * (tpl.reed ? 0.55 : 1) + blade.lean / blade.h) * blade.h * 0.45;
                const tipY = base - blade.h * (1 - 0.15 * Math.min(1, Math.abs(bend) / blade.h));
                const midX = bx * 0.25 + (bx + bend * 0.2) * 0.5 + (bx + bend) * 0.25;
                const midY = base * 0.25 + (base - blade.h * 0.55) * 0.5 + tipY * 0.25;
                const half = tpl.reed ? 0.6 : 0.55;
                g.fillStyle = look.tuft[(tpl.reed ? 4 : 0) + blade.color];
                g.beginPath();
                g.moveTo(bx - half, base);
                g.lineTo(midX - half * 0.72, midY);
                g.lineTo(bx + bend, tipY);
                g.lineTo(midX + half * 0.72, midY);
                g.lineTo(bx + half, base);
                g.closePath();
                g.fill();
                if (blade.cattail && look.head) {
                    g.save();
                    g.translate(bx + bend * 0.85, base - blade.h * 0.82);
                    g.rotate(Math.atan2(bend, blade.h));
                    g.beginPath();
                    if (look.head === 'plume') {
                        // Bông lau trắng mùa thu: chùm tơ mềm rủ theo gió, lõi sáng
                        g.fillStyle = 'rgba(176, 168, 150, 0.85)';
                        g.ellipse(bend * 0.08, -0.6, 1.5, 3.8, 0.25, 0, Math.PI * 2);
                        g.fill();
                        g.fillStyle = 'rgba(214, 208, 192, 0.8)';
                        g.beginPath();
                        g.ellipse(bend * 0.08 - 0.3, -1, 0.8, 2.8, 0.25, 0, Math.PI * 2);
                    } else {
                        g.fillStyle = '#4a321e';
                        g.ellipse(0, 0, 0.8, 2.2, 0, 0, Math.PI * 2);
                    }
                    g.fill();
                    g.restore();
                }
                // Mùa xuân: bụi cỏ nở hoa ở ngọn lá cao nhất
                if (look.flowers && !tpl.reed && bi === 0 && row % 3 === 0) {
                    g.fillStyle = ['#d898b0', '#e0d6dc', '#d6c070', '#b48cc0'][row % 4];
                    g.beginPath();
                    g.arc(bx + bend, tipY, 1, 0, Math.PI * 2);
                    g.fill();
                }
            });
        }
    });
    tuftAtlasCache = { key, canvas: c };
    return c;
}

// Vẽ phần nhô lên của bờ ở lớp bầu trời (ground: chân trời, điểm ảnh CSS; clock: đồng hồ của bầu trời). Gió thổi từng
// đợt lướt dọc bờ: tới đâu cả dải cỏ, lau ngả theo tới đó rồi đứng lên; đom đóm lượn quanh bờ cỏ, chớp sáng rồi tắt.
// Mặt nước soi lại lớp bầu trời nên bóng cỏ, đom đóm cũng in xuống nước.
// drop: chiều cao mặt bờ dưới chân trời
export function drawBankSkyline(ctx, cssW, ground, clock, calm, glow, drop) {
    // Kiểu bờ khác (kè gạch, phố cổ, cầu...)
    if (bankStyle) {
        drawStyledSkyline(ctx, cssW, ground, clock, calm, glow, drop);
        return;
    }
    const life = bankLife(cssW, sceneSeason());
    const k = ctx.getTransform().a || 1;
    const still = bankStill(life, cssW, k);
    const atlas = tuftAtlas(life, k);
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.drawImage(still, 0, ground - BANK_STILL_UP, still.width / k, still.height / k);
    const cellW = TUFT_W * k;
    const cellH = TUFT_H * k;
    life.tufts.forEach(tuft => {
        const gust = Math.pow(0.5 + 0.5 * Math.sin(tuft.x * 0.006 - clock * 0.0007), 3);
        const sway = calm ? 0.15 : Math.sin(clock * 0.0017 + tuft.x * 0.03 + tuft.phase) * 0.3 + gust * 1.1
            + Math.sin(clock * 0.0041 + tuft.phase * 3) * 0.1;
        const step = Math.round(Math.min(1, Math.max(0, (sway - TUFT_SWAY[0]) / (TUFT_SWAY[1] - TUFT_SWAY[0]))) * (TUFT_STEPS - 1));
        ctx.drawImage(atlas, step * cellW, tuft.template * cellH, cellW, cellH,
            tuft.x - TUFT_W / 2, ground + tuft.base - (TUFT_H - TUFT_FOOT), TUFT_W, TUFT_H);
    });
    const flyGlow = fireflyGlow();
    ctx.globalCompositeOperation = 'lighter';
    life.flies.forEach(fly => {
        const t = clock * fly.speed + fly.phase;
        const x = (((fly.x + Math.sin(t) * fly.roam + Math.sin(t * 2.3) * 4) % cssW) + cssW) % cssW;
        const y = ground + bankDip(x) - fly.h - Math.sin(t * 1.7) * 3;
        const on = calm ? 0.4 : Math.pow(Math.max(0, Math.sin(clock * fly.rate + fly.phase * 7)), 6);
        if (on < 0.02) return;
        const size = fly.size * 4;
        ctx.globalAlpha = on;
        ctx.drawImage(flyGlow, x - size / 2, y - size / 2, size, size);
    });
    ctx.restore();
}

// Bướm mùa xuân: vài con chập chờn ven bờ, lượn vòng, lúc sà xuống lúc bay lên, cánh vỗ nhanh (dưới ánh trăng nên màu
// dịu: trắng ngà, vàng, cam, xanh nhạt). Vẽ ở lớp bầu trời nên in bóng xuống nước
const BUTTERFLY_COLORS = [['#ded8c8', '#9a9282'], ['#dcc060', '#9a8030'], ['#d89860', '#985a2c'], ['#a4b8dc', '#6478a8']];

export function drawButterflies(ctx, cssW, ground, clock, calm) {
    const n = Math.max(3, Math.round(cssW / 240));
    const base = ctx.getTransform();
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    for (let i = 0; i < n; i++) {
        const t = clock * 0.0003 * (0.7 + hash(i * 3.3) * 0.6) + i * 17;
        const span = 50 + hash(i * 4.1) * 70;
        const x = (((hash(i * 7.9) * cssW + Math.sin(t) * span + Math.sin(t * 2.3 + 1) * 18 + t * 6) % (cssW + 40)) + cssW + 40) % (cssW + 40) - 20;
        const y = ground + bankDip(x) - 8 - hash(i * 5.7) * 34 - Math.sin(t * 1.7) * 9 - Math.abs(Math.sin(t * 6.1)) * 4;
        const dir = Math.cos(t) * span + Math.cos(t * 2.3 + 1) * 41 + 6 >= 0 ? 1 : -1;
        const open = calm ? 0.7 : 0.25 + 0.75 * Math.abs(Math.sin(clock * 0.022 * (0.85 + hash(i * 2.7) * 0.3) + i * 5));
        const size = 5 * (0.85 + hash(i * 9.1) * 0.4);
        const [wing, edge] = BUTTERFLY_COLORS[i % BUTTERFLY_COLORS.length];
        ctx.setTransform(base.a * dir, 0, 0, base.d, base.a * x + base.e, base.d * y + base.f);
        // Cánh trước to, cánh sau nhỏ; nhìn nghiêng nên cánh co lại khi khép
        [[-1, 1], [1, 0.75]].forEach(([side, part]) => {
            const w = size * open * part;
            ctx.fillStyle = edge;
            ctx.beginPath();
            ctx.ellipse(side * w * 0.55, side < 0 ? -size * 0.35 : size * 0.15, w * 0.6 + 0.2, size * 0.55 * part, side * 0.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = wing;
            ctx.beginPath();
            ctx.ellipse(side * w * 0.5, side < 0 ? -size * 0.38 : size * 0.12, w * 0.45 + 0.15, size * 0.42 * part, side * 0.5, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.fillStyle = '#2a241e';
        ctx.fillRect(-0.35, -size * 0.6, 0.7, size * 1.1);
    }
    ctx.restore();
}
