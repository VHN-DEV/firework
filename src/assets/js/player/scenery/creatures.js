/*!
 * Trình diễn Pháo hoa – trình phát: cảnh vật (hình sinh vật)
 * Phần bổ sung và chỉnh sửa © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Hình vẽ sinh vật trên mặt nước: vịt trời, cá, cò, ếch, bong bóng nước.

import { sprites } from './util.js';
import { spriteRes } from './water-sprites.js';

// Vịt trời (nhìn nghiêng, quay sang phải): vịt đực đầu xanh cổ khoang trắng, vịt mái nâu lốm đốm. Tư thế: bơi, chổng
// đuôi kiếm ăn, cánh giơ lên, cụp xuống. Mặt nước ở hàng 20 (bơi, chổng đuôi).
export function duckSprite(kind, pose) {
    const S = spriteRes;
    const key = `duck_${kind}_${pose}@${S}`;
    if (sprites[key]) return sprites[key];
    const c = document.createElement('canvas');
    c.width = 40 * S;
    c.height = 28 * S;
    const g = c.getContext('2d');
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

// Các loại cá: cá mè bạc, cá chép vàng cam, cá trắm xanh rêu, cá con (nhảy cả đàn). Vẽ sẵn gấp đôi cho nét.
export const FISH_LOOKS = {
    silver: { w: 34, h: 16, thick: 0.3, back: '#7f93a6', side: '#e4ecf3', belly: '#a9b8c6', fin: '#9fb0c0', eye: '#1d242c' },
    carp: { w: 40, h: 20, thick: 0.36, back: '#8e3f1c', side: '#e88a38', belly: '#f6cf7a', fin: '#d2602a', eye: '#2a1a10', scales: true, barbel: true },
    grass: { w: 46, h: 16, thick: 0.26, back: '#3e4a30', side: '#8f9670', belly: '#d6d4b4', fin: '#5a6444', eye: '#1c2016' },
    minnow: { w: 18, h: 8, thick: 0.27, back: '#6f8496', side: '#dfe8f0', belly: '#b9c6d2', fin: '#9fb0c0', eye: '#1d242c', stripe: true }
};

// Cỡ trên màn hình (điểm ảnh CSS ở d = 0), thời gian một cú nhảy, độ cao, quãng xa
export const FISH_TYPES = {
    silver: { size: 26, life: [650, 900], lift: [16, 28], reach: [16, 28] },
    carp: { size: 32, life: [800, 1050], lift: [20, 32], reach: [14, 24] },
    grass: { size: 38, life: [700, 900], lift: [12, 20], reach: [22, 34] },
    minnow: { size: 11, life: [340, 460], lift: [6, 11], reach: [10, 16] }
};

// Cá nhảy vẽ bằng nét: thân uốn cong theo cú nhảy, đuôi quẫy (nhanh lúc vừa rời nước), mình hơi xoay nên hông lóe sáng.
// Gốc ở giữa thân, đầu quay sang phải; L: chiều dài (điểm ảnh CSS); bend: độ cong thân; wag: quẫy đuôi (-1..1);
// roll: mình xoay (0,4 nghiêng hẳn - 1 nhìn ngang).
export function drawFishBody(ctx, look, L, bend, wag, roll, k) {
    const N = 10;
    const thick = look.thick * L;
    const top = [];
    const bot = [];
    const spine = [];
    for (let i = 0; i <= N; i++) {
        const t = i / N;
        const x = L * (0.5 - t * 0.8);
        const y = (bend * t * t * 0.3 + wag * Math.pow(t, 2.2) * 0.14) * L;
        const h = thick * Math.pow(Math.sin(Math.PI * (0.12 + 0.82 * t)), 0.7) * (0.5 + 0.5 * roll);
        spine.push([x, y]);
        top.push([x, y - h / 2]);
        bot.push([x, y + h / 2]);
    }
    const [tx, ty] = spine[N];
    const [px, py] = spine[N - 1];
    const ang = Math.atan2(ty - py, tx - px) + wag * 0.35;
    // Vây đuôi chẻ đôi, quẫy theo đuôi
    ctx.fillStyle = look.fin;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(tx + Math.cos(ang - 0.5) * L * 0.2, ty + Math.sin(ang - 0.5) * L * 0.2);
    ctx.lineTo(tx + Math.cos(ang) * L * 0.1, ty + Math.sin(ang) * L * 0.1);
    ctx.lineTo(tx + Math.cos(ang + 0.5) * L * 0.2, ty + Math.sin(ang + 0.5) * L * 0.2);
    ctx.closePath();
    ctx.fill();
    // Vây lưng
    const [dx1, dy1] = top[3];
    const [dx2, dy2] = top[5];
    ctx.beginPath();
    ctx.moveTo(dx1, dy1);
    ctx.lineTo((dx1 + dx2) / 2 - L * 0.04, Math.min(dy1, dy2) - thick * 0.45);
    ctx.lineTo(dx2, dy2);
    ctx.closePath();
    ctx.fill();
    // Thân: lưng sẫm, hông sáng, bụng nhạt
    const skin = ctx.createLinearGradient(0, -thick / 2, 0, thick / 2);
    skin.addColorStop(0, look.back);
    skin.addColorStop(0.45, look.side);
    skin.addColorStop(1, look.belly);
    ctx.fillStyle = skin;
    ctx.beginPath();
    top.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.quadraticCurveTo(tx, ty, bot[N][0], bot[N][1]);
    for (let i = N - 1; i >= 0; i--) ctx.lineTo(bot[i][0], bot[i][1]);
    ctx.quadraticCurveTo(L * 0.56, spine[0][1], top[0][0], top[0][1]);
    ctx.fill();
    ctx.lineWidth = Math.max(1 / k, L * 0.02);
    if (look.scales) {
        ctx.strokeStyle = 'rgba(255, 225, 160, 0.35)';
        for (let i = 2; i < N - 2; i += 1.5) {
            const [x, y] = spine[Math.round(i)];
            ctx.beginPath();
            ctx.arc(x, y - thick * 0.08, thick * 0.12, -Math.PI / 2, Math.PI / 2);
            ctx.stroke();
        }
    }
    // Vệt lóe sáng dọc hông khi mình cá xoay
    ctx.strokeStyle = look.stripe ? 'rgba(40, 50, 60, 0.6)' : `rgba(255, 255, 255, ${0.15 + 0.45 * (1 - roll)})`;
    ctx.beginPath();
    spine.slice(1, N - 1).forEach(([x, y], i) => (i ? ctx.lineTo(x, y - thick * 0.05) : ctx.moveTo(x, y - thick * 0.05)));
    ctx.stroke();
    ctx.fillStyle = look.eye;
    ctx.beginPath();
    ctx.arc(L * 0.38, spine[1][1] - thick * 0.12, Math.max(0.5, thick * 0.11), 0, Math.PI * 2);
    ctx.fill();
    if (look.barbel) {
        ctx.strokeStyle = '#b06030';
        ctx.beginPath();
        ctx.moveTo(L * 0.5, thick * 0.12);
        ctx.lineTo(L * 0.56, thick * 0.34);
        ctx.stroke();
    }
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

export const EGRET_POSE = { wing: 0.3, lag: 0, fold: 1, neck: 0, stalk: 0, strike: 0, preen: 0, peck: 0, tilt: 0, legA: Math.PI - 0.1, crouch: 0,
    walk: 0, turn: 0, headX: 0, headY: 0, headTilt: 0, breath: 0, prey: 0, gulp: 0 };

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
