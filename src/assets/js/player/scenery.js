/*!
 * Trình diễn Pháo hoa – trình phát: cảnh vật (mặt nước phản chiếu, đèn trời, khinh khí cầu)
 * Phần bổ sung và chỉnh sửa © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Cảnh vật theo kịch bản:
// - Mặt nước: đường chân trời (điểm phóng pháo) nâng lên 1/3 hoặc nửa màn hình; phần dưới là mặt nước phản chiếu
//   bầu trời (pháo, khói, trang trí, ảnh nền) lật ngược, gợn sóng, mờ dần theo độ sâu.
// - Bầu trời đêm: sao lấp lánh, mặt trăng đúng pha (theo ngày xem hoặc tự chọn) trôi chậm theo một cung.
// - Trang trí: đèn trời bay lên chậm, khinh khí cầu trôi ngang, máy bay (chỉ thấy đèn nhấp nháy); đều tự phát sáng
//   (hợp với cách ghép lớp "lighten").
// Cả hai vẽ trên lớp canvas riêng; nhiều thứ được vẽ sẵn một lần thành ảnh nhỏ để mỗi khung hình chỉ cần chép ảnh.

import MyMath from '../MyMath.js';
import { IS_MOBILE } from './env.js';
import { horizon, reduceFlashing, isLowQuality } from './state.js';
import { moonIllumination } from './moon.js';

// Độ phân giải lớp mặt nước so với điểm ảnh CSS khi chất lượng 480p trở xuống (cho nhẹ máy); mức cao hơn thì vẽ nét
// theo mật độ điểm ảnh màn hình như trăng, sao
export const WATER_RESOLUTION = IS_MOBILE ? 0.35 : 0.5;

// ---------------------------------------------------------------------------
// Mặt nước
// ---------------------------------------------------------------------------
const backgroundImages = new Map();

// Ảnh nền đang hiện (CSS background-image) để phản chiếu, cùng vị trí trong khung
// Đọc lại kiểu CSS của ảnh nền tối đa 4 lần mỗi giây (không phải mỗi khung hình)
let backgroundCache = { el: null, at: 0, value: null };
function backgroundOf(el) {
    if (!el) return null;
    const now = performance.now();
    if (backgroundCache.el === el && now - backgroundCache.at < 250 && (!backgroundCache.value || backgroundCache.value.image.complete)) {
        return backgroundCache.value;
    }
    backgroundCache = { el, at: now, value: readBackground(el) };
    return backgroundCache.value;
}

function readBackground(el) {
    const style = getComputedStyle(el);
    const opacity = parseFloat(style.opacity);
    const match = style.backgroundImage.match(/url\(["']?(.*?)["']?\)/);
    if (!match || opacity < 0.01) return null;
    let image = backgroundImages.get(match[1]);
    if (!image) {
        image = new Image();
        image.src = match[1];
        backgroundImages.set(match[1], image);
    }
    if (!image.complete || !image.naturalWidth) return null;
    const box = el.getBoundingClientRect();
    return { image, opacity, width: box.width, height: box.height };
}

let mirror = null;

// Số giả ngẫu nhiên cố định theo chỉ số (mỗi dải sóng giữ nhịp riêng giữa các khung hình)
const hash = n => {
    const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return v - Math.floor(v);
};

// Hoa đăng: đế hoa sen giấy, nến cháy ở giữa
function floatLanternSprite() {
    if (sprites.floatLantern) return sprites.floatLantern;
    const c = document.createElement('canvas');
    c.width = 48;
    c.height = 40;
    const g = c.getContext('2d');
    const glow = g.createRadialGradient(24, 18, 1, 24, 18, 20);
    glow.addColorStop(0, 'rgba(255, 210, 120, 0.85)');
    glow.addColorStop(1, 'rgba(255, 150, 60, 0)');
    g.fillStyle = glow;
    g.fillRect(0, 0, 48, 40);
    // Cánh sen: ba lớp từ ngoài vào
    [[-15, 0.8, '#ff7fa8'], [-9, 0.95, '#ff9fbf'], [-3, 1, '#ffc6d9']].forEach(([spread, h, color], layer) => {
        g.fillStyle = color;
        [-1, 1].forEach(side => {
            g.beginPath();
            g.moveTo(24, 32);
            g.quadraticCurveTo(24 + side * (spread - 6) * -1, 30 - 10 * h, 24 + side * -spread * 0.6, 22 - layer * 2);
            g.quadraticCurveTo(24 + side * 4, 28, 24, 32);
            g.fill();
        });
    });
    g.fillStyle = '#ffb3cb';
    g.beginPath();
    g.ellipse(24, 32, 14, 4, 0, 0, Math.PI * 2);
    g.fill();
    // Ngọn nến
    g.fillStyle = '#fff3c4';
    g.beginPath();
    g.ellipse(24, 20, 2.2, 4, 0, 0, Math.PI * 2);
    g.fill();
    sprites.floatLantern = c;
    return c;
}

// ---------------------------------------------------------------------------
// Cuộc sống trên mặt nước: khúc gỗ trôi (sông), cò trắng bay xuống đậu lên khúc gỗ hoặc đáp xuống nước, đàn vịt trời
// bơi, lặn kiếm ăn, các loại cá nhảy, vòng sóng cá đớp mồi.
// Tọa độ theo điểm ảnh CSS; vật trên nước dùng x và d (0 mép nước xa, 1 sát người xem): xa thì nhỏ và trôi chậm.
// ---------------------------------------------------------------------------

// Khúc gỗ nhiều dáng: thẳng, có cành gãy, cong vồng, gốc còn rễ, cành khô còn lá. Gỗ nổi chìm chừng một nửa: phần dưới
// mặt nước ngả màu nước và mờ dần, sát mặt nước sẫm ướt. Ảnh ghi wl (hàng mặt nước), top (mặt trên thân, chỗ cò đậu),
// perch (cò đậu được không).
const LOG_KINDS = 5;

function logSprite(variant) {
    const key = 'log' + variant;
    if (sprites[key]) return sprites[key];
    const W = 200;
    const H = 52;
    const wl = 32;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');
    let seed = 11 + variant * 97;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const bark = ['#4a3020', '#3e2a1c', '#55392a', '#463022', '#3d2c20'][variant];
    const lit = ['#6b4a2e', '#5f4330', '#77553a', '#6a4b33', '#5c4634'][variant];
    // Trục thân: [x, tâm y, bán kính]
    const spine = [];
    const from = variant === 3 ? 34 : 8;
    const to = variant === 3 ? 168 : 190;
    for (let i = 0; i <= 24; i++) {
        const t = i / 24;
        const x = from + (to - from) * t;
        let y = 31;
        let r = 11 - t * 1.5;
        if (variant === 1) r = 10 - t;
        if (variant === 2) {
            y = 33 - Math.sin(Math.PI * t) * 9;
            r = 9.5 - t;
        }
        if (variant === 3) r = 15 - t * 5;
        if (variant === 4) {
            y = 31 - Math.sin(Math.PI * t * 0.8) * 2;
            r = 5 - t * 2.6;
        }
        spine.push([x, y, r]);
    }
    const trunk = (inset, color) => {
        g.fillStyle = color;
        g.beginPath();
        spine.forEach(([x, y, r], i) => (i ? g.lineTo(x, y - r + inset) : g.moveTo(x, y - r + inset)));
        for (let i = spine.length - 1; i >= 0; i--) {
            const [x, y, r] = spine[i];
            g.lineTo(x, y + r - inset);
        }
        g.closePath();
        g.fill();
    };
    const limb = (x1, y1, x2, y2, w1, w2, color) => {
        const a = Math.atan2(y2 - y1, x2 - x1) + Math.PI / 2;
        g.fillStyle = color;
        g.beginPath();
        g.moveTo(x1 + Math.cos(a) * w1, y1 + Math.sin(a) * w1);
        g.lineTo(x2 + Math.cos(a) * w2, y2 + Math.sin(a) * w2);
        g.lineTo(x2 - Math.cos(a) * w2, y2 - Math.sin(a) * w2);
        g.lineTo(x1 - Math.cos(a) * w1, y1 - Math.sin(a) * w1);
        g.closePath();
        g.fill();
    };
    // Cành gãy chĩa lên, rễ, nhánh con
    if (variant === 0) limb(60, 22, 46, 3, 3, 1.5, bark);
    if (variant === 1) {
        limb(66, 23, 50, 4, 3.5, 1.6, bark);
        limb(128, 23, 146, 8, 3, 1.4, bark);
        limb(96, 24, 100, 14, 2.2, 1.8, bark);
    }
    if (variant === 3) {
        for (let i = 0; i < 7; i++) {
            const a = Math.PI * (0.55 + i * 0.13);
            limb(38, 31 + rnd() * 6 - 3, 38 + Math.cos(a) * (18 + rnd() * 12), 31 + Math.sin(a) * (14 + rnd() * 10) * (i % 2 ? 1 : -0.8), 2.6, 0.8, bark);
        }
    }
    if (variant === 4) {
        [[40, -1, 14], [82, 1, 18], [120, -1, 12], [150, 1, 10]].forEach(([x, side, len]) => {
            const tipX = x + side * len * 0.5;
            limb(x, 29, tipX, 29 - len, 1.4, 0.5, bark);
            // Vài chiếc lá khô còn bám
            g.fillStyle = ['#5d6a3a', '#6e5a32'][x % 2];
            g.beginPath();
            g.ellipse(tipX, 29 - len, 2.6, 1.3, side * 0.6, 0, Math.PI * 2);
            g.fill();
        });
    }
    trunk(0, bark);
    // Mặt trên hứng sáng (ánh trăng, ánh pháo)
    g.globalAlpha = 0.85;
    g.fillStyle = lit;
    g.beginPath();
    spine.forEach(([x, y, r], i) => (i ? g.lineTo(x, y - r + 1) : g.moveTo(x, y - r + 1)));
    for (let i = spine.length - 1; i >= 0; i--) {
        const [x, y, r] = spine[i];
        g.lineTo(x, y - r * 0.25);
    }
    g.closePath();
    g.fill();
    g.globalAlpha = 1;
    // Vỏ cây: các vết nứt dọc thân, mắt gỗ
    g.strokeStyle = 'rgba(24, 15, 8, 0.55)';
    g.lineWidth = variant === 4 ? 0.8 : 1.6;
    for (let i = 0; i < 9; i++) {
        const p = spine[1 + ((rnd() * (spine.length - 4)) | 0)];
        const len = 12 + rnd() * 26;
        const dy = (rnd() - 0.5) * p[2] * 1.1;
        g.beginPath();
        g.moveTo(p[0], p[1] + dy);
        g.lineTo(Math.min(to - 4, p[0] + len), p[1] + dy + (rnd() - 0.5) * 2);
        g.stroke();
    }
    if (variant !== 4) {
        g.fillStyle = 'rgba(30, 18, 10, 0.7)';
        for (let i = 0; i < 2; i++) {
            const p = spine[4 + ((rnd() * 14) | 0)];
            g.beginPath();
            g.ellipse(p[0], p[1] - p[2] * 0.3, 2.6, 1.6, 0, 0, Math.PI * 2);
            g.fill();
        }
    }
    // Mặt cắt ở đầu khúc gỗ: vân gỗ
    if (variant <= 1 || variant === 3) {
        const [x, y, r] = spine[spine.length - 1];
        g.fillStyle = '#b58a57';
        g.beginPath();
        g.ellipse(x, y, r * 0.55, r, 0, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = '#7d5532';
        g.lineWidth = 1.1;
        [0.7, 0.4].forEach(f => {
            g.beginPath();
            g.ellipse(x, y, r * 0.55 * f, r * f, 0, 0, Math.PI * 2);
            g.stroke();
        });
    }
    // Sát mặt nước: dải ướt sẫm; dưới mặt nước: ngả màu nước, mờ dần theo độ sâu
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = 'rgba(0, 0, 0, 0.38)';
    g.fillRect(0, wl - 4, W, 4);
    g.fillStyle = 'rgba(14, 30, 58, 0.72)';
    g.fillRect(0, wl, W, H - wl);
    g.globalCompositeOperation = 'destination-in';
    const sink = g.createLinearGradient(0, 0, 0, H);
    sink.addColorStop(0, 'rgba(0, 0, 0, 1)');
    sink.addColorStop(wl / H, 'rgba(0, 0, 0, 1)');
    sink.addColorStop(wl / H + 0.02, 'rgba(0, 0, 0, 0.5)');
    sink.addColorStop(1, 'rgba(0, 0, 0, 0)');
    g.fillStyle = sink;
    g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'source-over';
    const mid = spine[12];
    c.wl = wl;
    c.top = mid[1] - mid[2];
    c.perch = variant !== 4;
    sprites[key] = c;
    return c;
}

// Cò trắng (nhìn nghiêng, quay sang phải): cánh giơ lên, cụp xuống, liệng, đứng, bơi
function egretSprite(pose) {
    const key = 'egret_' + pose;
    if (sprites[key]) return sprites[key];
    const c = document.createElement('canvas');
    c.width = 48;
    c.height = 40;
    const g = c.getContext('2d');
    const white = '#e9ece6';
    const shade = '#b9bfb6';
    const beak = (x1, y1, x2, y2) => {
        g.strokeStyle = '#e0b030';
        g.lineWidth = 1.6;
        g.beginPath();
        g.moveTo(x1, y1);
        g.lineTo(x2, y2);
        g.stroke();
    };
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
    if (pose === 'up' || pose === 'down' || pose === 'glide') {
        // Chân duỗi về sau, cổ co lại khi bay
        g.strokeStyle = '#2b2b2b';
        g.lineWidth = 1.4;
        g.beginPath();
        g.moveTo(16, 23);
        g.lineTo(5, 25);
        g.stroke();
        if (pose === 'up') poly([[18, 21], [28, 21], [17, 3], [12, 5]], shade);
        blob(23, 22, 9, 4, white);
        blob(32, 19, 3.4, 3, white);
        beak(35, 19, 43, 21);
        if (pose === 'down') poly([[18, 22], [28, 22], [19, 37], [14, 35]], white);
        if (pose === 'glide') poly([[13, 19], [32, 19], [26, 23], [16, 23]], white);
    } else if (pose === 'stand') {
        g.strokeStyle = '#2b2b2b';
        g.lineWidth = 1.4;
        g.beginPath();
        g.moveTo(21, 27);
        g.lineTo(20, 38);
        g.moveTo(24, 27);
        g.lineTo(25, 38);
        g.stroke();
        blob(22, 23, 8, 5, white, -0.3);
        blob(20, 25, 6, 3, shade, -0.3);
        // Cổ cong chữ S
        g.strokeStyle = white;
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(27, 19);
        g.quadraticCurveTo(31, 14, 28, 10);
        g.quadraticCurveTo(26, 7, 29, 6);
        g.stroke();
        blob(30, 6, 2.6, 2.3, white);
        beak(32, 6, 39, 7);
    } else {
        // Bơi: thân nổi trên mặt nước, cổ vươn lên
        blob(23, 27, 10, 5, white);
        blob(21, 29, 8, 3, shade);
        g.strokeStyle = white;
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(30, 25);
        g.quadraticCurveTo(34, 20, 32, 15);
        g.stroke();
        blob(33, 14, 2.6, 2.3, white);
        beak(35, 14, 42, 15);
        g.globalCompositeOperation = 'destination-in';
        const sink = g.createLinearGradient(0, 0, 0, 40);
        sink.addColorStop(0, 'rgba(0, 0, 0, 1)');
        sink.addColorStop(0.72, 'rgba(0, 0, 0, 1)');
        sink.addColorStop(0.82, 'rgba(0, 0, 0, 0)');
        g.fillStyle = sink;
        g.fillRect(0, 0, 48, 40);
    }
    sprites[key] = c;
    return c;
}

// Vịt trời (nhìn nghiêng, quay sang phải): vịt đực đầu xanh cổ khoang trắng, vịt mái nâu lốm đốm. Tư thế: bơi, chổng
// đuôi kiếm ăn, cánh giơ lên, cụp xuống. Mặt nước ở hàng 20 (bơi, chổng đuôi).
function duckSprite(kind, pose) {
    const key = `duck_${kind}_${pose}`;
    if (sprites[key]) return sprites[key];
    const S = 2;
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
const FISH_LOOKS = {
    silver: { w: 34, h: 16, back: '#7f93a6', side: '#e4ecf3', belly: '#a9b8c6', fin: '#9fb0c0', eye: '#1d242c' },
    carp: { w: 40, h: 20, back: '#8e3f1c', side: '#e88a38', belly: '#f6cf7a', fin: '#d2602a', eye: '#2a1a10', scales: true, barbel: true },
    grass: { w: 46, h: 16, back: '#3e4a30', side: '#8f9670', belly: '#d6d4b4', fin: '#5a6444', eye: '#1c2016' },
    minnow: { w: 18, h: 8, back: '#6f8496', side: '#dfe8f0', belly: '#b9c6d2', fin: '#9fb0c0', eye: '#1d242c', stripe: true }
};

// Cỡ trên màn hình (điểm ảnh CSS ở d = 0), thời gian một cú nhảy, độ cao, quãng xa
const FISH_TYPES = {
    silver: { size: 26, life: [650, 900], lift: [16, 28], reach: [16, 28] },
    carp: { size: 32, life: [800, 1050], lift: [20, 32], reach: [14, 24] },
    grass: { size: 38, life: [700, 900], lift: [12, 20], reach: [22, 34] },
    minnow: { size: 11, life: [340, 460], lift: [6, 11], reach: [10, 16] }
};

function fishSprite(type) {
    const key = 'fish_' + type;
    if (sprites[key]) return sprites[key];
    const look = FISH_LOOKS[type];
    const { w, h } = look;
    const S = 2;
    const c = document.createElement('canvas');
    c.width = w * S;
    c.height = h * S;
    const g = c.getContext('2d');
    g.scale(S, S);
    const cy = h / 2;
    const tail = w * 0.26;
    const rx = (w - tail) / 2 - 0.5;
    const ry = h * 0.3;
    const bx = tail + rx + 0.5;
    // Đuôi, vây lưng
    g.fillStyle = look.fin;
    g.beginPath();
    g.moveTo(tail + 2, cy);
    g.lineTo(1, cy - h * 0.4);
    g.lineTo(tail * 0.45, cy);
    g.lineTo(1, cy + h * 0.4);
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(bx - rx * 0.35, cy - ry * 0.85);
    g.lineTo(bx - rx * 0.05, cy - ry * 1.6);
    g.lineTo(bx + rx * 0.3, cy - ry * 0.85);
    g.closePath();
    g.fill();
    // Thân: lưng sẫm, hông sáng, bụng nhạt
    const skin = g.createLinearGradient(0, cy - ry, 0, cy + ry);
    skin.addColorStop(0, look.back);
    skin.addColorStop(0.45, look.side);
    skin.addColorStop(1, look.belly);
    g.fillStyle = skin;
    g.beginPath();
    g.ellipse(bx, cy, rx, ry, 0, 0, Math.PI * 2);
    g.fill();
    if (look.scales) {
        g.strokeStyle = 'rgba(255, 225, 160, 0.35)';
        g.lineWidth = 0.5;
        for (let i = 0; i < 5; i++) {
            for (let j = 0; j < 2; j++) {
                g.beginPath();
                g.arc(bx - rx * 0.55 + i * rx * 0.28, cy - ry * 0.25 + j * ry * 0.6, 1.4, -Math.PI / 2, Math.PI / 2);
                g.stroke();
            }
        }
    }
    if (look.stripe) {
        g.fillStyle = 'rgba(40, 50, 60, 0.55)';
        g.fillRect(bx - rx * 0.8, cy - 0.4, rx * 1.6, 0.8);
    }
    g.fillStyle = look.eye;
    g.beginPath();
    g.arc(bx + rx * 0.62, cy - ry * 0.2, Math.max(0.7, h * 0.07), 0, Math.PI * 2);
    g.fill();
    if (look.barbel) {
        g.strokeStyle = '#b06030';
        g.lineWidth = 0.5;
        g.beginPath();
        g.moveTo(bx + rx * 0.95, cy + 1);
        g.lineTo(bx + rx + 2.5, cy + 3.5);
        g.stroke();
    }
    sprites[key] = c;
    return c;
}

const rand = (min, max) => min + Math.random() * (max - min);

const WaterLife = {
    key: '',
    logs: [],
    birds: [],
    ducks: [],
    fish: [],
    ripples: [],
    drops: [],
    next: { log: 0, bird: 0, duck: 0, fish: 0, rise: 0 },

    // Trôi theo dòng (điểm ảnh CSS / ms), khớp với các vệt sáng của mặt nước
    flow(d, river) {
        return river ? 0.03 * (0.4 + 1.2 * d) : 0;
    },

    scale(d) {
        return (0.6 + d * 1.1) * (IS_MOBILE ? 0.85 : 1);
    },

    reset(river, cssW) {
        this.logs = [];
        this.birds = [];
        this.ducks = [];
        this.fish = [];
        this.ripples = [];
        this.drops = [];
        const slow = IS_MOBILE ? 1.3 : 1;
        // Mở màn đã có sẵn một khúc gỗ đang trôi, một con cò và một đàn vịt sắp bay tới
        if (river) this.logs.push(this.makeLog(rand(0.18, 0.42) * cssW, rand(0.45, 0.8)));
        this.next = river
            ? { log: rand(9000, 16000) * slow, bird: rand(1500, 3000), duck: rand(5000, 9000), fish: rand(2500, 4500), rise: rand(800, 2000) }
            : { log: Infinity, bird: rand(3000, 6000), duck: rand(2500, 5000), fish: rand(3500, 6000), rise: rand(800, 2000) };
    },

    makeLog(x, d) {
        return { x, d, variant: (Math.random() * LOG_KINDS) | 0, len: rand(95, 135), phase: Math.random() * 6, seed: Math.random(), bird: null };
    },

    // Mặt trên thân gỗ cao hơn mặt nước bao nhiêu (chỗ cò đậu)
    logPerch(log, s) {
        const sprite = logSprite(log.variant);
        return log.len * s * (sprite.wl - sprite.top) / sprite.width;
    },

    surfaceY(d, topCss, depthCss) {
        return topCss + d * depthCss;
    },

    // Vòng sóng lan và tia nước bắn lên tại một điểm trên mặt nước
    splash(x, d, topCss, depthCss, size) {
        const s = this.scale(d);
        const y = this.surfaceY(d, topCss, depthCss);
        this.ripples.push({ x, d, age: 0, life: 1500, r0: 3 * s * size }, { x, d, age: -180, life: 1500, r0: 2 * s * size });
        const count = Math.round(4 + size * 3);
        for (let i = 0; i < count; i++) {
            this.drops.push({ x, y, base: y, vx: rand(-0.04, 0.04) * s, vy: -rand(0.05, 0.11) * s * size, size: rand(1, 1.8) * s });
        }
    },

    // Vòng sóng nhỏ không có tia nước (cá đớp mồi, vịt quạt chân)
    ring(x, d, size, life = 1400, delay = 0) {
        this.ripples.push({ x, d, age: -delay, life, r0: 1.5 * this.scale(d) * size, size });
    },

    // rocks: đá, gò đất giữa dòng (vật trôi, vịt né)
    update(dt, river, cssW, topCss, depthCss, rocks = []) {
        const slow = IS_MOBILE ? 1.3 : 1;
        // Khúc gỗ: trôi vào từ thượng nguồn (bên trái), ra khỏi khung thì bỏ
        this.next.log -= dt;
        if (this.next.log <= 0) {
            this.next.log = rand(10000, 20000) * slow;
            if (this.logs.length < 2) {
                const d = rand(0.3, 0.85);
                const log = this.makeLog(0, d);
                log.x = -log.len * this.scale(d);
                this.logs.push(log);
            }
        }
        this.logs.forEach(log => {
            log.x += this.flow(log.d, river) * 0.9 * dt;
            log.phase += dt * 0.0015;
            const half = log.len * this.scale(log.d) / 2;
            steerAround(log, log.x - half, half, rocks, dt, depthCss);
        });
        this.logs = this.logs.filter(log => log.x - log.len * this.scale(log.d) < cssW + 30);

        // Cò: bay tới khúc gỗ đang trong khung (nếu còn chỗ) hoặc một điểm trên mặt nước
        this.next.bird -= dt;
        if (this.next.bird <= 0) {
            this.next.bird = (river ? rand(7000, 13000) : rand(9000, 16000)) * slow;
            if (this.birds.length < 2) {
                const dir = Math.random() < 0.5 ? 1 : -1;
                const free = this.logs.filter(log => !log.bird && logSprite(log.variant).perch && log.x > cssW * 0.12 && log.x < cssW * 0.62);
                const bird = {
                    state: 'fly', dir, x: dir > 0 ? -24 : cssW + 24, y: topCss * rand(0.25, 0.6),
                    flap: Math.random() * 300, rest: rand(5000, 10000)
                };
                if (free.length && Math.random() < 0.7) {
                    bird.log = free[0];
                    free[0].bird = bird;
                    bird.ox = rand(0.35, 0.65) * free[0].len * this.scale(free[0].d);
                } else {
                    bird.d = rand(0.3, 0.8);
                    bird.tx = rand(0.2, 0.8) * cssW;
                }
                this.birds.push(bird);
            }
        }
        this.birds.forEach(bird => {
            bird.flap += dt;
            if (bird.state === 'fly') {
                const d = bird.log ? bird.log.d : bird.d;
                const s = this.scale(d);
                const tx = bird.log ? bird.log.x - bird.log.len * s + bird.ox : bird.tx;
                const ty = this.surfaceY(d, topCss, depthCss) - (bird.log ? this.logPerch(bird.log, s) : 0);
                if (!bird.log) bird.tx += this.flow(d, river) * 0.6 * dt;
                const dx = tx - bird.x;
                const dy = ty - bird.y;
                const dist = Math.hypot(dx, dy);
                bird.dir = dx >= 0 ? 1 : -1;
                bird.near = dist < 70;
                const step = Math.min(dist, (bird.near ? 0.07 : 0.12) * dt);
                if (dist <= step + 0.5) {
                    bird.state = bird.log ? 'perch' : 'swim';
                    bird.x = tx;
                    bird.y = ty;
                    if (!bird.log) this.splash(bird.x, d, topCss, depthCss, 1);
                } else {
                    bird.x += dx / dist * step;
                    bird.y += dy / dist * step;
                }
            } else if (bird.state === 'perch' || bird.state === 'swim') {
                bird.rest -= dt;
                if (bird.log) {
                    const s = this.scale(bird.log.d);
                    bird.x = bird.log.x - bird.log.len * s + bird.ox;
                    bird.y = this.surfaceY(bird.log.d, topCss, depthCss) - this.logPerch(bird.log, s) + Math.sin(bird.log.phase) * 0.6 * s;
                } else {
                    bird.x += (this.flow(bird.d, river) * 0.6 + bird.dir * 0.004) * dt;
                    steerAround(bird, bird.x, 10 * this.scale(bird.d), rocks, dt, depthCss);
                    bird.y = this.surfaceY(bird.d, topCss, depthCss) + Math.sin(bird.flap * 0.002) * 0.5;
                }
                // Hết giờ nghỉ, hoặc khúc gỗ sắp trôi ra khỏi khung: bay đi
                if (bird.rest <= 0 || bird.x > cssW - 15 || bird.x < 15) {
                    if (!bird.log) this.splash(bird.x, bird.d, topCss, depthCss, 0.7);
                    if (bird.log) bird.log.bird = null;
                    bird.state = 'leave';
                    bird.vx = bird.dir * 0.1;
                    bird.vy = -0.075;
                }
            } else {
                bird.x += bird.vx * dt;
                bird.y += bird.vy * dt;
                bird.vy = Math.max(-0.12, bird.vy - 0.00004 * dt);
            }
        });
        this.birds = this.birds.filter(bird => !(bird.state === 'leave' && (bird.y < -40 || bird.x < -40 || bird.x > cssW + 40)));

        // Vịt trời: cả đàn bay tới, đáp xuống trượt trên nước, bơi quạt chân để lại vệt sóng, thỉnh thoảng chổng đuôi
        // kiếm ăn, rồi chạy trên mặt nước cất cánh bay đi
        this.next.duck -= dt;
        if (this.next.duck <= 0) {
            this.next.duck = (river ? rand(16000, 26000) : rand(12000, 20000)) * slow;
            if (!this.ducks.length) {
                const dir = Math.random() < 0.5 ? 1 : -1;
                const n = 2 + ((Math.random() * 3) | 0);
                const d = rand(0.3, 0.8);
                const tx = rand(0.25, 0.75) * cssW;
                const y0 = topCss * rand(0.2, 0.5);
                for (let i = 0; i < n; i++) {
                    this.ducks.push({
                        kind: i === 0 || Math.random() < 0.5 ? 'male' : 'female',
                        state: 'fly', dir, x: (dir > 0 ? -30 : cssW + 30) - dir * i * rand(14, 22), y: y0 + rand(-8, 8),
                        d: Math.min(0.95, d + rand(-0.06, 0.06)), tx: tx + (i - n / 2) * rand(14, 24), vx: 0, vy: 0,
                        flap: rand(0, 200), seed: Math.random(), stay: rand(14000, 26000), feed: rand(2000, 6000), dive: 0, paddle: rand(0, 900),
                        turn: rand(4000, 9000)
                    });
                }
            }
        }
        this.ducks.forEach(duck => {
            duck.flap += dt;
            const s = this.scale(duck.d);
            const sy = this.surfaceY(duck.d, topCss, depthCss);
            if (duck.state === 'fly') {
                duck.tx += this.flow(duck.d, river) * 0.5 * dt;
                const dx = duck.tx - duck.x;
                const dy = sy - duck.y;
                const dist = Math.hypot(dx, dy);
                duck.dir = dx >= 0 ? 1 : -1;
                const step = Math.min(dist, 0.14 * dt);
                if (dist <= step + 0.5) {
                    duck.state = 'swim';
                    duck.y = sy;
                    duck.vx = duck.dir * 0.05;
                    this.splash(duck.x, duck.d, topCss, depthCss, 0.6);
                } else {
                    duck.x += dx / dist * step;
                    duck.y += dy / dist * step;
                }
            } else if (duck.state === 'swim' || duck.state === 'dabble') {
                duck.stay -= dt;
                duck.turn -= dt;
                if (duck.turn <= 0 || (duck.x < 30 && duck.dir < 0) || (duck.x > cssW - 30 && duck.dir > 0)) {
                    duck.dir = duck.x < 30 ? 1 : duck.x > cssW - 30 ? -1 : -duck.dir;
                    duck.turn = rand(4000, 9000);
                }
                // Lúc đáp trượt nhanh rồi chậm dần về tốc độ bơi; đang chúc đầu kiếm ăn thì đứng yên
                const target = duck.state === 'dabble' ? 0 : duck.dir * 0.011;
                duck.vx += (target - duck.vx) * Math.min(1, dt * 0.0015);
                duck.x += (duck.vx + this.flow(duck.d, river) * 0.5) * dt;
                steerAround(duck, duck.x, 12 * s, rocks, dt, depthCss);
                duck.y = this.surfaceY(duck.d, topCss, depthCss) + Math.sin(duck.flap * 0.004) * 0.3 * s;
                if (duck.state === 'swim') {
                    duck.paddle -= dt;
                    if (duck.paddle <= 0) {
                        duck.paddle = rand(700, 1200);
                        this.ring(duck.x - duck.dir * 5 * s, duck.d, 0.5, 1200);
                    }
                    duck.feed -= dt;
                    if (duck.feed <= 0) {
                        duck.state = 'dabble';
                        duck.dive = rand(900, 1700);
                        this.ring(duck.x, duck.d, 0.7, 1300);
                    }
                } else {
                    duck.dive -= dt;
                    if (duck.dive <= 0) {
                        duck.state = 'swim';
                        duck.feed = rand(3000, 7000);
                        this.ring(duck.x, duck.d, 0.6, 1300);
                    }
                }
                if (duck.stay <= 0 && duck.state === 'swim') {
                    duck.state = 'leave';
                    duck.vx = duck.dir * 0.11;
                    duck.vy = -0.04;
                    this.splash(duck.x, duck.d, topCss, depthCss, 0.6);
                }
            } else {
                duck.x += duck.vx * dt;
                duck.y += duck.vy * dt;
                duck.vy = Math.max(-0.1, duck.vy - 0.00005 * dt);
            }
        });
        this.ducks = this.ducks.filter(duck => !(duck.state === 'leave' && (duck.y < -40 || duck.x < -40 || duck.x > cssW + 40)));

        // Cá nhảy: vọt lên khỏi mặt nước theo đường cong rồi lao xuống; cá con nhảy cả đàn, con này nối con kia
        this.next.fish -= dt;
        if (this.next.fish <= 0) {
            this.next.fish = (river ? rand(3000, 7000) : rand(5000, 10000)) * slow;
            const r = Math.random();
            const type = r < 0.35 ? 'silver' : r < 0.6 ? 'carp' : r < 0.75 ? 'grass' : 'minnow';
            const kind = FISH_TYPES[type];
            const d = rand(0.25, 0.9);
            const s = this.scale(d);
            const dir = Math.random() < 0.5 ? -1 : 1;
            let x = rand(0.1, 0.9) * cssW;
            // Không nhảy ngay chỗ có đá, gò đất
            for (let i = 0; i < 5 && rocks.some(r => Math.abs(r.x - x) < r.size * this.scale(r.d) * 0.7 && Math.abs(r.d - d) < 0.15); i++) {
                x = rand(0.1, 0.9) * cssW;
            }
            const count = type === 'minnow' ? 3 + ((Math.random() * 3) | 0) : 1;
            for (let i = 0; i < count; i++) {
                this.fish.push({
                    type, d, x: x + dir * i * rand(5, 9) * s, t: -i * rand(90, 160), started: false,
                    life: rand(...kind.life), h: rand(...kind.lift) * s, dx: dir * rand(...kind.reach) * s
                });
            }
        }
        this.fish.forEach(fish => {
            fish.t += dt;
            fish.x += this.flow(fish.d, river) * dt;
            const size = fish.type === 'minnow' ? 0.4 : fish.type === 'silver' ? 0.8 : 1.1;
            if (fish.t >= 0 && !fish.started) {
                fish.started = true;
                this.splash(fish.x, fish.d, topCss, depthCss, size * 0.9);
            }
            if (fish.t >= fish.life && !fish.done) {
                fish.done = true;
                this.splash(fish.x + fish.dx, fish.d, topCss, depthCss, size);
            }
        });
        this.fish = this.fish.filter(fish => !fish.done);

        // Cá đớp mồi: vòng sóng nhỏ lan ra đây đó trên mặt nước
        this.next.rise -= dt;
        if (this.next.rise <= 0) {
            this.next.rise = rand(1200, 3200) * slow;
            const d = rand(0.15, 0.95);
            const x = rand(0.05, 0.95) * cssW;
            this.ring(x, d, 0.6, 1800);
            this.ring(x, d, 0.4, 1800, 260);
        }

        this.ripples.forEach(r => {
            r.age += dt;
            r.x += this.flow(r.d, river) * dt;
        });
        this.ripples = this.ripples.filter(r => r.age < r.life);
        this.drops.forEach(p => {
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy += 0.00035 * dt;
        });
        this.drops = this.drops.filter(p => p.y <= p.base || p.vy < 0);
    },

    // Vòng sóng (dưới mọi vật). Lớp đã nhân k: tọa độ điểm ảnh CSS.
    drawUnder(ctx, k, topCss, depthCss) {
        ctx.globalCompositeOperation = 'source-over';
        ctx.lineWidth = 1 / k;
        ctx.strokeStyle = 'rgb(205, 222, 255)';
        this.ripples.forEach(r => {
            if (r.age < 0) return;
            const p = r.age / r.life;
            const s = this.scale(r.d);
            const rx = r.r0 + p * 30 * s * (r.size ?? 1);
            ctx.globalAlpha = (1 - p) * 0.5;
            ctx.beginPath();
            ctx.ellipse(r.x, this.surfaceY(r.d, topCss, depthCss), rx, rx * 0.28, 0, 0, Math.PI * 2);
            ctx.stroke();
        });
    },

    // Vật nằm trên mặt nước, để vẽ chung với bèo, đá, hoa đăng... theo tầm xa
    things(ctx, k, topCss, depthCss, time, river) {
        return [
            ...this.logs.map(log => ({ d: log.d, draw: () => this.drawLog(ctx, log, k, topCss, depthCss, time, river) })),
            ...this.birds.filter(b => b.state === 'perch' || b.state === 'swim').map(bird => ({
                d: bird.log ? bird.log.d + 0.0001 : bird.d,
                draw: () => this.drawBird(ctx, bird, bird.log ? 'stand' : 'swim', this.scale(bird.log ? bird.log.d : bird.d))
            })),
            ...this.ducks.filter(duck => duck.state === 'swim' || duck.state === 'dabble').map(duck => ({
                d: duck.d, draw: () => this.drawDuck(ctx, duck, duck.state, this.scale(duck.d), k, time)
            }))
        ];
    },

    // Cá đang nhảy, tia nước, cò và vịt đang bay (trên mọi vật)
    drawOver(ctx, k, topCss, depthCss) {
        this.fish.forEach(fish => {
            if (fish.t < 0) return;
            const p = Math.min(1, fish.t / fish.life);
            const lift = 4 * fish.h * p * (1 - p);
            const x = fish.x + fish.dx * p;
            const y = this.surfaceY(fish.d, topCss, depthCss) - lift;
            const angle = Math.atan2(-4 * fish.h * (1 - 2 * p), fish.dx);
            const s = this.scale(fish.d);
            const img = fishSprite(fish.type);
            const w = FISH_TYPES[fish.type].size * s;
            const h = w * img.height / img.width;
            ctx.save();
            ctx.globalAlpha = 0.95;
            ctx.translate(x, y);
            ctx.rotate(angle);
            ctx.drawImage(img, -w / 2, -h / 2, w, h);
            ctx.restore();
        });
        ctx.fillStyle = 'rgb(225, 236, 255)';
        this.drops.forEach(p => {
            ctx.globalAlpha = 0.8;
            ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        });
        this.birds.forEach(bird => {
            if (bird.state !== 'fly' && bird.state !== 'leave') return;
            const pose = bird.state === 'fly' && bird.near ? 'glide' : Math.floor(bird.flap / 130) % 2 ? 'up' : 'down';
            const d = bird.log ? bird.log.d : bird.d ?? 0.5;
            this.drawBird(ctx, bird, pose, this.scale(d) * 1.05);
        });
        this.ducks.forEach(duck => {
            if (duck.state !== 'fly' && duck.state !== 'leave') return;
            this.drawDuck(ctx, duck, Math.floor(duck.flap / 85) % 2 ? 'up' : 'down', this.scale(duck.d), k);
        });
        ctx.globalAlpha = 1;
    },

    // Khúc gỗ nổi: chìm chừng một nửa, bóng phần nổi in xuống nước, bọt lấp lánh dọc chỗ tiếp nước, gợn quanh thân
    drawLog(ctx, log, k, topCss, depthCss, time, river) {
        const s = this.scale(log.d);
        const sprite = logSprite(log.variant);
        const w = log.len * s;
        const h = w * sprite.height / sprite.width;
        const wlOff = h * sprite.wl / sprite.height;
        const y = this.surfaceY(log.d, topCss, depthCss) + Math.sin(log.phase) * 0.5 * s;
        const left = log.x - w;
        ctx.save();
        ctx.globalAlpha = 0.24;
        ctx.translate(left, y);
        ctx.scale(1, -0.7);
        ctx.drawImage(sprite, 0, 0, sprite.width, sprite.wl, 0, -wlOff, w, wlOff);
        ctx.restore();
        drawFlowMarks(ctx, left + w / 2, y, w * 0.5, s, k, time, log.seed, river, 0.35);
        ctx.save();
        ctx.translate(left + w / 2, y);
        ctx.rotate(Math.sin(log.phase * 0.7) * 0.015);
        ctx.globalAlpha = 0.97;
        ctx.drawImage(sprite, -w / 2, -wlOff, w, h);
        ctx.restore();
        ctx.fillStyle = 'rgb(205, 222, 255)';
        for (let i = 0; i < 6; i++) {
            const fx = left + w * (0.1 + i * 0.15) + Math.sin(time * 0.0017 + i * 1.7 + log.phase) * 2 * s;
            ctx.globalAlpha = 0.18 + 0.2 * (0.5 + 0.5 * Math.sin(time * 0.003 + i * 2.1));
            ctx.fillRect(fx, y - 0.4 * s, (3 + (i % 3) * 2) * s, Math.max(1 / k, 0.7 * s));
        }
    },

    drawDuck(ctx, duck, pose, s, k, time = 0) {
        const sprite = duckSprite(duck.kind, pose);
        const w = 24 * s;
        const h = w * 28 / 40;
        const onWater = pose === 'swim' || pose === 'dabble';
        // Đang bơi: vệt sóng tách ra phía sau theo hướng bơi
        if (pose === 'swim' && Math.abs(duck.vx) > 0.004) {
            drawWakeTrail(ctx, duck.x - Math.sign(duck.vx) * 4 * s, duck.y, 5 * s, s, k, time, duck.seed, -Math.sign(duck.vx), 0.45);
        }
        ctx.save();
        ctx.globalAlpha = 0.95;
        ctx.translate(duck.x, duck.y);
        if (duck.dir < 0) ctx.scale(-1, 1);
        const anchorY = onWater ? 20 / 28 : 0.5;
        ctx.drawImage(sprite, -w / 2, -h * anchorY, w, h);
        if (onWater) {
            ctx.globalAlpha = 0.22;
            ctx.scale(1, -0.7);
            ctx.drawImage(sprite, -w / 2, -h * anchorY, w, h);
        }
        ctx.restore();
    },

    drawBird(ctx, bird, pose, s) {
        const sprite = egretSprite(pose);
        const w = 42 * s;
        const h = w * 40 / 48;
        ctx.save();
        ctx.globalAlpha = 0.95;
        ctx.translate(bird.x, bird.y);
        if (bird.dir < 0) ctx.scale(-1, 1);
        // Gốc vẽ: chân (đứng), mặt nước (bơi), thân (bay)
        const anchorY = pose === 'stand' ? 0.95 : pose === 'swim' ? 0.72 : 0.55;
        ctx.drawImage(sprite, -w / 2, -h * anchorY, w, h);
        // Đang bơi: bóng in mờ xuống nước
        if (pose === 'swim') {
            ctx.globalAlpha = 0.22;
            ctx.scale(1, -0.7);
            ctx.drawImage(sprite, -w / 2, -h * anchorY, w, h);
        }
        ctx.restore();
    }
};

// ---------------------------------------------------------------------------
// Bờ đất ở mép nước và lá bèo
// ---------------------------------------------------------------------------

// Bờ đá kiểu tranh điểm ảnh (như Kingdom Two Crowns): phiến đá be to, bo tròn, xếp hai hàng so le, mép trên sáng, đáy
// tối, khe sẫm (tông đêm); mép trên phủ rêu cỏ, chân bờ có bụi cỏ mọc sát nước. over: phần cỏ nhô lên trên mặt bờ (điểm ảnh của lớp vẽ).
let bankCache = { key: '', canvas: null, over: 0 };

function bankSprite(W, bankPx, k) {
    const key = `${W}_${bankPx}_${k.toFixed(3)}`;
    if (bankCache.key === key) return bankCache;
    const over = Math.max(2, Math.round(5 * k));
    const c = document.createElement('canvas');
    c.width = W;
    c.height = bankPx + over;
    const g = c.getContext('2d');
    let seed = 29;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const p = Math.max(1, Math.round(k));
    const y0 = over;
    g.fillStyle = 'rgb(30, 26, 23)';
    g.fillRect(0, y0, W, bankPx);
    const slab = (x, y, w, h, r) => {
        g.beginPath();
        g.moveTo(x + r, y);
        g.lineTo(x + w - r, y);
        g.quadraticCurveTo(x + w, y, x + w, y + r);
        g.lineTo(x + w, y + h - r);
        g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        g.lineTo(x + r, y + h);
        g.quadraticCurveTo(x, y + h, x, y + h - r);
        g.lineTo(x, y + r);
        g.quadraticCurveTo(x, y, x + r, y);
        g.fill();
    };
    const rowH = bankPx / 2;
    for (let r = 0; r < 2; r++) {
        let x = -rnd() * 14 * k - r * 8 * k;
        while (x < W) {
            const w = (12 + rnd() * 18) * k;
            const tone = 82 + rnd() * 24 - r * 12;
            const sx = Math.round(x + p);
            const sy = Math.round(y0 + r * rowH + p * 0.5);
            const sw = Math.max(p, Math.round(w - 1.5 * p));
            const sh = Math.max(p, Math.round(rowH - p));
            g.fillStyle = `rgb(${(tone + 10) | 0}, ${tone | 0}, ${(tone - 14) | 0})`;
            slab(sx, sy, sw, sh, Math.min(sh / 2, 3 * k));
            g.fillStyle = 'rgba(255, 240, 215, 0.18)';
            g.fillRect(sx + p, sy, Math.max(p, sw - 2 * p), p);
            g.fillStyle = 'rgba(0, 0, 0, 0.28)';
            g.fillRect(sx + p, sy + sh - p, Math.max(p, sw - 2 * p), p);
            // Vài vết lõm, đốm trên mặt đá
            if (rnd() < 0.5) {
                g.fillStyle = 'rgba(30, 24, 20, 0.35)';
                g.fillRect(Math.round(sx + sw * (0.2 + rnd() * 0.5)), Math.round(sy + sh * 0.45), Math.max(p, Math.round(2 * k)), p);
            }
            x += w;
        }
    }
    // Rêu cỏ phủ mép trên, cỏ nhô lên trời
    g.fillStyle = 'rgb(36, 58, 34)';
    g.fillRect(0, y0, W, Math.max(p, Math.round(1.6 * k)));
    g.fillStyle = 'rgb(58, 86, 48)';
    g.fillRect(0, y0, W, p);
    const greens = ['rgb(40, 66, 38)', 'rgb(52, 80, 44)', 'rgb(64, 94, 52)'];
    for (let x = 0; x < W; x += (2 + rnd() * 9) * k) {
        if (rnd() < 0.45) continue;
        const blades = 2 + ((rnd() * 4) | 0);
        for (let b = 0; b < blades; b++) {
            const h = Math.round((1.5 + rnd() * 3.5) * k);
            g.fillStyle = greens[(rnd() * 3) | 0];
            g.fillRect(Math.round(x + b * p * 1.5), y0 - h, p, h + p);
        }
    }
    // Chân bờ: mép ướt sẫm, vài bụi cỏ nước mọc sát mặt nước
    g.fillStyle = 'rgb(16, 14, 14)';
    g.fillRect(0, y0 + bankPx - p, W, p);
    for (let x = rnd() * 80 * k; x < W; x += (60 + rnd() * 110) * k) {
        const width = (10 + rnd() * 16) * k;
        for (let bx = 0; bx < width; bx += p * 1.4) {
            const h = Math.round(bankPx * (0.35 + rnd() * 0.6) * (1 - Math.abs(bx / width - 0.5)));
            g.fillStyle = ['rgb(58, 92, 46)', 'rgb(74, 108, 54)', 'rgb(46, 76, 40)'][(rnd() * 3) | 0];
            g.fillRect(Math.round(x + bx), y0 + bankPx - h, p, h);
        }
    }
    bankCache = { key, canvas: c, over };
    return bankCache;
}

// Lá bèo (lá súng) nằm phẳng trên nước (nhìn chếch nên dẹt), có khe hình nêm; kiểu 3 có hoa súng hồng
function padSprite(variant) {
    const key = 'pad' + variant;
    if (sprites[key]) return sprites[key];
    const S = 3;
    const c = document.createElement('canvas');
    c.width = 24 * S;
    c.height = 10 * S;
    const g = c.getContext('2d');
    g.scale(S, S);
    const notch = [0.3, 1.9, 2.6, 1.1][variant];
    g.beginPath();
    g.ellipse(12, 5, 11, 4.2, 0, notch + 0.35, notch - 0.35 + Math.PI * 2);
    g.lineTo(12, 5);
    g.closePath();
    const leaf = g.createLinearGradient(0, 1, 0, 9);
    leaf.addColorStop(0, ['#3f7a45', '#4a8a4c', '#386e40', '#437f47'][variant]);
    leaf.addColorStop(1, '#1f4a2c');
    g.fillStyle = leaf;
    g.fill();
    g.strokeStyle = 'rgba(150, 200, 130, 0.45)';
    g.lineWidth = 0.6;
    g.beginPath();
    g.ellipse(12, 5, 10.6, 3.9, 0, 0.25, Math.PI - 0.25);
    g.stroke();
    g.strokeStyle = 'rgba(20, 50, 30, 0.6)';
    g.lineWidth = 0.4;
    for (let i = 0; i < 5; i++) {
        const a = notch + 0.9 + i * 1.05;
        g.beginPath();
        g.moveTo(12, 5);
        g.lineTo(12 + Math.cos(a) * 9, 5 + Math.sin(a) * 3.4);
        g.stroke();
    }
    if (variant === 3) {
        [[-2.4, '#e9a3bf'], [2.4, '#e9a3bf'], [0, '#f4c3d6']].forEach(([dx, color]) => {
            g.fillStyle = color;
            g.beginPath();
            g.ellipse(13 + dx, 3.6, 1.8, 2.6, dx * 0.25, 0, Math.PI * 2);
            g.fill();
        });
        g.fillStyle = '#f0d070';
        g.fillRect(12.4, 2.8, 1.2, 1.2);
    }
    sprites[key] = c;
    return c;
}

// Phần chìm dưới nước của ảnh vẽ sẵn (đá, gò đất): sát mặt nước sẫm ướt, dưới nước ngả màu nước, mờ dần
function sinkBelow(g, W, H, wl, keep = 0.5) {
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = 'rgba(0, 0, 0, 0.35)';
    g.fillRect(0, wl - 2.5, W, 2.5);
    g.fillStyle = 'rgba(14, 30, 58, 0.72)';
    g.fillRect(0, wl, W, H - wl);
    g.globalCompositeOperation = 'destination-in';
    const sink = g.createLinearGradient(0, 0, 0, H);
    sink.addColorStop(0, 'rgba(0, 0, 0, 1)');
    sink.addColorStop(wl / H, 'rgba(0, 0, 0, 1)');
    sink.addColorStop(Math.min(1, wl / H + 0.03), `rgba(0, 0, 0, ${keep})`);
    sink.addColorStop(1, 'rgba(0, 0, 0, 0)');
    g.fillStyle = sink;
    g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'source-over';
}

// Cụm đá giữa dòng: vài tảng tròn xám, mặt trên hứng sáng, rêu xanh. Khung 60 x 34, mặt nước ở hàng 24.
function rockSprite(variant) {
    const key = 'rock' + variant;
    if (sprites[key]) return sprites[key];
    const S = 2;
    const W = 60;
    const H = 34;
    const wl = 24;
    const c = document.createElement('canvas');
    c.width = W * S;
    c.height = H * S;
    const g = c.getContext('2d');
    g.scale(S, S);
    const stones = [
        [[30, 22, 15, 12], [16, 25, 9, 7], [45, 25, 10, 8]],
        [[24, 21, 13, 13], [40, 23, 12, 9], [12, 26, 6, 5], [52, 26, 6, 4]],
        [[30, 20, 18, 11], [50, 25, 7, 5]]
    ][variant % 3];
    stones.forEach(([x, y, rx, ry], i) => {
        const tone = ['#7d7262', '#8a7f6d', '#6f6656', '#837866'][i % 4];
        const grad = g.createLinearGradient(0, y - ry, 0, y + ry);
        grad.addColorStop(0, tone);
        grad.addColorStop(1, '#332c24');
        g.fillStyle = grad;
        g.beginPath();
        g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
        g.fill();
        // Mặt trên hứng ánh trăng, ánh pháo
        g.fillStyle = 'rgba(255, 240, 215, 0.2)';
        g.beginPath();
        g.ellipse(x - rx * 0.2, y - ry * 0.55, rx * 0.6, ry * 0.3, 0, 0, Math.PI * 2);
        g.fill();
        // Rêu
        g.fillStyle = 'rgba(70, 110, 60, 0.75)';
        g.beginPath();
        g.ellipse(x + rx * 0.25, y - ry * 0.72, rx * 0.35, ry * 0.16, 0.2, 0, Math.PI * 2);
        g.fill();
        // Vết nứt
        g.strokeStyle = 'rgba(20, 20, 24, 0.5)';
        g.lineWidth = 0.6;
        g.beginPath();
        g.moveTo(x - rx * 0.3, y - ry * 0.3);
        g.lineTo(x - rx * 0.05, y + ry * 0.1);
        g.lineTo(x + rx * 0.1, y + ry * 0.4);
        g.stroke();
    });
    sinkBelow(g, W, H, wl, 0.55);
    c.wl = wl * S;
    sprites[key] = c;
    return c;
}

// Gò đất giữa dòng: doi đất thấp phủ cỏ, mép có lau sậy. Khung 120 x 44, mặt nước ở hàng 34.
function moundSprite(variant) {
    const key = 'mound' + variant;
    if (sprites[key]) return sprites[key];
    const S = 2;
    const W = 120;
    const H = 44;
    const wl = 34;
    const c = document.createElement('canvas');
    c.width = W * S;
    c.height = H * S;
    const g = c.getContext('2d');
    g.scale(S, S);
    let seed = 41 + variant * 13;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const peak = variant ? 20 : 17;
    const earth = g.createLinearGradient(0, peak, 0, wl + 6);
    earth.addColorStop(0, '#5b4a35');
    earth.addColorStop(1, '#2f251b');
    g.fillStyle = earth;
    g.beginPath();
    g.moveTo(3, wl + 4);
    g.bezierCurveTo(18, wl - 6, 34, peak + 2, 58, peak);
    g.bezierCurveTo(80, peak - 1, 100, wl - 8, 117, wl + 4);
    g.closePath();
    g.fill();
    // Đất, sỏi lấm tấm ở sườn
    g.fillStyle = 'rgba(120, 100, 75, 0.35)';
    for (let i = 0; i < 14; i++) g.fillRect(14 + rnd() * 92, wl - 8 + rnd() * 9, 1.4, 1);
    // Cỏ phủ trên đỉnh
    const ridge = x => wl + 4 - (wl + 4 - peak) * Math.pow(Math.sin(Math.PI * (x - 3) / 114), 0.8);
    for (let x = 12; x < 108; x += 1.4) {
        const y = ridge(x);
        const h = 1.5 + rnd() * 4;
        g.fillStyle = ['#3f6a3a', '#4d7c42', '#58884a', '#355a32'][(rnd() * 4) | 0];
        g.fillRect(x, y - h, 1.1, h + 2.5);
    }
    // Lau sậy một bên, bông nâu
    const reedX = variant ? 88 : 24;
    for (let i = 0; i < 6; i++) {
        const x = reedX + i * 2.4 + rnd() * 1.5;
        const top = ridge(x) - 10 - rnd() * 9;
        g.strokeStyle = '#4a6a36';
        g.lineWidth = 0.8;
        g.beginPath();
        g.moveTo(x, ridge(x) + 1);
        g.quadraticCurveTo(x + 1, (top + ridge(x)) / 2, x + (rnd() - 0.3) * 3, top);
        g.stroke();
        if (i % 2 === 0) {
            g.fillStyle = '#6b4a2c';
            g.fillRect(x - 0.6, top + 1, 1.6, 4);
        }
    }
    sinkBelow(g, W, H, wl, 0.45);
    c.wl = wl * S;
    sprites[key] = c;
    return c;
}

// Vệt sóng sau vật: những mảnh vòng sóng nhỏ tách ra từ hai bên đuôi vật, trôi ra sau, nở rộng, dạt dần sang hai bên
// rồi tan; mảnh này chưa tan mảnh khác đã tới, mỗi lượt một dáng (chỗ tách, độ cong, độ dài cung) nên mềm và sống như
// nước thật chứ không cứng như hai nét kẻ. Không lưu trạng thái: mỗi mảnh là một pha thời gian.
// dir: 1 vệt kéo về bên phải (hạ nguồn), -1 bên trái; strength 0-1. Tọa độ điểm ảnh CSS (lớp đã nhân k).
function drawWakeTrail(ctx, x, y, half, s, k, time, seed, dir, strength) {
    const count = Math.round(4 + strength * 8);
    const life = 1600 + 1600 * strength;
    const reach = half * 0.5 + (12 + 40 * strength) * s;
    ctx.lineWidth = Math.max(1 / k, (0.5 + strength * 0.6) * s);
    ctx.strokeStyle = 'rgb(208, 224, 255)';
    for (let i = 0; i < count; i++) {
        const t = time / life + i / count + seed * 7;
        const cycle = Math.floor(t);
        const p = t - cycle;
        const h1 = hash(cycle * 13.7 + i * 3.1 + seed * 91);
        const h2 = hash(cycle * 7.3 + i * 5.9 + seed * 37);
        const side = i % 2 ? 1 : -1;
        const ease = 1 - (1 - p) * (1 - p);
        const cx = x + dir * (half * (0.55 + h1 * 0.35) + reach * ease) + Math.sin(time * 0.0021 + i * 1.7 + seed * 5) * s;
        const cy = y + side * (half * 0.1 + 1 * s + (2.5 + 6 * strength) * s * ease * (0.6 + h1 * 0.8));
        const r = (2 + 4.5 * p + 3.5 * h2) * s * (0.7 + strength * 0.5);
        const span = 0.45 + h2 * 0.8;
        // Cung phía ngoài vệt (mảnh phía xa cong lên, mảnh phía gần cong xuống), hơi ngả về phía sau
        const mid = (side < 0 ? Math.PI * 1.5 : Math.PI * 0.5) - dir * side * 0.45;
        ctx.globalAlpha = Math.min(1, p * 6) * Math.pow(1 - p, 1.2) * (0.3 + 0.4 * strength);
        ctx.beginPath();
        ctx.ellipse(cx, cy, r, r * 0.3, 0, mid - span, mid + span);
        ctx.stroke();
    }
}

// Nước quanh vật trên sông, hồ: vòng sóng lăn tăn lan quanh (vật dập dềnh); sông thì thêm sóng dồn chập chờn ôm phía
// thượng nguồn (bên trái), vệt sóng sau vật trôi về hạ nguồn, bọt lấm tấm sau đá. strength: 1 đá, gò đất; 0,15-0,4 vật
// trôi theo dòng.
function drawFlowMarks(ctx, x, y, half, s, k, time, seed, river, strength) {
    ctx.lineWidth = 1 / k;
    ctx.strokeStyle = 'rgb(205, 222, 255)';
    for (let i = 0; i < 2; i++) {
        const p = (time * (river ? 0.0005 : 0.00032) + seed + i * 0.5) % 1;
        const rx = half * (1.02 + p * (river ? 0.45 : 0.8)) + 2.5 * s;
        ctx.globalAlpha = (1 - p) * (river ? 0.11 : 0.2) * (0.6 + strength * 0.4);
        ctx.beginPath();
        ctx.ellipse(x, y, rx, rx * 0.2 + 1.2 * s, 0, 0, Math.PI * 2);
        ctx.stroke();
    }
    if (!river) return;
    ctx.strokeStyle = 'rgb(225, 236, 255)';
    for (let i = 0; i < 3; i++) {
        const a = Math.PI * (0.78 + i * 0.22) + Math.sin(time * 0.0035 + seed * 7 + i * 2.3) * 0.1;
        const rx = half + (1.2 + Math.sin(time * 0.005 + i + seed * 3) * 0.6) * s;
        ctx.globalAlpha = Math.max(0, 0.1 + 0.14 * Math.sin(time * 0.006 + seed * 9 + i * 2.1)) * (0.4 + strength * 0.6);
        ctx.beginPath();
        ctx.ellipse(x, y, rx, rx * 0.22 + 0.6 * s, 0, a - 0.16, a + 0.16);
        ctx.stroke();
    }
    drawWakeTrail(ctx, x, y, half, s, k, time, seed, 1, strength);
    ctx.lineWidth = 1 / k;
    if (strength > 0.8) {
        ctx.fillStyle = 'rgb(215, 230, 255)';
        for (let i = 0; i < 6; i++) {
            const t = time * 0.00035 * (1 + hash(seed * 31 + i) * 0.6) + hash(seed * 17 + i);
            const p = t % 1;
            const jitter = hash(Math.floor(t) * 5.1 + i + seed * 11) - 0.5;
            const fx = x + half * 0.8 + p * (half * 0.9 + 30 * s);
            const fy = y + jitter * (half * 0.25 + 6 * s) * (0.5 + p);
            ctx.globalAlpha = Math.min(1, p * 5) * (1 - p) * 0.35;
            ctx.fillRect(fx, fy, (1 + hash(i + seed * 3) * 2.5) * s, Math.max(1 / k, 0.6 * s));
        }
    }
}

// Né đá, gò đất: vật đang ở gần (theo chiều ngang) mà cùng tầm xa (d) thì dạt dần ra phía trước hoặc phía sau vật cản
function steerAround(item, x, half, rocks, dt, depthCss) {
    for (const rock of rocks) {
        const rockHalf = rock.size * WaterLife.scale(rock.d) / 2;
        if (Math.abs(rock.x - x) > rockHalf + half + 40) continue;
        const need = rockHalf * 0.5 / depthCss + 0.05;
        const gap = item.d - rock.d;
        if (Math.abs(gap) >= need) continue;
        const side = gap === 0 ? (rock.d > 0.5 ? -1 : 1) : Math.sign(gap);
        item.d = Math.min(0.97, Math.max(0.03, item.d + side * 0.0003 * dt));
    }
}

export const Water = {
    drawn: false,
    frame: 0,
    last: 0,
    flow: 0,
    dashes: [],
    swells: [],
    dashKey: '',
    floats: [],
    floatKey: '',
    plants: [],
    plantKey: '',
    rocks: [],
    rockKey: '',

    // sources: các canvas cùng kích thước khung (vẽ theo điểm ảnh CSS cssW x cssH); background: phần tử ảnh nền;
    // style: 'lake' hồ tĩnh lặng | 'river' sông chảy; floating: '' | 'lanterns' hoa đăng | 'petals' cánh hoa;
    // life: khúc gỗ trôi, cò, vịt trời, cá nhảy; plants: lá bèo; rocks: đá, gò đất giữa dòng
    render(ctx, { sources, background, sky, cssW, cssH, time, style, floating, calm, life, plants, rocks: rocksOn }) {
        const level = horizon();
        const { width: W, height: H } = ctx.canvas;
        if (level >= 1 || !W || !H) {
            if (this.drawn) ctx.clearRect(0, 0, W, H);
            this.drawn = false;
            return;
        }
        // Chất lượng 480p trở xuống: vẽ lại cách một khung hình
        if (isLowQuality && this.drawn && (++this.frame & 1)) return;
        this.drawn = true;

        const k = W / cssW;
        const top = Math.round(level * H);
        const depth = H - top;
        const horizonCss = level * cssH;
        const depthCss = depth / k;
        const fromCss = Math.max(0, horizonCss - depthCss);
        // Bờ đất ở mép nước (kiểu Kingdom Two Crowns): pháo bắn lên từ mặt bờ. Mặt nước bắt đầu dưới chân bờ (surf);
        // ngay dưới đó là bóng của bờ, rồi mới tới bóng bầu trời (reflTop)
        const bankPx = Math.max(2, Math.round(Math.max(8, Math.min(16, cssH * 0.018)) * k));
        const surf = Math.min(H, top + bankPx);
        const reflTop = Math.min(H, surf + bankPx);
        const reflDepth = H - reflTop;
        const waterTopCss = surf / k;
        const waterDepthCss = Math.max(1, (H - surf) / k);

        // 1. Bầu trời ngay trên mặt nước, lật ngược (dải cao bằng phần nước)
        if (!mirror) mirror = document.createElement('canvas');
        if (mirror.width !== W || mirror.height !== depth) {
            mirror.width = W;
            mirror.height = depth;
        }
        const m = mirror.getContext('2d');
        m.setTransform(1, 0, 0, 1, 0, 0);
        m.clearRect(0, 0, W, depth);
        m.setTransform(k, 0, 0, -k, 0, k * horizonCss);
        const bg = backgroundOf(background);
        if (bg) {
            // Ảnh nền đứng trên mép nước: phủ kín phần trời, canh đáy
            const scale = Math.max(bg.width / bg.image.naturalWidth, bg.height / bg.image.naturalHeight);
            const w = bg.image.naturalWidth * scale;
            const h = bg.image.naturalHeight * scale;
            m.globalAlpha = bg.opacity;
            m.drawImage(bg.image, (cssW - w) / 2, horizonCss - h, w, h);
            m.globalAlpha = 1;
        }
        m.globalCompositeOperation = 'lighten';
        sources.forEach(src => {
            if (!src || !src.width) return;
            const sk = src.width / cssW;
            m.drawImage(src, 0, fromCss * sk, src.width, (horizonCss - fromCss) * sk, 0, fromCss, cssW, horizonCss - fromCss);
        });
        m.globalCompositeOperation = 'source-over';

        // 2. Nền nước: xanh đêm, sát chân trời sáng hơn (ánh trời đêm in xuống nước), sáng thêm theo màu pháo
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1;
        ctx.clearRect(0, 0, W, H);
        const tint = `${16 + sky.r * 0.5 | 0}, ${26 + sky.g * 0.5 | 0}, ${46 + sky.b * 0.5 | 0}`;
        const base = ctx.createLinearGradient(0, top, 0, H);
        base.addColorStop(0, `rgb(${tint})`);
        base.addColorStop(0.35, 'rgb(9, 15, 30)');
        base.addColorStop(1, 'rgb(3, 6, 13)');
        ctx.fillStyle = base;
        ctx.fillRect(0, top, W, depth);

        // 3. Bóng phản chiếu kiểu tranh điểm ảnh: mặt nước chia thành từng dải ngang, mỗi dải lệch một nấc theo nhịp
        //    sóng riêng. Sát bờ dải mỏng, lệch ít (gần như gương); càng xa bờ dải càng dày, lệch nhiều, mờ hơn.
        //    Sông thì sóng mạnh hơn và các vệt sáng trôi ngang theo dòng.
        const river = style === 'river';
        const dt = Math.min(50, this.last ? time - this.last : 16);
        this.last = time;
        this.flow += dt * (river ? 0.03 : 0.004);
        // Dải cao khoảng 2-3 điểm ảnh CSS dù lớp vẽ nét hay thưa (cùng dáng sóng, cùng số lần vẽ)
        const strip = Math.max(1, Math.round((IS_MOBILE ? 6 : 4) * k));
        // Ghép kiểu lighten như các lớp trên trang: phần đen (lớp vệt pháo được phủ đen dần) không làm tối mặt nước
        ctx.globalCompositeOperation = 'lighten';
        for (let y = 0, i = 0; y < reflDepth; i++) {
            const d = y / reflDepth;
            const band = Math.max(strip, Math.round((strip + d * (river ? 9 : 5) * k * 2) / strip) * strip);
            const phase = hash(i) * Math.PI * 2;
            const speed = 0.0008 + hash(i + 50) * 0.0016;
            const amp = (river ? 0.6 + d * 9 : 0.2 + d * 3) * k;
            const dx = Math.round((Math.sin(time * speed + phase) + 0.5 * Math.sin(time * speed * 1.7 + phase * 2)) * amp);
            // Khe tối ngang, càng xa bờ càng nhiều: bóng trăng, bóng pháo vỡ thành từng lát
            const gap = hash(i + 99) < 0.1 + d * 0.3 ? 0.35 : 1;
            ctx.globalAlpha = (river ? 0.6 * (1 - d * 0.6) : 0.78 * (1 - d * 0.5)) * gap;
            ctx.drawImage(mirror, 0, y, W, band, dx, reflTop + y, W, band);
            y += band;
        }

        // 4. Ánh sáng in thành vệt dọc xuống nước (trăng, pháo sáng kéo dài như ngoài đời)
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, surf, W, H - surf);
        ctx.clip();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.16;
        ctx.drawImage(mirror, 0, reflTop + Math.round(3 * k));
        ctx.globalAlpha = 0.08;
        ctx.drawImage(mirror, 0, reflTop + Math.round(7 * k));

        // 5. Dải sóng dài mờ trôi chậm (kết cấu mặt nước), rồi vệt sóng ngắn lấp lánh; vệt nào nằm chỗ có ánh pháo thì
        //    sáng rực lên. Gần chân trời vệt nhỏ, dày; gần người xem vệt dài, thưa (phối cảnh).
        this.syncDashes(river, cssW);
        const thin = Math.max(1, Math.round(k));
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = 'rgb(120, 150, 210)';
        this.swells.forEach(swell => {
            const x = (((swell.u * (cssW + 160) + this.flow * (river ? 0.25 + swell.d * 0.8 : 0.12)) % (cssW + 160)) - 80) * k;
            const row = surf + Math.round(swell.d * (H - surf - 1) + Math.sin(time * swell.speed + swell.phase) * 2 * k);
            const len = swell.len * (0.4 + swell.d) * k;
            ctx.globalAlpha = (calm ? 0.07 : 0.04 + 0.05 * (0.5 + 0.5 * Math.sin(time * swell.speed * 1.3 + swell.phase))) * (1 - swell.d * 0.4);
            ctx.fillRect(x, row, len, thin);
        });
        this.dashes.forEach(dash => {
            const x = (((dash.u * (cssW + 40) + this.flow * (river ? 0.4 + dash.d * 1.2 : 0.3)) % (cssW + 40)) - 20) * k;
            const row = surf + Math.round(dash.d * (H - surf - 1));
            const len = Math.max(1, dash.len * (0.5 + dash.d) * k);
            const twinkle = calm ? 0.6 : 0.2 + 0.8 * Math.pow(0.5 + 0.5 * Math.sin(time * dash.speed + dash.phase), 2);
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = twinkle * 0.42 * (1 - dash.d * 0.35);
            ctx.fillStyle = dash.color;
            ctx.fillRect(x, row, len, thin);
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = twinkle;
            ctx.drawImage(mirror, Math.max(0, x), Math.max(0, row - reflTop), len, 1, x, row, len, thin);
        });
        ctx.restore();

        // 6. Bờ đất: bóng của bờ in ngay dưới chân bờ, rồi tới bờ (pháo rọi màu lên bờ)
        const bank = bankSprite(W, bankPx, k);
        ctx.globalCompositeOperation = 'source-over';
        ctx.save();
        ctx.globalAlpha = 0.4;
        ctx.translate(0, surf);
        ctx.scale(1, -1);
        ctx.drawImage(bank.canvas, 0, bank.over, W, bankPx, 0, -bankPx, W, bankPx);
        ctx.restore();
        ctx.globalAlpha = 1;
        ctx.drawImage(bank.canvas, 0, top - bank.over);
        if (sky.r + sky.g + sky.b > 6) {
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = 0.5;
            ctx.fillStyle = `rgb(${sky.r * 0.22 | 0}, ${sky.g * 0.22 | 0}, ${sky.b * 0.22 | 0})`;
            ctx.fillRect(0, top, W, bankPx);
            ctx.globalCompositeOperation = 'source-over';
        }

        // 7. Vật trên mặt nước: lá bèo, hoa đăng, cánh hoa, đá, gò đất, khúc gỗ, cò, vịt. Vẽ chung theo tầm
        //    xa (xa trước, gần sau); quanh mỗi vật mặt nước gợn lên, trên sông nước rẽ qua vật. Vật trôi né đá, gò đất.
        //    Tọa độ điểm ảnh CSS.
        const rocks = this.syncRocks(rocksOn, river, cssW);
        const surfY = d => waterTopCss + d * waterDepthCss;
        const floatScale = d => (0.35 + d * 0.9) * (IS_MOBILE ? 0.85 : 1);
        this.syncPlants(plants, river, cssW);
        this.syncFloats(floating, river);
        // Sông thì trôi theo dòng (xa bờ người xem trôi nhanh hơn); hồ thì gần như đứng yên
        const drift = (item, half, still) => {
            item.u += (river ? item.speed * (0.3 + item.d) : item.speed * still) * dt / cssW;
            if (item.u > 1.06) item.u = -0.06;
            if (item.u < -0.06) item.u = 1.06;
            steerAround(item, item.u * cssW, half, rocks, dt, waterDepthCss);
        };
        this.plants.forEach(item => {
            item.bob += dt * 0.0012;
            drift(item, 12 * floatScale(item.d), 0.02);
        });
        this.floats.forEach(item => {
            item.bob += dt * 0.0015;
            if (item.kind !== 'lantern') item.rot += dt * item.spin;
            drift(item, (item.kind === 'lantern' ? 10 : 3) * floatScale(item.d), 0.08);
        });
        if (life) {
            const key = `${river}_${Math.round(cssW)}_${Math.round(cssH)}_${level}`;
            if (key !== WaterLife.key) {
                WaterLife.key = key;
                WaterLife.reset(river, cssW);
            }
            WaterLife.update(dt, river, cssW, waterTopCss, waterDepthCss, rocks);
        } else if (WaterLife.key) {
            WaterLife.key = '';
        }
        ctx.setTransform(k, 0, 0, k, 0, 0);
        ctx.globalCompositeOperation = 'source-over';
        if (life) WaterLife.drawUnder(ctx, k, waterTopCss, waterDepthCss);
        [
            ...this.plants.map(item => ({
                d: item.d, draw: () => this.drawPlant(ctx, item, item.u * cssW, surfY(item.d) + Math.sin(item.bob) * 0.5, floatScale(item.d), k, time, river)
            })),
            ...this.floats.map(item => ({
                d: item.d, draw: () => this.drawFloat(ctx, item, item.u * cssW, surfY(item.d) + Math.sin(item.bob), floatScale(item.d), k, time, river, calm)
            })),
            ...rocks.map(rock => ({ d: rock.d, draw: () => this.drawRock(ctx, rock, surfY(rock.d), WaterLife.scale(rock.d), k, time, river) })),
            ...(life ? WaterLife.things(ctx, k, waterTopCss, waterDepthCss, time, river) : [])
        ].sort((a, b) => a.d - b.d).forEach(item => item.draw());
        if (life) WaterLife.drawOver(ctx, k, waterTopCss, waterDepthCss);
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
    },

    // Rải lại các vệt sáng khi đổi kiểu nước hoặc cỡ khung
    syncDashes(river, cssW) {
        const key = `${river}_${Math.round(cssW)}`;
        if (key === this.dashKey) return;
        this.dashKey = key;
        const count = Math.round((river ? 230 : 150) * (IS_MOBILE ? 0.6 : 1));
        // Ánh trăng, sao in xuống: phần lớn xanh bạc, thỉnh thoảng một vệt trắng ấm
        const colors = ['rgb(185, 205, 255)', 'rgb(205, 222, 255)', 'rgb(160, 190, 245)', 'rgb(255, 240, 215)'];
        this.dashes = Array.from({ length: count }, () => ({
            u: Math.random(),
            d: Math.pow(Math.random(), 1.2),
            len: MyMath.random(2, 12),
            phase: Math.random() * Math.PI * 2,
            speed: MyMath.random(0.0015, 0.005),
            color: colors[Math.random() < 0.12 ? 3 : (Math.random() * 3) | 0]
        }));
        this.swells = Array.from({ length: Math.round((river ? 70 : 50) * (IS_MOBILE ? 0.6 : 1)) }, () => ({
            u: Math.random(),
            d: Math.pow(Math.random(), 1.1),
            len: MyMath.random(30, 120),
            phase: Math.random() * Math.PI * 2,
            speed: MyMath.random(0.0004, 0.0012)
        }));
    },

    // Lá bèo (lớp đã nhân k, tọa độ điểm ảnh CSS): gợn nước quanh lá
    drawPlant(ctx, item, x, y, s, k, time, river) {
        drawFlowMarks(ctx, x, y, 11 * s, s, k, time, item.seed, river, 0.15);
        ctx.save();
        ctx.translate(x, y);
        if (item.flip) ctx.scale(-1, 1);
        ctx.globalAlpha = 0.95;
        ctx.drawImage(padSprite(item.variant), -12 * s, -5 * s, 24 * s, 10 * s);
        ctx.restore();
    },

    // Hoa đăng (tự phát sáng, ánh nến in xuống nước, gợn nước quanh đế), cánh hoa
    drawFloat(ctx, item, x, y, s, k, time, river, calm) {
        if (item.kind === 'lantern') {
            drawFlowMarks(ctx, x, y + 2 * s, 10 * s, s, k, time, item.seed, river, 0.2);
            const glow = ctx.createRadialGradient(x, y + 6 * s, 0, x, y + 6 * s, 16 * s);
            glow.addColorStop(0, `rgba(255, 180, 90, ${calm ? 0.3 : 0.25 + Math.sin(item.bob * 3) * 0.05})`);
            glow.addColorStop(1, 'rgba(255, 150, 60, 0)');
            ctx.globalAlpha = 1;
            ctx.fillStyle = glow;
            ctx.save();
            ctx.translate(x, y + 6 * s);
            ctx.scale(1, 1.8);
            ctx.translate(-x, -(y + 6 * s));
            ctx.fillRect(x - 16 * s, y + 6 * s - 16 * s, 32 * s, 32 * s);
            ctx.restore();
            ctx.drawImage(floatLanternSprite(), x - 12 * s, y - 14 * s, 24 * s, 20 * s);
        } else {
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(item.rot);
            ctx.globalAlpha = 0.85;
            ctx.fillStyle = item.color;
            ctx.beginPath();
            ctx.ellipse(0, 0, 2.6 * s, 1.5 * s, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    },

    // Đá, gò đất: bóng phần nổi in xuống nước, dòng nước dồn vào rồi rẽ qua
    drawRock(ctx, rock, y, s, k, time, river) {
        const sprite = rock.kind === 'rock' ? rockSprite(rock.variant) : moundSprite(rock.variant);
        const w = rock.size * s;
        const h = w * sprite.height / sprite.width;
        const wlOff = h * sprite.wl / sprite.height;
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.translate(rock.x - w / 2, y);
        ctx.scale(1, -0.75);
        ctx.drawImage(sprite, 0, 0, sprite.width, sprite.wl, 0, -wlOff, w, wlOff);
        ctx.restore();
        drawFlowMarks(ctx, rock.x, y, w * 0.46, s, k, time, rock.seed, river, 1);
        ctx.globalAlpha = 1;
        ctx.drawImage(sprite, rock.x - w / 2, y - wlOff, w, h);
    },

    // Đá, gò đất giữa dòng: rải lại khi bật/tắt, đổi kiểu nước hoặc cỡ khung; cách xa nhau cho vật trôi có lối đi
    syncRocks(on, river, cssW) {
        const key = `${on}_${river}_${Math.round(cssW)}`;
        if (key === this.rockKey) return this.rocks;
        this.rockKey = key;
        this.rocks = [];
        if (!on) return this.rocks;
        const count = river ? 2 + (Math.random() < 0.5 ? 1 : 0) : 1 + (Math.random() < 0.4 ? 1 : 0);
        for (let tries = 0; this.rocks.length < count && tries < 40; tries++) {
            const kind = Math.random() < 0.55 ? 'rock' : 'mound';
            const rock = {
                kind, variant: (Math.random() * (kind === 'rock' ? 3 : 2)) | 0, x: MyMath.random(0.12, 0.88) * cssW,
                d: MyMath.random(0.25, 0.8), size: kind === 'rock' ? MyMath.random(55, 80) : MyMath.random(95, 135), seed: Math.random()
            };
            if (this.rocks.some(o => Math.abs(o.x - rock.x) < cssW * 0.2 && Math.abs(o.d - rock.d) < 0.3)) continue;
            this.rocks.push(rock);
        }
        return this.rocks;
    },

    // Rải lại lá bèo khi bật/tắt, đổi kiểu nước hoặc cỡ khung: hồ thì mọc thành từng đám, sông thì từng nhóm nhỏ trôi
    syncPlants(on, river, cssW) {
        const key = `${on}_${river}_${Math.round(cssW)}`;
        if (key === this.plantKey) return;
        this.plantKey = key;
        this.plants = [];
        if (!on) return;
        const scale = IS_MOBILE ? 0.6 : 1;
        const clusters = Math.max(1, Math.round((river ? 5 : 6) * scale));
        for (let c = 0; c < clusters; c++) {
            const u = Math.random();
            const d = MyMath.random(0.1, 0.85);
            const n = river ? 2 + ((Math.random() * 2) | 0) : 3 + ((Math.random() * 4) | 0);
            for (let i = 0; i < n; i++) {
                this.plants.push({
                    kind: 'pad', variant: Math.random() < 0.2 ? 3 : (Math.random() * 3) | 0, u: u + MyMath.random(-0.04, 0.04),
                    d: Math.min(0.97, Math.max(0.04, d + MyMath.random(-0.08, 0.08))), speed: MyMath.random(0.008, 0.014),
                    bob: Math.random() * 6, flip: Math.random() < 0.5, seed: Math.random()
                });
            }
        }
    },

    syncFloats(kind, river) {
        const key = `${kind}_${river}`;
        if (key === this.floatKey) return;
        this.floatKey = key;
        this.floats = [];
        if (kind === 'lanterns') {
            const count = IS_MOBILE ? 6 : 10;
            for (let i = 0; i < count; i++) {
                this.floats.push({
                    kind: 'lantern', u: Math.random(), d: MyMath.random(0.12, 0.9), speed: MyMath.random(0.012, 0.022), bob: Math.random() * 6,
                    seed: Math.random()
                });
            }
        } else if (kind === 'petals') {
            const count = IS_MOBILE ? 22 : 38;
            const colors = ['#ff9ec4', '#ffc2d8', '#ffffff', '#ffb3c7'];
            for (let i = 0; i < count; i++) {
                this.floats.push({
                    kind: 'petal', u: Math.random(), d: MyMath.random(0.05, 0.95), speed: MyMath.random(0.015, 0.03),
                    bob: Math.random() * 6, rot: Math.random() * Math.PI, spin: MyMath.random(-0.0006, 0.0006),
                    color: colors[(Math.random() * colors.length) | 0]
                });
            }
        }
    }
};

// ---------------------------------------------------------------------------
// Trang trí bầu trời: đèn trời, khinh khí cầu
// ---------------------------------------------------------------------------
const sprites = {};

function lanternSprite() {
    if (sprites.lantern) return sprites.lantern;
    const c = document.createElement('canvas');
    c.width = 48;
    c.height = 64;
    const g = c.getContext('2d');
    // Quầng sáng
    const halo = g.createRadialGradient(24, 34, 2, 24, 34, 26);
    halo.addColorStop(0, 'rgba(255, 170, 70, 0.55)');
    halo.addColorStop(1, 'rgba(255, 120, 30, 0)');
    g.fillStyle = halo;
    g.fillRect(0, 0, 48, 64);
    // Thân đèn: hình thang bo tròn, sáng ở đáy (ngọn lửa)
    const body = g.createLinearGradient(0, 22, 0, 46);
    body.addColorStop(0, '#ff8a2a');
    body.addColorStop(0.7, '#ffc46b');
    body.addColorStop(1, '#fff1c9');
    g.fillStyle = body;
    g.beginPath();
    g.moveTo(17, 22);
    g.quadraticCurveTo(24, 19, 31, 22);
    g.lineTo(33, 44);
    g.quadraticCurveTo(24, 47, 15, 44);
    g.closePath();
    g.fill();
    sprites.lantern = c;
    return c;
}

const BALLOON_SCHEMES = [
    ['#ff5a5a', '#ffd166'],
    ['#4cc9f0', '#f8f9fa'],
    ['#9d4edd', '#ffb703'],
    ['#06d6a0', '#ef476f']
];

function balloonSprite(scheme) {
    const key = 'balloon' + scheme;
    if (sprites[key]) return sprites[key];
    const [a, b] = BALLOON_SCHEMES[scheme % BALLOON_SCHEMES.length];
    const c = document.createElement('canvas');
    c.width = 120;
    c.height = 160;
    const g = c.getContext('2d');
    const envelope = () => {
        g.beginPath();
        g.moveTo(60, 8);
        g.bezierCurveTo(110, 8, 116, 62, 92, 92);
        g.lineTo(70, 114);
        g.lineTo(50, 114);
        g.lineTo(28, 92);
        g.bezierCurveTo(4, 62, 10, 8, 60, 8);
        g.closePath();
    };
    // Múi vải hai màu
    g.save();
    envelope();
    g.clip();
    for (let i = 0; i < 8; i++) {
        g.fillStyle = i % 2 ? a : b;
        g.beginPath();
        g.ellipse(60, 60, Math.abs(56 - i * 14) + 2, 60, 0, 0, Math.PI * 2);
        g.fill();
    }
    // Ánh lửa từ dưới rọi lên, phía trên tối dần
    const light = g.createLinearGradient(0, 8, 0, 114);
    light.addColorStop(0, 'rgba(0, 0, 0, 0.62)');
    light.addColorStop(0.6, 'rgba(0, 0, 0, 0.25)');
    light.addColorStop(1, 'rgba(255, 200, 120, 0.25)');
    g.fillStyle = light;
    g.fillRect(0, 0, 120, 120);
    g.restore();
    // Dây và giỏ
    g.strokeStyle = 'rgba(255, 210, 160, 0.55)';
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(52, 114);
    g.lineTo(54, 132);
    g.moveTo(68, 114);
    g.lineTo(66, 132);
    g.stroke();
    g.fillStyle = '#c98a4b';
    g.fillRect(52, 132, 16, 11);
    sprites[key] = c;
    return c;
}

function burnerGlow() {
    if (sprites.burner) return sprites.burner;
    const c = document.createElement('canvas');
    c.width = c.height = 120;
    const g = c.getContext('2d');
    const glow = g.createRadialGradient(60, 70, 4, 60, 70, 60);
    glow.addColorStop(0, 'rgba(255, 220, 140, 0.9)');
    glow.addColorStop(0.35, 'rgba(255, 150, 60, 0.35)');
    glow.addColorStop(1, 'rgba(255, 120, 40, 0)');
    g.fillStyle = glow;
    g.fillRect(0, 0, 120, 120);
    sprites.burner = c;
    return c;
}

// Mặt trăng: đĩa sáng đúng pha (bên phải sáng khi trăng tròn dần, bên trái khi khuyết dần, như nhìn từ Việt Nam),
// phần tối mờ nhạt (ánh đất), vài vùng biển tối và quầng sáng. Vẽ sẵn theo pha và cỡ.
function moonLitPath(g, r, fraction) {
    // k = 1 lúc trăng mới, -1 lúc trăng tròn: bề rộng đường ranh sáng tối
    const k = Math.cos(fraction * Math.PI * 2);
    g.beginPath();
    g.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, false);
    if (k >= 0) g.ellipse(0, 0, r * k, r, 0, Math.PI / 2, -Math.PI / 2, true);
    else g.ellipse(0, 0, -r * k, r, 0, Math.PI / 2, Math.PI * 1.5, false);
    g.closePath();
}

function moonSprite(fraction, radius, scale) {
    const key = `moon${fraction.toFixed(3)}_${radius.toFixed(1)}_${scale}`;
    if (sprites[key]) return sprites[key];
    Object.keys(sprites).filter(name => name.startsWith('moon')).forEach(name => delete sprites[name]);
    const r = radius * scale;
    const size = Math.ceil(r * 7);
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    const lit = moonIllumination(fraction);
    g.translate(size / 2, size / 2);
    // Quầng sáng, đậm theo phần trăng được chiếu sáng
    const halo = g.createRadialGradient(0, 0, r * 0.9, 0, 0, r * 3.4);
    halo.addColorStop(0, `rgba(255, 248, 225, ${0.22 * lit})`);
    halo.addColorStop(1, 'rgba(255, 248, 225, 0)');
    g.fillStyle = halo;
    g.fillRect(-size / 2, -size / 2, size, size);
    // Phần tối: ánh đất rất mờ (trăng mới gần như không thấy)
    g.fillStyle = 'rgba(120, 128, 150, 0.07)';
    g.beginPath();
    g.arc(0, 0, r, 0, Math.PI * 2);
    g.fill();
    // Phần sáng: đường dẫn dựng trong hệ lật ngang (trăng khuyết dần) rồi cắt theo nó
    g.save();
    if (fraction > 0.5) g.scale(-1, 1);
    moonLitPath(g, r, fraction);
    g.restore();
    g.save();
    g.clip();
    const face = g.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
    face.addColorStop(0, '#fffdf4');
    face.addColorStop(1, '#e6dfc8');
    g.fillStyle = face;
    g.fillRect(-r, -r, r * 2, r * 2);
    // Vùng biển tối: các mảng loang mềm
    [[-0.28, -0.22, 0.34], [0.18, -0.3, 0.26], [0.02, 0.16, 0.36], [-0.36, 0.3, 0.2], [0.38, 0.08, 0.2], [-0.05, -0.02, 0.22]]
        .forEach(([x, y, rr]) => {
            const blot = g.createRadialGradient(x * r, y * r, 0, x * r, y * r, rr * r);
            blot.addColorStop(0, 'rgba(140, 136, 122, 0.3)');
            blot.addColorStop(0.6, 'rgba(140, 136, 122, 0.16)');
            blot.addColorStop(1, 'rgba(140, 136, 122, 0)');
            g.fillStyle = blot;
            g.fillRect(x * r - rr * r, y * r - rr * r, rr * r * 2, rr * r * 2);
        });
    g.restore();
    sprites[key] = c;
    return c;
}

// Máy bay đêm: chỉ thấy đèn. Đèn đỏ, xanh ở hai đầu cánh, đèn đỏ chớp trên thân, đèn trắng chớp đôi ở đầu cánh
function drawPlane(ctx, item, calm) {
    const s = item.scale;
    const dir = item.vx > 0 ? 1 : -1;
    const light = (dx, color, alpha, size) => {
        const x = item.x + dx * s, y = item.y;
        ctx.globalAlpha = alpha * 0.35;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, size * 3 * s, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(x, y, size * s, 0, Math.PI * 2);
        ctx.fill();
    };
    const t = item.t;
    // Đầu cánh trái màu đỏ, phải màu xanh; bay sang trái thì đổi bên
    light(-7 * dir, '#ff4d4d', 0.85, 0.9);
    light(7 * dir, '#4dff88', 0.85, 0.9);
    light(-1.5 * dir, '#ffffff', 0.35, 0.6);
    if (calm) return;
    const beacon = t % 1100 < 120;
    if (beacon) light(0, '#ff3030', 1, 1.2);
    const strobe = t % 1500;
    if (strobe < 60 || (strobe > 160 && strobe < 220)) {
        light(-7 * dir, '#ffffff', 1, 1.3);
        light(7 * dir, '#ffffff', 1, 1.3);
    }
}

const STAR_COLORS = ['255, 255, 255', '210, 225, 255', '255, 240, 215', '190, 210, 255'];

export const Decor = {
    scene: null,
    items: [],
    stars: [],
    moon: null,
    width: 0,
    height: 0,
    clock: 0,
    drawn: false,
    frame: 0,

    // scene: { decor: ['lanterns', 'balloons', 'planes'], stars: '' | 'few' | 'many', moon: { fraction, x, y } | null,
    // background } hoặc null; cssW, cssH: kích thước khung. Đổi cảnh hoặc cỡ khung thì rải lại.
    sync(scene, cssW, cssH) {
        if (scene === this.scene && Math.abs(cssW - this.width) < 2 && Math.abs(cssH - this.height) < 2) return;
        this.scene = scene;
        this.width = cssW;
        this.height = cssH;
        this.items = [];
        this.stars = [];
        this.moon = null;
        if (!scene || !cssW || !cssH) return;
        const decor = scene.decor || [];
        if (decor.includes('lanterns')) {
            const count = IS_MOBILE ? 9 : 16;
            for (let i = 0; i < count; i++) this.items.push(this.lantern(true));
        }
        if (decor.includes('balloons')) {
            const count = IS_MOBILE ? 2 : 3;
            for (let i = 0; i < count; i++) this.items.push(this.balloon(i, count, true));
        }
        if (decor.includes('planes')) this.items.push(this.plane(MyMath.random(1000, 4000)));
        if (scene.stars) {
            const count = { few: IS_MOBILE ? 40 : 70, many: IS_MOBILE ? 90 : 170 }[scene.stars] || 0;
            const ground = this.groundY();
            // Có ảnh nền thành phố: sao chỉ ở phần trời phía trên
            const band = scene.background ? 0.45 : 0.92;
            for (let i = 0; i < count; i++) {
                this.stars.push({
                    x: Math.random() * cssW,
                    y: Math.pow(Math.random(), 1.3) * ground * band,
                    size: Math.random() < 0.08 ? MyMath.random(1.5, 2) : MyMath.random(0.6, 1.4),
                    fill: `rgb(${STAR_COLORS[(Math.random() * STAR_COLORS.length) | 0]})`,
                    alpha: MyMath.random(0.45, 1),
                    twinkle: Math.random() * Math.PI * 2,
                    speed: MyMath.random(0.0015, 0.004)
                });
            }
            this.stars.sort((a, b) => (a.fill < b.fill ? -1 : a.fill > b.fill ? 1 : 0));
        }
        if (scene.moon) {
            const ground = this.groundY();
            this.moon = {
                fraction: scene.moon.fraction,
                x: scene.moon.x / 100 * cssW,
                // Độ cao tính từ đường chân trời (0) tới đỉnh khung (100)
                y: ground * (1 - scene.moon.y / 100),
                radius: MyMath.clamp(Math.min(cssW, ground) * 0.05, 14, 34)
            };
        }
    },

    active() {
        return this.items.length > 0 || this.stars.length > 0 || !!this.moon;
    },

    groundY() {
        return this.height * horizon();
    },

    lantern(initial) {
        // Xa thì nhỏ và bay chậm
        const near = Math.random();
        const ground = this.groundY();
        return {
            type: 'lantern',
            x: MyMath.random(0.04, 0.96) * this.width,
            y: initial ? MyMath.random(0.12, 0.95) * ground : ground + MyMath.random(0, 12),
            size: 5 + near * 7,
            rise: 0.006 + near * 0.012,
            sway: MyMath.random(4, 12),
            phase: Math.random() * Math.PI * 2,
            flicker: Math.random() * Math.PI * 2,
            age: initial ? 5000 : 0
        };
    },

    balloon(index, count, initial) {
        const ground = this.groundY();
        const dir = Math.random() < 0.5 ? -1 : 1;
        const size = (IS_MOBILE ? 34 : 46) + Math.random() * (IS_MOBILE ? 22 : 34);
        return {
            type: 'balloon',
            scheme: (index + Math.floor(Math.random() * 4)) % BALLOON_SCHEMES.length,
            x: initial ? (index + 0.5) / count * this.width + MyMath.random(-40, 40) : (dir > 0 ? -size : this.width + size),
            y: MyMath.random(0.18, 0.5) * ground,
            size,
            vx: dir * MyMath.random(0.008, 0.016),
            bob: Math.random() * Math.PI * 2,
            burn: MyMath.random(1500, 6000),
            burning: 0
        };
    },

    // Máy bay bay ngang trên cao, đợi một lúc (wait, ms) mới xuất hiện
    plane(wait) {
        const dir = Math.random() < 0.5 ? -1 : 1;
        return {
            type: 'plane',
            wait,
            x: dir > 0 ? -20 : this.width + 20,
            y: MyMath.random(0.06, 0.3) * this.groundY(),
            vx: dir * MyMath.random(0.02, 0.035),
            scale: MyMath.random(0.8, 1.25),
            t: Math.random() * 1500
        };
    },

    update(timeStep) {
        if (!this.active()) return;
        this.clock += timeStep;
        const ground = this.groundY();
        this.items.forEach((item, i) => {
            if (item.type === 'lantern') {
                item.age += timeStep;
                item.y -= item.rise * timeStep;
                item.phase += timeStep * 0.0011;
                item.flicker += timeStep * 0.012;
                if (item.y < -20) this.items[i] = this.lantern(false);
            } else if (item.type === 'plane') {
                if (item.wait > 0) {
                    item.wait -= timeStep;
                    return;
                }
                item.t += timeStep;
                item.x += item.vx * timeStep;
                if (item.x < -30 || item.x > this.width + 30) this.items[i] = this.plane(MyMath.random(8000, 22000));
            } else {
                item.x += item.vx * timeStep;
                item.bob += timeStep * 0.0009;
                item.burn -= timeStep;
                if (item.burn <= 0) {
                    item.burning = 1200;
                    item.burn = MyMath.random(3500, 8000);
                }
                item.burning = Math.max(0, item.burning - timeStep);
                if (item.x < -item.size * 2 || item.x > this.width + item.size * 2) {
                    this.items[i] = this.balloon(i, 1, false);
                    this.items[i].y = MyMath.random(0.18, 0.5) * ground;
                }
            }
        });
    },

    // Bầu trời quay rất chậm: trăng trôi theo một cung, sao trôi theo (ít hơn)
    skyDrift() {
        const angle = this.clock / 240000 * Math.PI * 2;
        return { x: Math.sin(angle) * this.width * 0.035, y: (1 - Math.cos(angle)) * this.groundY() * 0.03 };
    },

    render(ctx) {
        const { width: W, height: H } = ctx.canvas;
        if (!this.active()) {
            if (this.drawn) ctx.clearRect(0, 0, W, H);
            this.drawn = false;
            return;
        }
        // Chất lượng 480p trở xuống: sao, trăng, đèn trời trôi rất chậm nên vẽ lại cách một khung hình
        if (isLowQuality && this.drawn && (++this.frame & 1)) return;
        this.drawn = true;
        const k = W / this.width;
        const calm = reduceFlashing();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, W, H);
        ctx.setTransform(k, 0, 0, k, 0, 0);
        const ground = this.groundY();
        const drift = this.skyDrift();

        // Sao: lấp lánh nhẹ, mờ dần sát chân trời. Xếp theo màu nên ít khi phải đổi màu vẽ.
        let fill = '';
        this.stars.forEach(star => {
            const x = (star.x + drift.x * 0.6 + this.width) % this.width;
            const y = star.y + drift.y * 0.6;
            const near = Math.min(1, Math.max(0, (ground - y) / (ground * 0.15)));
            const twinkle = calm ? 0.85 : 0.65 + 0.35 * Math.sin(star.twinkle + this.clock * star.speed);
            ctx.globalAlpha = star.alpha * twinkle * near;
            if (star.fill !== fill) {
                fill = star.fill;
                ctx.fillStyle = fill;
            }
            ctx.fillRect(x - star.size / 2, y - star.size / 2, star.size, star.size);
        });

        if (this.moon) {
            const { fraction, radius } = this.moon;
            const sprite = moonSprite(fraction, radius, k);
            const size = sprite.width / k;
            ctx.globalAlpha = 1;
            ctx.drawImage(sprite, this.moon.x + drift.x - size / 2, this.moon.y + drift.y - size / 2, size, size);
        }

        const lantern = lanternSprite();
        this.items.forEach(item => {
            if (item.type === 'lantern') {
                const x = item.x + Math.sin(item.phase) * item.sway;
                // Hiện dần khi vừa thả, mờ dần khi lên cao
                const fadeIn = Math.min(1, item.age / 1500);
                const fadeTop = Math.min(1, Math.max(0, item.y / (ground * 0.25)));
                const glow = calm ? 0.9 : 0.82 + Math.sin(item.flicker) * 0.1 + Math.sin(item.flicker * 2.7) * 0.05;
                ctx.globalAlpha = Math.max(0, fadeIn * fadeTop * glow);
                const w = item.size * 2.2;
                ctx.drawImage(lantern, x - w / 2, item.y - w * 0.7, w, w * 64 / 48);
            } else if (item.type === 'plane') {
                if (item.wait <= 0) drawPlane(ctx, item, calm);
            } else {
                const y = item.y + Math.sin(item.bob) * 4;
                const w = item.size;
                const h = w * 160 / 120;
                ctx.globalAlpha = 0.9;
                ctx.drawImage(balloonSprite(item.scheme), item.x - w / 2, y - h / 2, w, h);
                // Lửa đốt bừng lên rọi sáng khinh khí cầu
                const burn = calm ? 0.25 : 0.2 + (item.burning > 0 ? Math.sin(item.burning / 1200 * Math.PI) * 0.8 : 0);
                ctx.globalAlpha = burn;
                ctx.drawImage(burnerGlow(), item.x - w / 2, y - h / 2 + h * 0.1, w, w);
            }
        });
        ctx.globalAlpha = 1;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
};
