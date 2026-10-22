/*!
 * Trình diễn Pháo hoa – trình phát: cảnh vật (hình sinh vật)
 * Phần bổ sung và chỉnh sửa © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Hình vẽ sinh vật trên mặt nước: vịt trời, cá, cò, ếch, bong bóng nước.

import { hash, sprites } from './util.js';
import { spriteRes } from './water-sprites.js';
import { makeCanvas } from '../utils.js';

// Vịt trời (nhìn nghiêng, quay sang phải): vịt đực đầu xanh cổ khoang trắng, vịt mái nâu lốm đốm. Tư thế: bơi, chổng
// đuôi kiếm ăn, cánh giơ lên, cụp xuống. Mặt nước ở hàng 20 (bơi, chổng đuôi).
export function duckSprite(kind, pose) {
    const S = spriteRes;
    const key = `duck_${kind}_${pose}@${S}`;
    if (sprites[key]) return sprites[key];
    const [c, g] = makeCanvas(40 * S, 28 * S);
    g.scale(S, S);
    const male = kind === 'male';
    const body = male ? '#8e908a' : '#7d6347';
    const wing = male ? '#6c6b66' : '#5f4832';
    const head = male ? '#2f6c4a' : '#7a6046';
    const bill = male ? '#d6c04a' : '#d8873a';
    const blob = (x, y, rx, ry, color, rot = 0) => {
        g.fillStyle = color;
        g.beginPath();
        g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
        g.fill();
    };
    const poly = (points, color) => {
        g.fillStyle = color;
        g.beginPath();
        points.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
        g.closePath();
        g.fill();
    };
    const speculum = (x, y) => {
        g.fillStyle = '#4a6fc0';
        g.fillRect(x, y, 5, 1.2);
    };
    if (pose === 'swim') {
        poly([[8, 16], [2, 12.5], [8.5, 19]], male ? '#2a2a2a' : '#5b4430');
        if (male) blob(4.6, 12.4, 1.2, 1.2, '#2a2a2a');
        blob(18, 17, 11, 5, body);
        if (male) blob(26, 16, 5, 4.6, '#6e3f2a');
        blob(17, 15, 7, 2.8, wing);
        speculum(14, 15.2);
        blob(28, 12.5, 2.6, 3.4, head);
        blob(29.5, 9.5, 4, 3.3, head);
        if (male) {
            g.strokeStyle = '#f2f2ee';
            g.lineWidth = 0.9;
            g.beginPath();
            g.arc(28.2, 13.8, 2.4, Math.PI * 0.15, Math.PI * 0.95);
            g.stroke();
        } else {
            g.fillStyle = 'rgba(40, 26, 14, 0.5)';
            [[12, 18], [16, 19], [21, 18.5], [14, 16.6]].forEach(([x, y]) => g.fillRect(x, y, 2.2, 0.9));
            g.fillStyle = 'rgba(40, 26, 14, 0.6)';
            g.fillRect(27.5, 8.6, 5, 0.9);
        }
        poly([[33, 9.2], [38, 10.4], [33, 11.4]], bill);
        blob(31, 8.6, 0.7, 0.7, '#151515');
    } else if (pose === 'dabble') {
        // Chúc đầu xuống nước kiếm ăn: chỉ còn nửa sau chổng lên
        g.save();
        g.translate(20, 19);
        g.rotate(-0.95);
        blob(0, 0, 9, 4.6, body);
        blob(-1, -1.5, 6, 2.6, wing);
        g.restore();
        poly([[15, 9], [12, 3], [17.5, 8]], male ? '#2a2a2a' : '#5b4430');
        if (male) blob(12.3, 3.4, 1.1, 1.1, '#2a2a2a');
    } else {
        // Bay: cổ vươn thẳng, thân thon
        blob(19, 14, 10, 3.6, body);
        if (male) blob(26, 13.6, 4, 3.4, '#6e3f2a');
        poly([[9.5, 13], [4, 11.5], [4.5, 15.5]], male ? '#2a2a2a' : '#5b4430');
        blob(30.5, 12.6, 3.2, 2.6, head);
        if (male) {
            g.fillStyle = '#f2f2ee';
            g.fillRect(28, 12, 0.9, 2.6);
        }
        poly([[33, 11.8], [37.5, 12.8], [33, 13.8]], bill);
        if (pose === 'up') {
            poly([[15, 13], [24, 13], [18, 1.5], [12.5, 2.5]], wing);
            speculum(15, 8);
        } else {
            poly([[15, 15], [24, 15], [19, 26.5], [13.5, 25.5]], wing);
            speculum(16, 19);
        }
    }
    if (pose === 'swim' || pose === 'dabble') {
        g.globalCompositeOperation = 'destination-in';
        const sink = g.createLinearGradient(0, 0, 0, 28);
        sink.addColorStop(0, 'rgba(0, 0, 0, 1)');
        sink.addColorStop(20 / 28, 'rgba(0, 0, 0, 1)');
        sink.addColorStop(21.5 / 28, 'rgba(0, 0, 0, 0)');
        g.fillStyle = sink;
        g.fillRect(0, 0, 40, 28);
    }
    sprites[key] = c;
    return c;
}

// Các loại cá (nhìn nghiêng, đầu sang phải). Dáng: depth bề cao thân so với dài, top phần lưng trong bề cao (còn lại là
// bụng; mõm nằm ở đó), peak chỗ thân cao nhất (0 mõm - 1 gốc đuôi), stalk cuống đuôi so với chỗ cao nhất, fork đuôi chẻ
// sâu (0-1), dorsal [đầu, cuối, cao] vây lưng, eye [chỗ dọc thân, cao thấp (0 lưng - 1 bụng), bán kính so với dài], rows
// số hàng vảy (0: vảy li ti không thấy, chỉ lấp lánh), mesh độ sẫm viền vảy. Màu: back lưng, side hông, belly bụng, fin
// vây ('r, g, b'), finA độ đục vây, iris tròng mắt, sheen độ bóng (mình ướt hứng ánh sáng).
export const FISH_LOOKS = {
    // Cá mè trắng: thân cao dẹt, bụng sâu, mắt nằm thấp, đuôi chẻ sâu, bạc óng
    silver: { depth: 0.3, top: 0.45, peak: 0.34, stalk: 0.3, fork: 0.75, dorsal: [0.44, 0.54, 0.55], eye: [0.1, 0.62, 0.026], rows: 0,
        back: '#46586a', side: '#b6c3cf', belly: '#eef2f5', fin: '118, 132, 146', finA: 0.7, iris: '#d6cfb2', sheen: 1 },
    // Cá chép: lưng gù, vây lưng dài, vảy to viền sẫm, có râu, vàng đồng
    carp: { depth: 0.34, top: 0.57, peak: 0.37, stalk: 0.36, fork: 0.45, dorsal: [0.34, 0.74, 0.4], eye: [0.11, 0.42, 0.028], rows: 6, mesh: 0.3,
        barbel: true, back: '#5a2a12', side: '#cf7631', belly: '#f1c78e', fin: '190, 88, 38', finA: 0.78, iris: '#caa046', sheen: 0.6 },
    // Cá trắm cỏ: thân dài tròn lẳn, vảy to viền sẫm thành mắt lưới, nâu ô liu
    grass: { depth: 0.24, top: 0.52, peak: 0.33, stalk: 0.4, fork: 0.5, dorsal: [0.42, 0.53, 0.48], eye: [0.1, 0.5, 0.025], rows: 6, mesh: 0.42,
        back: '#2c3622', side: '#85875c', belly: '#d9d3ad', fin: '68, 76, 54', finA: 0.82, iris: '#b9a96a', sheen: 0.5 },
    // Cá con: thon nhỏ, sọc sẫm dọc hông, mắt to
    minnow: { depth: 0.23, top: 0.5, peak: 0.34, stalk: 0.32, fork: 0.65, dorsal: [0.46, 0.56, 0.45], eye: [0.11, 0.48, 0.045], rows: 0, stripe: true,
        back: '#566b7d', side: '#cbd7e1', belly: '#eef2f5', fin: '150, 168, 182', finA: 0.55, iris: '#dcdcd2', sheen: 0.8 }
};

// Cỡ trên màn hình (điểm ảnh CSS ở d = 0, con cỡ vừa), grow: con nhỏ nhất - to nhất so với cỡ vừa; thời gian một cú nhảy,
// độ cao, quãng xa (con cỡ vừa)
export const FISH_TYPES = {
    silver: { size: 26, grow: [0.6, 1.6], life: [650, 900], lift: [16, 28], reach: [16, 28] },
    carp: { size: 32, grow: [0.6, 1.6], life: [800, 1050], lift: [20, 32], reach: [14, 24] },
    grass: { size: 38, grow: [0.65, 1.7], life: [700, 900], lift: [12, 20], reach: [22, 34] },
    minnow: { size: 11, grow: [0.7, 1.3], life: [340, 460], lift: [6, 11], reach: [10, 16] }
};

// Bề cao thân ở t (0 mõm - 1 gốc đuôi) so với chỗ cao nhất: đầu tròn lên nhanh, thon dần về cuống đuôi, loe ra ở gốc đuôi
function fishDepth(t, look) {
    if (t < look.peak) return Math.pow(Math.sin(Math.PI / 2 * t / look.peak), 0.55);
    const q = Math.min(1, (t - look.peak) / (0.9 - look.peak));
    return look.stalk + (1 - look.stalk) * (0.5 + 0.5 * Math.cos(Math.PI * q)) + Math.max(0, t - 0.9) * 0.8;
}

const lerp2 = (a, b, r) => [a[0] + (b[0] - a[0]) * r, a[1] + (b[1] - a[1]) * r];

const range = (n, fn) => Array.from({ length: n }, (_, i) => fn(i / (n - 1)));

// Nối tiếp các điểm thành đường cong mềm (qua trung điểm từng đoạn)
function smoothTo(ctx, points) {
    for (let i = 0; i < points.length - 1; i++) {
        const [x, y] = points[i];
        ctx.quadraticCurveTo(x, y, (x + points[i + 1][0]) / 2, (y + points[i + 1][1]) / 2);
    }
    ctx.lineTo(...points[points.length - 1]);
}

// Cá nhảy vẽ bằng nét: thân uốn theo cú nhảy, sóng quẫy chạy từ đầu xuống đuôi; vây mỏng thấy tia vây, vảy, nắp mang, mắt
// có ánh; mình ướt hứng ánh sáng, lóe lên và giọt nước lấp lánh khi mình xoay. Gốc ở giữa thân, đầu quay sang phải; L: chiều
// dài (điểm ảnh CSS). pose: bend độ cong thân; phase, amp nhịp, độ quẫy; roll mình xoay (0,4 nghiêng hẳn - 1 nhìn ngang);
// flare vây xòe (0-1); gape há miệng (0-1); seed hạt giống (chỗ giọt nước bám). simple: chỉ dáng, màu (bóng in nước).
export function drawFishBody(ctx, look, L, { bend, phase, amp, roll, flare = 0, gape = 0, seed = 0 }, k, simple = false) {
    const N = 16;
    const alpha = ctx.globalAlpha;
    const thick = look.depth * L * (0.5 + 0.5 * roll);
    // Cỡ thật trên màn hình nhỏ thì bỏ bớt chi tiết không thấy được
    const fine = !simple && L * k > 44;
    const thin = Math.max(0.6 / k, L * 0.006);
    const fin = a => `rgba(${look.fin}, ${a * look.finA})`;
    const spine = [];
    for (let i = 0; i <= N; i++) {
        const t = i / N;
        spine.push([L * (0.5 - t * 0.8), (bend * t * t * 0.3 + amp * (0.06 + t * t) * Math.sin(phase - t * 3.2) * 0.12) * L]);
    }
    // Mép lưng, mép bụng lệch vuông góc với sống lưng (thân uốn thì mép uốn theo); up: hướng lên lưng
    const top = [];
    const bot = [];
    const up = [];
    spine.forEach(([x, y], i) => {
        const [ax, ay] = spine[Math.max(0, i - 1)];
        const [bx, by] = spine[Math.min(N, i + 1)];
        const len = Math.hypot(bx - ax, by - ay);
        const nx = (ay - by) / len;
        const ny = (bx - ax) / len;
        const h = thick * fishDepth(i / N, look);
        up.push([nx, ny]);
        top.push([x + nx * h * look.top, y + ny * h * look.top]);
        bot.push([x - nx * h * (1 - look.top), y - ny * h * (1 - look.top)]);
    });
    // Điểm trên thân: t dọc thân (0 mõm - 1 gốc đuôi), v từ mép lưng (0) xuống mép bụng (1)
    const at = (t, v) => {
        const f = Math.min(N - 1e-6, Math.max(0, t * N));
        const i = f | 0;
        return lerp2(lerp2(top[i], top[i + 1], f - i), lerp2(bot[i], bot[i + 1], f - i), v);
    };
    const upAt = t => up[Math.min(N, Math.round(t * N))];
    const M = fine ? 9 : 5;
    // Vây mỏng: màng hơi trong (đục ở gốc, trong dần ra mép), tia vây sẫm; base, edge: các điểm gốc, mép (cùng số điểm)
    const membrane = (base, edge, a = 1) => {
        const fill = (to, fa) => {
            ctx.fillStyle = fin(fa);
            ctx.beginPath();
            base.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
            smoothTo(ctx, to.slice().reverse());
            ctx.closePath();
            ctx.fill();
        };
        fill(edge, 0.7 * a);
        if (simple) return;
        fill(base.map((p, i) => lerp2(p, edge[i], 0.55)), 0.45 * a);
        if (!fine) return;
        ctx.strokeStyle = `rgba(20, 16, 12, ${0.3 * a})`;
        ctx.lineWidth = thin;
        ctx.beginPath();
        base.forEach(([x, y], i) => {
            ctx.moveTo(x, y);
            ctx.lineTo(...edge[i]);
        });
        ctx.stroke();
    };

    // Vây đuôi chẻ đôi: lệch theo nhịp quẫy, hai thùy uốn lệch nhau
    const [sx, sy] = spine[N];
    const tail = Math.atan2(-up[N][0], up[N][1]) + amp * 0.35 * Math.cos(phase - 3.6);
    const tailPt = (u, w) => [sx + Math.cos(tail) * u - Math.sin(tail) * w, sy + Math.sin(tail) * u + Math.cos(tail) * w];
    const F = L * 0.22;
    const spread = F * (0.6 + 0.1 * flare) * (0.6 + 0.4 * roll);
    const cup = amp * F * 0.12 * Math.sin(phase - 3.9);
    const tipUp = tailPt(F + cup, spread);
    const tipDown = tailPt(F - cup, -spread);
    const notch = tailPt(F * (1 - look.fork * 0.72), 0);
    const cUp = tailPt(F * (0.9 - look.fork * 0.3), spread * 0.4);
    const cDown = tailPt(F * (0.9 - look.fork * 0.3), -spread * 0.4);
    const bez = (a, c, b, s) => lerp2(lerp2(a, c, s), lerp2(c, b, s), s);
    membrane(range(M, s => lerp2(top[N - 1], bot[N - 1], s)),
        range(M, s => (s < 0.5 ? bez(tipUp, cUp, notch, s * 2) : bez(notch, cDown, tipDown, s * 2 - 1))));
    // Vây lưng (cá chép vây dài, cao ở đầu thấp dần), vây hậu môn: vuốt về phía đuôi, xòe ra lúc bay
    const median = (t0, t1, v, height, side) => {
        const base = range(M, s => at(t0 + (t1 - t0) * s, v));
        membrane(base, base.map(([x, y], i) => {
            const s = i / (M - 1);
            const h = height * Math.min(1, s / 0.15) * (1 - 0.62 * s);
            const [nx, ny] = upAt(t0 + (t1 - t0) * s);
            return [x + (nx * side + ny * 0.55) * h, y + (ny * side - nx * 0.55) * h];
        }));
    };
    const [d0, d1, dh] = look.dorsal;
    median(d0, d1, 0.06, thick * dh * (0.75 + 0.35 * flare), 1);
    if (!simple) median(0.72, 0.82, 0.94, thick * 0.34 * (0.8 + 0.3 * flare), -1);
    const outline = () => {
        ctx.beginPath();
        ctx.moveTo(...top[1]);
        smoothTo(ctx, top.slice(1));
        smoothTo(ctx, bot.slice(1).reverse());
        ctx.quadraticCurveTo(spine[0][0] + L * 0.03, spine[0][1], ...top[1]);
    };
    if (simple) {
        // Bóng in nước: thân tô một dải màu lưng - hông - bụng, mắt
        const skin = ctx.createLinearGradient(0, -thick * look.top, 0, thick * (1 - look.top));
        skin.addColorStop(0, look.back);
        skin.addColorStop(0.5, look.side);
        skin.addColorStop(1, look.belly);
        outline();
        ctx.fillStyle = skin;
        ctx.fill();
        ctx.fillStyle = '#0b0b0c';
        ctx.beginPath();
        ctx.arc(...at(look.eye[0], look.eye[1]), Math.max(0.5 / k, L * look.eye[2]), 0, Math.PI * 2);
        ctx.fill();
        return;
    }

    // Thân: lưng sẫm nhạt dần xuống hông, bụng sáng (nhiều dải chồng theo mép thân nên màu uốn theo thân; dải sát mép
    // nối mềm y như đường viền nên không lấn ra ngoài, không phải cắt theo thân)
    const strip = (a, b) => {
        const edge = v => top.slice(1).map((p, i) => lerp2(p, bot[i + 1], v));
        ctx.beginPath();
        ctx.moveTo(...lerp2(top[1], bot[1], a));
        smoothTo(ctx, edge(a));
        smoothTo(ctx, edge(b).reverse());
        ctx.closePath();
    };
    const shade = (color, edge, reach, n) => {
        ctx.fillStyle = color;
        for (let j = 1; j <= n; j++) {
            ctx.globalAlpha = alpha * (0.15 + 0.6 * (n - j) / (n - 1));
            strip(edge, edge + (reach - edge) * j / n);
            ctx.fill();
        }
        ctx.globalAlpha = alpha;
    };
    outline();
    ctx.fillStyle = look.side;
    ctx.fill();
    // Mình xoay nghiêng thì thấy nhiều lưng hơn
    shade(look.back, 0, 0.42 + (1 - roll) * 0.25, fine ? 5 : 2);
    shade(look.belly, 1, 0.6, fine ? 3 : 2);
    if (look.stripe) {
        ctx.fillStyle = 'rgba(30, 40, 52, 0.5)';
        strip(0.4, 0.5);
        ctx.fill();
    }
    if (fine && look.rows) {
        // Vảy: từng hàng so le, viền sau mỗi vảy sẫm (cá trắm thành mắt lưới), mép trước hứng sáng (cá to trên màn hình)
        const step = look.depth / look.rows / 0.8 * 1.1;
        const cells = [];
        for (let j = 0; j < look.rows; j++) {
            const v = (j + 0.5) / look.rows;
            for (let t = 0.26 + (j % 2) * step / 2; t < 0.94; t += step) {
                const [x, y] = at(t, v);
                const [x1, y1] = at(t + 0.01, v);
                const [tx, ty] = at(t, 0);
                const [bx, by] = at(t, 1);
                cells.push([x, y, Math.atan2(y1 - y, x1 - x), Math.hypot(bx - tx, by - ty) / look.rows * 0.55]);
            }
        }
        const scales = shift => {
            ctx.beginPath();
            cells.forEach(([x, y, a, r]) => {
                const cx = x - Math.cos(a) * shift;
                const cy = y - Math.sin(a) * shift;
                ctx.moveTo(cx + Math.cos(a - 1.15) * r, cy + Math.sin(a - 1.15) * r);
                ctx.arc(cx, cy, r, a - 1.15, a + 1.15);
            });
            ctx.stroke();
        };
        ctx.lineWidth = thin;
        ctx.strokeStyle = `rgba(25, 14, 6, ${look.mesh})`;
        scales(0);
        if (L * k > 90) {
            ctx.strokeStyle = 'rgba(255, 238, 205, 0.13)';
            scales(thin * 1.6);
        }
    }
    if (fine) {
        // Đường bên chạy dọc hông
        ctx.setLineDash([thin * 2, thin * 2.5]);
        ctx.strokeStyle = 'rgba(20, 24, 28, 0.28)';
        ctx.lineWidth = thin;
        ctx.beginPath();
        range(8, s => at(0.25 + s * 0.68, 0.46 + 0.08 * Math.sin(Math.PI * s))).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.stroke();
        ctx.setLineDash([]);
    }
    // Mình ướt: vệt sáng dọc hông trên, lóe lên khi mình xoay tới góc hứng ánh sáng; mép lưng sáng, mép bụng tối
    const flash = Math.exp(-Math.pow((roll - 0.82) / 0.1, 2));
    const glow = look.sheen * (0.14 + 0.45 * flash);
    const sv = 0.2 + (1 - roll) * 0.35;
    const streak = (w, a) => {
        ctx.fillStyle = `rgba(255, 255, 255, ${a})`;
        ctx.beginPath();
        range(8, s => at(0.12 + s * 0.68, sv - w * Math.sin(Math.PI * s))).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        range(8, s => at(0.8 - s * 0.68, sv + w * Math.sin(Math.PI * (1 - s)))).forEach(([x, y]) => ctx.lineTo(x, y));
        ctx.fill();
    };
    streak(0.1, glow * 0.45);
    if (fine) streak(0.035, glow);
    ctx.lineWidth = thin * 1.6;
    ctx.strokeStyle = 'rgba(215, 230, 255, 0.3)';
    ctx.beginPath();
    ctx.moveTo(...top[1]);
    smoothTo(ctx, top.slice(1));
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.beginPath();
    ctx.moveTo(...bot[1]);
    smoothTo(ctx, bot.slice(1));
    ctx.stroke();
    if (fine) {
        // Nắp mang: viền cong sẫm, mép sau hứng sáng; má bóng
        const gill = (dt, color) => {
            ctx.strokeStyle = color;
            ctx.beginPath();
            ctx.moveTo(...at(0.2 + dt, 0.08));
            ctx.quadraticCurveTo(...at(0.28 + dt, 0.55), ...at(0.19 + dt, 0.94));
            ctx.stroke();
        };
        ctx.lineWidth = thin * 1.3;
        gill(0, 'rgba(10, 10, 10, 0.32)');
        gill(0.012, 'rgba(255, 255, 255, 0.16)');
        const [cx, cy] = at(0.13, 0.55);
        const cheek = ctx.createRadialGradient(cx, cy, 0, cx, cy, thick * 0.3);
        cheek.addColorStop(0, `rgba(255, 255, 255, ${0.1 + 0.15 * look.sheen})`);
        cheek.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = cheek;
        ctx.fillRect(cx - thick * 0.3, cy - thick * 0.3, thick * 0.6, thick * 0.6);
        // Giọt nước bám trên mình lấp lánh theo lúc mình xoay
        ctx.fillStyle = '#fff';
        for (let j = 0; j < 9; j++) {
            const twinkle = Math.pow(Math.max(0, Math.sin(roll * 18 + j * 2.4 + phase * 0.3)), 3);
            if (twinkle < 0.05) continue;
            const [x, y] = at(0.18 + hash(seed * 97 + j) * 0.7, 0.12 + hash(seed * 53 + j * 7) * 0.7);
            const r = thin * (0.8 + twinkle);
            ctx.globalAlpha = alpha * 0.75 * twinkle * look.sheen;
            ctx.fillRect(x - r, y - r, r * 2, r * 2);
        }
        ctx.globalAlpha = alpha;
    }

    // Vây bụng, vây ngực (phía gần người xem, che lên thân): quạt nhẹ theo nhịp
    const paired = (t, v, len, angle, a) => {
        const [bx, by] = at(t, v);
        const [nx, ny] = upAt(t);
        const back = Math.atan2(-nx, ny);
        membrane(range(M, s => lerp2([bx, by], at(t + 0.05, v - 0.04), s)), range(M, s => {
            const ang = back - angle - 0.3 + 0.6 * s;
            const l = len * (0.7 + 0.3 * Math.sin(Math.PI * s));
            return [bx + Math.cos(ang) * l, by + Math.sin(ang) * l];
        }), a);
    };
    paired(0.5, 0.94, L * 0.09, 0.3 + 0.08 * Math.sin(phase * 0.8), 0.6);
    paired(0.23, 0.78, L * 0.12, 0.28 + 0.16 * Math.sin(phase * 0.7 + 1) + 0.12 * flare, 0.55);

    // Miệng (há ra lúc bay), râu cá chép, mắt có tròng, con ngươi, ánh lóe
    const tip = [spine[0][0] - L * 0.004, spine[0][1]];
    const corner = at(0.07, look.top + 0.08);
    // Há miệng: hàm dưới trễ xuống, thấy lòng miệng tối
    const jaw = [tip[0] - L * 0.02, tip[1] + gape * thick * 0.2];
    if (gape > 0.05) {
        ctx.fillStyle = '#1e1310';
        ctx.beginPath();
        ctx.moveTo(...tip);
        ctx.lineTo(...corner);
        ctx.lineTo(...jaw);
        ctx.closePath();
        ctx.fill();
    }
    ctx.lineWidth = thin;
    ctx.strokeStyle = 'rgba(20, 12, 8, 0.5)';
    ctx.beginPath();
    ctx.moveTo(...tip);
    ctx.lineTo(...corner);
    ctx.stroke();
    if (gape > 0.05) {
        ctx.strokeStyle = look.belly;
        ctx.lineWidth = thin * 1.3;
        ctx.beginPath();
        ctx.moveTo(...corner);
        ctx.lineTo(...jaw);
        ctx.stroke();
    }
    if (look.barbel && fine) {
        ctx.strokeStyle = fin(1.1);
        ctx.lineWidth = thin * 1.1;
        ctx.beginPath();
        ctx.moveTo(...at(0.035, look.top + 0.12));
        ctx.quadraticCurveTo(tip[0] - L * 0.005, tip[1] + thick * 0.25, tip[0] - L * 0.03, tip[1] + thick * 0.3);
        ctx.moveTo(...at(0.06, look.top + 0.1));
        ctx.quadraticCurveTo(corner[0] - L * 0.005, corner[1] + thick * 0.14, corner[0] - L * 0.02, corner[1] + thick * 0.18);
        ctx.stroke();
    }
    const [ex, ey] = at(look.eye[0], look.eye[1]);
    const er = Math.max(0.5 / k, L * look.eye[2]);
    ctx.fillStyle = 'rgba(12, 12, 14, 0.45)';
    ctx.beginPath();
    ctx.arc(ex, ey, er * 1.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = look.iris;
    ctx.beginPath();
    ctx.arc(ex, ey, er, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0b0b0c';
    ctx.beginPath();
    ctx.arc(ex + er * 0.08, ey, er * 0.62, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.beginPath();
    ctx.arc(ex - er * 0.25, ey - er * 0.3, Math.max(0.3 / k, er * 0.26), 0, Math.PI * 2);
    ctx.fill();
}

// Cò trắng vẽ bằng nét để cử động mềm: cánh vỗ chậm có khớp khuỷu, đầu cánh uốn trễ theo nhịp; cổ chữ S co lại lúc bay,
// vươn cao lúc đứng, rướn ra rình mồi, mổ xuống nước, ngoái ra sau rỉa lông; chân duỗi về sau lúc bay, đưa ra trước lúc
// đáp, bước chậm lúc lội. p: tư thế (xem WaterLife.egretTarget); gốc ở giữa thân, đơn vị u (điểm ảnh CSS), quay sang phải.
const EGRET_NECK = {
    tuck: [8, -7, 7.5, -2.5, 10.5, -4.5, 0.05],
    up: [10, -7, 2.5, -13, 8, -19, 0.12],
    stalk: [11, -5, 14, -9, 17.5, -8, 0.55],
    strike: [12, -2, 18, 2, 21, 9.5, 1.15],
    preen: [7, -12, 1, -12, -3, -6.5, 2.6],
    peck: [9, -4, 13, 1, 12.5, 7.5, 1.35]
};

function egretNeck(p) {
    const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
    let v = mix(EGRET_NECK.tuck, EGRET_NECK.up, p.neck);
    v = mix(v, EGRET_NECK.stalk, p.stalk);
    v = mix(v, EGRET_NECK.strike, p.strike);
    v = mix(v, EGRET_NECK.preen, p.preen);
    v = mix(v, EGRET_NECK.peck, p.peck);
    return { c1x: v[0], c1y: v[1], c2x: v[2], c2y: v[3], hx: v[4] + p.headX, hy: v[5] + p.headY, bill: v[6] + p.headTilt };
}

export function drawEgret(ctx, cx, cy, u, dir, p, k) {
    const white = '#eef0ea';
    const shade = '#c6ccc1';
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(dir * u, u);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const thin = 1 / (k * u);
    const wing = (theta, lag, spread, color, dx) => {
        const len = 21 * spread;
        const ex = dx - 1;
        const ey = -Math.sin(theta) * len * 0.5;
        const tx = dx - 7 * spread;
        const ty = ey - Math.sin(theta + lag) * len * 0.55;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(dx + 3, -1.6);
        ctx.quadraticCurveTo(ex + 3.5, ey - 0.6, tx, ty);
        ctx.quadraticCurveTo(ex - 5, ey * 0.85 + 1, dx - 6, 0.6);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(150, 158, 148, 0.5)';
        ctx.lineWidth = Math.max(thin, 0.5);
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(tx + (ex - 5 - tx) * 0.35, ty + (ey * 0.85 + 1 - ty) * 0.35);
        ctx.stroke();
    };
    const flying = p.fold > 0.03;
    if (flying) wing(p.wing - 0.08, p.lag, p.fold, '#b9bfb4', -1);
    // Chân
    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = Math.max(thin, 1.05);
    if (p.legs === 'stand') {
        const legLen = 11 * (1 - 0.25 * p.crouch);
        [[-1, 1], [0.6, -1]].forEach(([hx, sign]) => {
            const swing = p.walk * Math.sin(p.step) * 2.6 * sign;
            const lift = p.walk * Math.max(0, Math.cos(p.step) * sign) * 1.6;
            const fx = hx + swing;
            const fy = legLen - lift;
            ctx.beginPath();
            ctx.moveTo(hx, 3);
            ctx.lineTo((hx + fx) / 2 - 1.3, 3 + (fy - 3) * 0.45);
            ctx.lineTo(fx, fy);
            ctx.lineTo(fx + 2.4, fy);
            ctx.stroke();
        });
    } else {
        [0, 1].forEach(i => {
            const hx = -2 + i * 0.8;
            ctx.beginPath();
            ctx.moveTo(hx, 2.5);
            ctx.lineTo(hx + Math.cos(p.legA) * 15, 2.5 + Math.sin(p.legA) * 15 + i * 0.6);
            ctx.stroke();
        });
    }
    // Thân, đuôi, lông mao dài trên lưng
    ctx.save();
    ctx.rotate(p.tilt);
    ctx.strokeStyle = 'rgba(236, 239, 232, 0.45)';
    ctx.lineWidth = Math.max(thin, 0.45);
    ctx.beginPath();
    ctx.moveTo(-2, -3);
    ctx.quadraticCurveTo(-10, -3.5, -15, 0.6 + p.breath * 0.6);
    ctx.stroke();
    ctx.fillStyle = white;
    ctx.beginPath();
    ctx.moveTo(-8, 0.5);
    ctx.lineTo(-12.5, 2.4);
    ctx.lineTo(-8, 2.8);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, 0, 8.6, 4.2 + p.breath * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = shade;
    ctx.beginPath();
    ctx.ellipse(-0.6, 1.9, 7, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();
    if (!flying) {
        ctx.strokeStyle = 'rgba(186, 193, 182, 0.9)';
        ctx.lineWidth = Math.max(thin, 0.55);
        ctx.beginPath();
        ctx.moveTo(4.5, -1.5);
        ctx.quadraticCurveTo(-1, -2.6, -8, 1.4);
        ctx.stroke();
    }
    ctx.restore();
    // Cổ chữ S, đầu, mỏ vàng
    const n = egretNeck(p);
    ctx.strokeStyle = white;
    ctx.lineWidth = 2.3;
    ctx.beginPath();
    ctx.moveTo(5, -2);
    ctx.bezierCurveTo(n.c1x, n.c1y, n.c2x, n.c2y, n.hx, n.hy);
    ctx.stroke();
    if (p.gulp > 0.02) {
        // Miếng mồi trôi xuống cổ
        const t = p.gulp;
        const b = (a0, a1, a2, a3) => (1 - t) ** 3 * a0 + 3 * (1 - t) ** 2 * t * a1 + 3 * (1 - t) * t * t * a2 + t ** 3 * a3;
        ctx.fillStyle = white;
        ctx.beginPath();
        ctx.ellipse(b(5, n.c1x, n.c2x, n.hx), b(-2, n.c1y, n.c2y, n.hy), 1.8, 1.6, 0, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.save();
    ctx.translate(n.hx, n.hy);
    ctx.rotate(n.bill);
    ctx.fillStyle = white;
    ctx.beginPath();
    ctx.ellipse(0.4, 0, 2.3, 1.75, 0, 0, Math.PI * 2);
    ctx.fill();
    // Ngoảnh đầu về phía người xem: mỏ ngắn lại
    const billLen = 7.5 * (0.5 + 0.5 * Math.cos(p.turn));
    ctx.fillStyle = '#e2b13a';
    ctx.beginPath();
    ctx.moveTo(1.8, -0.75);
    ctx.lineTo(2 + billLen, 0.1);
    ctx.lineTo(1.8, 0.75);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0.9, -0.9, 0.8, 0.8);
    if (p.prey > 0.05) {
        // Cá nhỏ giãy trong mỏ
        ctx.fillStyle = 'rgb(205, 218, 230)';
        ctx.translate(2 + billLen, 0.3);
        ctx.rotate(Math.sin(p.prey * 60) * 0.6);
        ctx.beginPath();
        ctx.ellipse(0, 0, 2.6, 0.95, 0, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
    if (flying) wing(p.wing, p.lag, p.fold, white, 0.5);
    ctx.restore();
}

// step: nhịp bước chân lúc rình mồi (cộng dồn, không làm mượt); thiếu nó thì chân cò đứng thành NaN, không được vẽ
export const EGRET_POSE = { wing: 0.3, lag: 0, fold: 1, neck: 0, stalk: 0, strike: 0, preen: 0, peck: 0, tilt: 0, legA: Math.PI - 0.1, crouch: 0,
    walk: 0, turn: 0, headX: 0, headY: 0, headTilt: 0, breath: 0, prey: 0, gulp: 0, step: 0 };

// Ếch (đêm trăng): lưng xanh rêu sẫm có đốm, bụng vàng nhạt, mắt lồi tròng vàng có ánh trăng lóe; nhìn nghiêng.
// pose: 'sit' ngồi chồm hổm, chân sau gập (x, y: chỗ chân chạm); 'jump' duỗi dài, chân sau đạp thẳng (x, y: giữa thân,
// angle: hướng bay); 'peek' chỉ đỉnh đầu, đôi mắt nhô khỏi mặt nước (x, y: mặt nước). u: đơn vị cỡ (điểm ảnh CSS);
// sac: túi kêu dưới cằm phồng (0-1); blink: đang nhắm mắt; tongue: lưỡi phóng ra tới điểm (tx, ty) (tọa độ trước khi lật)
const FROG = { back: '#3d5c2f', dark: '#22341b', spot: '#2a3f21', belly: '#a6a674', light: '#7d9a54', eye: '#dcb54a' };

function frogEye(ctx, x, y, r, blink) {
    ctx.fillStyle = FROG.back;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    if (blink) {
        ctx.fillStyle = FROG.dark;
        ctx.fillRect(x - r * 0.7, y - r * 0.1, r * 1.4, r * 0.25);
        return;
    }
    ctx.fillStyle = FROG.eye;
    ctx.beginPath();
    ctx.arc(x + r * 0.1, y, r * 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.ellipse(x + r * 0.15, y, r * 0.48, r * 0.26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.beginPath();
    ctx.arc(x - r * 0.15, y - r * 0.3, r * 0.2, 0, Math.PI * 2);
    ctx.fill();
}

export function drawFrog(ctx, x, y, u, dir, pose, { sac = 0, blink = false, angle = 0, tongue = null } = {}) {
    const ell = (cx, cy, rx, ry, rot, color) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(cx * u, cy * u, rx * u, ry * u, rot, 0, Math.PI * 2);
        ctx.fill();
    };
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(dir, 1);
    if (pose === 'peek') {
        // Đỉnh đầu nổi trên mặt nước (nửa dưới bị nước che), hai mắt lồi, bóng mờ in xuống nước
        ctx.save();
        ctx.beginPath();
        ctx.rect(-4 * u, -4 * u, 8 * u, 4 * u);
        ctx.clip();
        ell(0, 0.3, 2.1, 1, 0, FROG.back);
        ell(0.4, -0.25, 1.3, 0.35, 0, FROG.light);
        frogEye(ctx, -0.75 * u, -0.6 * u, 0.62 * u, blink);
        frogEye(ctx, 0.85 * u, -0.62 * u, 0.62 * u, blink);
        ctx.restore();
        ctx.globalAlpha *= 0.25;
        ell(0, 0.55, 2, 0.5, 0, FROG.dark);
        ctx.restore();
        return;
    }
    if (pose === 'jump') {
        ctx.rotate(angle);
        // Chân sau đạp thẳng ra sau, chân trước chìa ra đón chỗ đáp
        ctx.strokeStyle = FROG.back;
        ctx.lineCap = 'round';
        ctx.lineWidth = 1.1 * u;
        ctx.beginPath();
        ctx.moveTo(-2.4 * u, 0.3 * u);
        ctx.lineTo(-5 * u, 1.1 * u);
        ctx.stroke();
        ctx.lineWidth = 0.65 * u;
        ctx.beginPath();
        ctx.moveTo(-5 * u, 1.1 * u);
        ctx.lineTo(-7.2 * u, 0.5 * u);
        ctx.moveTo(1.8 * u, 0.7 * u);
        ctx.lineTo(3.3 * u, 2 * u);
        ctx.stroke();
        ell(-7.9, 0.4, 1, 0.35, 0.2, FROG.dark);
        ell(0, 0, 3.4, 1.45, 0, FROG.back);
        ell(0.4, 0.6, 2.4, 0.7, 0, FROG.belly);
        ell(-0.4, -0.9, 2.2, 0.4, 0, FROG.light);
        ell(3, -0.3, 1.6, 1.05, 0, FROG.back);
        frogEye(ctx, 3.1 * u, -1.2 * u, 0.7 * u, false);
        ctx.restore();
        return;
    }
    // Ngồi: chân sau gập dưới thân, chân trước chống, đầu ngẩng; lưng hứng ánh trăng, vài đốm sẫm
    ell(-2.4, -0.35, 2.1, 0.45, 0, FROG.dark);
    ell(-2.3, -1.6, 1.9, 1.25, -0.25, FROG.back);
    ell(-0.3, -2.3, 3.1, 1.85, -0.32, FROG.back);
    ell(0.3, -1.5, 2.2, 0.95, -0.32, FROG.belly);
    ell(-0.7, -3.5, 2, 0.45, -0.32, FROG.light);
    ell(-1.4, -2.6, 0.45, 0.3, 0, FROG.spot);
    ell(0.2, -3, 0.4, 0.28, 0, FROG.spot);
    ell(-0.6, -1.9, 0.35, 0.25, 0, FROG.spot);
    ell(2.3, -3.1, 1.75, 1.15, -0.15, FROG.back);
    ctx.strokeStyle = FROG.back;
    ctx.lineCap = 'round';
    ctx.lineWidth = 0.65 * u;
    ctx.beginPath();
    ctx.moveTo(1.3 * u, -2 * u);
    ctx.lineTo(2 * u, -0.25 * u);
    ctx.stroke();
    ell(2.3, -0.15, 0.6, 0.25, 0, FROG.dark);
    ctx.strokeStyle = FROG.dark;
    ctx.lineWidth = 0.18 * u;
    ctx.beginPath();
    ctx.moveTo(3.95 * u, -2.75 * u);
    ctx.quadraticCurveTo(3 * u, -2.45 * u, 1.9 * u, -2.6 * u);
    ctx.stroke();
    // Túi kêu dưới cằm phồng lên xẹp xuống
    if (sac > 0.02) {
        ell(3.1, -2.05, 0.4 + sac * 1.05, 0.35 + sac * 0.85, 0, 'rgba(222, 216, 176, 0.88)');
        ell(2.9 - sac * 0.2, -2.3 - sac * 0.3, 0.25 + sac * 0.3, 0.15 + sac * 0.2, 0, 'rgba(255, 255, 240, 0.55)');
    }
    // Lưỡi phóng ra đớp mồi
    if (tongue) {
        ctx.strokeStyle = '#d0707a';
        ctx.lineWidth = 0.35 * u;
        ctx.beginPath();
        ctx.moveTo(3.9 * u, -2.75 * u);
        ctx.lineTo(tongue[0] * dir, tongue[1]);
        ctx.stroke();
    }
    frogEye(ctx, 2.5 * u, -4.05 * u, 0.8 * u, blink);
    ctx.restore();
}

// Bong bóng nổi trên mặt nước: vòm trong suốt hứng ánh trời, mép sáng, đốm lóe; sắp vỡ thì rung rinh
export function drawBubble(ctx, x, y, r, k, wobble) {
    const rx = r * (1 + wobble * 0.12);
    const ry = r * 0.78 * (1 - wobble * 0.1);
    ctx.fillStyle = 'rgba(150, 178, 220, 0.16)';
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(210, 226, 255, 0.6)';
    ctx.lineWidth = Math.max(0.5 / k, r * 0.12);
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, Math.PI, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.beginPath();
    ctx.arc(x - rx * 0.35, y - ry * 0.55, Math.max(0.4 / k, r * 0.2), 0, Math.PI * 2);
    ctx.fill();
    // Bóng mờ của vòm in xuống nước
    ctx.strokeStyle = 'rgba(190, 210, 245, 0.18)';
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry * 0.6, 0, 0, Math.PI);
    ctx.stroke();
}
