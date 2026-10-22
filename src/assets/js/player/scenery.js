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
import { horizon, reduceFlashing, isLowQuality, season as sceneSeason, weather as sceneWeather } from './state.js';
import { moonIllumination } from './moon.js';
import { validBankStyle } from './bank-styles.js';

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

// Khúc gỗ nhiều dáng: thẳng, có cành gãy, gỗ trôi bạc màu cong vồng, gốc còn rễ, cành khô còn lá. Thân vẽ từng điểm
// ảnh: đổ bóng theo hình trụ (mặt trên sáng, mặt dưới tối), thớ vỏ chạy dọc thân, vết nứt sâu, rêu xanh loang trên mặt
// trên, rong sẫm sát mép nước. Gỗ nổi chìm chừng một nửa: phần dưới mặt nước ngả màu nước, mờ dần. Ảnh ghi wl (hàng mặt
// nước), top (mặt trên thân, chỗ cò đậu), perch (cò đậu được không); vẽ sẵn gấp đôi cho nét.
const LOG_KINDS = 5;

// Ảnh vật trên nước vẽ sẵn gấp mấy lần điểm ảnh CSS: theo mật độ điểm ảnh lớp mặt nước đang vẽ (Water.render), màn 2K/4K
// hay đang vẽ dư thì gấp 4 cho khỏi nhòe khi phóng to
let spriteRes = 2;

function logSprite(variant) {
    const S = spriteRes;
    return built(`log${variant}@${S}`, () => buildLog(variant, S));
}

function* buildLog(variant, S = 2) {
    const W = 200;
    const H = 52;
    const wl = 34;
    const c = document.createElement('canvas');
    c.width = W * S;
    c.height = H * S;
    const g = c.getContext('2d');
    let seed = 11 + variant * 97;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const noise = makeNoise(31 + variant * 53);
    // Gỗ trôi lâu ngày (dáng cong vồng) bạc thành xám; còn lại vỏ nâu sẫm
    const drift = variant === 2;
    const dark = drift ? [86, 82, 74] : [50, 33, 22];
    const light = drift ? [172, 164, 150] : [124, 90, 58];
    const barkCss = drift ? '#6e675c' : '#47301f';
    // Trục thân: [x, tâm y, bán kính]
    const spine = [];
    const from = variant === 3 ? 34 : 8;
    const to = variant === 3 ? 168 : 190;
    for (let i = 0; i <= 40; i++) {
        const t = i / 40;
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
        // Thân không tròn đều: hơi phình, thắt dọc thân
        r *= 1 + (noise(t * 6, 0.5) - 0.5) * 0.14;
        spine.push([x, y, r]);
    }
    const at = x => {
        if (x < from || x > to) return null;
        const f = (x - from) / (to - from) * 40;
        const i = Math.min(39, Math.floor(f));
        const u = f - i;
        return [spine[i][1] + (spine[i + 1][1] - spine[i][1]) * u, spine[i][2] + (spine[i + 1][2] - spine[i][2]) * u];
    };
    // Cành gãy, rễ, nhánh con: khối trụ nhỏ đổ bóng (mặt trên sáng)
    const limb = (x1, y1, x2, y2, w1, w2) => {
        const a = Math.atan2(y2 - y1, x2 - x1) + Math.PI / 2;
        const grad = g.createLinearGradient(x1 + Math.cos(a) * w1, y1 + Math.sin(a) * w1, x1 - Math.cos(a) * w1, y1 - Math.sin(a) * w1);
        grad.addColorStop(0, `rgb(${dark.join(',')})`);
        grad.addColorStop(0.6, `rgb(${light.map((v, i) => (v + dark[i]) / 2 | 0).join(',')})`);
        grad.addColorStop(1, `rgb(${dark.map(v => v * 0.8 | 0).join(',')})`);
        g.fillStyle = grad;
        g.beginPath();
        g.moveTo(x1 + Math.cos(a) * w1, y1 + Math.sin(a) * w1);
        g.lineTo(x2 + Math.cos(a) * w2, y2 + Math.sin(a) * w2);
        g.lineTo(x2 - Math.cos(a) * w2, y2 - Math.sin(a) * w2);
        g.lineTo(x1 - Math.cos(a) * w1, y1 - Math.sin(a) * w1);
        g.closePath();
        g.fill();
        // Đầu cành gãy lởm chởm, lộ gỗ sáng
        g.fillStyle = drift ? '#b9b0a0' : '#9a7448';
        g.beginPath();
        g.ellipse(x2, y2, w2 * 1.05, w2 * 0.7, a, 0, Math.PI * 2);
        g.fill();
    };
    g.scale(S, S);
    if (variant === 0) limb(60, 22, 46, 3, 3, 1.5);
    if (variant === 1) {
        limb(66, 23, 50, 4, 3.5, 1.6);
        limb(128, 23, 146, 8, 3, 1.4);
        limb(96, 24, 100, 14, 2.2, 1.8);
    }
    if (variant === 3) {
        for (let i = 0; i < 8; i++) {
            const a = Math.PI * (0.52 + i * 0.12);
            limb(38, 31 + rnd() * 6 - 3, 38 + Math.cos(a) * (18 + rnd() * 12), 31 + Math.sin(a) * (14 + rnd() * 10) * (i % 2 ? 1 : -0.8), 2.6, 0.7);
        }
    }
    if (variant === 4) {
        [[40, -1, 14], [82, 1, 18], [120, -1, 12], [150, 1, 10]].forEach(([x, side, len]) => {
            const tipX = x + side * len * 0.5;
            limb(x, 29, tipX, 29 - len, 1.3, 0.4);
            const fx = x + side * len * 0.32;
            const fy = 29 - len * 0.62;
            limb(fx, fy, fx + side * 5, fy - 4, 0.6, 0.25);
            [[tipX, 29 - len], [fx + side * 5, fy - 4]].forEach(([lx, ly]) => {
                for (let j = 0; j < 4; j++) {
                    g.fillStyle = ['#5d6a3a', '#6e5a32', '#7a6a3a', '#4f5e34'][(rnd() * 4) | 0];
                    g.save();
                    g.translate(lx, ly);
                    g.rotate(-Math.PI / 2 + (rnd() - 0.5) * 2.4);
                    g.beginPath();
                    g.ellipse(2.2, 0, 2.4, 0.8, 0, 0, Math.PI * 2);
                    g.fill();
                    g.restore();
                }
            });
        });
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    // Thân: từng điểm ảnh (vẽ riêng rồi đặt đè lên cành, khỏi đọc ngược ảnh từ canvas vốn chậm)
    const img = g.createImageData(W * S, H * S);
    const d = img.data;
    const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    const capped = variant <= 1 || variant === 3;
    for (let py = 0; py < H * S; py++) {
        if (py % (16 / S) === 16 / S - 1) yield;
        const Y = (py + 0.5) / S;
        for (let px = 0; px < W * S; px++) {
            const X = (px + 0.5) / S;
            const sp = at(X);
            if (!sp) continue;
            const [cy, r] = sp;
            // Đầu khúc gỗ: đầu trái gãy tròn, đầu phải tròn (trừ khúc có mặt cắt)
            let lim = 1;
            if (X < from + r) lim = Math.sqrt(Math.max(0, 1 - ((from + r - X) / r) ** 2));
            if (!capped && X > to - r) lim = Math.sqrt(Math.max(0, 1 - ((X - (to - r)) / r) ** 2));
            const v = (Y - cy) / r;
            if (Math.abs(v) > lim) continue;
            // Thớ vỏ chạy dọc thân, vết nứt sâu, rêu trên mặt trên, rong sát mép nước
            const grain = fbm(noise, X / 24, v * r / 1.4 + 3, 4);
            const fine = noise(X / 9, v * r / 0.55 + 11);
            let col = mix(dark, light, 0.18 + 0.7 * grain);
            if (fine < 0.2) col = col.map(c0 => c0 * (drift ? 0.7 : 0.55));
            if (drift && fine > 0.82) col = col.map(c0 => Math.min(255, c0 * 1.12));
            const moss = fbm(noise, X / 15 + 40, v * 2 + 9, 3);
            if (!drift && v < -0.2 && moss > 0.58) col = mix(col, [60, 92, 46], Math.min(1, (moss - 0.58) * 5) * 0.8);
            if (Y > wl - 3.5 && Y < wl + 1.5) col = mix(col, [38, 54, 34], 0.4);
            // Hình trụ: mặt trên hứng sáng, mặt dưới tối, sát viền tối hơn
            const round = Math.sqrt(Math.max(0, 1 - v * v));
            const shade = (0.25 + 0.72 * Math.pow((1 - v) / 2, 1.3)) * (0.5 + 0.5 * round)
                + 0.3 * Math.exp(-(((v + 0.5) / 0.2) ** 2)) * (drift ? 0.6 : 1);
            const i = (py * W * S + px) * 4;
            d[i] = Math.min(255, col[0] * shade);
            d[i + 1] = Math.min(255, col[1] * shade);
            d[i + 2] = Math.min(255, col[2] * shade);
            d[i + 3] = 255;
        }
    }
    const body = document.createElement('canvas');
    body.width = W * S;
    body.height = H * S;
    body.getContext('2d').putImageData(img, 0, 0);
    g.drawImage(body, 0, 0);
    g.scale(S, S);
    // Mắt gỗ: chỗ lõm sẫm có vân tròn
    if (variant !== 4) {
        for (let i = 0; i < 2; i++) {
            const x = from + (to - from) * (0.2 + rnd() * 0.6);
            const [cy, r] = at(x);
            const ky = cy - r * (0.25 + rnd() * 0.3);
            g.fillStyle = 'rgba(26, 16, 9, 0.45)';
            g.beginPath();
            g.ellipse(x, ky, 1.5, 0.9, 0, 0, Math.PI * 2);
            g.fill();
            g.strokeStyle = drift ? 'rgba(200, 192, 176, 0.25)' : 'rgba(150, 110, 70, 0.3)';
            g.lineWidth = 0.45;
            g.beginPath();
            g.ellipse(x, ky, 2.6, 1.5, 0, 0, Math.PI * 2);
            g.stroke();
        }
    }
    // Mặt cắt ở đầu khúc gỗ: vỏ viền ngoài, vân năm, vết nứt tỏa từ lõi
    if (capped) {
        const [x, y, r] = spine[spine.length - 1];
        g.fillStyle = barkCss;
        g.beginPath();
        g.ellipse(x, y, r * 0.58, r, 0, 0, Math.PI * 2);
        g.fill();
        const face = g.createRadialGradient(x - r * 0.12, y - r * 0.2, 0, x, y, r);
        face.addColorStop(0, '#c99c64');
        face.addColorStop(1, '#8a6238');
        g.fillStyle = face;
        g.beginPath();
        g.ellipse(x, y, r * 0.5, r * 0.88, 0, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = 'rgba(96, 62, 32, 0.6)';
        g.lineWidth = 0.55;
        [0.72, 0.5, 0.3].forEach(f => {
            g.beginPath();
            g.ellipse(x, y, r * 0.5 * f, r * 0.88 * f, 0, 0, Math.PI * 2);
            g.stroke();
        });
        g.strokeStyle = 'rgba(60, 36, 18, 0.7)';
        for (let i = 0; i < 3; i++) {
            const a = rnd() * Math.PI * 2;
            g.beginPath();
            g.moveTo(x, y);
            g.lineTo(x + Math.cos(a) * r * 0.45, y + Math.sin(a) * r * 0.8);
            g.stroke();
        }
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    // Sát mặt nước: dải ướt sẫm; dưới mặt nước: ngả màu nước, mờ dần theo độ sâu
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = 'rgba(0, 0, 0, 0.32)';
    g.fillRect(0, (wl - 3) * S, W * S, 3 * S);
    g.fillStyle = 'rgba(14, 30, 58, 0.72)';
    g.fillRect(0, wl * S, W * S, (H - wl) * S);
    g.globalCompositeOperation = 'destination-in';
    const sink = g.createLinearGradient(0, 0, 0, H * S);
    sink.addColorStop(0, 'rgba(0, 0, 0, 1)');
    sink.addColorStop(wl / H, 'rgba(0, 0, 0, 1)');
    sink.addColorStop(wl / H + 0.02, 'rgba(0, 0, 0, 0.55)');
    sink.addColorStop(1, 'rgba(0, 0, 0, 0)');
    g.fillStyle = sink;
    g.fillRect(0, 0, W * S, H * S);
    g.globalCompositeOperation = 'source-over';
    const mid = spine[20];
    c.wl = wl * S;
    c.top = (mid[1] - mid[2]) * S;
    c.perch = variant !== 4;
    return c;
}

// Vịt trời (nhìn nghiêng, quay sang phải): vịt đực đầu xanh cổ khoang trắng, vịt mái nâu lốm đốm. Tư thế: bơi, chổng
// đuôi kiếm ăn, cánh giơ lên, cụp xuống. Mặt nước ở hàng 20 (bơi, chổng đuôi).
function duckSprite(kind, pose) {
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
const FISH_LOOKS = {
    silver: { w: 34, h: 16, thick: 0.3, back: '#7f93a6', side: '#e4ecf3', belly: '#a9b8c6', fin: '#9fb0c0', eye: '#1d242c' },
    carp: { w: 40, h: 20, thick: 0.36, back: '#8e3f1c', side: '#e88a38', belly: '#f6cf7a', fin: '#d2602a', eye: '#2a1a10', scales: true, barbel: true },
    grass: { w: 46, h: 16, thick: 0.26, back: '#3e4a30', side: '#8f9670', belly: '#d6d4b4', fin: '#5a6444', eye: '#1c2016' },
    minnow: { w: 18, h: 8, thick: 0.27, back: '#6f8496', side: '#dfe8f0', belly: '#b9c6d2', fin: '#9fb0c0', eye: '#1d242c', stripe: true }
};

// Cỡ trên màn hình (điểm ảnh CSS ở d = 0), thời gian một cú nhảy, độ cao, quãng xa
const FISH_TYPES = {
    silver: { size: 26, life: [650, 900], lift: [16, 28], reach: [16, 28] },
    carp: { size: 32, life: [800, 1050], lift: [20, 32], reach: [14, 24] },
    grass: { size: 38, life: [700, 900], lift: [12, 20], reach: [22, 34] },
    minnow: { size: 11, life: [340, 460], lift: [6, 11], reach: [10, 16] }
};

// Cá nhảy vẽ bằng nét: thân uốn cong theo cú nhảy, đuôi quẫy (nhanh lúc vừa rời nước), mình hơi xoay nên hông lóe sáng.
// Gốc ở giữa thân, đầu quay sang phải; L: chiều dài (điểm ảnh CSS); bend: độ cong thân; wag: quẫy đuôi (-1..1);
// roll: mình xoay (0,4 nghiêng hẳn - 1 nhìn ngang).
function drawFishBody(ctx, look, L, bend, wag, roll, k) {
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

function drawEgret(ctx, cx, cy, u, dir, p, k) {
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

const EGRET_POSE = { wing: 0.3, lag: 0, fold: 1, neck: 0, stalk: 0, strike: 0, preen: 0, peck: 0, tilt: 0, legA: Math.PI - 0.1, crouch: 0,
    walk: 0, turn: 0, headX: 0, headY: 0, headTilt: 0, breath: 0, prey: 0, gulp: 0 };

const rand = (min, max) => min + Math.random() * (max - min);

// Sinh vật trên mặt nước bật/tắt riêng từng loại (builder, mục "Trên mặt nước")
const WATER_ALL = { birds: true, ducks: true, fish: true, logs: true };


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

    reset(river, cssW, flags = WATER_ALL) {
        this.logs = [];
        this.birds = [];
        this.ducks = [];
        this.fish = [];
        this.ripples = [];
        this.drops = [];
        const slow = IS_MOBILE ? 1.3 : 1;
        // Mở màn đã có sẵn một khúc gỗ đang trôi, một con cò và một đàn vịt sắp bay tới
        if (river && flags.logs) this.logs.push(this.makeLog(rand(0.18, 0.42) * cssW, rand(0.45, 0.8)));
        this.next = river
            ? { log: rand(9000, 16000) * slow, bird: rand(1500, 3000), duck: rand(5000, 9000), fish: rand(2500, 4500), rise: rand(800, 2000) }
            : { log: Infinity, bird: rand(3000, 6000), duck: rand(2500, 5000), fish: rand(3500, 6000), rise: rand(800, 2000) };
    },

    makeLog(x, d) {
        return { x, d, variant: (Math.random() * LOG_KINDS) | 0, len: rand(95, 135), phase: Math.random() * 6, seed: Math.random(), bird: null };
    },

    // Khúc gỗ nghiêng theo sóng, bị dòng nước đẩy dạt qua đá thì nghiêng thêm
    logTilt(log) {
        return Math.sin(log.phase * 0.7) * 0.015 + Math.max(-0.05, Math.min(0.05, (log.vd || 0) * 600));
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

    // rocks: đá, gò đất giữa dòng (vật trôi, vịt né); flags: loại nào đang bật (tắt thì bỏ ngay)
    update(dt, river, cssW, topCss, depthCss, rocks = [], flags = WATER_ALL) {
        const slow = IS_MOBILE ? 1.3 : 1;
        if (!flags.logs) this.logs = [];
        if (!flags.ducks) this.ducks = [];
        if (!flags.fish) this.fish = [];
        if (!flags.birds && this.birds.length) {
            this.birds.forEach(bird => this.freeEgretPerch(bird));
            this.birds = [];
        }
        // Khúc gỗ: trôi vào từ thượng nguồn (bên trái), ra khỏi khung thì bỏ
        this.next.log -= dt;
        if (this.next.log <= 0 && flags.logs) {
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
            steerAround(log, log.x - half, half, rocks, dt, depthCss, 1);
        });
        this.logs = this.logs.filter(log => log.x - log.len * this.scale(log.d) < cssW + 30);

        // Cò: bay tới đậu trên khúc gỗ, đá, gò đất hoặc lội chỗ nước nông sát bờ; đứng thì ngó nghiêng, rỉa lông, lội thì
        // rình rồi mổ cá; hết giờ thì nhún chân cất cánh bay đi
        this.next.bird -= dt;
        if (this.next.bird <= 0 && flags.birds) {
            this.next.bird = (river ? rand(7000, 13000) : rand(9000, 16000)) * slow;
            if (this.birds.length < 2) this.birds.push(this.makeEgret(cssW, topCss, rocks));
        }
        this.birds.forEach(bird => this.updateEgret(bird, dt, cssW, topCss, depthCss, rocks));
        this.birds = this.birds.filter(bird => !(bird.state === 'leave' && (bird.y < -60 || bird.x < -60 || bird.x > cssW + 60)));

        // Vịt trời: cả đàn bay tới, đáp xuống trượt trên nước, bơi quạt chân để lại vệt sóng, thỉnh thoảng chổng đuôi
        // kiếm ăn, rồi chạy trên mặt nước cất cánh bay đi
        this.next.duck -= dt;
        if (this.next.duck <= 0 && flags.ducks) {
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
                steerAround(duck, duck.x, 12 * s, rocks, dt, depthCss, Math.sign(duck.vx + this.flow(duck.d, river) * 0.5));
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
        if (this.next.fish <= 0 && flags.fish) {
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
                    type, d, x: x + dir * i * rand(5, 9) * s, t: -i * rand(90, 160), started: false, seed: Math.random(),
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
            // Nước rỏ xuống từ mình cá lúc đang bay
            if (fish.started && fish.t < fish.life * 0.7) {
                const f = this.fishState(fish, topCss, depthCss);
                fish.shed = (fish.shed ?? 0) - dt;
                if (f.p > 0.05 && f.y < f.surf && fish.shed <= 0) {
                    fish.shed = 45;
                    const s = this.scale(fish.d);
                    this.drops.push({ x: f.x - Math.sign(f.vx) * f.L * 0.3, y: f.y, base: f.surf, vx: rand(-0.015, 0.015), vy: rand(-0.02, 0.01), size: rand(0.8, 1.4) * s });
                }
            }
            if (fish.t >= fish.life && !fish.done) {
                fish.done = true;
                this.splash(fish.x + fish.dx, fish.d, topCss, depthCss, size);
            }
        });
        this.fish = this.fish.filter(fish => !fish.done);

        // Cá đớp mồi: vòng sóng nhỏ lan ra đây đó trên mặt nước
        this.next.rise -= dt;
        if (this.next.rise <= 0 && flags.fish) {
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

    // Vòng sóng; bóng cò, vịt đang bay in xuống nước, bay càng cao bóng càng nhạt (dưới mọi vật). Lớp đã nhân k: tọa độ
    // điểm ảnh CSS.
    drawUnder(ctx, k, topCss, depthCss, time = 0) {
        ctx.globalCompositeOperation = 'source-over';
        const reach = depthCss * 1.2;
        this.birds.forEach(bird => {
            if (bird.state !== 'fly' && bird.state !== 'leave') return;
            const surf = this.surfaceY(bird.d, topCss, depthCss);
            const y = bird.y + Math.cos(bird.ph) * 0.8 * bird.u;
            const lift = surf - y + 30 * bird.u;
            if (surf - y < 0 || surf - y > reach) return;
            drawMirrorSlices(ctx, surf, lift, bird.x, 45 * bird.u, 0.24 * (1 - (surf - y) / reach), time, bird.seed, bird.u, 1)(alpha => {
                ctx.globalAlpha = alpha;
                drawEgret(ctx, bird.x, y, bird.u, bird.dir, bird.pose, k);
            });
        });
        this.ducks.forEach(duck => {
            if (duck.state !== 'fly' && duck.state !== 'leave') return;
            const s = this.scale(duck.d);
            const surf = this.surfaceY(duck.d, topCss, depthCss);
            if (surf - duck.y < 0 || surf - duck.y > reach) return;
            const pose = Math.floor(duck.flap / 85) % 2 ? 'up' : 'down';
            drawMirrorSlices(ctx, surf, surf - duck.y + 12 * s, duck.x, 14 * s, 0.26 * (1 - (surf - duck.y) / reach), time, duck.seed, s, 1)(
                alpha => this.paintDuck(ctx, duck, pose, s, alpha));
        });
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
            ...this.birds.filter(b => b.state === 'land' || b.state === 'stand' || b.state === 'takeoff').map(bird => ({
                d: bird.d + 0.0001, draw: () => this.drawStandingEgret(ctx, bird, k, topCss, depthCss)
            })),
            ...this.ducks.filter(duck => duck.state === 'swim' || duck.state === 'dabble').map(duck => ({
                d: duck.d, draw: () => this.drawDuck(ctx, duck, duck.state, this.scale(duck.d), k, time)
            }))
        ];
    },

    // Cá đang nhảy, tia nước, cò và vịt đang bay (trên mọi vật)
    drawOver(ctx, k, topCss, depthCss, time) {
        // Cá nhảy: đầu theo hướng bay, thân uốn cong (nhiều nhất ở đỉnh), đuôi quẫy nhanh lúc vừa rời nước; phần còn dưới
        // mặt nước bị nước che nên như trồi lên, lặn xuống thật
        this.fish.forEach(fish => {
            if (fish.t < 0) return;
            const f = this.fishState(fish, topCss, depthCss);
            const early = f.p < 0.3;
            const wag = Math.sin(time * (early ? 0.05 : 0.022) + fish.seed * 9) * (early ? 1 : 0.45);
            ctx.save();
            ctx.beginPath();
            ctx.rect(f.x - f.L * 1.5, f.y - f.L * 1.5, f.L * 3, Math.max(0, f.surf - (f.y - f.L * 1.5)));
            ctx.clip();
            ctx.translate(f.x, f.y);
            if (f.vx < 0) ctx.scale(-1, 1);
            ctx.rotate(Math.atan2(f.vy, Math.abs(f.vx)));
            ctx.globalAlpha = 0.97;
            drawFishBody(ctx, FISH_LOOKS[fish.type], f.L, 0.25 + 0.55 * Math.sin(Math.PI * f.p), wag,
                0.7 + 0.3 * Math.cos(f.p * Math.PI * 2 + fish.seed * 6), k);
            ctx.restore();
        });
        ctx.fillStyle = 'rgb(225, 236, 255)';
        this.drops.forEach(p => {
            ctx.globalAlpha = 0.8;
            ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        });
        this.birds.forEach(bird => {
            if (bird.state === 'fly' || bird.state === 'leave') this.drawFlyingEgret(ctx, bird, k);
        });
        this.ducks.forEach(duck => {
            if (duck.state !== 'fly' && duck.state !== 'leave') return;
            this.drawDuck(ctx, duck, Math.floor(duck.flap / 85) % 2 ? 'up' : 'down', this.scale(duck.d), k);
        });
        ctx.globalAlpha = 1;
    },

    // Khúc gỗ nổi: phần nổi thẳng, phần chìm từng lát lệch theo sóng (nước khúc xạ); bóng phần nổi in xuống nước gợn theo
    // sóng; vệt ướt lấp lánh dọc mép nước; bị dòng nước đẩy dạt qua đá thì nghiêng mình theo
    drawLog(ctx, log, k, topCss, depthCss, time, river) {
        const s = this.scale(log.d);
        const sprite = logSprite(log.variant);
        const w = log.len * s;
        const h = w * sprite.height / sprite.width;
        const wlOff = h * sprite.wl / sprite.height;
        const y = this.surfaceY(log.d, topCss, depthCss) + Math.sin(log.phase) * 0.5 * s;
        const left = log.x - w;
        drawReflection(ctx, sprite, left, y, w, wlOff, 0.24, time, log.seed, s);
        drawFlowMarks(ctx, left + w / 2, y, w * 0.5, s, k, time, log.seed, river, 0.35);
        ctx.save();
        ctx.translate(left + w / 2, y);
        ctx.rotate(this.logTilt(log));
        ctx.globalAlpha = 0.97;
        ctx.drawImage(sprite, 0, 0, sprite.width, sprite.wl, -w / 2, -wlOff, w, wlOff);
        drawSubmerged(ctx, sprite, -w / 2, 0, w, h - wlOff, time, log.seed, s);
        ctx.restore();
        ctx.fillStyle = 'rgb(205, 222, 255)';
        for (let i = 0; i < 6; i++) {
            const fx = left + w * (0.1 + i * 0.15) + Math.sin(time * 0.0017 + i * 1.7 + log.phase) * 2 * s;
            ctx.globalAlpha = 0.18 + 0.2 * (0.5 + 0.5 * Math.sin(time * 0.003 + i * 2.1));
            ctx.fillRect(fx, y - 0.4 * s, (3 + (i % 3) * 2) * s, Math.max(1 / k, 0.7 * s));
        }
    },

    // Vịt: đang bơi thì vệt sóng tách ra phía sau, bóng in xuống nước gợn theo sóng
    drawDuck(ctx, duck, pose, s, k, time = 0) {
        if (pose === 'swim' || pose === 'dabble') {
            if (pose === 'swim' && Math.abs(duck.vx) > 0.004) {
                drawWakeTrail(ctx, duck.x - Math.sign(duck.vx) * 4 * s, duck.y, 5 * s, s, k, time, duck.seed, -Math.sign(duck.vx), 0.45);
            }
            drawMirrorSlices(ctx, duck.y, 24 * s * 20 / 40, duck.x, 13 * s, 0.46, time, duck.seed, s, 0.8)(
                alpha => this.paintDuck(ctx, duck, pose, s, alpha));
        }
        this.paintDuck(ctx, duck, pose, s, 0.95);
    },

    paintDuck(ctx, duck, pose, s, alpha) {
        const sprite = duckSprite(duck.kind, pose);
        const w = 24 * s;
        const h = w * 28 / 40;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(duck.x, duck.y);
        if (duck.dir < 0) ctx.scale(-1, 1);
        ctx.drawImage(sprite, -w / 2, -h * (pose === 'swim' || pose === 'dabble' ? 20 / 28 : 0.5), w, h);
        ctx.restore();
    },

    makeEgret(cssW, topCss, rocks) {
        const dir = Math.random() < 0.5 ? 1 : -1;
        const bird = {
            state: 'fly', dir, x: dir > 0 ? -30 : cssW + 30, y: topCss * rand(0.2, 0.55), ph: Math.random() * 6, t: 0, seed: Math.random(),
            rest: rand(9000, 18000), act: null, legs: 'fly', d: 0.5, u: 1, pose: { ...EGRET_POSE, legs: 'fly' }
        };
        const logs = this.logs.filter(log => !log.bird && logSprite(log.variant).perch && log.x > cssW * 0.15 && log.x < cssW * 0.6);
        // Đá, gò đất chưa có cò nào đang đậu (dấu cũ của cò đã đi khỏi cảnh thì bỏ qua)
        const free = rocks.filter(rock => !rock.bird || !this.birds.includes(rock.bird));
        const roll = Math.random();
        if (logs.length && roll < 0.4) {
            bird.perch = { log: logs[0], ox: rand(0.35, 0.65) };
            logs[0].bird = bird;
        } else if (free.length && roll < 0.78) {
            const rock = free[(Math.random() * free.length) | 0];
            bird.perch = { rock };
            rock.bird = bird;
        } else {
            bird.perch = { wade: true, x: rand(0.15, 0.85) * cssW, d: rand(0.03, 0.12) };
        }
        return bird;
    },

    freeEgretPerch(bird) {
        if (bird.perch.log && bird.perch.log.bird === bird) bird.perch.log.bird = null;
        if (bird.perch.rock && bird.perch.rock.bird === bird) bird.perch.rock.bird = null;
    },

    // Chỗ chân cò chạm: mặt trên khúc gỗ, đá, gò đất; lội thì chân ngập dưới mặt nước. surf: mặt nước chỗ đó.
    egretFeet(bird, topCss, depthCss) {
        const perch = bird.perch;
        if (perch.log) {
            const log = perch.log;
            const s = this.scale(log.d);
            const surf = this.surfaceY(log.d, topCss, depthCss);
            // Chỗ đậu lên xuống, nghiêng theo khúc gỗ
            const w = log.len * s;
            const tilt = w * (perch.ox - 0.5) * this.logTilt(log);
            return { x: log.x - w * (1 - perch.ox), y: surf - this.logPerch(log, s) + Math.sin(log.phase) * 0.5 * s + tilt, d: log.d, surf };
        }
        if (perch.rock) {
            const rock = perch.rock;
            const sprite = rock.kind === 'rock' ? rockSprite(rock.variant) : moundSprite(rock.variant);
            const w = rock.size * this.scale(rock.d);
            const surf = this.surfaceY(rock.d, topCss, depthCss);
            return { x: rock.x + sprite.perchX * w, y: surf - w * (sprite.wl - sprite.top) / sprite.width, d: rock.d, surf };
        }
        const surf = this.surfaceY(perch.d, topCss, depthCss);
        return { x: perch.x, y: surf + 3 * 0.9 * this.scale(perch.d), d: perch.d, surf, wade: true };
    },

    // Việc tiếp theo lúc đứng: ngó nghiêng, rỉa lông, đứng nghỉ; lội thì rình (bước chậm) rồi mổ, có khi được cá
    nextEgretAction(bird) {
        const prev = bird.act && bird.act.type;
        if (prev === 'stalk' || prev === 'watch') return { type: 'strike', t: 0, dur: 520 };
        if (prev === 'strike') return Math.random() < 0.45 ? { type: 'catch', t: 0, dur: 1400 } : { type: 'look', t: 0, dur: rand(900, 1600) };
        const r = Math.random();
        if (bird.perch.wade && r < 0.55) return { type: 'stalk', t: 0, dur: rand(2500, 5000) };
        // Đậu trên gỗ, đá, gò đất: rướn người rình cá dưới nước ngay mép, hoặc cúi xuống mổ tìm mồi chỗ đang đứng
        if (!bird.perch.wade && r < 0.24) return { type: 'watch', t: 0, dur: rand(1800, 3800) };
        if (!bird.perch.wade && r < 0.44) return { type: 'peck', t: 0, dur: rand(1600, 3000) };
        if (r < 0.72) return { type: 'look', t: 0, dur: rand(1600, 3200), turn: Math.random() < 0.4 };
        if (r < 0.88) return { type: 'preen', t: 0, dur: rand(1800, 3200) };
        return { type: 'idle', t: 0, dur: rand(1500, 3000) };
    },

    updateEgret(bird, dt, cssW, topCss, depthCss, rocks) {
        bird.t += dt;
        // Chỗ đậu không còn (khúc gỗ trôi đi, tắt đá/gò đất): đang bay thì chuyển sang lội, đang đứng thì bay đi
        const gone = (bird.perch.log && !this.logs.includes(bird.perch.log)) || (bird.perch.rock && !rocks.includes(bird.perch.rock));
        if (gone) {
            if (bird.state === 'fly') {
                const feet = this.egretFeet(bird, topCss, depthCss);
                bird.perch = { wade: true, x: Math.min(cssW - 30, Math.max(30, feet.x)), d: rand(0.03, 0.12) };
                bird.target = null;
            } else if (bird.state === 'land' || bird.state === 'stand') {
                bird.state = 'takeoff';
                bird.t = 0;
            }
        }
        const feet = this.egretFeet(bird, topCss, depthCss);
        const u = 0.9 * this.scale(feet.d);
        bird.d = feet.d;
        bird.u = u;
        const p = bird.pose;
        const target = { ...EGRET_POSE, wing: p.wing, lag: p.lag };
        let wingTau = 40;
        if (bird.state === 'fly') {
            // Chỗ đậu đang trôi (khúc gỗ theo dòng): bay theo cả đà trôi của nó, không thì đuổi mãi không đáp được
            if (bird.target) {
                bird.x += feet.x - bird.target.x;
                bird.y += feet.y - bird.target.y;
            }
            bird.target = { x: feet.x, y: feet.y };
            const tx = feet.x;
            const ty = feet.y - 11 * u;
            const dx = tx - bird.x;
            const dy = ty - bird.y;
            const dist = Math.hypot(dx, dy);
            bird.dir = dx >= 0 ? 1 : -1;
            const near = dist < 60;
            const step = Math.min(dist, (near ? 0.035 + 0.06 * dist / 60 : 0.11) * dt);
            bird.ph += dt * Math.PI * 2 / (near ? 380 : 780);
            if (near) {
                // Sắp đáp: xòe cánh hãm lại, đưa chân ra trước, ngả thân ra sau
                Object.assign(target, { wing: 1.0 + 0.28 * Math.sin(bird.ph), lag: 0.35, neck: 0.5, tilt: -0.45, legA: Math.PI / 2 - 0.35 });
            } else {
                Object.assign(target, { wing: 0.25 + 0.95 * Math.sin(bird.ph), lag: -0.45 * Math.cos(bird.ph), legA: Math.PI - 0.1 });
            }
            if (dist <= step + 0.5) {
                bird.target = null;
                bird.state = 'land';
                bird.t = 0;
                bird.legs = 'stand';
                if (feet.wade) this.splash(feet.x, feet.d, topCss, depthCss, 0.5);
            } else {
                bird.x += dx / dist * step;
                bird.y += dy / dist * step;
            }
        } else if (bird.state === 'land' || bird.state === 'stand') {
            if (bird.state === 'land') {
                // Chạm chân: cánh còn giơ một chút rồi xếp lại
                Object.assign(target, { fold: bird.t < 220 ? 1 : 0, wing: 0.9, lag: 0.2, neck: 0.8, tilt: -0.35, crouch: bird.t < 200 ? 0.5 : 0 });
                wingTau = 120;
                if (bird.t > 650) {
                    bird.state = 'stand';
                    bird.act = null;
                }
            } else {
                bird.rest -= dt;
                if (!bird.act || bird.act.t >= bird.act.dur) {
                    // Ngó xong có khi quay sang hướng khác
                    if (bird.act && bird.act.type === 'look' && bird.act.turn) bird.dir = -bird.dir;
                    bird.act = this.nextEgretAction(bird);
                }
                const act = bird.act;
                act.t += dt;
                const q = act.t / act.dur;
                // Đậu trên cao: đầu phải hạ thêm bao nhiêu (đơn vị u) để mũi mỏ chạm mặt nước ngay mép chỗ đậu
                const reach = feet.wade ? 0 : Math.min(10, Math.max(0, (this.surfaceY(feet.d + 0.02, topCss, depthCss) - bird.y) / u - 15));
                Object.assign(target, { fold: 0, neck: 0.78, tilt: -0.32, breath: Math.sin(bird.t * 0.003) });
                if (act.type === 'idle') {
                    target.headTilt = Math.sin(bird.t * 0.0013) * 0.08;
                } else if (act.type === 'look') {
                    Object.assign(target, { neck: 1, headTilt: -0.12 + Math.sin(bird.t * 0.0021) * 0.12, turn: q > 0.3 && q < 0.65 ? 1.1 : 0 });
                } else if (act.type === 'preen') {
                    Object.assign(target, { preen: 1, headX: Math.sin(bird.t * 0.018) * 0.7, headY: Math.sin(bird.t * 0.011) * 0.5 });
                } else if (act.type === 'stalk') {
                    // Rướn cổ, khom người, bước thật chậm
                    Object.assign(target, { stalk: 1, crouch: 0.4, walk: 1, tilt: -0.1 });
                    p.step += dt * 0.0045;
                    bird.perch.x = Math.min(cssW - 30, Math.max(30, bird.perch.x + bird.dir * 0.004 * dt));
                } else if (act.type === 'watch') {
                    // Đứng trên chỗ đậu rướn người nhìn xuống nước, đầu hạ dần, im phăng phắc
                    Object.assign(target, { stalk: 1, crouch: 0.35, tilt: 0.05, headY: Math.min(6, reach * 0.35), headTilt: 0.35 });
                } else if (act.type === 'peck') {
                    // Cúi xuống mổ tìm mồi trên gỗ, đá: mổ nhanh vài cái rồi ngẩng lên chút
                    const jab = Math.pow(Math.max(0, Math.sin(act.t * 0.012)), 6);
                    Object.assign(target, { peck: 0.7 + 0.3 * jab, crouch: 0.3, tilt: 0.12, headY: jab * 1.8 });
                } else if (act.type === 'strike') {
                    // Lội thì mổ ngay trước chân; đậu trên cao thì vươn hẳn cổ xuống mặt nước sát mép chỗ đậu
                    Object.assign(target, { stalk: 1, crouch: 0.5, tilt: feet.wade ? -0.05 : 0.15, strike: q < 0.55 ? 1 : 0, headY: q < 0.55 ? reach : 0 });
                    if (q > 0.3 && !act.splashed) {
                        act.splashed = true;
                        this.splash(feet.x + bird.dir * (feet.wade ? 20 : 17) * u, feet.d + (feet.wade ? 0 : 0.02), topCss, depthCss, 0.45);
                    }
                } else if (act.type === 'catch') {
                    // Ngửa cổ nuốt cá
                    Object.assign(target, { neck: 0.95, headTilt: -0.5, prey: q < 0.45 ? 1 : 0 });
                    p.gulp = q > 0.45 && q < 0.95 ? (q - 0.45) / 0.5 : 0;
                }
                const edge = feet.x > cssW - 20 || feet.x < 20;
                if ((bird.rest <= 0 && (act.type === 'idle' || act.type === 'look')) || edge) {
                    bird.state = 'takeoff';
                    bird.t = 0;
                }
            }
            bird.x = feet.x;
            bird.y = feet.y - 11 * u * (1 - 0.25 * p.crouch);
        } else if (bird.state === 'takeoff') {
            // Nhún chân lấy đà rồi bật lên
            Object.assign(target, { fold: 0, crouch: 1, neck: 0.4, tilt: -0.2 });
            bird.x = feet.x;
            bird.y = feet.y - 11 * u * (1 - 0.25 * p.crouch);
            if (bird.t > 240) {
                this.freeEgretPerch(bird);
                if (feet.wade) this.splash(feet.x, feet.d, topCss, depthCss, 0.6);
                bird.state = 'leave';
                bird.t = 0;
                bird.legs = 'fly';
                bird.vx = bird.dir * 0.07;
                bird.vy = -0.08;
                p.fold = 0.6;
                p.legA = Math.PI / 2 + 0.25;
            }
        } else {
            // Cất cánh: vỗ mạnh, chân còn buông thõng rồi duỗi dần về sau
            bird.ph += dt * Math.PI * 2 / (bird.t < 900 ? 440 : 700);
            Object.assign(target, {
                wing: 0.3 + 1.0 * Math.sin(bird.ph), lag: -0.5 * Math.cos(bird.ph),
                legA: bird.t < 500 ? Math.PI / 2 + 0.25 : Math.PI - 0.1, tilt: bird.t < 600 ? -0.25 : 0
            });
            bird.vx += bird.dir * 0.00004 * dt;
            bird.x += bird.vx * dt;
            bird.y += bird.vy * dt;
            bird.vy = Math.max(-0.1, bird.vy - 0.00003 * dt);
        }
        // Tư thế đổi dần (mổ thì nhanh), cánh theo nhịp vỗ
        const ease = tau => 1 - Math.exp(-dt / tau);
        Object.keys(target).forEach(key => {
            if (key === 'gulp' || key === 'step') return;
            const tau = key === 'wing' || key === 'lag' ? wingTau : key === 'strike' ? 45 : key === 'fold' ? 140 : 110;
            p[key] += (target[key] - p[key]) * ease(tau);
        });
        p.legs = bird.legs;
    },

    // Cò đứng: phần chân ngập nước (lúc lội) không thấy; bóng in xuống nước; vòng sóng quanh chân
    drawStandingEgret(ctx, bird, k, topCss, depthCss) {
        const feet = this.egretFeet(bird, topCss, depthCss);
        const u = bird.u;
        const paint = alpha => {
            ctx.save();
            if (feet.wade) {
                ctx.beginPath();
                ctx.rect(bird.x - 40 * u, bird.y - 40 * u, 80 * u, Math.max(0, feet.surf - (bird.y - 40 * u)));
                ctx.clip();
            }
            ctx.globalAlpha = alpha;
            drawEgret(ctx, bird.x, bird.y, u, bird.dir, bird.pose, k);
            ctx.restore();
        };
        drawMirrorSlices(ctx, feet.surf, feet.surf - (bird.y - 30 * u), bird.x, 34 * u, 0.36, bird.t, bird.seed, u)(paint);
        paint(0.97);
        if (feet.wade) {
            ctx.strokeStyle = 'rgb(205, 222, 255)';
            ctx.lineWidth = 1 / k;
            ctx.globalAlpha = 0.25 + 0.1 * Math.sin(bird.t * 0.004);
            ctx.beginPath();
            ctx.ellipse(feet.x + bird.dir * 0.5 * u, feet.surf, 4.5 * u, 1.2 * u, 0, 0, Math.PI * 2);
            ctx.stroke();
        }
    },

    drawFlyingEgret(ctx, bird, k) {
        ctx.globalAlpha = 0.97;
        drawEgret(ctx, bird.x, bird.y + Math.cos(bird.ph) * 0.8 * bird.u, bird.u, bird.dir, bird.pose, k);
    },

    // Cá đang nhảy: tâm thân đi theo đường cong từ dưới mặt nước lên rồi xuống lại dưới mặt nước
    fishState(fish, topCss, depthCss) {
        const p = Math.min(1, Math.max(0, fish.t / fish.life));
        const L = FISH_TYPES[fish.type].size * this.scale(fish.d);
        const H = fish.h + L * 0.45;
        const surf = this.surfaceY(fish.d, topCss, depthCss);
        return { p, L, surf, x: fish.x + fish.dx * p, y: surf - 4 * H * p * (1 - p) + L * 0.45, vx: fish.dx, vy: -4 * H * (1 - 2 * p) };
    }
};

// ---------------------------------------------------------------------------
// Bờ đất ở mép nước và lá bèo
// ---------------------------------------------------------------------------

// Bờ đất bên kia mặt nước (tông đêm, ánh trăng rọi từ trên): mặt bờ gần phẳng, chỗ lở lõm vào chút; vách đất có lớp và
// hạt, rễ cây lòi ra gần mép trên, vài hòn cuội lấp ló, sát nước là dải bùn ướt sẫm ánh lên màu trời, chân bờ bị nước
// khoét lõm tối. Vẽ từng điểm ảnh một lần theo cỡ khung, nằm ở lớp mặt nước (dưới chân trời). Cỏ, lau sậy, bụi cây,
// đom đóm nhô lên trên chân trời vẽ ở lớp bầu trời (drawBankSkyline): các lớp trên trang ghép kiểu "lighten" nên vật tối
// vẽ ở lớp mặt nước mà nằm trước nền trời sáng ánh trăng sẽ bị nhạt màu.
let bankCache = { key: '', canvas: null, over: 0 };
let bankNoiseFn = null;
const bankNoise = () => bankNoiseFn || (bankNoiseFn = makeNoise(57));

// Mặt bờ lõm xuống bao nhiêu (điểm ảnh CSS) dưới chân trời tại hoành độ X
function bankDip(X) {
    const noise = bankNoise();
    return Math.max(0, (fbm(noise, X / 80, 0.5, 3) - 0.5) * 3.2 + (noise(X / 7, 4.2) - 0.5) * 0.7);
}

function bankSprite(W, bankPx, k, style = '') {
    const key = `${W}_${bankPx}_${k.toFixed(3)}_${style}`;
    if (bankCache.key === key) return bankCache;
    if (BANK_BODIES[style]) {
        bankCache = { key, canvas: styledBankSprite(W, bankPx, k, style), over: 0 };
        return bankCache;
    }
    const c = document.createElement('canvas');
    c.width = W;
    c.height = bankPx;
    const g = c.getContext('2d');
    const noise = bankNoise();
    let seed = 29;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const bankCss = bankPx / k;
    const edge = new Float32Array(W);
    const strata = new Float32Array(W);
    const grass = new Float32Array(W);
    for (let x = 0; x < W; x++) {
        const X = x / k;
        edge[x] = bankDip(X) * k;
        strata[x] = fbm(noise, X / 30, 3, 2) * 5;
        grass[x] = 0.8 + 1.8 * fbm(noise, X / 14 + 30, 1, 2);
    }
    const img = g.createImageData(W, bankPx);
    const d = img.data;
    for (let y = 0; y < bankPx; y++) {
        const Y = y / k;
        for (let x = 0; x < W; x++) {
            const top = edge[x];
            if (y + 1 < top) continue;
            const X = x / k;
            const depth = Math.max(0, (y - top) / k);
            const rel = Math.min(1, Y / bankCss);
            const n = fbm(noise, X / 6, Y / 2.2 + 10, 3);
            // Đất: nâu sẫm có hạt, xếp lớp ngang mờ
            const layer = 1 + 0.09 * Math.sin(Y * 1.7 + strata[x]);
            let r = (46 + 24 * n) * layer;
            let gg = (36 + 18 * n) * layer;
            let b = (27 + 12 * n) * layer;
            if (depth < grass[x]) {
                // Mặt bờ phủ cỏ
                const gn = noise(X / 1.4 + 9, Y * 1.3);
                r = 28 + 20 * gn;
                gg = 44 + 30 * gn;
                b = 26 + 14 * gn;
            } else {
                // Rễ cây lòi ra: vệt sẫm mảnh ngoằn ngoèo gần mép trên
                if (rel < 0.45 && Math.abs(fbm(noise, X / 5 + 70, Y / 7 + 3, 2) - 0.5) < 0.012) {
                    r *= 0.62;
                    gg *= 0.62;
                    b *= 0.62;
                }
                // Cuội lấp ló: đốm tròn xám nâu hòa vào đất, nửa trên hứng sáng
                const pebble = noise(X / 3 + 120, Y / 2.6 + 40);
                if (pebble > 0.91 && rel > 0.3) {
                    const t = smooth01(0.91, 0.97, pebble);
                    const up = noise(X / 3 + 120, (Y - 0.7) / 2.6 + 40) > pebble ? 0.85 : 1.08;
                    r += (60 - r) * t * up;
                    gg += (56 - gg) * t * up;
                    b += (50 - b) * t * up;
                }
            }
            // Ánh trăng rọi từ trên: mép trên sáng, càng xuống càng khuất; sát nước ướt sẫm, ánh màu trời
            let lit = 1.18 - 0.5 * rel;
            if (rel > 0.68) {
                const wet = (rel - 0.68) / 0.32;
                lit *= 1 - 0.45 * wet;
                b += 12 * wet;
                gg += 4 * wet;
            }
            // Chân bờ bị nước khoét lõm
            if (rel > 0.9) lit *= 0.7;
            const i = (y * W + x) * 4;
            d[i] = Math.min(255, r * lit);
            d[i + 1] = Math.min(255, gg * lit);
            d[i + 2] = Math.min(255, b * lit);
            // Mép trên mịn (khử răng cưa)
            d[i + 3] = 255 * Math.min(1, Math.max(0, y + 1 - top));
        }
    }
    g.putImageData(img, 0, 0);
    // Ánh nước lấp lánh trên bùn ướt sát chân bờ
    for (let x = rnd() * 30 * k; x < W; x += (14 + rnd() * 40) * k) {
        g.fillStyle = `rgba(170, 190, 220, ${0.15 + rnd() * 0.2})`;
        g.fillRect(x, bankPx - Math.max(1, Math.round(2 * k)), (1.5 + rnd() * 3) * k, Math.max(1, Math.round(0.6 * k)));
    }
    bankCache = { key, canvas: c, over: 0 };
    return bankCache;
}

// Những gì nhô lên trên bờ (điểm ảnh CSS): cỏ ngắn lún phún, bụi cỏ cao, khóm lau sậy có bông cỏ nến, bụi cây thấp ở
// xa, đom đóm. Rải lại khi đổi cỡ khung; cỏ ngắn và bụi cây đứng yên nên dựng sẵn đường vẽ.
let bankLifeCache = { key: -1 };

function bankLife(cssW) {
    const key = Math.round(cssW);
    if (bankLifeCache.key === key) return bankLifeCache;
    let seed = 71;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const fringeColors = ['#24391f', '#2e4628', '#395532', '#1f3120'];
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
        const reed = rnd() < 0.13;
        tufts.push({ x, phase: rnd() * 6, base: bankDip(x) + 0.6, template: reed ? TUFT_GRASS + ((rnd() * TUFT_REEDS) | 0) : (rnd() * TUFT_GRASS) | 0 });
    }
    const flies = Array.from({ length: Math.max(4, Math.round(cssW / (IS_MOBILE ? 60 : 110))) }, () => ({
        x: rnd() * cssW, h: 3 + rnd() * 22, roam: 10 + rnd() * 30, speed: 0.00015 + rnd() * 0.0003, phase: rnd() * 100,
        rate: 0.0012 + rnd() * 0.0016, size: 1.6 + rnd() * 1.4
    }));
    bankLifeCache = { key, fringe, fringeColors, bushes, bushLight, templates, tufts, flies };
    return bankLifeCache;
}

// Cỏ ngắn, bụi cây đứng yên: vẽ sẵn một lần vào ảnh riêng theo cỡ khung và mật độ điểm ảnh, mỗi khung chỉ dán lại
let bankStillCache = { key: '', canvas: null };
const BANK_STILL_UP = 18;

function bankStill(life, cssW, k) {
    const key = `${life.key}_${k.toFixed(3)}`;
    if (bankStillCache.key === key) return bankStillCache.canvas;
    const c = document.createElement('canvas');
    c.width = Math.ceil(cssW * k);
    c.height = Math.ceil((BANK_STILL_UP + 4) * k);
    const g = c.getContext('2d');
    g.setTransform(k, 0, 0, k, 0, BANK_STILL_UP * k);
    g.lineCap = 'round';
    g.fillStyle = '#16231a';
    g.fill(life.bushes);
    g.fillStyle = 'rgba(52, 78, 56, 0.55)';
    g.fill(life.bushLight);
    g.lineWidth = 0.6;
    life.fringe.forEach((path, i) => {
        g.strokeStyle = life.fringeColors[i];
        g.stroke(path);
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
const TUFT_COLORS = ['#2a4228', '#365231', '#43603a', '#223823', '#45583a', '#56623c', '#625c3f', '#4d5838'];
let tuftAtlasCache = { key: '', canvas: null };

function tuftAtlas(life, k) {
    const key = `${life.key}_${k.toFixed(3)}`;
    if (tuftAtlasCache.key === key) return tuftAtlasCache.canvas;
    const c = document.createElement('canvas');
    c.width = Math.ceil(TUFT_STEPS * TUFT_W * k);
    c.height = Math.ceil(life.templates.length * TUFT_H * k);
    const g = c.getContext('2d');
    g.setTransform(k, 0, 0, k, 0, 0);
    life.templates.forEach((tpl, row) => {
        for (let step = 0; step < TUFT_STEPS; step++) {
            const sway = TUFT_SWAY[0] + (TUFT_SWAY[1] - TUFT_SWAY[0]) * step / (TUFT_STEPS - 1);
            const ox = step * TUFT_W + TUFT_W / 2;
            const base = row * TUFT_H + TUFT_H - TUFT_FOOT;
            // Lá thon: chân rộng, ngọn nhọn, uốn theo đường cong qua điểm giữa
            tpl.blades.forEach(blade => {
                const bx = ox + blade.dx;
                const bend = (sway * (tpl.reed ? 0.55 : 1) + blade.lean / blade.h) * blade.h * 0.45;
                const tipY = base - blade.h * (1 - 0.15 * Math.min(1, Math.abs(bend) / blade.h));
                const midX = bx * 0.25 + (bx + bend * 0.2) * 0.5 + (bx + bend) * 0.25;
                const midY = base * 0.25 + (base - blade.h * 0.55) * 0.5 + tipY * 0.25;
                const half = tpl.reed ? 0.6 : 0.55;
                g.fillStyle = TUFT_COLORS[(tpl.reed ? 4 : 0) + blade.color];
                g.beginPath();
                g.moveTo(bx - half, base);
                g.lineTo(midX - half * 0.72, midY);
                g.lineTo(bx + bend, tipY);
                g.lineTo(midX + half * 0.72, midY);
                g.lineTo(bx + half, base);
                g.closePath();
                g.fill();
                if (blade.cattail) {
                    g.save();
                    g.fillStyle = '#4a321e';
                    g.translate(bx + bend * 0.85, base - blade.h * 0.82);
                    g.rotate(Math.atan2(bend, blade.h));
                    g.beginPath();
                    g.ellipse(0, 0, 0.8, 2.2, 0, 0, Math.PI * 2);
                    g.fill();
                    g.restore();
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
function drawBankSkyline(ctx, cssW, ground, clock, calm, glow, drop) {
    // Kiểu bờ khác (kè gạch, phố cổ, cầu...)
    if (bankStyle) {
        drawStyledSkyline(ctx, cssW, ground, clock, calm, glow, drop);
        return;
    }
    const life = bankLife(cssW);
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

// Đốm sáng mềm của đom đóm (vẽ cộng sáng, phóng to thu nhỏ theo cỡ)
function fireflyGlow() {
    if (sprites.firefly) return sprites.firefly;
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const g = c.getContext('2d');
    const glow = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    glow.addColorStop(0, 'rgba(235, 255, 170, 1)');
    glow.addColorStop(0.18, 'rgba(200, 245, 120, 0.75)');
    glow.addColorStop(0.5, 'rgba(150, 220, 80, 0.18)');
    glow.addColorStop(1, 'rgba(120, 200, 60, 0)');
    g.fillStyle = glow;
    g.fillRect(0, 0, 32, 32);
    sprites.firefly = c;
    return c;
}

// ---------------------------------------------------------------------------
// Các kiểu bờ khác (bank-styles.js): kè gạch có lan can và đèn đường, kè đá liễu rủ, bãi cát hàng dừa, phố cổ đèn lồng,
// cầu vòm đá, cầu sắt rực đèn, biển khơi. Thân bờ (dưới chân trời) vẽ từng điểm ảnh ở lớp mặt nước (BANK_BODIES qua
// bankSprite); phần nhô lên trời vẽ ở lớp bầu trời (BANK_SKYLINES) để mặt nước soi được bóng. Phần đứng yên vẽ sẵn một
// lần theo cỡ khung; liễu, dừa đung đưa theo gió (dựng sẵn nhiều mức ngả), đèn lồng đung đưa, dải đèn đổi màu vẽ mỗi khung.
// ---------------------------------------------------------------------------

// Kiểu bờ đang dùng (Water.render đặt mỗi khung; lớp bầu trời vẽ trước lớp mặt nước nên dùng giá trị của khung trước)
let bankStyle = '';

// Màu từng điểm thân bờ: X, Y điểm ảnh CSS (Y tính từ mép trên của bờ), trả [r, g, b] trước khi đổ sáng
const BANK_BODIES = {
    // Tường gạch xây so le, mạch vữa, gạch cháy sẫm, vệt nước mưa; gờ đá trên mặt kè
    brick: (noise, bankCss) => {
        const course = Math.max(2.4, (bankCss - 1.3) / 3.6);
        const len = course * 3.1;
        return (X, Y) => {
            if (Y < 1.3) {
                const v = 100 + 26 * fbm(noise, X / 3, Y * 2, 2) + (Y < 0.4 ? 24 : 0);
                return [v, v * 0.95, v * 0.88];
            }
            const yy = Y - 1.3;
            const row = Math.floor(yy / course);
            const wy = yy - row * course;
            const bx = X + (row % 2) * len * 0.5 + hash(row * 7.3) * 3;
            const col = Math.floor(bx / len);
            const wx = bx - col * len;
            if (wy < 0.45 || wx < 0.5) return [50, 47, 44];
            const h1 = hash(row * 31.7 + col * 3.1);
            const h2 = hash(row * 5.3 + col * 17.9);
            let c = [84 + 36 * h1, 44 + 16 * h1 + 6 * h2, 33 + 10 * h2];
            if (h2 < 0.14) c = c.map(v => v * 0.72);
            const tex = 0.88 + 0.24 * fbm(noise, X / 1.6 + row * 3, Y / 1.2, 3);
            const edge = Math.min(wx - 0.5, wy - 0.45, len - wx, course - wy) < 0.45 ? 0.85 : 1;
            const stain = smooth01(0.62, 0.8, noise(X / 2.4, 9.1)) * 0.28;
            return c.map(v => v * tex * edge * (1 - stain));
        };
    },
    // Kè đá khối dài ngắn khác nhau, mặt vát, hạt đá lấm tấm, rêu bám phía trên; gờ đá trên mặt kè
    stone: (noise, bankCss) => {
        const course = Math.max(3, (bankCss - 1.1) / 2.2);
        const L = course * 2.6;
        return (X, Y) => {
            if (Y < 1.1) {
                const v = 96 + 24 * fbm(noise, X / 4, Y * 2 + 5, 2) + (Y < 0.35 ? 22 : 0);
                return [v, v * 0.97, v * 0.9];
            }
            const yy = Y - 1.1;
            const row = Math.floor(yy / course);
            const wy = yy - row * course;
            // Mạch đứng ở chỗ ngẫu nhiên: tọa độ uốn theo hình sin (luôn tăng nên các khối không chồng nhau)
            const u = (X + row * 13.7) / L + 0.3 * Math.sin((X + row * 5) / L * 1.7 + row);
            const col = Math.floor(u);
            const wx = (u - col) * L;
            if (wy < 0.4 || wx < 0.45) return [40, 39, 37];
            const h = hash(row * 17.1 + col * 7.7);
            let c = [86 + 22 * h, 84 + 20 * h, 78 + 16 * h].map(v => v * (0.86 + 0.26 * fbm(noise, X / 3 + col, Y / 2, 3)));
            if (noise(X * 1.6 + 30, Y * 1.6) > 0.84) c = c.map(v => v + 16);
            if (wy < 0.9) c = c.map(v => v * 1.1);
            else if (course - wy < 0.8) c = c.map(v => v * 0.8);
            const moss = fbm(noise, X / 5 + 60, Y / 3, 3);
            if (moss > 0.6 && Y < bankCss * 0.5) {
                const m = Math.min(1, (moss - 0.6) * 4) * 0.7;
                c = [c[0] + (50 - c[0]) * m, c[1] + (72 - c[1]) * m, c[2] + (44 - c[2]) * m];
            }
            return c;
        };
    },
    // Cát mịn có gợn, vỏ ốc, sỏi lấm tấm (phần sát nước ướt sẫm, ánh màu trời: xem styledBankSprite)
    sand: noise => (X, Y) => {
        const ripple = Math.sin(X * 0.9 + fbm(noise, X / 12, Y / 3, 2) * 6 + Y * 2) * 0.05;
        const tone = 0.9 + 0.16 * fbm(noise, X / 9, Y / 2, 3) + (noise(X * 1.7, Y * 1.7) - 0.5) * 0.1 + ripple;
        if (noise(X / 1.1 + 40, Y / 1.1) > 0.94) return [148, 142, 130];
        return [114 * tone, 101 * tone, 78 * tone];
    },
    // Biển khơi: chỉ một vệt chân trời mờ
    none: () => () => [34, 44, 66]
};
// Phố cổ, cầu sắt: chân bờ là kè đá
BANK_BODIES.oldtown = BANK_BODIES.stone;
BANK_BODIES.steel = BANK_BODIES.stone;
// Cầu đá: kè xây cùng một kiểu đá với thân cầu (ashlar), gờ đá trên mặt kè
BANK_BODIES.bridge = noise => (X, Y) => {
    if (Y < 1.1) {
        const v = 96 + 24 * fbm(noise, X / 4, Y * 2 + 5, 2) + (Y < 0.35 ? 22 : 0);
        return [v, v * 0.97, v * 0.9];
    }
    return ashlar(noise, X, Y);
};
BANK_BODIES.arch = BANK_BODIES.bridge;

// Đá xếp của cầu đá và kè hai bên cầu: hàng đá so le, khối sáng tối khác nhau, mép trên khối hứng sáng, mép dưới tối,
// mạch vữa, hạt đá lấm tấm. X, Y: điểm ảnh CSS, Y tính từ chân trời xuống (phía trên chân trời âm) nên kè và thân cầu
// chung hàng đá, mạch đá nối liền; trả [r, g, b] trước khi đổ sáng
const ASHLAR_COURSE = 2.8;
const ASHLAR_BLOCK = 7;
function ashlar(noise, X, Y) {
    const row = Math.floor(Y / ASHLAR_COURSE);
    const wy = Y - row * ASHLAR_COURSE;
    const u = (X + row * ASHLAR_BLOCK * 0.55) / ASHLAR_BLOCK;
    const col = Math.floor(u);
    const wx = (u - col) * ASHLAR_BLOCK;
    if (wy < 0.35 || wx < 0.35) return [54, 52, 48];
    const hv = hash(row * 13.3 + col * 5.9);
    let v = (0.86 + 0.2 * hv) * (0.9 + 0.18 * fbm(noise, X / 3, Y / 2 + 9, 2));
    if (noise(X * 1.5 + 70, Y * 1.5) > 0.85) v += 0.1;
    if (wy < 0.8) v *= 1.06;
    else if (ASHLAR_COURSE - wy < 0.55) v *= 0.86;
    return [88 * v, 85 * v, 78 * v];
}

// Đổ sáng thân bờ (kè, chân cầu, bãi cát): ánh trăng rọi từ trên; kè: rong rêu sát nước, chân kè ướt sẫm; bãi cát:
// phần sát nước ướt, ánh màu trời. rel: độ sâu trong mặt bờ (0: mép trên, 1: mép nước); trả [r, g, b]
function bankLight(noise, X, Y, rel, r, gg, b, sand) {
    let lit = 1.15 - 0.4 * rel;
    if (!sand && rel > 0.68) {
        const a = smooth01(0.68, 1, rel) * (0.4 + 0.6 * fbm(noise, X / 6 + 50, Y, 2)) * 0.55;
        r += (30 - r) * a;
        gg += (48 - gg) * a;
        b += (34 - b) * a;
    }
    const wetFrom = sand ? 0.5 : 0.72;
    if (rel > wetFrom) {
        const wet = (rel - wetFrom) / (1 - wetFrom);
        lit *= 1 - (sand ? 0.4 : 0.45) * wet;
        b += 14 * wet;
        gg += 4 * wet;
    }
    if (rel > 0.92 && !sand) lit *= 0.72;
    return [r * lit, gg * lit, b * lit];
}

function styledBankSprite(W, bankPx, k, style) {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = bankPx;
    const g = c.getContext('2d');
    const noise = bankNoise();
    const bankCss = bankPx / k;
    const color = BANK_BODIES[style](noise, bankCss);
    const sand = style === 'sand';
    const img = g.createImageData(W, bankPx);
    const d = img.data;
    for (let y = 0; y < bankPx; y++) {
        const Y = (y + 0.5) / k;
        const rel = Math.min(1, Y / bankCss);
        for (let x = 0; x < W; x++) {
            const X = (x + 0.5) / k;
            let [r, gg, b] = color(X, Y);
            if (style !== 'none') [r, gg, b] = bankLight(noise, X, Y, rel, r, gg, b, sand);
            const i = (y * W + x) * 4;
            d[i] = Math.min(255, r);
            d[i + 1] = Math.min(255, gg);
            d[i + 2] = Math.min(255, b);
            d[i + 3] = 255;
        }
    }
    g.putImageData(img, 0, 0);
    if (style !== 'none') {
        // Ánh nước lấp lánh sát chân bờ
        let seed = 41;
        const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
        for (let x = rnd() * 30 * k; x < W; x += (14 + rnd() * 40) * k) {
            g.fillStyle = `rgba(170, 190, 220, ${0.15 + rnd() * 0.2})`;
            g.fillRect(x, bankPx - Math.max(1, Math.round(2 * k)), (1.5 + rnd() * 3) * k, Math.max(1, Math.round(0.6 * k)));
        }
    }
    return c;
}

// Quầng sáng tròn mềm (đèn, cửa sổ sáng): rgb dạng 'r, g, b'
function radialGlow(g, x, y, r, rgb, a) {
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(${rgb}, ${a})`);
    grad.addColorStop(0.15, `rgba(${rgb}, ${a * 0.6})`);
    grad.addColorStop(0.4, `rgba(${rgb}, ${a * 0.2})`);
    grad.addColorStop(0.7, `rgba(${rgb}, ${a * 0.05})`);
    grad.addColorStop(1, `rgba(${rgb}, 0)`);
    g.fillStyle = grad;
    g.fillRect(x - r, y - r, r * 2, r * 2);
}

// Mặt đá xếp của cầu đá (vẽ từng điểm ảnh, cùng kiểu đá với kè: ashlar). Phủ kiểu source-atop: chỉ tô lên phần đã vẽ
// (thân cầu), giữ nguyên hình. x, w: đoạn phủ; top: độ cao đỉnh trên chân trời; drop: chân cầu dưới chân trời (tới mép
// nước), đoạn này đổ sáng như kè (rêu, ướt sẫm sát nước) để chân cầu liền với kè; phía trên chân trời sáng đều ánh trăng
function stoneFacing(g, x, w, top, drop, k) {
    // Vẽ đúng lưới điểm ảnh của lớp (không co giãn ảnh) cho mạch đá nét như kè
    const m = g.getTransform();
    const dx = Math.floor(x * k + m.e);
    const dy = Math.floor(-top * k + m.f);
    const tex = document.createElement('canvas');
    tex.width = Math.ceil((x + w) * k + m.e) - dx;
    tex.height = Math.ceil(drop * k + m.f) - dy;
    const tg = tex.getContext('2d');
    const img = tg.createImageData(tex.width, tex.height);
    const noise = bankNoise();
    for (let py = 0; py < tex.height; py++) {
        const Y = (dy + py + 0.5 - m.f) / k;
        const lit = 1.12 + 0.06 * Math.min(1, -Y / 40);
        for (let px = 0; px < tex.width; px++) {
            const X = (dx + px + 0.5 - m.e) / k;
            let [r, gg, b] = ashlar(noise, X, Y);
            if (Y >= 0) [r, gg, b] = bankLight(noise, X, Y, Math.min(1, Y / drop), r, gg, b, false);
            else {
                r *= lit;
                gg *= lit;
                b *= lit;
            }
            const i = (py * tex.width + px) * 4;
            img.data[i] = r;
            img.data[i + 1] = gg;
            img.data[i + 2] = b;
            img.data[i + 3] = 255;
        }
    }
    tg.putImageData(img, 0, 0);
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    g.drawImage(tex, dx, dy);
    g.restore();
}

// Vành vòm cầu đá: dải đá múi bưởi quanh vòm (tâm cx, cy, bán kính R, dày ring), mạch giữa các múi, viền sáng ngoài, mép
// trong tối, đá khóa đỉnh vòm
function archRing(g, cx, cy, R, ring, sz) {
    g.fillStyle = '#6a655c';
    g.beginPath();
    g.arc(cx, cy, R + ring, Math.PI, Math.PI * 2);
    g.arc(cx, cy, R, Math.PI * 2, Math.PI, true);
    g.closePath();
    g.fill();
    g.strokeStyle = 'rgba(30, 28, 25, 0.75)';
    g.lineWidth = 0.45 * sz;
    g.beginPath();
    const n = Math.max(9, Math.round(R / (2.4 * sz)));
    for (let i = 0; i <= n; i++) {
        const a = Math.PI + Math.PI * i / n;
        g.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
        g.lineTo(cx + Math.cos(a) * (R + ring), cy + Math.sin(a) * (R + ring));
    }
    g.stroke();
    g.strokeStyle = 'rgba(170, 162, 146, 0.5)';
    g.lineWidth = 0.6 * sz;
    g.beginPath();
    g.arc(cx, cy, R + ring, Math.PI, Math.PI * 2);
    g.stroke();
    g.strokeStyle = 'rgba(20, 18, 16, 0.6)';
    g.beginPath();
    g.arc(cx, cy, R, Math.PI, Math.PI * 2);
    g.stroke();
    g.fillStyle = '#787267';
    g.fillRect(cx - ring * 0.4, cy - R - ring - 0.6 * sz, ring * 0.8, ring + 1.2 * sz);
}

// Chiều cao mặt bờ từ chân trời xuống mép nước (điểm ảnh CSS; cssH: chiều cao khung)
const bankBandCss = cssH => Math.max(8, Math.min(16, cssH * 0.018));

// Hình dáng cầu vòm cong. ground: chân trời (điểm ảnh CSS); R: bán kính vòm, half: nửa chiều dài cầu
function archGeometry(cssW, ground) {
    const R = Math.max(22, Math.min(56, ground * 0.085));
    return { cx: cssW / 2, R, half: Math.min(cssW * 0.32, R * 4.2) };
}

// Cột đèn cổ: đế, thân, mũ, khung kính sáng ấm; quầng sáng và vũng sáng dưới chân vẽ vào lớp sáng (gl)
function drawLampPost(g, gl, x, base, h, sz, warm = '255, 214, 150') {
    g.fillStyle = '#1c1e23';
    g.fillRect(x - 1.5 * sz, base - 2.6 * sz, 3 * sz, 2.6 * sz);
    g.fillRect(x - 0.55 * sz, base - h, 1.1 * sz, h);
    g.fillStyle = 'rgba(130, 134, 142, 0.35)';
    g.fillRect(x - 0.55 * sz, base - h, 0.35 * sz, h - 2.6 * sz);
    const top = base - h;
    g.fillStyle = '#1c1e23';
    g.beginPath();
    g.moveTo(x - 2.7 * sz, top - 5.2 * sz);
    g.lineTo(x, top - 7.6 * sz);
    g.lineTo(x + 2.7 * sz, top - 5.2 * sz);
    g.fill();
    g.fillRect(x - 2.1 * sz, top - 5.4 * sz, 4.2 * sz, 5.4 * sz);
    g.fillStyle = `rgb(${warm})`;
    g.fillRect(x - 1.5 * sz, top - 4.8 * sz, 3 * sz, 4.2 * sz);
    g.fillStyle = '#1c1e23';
    g.fillRect(x - 0.2 * sz, top - 4.8 * sz, 0.4 * sz, 4.2 * sz);
    const cy = top - 2.7 * sz;
    radialGlow(gl, x, cy, 24 * sz, warm, 0.55);
    radialGlow(gl, x, cy, 66 * sz, warm, 0.1);
    gl.save();
    gl.translate(x, base - 0.6 * sz);
    gl.scale(1, 0.22);
    radialGlow(gl, 0, 0, 24 * sz, warm, 0.25);
    gl.restore();
}

// Lan can sắt: tay vịn, thanh dưới, song sắt dày, trụ có núm tròn; tay vịn ánh trăng
function drawRailing(g, cssW, sz) {
    const top = -6.5 * sz;
    const low = -1.5 * sz;
    g.fillStyle = '#202228';
    g.fillRect(0, top - 0.5 * sz, cssW, 1 * sz);
    g.fillRect(0, low - 0.35 * sz, cssW, 0.7 * sz);
    for (let x = 0; x < cssW; x += 2.6 * sz) g.fillRect(x, top, 0.45 * sz, low - top);
    for (let x = 18 * sz; x < cssW; x += 36 * sz) {
        g.fillRect(x - 0.8 * sz, top - 1.2 * sz, 1.6 * sz, -top + 1.2 * sz);
        g.beginPath();
        g.arc(x, top - 1.6 * sz, 1 * sz, 0, Math.PI * 2);
        g.fill();
    }
    g.fillStyle = 'rgba(150, 152, 160, 0.4)';
    g.fillRect(0, top - 0.5 * sz, cssW, 0.3 * sz);
}

// Cây đung đưa theo gió (liễu, cây xanh tán rộng, dừa): mỗi mẫu cây dựng sẵn TREE_STEPS mức ngả (một tấm ảnh chung, mỗi hàng
// một mẫu), mỗi khung chỉ dán đúng mức ngả của từng cây. Ảnh dựng nét hơn màn hình một chút (TREE_RES) cho cây phóng to vẫn
// nét. Hàng nghìn lá mỗi cây nên dựng dần qua các khung (TREE_BUDGET mili giây mỗi khung): khung đầu dựng mỗi mẫu một mức
// ngả hay gặp nhất cho cây hiện ngay, các mức khác dựng sau (chưa có thì dùng mức gần nhất đã dựng)
const TREE_STEPS = 12;
const TREE_RES = 1.3;
const TREE_SWAY = [-0.3, 1.2];
const TREE_BUDGET = 4;
const TREE_ORDER = [4, 3, 5, 6, 2, 7, 1, 8, 9, 0, 10, 11];
let treeAtlasCache = {};

// Dựng thêm vài ô (mẫu, mức ngả) của ảnh cây trong giới hạn thời gian; first: dựng đủ mỗi mẫu một ô
function growTreeAtlas(atlas, first) {
    const start = performance.now();
    const { g, k, sz } = atlas;
    while (atlas.queue.length && (first ? atlas.queue.length > atlas.total - atlas.kinds : performance.now() - start < TREE_BUDGET)) {
        const [t, step] = atlas.queue.shift();
        const sway = TREE_SWAY[0] + (TREE_SWAY[1] - TREE_SWAY[0]) * step / (TREE_STEPS - 1);
        g.setTransform(k, 0, 0, k, (step * atlas.cw + atlas.cw / 2) * k, ((t + 1) * atlas.ch - atlas.foot) * k);
        // Cùng hạt giống cho mọi mức ngả của một mẫu: chỉ dáng ngả đổi, cành lá giữ nguyên
        let seed = 131 + t * 977;
        atlas.draw(g, sz, () => ((seed = (seed * 16807) % 2147483647) / 2147483647), sway, t);
        atlas.built[t * TREE_STEPS + step] = true;
    }
}

function treeAtlas(kind, sz, screenK) {
    const k = screenK * TREE_RES;
    const key = `${kind}_${sz.toFixed(3)}_${k.toFixed(3)}`;
    const cached = treeAtlasCache[kind];
    if (cached && cached.key === key) {
        if (cached.queue.length) growTreeAtlas(cached, false);
        return cached;
    }
    const spec = {
        willow: { kinds: 3, cw: 100 * sz, ch: 64 * sz, foot: 2 * sz, draw: drawWillow },
        oak: { kinds: 3, cw: 64 * sz, ch: 50 * sz, foot: 2 * sz, draw: drawOak },
        palm: { kinds: 4, cw: 112 * sz, ch: 112 * sz, foot: 2 * sz, draw: drawPalm }
    }[kind];
    const c = document.createElement('canvas');
    c.width = Math.ceil(TREE_STEPS * spec.cw * k);
    c.height = Math.ceil(spec.kinds * spec.ch * k);
    const queue = [];
    TREE_ORDER.forEach(step => {
        for (let t = 0; t < spec.kinds; t++) queue.push([t, step]);
    });
    const atlas = { key, canvas: c, g: c.getContext('2d'), k, sz, queue, total: queue.length, built: [], ...spec };
    growTreeAtlas(atlas, true);
    treeAtlasCache[kind] = atlas;
    return atlas;
}

// trees: [{ x, t (mẫu cây), phase (nhịp riêng), s (cỡ so với mẫu, mặc định 1) }]
function drawSwayingTrees(ctx, atlas, trees, ground, clock, calm) {
    const k = atlas.k;
    trees.forEach(tree => {
        const gust = Math.pow(0.5 + 0.5 * Math.sin(tree.x * 0.005 - clock * 0.0006), 2);
        const sway = calm ? 0.15 : 0.22 * Math.sin(clock * 0.0011 + tree.phase) + gust * 0.85;
        const want = Math.round(Math.min(1, Math.max(0, (sway - TREE_SWAY[0]) / (TREE_SWAY[1] - TREE_SWAY[0]))) * (TREE_STEPS - 1));
        // Mức ngả này chưa dựng xong: dùng mức gần nhất đã dựng
        const row = tree.t * TREE_STEPS;
        let step = want;
        for (let d = 1; d < TREE_STEPS && !atlas.built[row + step]; d++) {
            if (want - d >= 0 && atlas.built[row + want - d]) step = want - d;
            else if (want + d < TREE_STEPS) step = want + d;
        }
        const size = tree.s || 1;
        ctx.drawImage(atlas.canvas, step * atlas.cw * k, tree.t * atlas.ch * k, atlas.cw * k, atlas.ch * k,
            tree.x - atlas.cw * size / 2, ground - (atlas.ch - atlas.foot) * size, atlas.cw * size, atlas.ch * size);
    });
}

// Liễu rủ: thân ngắn to, nghiêng ra phía nước, chia vài cành lớn vươn cong lên tạo vòm tán rộng gần bằng chiều cao;
// từ mặt vòm, hàng trăm cành mảnh cong ra rồi rủ thẳng xuống, cành phía ngoài dài gần chạm đất, dọc cành lá liễu thon.
// Mành phía ngoài, phía trên hứng ánh trăng; lòng tán tối. Gió thổi: cả mành ngả theo, cành càng dài đầu càng đưa xa.
function drawWillow(g, sz, rnd, sway, kind) {
    const h = (44 + kind * 5 + rnd() * 6) * sz;
    const half = h * (0.5 + rnd() * 0.1);
    const lean = (kind === 1 ? -1 : 1) * (2 + rnd() * 3) * sz;
    const bend = y => sway * 2.2 * sz * Math.pow(Math.min(1, Math.max(0, -y) / h), 1.5);
    const domeY = -h * 0.66;
    const domeRy = h * 0.34;
    // Thân: gốc loe, thon dần tới chỗ chia cành
    const forkY = -h * (0.3 + rnd() * 0.06);
    const forkX = lean + bend(forkY);
    g.fillStyle = '#19130e';
    g.beginPath();
    g.moveTo(-3 * sz, 0.5);
    g.quadraticCurveTo(-1.4 * sz + lean * 0.3, forkY * 0.5, forkX - 1.3 * sz, forkY);
    g.lineTo(forkX + 1.3 * sz, forkY);
    g.quadraticCurveTo(1.8 * sz + lean * 0.3, forkY * 0.5, 3.2 * sz, 0.5);
    g.closePath();
    g.fill();
    // Cành lớn vươn cong lên mặt vòm
    g.strokeStyle = '#19130e';
    g.lineCap = 'round';
    const nLimbs = 5 + ((rnd() * 2) | 0);
    for (let i = 0; i < nLimbs; i++) {
        const u = i / (nLimbs - 1) * 2 - 1;
        const ex = lean + u * half * 0.75 + (rnd() - 0.5) * 4 * sz;
        const ey = domeY - Math.sqrt(Math.max(0, 1 - u * u * 0.56)) * domeRy * 0.85;
        const cx = forkX + (ex - forkX) * 0.25;
        const cy = forkY + (ey - forkY) * 0.8;
        g.lineWidth = (1.6 - Math.abs(u) * 0.5) * sz;
        g.beginPath();
        g.moveTo(forkX, forkY);
        g.quadraticCurveTo(cx + bend(cy), cy, ex + bend(ey), ey);
        g.stroke();
    }
    // Cành mảnh rủ từ mặt vòm: lớp trong tối vẽ trước, lớp ngoài sáng vẽ sau
    const colors = ['#0c1610', '#122016', '#192b1d', '#213725', '#2c4630', '#3a573c', '#4d6c4c'];
    const leaves = colors.map(() => new Path2D());
    const strands = colors.map(() => new Path2D());
    // Cành rủ kết thành từng mành (mỗi mành một chỗ trên vòm, dài ngắn khác nhau), giữa các mành có khe hở thấy thân,
    // cành lớn và trời
    const cascades = [];
    const nCascades = 13 + ((rnd() * 4) | 0);
    for (let i = 0; i < nCascades; i++) {
        cascades.push({
            u: (i + 0.5 + (rnd() - 0.5) * 0.6) / nCascades * 2 - 1,
            lift: (rnd() - 0.3) * 4 * sz,
            reach: 0.75 + rnd() * 0.5
        });
    }
    const count = 200;
    for (let i = 0; i < count; i++) {
        const cascade = cascades[(rnd() * nCascades) | 0];
        const u = Math.max(-0.98, Math.min(0.98, cascade.u + (rnd() - 0.5) * 1.5 / nCascades));
        const depth = rnd(); // 0: trong lòng tán, 1: mặt ngoài
        const sx0 = lean + u * half * (0.55 + depth * 0.4);
        const sy = domeY - Math.sqrt(1 - u * u) * domeRy * (0.6 + depth * 0.4) - cascade.lift + rnd() * 2 * sz;
        const sx = sx0 + bend(sy);
        const out = Math.sign(u) * (1 + rnd() * 3) * sz * Math.abs(u);
        // Cành ngoài, dưới rủ dài gần chạm đất
        const low = -h * (0.05 + (1 - Math.abs(u)) * 0.12 + (1 - depth) * 0.18 + rnd() * 0.1);
        const hang = Math.max(4 * sz, Math.min(-sy - 1.5 * sz, (low - sy) * cascade.reach));
        const ex = sx + out + sway * hang * 0.34;
        const ey = sy + hang;
        const cx = sx + out * 1.6;
        const cy = sy - (0.5 + rnd() * 1.5) * sz;
        const top = 1 - (sy - (domeY - domeRy)) / (domeRy * 2);
        const strandLight = depth * 0.55 + top * 0.25 + (rnd() - 0.5) * 0.2;
        const si = Math.max(0, Math.min(colors.length - 1, Math.floor(strandLight * (colors.length - 1))));
        strands[si].moveTo(sx, sy);
        strands[si].quadraticCurveTo(cx, cy, ex, ey);
        // Lá thon dọc cành, chĩa chếch xuống xen hai bên; ngọn cành lá thưa, nhỏ dần
        const phase = rnd() * 6;
        const n = 10 + ((hang / sz / 3) | 0);
        for (let j = 1; j <= n; j++) {
            const t = j / n;
            const px = (1 - t) * (1 - t) * sx + 2 * (1 - t) * t * cx + t * t * ex;
            const py = (1 - t) * (1 - t) * sy + 2 * (1 - t) * t * cy + t * t * ey;
            const dir = Math.PI / 2 + (j % 2 ? 0.5 : -0.5) + Math.sin(sway * 6 + phase + j) * 0.15;
            const len = (1.1 + rnd() * 0.8) * sz * (1 - t * 0.35);
            const light = strandLight + (1 - t) * 0.12 + (rnd() - 0.5) * 0.35;
            const ci = Math.max(0, Math.min(colors.length - 1, Math.floor(light * colors.length)));
            leaves[ci].moveTo(px, py);
            leaves[ci].lineTo(px + Math.cos(dir) * len, py + Math.sin(dir) * len);
        }
    }
    // Đầu nét vuông: hàng nghìn nét lá nhỏ, đầu tròn vẽ chậm hơn nhiều mà nhìn không khác
    g.lineCap = 'butt';
    colors.forEach((color, i) => {
        g.strokeStyle = color;
        g.lineWidth = 0.3 * sz;
        g.stroke(strands[i]);
        g.lineWidth = 0.6 * sz;
        g.stroke(leaves[i]);
    });
}

// Cây xanh tán rộng (như sấu, bàng ven hồ): thân thẳng chia ba bốn cành lớn đỡ tán tròn rộng; tán gồm nhiều chùm lá
// chen nhau, giữa các chùm có chỗ hở thấy trời và thấy cành; mỗi chùm sáng phía trên (ánh trăng), tối phía dưới, lòng
// tán tối sâu, mép tán lởm chởm lá. Gió thổi: ngọn ngả nhiều hơn gốc, lá rung khẽ.
function drawOak(g, sz, rnd, sway, kind) {
    const h = (34 + kind * 4 + rnd() * 6) * sz;
    const bend = y => sway * 3 * sz * Math.pow(Math.min(1, Math.max(0, -y) / h), 1.6);
    const crownY = -h * 0.62;
    const rx = h * (0.46 + rnd() * 0.1);
    const ry = h * 0.36;
    const forkY = -h * (0.26 + rnd() * 0.06);
    // Các chùm lá: rải trong hình bầu dục tán, nghiêng về phía trên
    const lumps = [];
    const nLumps = 9 + ((rnd() * 4) | 0);
    for (let i = 0; i < nLumps; i++) {
        const a = -Math.PI / 2 + (i / nLumps - 0.5) * Math.PI * 1.7 + (rnd() - 0.5) * 0.5;
        const d = 0.45 + rnd() * 0.45;
        lumps.push({
            x: Math.cos(a) * rx * d,
            y: crownY + Math.sin(a) * ry * d,
            r: h * (0.14 + rnd() * 0.07)
        });
    }
    lumps.push({ x: (rnd() - 0.5) * rx * 0.3, y: crownY + ry * 0.1, r: h * 0.2 });
    // Thân, cành lớn tới từng chùm
    g.lineCap = 'round';
    g.fillStyle = '#1a140f';
    g.beginPath();
    g.moveTo(-2.4 * sz, 0.5);
    g.quadraticCurveTo(-1.2 * sz, forkY * 0.5, -1.1 * sz + bend(forkY), forkY);
    g.lineTo(1.1 * sz + bend(forkY), forkY);
    g.quadraticCurveTo(1.3 * sz, forkY * 0.5, 2.5 * sz, 0.5);
    g.closePath();
    g.fill();
    g.strokeStyle = '#1a140f';
    lumps.forEach(lump => {
        const fx = bend(forkY);
        const mx = lump.x * 0.45;
        const my = forkY + (lump.y - forkY) * 0.55;
        g.lineWidth = Math.max(0.4, 1.5 - Math.hypot(lump.x, lump.y - forkY) / h) * sz;
        g.beginPath();
        g.moveTo(fx, forkY);
        g.quadraticCurveTo(mx + bend(my), my, lump.x + bend(lump.y), lump.y);
        g.stroke();
    });
    // Lá: hàng trăm lá nhỏ mỗi chùm, dày ở giữa, thưa ở mép; sáng theo hướng trăng chiếu (trên, hơi trái)
    const colors = ['#0b160e', '#102013', '#162a19', '#1e3521', '#28432a', '#345435', '#456843', '#5a7d55'];
    const paths = colors.map(() => new Path2D());
    const lx = -0.42;
    const ly = -0.9;
    lumps.forEach((lump, li) => {
        const count = Math.round(70 * (lump.r / (h * 0.17)) ** 2);
        for (let i = 0; i < count; i++) {
            const a = rnd() * Math.PI * 2;
            const d = Math.pow(rnd(), 0.65) * lump.r;
            const ox = Math.cos(a) * d;
            const oy = Math.sin(a) * d * 0.82;
            const y = lump.y + oy;
            const x = lump.x + ox + bend(y) + Math.sin(sway * 7 + i * 1.7 + li) * 0.2 * sz;
            const inLump = (ox * lx + oy * ly) / lump.r;
            const inCrown = (lump.x / rx) * lx + ((lump.y - crownY) / ry) * ly;
            const rim = Math.hypot(lump.x / rx, (lump.y - crownY) / ry);
            const light = 0.4 + inLump * 0.4 + inCrown * 0.22 + rim * 0.12 + (rnd() - 0.5) * 0.28;
            const ci = Math.max(0, Math.min(colors.length - 1, Math.floor(light * colors.length)));
            const lr = (0.65 + rnd() * 0.5) * sz;
            const rot = rnd() * Math.PI;
            paths[ci].moveTo(x + Math.cos(rot) * lr, y + Math.sin(rot) * lr);
            paths[ci].ellipse(x, y, lr, lr * 0.6, rot, 0, Math.PI * 2);
        }
    });
    paths.forEach((path, i) => {
        g.fillStyle = colors[i];
        g.fill(path);
    });
}

// Cây dừa: thân cong mảnh có ngấn, chùm trái dưới ngọn, tàu lá dài cong xuống, lá chét dày hai bên; gió thổi thì tàu
// lá, ngọn cây ngả theo
function drawPalm(g, sz, rnd, sway, kind) {
    const h = (54 + kind * 7 + rnd() * 8) * sz;
    const lean = (kind % 2 ? -1 : 1) * (10 + rnd() * 12) * sz;
    const topX = lean + sway * 2.2 * sz;
    const topY = -h;
    const at = t => [(1 - t) * (1 - t) * 0 + 2 * (1 - t) * t * (lean * 0.15) + t * t * topX, 2 * (1 - t) * t * (-h * 0.6) + t * t * topY];
    // Thân thon dần, ngấn thân, một bên hứng ánh trăng
    const left = [];
    const right = [];
    for (let i = 0; i <= 16; i++) {
        const t = i / 16;
        const [x, y] = at(t);
        const w = (2.6 - 1.2 * t) * sz / 2;
        left.push([x - w, y]);
        right.push([x + w, y]);
    }
    g.fillStyle = '#2a221b';
    g.beginPath();
    left.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    right.reverse().forEach(([x, y]) => g.lineTo(x, y));
    g.fill();
    g.strokeStyle = 'rgba(12, 9, 7, 0.6)';
    g.lineWidth = 0.4 * sz;
    g.beginPath();
    for (let i = 1; i < 22; i++) {
        const t = i / 22;
        const [x, y] = at(t);
        const w = (2.6 - 1.2 * t) * sz / 2;
        g.moveTo(x - w, y);
        g.lineTo(x + w, y + 0.4 * sz);
    }
    g.stroke();
    g.strokeStyle = 'rgba(120, 112, 98, 0.35)';
    g.beginPath();
    left.slice(2).forEach(([x, y], i) => (i ? g.lineTo(x + 0.3 * sz, y) : g.moveTo(x + 0.3 * sz, y)));
    g.stroke();
    // Chùm trái
    g.fillStyle = '#1d1913';
    [[-1.4, 1.6], [1.3, 1.8], [0, 2.6]].forEach(([dx, dy]) => {
        g.beginPath();
        g.arc(topX + dx * sz, topY + dy * sz, 1.5 * sz, 0, Math.PI * 2);
        g.fill();
    });
    // Tàu lá: tỏa quanh ngọn, cong rủ xuống; gió làm các tàu ngả theo
    const fronds = 11;
    for (let f = 0; f < fronds; f++) {
        const base = -Math.PI + (f / (fronds - 1)) * Math.PI + (rnd() - 0.5) * 0.25;
        const a = base + sway * 0.14 * (1 + Math.cos(base));
        const len = (22 + rnd() * 11) * sz;
        const droop = len * (0.35 + 0.25 * Math.abs(Math.cos(a)));
        const ex = topX + Math.cos(a) * len;
        const ey = topY + Math.sin(a) * len * 0.75 + droop;
        const cx = topX + Math.cos(a) * len * 0.5;
        const cy = topY + Math.sin(a) * len * 0.7 - len * 0.1;
        const pt = t => [(1 - t) * (1 - t) * topX + 2 * (1 - t) * t * cx + t * t * ex, (1 - t) * (1 - t) * topY + 2 * (1 - t) * t * cy + t * t * ey];
        g.strokeStyle = f % 3 ? '#1f2e1d' : '#273a24';
        g.lineWidth = 0.7 * sz;
        g.beginPath();
        g.moveTo(topX, topY);
        g.quadraticCurveTo(cx, cy, ex, ey);
        g.stroke();
        // Lá chét hai bên sống lá, ngắn dần về ngọn, chĩa về phía ngọn và rủ xuống
        g.lineWidth = 0.45 * sz;
        g.beginPath();
        for (let i = 2; i <= 16; i++) {
            const t = i / 16;
            const [x, y] = pt(t);
            const [nx, ny] = pt(Math.min(1, t + 0.05));
            const dir = Math.atan2(ny - y, nx - x);
            const leaf = (4.6 - 3.6 * t) * sz;
            [-1, 1].forEach(side => {
                const la = dir + side * 0.9;
                g.moveTo(x, y);
                g.lineTo(x + Math.cos(la) * leaf, y + Math.sin(la) * leaf + leaf * 0.45);
            });
        }
        g.stroke();
    }
}

// Nhà phố cổ: tường vàng ố, mái ngói âm dương có bờ nóc, nhà hai tầng có mái hiên và ban công gỗ, cửa gỗ, cửa sổ sáng
// đèn (quầng sáng vẽ vào lớp sáng gl)
function drawShophouse(g, gl, x, w, wallH, two, sz, rnd) {
    g.fillStyle = ['#6d5a2f', '#75602f', '#655329', '#6f5732'][(rnd() * 4) | 0];
    g.fillRect(x, -wallH, w, wallH);
    // Tường ố ẩm chân, mảng vữa bong
    g.fillStyle = 'rgba(30, 26, 14, 0.28)';
    g.fillRect(x, -3 * sz, w, 3 * sz);
    for (let i = 0; i < 3; i++) {
        g.fillStyle = `rgba(${rnd() < 0.5 ? '40, 34, 18' : '120, 104, 66'}, 0.18)`;
        g.fillRect(x + rnd() * w * 0.8, -wallH + rnd() * wallH * 0.8, (3 + rnd() * 6) * sz, (2 + rnd() * 4) * sz);
    }
    // Mái chính: hình thang, các hàng ngói, bờ nóc, đầu đao hơi cong
    const roofH = (8 + rnd() * 4) * sz;
    const ov = 3 * sz;
    const roof = (y0, height, x0, x1, overhang) => {
        g.fillStyle = '#3e231a';
        g.beginPath();
        g.moveTo(x0 - overhang, y0);
        g.quadraticCurveTo(x0 - overhang * 0.3, y0 - 0.6 * sz, x0 + (x1 - x0) * 0.16, y0 - height);
        g.lineTo(x1 - (x1 - x0) * 0.16, y0 - height);
        g.quadraticCurveTo(x1 + overhang * 0.3, y0 - 0.6 * sz, x1 + overhang, y0);
        g.closePath();
        g.fill();
        g.strokeStyle = 'rgba(16, 8, 5, 0.6)';
        g.lineWidth = 0.35 * sz;
        g.beginPath();
        for (let i = 1; i < 5; i++) {
            const t = i / 5;
            const yy = y0 - height * t;
            const inset = (x1 - x0) * 0.16 * t;
            g.moveTo(x0 - overhang * (1 - t) + inset * 0.2, yy);
            g.lineTo(x1 + overhang * (1 - t) - inset * 0.2, yy);
        }
        for (let xx = x0; xx < x1; xx += 1.6 * sz) {
            g.moveTo(xx, y0);
            g.lineTo(xx + (x0 + (x1 - x0) / 2 - xx) * 0.16, y0 - height);
        }
        g.stroke();
        g.fillStyle = '#2b1711';
        g.fillRect(x0 + (x1 - x0) * 0.14, y0 - height - 1.2 * sz, (x1 - x0) * 0.72, 1.4 * sz);
    };
    roof(-wallH, roofH, x, x + w, ov);
    // Nhà hai tầng: mái hiên giữa hai tầng, ban công gỗ, cửa sổ tầng trên
    if (two) {
        const ey = -wallH * 0.52;
        roof(ey, 3.6 * sz, x + 1 * sz, x + w - 1 * sz, 2.2 * sz);
        g.fillStyle = '#2a1a12';
        g.fillRect(x + 2 * sz, ey - 9 * sz, w - 4 * sz, 0.6 * sz);
        const win = Math.max(2, Math.round(w / (15 * sz)));
        for (let i = 0; i < win; i++) {
            const ww = w / win * 0.5;
            const wx = x + w * (i + 0.5) / win - ww / 2;
            const wy = -wallH + 3 * sz;
            const lit = rnd() < 0.65;
            g.fillStyle = lit ? 'rgb(255, 190, 110)' : '#2a1a12';
            g.fillRect(wx, wy, ww, wallH * 0.24);
            g.fillStyle = '#2a1a12';
            for (let b = 1; b < 4; b++) g.fillRect(wx + ww * b / 4 - 0.2 * sz, wy, 0.4 * sz, wallH * 0.24);
            if (lit) radialGlow(gl, wx + ww / 2, wy + wallH * 0.12, 14 * sz, '255, 180, 100', 0.3);
        }
    }
    // Cửa gỗ tầng dưới: có cửa hé sáng đèn
    const doors = Math.max(2, Math.round(w / (14 * sz)));
    const dh = two ? wallH * 0.36 : wallH * 0.6;
    for (let i = 0; i < doors; i++) {
        const dw = w / doors * 0.62;
        const dx = x + w * (i + 0.5) / doors - dw / 2;
        g.fillStyle = '#2c1b12';
        g.fillRect(dx, -dh, dw, dh);
        if (rnd() < 0.6) {
            g.fillStyle = `rgba(255, ${150 + ((rnd() * 40) | 0)}, ${70 + ((rnd() * 40) | 0)}, ${0.55 + rnd() * 0.35})`;
            g.fillRect(dx + dw * 0.12, -dh + 1 * sz, dw * 0.76, dh - 1 * sz);
            g.fillStyle = 'rgba(44, 27, 18, 0.85)';
            g.fillRect(dx + dw * 0.48, -dh + 1 * sz, dw * 0.04, dh - 1 * sz);
            radialGlow(gl, dx + dw / 2, -dh * 0.5, 20 * sz, '255, 170, 90', 0.32);
        }
    }
}

const LANTERN_COLORS = ['225, 48, 42', '242, 177, 52', '238, 122, 46', '214, 60, 120', '120, 70, 200', '60, 160, 90'];
let lanternSpriteCache = { key: '', list: null };

// Đèn lồng (mỗi màu một ảnh): quầng sáng, thân bầu có nan, chóp và đáy vàng, tua rua
function lanternSprites(sz, k) {
    const key = `${sz.toFixed(3)}_${k.toFixed(3)}`;
    if (lanternSpriteCache.key === key) return lanternSpriteCache.list;
    const size = 20 * sz;
    const list = LANTERN_COLORS.map(rgb => {
        const c = document.createElement('canvas');
        c.width = c.height = Math.ceil(size * k);
        const g = c.getContext('2d');
        g.setTransform(k, 0, 0, k, size / 2 * k, size / 2 * k);
        radialGlow(g, 0, 0, size / 2, rgb, 0.5);
        const body = g.createRadialGradient(-0.6 * sz, -0.8 * sz, 0, 0, 0, 3 * sz);
        body.addColorStop(0, 'rgb(255, 240, 200)');
        body.addColorStop(0.5, `rgb(${rgb})`);
        body.addColorStop(1, `rgb(${rgb.split(',').map(v => Math.round(v * 0.6)).join(',')})`);
        g.fillStyle = body;
        g.beginPath();
        g.ellipse(0, 0, 2.2 * sz, 2.8 * sz, 0, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = 'rgba(60, 20, 10, 0.35)';
        g.lineWidth = 0.3 * sz;
        [-1, 0, 1].forEach(i => {
            g.beginPath();
            g.ellipse(0, 0, Math.abs(i) * 1.3 * sz + 0.2, 2.8 * sz, 0, 0, Math.PI * 2);
            g.stroke();
        });
        g.fillStyle = '#c9a03a';
        g.fillRect(-1.1 * sz, -3.3 * sz, 2.2 * sz, 0.8 * sz);
        g.fillRect(-1.1 * sz, 2.5 * sz, 2.2 * sz, 0.8 * sz);
        g.fillStyle = `rgb(${rgb})`;
        g.fillRect(-0.25 * sz, 3.3 * sz, 0.5 * sz, 2.4 * sz);
        return { canvas: c, size };
    });
    lanternSpriteCache = { key, list };
    return list;
}

// Dải đèn trên một nhịp vòm cầu sắt: các đốm sáng trắng dọc vòm (mỗi khung tô màu theo sóng màu)
function spanLights(span, sz, k) {
    const pad = 4 * sz;
    const w = span.b - span.a + pad * 2;
    const h = span.rise + pad * 2;
    const c = document.createElement('canvas');
    c.width = Math.ceil(w * k);
    c.height = Math.ceil(h * k);
    const g = c.getContext('2d');
    g.setTransform(k, 0, 0, k, (pad - span.a) * k, (pad + span.rise - span.deck) * k);
    for (let x = span.a; x <= span.b; x += 4 * sz) {
        const y = span.arc((x - span.a) / (span.b - span.a));
        radialGlow(g, x, y, 3 * sz, '255, 255, 255', 0.9);
        g.fillStyle = '#fff';
        g.fillRect(x - 0.4 * sz, y - 0.4 * sz, 0.8 * sz, 0.8 * sz);
    }
    return { canvas: c, x: span.a - pad, y: span.deck - span.rise - pad, w, h };
}

// Phần nhô lên trời của từng kiểu bờ. build: vẽ phần đứng yên (g) và ánh đèn đứng yên (gl, cộng sáng), trả dữ liệu cho
// phần chuyển động; before: vẽ mỗi khung trước phần đứng yên (cây đung đưa phía sau lan can, cầu); frame: vẽ mỗi khung
// sau phần đứng yên; lights: vẽ mỗi khung, cộng sáng (đèn đổi màu)
const BANK_SKYLINES = {
    brick: {
        build(g, gl, { cssW, sz, rnd }) {
            const gap = 170 * sz;
            const lamps = [];
            for (let x = 60 * sz + rnd() * 40 * sz; x < cssW + 20; x += gap * (0.9 + rnd() * 0.2)) lamps.push(x);
            const trees = [];
            lamps.forEach(x => {
                if (rnd() < 0.8) trees.push({ x: x + gap * (0.42 + rnd() * 0.16), t: (rnd() * 3) | 0, phase: rnd() * 6, s: 0.9 + rnd() * 0.25 });
            });
            lamps.forEach(x => drawLampPost(g, gl, x, 0, 30 * sz, sz));
            drawRailing(g, cssW, sz);
            return { trees };
        },
        // Cây sau lan can, cột đèn
        before(ctx, layer, { ground, clock, calm, k }) {
            drawSwayingTrees(ctx, treeAtlas('oak', layer.sz, k), layer.data.trees, ground, clock, calm);
        }
    },
    stone: {
        build(g, gl, { cssW, sz, rnd }) {
            // Thảm cỏ thấp trên mặt kè
            g.fillStyle = '#22361f';
            for (let x = 0; x < cssW; x += 0.8 + rnd() * 1.6) {
                const h = (0.6 + rnd() * 1.8) * sz;
                g.fillRect(x, -h, 0.5, h + 0.3);
            }
            const trees = [];
            for (let x = 40 * sz + rnd() * 60 * sz; x < cssW + 30; x += (120 + rnd() * 110) * sz) {
                trees.push({ x, t: (rnd() * 3) | 0, phase: rnd() * 6, s: 0.85 + rnd() * 0.3 });
            }
            return { trees };
        },
        before(ctx, layer, { ground, clock, calm, k }) {
            drawSwayingTrees(ctx, treeAtlas('willow', layer.sz, k), layer.data.trees, ground, clock, calm);
        }
    },
    sand: {
        build(g, gl, { cssW, sz, rnd }) {
            // Cỏ biển lưa thưa trên cát
            g.strokeStyle = '#2c3a24';
            g.lineWidth = 0.5 * sz;
            g.beginPath();
            for (let x = rnd() * 40; x < cssW; x += (20 + rnd() * 70) * sz) {
                for (let b = 0; b < 5; b++) {
                    const bx = x + (rnd() - 0.5) * 4 * sz;
                    const h = (2 + rnd() * 4) * sz;
                    g.moveTo(bx, 0.3);
                    g.quadraticCurveTo(bx + (rnd() - 0.3) * 2 * sz, -h * 0.6, bx + (rnd() - 0.2) * 3 * sz, -h);
                }
            }
            g.stroke();
            const trees = [];
            let x = 30 * sz + rnd() * 120 * sz;
            while (x < cssW + 40) {
                trees.push({ x, t: (rnd() * 4) | 0, phase: rnd() * 6 });
                // Có chỗ dừa mọc thành cụm hai, ba cây
                if (rnd() < 0.35) trees.push({ x: x + (12 + rnd() * 10) * sz, t: (rnd() * 4) | 0, phase: rnd() * 6 });
                x += (110 + rnd() * 240) * sz;
            }
            return { trees };
        },
        frame(ctx, layer, { ground, clock, calm, k }) {
            drawSwayingTrees(ctx, treeAtlas('palm', layer.sz, k), layer.data.trees, ground, clock, calm);
        }
    },
    oldtown: {
        build(g, gl, { cssW, sz, rnd }) {
            const lanterns = [];
            let x = -rnd() * 20 * sz;
            while (x < cssW + 10) {
                const w = (40 + rnd() * 34) * sz;
                const two = rnd() < 0.55;
                const wallH = (two ? 30 + rnd() * 6 : 17 + rnd() * 6) * sz;
                drawShophouse(g, gl, x, w, wallH, two, sz, rnd);
                // Dây đèn lồng dưới mái hiên
                const y = two ? -wallH * 0.52 + 2.4 * sz : -wallH + 2.4 * sz;
                const n = Math.max(3, Math.round(w / (8 * sz)));
                g.strokeStyle = 'rgba(20, 14, 10, 0.85)';
                g.lineWidth = 0.4 * sz;
                g.beginPath();
                g.moveTo(x + 1 * sz, y);
                g.quadraticCurveTo(x + w / 2, y + 4 * sz, x + w - 1 * sz, y);
                g.stroke();
                for (let i = 0; i < n; i++) {
                    const t = (i + 0.5) / n;
                    lanterns.push({ x: x + 1 * sz + (w - 2 * sz) * t, y: y + 4 * sz * 2 * t * (1 - t), c: (rnd() * LANTERN_COLORS.length) | 0, phase: rnd() * 6 });
                }
                x += w + (rnd() < 0.18 ? (3 + rnd() * 6) * sz : 0);
            }
            return { lanterns };
        },
        frame(ctx, layer, { ground, clock, calm, k }) {
            const list = lanternSprites(layer.sz, k);
            const sz = layer.sz;
            layer.data.lanterns.forEach(l => {
                // Đèn lồng đung đưa theo gió quanh chỗ buộc
                const a = calm ? 0 : Math.sin(clock * 0.0016 + l.phase) * 0.14 + Math.sin(clock * 0.0041 + l.phase * 2) * 0.04;
                const s = list[l.c];
                const px = l.x + Math.sin(a) * 3.4 * sz;
                const py = ground + l.y + Math.cos(a) * 3.4 * sz;
                ctx.drawImage(s.canvas, px - s.size / 2, py - s.size / 2, s.size, s.size);
            });
        }
    },
    // Cầu đá cổ nhiều vòm bắc qua sông: mặt cầu vồng dần lên giữa, hai đầu thoải xuống mặt kè; các vòm bán nguyệt to dần
    // vào giữa (vòm giữa cao nhất), chân vòm và trụ cầu đứng dưới nước (tới mép nước như kè hai bên) nên mỗi vòm cùng bóng
    // khép thành một vòng tròn; trụ có mố rẽ nước; lan can đá lỗ con tiện, trụ lan can đầu cầu; đèn trên mỗi trụ cầu; cây
    // hai đầu cầu
    bridge: {
        build(g, gl, { cssW, sz, rnd, ground, k, drop }) {
            const cx = cssW / 2;
            const Htop = Math.max(24, Math.min(58, ground * 0.1));
            const half = Math.min(cssW * 0.38, Htop * 6.2);
            const x0 = cx - half;
            const x1 = cx + half;
            const rise = x => Math.pow(0.5 + 0.5 * Math.cos(Math.PI * Math.min(1, Math.abs(x - cx) / half)), 0.7);
            const deckAt = x => -Htop * rise(x);
            const foot = drop + 0.5;
            // Vòm: tâm ở mép nước, bán kính theo độ cao mặt cầu phía trên (chừa dải đá trên đỉnh vòm); trụ giữa các vòm
            const spandrel = 7 * sz;
            const radiusAt = x => Htop * rise(x) + foot - spandrel;
            const arches = [{ cx, r: radiusAt(cx) }];
            const piers = [];
            for (let edge = cx + arches[0].r, last = arches[0].r; ;) {
                const pier = Math.max(4 * sz, last * 0.3);
                let r = last;
                let c = edge + pier + r;
                for (let it = 0; it < 5; it++) {
                    r = radiusAt(c);
                    c = edge + pier + r;
                }
                if (r < Math.max(8 * sz, arches[0].r * 0.3) || c + r > cx + half * 0.88) break;
                piers.push({ x: edge + pier / 2, w: pier }, { x: 2 * cx - edge - pier / 2, w: pier });
                arches.push({ cx: c, r }, { cx: 2 * cx - c, r });
                edge = c + r;
                last = r;
            }
            // Thân cầu, khoét các vòm (chân cầu lấn sang kè một điểm ảnh cho chỗ nối không hở)
            const body = new Path2D();
            body.moveTo(x0 - 1, foot);
            body.lineTo(x0 - 1, 0);
            for (let x = x0; x <= x1; x += 2) body.lineTo(x, deckAt(x));
            body.lineTo(x1 + 1, 0);
            body.lineTo(x1 + 1, foot);
            body.closePath();
            arches.forEach(({ cx: ax, r }) => {
                body.moveTo(ax - r, foot);
                body.arc(ax, foot, r, Math.PI, Math.PI * 2);
                body.closePath();
            });
            g.fillStyle = '#5c5850';
            g.fill(body, 'evenodd');
            stoneFacing(g, x0 - 1, half * 2 + 2, Htop + 1, foot, k);
            // Gờ mép mặt cầu chạy theo dáng cầu
            g.strokeStyle = '#78736a';
            g.lineWidth = 1.6 * sz;
            g.beginPath();
            for (let x = x0; x <= x1; x += 2) (x === x0 ? g.moveTo(x, deckAt(x) + 0.9 * sz) : g.lineTo(x, deckAt(x) + 0.9 * sz));
            g.stroke();
            arches.forEach(({ cx: ax, r }) => archRing(g, ax, foot, r, Math.max(2.6 * sz, r * 0.09), sz));
            // Mố rẽ nước ở chân trụ: nhô ra hai bên trụ, mũ vát, ngấn nước sẫm
            piers.forEach(({ x, w }) => {
                const pw = w + 2.4 * sz;
                const ph = Math.min(foot - 1, 7 * sz);
                g.fillStyle = '#56524a';
                g.beginPath();
                g.moveTo(x - pw / 2, foot);
                g.lineTo(x - pw / 2, foot - ph);
                g.lineTo(x, foot - ph - 2.6 * sz);
                g.lineTo(x + pw / 2, foot - ph);
                g.lineTo(x + pw / 2, foot);
                g.closePath();
                g.fill();
                g.fillStyle = 'rgba(160, 152, 138, 0.4)';
                g.fillRect(x - pw / 2, foot - ph, 0.6 * sz, ph);
                g.fillStyle = 'rgba(10, 16, 12, 0.5)';
                g.fillRect(x - pw / 2, foot - 2 * sz, pw, 2 * sz);
            });
            // Lan can đá lỗ con tiện, gờ trên sáng; trụ lan can hai đầu cầu
            const from = x0 + half * 0.1;
            const to = x1 - half * 0.1;
            g.fillStyle = '#69645a';
            g.beginPath();
            for (let x = from; x <= to; x += 2) (x === from ? g.moveTo(x, deckAt(x)) : g.lineTo(x, deckAt(x)));
            for (let x = to; x >= from; x -= 2) g.lineTo(x, deckAt(x) - 3.8 * sz);
            g.closePath();
            g.fill();
            g.fillStyle = 'rgba(24, 22, 20, 0.75)';
            for (let x = from + 2 * sz; x < to - 2 * sz; x += 4.2 * sz) g.fillRect(x, deckAt(x) - 3 * sz, 1.6 * sz, 2.2 * sz);
            g.fillStyle = 'rgba(170, 162, 146, 0.5)';
            for (let x = from; x <= to; x += 2) g.fillRect(x, deckAt(x) - 3.9 * sz, 2.2, 0.5 * sz);
            [from, to].forEach(x => {
                g.fillStyle = '#726d62';
                g.fillRect(x - 1.6 * sz, deckAt(x) - 6 * sz, 3.2 * sz, 6 * sz);
                g.fillStyle = '#857f74';
                g.fillRect(x - 2 * sz, deckAt(x) - 6.8 * sz, 4 * sz, 1 * sz);
            });
            // Đèn trên cầu phía trên mỗi trụ
            piers.forEach(({ x }) => drawLampPost(g, gl, x, deckAt(x) - 3.8 * sz, 11 * sz, sz * 0.8));
            // Cây hai đầu cầu (vẽ mỗi khung cho đung đưa)
            const trees = [];
            for (let i = 0; i < 3; i++) {
                trees.push({ x: x0 - (22 + i * 46 + rnd() * 16) * sz, t: (rnd() * 3) | 0, phase: rnd() * 6, s: 1.05 - i * 0.08 });
                trees.push({ x: x1 + (22 + i * 46 + rnd() * 16) * sz, t: (rnd() * 3) | 0, phase: rnd() * 6, s: 1.05 - i * 0.08 });
            }
            // foot: khoảng chân cầu (không có kè); openings: lòng các vòm (tâm ở mép nước)
            return { trees, foot: [x0, x1], openings: arches.map(({ cx: ax, r }) => ({ cx: ax, rx: r, ry: r })) };
        },
        before(ctx, layer, { ground, clock, calm, k }) {
            drawSwayingTrees(ctx, treeAtlas('oak', layer.sz, k), layer.data.trees, ground, clock, calm);
        }
    },
    // Cầu vòm cong (một cây cầu ở giữa): mặt cầu vồng lên, hai đầu thoải xuống bờ; một vòm tròn lớn chạm mặt nước nên
    // vòm và bóng dưới nước khép thành vòng tròn; đá xếp, vành vòm đá múi bưởi, đá khóa; lan can trụ đá hai thanh vịn chạy
    // theo dáng cầu; đèn nhỏ hai đầu cầu; liễu rủ lớn bên trái, cây xanh bên phải
    arch: {
        // Cầu đứng dưới nước như kè hai bên: thân cầu, chân vòm xuống tới mép nước (drop dưới chân trời, phần này lớp
        // mặt nước để lộ ra), tâm vòm ở mép nước nên vòm và bóng của nó khép thành vòng tròn. Hai đầu cầu nối vào mặt kè.
        build(g, gl, { cssW, sz, rnd, ground, k, drop }) {
            const { cx, R, half } = archGeometry(cssW, ground);
            const top = R + 9 * sz - drop;
            const deckAt = x => {
                const t = Math.min(1, Math.abs(x - cx) / half);
                return -top * Math.pow(0.5 + 0.5 * Math.cos(Math.PI * t), 0.85);
            };
            const foot = drop + 0.5;
            // Thân cầu, khoét vòm (chân cầu lấn sang kè một điểm ảnh cho chỗ nối không hở)
            const body = new Path2D();
            body.moveTo(cx - half - 1, foot);
            body.lineTo(cx - half - 1, 0);
            for (let x = cx - half; x <= cx + half; x += 2) body.lineTo(x, deckAt(x));
            body.lineTo(cx + half + 1, 0);
            body.lineTo(cx + half + 1, foot);
            body.closePath();
            body.moveTo(cx - R, foot);
            body.arc(cx, foot, R, Math.PI, Math.PI * 2);
            body.closePath();
            g.fillStyle = '#5e5a52';
            g.fill(body, 'evenodd');
            stoneFacing(g, cx - half - 1, half * 2 + 2, top + 1, foot, k);
            // Gờ mép mặt cầu chạy theo dáng cầu
            g.strokeStyle = '#7a756b';
            g.lineWidth = 1.8 * sz;
            g.beginPath();
            for (let x = cx - half; x <= cx + half; x += 2) (x === cx - half ? g.moveTo(x, deckAt(x) + 1 * sz) : g.lineTo(x, deckAt(x) + 1 * sz));
            g.stroke();
            // Vành vòm: dải đá múi bưởi quanh vòm, viền sáng, đá khóa đỉnh
            archRing(g, cx, foot, R, 5 * sz, sz);
            // Lan can: trụ đá có mũ, hai thanh vịn uốn theo mặt cầu
            const from = cx - half * 0.94;
            const to = cx + half * 0.94;
            const posts = 11;
            const rail = (dy, width, color) => {
                g.strokeStyle = color;
                g.lineWidth = width;
                g.beginPath();
                for (let x = from; x <= to; x += 2) (x === from ? g.moveTo(x, deckAt(x) - dy) : g.lineTo(x, deckAt(x) - dy));
                g.stroke();
            };
            rail(3.4 * sz, 0.8 * sz, '#77726a');
            rail(6.4 * sz, 1 * sz, '#807a70');
            rail(6.8 * sz, 0.35 * sz, 'rgba(190, 182, 166, 0.5)');
            for (let i = 0; i < posts; i++) {
                const x = from + (to - from) * i / (posts - 1);
                const y = deckAt(x);
                g.fillStyle = '#6f6a60';
                g.fillRect(x - 1 * sz, y - 8.2 * sz, 2 * sz, 8.2 * sz);
                g.fillStyle = '#857f74';
                g.fillRect(x - 1.4 * sz, y - 9.2 * sz, 2.8 * sz, 1.2 * sz);
                g.fillStyle = 'rgba(190, 182, 166, 0.45)';
                g.fillRect(x - 1 * sz, y - 8.2 * sz, 0.5 * sz, 8.2 * sz);
            }
            // Đèn nhỏ trên hai trụ đầu cầu
            [from, to].forEach(x => {
                const y = deckAt(x) - 10.6 * sz;
                g.fillStyle = '#ffd89a';
                g.fillRect(x - 0.9 * sz, y - 1.2 * sz, 1.8 * sz, 2 * sz);
                radialGlow(gl, x, y, 18 * sz, '255, 214, 150', 0.45);
            });
            // Cây hai bên cầu: liễu rủ lớn bên trái, cây xanh tán rộng bên phải (vẽ mỗi khung cho đung đưa)
            const oaks = [];
            for (let i = 0; i < 3; i++) oaks.push({ x: cx + half + (22 + i * 44 + rnd() * 14) * sz, t: i % 3, phase: rnd() * 6, s: 1.15 - i * 0.12 });
            oaks.push({ x: cx - half - (84 + rnd() * 20) * sz, t: 1, phase: rnd() * 6, s: 0.85 });
            // Cỏ lau ven chân cầu
            g.strokeStyle = '#2a3f26';
            g.lineWidth = 0.5 * sz;
            g.beginPath();
            for (let x = cx - half - 60 * sz; x < cx - half + 8 * sz; x += 1.2 * sz) {
                const h = (2 + rnd() * 5) * sz;
                g.moveTo(x, 0.3);
                g.quadraticCurveTo(x + (rnd() - 0.3) * 1.5 * sz, -h * 0.6, x + (rnd() - 0.2) * 2.4 * sz, -h);
            }
            g.stroke();
            // foot: khoảng chân cầu (không có kè); openings: lòng vòm (tâm ở mép nước)
            return { oaks, willows: [{ x: cx - half - 24 * sz, t: 0, phase: 1.3, s: 1.25 }], foot: [cx - half, cx + half], openings: [{ cx, rx: R, ry: R }] };
        },
        before(ctx, layer, { ground, clock, calm, k }) {
            drawSwayingTrees(ctx, treeAtlas('oak', layer.sz, k), layer.data.oaks, ground, clock, calm);
            drawSwayingTrees(ctx, treeAtlas('willow', layer.sz, k), layer.data.willows, ground, clock, calm);
        }
    },
    steel: {
        build(g, gl, { cssW, sz }) {
            const x0 = cssW * 0.04;
            const x1 = cssW * 0.96;
            const n = Math.max(3, Math.min(6, Math.round((x1 - x0) / (190 * sz))));
            const spanW = (x1 - x0) / n;
            const deck = -6 * sz;
            const rise = Math.min(spanW * 0.26, 36 * sz);
            // Trụ đá đỡ các nhịp
            for (let i = 0; i <= n; i++) {
                const px = x0 + i * spanW;
                g.fillStyle = '#4f4b45';
                g.fillRect(px - 3.2 * sz, deck, 6.4 * sz, -deck);
                g.fillStyle = '#625d55';
                g.fillRect(px - 4 * sz, deck - 0.8 * sz, 8 * sz, 1.2 * sz);
            }
            // Dầm mặt cầu
            g.fillStyle = '#3c4454';
            g.fillRect(x0 - 4 * sz, deck - 2 * sz, x1 - x0 + 8 * sz, 2.2 * sz);
            g.fillStyle = 'rgba(150, 160, 180, 0.35)';
            g.fillRect(x0, deck - 2 * sz, x1 - x0, 0.35 * sz);
            const spans = [];
            for (let i = 0; i < n; i++) {
                const a = x0 + i * spanW + 2 * sz;
                const b = a + spanW - 4 * sz;
                const top = deck - 2 * sz;
                const arc = t => top - rise * Math.pow(Math.sin(Math.PI * t), 0.85);
                // Dàn thép: thanh đứng và thanh chéo giữa vòm và mặt cầu
                const panels = 12;
                const at = t => a + (b - a) * t;
                g.strokeStyle = '#4a5468';
                g.lineWidth = 0.6 * sz;
                g.beginPath();
                for (let p = 0; p <= panels; p++) {
                    const t = p / panels;
                    g.moveTo(at(t), top);
                    g.lineTo(at(t), arc(t));
                }
                for (let p = 0; p < panels; p++) {
                    const t0 = p / panels;
                    const t1 = (p + 1) / panels;
                    if (p % 2) {
                        g.moveTo(at(t0), top);
                        g.lineTo(at(t1), arc(t1));
                    } else {
                        g.moveTo(at(t0), arc(t0));
                        g.lineTo(at(t1), top);
                    }
                }
                g.stroke();
                // Vòm chính: thanh trên dày, mép trên ánh trăng
                g.strokeStyle = '#59637a';
                g.lineWidth = 1.7 * sz;
                g.beginPath();
                for (let t = 0; t <= 1.0001; t += 0.02) (t ? g.lineTo(at(t), arc(t)) : g.moveTo(at(t), arc(t)));
                g.stroke();
                g.strokeStyle = 'rgba(170, 180, 200, 0.35)';
                g.lineWidth = 0.4 * sz;
                g.beginPath();
                for (let t = 0; t <= 1.0001; t += 0.02) (t ? g.lineTo(at(t), arc(t) - 0.7 * sz) : g.moveTo(at(t), arc(t) - 0.7 * sz));
                g.stroke();
                spans.push({ a, b, rise, deck: top, arc });
            }
            // Đèn vàng dọc mặt cầu
            for (let x = x0; x < x1; x += 7 * sz) radialGlow(gl, x, deck - 2.4 * sz, 3.5 * sz, '255, 224, 170', 0.55);
            return { spans };
        },
        lights(ctx, layer, { ground, clock, calm, k }) {
            if (!layer.data.dots) layer.data.dots = layer.data.spans.map(span => spanLights(span, layer.sz, k));
            layer.data.dots.forEach((dots, i) => {
                // Dải đèn mỗi nhịp một màu, cả cầu chuyển màu chầm chậm như sóng lan
                const hue = (clock * (calm ? 0.004 : 0.012) + i * 48) % 360;
                const tmp = tintCanvas(dots.canvas, `hsl(${hue | 0}, 90%, 62%)`);
                ctx.drawImage(tmp, 0, 0, dots.canvas.width, dots.canvas.height, dots.x, ground + dots.y, dots.w, dots.h);
            });
        }
    }
};

// Tô màu một ảnh (giữ hình, thay màu) vào canvas tạm dùng chung
let tintCache = null;
function tintCanvas(src, color) {
    if (!tintCache) tintCache = document.createElement('canvas');
    if (tintCache.width < src.width || tintCache.height < src.height) {
        tintCache.width = Math.max(tintCache.width, src.width);
        tintCache.height = Math.max(tintCache.height, src.height);
    }
    const g = tintCache.getContext('2d');
    g.globalCompositeOperation = 'copy';
    g.drawImage(src, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = color;
    g.fillRect(0, 0, src.width, src.height);
    g.globalCompositeOperation = 'source-over';
    return tintCache;
}

let skylineCache = { key: '' };

// Phần đứng yên của kiểu bờ: vẽ sẵn (và lớp ánh đèn riêng để cộng sáng) theo cỡ khung, mật độ điểm ảnh
// drop: chiều cao mặt bờ dưới chân trời; lớp vẽ kéo xuống tới mép nước (chân cầu đứng dưới nước)
function skylineLayer(style, cssW, ground, k, drop) {
    const sz = Math.max(0.6, Math.min(1.25, Math.min(ground / 420, cssW / 700)));
    const key = `${style}_${Math.round(cssW)}_${Math.round(ground)}_${k.toFixed(3)}_${drop.toFixed(2)}`;
    if (skylineCache.key === key) return skylineCache;
    const up = Math.ceil(120 * sz);
    const make = () => {
        const c = document.createElement('canvas');
        c.width = Math.ceil(cssW * k);
        c.height = Math.ceil((up + drop + 4) * k);
        const g = c.getContext('2d');
        g.setTransform(k, 0, 0, k, 0, up * k);
        return [c, g];
    };
    const [canvas, g] = make();
    const [glow, gl] = make();
    let seed = 97;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const data = BANK_SKYLINES[style].build(g, gl, { cssW, sz, rnd, ground, k, drop }) || {};
    skylineCache = { key, style, canvas, glow, up, drop, k, data, sz };
    return skylineCache;
}

// Ánh pháo rọi lên cầu, nhà, cây: lúc trời sáng lên theo màu pháo thì cộng thêm màu đó lên phần đứng yên
function litByFireworks(ctx, sprite, x, y, w, h, glow) {
    if (!glow || glow.r + glow.g + glow.b < 4) return;
    const tmp = tintCanvas(sprite, `rgb(${Math.min(255, glow.r * 2.2) | 0}, ${Math.min(255, glow.g * 2.2) | 0}, ${Math.min(255, glow.b * 2.2) | 0})`);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.9;
    ctx.drawImage(tmp, 0, 0, sprite.width, sprite.height, x, y, w, h);
    ctx.restore();
}

// Vẽ phần nhô lên trời của kiểu bờ khác ở lớp bầu trời (ground: chân trời, điểm ảnh CSS)
function drawStyledSkyline(ctx, cssW, ground, clock, calm, glow, drop) {
    const style = BANK_SKYLINES[bankStyle];
    if (!style) return;
    const k = ctx.getTransform().a || 1;
    const layer = skylineLayer(bankStyle, cssW, ground, k, drop);
    const w = layer.canvas.width / k;
    const h = layer.canvas.height / k;
    const y0 = ground - layer.up;
    const opts = { ground, clock, calm, cssW, k };
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    if (style.before) style.before(ctx, layer, opts);
    ctx.drawImage(layer.canvas, 0, y0, w, h);
    litByFireworks(ctx, layer.canvas, 0, y0, w, h, glow);
    if (style.frame) style.frame(ctx, layer, opts);
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(layer.glow, 0, y0, w, h);
    if (style.lights) style.lights(ctx, layer, opts);
    ctx.restore();
}

// Bãi cát: bọt sóng trắng đứt quãng dọc bờ, sóng vỗ vào rồi rút ra (dải bọt dịch lên xuống, sáng mờ theo nhịp)
let foamCache = null;
function drawBeachFoam(ctx, W, surf, k, time, calm) {
    if (!foamCache || foamCache.width !== W || foamCache.k !== k) {
        foamCache = document.createElement('canvas');
        foamCache.width = W;
        foamCache.height = Math.max(2, Math.round(3 * k));
        foamCache.k = k;
        const g = foamCache.getContext('2d');
        const noise = bankNoise();
        for (let x = 0; x < W; x++) {
            const a = smooth01(0.45, 0.75, fbm(noise, x / k / 14 + 200, 3, 3));
            if (a <= 0) continue;
            g.fillStyle = `rgba(225, 235, 245, ${a * 0.8})`;
            g.fillRect(x, 0, 1, foamCache.height * (0.5 + 0.5 * a));
        }
    }
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 2; i++) {
        const phase = calm ? 0.5 : 0.5 + 0.5 * Math.sin(time * 0.0011 + i * 2.4);
        const y = surf + (i * 2.4 + phase * 2.2) * k;
        ctx.globalAlpha = (0.35 + 0.4 * (1 - phase)) * (i ? 0.6 : 1);
        const shift = (((time * 0.004 * k * (i ? -1 : 1)) % W) + W) % W;
        ctx.drawImage(foamCache, -shift, y);
        ctx.drawImage(foamCache, W - shift, y);
    }
    ctx.restore();
}

// Lá bèo (lá súng) nằm phẳng trên nước (nhìn chếch nên dẹt), có khe hình nêm; kiểu 3 có hoa súng hồng
function padSprite(variant) {
    const S = Math.max(3, spriteRes);
    const key = `pad${variant}@${S}`;
    if (sprites[key]) return sprites[key];
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

// Ảnh vẽ từng điểm ảnh (khúc gỗ, đá, gò đất) tốn vài chục mili giây mỗi ảnh nên dựng thành từng đoạn: cần ngay thì
// dựng một mạch, còn lại dựng dần lúc máy rảnh (warmWaterSprites) để vật mới trôi vào không làm khựng khung hình
function built(key, make) {
    if (!sprites[key]) {
        const job = make();
        let step = job.next();
        while (!step.done) step = job.next();
        sprites[key] = step.value;
    }
    return sprites[key];
}

const waterWarm = new Set();
function warmWaterSprites() {
    const S = spriteRes;
    if (waterWarm.has(S)) return;
    waterWarm.add(S);
    const list = [];
    for (let v = 0; v < LOG_KINDS; v++) list.push([`log${v}@${S}`, () => buildLog(v, S)]);
    for (let v = 0; v < 3; v++) list.push([`rock${v}@${S}`, () => buildRock(v, S)]);
    for (let v = 0; v < 2; v++) list.push([`mound${v}@${S}`, () => buildMound(v, S)]);
    let item = null;
    let job = null;
    const step = () => {
        const until = performance.now() + 5;
        while (performance.now() < until) {
            if (!job) {
                item = list.find(([key]) => !sprites[key]);
                if (!item) return;
                job = item[1]();
            }
            const result = job.next();
            if (result.done) {
                if (!sprites[item[0]]) sprites[item[0]] = result.value;
                job = null;
            }
        }
        schedule();
    };
    const schedule = () => (window.requestIdleCallback ? window.requestIdleCallback(step, { timeout: 200 }) : setTimeout(step, 16));
    schedule();
}

// Cụm đá giữa dòng vẽ từng điểm ảnh: mỗi tảng méo tự nhiên (bán kính gồ ghề theo nhiễu), đổ bóng theo mặt cong (mặt
// trên trái hứng sáng), vân đá hoa cương lấm tấm, mảng sáng tối, vết nứt mảnh, rêu trên đỉnh, chân đá ướt sẫm. Khung
// 60 x 34, mặt nước ở hàng 24; vẽ sẵn gấp đôi cho nét.
function rockSprite(variant) {
    const S = spriteRes;
    return built(`rock${variant}@${S}`, () => buildRock(variant, S));
}

function* buildRock(variant, S = 2) {
    const W = 60;
    const H = 34;
    const wl = 24;
    const c = document.createElement('canvas');
    c.width = W * S;
    c.height = H * S;
    const g = c.getContext('2d');
    const noise = makeNoise(91 + variant * 17);
    const stones = [
        [[30, 22, 15, 12], [16, 25, 9, 7], [45, 25, 10, 8]],
        [[24, 21, 13, 13], [40, 23, 12, 9], [12, 26, 6, 5], [52, 26, 6, 4]],
        [[30, 20, 18, 11], [50, 25, 7, 5]]
    ][variant % 3];
    const tones = [[125, 114, 98], [138, 127, 109], [111, 102, 86], [131, 120, 102]];
    const img = g.createImageData(W * S, H * S);
    const d = img.data;
    for (let py = 0; py < H * S; py++) {
        if (py % (16 / S) === 16 / S - 1) yield;
        const Y = (py + 0.5) / S;
        for (let px = 0; px < W * S; px++) {
            const X = (px + 0.5) / S;
            // Tảng nào chứa điểm này (tảng sau đè tảng trước)
            let hit = null;
            stones.forEach(([sx, sy, rx, ry], i) => {
                const dx = (X - sx) / rx;
                const dy = (Y - sy) / ry;
                const ang = Math.atan2(dy, dx);
                const rr = 1 + (noise(Math.cos(ang) * 1.4 + i * 5, Math.sin(ang) * 1.4 + i * 3) - 0.5) * 0.36;
                const dist = Math.sqrt(dx * dx + dy * dy) / rr;
                if (dist <= 1) hit = { i, dx: dx / rr, dy: dy / rr, dist };
            });
            if (!hit) continue;
            const nz = Math.sqrt(Math.max(0, 1 - hit.dist * hit.dist));
            const lambert = Math.min(1, Math.max(0, -0.42 * hit.dx - 0.7 * hit.dy + 0.58 * nz));
            const shade = 0.3 + 0.85 * lambert;
            const tone = tones[hit.i % 4];
            const patch = fbm(noise, X / 7 + hit.i * 13, Y / 7, 4);
            let col = tone.map(v => v * (0.78 + 0.44 * patch));
            const grain = noise(X / 0.9 + 50, Y / 0.9 + 20);
            if (grain > 0.84) col = col.map(v => v + 26);
            else if (grain < 0.12) col = col.map(v => v * 0.72);
            if (Math.abs(fbm(noise, X / 10 + 70, Y / 10 + 30, 3) - 0.5) < 0.016) col = col.map(v => v * 0.55);
            const moss = fbm(noise, X / 5 + 90, Y / 5 + 40, 3);
            if (hit.dy < -0.3 && moss > 0.55) {
                const m = Math.min(1, (moss - 0.55) * 5) * 0.85;
                col = [col[0] + (64 - col[0]) * m, col[1] + (98 - col[1]) * m, col[2] + (52 - col[2]) * m];
            }
            if (Y > wl - 3) col = col.map(v => v * 0.68);
            const i = (py * W * S + px) * 4;
            d[i] = Math.min(255, col[0] * shade);
            d[i + 1] = Math.min(255, col[1] * shade);
            d[i + 2] = Math.min(255, col[2] * shade);
            d[i + 3] = 255;
        }
    }
    g.putImageData(img, 0, 0);
    sinkBelow(g, W * S, H * S, wl * S, 0.55);
    c.wl = wl * S;
    const peak = stones.reduce((a, b) => (b[1] - b[3] < a[1] - a[3] ? b : a));
    c.top = (peak[1] - peak[3] + 1) * S;
    c.perchX = peak[0] / W - 0.5;
    return c;
}

// Gò đất giữa dòng vẽ từng điểm ảnh: mép trên gồ ghề, đỉnh phủ cỏ dày (mép cỏ lởm chởm), sườn đất có hạt, sỏi lấm tấm,
// sườn trái hứng sáng; sát mặt nước là dải bùn ướt sẫm có ánh lấp lánh; dưới nước ngả màu nước. Lau sậy cao vẽ riêng
// mỗi khung hình (đung đưa theo gió, xem drawRock): ảnh ghi reeds (vị trí gốc, độ cao, màu) theo đơn vị của khung 120 x 44.
// Mặt nước ở hàng 34. Vẽ sẵn gấp đôi cho nét.
function moundSprite(variant) {
    const S = spriteRes;
    return built(`mound${variant}@${S}`, () => buildMound(variant, S));
}

function* buildMound(variant, S = 2) {
    const W = 120;
    const H = 44;
    const wl = 34;
    const c = document.createElement('canvas');
    c.width = W * S;
    c.height = H * S;
    const g = c.getContext('2d');
    let seed = 41 + variant * 13;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const noise = makeNoise(77 + variant * 29);
    const peak = variant ? 12 : 10;
    // Mép trên: dáng gò lệch một bên (một sườn dốc, một sườn thoải), gồ ghề theo nhiễu
    const skew = variant ? -1 : 1;
    const profile = X => {
        const t = (X - 3) / 114;
        if (t <= 0 || t >= 1) return Infinity;
        const tt = Math.pow(t, skew > 0 ? 0.8 : 1.25);
        const hump = Math.pow(Math.sin(Math.PI * tt), 0.6) * (1 + 0.1 * Math.sin(t * 9 + variant * 2));
        return wl + 4 - (wl + 4 - peak) * hump + (fbm(noise, X / 12, 1.7, 3) - 0.5) * 6 * Math.sin(Math.PI * t);
    };
    const img = g.createImageData(W * S, H * S);
    const d = img.data;
    for (let px = 0; px < W * S; px++) {
        if (px % (32 / S) === 32 / S - 1) yield;
        const X = (px + 0.5) / S;
        const top = profile(X);
        if (top === Infinity) continue;
        // Độ dốc của dáng gò (đo trên đoạn rộng, bỏ qua gồ ghề nhỏ) để sườn không sọc dọc
        const slope = Math.max(-1.2, Math.min(1.2, (profile(Math.min(116, X + 5)) - profile(Math.max(4, X - 5))) / 10));
        // Cỏ thành từng bụi, xen chỗ đất trống
        const cover = fbm(noise, X / 9 + 4, 1, 3);
        const grassDepth = cover < 0.4 ? 0.8 : 1.5 + 6 * (cover - 0.4);
        for (let py = 0; py < H * S; py++) {
            const Y = (py + 0.5) / S;
            if (Y < top) continue;
            const depth = Y - top;
            const above = wl - Y;
            const soilN = fbm(noise, X / 8, Y / 4.5, 4);
            let col = [70 + 36 * soilN, 55 + 30 * soilN, 38 + 22 * soilN];
            // Lớp đất xếp tầng, sườn dốc hứng sáng lộ cát sáng màu
            col = col.map(v => v * (1 + Math.sin(Y * 1.3 + fbm(noise, X / 14, Y / 8 + 5, 2) * 6) * 0.08));
            if (slope < -0.25 && depth > 2.5) {
                const sand = Math.min(1, (-slope - 0.25) * 1.5) * (0.4 + 0.6 * fbm(noise, X / 5 + 50, Y / 4, 2));
                col = [col[0] + (132 - col[0]) * sand, col[1] + (112 - col[1]) * sand, col[2] + (82 - col[2]) * sand];
            }
            // Sườn thấp dần thì sẫm và ẩm hơn
            const low = Math.min(1, Math.max(0, 1 - above / (wl - peak)));
            col = col.map(v => v * (1 - 0.3 * low));
            // Sỏi lấm tấm trên sườn
            const pebble = noise(X / 1.4 + 60, Y / 1.4 + 3);
            if (depth > 3 && above > 2 && pebble > 0.93) col = pebble > 0.965 ? [100, 94, 84] : [42, 37, 31];
            // Đỉnh phủ cỏ, mép cỏ lởm chởm
            if (depth < grassDepth) {
                const gN = noise(X / 2.2 + 9, Y / 1.6);
                col = [42 + 34 * gN, 74 + 38 * gN, 36 + 20 * gN];
            }
            // Bùn ướt sát mặt nước, có ánh lấp lánh
            if (above < 3 && above > -1) {
                col = [col[0] * 0.55, col[1] * 0.52, col[2] * 0.55];
                if (noise(X / 1.2 + 31, Y * 2) > 0.86) col = [150, 160, 175];
            }
            // Sườn trái (dốc lên) hứng ánh trăng, sườn phải khuất sáng; càng sâu vào trong càng tối
            const lit = (0.85 - slope * 0.25) * (0.75 + 0.25 * Math.max(0, 1 - depth / 10));
            const i = (py * W * S + px) * 4;
            d[i] = Math.min(255, col[0] * lit);
            d[i + 1] = Math.min(255, col[1] * lit);
            d[i + 2] = Math.min(255, col[2] * lit);
            d[i + 3] = 255;
        }
    }
    g.putImageData(img, 0, 0);
    g.scale(S, S);
    // Bụi cỏ nhô khỏi mép trên: mỗi bụi vài lá cong cao thấp khác nhau, chỗ đất trống không có
    for (let X = 8; X < 112; X += 2.5 + rnd() * 4) {
        const top = profile(X);
        const cover = fbm(noise, X / 9 + 4, 1, 3);
        if (top === Infinity || cover < 0.4) continue;
        const tall = (2 + 7 * (cover - 0.4)) * (0.6 + 0.4 * Math.sin(Math.PI * (X - 3) / 114));
        const blades = 3 + ((rnd() * 5) | 0);
        for (let j = 0; j < blades; j++) {
            const bx = X + (rnd() - 0.5) * 2.5;
            const h = tall * (0.5 + rnd() * 0.6);
            const lean = (rnd() - 0.35) * 2.6;
            g.strokeStyle = ['#3f6a3a', '#4d7c42', '#5d8c4c', '#355a32', '#6a8a4a'][(rnd() * 5) | 0];
            g.lineWidth = 0.5 + rnd() * 0.4;
            g.beginPath();
            g.moveTo(bx, profile(bx) + 1);
            g.quadraticCurveTo(bx + lean * 0.3, profile(bx) - h * 0.6, bx + lean, profile(bx) - h);
            g.stroke();
        }
    }
    // Vài hòn sỏi tròn nằm sát mép nước
    for (let i = 0; i < 6; i++) {
        const x = 12 + rnd() * 96;
        if (profile(x) > wl - 1) continue;
        const r = 0.9 + rnd() * 1.6;
        const pebble = g.createRadialGradient(x - r * 0.3, wl - r * 0.9, 0, x, wl - r * 0.4, r * 1.2);
        pebble.addColorStop(0, '#8e877a');
        pebble.addColorStop(1, '#3a352e');
        g.fillStyle = pebble;
        g.beginPath();
        g.ellipse(x, wl - r * 0.45, r * 1.3, r * 0.85, 0, 0, Math.PI * 2);
        g.fill();
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    sinkBelow(g, W * S, H * S, wl * S, 0.45);
    // Lau sậy một bên gò (vẽ mỗi khung hình cho đung đưa)
    const reedX = variant ? 86 : 22;
    const reeds = [];
    for (let i = 0; i < 9; i++) {
        const x = reedX + i * 1.8 + rnd() * 1.6;
        const base = profile(x) + 1.5;
        if (base === Infinity) continue;
        reeds.push({
            x, base, h: 10 + rnd() * 11, lean: (rnd() - 0.4) * 2, phase: rnd() * Math.PI * 2,
            color: ['#4a6a36', '#57773e', '#3e5c30'][i % 3], cattail: i % 3 === 0
        });
    }
    c.reeds = reeds;
    c.logicalW = W;
    c.wl = wl * S;
    c.top = (peak + 1.5) * S;
    c.perchX = (variant ? 50 : 66) / W - 0.5;
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

// Bóng phần nổi của vật (gỗ, đá, gò đất) in xuống nước: lật ngược, ngắn lại, từng lát gợn lệch theo sóng
function drawReflection(ctx, sprite, x, y, w, wlOff, alpha, time, seed, s) {
    const rows = 4;
    const dh = wlOff * 0.72 / rows;
    const sh = sprite.wl / rows;
    ctx.globalAlpha = alpha;
    for (let i = 0; i < rows; i++) {
        const dx = Math.sin(time * 0.003 + i * 1.9 + seed * 7) * 1.2 * s * (i + 1) / rows;
        ctx.save();
        ctx.translate(x + dx, y + (i + 1) * dh);
        ctx.scale(1, -1);
        ctx.drawImage(sprite, 0, sprite.wl - (i + 1) * sh, sprite.width, sh, 0, 0, w, dh + 0.3);
        ctx.restore();
    }
}

// Bóng con vật (cò, vịt) in xuống nước: lật ngược qua mặt nước surf, ngắn lại chút, chia từng lát ngang, mỗi lát lệch
// một nhịp sóng riêng, lát càng xa mặt nước càng lệch nhiều và nhạt. lift: từ mặt nước lên tới đỉnh con vật; paint(alpha)
// vẽ con vật ở chỗ thật (vẽ lại cho từng lát, cắt theo lát).
function drawMirrorSlices(ctx, surf, lift, x, halfW, alpha, time, seed, s, squash = 0.85) {
    return paint => {
        const rows = 5;
        const span = lift * squash;
        for (let i = 0; i < rows; i++) {
            const dx = Math.sin(time * 0.0035 + i * 1.9 + seed * 7) * (0.4 + i * 0.5) * s;
            ctx.save();
            ctx.beginPath();
            ctx.rect(x - halfW - 4 * s, surf + span * i / rows, halfW * 2 + 8 * s, span / rows + 0.5);
            ctx.clip();
            ctx.translate(dx, surf);
            ctx.scale(1, -squash);
            ctx.translate(0, -surf);
            paint(alpha * (1 - 0.6 * i / rows));
            ctx.restore();
        }
    };
}

// Phần chìm dưới nước: từng lát lệch nhẹ theo sóng (nước khúc xạ) nên không đứng im như ảnh dán
function drawSubmerged(ctx, sprite, x, y, w, below, time, seed, s) {
    const slices = 5;
    const sub = sprite.height - sprite.wl;
    for (let i = 0; i < slices; i++) {
        const dx = Math.sin(time * 0.004 + i * 1.3 + seed * 9) * 0.9 * s;
        ctx.drawImage(sprite, 0, sprite.wl + sub * i / slices, sprite.width, sub / slices, x + dx, y + below * i / slices, w, below / slices + 0.3);
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

// Né đá, gò đất: dòng nước rẽ qua vật cản đẩy vật trôi dạt dần sang bên từ khá xa phía trước, mạnh dần khi tới gần, êm
// lại sau khi qua; tốc độ dạt ngang có quán tính nên không giật ngang. x, half: tâm và nửa bề ngang vật (điểm ảnh CSS);
// dir: hướng vật đang đi (1 sang phải, -1 sang trái, 0 đứng yên: chỉ dạt khi chồng lên vật cản).
function steerAround(item, x, half, rocks, dt, depthCss, dir = 1) {
    let push = 0;
    for (const rock of rocks) {
        const rockHalf = rock.size * WaterLife.scale(rock.d) / 2;
        const need = (rockHalf * 0.5 / depthCss + 0.05) * 1.4;
        const gap = item.d - rock.d;
        if (Math.abs(gap) >= need) continue;
        const reach = rockHalf + half;
        const ahead = dir > 0 ? rock.x - x : dir < 0 ? x - rock.x : Math.abs(rock.x - x);
        const before = dir ? reach + 170 : reach + 10;
        if (ahead > before || ahead < -reach) continue;
        const along = ahead > reach ? 1 - (ahead - reach) / (before - reach) : 1;
        const close = 1 - Math.abs(gap) / need;
        const side = gap === 0 ? (rock.d > 0.5 ? -1 : 1) : Math.sign(gap);
        push += side * along * along * close * 0.00007;
    }
    item.vd = (item.vd || 0) + (push - (item.vd || 0)) * Math.min(1, dt / 450);
    item.d = Math.min(0.97, Math.max(0.03, item.d + item.vd * dt));
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
    // life: { birds: cò, ducks: vịt trời, fish: cá nhảy, logs: khúc gỗ trôi } (false: tắt hết); plants: lá bèo;
    // rocks: đá, gò đất giữa dòng
    // bank: kiểu bờ bên kia (bank-styles.js)
    render(ctx, { sources, background, sky, cssW, cssH, time, style, floating, calm, life: lifeFlags, plants, rocks: rocksOn, bank: bankKind }) {
        const life = !!lifeFlags && (lifeFlags.birds || lifeFlags.ducks || lifeFlags.fish || lifeFlags.logs);
        const level = horizon();
        const { width: W, height: H } = ctx.canvas;
        if (level >= 1 || !W || !H) {
            if (this.drawn) ctx.clearRect(0, 0, W, H);
            this.drawn = false;
            return 'none';
        }
        // Chất lượng 480p trở xuống: vẽ lại cách một khung hình
        if (isLowQuality && this.drawn && (++this.frame & 1)) return 'skip';
        this.drawn = true;
        spriteRes = W / cssW > 1.35 ? 4 : 2;
        bankStyle = validBankStyle(bankKind);
        warmWaterSprites();

        const k = W / cssW;
        const top = Math.round(level * H);
        const depth = H - top;
        const horizonCss = level * cssH;
        const depthCss = depth / k;
        const fromCss = Math.max(0, horizonCss - depthCss);
        // Bờ đất ở mép nước (kiểu Kingdom Two Crowns): pháo bắn lên từ mặt bờ. Mặt nước bắt đầu dưới chân bờ (surf);
        // ngay dưới đó là bóng của bờ, rồi mới tới bóng bầu trời (reflTop)
        // Biển khơi: không có bờ, chỉ một vệt chân trời mảnh
        const bankPx = bankStyle === 'none' ? Math.max(1, Math.round(1.2 * k)) : Math.max(2, Math.round(bankBandCss(cssH) * k));
        const surf = Math.min(H, top + bankPx);
        const reflTop = Math.min(H, surf + bankPx);
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
        // Ghép các lớp kiểu cộng sáng: card đồ họa làm sẵn được (kiểu "lighten" như trên trang thì card phải chép lại vùng
        // đích cho từng lần vẽ, rất chậm trên card tích hợp); lớp vệt pháo phủ đen dần nên phần đen không cộng thêm gì
        m.globalCompositeOperation = 'lighter';
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
        // Ghép kiểu cộng sáng: phần đen (lớp vệt pháo được phủ đen dần) không làm tối mặt nước, card đồ họa làm sẵn được.
        // Cầu đá (vòm cong, nhiều vòm): trong khoảng cầu (gapX) không có kè mà là chân cầu, trụ cầu đứng dưới nước; tâm
        // vòm ở mép nước nên vòm và bóng khép thành vòng tròn
        const footLayer = skylineCache.style === bankStyle && skylineCache.data.foot ? skylineCache : null;
        const gapX = footLayer ? footLayer.data.foot.map(x => Math.round(x * k)) : null;
        // Chỉ vẽ ngoài khoảng dưới cầu (bờ, bóng bờ)
        const clipGap = () => {
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, 0, gapX[0], H);
            ctx.rect(gapX[1], 0, W - gapX[1], H);
            ctx.clip();
        };
        ctx.globalCompositeOperation = 'lighter';
        const drawStrips = from => {
            const span = H - from;
            for (let y = 0, i = 0; y < span; i++) {
                const d = y / span;
                const band = Math.max(strip, Math.round((strip + d * (river ? 9 : 5) * k * 2) / strip) * strip);
                const phase = hash(i) * Math.PI * 2;
                const speed = 0.0008 + hash(i + 50) * 0.0016;
                const amp = (river ? 0.6 + d * 9 : 0.2 + d * 3) * k;
                const dx = Math.round((Math.sin(time * speed + phase) + 0.5 * Math.sin(time * speed * 1.7 + phase * 2)) * amp);
                // Khe tối ngang, càng xa bờ càng nhiều: bóng trăng, bóng pháo vỡ thành từng lát
                const gap = hash(i + 99) < 0.1 + d * 0.3 ? 0.6 : 1;
                ctx.globalAlpha = (river ? 0.6 * (1 - d * 0.6) : 0.78 * (1 - d * 0.5)) * gap;
                ctx.drawImage(mirror, 0, y, W, band, dx, from + y, W, band);
                y += band;
            }
        };
        drawStrips(reflTop);
        // 4. Ánh sáng in thành vệt dọc xuống nước (trăng, pháo sáng kéo dài như ngoài đời)
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, surf, W, H - surf);
        ctx.clip();
        ctx.globalCompositeOperation = 'lighter';
        const streaks = from => {
            ctx.globalAlpha = 0.16;
            ctx.drawImage(mirror, 0, from + Math.round(3 * k));
            ctx.globalAlpha = 0.08;
            ctx.drawImage(mirror, 0, from + Math.round(7 * k));
        };
        streaks(reflTop);

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
        // Vệt sóng: màu riêng của vệt, cộng thêm màu bóng phản chiếu ngay dưới vệt (ánh pháo, ánh trăng làm vệt sáng rực).
        // Hai lượt gom (tô hết màu rồi mới cộng sáng hết bóng): đổi kiểu ghép từng vệt làm card đồ họa phải ngắt mạch vẽ
        // vài trăm lần mỗi khung
        const twinkles = this.dashes.map(dash => (calm ? 0.6 : 0.2 + 0.8 * Math.pow(0.5 + 0.5 * Math.sin(time * dash.speed + dash.phase), 2)));
        const dashX = dash => (((dash.u * (cssW + 40) + this.flow * (river ? 0.4 + dash.d * 1.2 : 0.3)) % (cssW + 40)) - 20) * k;
        const dashRow = dash => surf + Math.round(dash.d * (H - surf - 1));
        const dashLen = dash => Math.max(1, dash.len * (0.5 + dash.d) * k);
        let dashFill = '';
        ctx.globalCompositeOperation = 'source-over';
        this.dashes.forEach((dash, i) => {
            ctx.globalAlpha = twinkles[i] * 0.42 * (1 - dash.d * 0.35);
            if (dash.color !== dashFill) {
                dashFill = dash.color;
                ctx.fillStyle = dashFill;
            }
            ctx.fillRect(dashX(dash), dashRow(dash), dashLen(dash), thin);
        });
        ctx.globalCompositeOperation = 'lighter';
        this.dashes.forEach((dash, i) => {
            const x = dashX(dash);
            const row = dashRow(dash);
            const len = dashLen(dash);
            ctx.globalAlpha = twinkles[i];
            ctx.drawImage(mirror, Math.max(0, x), Math.max(0, row - reflTop), len, 1, x, row, len, thin);
        });
        const moon = Decor.moonGlow();
        if (moon && moon.light > 0.03 && moon.x > -moon.radius * 4 && moon.x < cssW + moon.radius * 4) {
            this.drawMoonGlade(ctx, moon, k, surf, H, time, river, calm);
        }
        ctx.restore();

        // 6. Bờ đất: bóng của bờ in ngay dưới chân bờ, rồi tới bờ (pháo rọi màu lên bờ)
        const bank = bankSprite(W, bankPx, k, bankStyle);
        ctx.globalCompositeOperation = 'source-over';
        // Cầu đá: trong khoảng cầu là chân cầu, không vẽ bờ
        if (gapX) clipGap();
        ctx.save();
        ctx.globalAlpha = 0.4;
        ctx.translate(0, surf);
        ctx.scale(1, -1);
        ctx.drawImage(bank.canvas, 0, 0, W, bankPx, 0, -bankPx, W, bankPx);
        ctx.restore();
        ctx.globalAlpha = 1;
        ctx.drawImage(bank.canvas, 0, top);
        if (sky.r + sky.g + sky.b > 6) {
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = 0.5;
            ctx.fillStyle = `rgb(${sky.r * 0.22 | 0}, ${sky.g * 0.22 | 0}, ${sky.b * 0.22 | 0})`;
            ctx.fillRect(0, top, W, bankPx);
            ctx.globalCompositeOperation = 'source-over';
        }
        if (gapX) ctx.restore();
        // Cầu đá: chân cầu (lớp bầu trời vẽ, ánh pháo rọi lên như phần trên cầu; ở đây khoét mặt nước cho lộ ra), bóng chân
        // cầu ngay dưới mép nước như bóng kè; trong lòng vòm thấy mặt nước phía xa sau cầu, sáng như trời sát chân trời
        if (gapX) {
            const fk = footLayer.k;
            const fw = footLayer.canvas.width;
            const fy = footLayer.up * fk;
            const fh = Math.min(footLayer.canvas.height - fy, bankPx / k * fk);
            const dw = fw / fk * k;
            const flipped = () => {
                ctx.save();
                ctx.translate(0, surf);
                ctx.scale(1, -1);
                ctx.drawImage(footLayer.canvas, 0, fy, fw, fh, 0, -bankPx, dw, bankPx);
                ctx.restore();
            };
            ctx.save();
            ctx.beginPath();
            ctx.rect(gapX[0], top, gapX[1] - gapX[0], reflTop - top);
            ctx.clip();
            // Lòng vòm: dải trời ngay trên chân trời (trong vòm) kéo dọc xuống hết bóng chân cầu
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = river ? 0.6 : 0.78;
            const drop = footLayer.drop;
            footLayer.data.openings.forEach(o => {
                const hw = o.rx * Math.sqrt(Math.max(0, 1 - (drop / o.ry) ** 2)) - 1;
                if (hw <= 0) return;
                ctx.drawImage(mirror, Math.max(0, Math.round((o.cx - hw) * k)), 0, Math.max(1, Math.round(hw * 2 * k)), 1,
                    Math.round((o.cx - o.rx) * k), top, Math.round(o.rx * 2 * k), reflTop - top);
            });
            // Khoét chỗ chân cầu (lộ lớp bầu trời) và chỗ bóng chân cầu, lót lại nền nước rồi in bóng mờ như bóng kè
            ctx.globalCompositeOperation = 'destination-out';
            ctx.globalAlpha = 1;
            ctx.drawImage(footLayer.canvas, 0, fy, fw, fh, 0, top, dw, bankPx);
            flipped();
            ctx.globalCompositeOperation = 'destination-over';
            ctx.fillStyle = base;
            ctx.fillRect(gapX[0], surf, gapX[1] - gapX[0], reflTop - surf);
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = 0.4;
            flipped();
            ctx.restore();
        }
        if (bankStyle === 'sand') drawBeachFoam(ctx, W, surf, k, time, calm);

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
            steerAround(item, item.u * cssW, half, rocks, dt, waterDepthCss, river ? 1 : 0);
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
                WaterLife.reset(river, cssW, lifeFlags);
            }
            WaterLife.update(dt, river, cssW, waterTopCss, waterDepthCss, rocks, lifeFlags);
        } else if (WaterLife.key) {
            WaterLife.key = '';
        }
        ctx.setTransform(k, 0, 0, k, 0, 0);
        ctx.globalCompositeOperation = 'source-over';
        if (life) WaterLife.drawUnder(ctx, k, waterTopCss, waterDepthCss, time);
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
        if (life) WaterLife.drawOver(ctx, k, waterTopCss, waterDepthCss, time);
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
        return 'drawn';
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
        const x0 = rock.x - w / 2;
        drawReflection(ctx, sprite, x0, y, w, wlOff, 0.3, time, rock.seed, s);
        drawFlowMarks(ctx, rock.x, y, w * 0.46, s, k, time, rock.seed, river, 1);
        ctx.globalAlpha = 1;
        ctx.drawImage(sprite, 0, 0, sprite.width, sprite.wl, x0, y - wlOff, w, wlOff);
        drawSubmerged(ctx, sprite, x0, y, w, h - wlOff, time, rock.seed, s);
        if (!sprite.reeds) return;
        // Gò đất: lau sậy đung đưa theo gió (mỗi cây một nhịp), bông lau nâu; nước vỗ nhẹ dọc chân gò
        const u = w / sprite.logicalW;
        const y0 = y - wlOff;
        ctx.lineCap = 'round';
        sprite.reeds.forEach(reed => {
            const bx = x0 + reed.x * u;
            const by = y0 + reed.base * u;
            const sway = (Math.sin(time * 0.0014 + reed.phase) * 1.4 + Math.sin(time * 0.0033 + reed.phase * 2) * 0.5 + reed.lean) * u;
            const len = reed.h * u;
            ctx.globalAlpha = 0.95;
            ctx.strokeStyle = reed.color;
            ctx.lineWidth = Math.max(1 / k, 0.7 * u);
            ctx.beginPath();
            ctx.moveTo(bx, by);
            ctx.quadraticCurveTo(bx + sway * 0.25, by - len * 0.6, bx + sway, by - len);
            ctx.stroke();
            if (reed.cattail) {
                ctx.save();
                ctx.translate(bx + sway * 0.8, by - len * 0.85);
                ctx.rotate(Math.atan2(sway, len) * 0.9);
                ctx.fillStyle = '#6b4a2c';
                ctx.beginPath();
                ctx.ellipse(0, 0, 0.9 * u, 2.4 * u, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
        });
        ctx.fillStyle = 'rgb(205, 222, 255)';
        for (let i = 0; i < 9; i++) {
            const fx = x0 + w * (0.12 + i * 0.095) + Math.sin(time * 0.0021 + i * 1.7 + rock.seed * 5) * 1.5 * u;
            ctx.globalAlpha = 0.14 + 0.18 * (0.5 + 0.5 * Math.sin(time * 0.0035 + i * 2.3 + rock.seed * 3));
            ctx.fillRect(fx, y - 0.4 * u, (2.5 + (i % 3) * 1.5) * u, Math.max(1 / k, 0.5 * u));
        }
    },

    // Đường trăng: dưới trăng là vệt sáng lấp lánh trải dài trên mặt nước, hẹp ở xa, loe dần về phía người xem; từng
    // đốm ánh trăng chớp lên rồi tắt, lượt sau hiện chỗ khác (sông chảy thì lấp lánh nhanh hơn); trăng càng tròn càng
    // sáng, mây che thì tối đi, trăng thấp thì ngả vàng cam
    drawMoonGlade(ctx, moon, k, surf, H, time, river, calm) {
        const tone = `255, ${Math.round(244 - 40 * moon.warm)}, ${Math.round(222 - 95 * moon.warm)}`;
        const cx = moon.x * k;
        const depth = H - surf;
        const halfAt = d => moon.radius * k * (1 + 6 * d);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 1;
        // Nền vệt: dải sáng mờ, giữa sáng nhất
        for (let i = 0; i < 10; i++) {
            const d = (i + 0.5) / 10;
            const half = halfAt(d) * 1.3;
            const glow = ctx.createLinearGradient(cx - half, 0, cx + half, 0);
            glow.addColorStop(0, `rgba(${tone}, 0)`);
            glow.addColorStop(0.5, `rgba(${tone}, ${0.06 * moon.light * (1 - 0.5 * d)})`);
            glow.addColorStop(1, `rgba(${tone}, 0)`);
            ctx.fillStyle = glow;
            ctx.fillRect(cx - half, surf + (i / 10) * depth, half * 2, depth / 10 + 1);
        }
        // Đốm lấp lánh: mỗi đốm chớp một nhịp riêng, hết nhịp thì sang chỗ mới (gom về giữa vệt)
        const count = IS_MOBILE ? 120 : 220;
        const thin = Math.max(1, Math.round(k));
        const pace = river ? 1 : 0.6;
        ctx.fillStyle = `rgb(${tone})`;
        for (let i = 0; i < count; i++) {
            const t = time * (0.0012 + 0.0016 * hash(i + 7)) * pace + hash(i + 31) * 100;
            const cycle = Math.floor(t);
            const d = hash(i * 13 + cycle * 7 + 1);
            const u = (hash(i * 17 + cycle * 3 + 5) + hash(i * 5 + cycle * 11 + 9) + hash(i * 23 + cycle * 2 + 4) - 1.5) / 0.75;
            const flash = calm ? 0.3 : Math.pow(Math.sin(Math.PI * (t - cycle)), 3);
            const len = (2 + 6 * hash(i * 3 + cycle)) * (0.4 + d * 1.2) * k;
            ctx.globalAlpha = Math.min(1, 1.3 * moon.light * flash * Math.exp(-u * u * 0.5) * (1 - 0.5 * d));
            ctx.fillRect(cx + u * halfAt(d) * 0.6 - len / 2, surf + Math.round(d * (depth - 1)), len, thin);
        }
        ctx.globalCompositeOperation = 'source-over';
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
// Thời tiết: mưa, tuyết rơi. Vẽ trên lớp mặt nước (lớp trên cùng, phủ cả khung) nên không in bóng xuống nước mà vẫn có
// trong ảnh chụp, video; hạt mưa rơi xuống mặt nước gợn vòng lăn tăn (mặt băng thì vỡ tung thành chấm sáng).
// ---------------------------------------------------------------------------

// Bông tuyết: chấm tròn mềm
let flakeSprite = null;
function snowflakeSprite() {
    if (!flakeSprite) {
        const c = document.createElement('canvas');
        c.width = c.height = 32;
        const g = c.getContext('2d');
        const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
        grad.addColorStop(0, 'rgba(240, 245, 255, 1)');
        grad.addColorStop(0.35, 'rgba(230, 238, 252, 0.85)');
        grad.addColorStop(0.7, 'rgba(220, 230, 250, 0.25)');
        grad.addColorStop(1, 'rgba(220, 230, 250, 0)');
        g.fillStyle = grad;
        g.fillRect(0, 0, 32, 32);
        flakeSprite = c;
    }
    return flakeSprite;
}

export const Weather = {
    drops: [],
    flakes: [],
    ripples: [],
    last: 0,
    key: '',
    drawn: false,

    // Rải lại khi đổi thời tiết hoặc cỡ khung. Hạt mưa, bông tuyết có độ xa gần z (0 xa, 1 gần): gần thì to, rơi nhanh,
    // chạm mặt nước gần người xem; xa thì nhỏ, chậm, chạm mặt nước sát chân trời
    sync(kind, cssW, cssH) {
        const key = `${kind}_${Math.round(cssW)}_${Math.round(cssH)}_${isLowQuality}`;
        if (key === this.key) return;
        this.key = key;
        const area = cssW * cssH * (isLowQuality ? 0.6 : 1);
        const count = (per, min, max) => Math.round(Math.max(min, Math.min(max, area / per)));
        this.drops = kind === 'rain' ? Array.from({ length: count(3500, 120, 420) }, () => this.drop(cssW, cssH, true)) : [];
        this.flakes = kind === 'snow' ? Array.from({ length: count(3000, 120, 480) }, () => this.flake(cssW, cssH, true)) : [];
        this.ripples = [];
    },

    drop(cssW, cssH, anywhere) {
        return {
            x: Math.random() * (cssW + 200) - 150,
            y: anywhere ? Math.random() * cssH : -40 - Math.random() * cssH * 0.3,
            z: 0.25 + Math.random() * 0.75,
            land: Math.random()
        };
    },

    flake(cssW, cssH, anywhere) {
        return {
            x: Math.random() * (cssW + 160) - 120,
            y: anywhere ? Math.random() * cssH : -10 - Math.random() * 60,
            z: 0.15 + Math.random() * 0.85,
            phase: Math.random() * 6.3,
            land: Math.random(),
            fade: 1
        };
    },

    // state: Water.render vừa vẽ lại mặt nước ('drawn'), bỏ qua khung này ('skip', chất lượng thấp) hay không có mặt nước
    // ('none': lớp trống, tự xóa phần mưa, tuyết của khung trước). sky: màu trời theo ánh pháo (rọi sáng hạt mưa, tuyết)
    render(ctx, { cssW, cssH, time, sky, state }) {
        const kind = sceneWeather();
        this.sync(kind, cssW, cssH);
        const dt = Math.min(50, this.last ? time - this.last : 16);
        this.last = time;
        if (state === 'skip') return;
        const { width: W, height: H } = ctx.canvas;
        if (state === 'none' && this.drawn) ctx.clearRect(0, 0, W, H);
        this.drawn = false;
        if (!this.drops.length && !this.flakes.length && !this.ripples.length) return;
        this.drawn = true;
        const k = W / cssW;
        const level = horizon();
        const water = level < 1;
        const topCss = water ? level * cssH + bankBandCss(cssH) : cssH;
        const frozen = water && sceneSeason() === 'winter';
        // Chỗ chạm: mặt nước ở độ xa d (0 sát chân trời, 1 sát người xem); không có mặt nước thì rơi ra khỏi khung
        const landAt = d => (water ? topCss + d * (cssH - topCss) : cssH + 60);
        // Gió thổi từng đợt (từ trái sang phải)
        const wind = 0.6 + 0.4 * Math.sin(time * 0.00021) + 0.3 * Math.sin(time * 0.00063 + 1);
        ctx.save();
        ctx.setTransform(k, 0, 0, k, 0, 0);
        ctx.globalCompositeOperation = 'source-over';
        if (this.drops.length) this.rain(ctx, dt, time, wind, sky, landAt, water, cssW, cssH, topCss);
        if (this.ripples.length) this.drawRipples(ctx, time, frozen);
        if (this.flakes.length) this.snow(ctx, dt, time, wind, landAt, water && !frozen, cssW, cssH);
        ctx.restore();
    },

    // Mưa xiên theo gió: mỗi hạt một vệt dài theo tốc độ rơi (gần dài, đậm), gom ba lượt vẽ theo độ xa
    rain(ctx, dt, time, wind, sky, landAt, water, cssW, cssH, topCss) {
        const paths = [new Path2D(), new Path2D(), new Path2D()];
        const slant = 0.1 + 0.09 * wind;
        this.drops.forEach(drop => {
            const v = 0.9 + drop.z * 1.3;
            const d = Math.min(1, drop.land * 0.35 + (drop.z - 0.25) * 0.9);
            const end = landAt(d);
            drop.y += v * dt;
            drop.x += v * slant * dt;
            if (drop.y >= end) {
                if (water && this.ripples.length < 160) this.ripples.push({ x: drop.x, y: end, d, t: time });
                Object.assign(drop, this.drop(cssW, cssH, false));
                return;
            }
            const len = 12 + drop.z * 34;
            const path = paths[drop.z < 0.5 ? 0 : drop.z < 0.8 ? 1 : 2];
            path.moveTo(drop.x, drop.y);
            path.lineTo(drop.x - slant * len, drop.y - len);
        });
        const lift = Math.min(1, (sky.r + sky.g + sky.b) / 300);
        ctx.strokeStyle = `rgb(${Math.min(255, 165 + sky.r) | 0}, ${Math.min(255, 180 + sky.g) | 0}, ${Math.min(255, 210 + sky.b) | 0})`;
        ctx.lineCap = 'butt';
        [[0.55, 0.15], [0.85, 0.21], [1.25, 0.28]].forEach(([width, alpha], i) => {
            ctx.lineWidth = width;
            ctx.globalAlpha = alpha * (1 + lift);
            ctx.stroke(paths[i]);
        });
        ctx.globalAlpha = 1;
    },

    // Vòng gợn của hạt mưa trên mặt nước: elip dẹt theo phối cảnh, nở rộng rồi tan; mặt băng: chấm sáng nảy lên rồi tắt
    drawRipples(ctx, time, frozen) {
        const fresh = new Path2D();
        const old = new Path2D();
        this.ripples = this.ripples.filter(r => {
            const life = frozen ? 160 : 520 + r.d * 380;
            const age = (time - r.t) / life;
            if (age >= 1) return false;
            const size = 1.6 + r.d * 7;
            const path = age < 0.45 ? fresh : old;
            if (frozen) {
                path.rect(r.x - 0.5, r.y - age * size, 1, 1);
                return true;
            }
            const rx = size * (0.35 + age);
            const ry = rx * (0.16 + r.d * 0.2);
            path.moveTo(r.x + rx, r.y);
            path.ellipse(r.x, r.y, rx, ry, 0, 0, Math.PI * 2);
            return true;
        });
        ctx.strokeStyle = 'rgb(170, 190, 225)';
        ctx.fillStyle = 'rgb(205, 218, 240)';
        ctx.lineWidth = 0.7;
        [[fresh, 0.32], [old, 0.14]].forEach(([path, alpha]) => {
            ctx.globalAlpha = alpha;
            if (frozen) ctx.fill(path);
            else ctx.stroke(path);
        });
        ctx.globalAlpha = 1;
    },

    // Tuyết lả tả: rơi chậm, đung đưa qua lại, gió đẩy ngang; chạm mặt nước thì tan ngay, chạm băng, đất thì đọng lại một lúc
    snow(ctx, dt, time, wind, landAt, melts, cssW, cssH) {
        const sprite = snowflakeSprite();
        this.flakes.forEach(flake => {
            const end = landAt(Math.min(1, flake.land * 0.3 + (flake.z - 0.15) * 0.85));
            if (flake.y < end) {
                flake.y += (0.012 + flake.z * 0.04) * dt;
                flake.x += ((0.008 + 0.022 * flake.z) * wind + Math.sin(time * 0.0011 * (0.6 + flake.z) + flake.phase) * 0.014 * (0.4 + flake.z)) * dt;
            } else {
                flake.y = end;
                flake.fade -= dt / (melts ? 120 : 900);
            }
            if (flake.fade <= 0 || flake.x > cssW + 60) {
                Object.assign(flake, this.flake(cssW, cssH, false));
                return;
            }
            // Gần: bông to, mềm; xa: chấm nhỏ
            const size = 0.8 + flake.z * flake.z * 4.6;
            ctx.globalAlpha = (0.35 + 0.6 * flake.z) * flake.fade;
            ctx.drawImage(sprite, flake.x - size, flake.y - size, size * 2, size * 2);
        });
        ctx.globalAlpha = 1;
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

// Mặt trăng thật: bề mặt dựng một lần từng điểm ảnh trên khối cầu (nhìn từ Trái Đất, bắc ở trên, đông bên phải).
// Biển tối đặt đúng chỗ như trăng thật theo kinh độ, vĩ độ: Đại dương Bão, Biển Mưa, Biển Trong Sáng, Biển Yên Tĩnh,
// Biển Nguy Hiểm, Biển Phong Phú, Biển Mật, Biển Mây, Biển Ẩm, Biển Lạnh... Cao nguyên sáng lấm tấm hố va chạm (nhỏ
// nhiều, lớn ít; hố sát mép đĩa bị nén dẹt theo mặt cầu); hố trẻ sáng (Tycho, Copernicus, Kepler, Aristarchus) có tia
// sáng tỏa ra, hố đáy tối (Plato, Grimaldi). Ghi độ phản xạ (albedo) và độ cao từng điểm để chiếu sáng theo pha.
// D: cạnh ảnh (điểm ảnh), vừa đủ nét với cỡ trăng trên màn hình; cần to hơn thì dựng lại.
let moonSurfaceCache = null;

function moonSurface(D) {
    if (moonSurfaceCache && moonSurfaceCache.D >= D) return moonSurfaceCache;
    const R = D / 2 - 1;
    const noise = makeNoise(4242);
    const deg = Math.PI / 180;
    // Điểm trên mặt trăng theo vĩ độ (bắc dương), kinh độ (đông dương) -> vectơ (x phải, y xuống, z về phía người xem)
    const at = (lat, lon) => [Math.cos(lat * deg) * Math.sin(lon * deg), -Math.sin(lat * deg), Math.cos(lat * deg) * Math.cos(lon * deg)];
    const albedo = new Float32Array(D * D);
    const height = new Float32Array(D * D);
    const mare = new Float32Array(D * D);
    const inside = new Uint8Array(D * D);
    const P = new Float32Array(D * D * 3);
    for (let py = 0; py < D; py++) {
        for (let px = 0; px < D; px++) {
            const u = (px + 0.5 - D / 2) / R;
            const v = (py + 0.5 - D / 2) / R;
            const q = u * u + v * v;
            if (q > 1.02) continue;
            const j = py * D + px;
            const z = Math.sqrt(Math.max(0, 1 - q));
            const n = Math.sqrt(u * u + v * v + z * z);
            P[j * 3] = u / n;
            P[j * 3 + 1] = v / n;
            P[j * 3 + 2] = z / n;
            inside[j] = 1;
        }
    }
    // Biển tối: [vĩ độ, kinh độ, bán kính góc (độ), độ đậm, độ sáng của nền biển]; Đại dương Bão, Biển Lạnh ghép từ
    // nhiều mảng. Biển Yên Tĩnh, Biển Nguy Hiểm sẫm hơn; Biển Trong Sáng, Biển Lạnh nhạt hơn
    const MARIA = [
        [33, -16, 19, 1, 0.5], [28, 17.5, 11.5, 1, 0.55], [8.5, 31, 14, 1, 0.42], [17, 59, 8, 1.15, 0.42], [-7.8, 51, 12, 0.9, 0.47],
        [-15, 35, 6, 0.95, 0.46], [-21, -16, 11, 0.85, 0.53], [-24.4, -38.6, 6.8, 0.95, 0.48], [13.3, 3.6, 4.5, 0.8, 0.5], [2, 1, 3.6, 0.7, 0.52],
        [28, -50, 15, 0.95, 0.48], [10, -55, 14, 0.95, 0.47], [-3, -45, 12, 0.85, 0.5], [40, -45, 10, 0.85, 0.5], [-10, -30, 8, 0.75, 0.52],
        [56, -25, 6, 0.75, 0.57], [57, -5, 6, 0.75, 0.57], [56, 15, 5.5, 0.7, 0.57], [55, 35, 4.5, 0.65, 0.57], [-5, 18, 6, 0.6, 0.52],
        [44, 26, 6, 0.7, 0.53], [20, 30, 5, 0.6, 0.48]
    ].map(([lat, lon, r, k, tone]) => ({ c: at(lat, lon), r: r * deg * 1.12, k, tone, reach: Math.cos(Math.min(Math.PI, r * deg * 2.5)) }));
    for (let j = 0; j < D * D; j++) {
        if (!inside[j]) continue;
        const x = P[j * 3];
        const y = P[j * 3 + 1];
        const z = P[j * 3 + 2];
        const lat = -Math.asin(Math.max(-1, Math.min(1, y)));
        const lon = Math.atan2(x, z);
        // Các mảng biển hòa vào nhau thành vùng liền (không thành chấm tròn rời), bờ biển lượn khúc theo nhiễu
        let dens = 0;
        let toneSum = 0;
        MARIA.forEach(({ c, r, k, tone, reach }) => {
            const dot = x * c[0] + y * c[1] + z * c[2];
            if (dot < reach) return;
            const d = Math.acos(Math.max(-1, Math.min(1, dot)));
            const w = k * Math.exp(-((d / r) ** 2) * 1.4);
            dens += w;
            toneSum += w * tone;
        });
        const tone = dens > 0 ? toneSum / dens : 0.5;
        const coast = (fbm(noise, lon * 3 + 10, lat * 3 + 3, 4) - 0.5) * 0.55;
        const m = smooth01(0.3, 0.6, dens + coast);
        const hi = fbm(noise, lon * 9 + 40, lat * 9 + 7, 3);
        const fine = noise(lon * 40 + 5, lat * 40 + 9);
        const highland = 0.8 + (hi - 0.5) * 0.18 + (fine - 0.5) * 0.06;
        const sea = m > 0.01 ? tone + (fbm(noise, lon * 7 + 70, lat * 7 + 20, 3) - 0.5) * 0.16 + (fine - 0.5) * 0.03 : 0;
        albedo[j] = highland + (sea - highland) * m;
        mare[j] = m;
        // Mặt đất gồ ghề nhẹ: cao nguyên lởm chởm hơn biển (biển là dung nham phẳng)
        height[j] = (hi - 0.5) * 0.012 * (1 - 0.7 * m) + (fine - 0.5) * 0.002;
    }
    // Hố va chạm: rải từng hố lên các điểm quanh nó (nhanh hơn dò mọi hố cho từng điểm)
    let seed = 913;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const craters = [
        // [vĩ độ, kinh độ, bán kính (độ), độ sáng đáy hố (cộng thêm), tia sáng dài (độ, 0 = không)]
        [-43.3, -11.2, 1.5, 0.3, 55], [9.6, -20.1, 1.6, 0.2, 22], [8.1, -38, 0.6, 0.3, 14], [23.7, -47.4, 0.7, 0.55, 10],
        [51.6, -9.4, 1.7, -0.25, 0], [-5.2, -68.6, 2.8, -0.25, 0], [-8.9, 61, 2.2, 0.08, 0], [-11.4, 26.4, 1.7, 0.08, 0],
        [-58.4, -14.4, 3.7, 0, 0], [-9.3, -1.9, 2.5, -0.05, 0], [-25.1, 60.4, 2.9, 0.05, 0], [-20, 9, 1.3, 0, 0],
        [-12, -4, 1.6, 0, 0], [-31, 1, 1.9, 0, 0], [-49, 29, 1.6, 0, 0], [-64, 30, 2, 0, 0], [70, 5, 1.5, 0, 0], [-28, -48, 1, 0.15, 12]
    ].map(([lat, lon, r, b, ray]) => ({ c: at(lat, lon), r: r * deg, b, ray: ray * deg }));
    for (let i = 0; i < 230; i++) {
        // Bán kính theo luật lũy thừa: hố nhỏ rất nhiều, hố lớn hiếm
        const r = (0.25 + 2.6 * Math.pow(rnd(), 3.2)) * deg;
        const lat = Math.asin(rnd() * 2 - 1) / deg;
        const lon = (rnd() * 2 - 1) * 95;
        craters.push({ c: at(lat, lon), r, b: rnd() < 0.12 ? 0.12 : 0, ray: 0, random: true });
    }
    craters.forEach(({ c, r, b, ray, random }) => {
        if (c[2] < -0.05) return;
        const reach = Math.max(r * 1.8, ray);
        const span = Math.ceil(Math.sin(Math.min(Math.PI / 2, reach)) * R) + 2;
        const cx = Math.round(c[0] * R + D / 2);
        const cy = Math.round(c[1] * R + D / 2);
        // Tia sáng: những vệt hẹp tỏa ra quanh hố, dài ngắn khác nhau
        const rays = ray ? Array.from({ length: 16 }, () => ({ a: rnd() * Math.PI * 2, w: 0.05 + rnd() * 0.12, len: ray * (0.35 + rnd() * 0.65) })) : null;
        const east = [c[2], 0, -c[0]];
        const el = Math.hypot(east[0], east[2]) || 1;
        east[0] /= el;
        east[2] /= el;
        const side = [c[1] * east[2], c[2] * east[0] - c[0] * east[2], -c[1] * east[0]];
        for (let py = Math.max(0, cy - span); py < Math.min(D, cy + span); py++) {
            for (let px = Math.max(0, cx - span); px < Math.min(D, cx + span); px++) {
                const j = py * D + px;
                if (!inside[j]) continue;
                const x = P[j * 3];
                const y = P[j * 3 + 1];
                const z = P[j * 3 + 2];
                const d = Math.acos(Math.max(-1, Math.min(1, x * c[0] + y * c[1] + z * c[2])));
                if (d > reach) continue;
                const t = d / r;
                // Biển ít hố (hố ngẫu nhiên phần lớn đã bị dung nham lấp); sát mép đĩa hố nén dẹt, gần như không thấy
                const keep = (random ? 1 - 0.75 * mare[j] : 1) * smooth01(0.06, 0.32, z);
                if (t < 1.8) {
                    const depth = r * 0.22 * keep;
                    const bowl = t < 1 ? (t * t - 1) * 0.9 : 0;
                    const rim = 0.32 * Math.exp(-(((t - 1) / 0.2) ** 2));
                    const ejecta = t > 1 ? 0.08 * Math.exp(-(t - 1) / 0.35) : 0;
                    height[j] += depth * (bowl + rim + ejecta);
                    if (b && t < 1.15) albedo[j] += b * (1 - smooth01(0.8, 1.15, t));
                    if (b > 0 && t >= 1 && t < 1.8) albedo[j] += b * 0.35 * (1 - smooth01(1, 1.8, t));
                }
                if (rays && d > r * 1.2) {
                    const dx = x * east[0] + z * east[2];
                    const dy = x * side[0] + y * side[1] + z * side[2];
                    const a = Math.atan2(dy, dx);
                    let s = 0;
                    rays.forEach((rayItem, k) => {
                        let da = Math.abs(a - rayItem.a);
                        if (da > Math.PI) da = Math.PI * 2 - da;
                        if (d < rayItem.len) {
                            const streak = 0.45 + 0.55 * noise(d * 40 + k * 7, k * 3.3);
                            s = Math.max(s, Math.exp(-((da / rayItem.w) ** 2)) * (1 - d / rayItem.len) * streak);
                        }
                    });
                    albedo[j] += 0.13 * s;
                }
            }
        }
    });
    moonSurfaceCache = { D, R, albedo, height, mare, inside, P };
    return moonSurfaceCache;
}

// Đĩa trăng theo pha: phần sáng gần như đều tới tận mép (bụi trăng phản xạ ngược về phía Mặt Trời, không tối dần như quả
// bóng), sát đường ranh sáng tối thì Mặt Trời xiên thấp nên gờ hố, đồi núi đổ bóng dài, nổi khối rõ; phần tối có ánh
// đất mờ xanh xám (Trái Đất rọi sáng, rõ nhất lúc trăng lưỡi liềm). warm 0..1: trăng sát chân trời ngả vàng cam.
function moonDisc(fraction, warm, size) {
    const key = `lunar${fraction.toFixed(3)}_${warm.toFixed(2)}_${size}`;
    if (sprites[key]) return sprites[key];
    Object.keys(sprites).filter(name => name.startsWith('lunar')).forEach(name => delete sprites[name]);
    const { D, R, albedo, height, mare, inside, P } = moonSurface(size);
    const theta = fraction * Math.PI * 2;
    const L = [Math.sin(theta), 0, -Math.cos(theta)];
    const dir = L[0] >= 0 ? 1 : -1;
    // Bóng đổ chỉ có khi nắng chiếu xiên ngang mặt đĩa (trăng tròn nắng rọi thẳng thì không có bóng)
    const oblique = smooth01(0.3, 0.6, Math.abs(L[0]));
    const ash = 0.06 * Math.pow(1 - moonIllumination(fraction), 2.5);
    const tint = [1, 1 - 0.2 * warm, 1 - 0.42 * warm];
    const c = document.createElement('canvas');
    c.width = c.height = D;
    const img = c.getContext('2d').createImageData(D, D);
    const out = img.data;
    const px2r = 2 / D;
    for (let py = 0; py < D; py++) {
        for (let px = 0; px < D; px++) {
            const j = py * D + px;
            if (!inside[j]) continue;
            const x = P[j * 3];
            const y = P[j * 3 + 1];
            const z = P[j * 3 + 2];
            // Pháp tuyến nghiêng theo độ cao (gờ hố, đồi núi): bớt đi phần dốc nằm trên mặt tiếp xúc của khối cầu
            const hx = (height[j + (px < D - 1 && inside[j + 1] ? 1 : 0)] - height[j - (px > 0 && inside[j - 1] ? 1 : 0)]) / (2 * px2r);
            const hy = (height[j + (py < D - 1 && inside[j + D] ? D : 0)] - height[j - (py > 0 && inside[j - D] ? D : 0)]) / (2 * px2r);
            const along = hx * x + hy * y;
            let nx = x - (hx - along * x);
            let ny = y - (hy - along * y);
            let nz = z + along * z;
            const nl = Math.hypot(nx, ny, nz);
            nx /= nl;
            ny /= nl;
            nz /= nl;
            const geo = x * L[0] + y * L[1] + z * L[2];
            const mu0 = nx * L[0] + ny * L[1] + nz * L[2];
            // Bóng đổ khi Mặt Trời xiên thấp: dò về phía Mặt Trời xem có gờ nào cao hơn tia sáng không
            let shadow = 1;
            if (oblique > 0 && geo > -0.02 && geo < 0.4) {
                const tanE = Math.max(0.01, geo) / Math.sqrt(Math.max(0.0001, 1 - geo * geo));
                for (let s = 1; s < 26; s++) {
                    const sx = px + dir * s;
                    if (sx < 0 || sx >= D || !inside[py * D + sx]) break;
                    if (height[py * D + sx] - height[j] > s * px2r * tanE) {
                        shadow = 1 - 0.92 * oblique;
                        break;
                    }
                }
            }
            // Lommel-Seeliger: trăng tròn thì gần như phẳng sáng đều, hố chỉ nổi khi nắng xiên
            const lommel = mu0 > 0 ? (2 * mu0) / (mu0 + Math.max(0.05, nz)) : 0;
            let lit = 1.22 * albedo[j] * (0.74 * Math.min(1.5, lommel) + 0.26 * Math.max(0, mu0)) * shadow * smooth01(-0.035, 0.05, geo);
            lit = Math.max(0, lit);
            // Ánh đất trên phần tối
            const earth = ash * albedo[j] * (1 - smooth01(-0.05, 0.1, geo));
            const m = mare[j];
            const base = [255 - 20 * m, 250 - 14 * m, 238 - 4 * m];
            const r = base[0] * lit * tint[0] + 180 * earth;
            const g = base[1] * lit * tint[1] + 194 * earth;
            const b = base[2] * lit * tint[2] + 220 * earth;
            // Mép đĩa mịn (khử răng cưa); chỗ tối gần trong suốt để nền trời (đã sáng nhờ tán xạ) lộ qua
            const u = (px + 0.5 - D / 2) / R;
            const v = (py + 0.5 - D / 2) / R;
            const cover = 1 - smooth01(1 - 1.2 / R, 1 + 1.2 / R, Math.sqrt(u * u + v * v));
            const a = Math.min(1, lit * 4 + earth * 3) * cover;
            if (a <= 0) continue;
            const i = j * 4;
            out[i] = Math.min(255, r / Math.max(a, 0.001) * cover);
            out[i + 1] = Math.min(255, g / Math.max(a, 0.001) * cover);
            out[i + 2] = Math.min(255, b / Math.max(a, 0.001) * cover);
            out[i + 3] = 255 * a;
        }
    }
    c.getContext('2d').putImageData(img, 0, 0);
    c.R = R;
    sprites[key] = c;
    return c;
}

// Trăng kèm quầng sáng: lớp sát đĩa sáng đậm (tán xạ trong không khí), lớp ngoài loang rộng, mờ dần; đậm theo phần
// trăng được chiếu sáng; trăng thấp thì quầng cũng ngả vàng
function moonSprite(fraction, radius, scale, warm = 0) {
    const key = `moon${fraction.toFixed(3)}_${radius.toFixed(1)}_${scale}_${warm.toFixed(2)}`;
    if (sprites[key]) return sprites[key];
    Object.keys(sprites).filter(name => name.startsWith('moon')).forEach(name => delete sprites[name]);
    const r = radius * scale;
    const size = Math.ceil(r * 8);
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    const lit = moonIllumination(fraction);
    const tone = `255, ${Math.round(246 - 40 * warm)}, ${Math.round(226 - 90 * warm)}`;
    g.translate(size / 2, size / 2);
    // Quầng tỏa từ phần đang sáng (trăng khuyết thì lệch về phía có nắng, không tỏa quanh phần tối)
    const side = (fraction < 0.5 ? 1 : -1) * (1 - lit) * r * 0.6;
    const outer = g.createRadialGradient(side, 0, r * 0.95 * (0.4 + 0.6 * lit), side, 0, r * 4);
    outer.addColorStop(0, `rgba(${tone}, ${0.16 * lit})`);
    outer.addColorStop(0.25, `rgba(${tone}, ${0.06 * lit})`);
    outer.addColorStop(0.6, `rgba(${tone}, ${0.018 * lit})`);
    outer.addColorStop(1, `rgba(${tone}, 0)`);
    g.fillStyle = outer;
    g.fillRect(-size / 2, -size / 2, size, size);
    const inner = g.createRadialGradient(side, 0, r * 0.98 * (0.4 + 0.6 * lit), side, 0, r * (1 + 0.6 * lit));
    inner.addColorStop(0, `rgba(${tone}, ${0.3 * lit})`);
    inner.addColorStop(0.4, `rgba(${tone}, ${0.08 * lit})`);
    inner.addColorStop(1, `rgba(${tone}, 0)`);
    g.fillStyle = inner;
    g.fillRect(-size / 2, -size / 2, size, size);
    // Đĩa trăng dựng sẵn hơi to hơn cỡ cần, thu nhỏ dần từng nửa cho mịn (không lấm tấm răng cưa)
    let disc = moonDisc(fraction, warm, Math.min(256, Math.max(96, Math.ceil((r * 2.3) / 32) * 32)));
    let discR = disc.R;
    while (discR / 2 >= r * 1.05) {
        const half = document.createElement('canvas');
        half.width = half.height = Math.ceil(disc.width / 2);
        const hg = half.getContext('2d');
        hg.imageSmoothingQuality = 'high';
        hg.drawImage(disc, 0, 0, half.width, half.height);
        discR = discR * half.width / disc.width;
        disc = half;
    }
    const k = r / discR;
    g.imageSmoothingQuality = 'high';
    g.drawImage(disc, -disc.width * k / 2, -disc.height * k / 2, disc.width * k, disc.height * k);
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

// Nhiễu mượt (value noise) theo hạt giống: dựng hình mây tự nhiên, mép xơ, dày mỏng không đều
function makeNoise(seed) {
    let state = seed;
    const rnd = () => ((state = (state * 16807) % 2147483647) / 2147483647);
    const p = Array.from({ length: 256 }, (_, i) => i);
    for (let i = 255; i > 0; i--) {
        const j = (rnd() * (i + 1)) | 0;
        [p[i], p[j]] = [p[j], p[i]];
    }
    const perm = new Uint8Array(512);
    for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
    const val = (x, y) => perm[perm[x & 255] + (y & 255)] / 255;
    return (x, y) => {
        const ix = Math.floor(x);
        const iy = Math.floor(y);
        const fx = x - ix;
        const fy = y - iy;
        const u = fx * fx * (3 - 2 * fx);
        const v = fy * fy * (3 - 2 * fy);
        const a = val(ix, iy);
        const b = val(ix + 1, iy);
        const c = val(ix, iy + 1);
        const d = val(ix + 1, iy + 1);
        return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    };
}

// Nhiễu nhiều lớp (to tới nhỏ): khối mây lớn có gợn nhỏ, mép xơ
function fbm(noise, x, y, octaves = 5) {
    let sum = 0;
    let amp = 0.5;
    let f = 1;
    let total = 0;
    for (let o = 0; o < octaves; o++) {
        sum += amp * noise(x * f, y * f);
        total += amp;
        amp *= 0.5;
        f *= 2.03;
    }
    return sum / total;
}

const smooth01 = (a, b, x) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
};

// Ảnh mây: vẽ thưa (mây mềm nên phóng to vẫn mịn) rồi kéo giãn ra cỡ w x h điểm ảnh CSS. Dáng mây theo loại (cloudShape),
// nhiễu nhiều lớp làm dày mỏng không đều, mép xơ, có lỗ hở.
// Mỗi mây có hai biến thể (nhiễu lệch nhau, các cụm xê dịch, to nhỏ đi chút) để hòa dần từ dạng này sang dạng kia: mây
// biến hình chậm, tháp mây như đang lớn lên rồi tan bớt.
// Hàm sinh: dựng từng đoạn vài hàng (yield) để chia nhỏ việc tính ra nhiều lượt máy rảnh, không làm khựng khung hình;
// xong dạng đầu thì trả ra ảnh (yield) để vẽ được ngay, dạng sau dựng tiếp rồi thêm vào cùng ảnh đó.
// body: thân mây (mặt trên sáng hơn); rim: chỗ mây mỏng ở mép sáng bạc khi có trăng; alpha: độ dày (để tính che trăng).
const CLOUD_TEX = 0.6;

// Dáng mây theo loại, mỗi đám một khác (theo hạt giống):
// - cumulus (mây tích): đáy phẳng, trên là một tới bốn tháp mây cao thấp lệch nhau, mỗi tháp chồng nhiều cụm nhỏ dần
//   như súp lơ, có nụ mây nhô hai bên, cả khối nghiêng theo gió
// - patch (mây tầng tích): vài chùm cụm nhỏ nối nhau thành mảng dài, có chỗ hở, đáy gần phẳng nhưng lởm chởm
// - fractus (mây vụn): vài mảnh dẹt rời, mép rách, không có đáy phẳng, bị gió kéo xiên
// - wisp (mây ti): vài sợi mảnh cong trên cao, cuối sợi quặp như đuôi ngựa
// - layer (mây tầng): một dải dài uốn lượn, mỏng dần hai đầu (thường gần chân trời)
// Các cụm được co lại cho nằm gọn trong khung (chừa chỗ cho mép xơ, không lộ cạnh khung).
function cloudShape(kind, w, h, rnd) {
    const shape = {
        puffs: [], billows: [], strands: [], flat: false, base: h, warp: [16, 12], scale: [30, 26], grain: 0.7, cut: 0.16, soft: 0.38, max: 1
    };
    const puff = (x, y, r, sx = 1) => shape.puffs.push({
        x, y, r, sx, jx: (rnd() - 0.5) * r * 0.5, jy: (rnd() - 0.5) * r * 0.35, jr: 0.82 + rnd() * 0.36
    });
    if (kind === 'cumulus') {
        // Thân mây: vài khối vòm rộng hẹp, cao thấp khác nhau chồng lên nhau (một khối cao nhất, đặt lệch), nghiêng theo
        // gió; dọc mép trên và hai bên là các bướu tròn như súp lơ
        shape.flat = true;
        shape.base = h * 0.82;
        shape.lean = (rnd() - 0.5) * 0.35;
        const n = 2 + ((rnd() * 3) | 0);
        const tallest = (rnd() * n) | 0;
        shape.domes = Array.from({ length: n }, (_, i) => ({
            cx: w * (0.2 + 0.6 * (i + 0.5 + (rnd() - 0.5) * 0.7) / n),
            hw: w * (0.12 + 0.14 * rnd()) * (i === tallest ? 1.3 : 1),
            top: h * 0.72 * (i === tallest ? 0.82 + 0.18 * rnd() : 0.3 + 0.42 * rnd())
        }));
        // Bướu dọc viền từng khối (cả hai sườn lẫn đỉnh), và cuộn mây bên trong (chỉ để đổ sáng tối, mặt trên mỗi cuộn hứng
        // ánh trăng, kẽ giữa các cuộn sẫm hơn)
        shape.domes.forEach(d => {
            for (let a = 0.03; a < Math.PI - 0.02; a += 0.16 + rnd() * 0.14) {
                const lift = d.top * Math.pow(Math.sin(a), 0.6);
                const r = Math.min(lift * 0.6 + h * 0.03, h * (0.06 + 0.09 * rnd()));
                puff(d.cx + Math.cos(a) * d.hw * 0.94 + shape.lean * lift, shape.base - lift + r * (0.3 + 0.3 * rnd()), r);
            }
            const n = 3 + ((rnd() * 5) | 0);
            for (let i = 0; i < n; i++) {
                const lift = d.top * (0.2 + 0.65 * rnd());
                const r = h * (0.08 + 0.12 * rnd());
                shape.billows.push({ x: d.cx + (rnd() - 0.5) * d.hw * 1.5 + shape.lean * lift, y: shape.base - lift, r });
            }
        });
    } else if (kind === 'patch') {
        // Nhiều chùm cụm to nhỏ khác nhau, dẹt, nối nhau bằng một lớp màn mỏng lởm chởm (có chỗ hở)
        shape.flat = true;
        shape.base = h * (0.74 + rnd() * 0.06);
        shape.sheet = { y: shape.base - h * 0.16, half: h * 0.12, x0: w * 0.08, x1: w * 0.92 };
        Object.assign(shape, { warp: [24, 10], scale: [22, 14], grain: 1.05, cut: 0.2, soft: 0.34, max: 0.85 });
        const clusters = 3 + ((rnd() * 3) | 0);
        for (let c = 0; c < clusters; c++) {
            const cx = w * (0.12 + 0.76 * (c + 0.5 + (rnd() - 0.5) * 0.6) / clusters);
            const cw = w * (0.05 + rnd() * 0.08);
            const big = 0.6 + rnd() * 0.6;
            const n = 3 + ((rnd() * 4) | 0);
            for (let i = 0; i < n; i++) {
                const r = h * (0.1 + 0.2 * rnd()) * big;
                puff(cx + (rnd() - 0.5) * cw * 2, shape.base - r * (0.3 + 0.55 * rnd()), r, 1.1 + rnd() * 0.6);
            }
        }
    } else if (kind === 'fractus') {
        Object.assign(shape, { warp: [36, 16], scale: [20, 14], grain: 1.1, cut: 0.22, soft: 0.3, max: 0.75 });
        const lean = (rnd() - 0.5) * 0.9;
        const n = 3 + ((rnd() * 4) | 0);
        for (let i = 0; i < n; i++) {
            const y = h * (0.34 + 0.32 * rnd());
            puff(w * (0.22 + 0.56 * rnd()) + (y - h / 2) * lean, y, h * (0.16 + 0.15 * rnd()), 1.4 + rnd() * 1.1);
        }
    } else if (kind === 'wisp') {
        Object.assign(shape, { warp: [30, 5], scale: [70, 3.5], grain: 1.7, cut: 0.2, soft: 0.42, max: 0.55 });
        const n = 3 + ((rnd() * 4) | 0);
        const y0 = h * (0.35 + 0.25 * rnd());
        for (let i = 0; i < n; i++) {
            shape.strands.push({
                y0: y0 + (rnd() - 0.5) * h * 0.4, amp: h * (0.03 + 0.08 * rnd()), freq: 1.2 + rnd() * 2, ph: rnd() * 6,
                x0: w * (0.05 + 0.3 * rnd()), x1: w * (0.6 + 0.34 * rnd()), t: h * (0.03 + 0.05 * rnd()), hook: (rnd() - 0.7) * h * 0.5
            });
        }
    } else {
        Object.assign(shape, { warp: [40, 8], scale: [60, 14], grain: 0.7, cut: 0.2, soft: 0.45, max: 0.8 });
        shape.base = h * 0.55;
        shape.wave = [rnd() * 6, rnd() * 6];
    }
    // Co các cụm cho nằm gọn trong khung
    if (shape.puffs.length || shape.domes) {
        const mx = shape.warp[0] * 0.4 + 6;
        const my = shape.warp[1] * 0.4 + 6;
        let x0 = Infinity;
        let x1 = -Infinity;
        let y0 = Infinity;
        let y1 = shape.flat ? shape.base + h * 0.06 : -Infinity;
        shape.puffs.forEach(p => {
            x0 = Math.min(x0, p.x - p.r * p.sx * 1.35);
            x1 = Math.max(x1, p.x + p.r * p.sx * 1.35);
            y0 = Math.min(y0, p.y - p.r * 1.35);
            if (!shape.flat) y1 = Math.max(y1, p.y + p.r * 1.35);
        });
        (shape.domes || []).forEach(d => {
            x0 = Math.min(x0, d.cx - d.hw);
            x1 = Math.max(x1, d.cx + d.hw + Math.max(0, shape.lean * d.top));
            y0 = Math.min(y0, shape.base - d.top - h * 0.04);
        });
        const k = Math.min(1, (w - 2 * mx) / (x1 - x0), (h - 2 * my) / (y1 - y0));
        const ox = w / 2 - (x0 + x1) / 2 * k;
        const oy = h - my - y1 * k;
        shape.puffs.forEach(p => {
            p.x = p.x * k + ox;
            p.y = p.y * k + oy;
            p.r *= k;
            p.jx *= k;
            p.jy *= k;
        });
        shape.billows.forEach(p => {
            p.x = p.x * k + ox;
            p.y = p.y * k + oy;
            p.r *= k;
        });
        (shape.domes || []).forEach(d => {
            d.cx = d.cx * k + ox;
            d.hw *= k;
            d.top *= k;
        });
        if (shape.sheet) {
            shape.sheet.y = shape.sheet.y * k + oy;
            shape.sheet.half *= k;
            shape.sheet.x0 = shape.sheet.x0 * k + ox;
            shape.sheet.x1 = shape.sheet.x1 * k + ox;
        }
        shape.base = shape.base * k + oy;
    }
    return shape;
}

// Chia các cụm vào từng ngăn theo chiều ngang: mỗi điểm chỉ dò các cụm phủ tới ngăn của nó (thay vì mọi cụm)
function cloudBins(list, w, reach) {
    const size = 12;
    const pad = 40;
    const count = Math.ceil((w + pad * 2) / size);
    const bins = Array.from({ length: count }, () => []);
    list.forEach(p => {
        const span = reach * p.r * (p.sx || 1);
        const from = Math.max(0, Math.floor((p.x - span + pad) / size));
        const to = Math.min(count - 1, Math.floor((p.x + span + pad) / size));
        for (let i = from; i <= to; i++) bins[i].push(p);
    });
    return x => bins[Math.min(count - 1, Math.max(0, Math.floor((x + pad) / size)))];
}

// Mép trên thân mây tích (độ cao tính từ đáy) tại hoành độ x: khối vòm nào cao nhất ở đó
function cloudProfile(shape, x) {
    let top = 0;
    for (const d of shape.domes) {
        const u = (x - d.cx) / d.hw;
        if (u > -1 && u < 1) top = Math.max(top, d.top * Math.pow(1 - u * u, 0.6));
    }
    return top;
}

function* buildCloud(w, h, seed, kind) {
    let state = seed;
    const rnd = () => ((state = (state * 16807) % 2147483647) / 2147483647);
    const noise = makeNoise(seed);
    const tw = Math.max(8, Math.ceil(w * CLOUD_TEX));
    const th = Math.max(6, Math.ceil(h * CLOUD_TEX));
    const shape = cloudShape(kind, w, h, rnd);
    const { base, warp, scale, grain, cut, soft, max } = shape;
    const toCanvas = data => {
        const c = document.createElement('canvas');
        c.width = tw;
        c.height = th;
        c.getContext('2d').putImageData(data, 0, 0);
        return c;
    };
    const maps = [];
    const result = { maps, tw, th };
    for (let variant = 0; variant < 2; variant++) {
        const off = variant * 17.3;
        const puffs = shape.puffs.map(p => (variant ? { ...p, x: p.x + p.jx, y: p.y + p.jy, r: p.r * p.jr } : p));
        // Dạng sau: các khối vòm cao thấp đi chút (tháp mây như đang lớn lên, tan bớt)
        const domes1 = (shape.domes || []).map((d, i) => ({ ...d, top: d.top * (0.86 + 0.28 * hash(seed + i * 7)) }));
        const outline = variant ? { domes: domes1 } : shape;
        // Độ dày mây từng điểm: dáng mây bị uốn nhẹ theo nhiễu cho mép xơ; nhiễu chỉ gặm mép, lõi vẫn đặc
        const dens = new Float32Array(tw * th);
        const shadeNoise = new Float32Array(tw * th);
        const relief = new Float32Array(tw * th);
        const near = cloudBins(puffs, w, 2.2);
        const lumps = cloudBins(puffs.concat(shape.billows), w, 1.6);
        // Độ uốn mép, mảng sáng tối đổi rất chậm theo chỗ: tính trên lưới thưa (mỗi 3 điểm ảnh) rồi nội suy
        const G = 3;
        const gw = Math.ceil(tw / G) + 2;
        const gh = Math.ceil(th / G) + 2;
        const grid = [new Float32Array(gw * gh), new Float32Array(gw * gh), new Float32Array(gw * gh)];
        for (let gy = 0; gy < gh; gy++) {
            for (let gx = 0; gx < gw; gx++) {
                const X = (gx * G + 0.5) / CLOUD_TEX;
                const Y = (gy * G + 0.5) / CLOUD_TEX;
                const g = gy * gw + gx;
                grid[0][g] = (fbm(noise, X / 50 + 5.2 + off, Y / 40 + 1.3, 3) - 0.5) * warp[0];
                grid[1][g] = (fbm(noise, X / 50 + 9.1 + off, Y / 40 + 4.7, 3) - 0.5) * warp[1];
                grid[2][g] = fbm(noise, X / 60 + 31 + off, Y / 40 + 7, 3);
            }
        }
        const sample = (field, px, py) => {
            const fx = px / G;
            const fy = py / G;
            const ix = fx | 0;
            const iy = fy | 0;
            const ux = fx - ix;
            const uy = fy - iy;
            const g = iy * gw + ix;
            return (field[g] * (1 - ux) + field[g + 1] * ux) * (1 - uy) + (field[g + gw] * (1 - ux) + field[g + gw + 1] * ux) * uy;
        };
        for (let py = 0; py < th; py++) {
            const Y = (py + 0.5) / CLOUD_TEX;
            for (let px = 0; px < tw; px++) {
                const X = (px + 0.5) / CLOUD_TEX;
                const wx = X + sample(grid[0], px, py);
                const wy = Y + sample(grid[1], px, py);
                let env = 0;
                if (kind === 'layer') {
                    // Dải mây: tâm dải uốn lượn, dày ở giữa, mỏng dần hai đầu
                    const t = X / w;
                    const center = base + Math.sin(t * 5 + shape.wave[0] + off * 0.2) * h * 0.08 + Math.sin(t * 11 + shape.wave[1]) * h * 0.04;
                    const half = h * 0.2 * Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, t))), 0.7);
                    const dy = (wy - center) / Math.max(1, half);
                    env = Math.exp(-dy * dy) * Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, (wx / w - 0.04) / 0.92))), 1.2);
                } else if (kind === 'wisp') {
                    // Sợi mây: đường cong mảnh, cuối sợi quặp lên hoặc xuống, mờ dần hai đầu
                    for (const s of shape.strands) {
                        const u = (wx - s.x0) / (s.x1 - s.x0);
                        if (u <= 0 || u >= 1) continue;
                        const yc = s.y0 + s.amp * Math.sin(s.freq * u * Math.PI + s.ph + off * 0.15) + s.hook * u * u * u;
                        const dy = (wy - yc) / (s.t * (0.6 + 0.8 * u));
                        env = Math.max(env, Math.exp(-dy * dy) * Math.pow(Math.sin(Math.PI * u), 0.7));
                    }
                } else {
                    for (const p of near(wx)) {
                        const dx = (wx - p.x) / (p.r * p.sx);
                        const dy = (wy - p.y) / (shape.flat && wy > p.y ? p.r * 0.7 : p.r);
                        const q = dx * dx + dy * dy;
                        if (q < 4) env = Math.max(env, Math.exp(-1.6 * q));
                    }
                    if (shape.domes) {
                        const rise = base - wy;
                        const top = cloudProfile(outline, wx - shape.lean * Math.max(0, rise));
                        if (top > 0) env = Math.max(env, smooth01(-h * 0.05, h * 0.07, top - rise) * smooth01(0, h * 0.1, top));
                    }
                    if (shape.sheet) {
                        const sh = shape.sheet;
                        const dy = (wy - sh.y) / sh.half;
                        env = Math.max(env, 0.62 * Math.exp(-dy * dy) * smooth01(sh.x0, sh.x0 + w * 0.1, wx) * (1 - smooth01(sh.x1 - w * 0.1, sh.x1, wx)));
                    }
                    // Đáy phẳng (mây tích, mây tầng tích): dưới đường đáy mây tắt nhanh, đường đáy hơi gợn
                    if (shape.flat) env *= 1 - smooth01(base - h * 0.03, base + h * 0.08, wy + (noise(X / 18 + off, 7.7) - 0.5) * h * 0.06);
                }
                // Ngoài dáng mây: trong suốt, khỏi tính tiếp
                if (env < 0.02) continue;
                const n = fbm(noise, wx / scale[0] + off, wy / scale[1] + off * 0.7, 4);
                const d = env * (0.78 + grain * (n - 0.5)) - cut;
                dens[py * tw + px] = smooth01(0, soft, d) * max;
                shadeNoise[py * tw + px] = sample(grid[2], px, py);
                // Mặt trên mỗi bướu, mỗi cuộn mây sáng lên, kẽ giữa sẫm lại
                if (shape.flat && env > 0.05) {
                    let lit = 0;
                    for (const p of lumps(wx)) {
                        const dy = (wy - p.y) / p.r;
                        if (dy > 0.69) continue;
                        const dx = (wx - p.x) / (p.r * (p.sx || 1));
                        const q = dx * dx + dy * dy;
                        if (q < 2.5) lit = Math.max(lit, Math.exp(-1.6 * q) * Math.min(1, 0.45 - 0.65 * dy));
                    }
                    relief[py * tw + px] = lit;
                }
            }
            if (py % 4 === 3) yield;
        }
        const body = new ImageData(tw, th);
        const rim = new ImageData(tw, th);
        const alpha = new Uint8Array(tw * th);
        const up = Math.max(2, Math.round(9 * CLOUD_TEX));
        const rimK = kind === 'layer' || kind === 'wisp' ? 0.6 : 0.85;
        for (let py = 0; py < th; py++) {
            const Y = (py + 0.5) / CLOUD_TEX;
            const top = 1 - Y / h;
            for (let px = 0; px < tw; px++) {
                const j = py * tw + px;
                const a = dens[j];
                const i = j * 4;
                // Thân mây: mảng sáng tối loang lổ, mặt trên sáng hơn, đáy và lõi dày sẫm hơn
                const shade = Math.min(1, Math.max(0, 0.27 + 0.4 * top + 0.3 * (shadeNoise[j] - 0.5) - 0.2 * a * (1 - top) + 0.3 * relief[j]));
                body.data[i] = 30 + 58 * shade;
                body.data[i + 1] = 34 + 62 * shade;
                body.data[i + 2] = 48 + 70 * shade;
                body.data[i + 3] = 255 * a;
                // Ánh trăng chỉ viền mặt trên hứng sáng: chỗ mây dày mà phía trên mỏng dần (không viền quanh cả khối)
                const above = py >= up ? dens[j - up * tw] : 0;
                const lit = (Math.max(0, a - above) * 1.1 * (0.4 + 0.6 * top) + a * (1 - a) * 0.25 * top) * rimK;
                rim.data[i] = 212;
                rim.data[i + 1] = 222;
                rim.data[i + 2] = 244;
                rim.data[i + 3] = 255 * Math.min(1, lit);
                alpha[j] = 255 * a;
            }
        }
        maps.push({ body: toCanvas(body), rim: toCanvas(rim), alpha });
        if (variant === 0) yield result;
    }
    return result;
}

const STAR_COLORS = ['255, 255, 255', '210, 225, 255', '255, 240, 215', '190, 210, 255'];

export const Decor = {
    scene: null,
    items: [],
    stars: [],
    moon: null,
    clouds: [],
    wind: 0,
    // Ánh trăng đang chiếu (0-1): theo độ tròn của trăng, giảm khi mây che, đổi dần; cover: mây đang che trăng bao nhiêu
    moonLight: 0,
    cover: 0,
    width: 0,
    height: 0,
    clock: 0,
    drawn: false,
    frame: 0,

    // scene: { decor: ['lanterns', 'balloons', 'planes'], stars: '' | 'few' | 'many', moon: { fraction, x, y } | null,
    // clouds: '' | 'few' | 'many', background } hoặc null; cssW, cssH: kích thước khung. Đổi cảnh hoặc cỡ khung thì rải lại.
    sync(scene, cssW, cssH) {
        if (scene === this.scene && Math.abs(cssW - this.width) < 2 && Math.abs(cssH - this.height) < 2) return;
        // Chỉ đổi cỡ khung hoặc chỉnh mục khác thì giữ nguyên đám mây đang trôi (không dựng lại, không hiện lại từ đầu)
        const keep = scene && scene.clouds && this.scene && scene.clouds === this.scene.clouds && this.width > 0 ? this.clouds : null;
        const oldW = this.width;
        this.scene = scene;
        this.width = cssW;
        this.height = cssH;
        this.items = [];
        this.stars = [];
        this.moon = null;
        this.clouds = [];
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
                radius: MyMath.clamp(Math.min(cssW, ground) * 0.05, 14, 34),
                // Trăng sát chân trời: ánh trăng xuyên qua lớp không khí dày nên ngả vàng cam
                warm: Math.pow(MyMath.clamp((30 - scene.moon.y) / 30, 0, 1), 1.3)
            };
            this.moonLight = moonIllumination(scene.moon.fraction);
        }
        if (keep) {
            keep.forEach(cloud => {
                cloud.x *= cssW / oldW;
                cloud.y = this.cloudY(cloud.alt);
            });
            this.clouds = keep;
        } else if (scene.clouds) {
            const count = { few: IS_MOBILE ? 3 : 4, many: IS_MOBILE ? 5 : 8 }[scene.clouds] || 0;
            this.wind = (Math.random() < 0.5 ? -1 : 1) * MyMath.random(0.004, 0.009);
            // Bầu trời luôn có vài đám mây tích, mây từng mảng làm nền; xen thêm mây vụn, dải mây, sợi mây ti. Rải xáo trộn
            // ngang trời.
            const pick = list => list[(Math.random() * list.length) | 0];
            const bag = (scene.clouds === 'many'
                ? ['cumulus', 'cumulus', 'patch', pick(['cumulus', 'patch']), 'fractus', 'layer', pick(['fractus', 'wisp']), pick(['patch', 'layer'])]
                : ['cumulus', 'patch', pick(['fractus', 'layer']), pick(['cumulus', 'wisp', 'fractus'])]).slice(0, count);
            for (let i = bag.length - 1; i > 0; i--) {
                const j = (Math.random() * (i + 1)) | 0;
                [bag[i], bag[j]] = [bag[j], bag[i]];
            }
            bag.forEach((kind, i) => this.clouds.push(this.cloud(((i + Math.random() * 0.7) / count) * cssW, kind)));
            // Xa (gần chân trời) vẽ trước
            this.clouds.sort((a, b) => a.alt - b.alt);
            this.buildClouds();
        }
    },

    // Mây có sẵn trên trời ngay từ khung hình đầu: dựng ngay dạng đầu của từng mây (dạng sau dựng dần lúc máy rảnh rồi
    // mới hòa vào). Máy chậm không kịp dựng hết thì mây chưa dựng xếp ngoài mép đầu gió, trôi dần vào khung.
    buildClouds() {
        const until = performance.now() + 250;
        this.clouds.forEach(cloud => {
            cloud.job = buildCloud(cloud.w, cloud.h, cloud.seed, cloud.kind);
            while (!cloud.sprites && performance.now() < until) this.stepCloud(cloud);
        });
        let edge = 0;
        this.clouds.forEach(cloud => {
            if (cloud.sprites) return;
            edge += MyMath.random(40, 160);
            cloud.x = this.wind > 0 ? -cloud.w / 2 - edge : this.width + cloud.w / 2 + edge;
            edge += cloud.w * 0.7;
        });
        this.warmClouds();
    },

    stepCloud(cloud) {
        const result = cloud.job.next();
        if (result.value && !cloud.sprites) cloud.sprites = result.value;
        if (result.done) {
            cloud.job = null;
            cloud.full = this.clock;
        }
    },

    // Dựng nốt ảnh mây lúc máy rảnh, chia nhỏ từng đoạn vài mili giây để không khựng khung hình: mây chưa có ảnh trước
    // (đang chờ ngoài mép), rồi tới dạng sau của từng mây
    warmClouds() {
        const list = this.clouds;
        const step = deadline => {
            if (this.clouds !== list) return;
            const until = performance.now() + 5;
            while (performance.now() < until || (deadline && deadline.timeRemaining && deadline.timeRemaining() > 3)) {
                const cloud = list.find(item => item.job && !item.sprites) || list.find(item => item.job);
                if (!cloud) return;
                const ready = !!cloud.sprites;
                this.stepCloud(cloud);
                // Lỡ dựng xong khi đang ở trong khung (khung vừa nới rộng) thì hiện dần
                const seen = cloud.x + cloud.w / 2 > 0 && cloud.x - cloud.w / 2 < this.width;
                if (!ready && cloud.sprites && seen) cloud.born = this.clock;
            }
            schedule();
        };
        const schedule = () => (window.requestIdleCallback ? window.requestIdleCallback(step, { timeout: 200 }) : setTimeout(step, 16));
        schedule();
    },

    // Mây gần chân trời ở xa: nhỏ, dẹt, trôi chậm; mây trên cao gần hơn: to, dày, trôi nhanh hơn. Mỗi loại ở một tầng
    // cao riêng: dải mây mỏng, mây vụn sát chân trời; mây từng mảng, mây tích lưng chừng tới trên cao; sợi mây ti cao
    // nhất (dáng từng loại: cloudShape)
    cloud(x, kind) {
        const [lo, hi] = { layer: [0, 0.35], fractus: [0, 0.6], patch: [0.2, 0.85], cumulus: [0.3, 1], wisp: [0.7, 1] }[kind];
        const alt = MyMath.random(lo, hi);
        const [w0, w1, a0, a1] = {
            layer: [260, 460, 0.2, 0.28], cumulus: [190, 340, 0.45, 0.66], patch: [240, 420, 0.26, 0.38],
            fractus: [150, 280, 0.28, 0.42], wisp: [280, 500, 0.2, 0.32]
        }[kind];
        const size = (0.55 + 0.6 * alt) * (IS_MOBILE ? 0.75 : 1);
        const w = MyMath.random(w0, w1) * size;
        const h = w * MyMath.random(a0, a1) * (0.85 + 0.3 * alt);
        return {
            x, alt, w, h, kind, y: this.cloudY(alt),
            vx: this.wind * (0.5 + alt), density: MyMath.random(0.65, 0.95), seed: 1 + ((Math.random() * 2147483000) | 0),
            morph: MyMath.random(1 / 70000, 1 / 40000) * Math.PI * 2, phase: Math.random() * Math.PI * 2, sprites: null,
            job: null, born: -Infinity, full: 0
        };
    },

    cloudY(alt) {
        return this.groundY() * (0.06 + 0.55 * (1 - alt));
    },

    // Hai dạng của mây đang hòa vào nhau bao nhiêu (0 dạng đầu - 1 dạng sau); dạng sau vừa dựng xong thì hòa vào từ từ
    cloudMix(cloud) {
        if (!cloud.sprites || cloud.sprites.maps.length < 2) return 0;
        return Math.min(1, (this.clock - cloud.full) / 4000) * (0.5 + 0.5 * Math.sin(this.clock * cloud.morph + cloud.phase));
    },

    // Mây che trăng bao nhiêu (0 trăng tỏ - 1 bị che hẳn)
    moonCover(mx, my) {
        let clear = 1;
        this.clouds.forEach(cloud => {
            if (!cloud.sprites) return;
            const { maps, tw, th } = cloud.sprites;
            const tx = Math.floor((mx - (cloud.x - cloud.w / 2)) / cloud.w * tw);
            const ty = Math.floor((my - (cloud.y - cloud.h / 2)) / cloud.h * th);
            if (tx < 0 || ty < 0 || tx >= tw || ty >= th) return;
            const mix = this.cloudMix(cloud);
            const a = (maps[0].alpha[ty * tw + tx] * (1 - mix) + (mix ? maps[1].alpha[ty * tw + tx] * mix : 0)) / 255;
            clear *= 1 - a * cloud.density * this.cloudFade(cloud);
        });
        return 1 - clear;
    },

    // Trăng cho mặt nước vẽ đường trăng: chỗ đang đứng (điểm ảnh CSS), độ sáng lúc này (mây che thì tối), độ ngả vàng
    moonGlow() {
        if (!this.moon) return null;
        const drift = this.skyDrift();
        return { x: this.moon.x + drift.x, y: this.moon.y + drift.y, radius: this.moon.radius, light: this.moonLight, warm: this.moon.warm };
    },

    cloudFade(cloud) {
        return cloud.sprites ? Math.min(1, (this.clock - cloud.born) / 1500) : 0;
    },

    active() {
        return this.items.length > 0 || this.stars.length > 0 || !!this.moon || this.clouds.length > 0 || horizon() < 1;
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
        this.clouds.forEach(cloud => {
            cloud.x += cloud.vx * timeStep;
            if (cloud.vx > 0 && cloud.x - cloud.w / 2 > this.width) cloud.x = -cloud.w / 2 - MyMath.random(0, 80);
            if (cloud.vx < 0 && cloud.x + cloud.w / 2 < 0) cloud.x = this.width + cloud.w / 2 + MyMath.random(0, 80);
        });
        if (this.moon) {
            // Mây trôi qua che trăng thì trời tối dần, mây qua rồi sáng lại
            const drift = this.skyDrift();
            this.cover = this.moonCover(this.moon.x + drift.x, this.moon.y + drift.y);
            const target = moonIllumination(this.moon.fraction) * (1 - 0.85 * this.cover);
            this.moonLight += (target - this.moonLight) * (1 - Math.exp(-timeStep / 500));
        }
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

    // glow: màu trời đang ửng theo pháo ({ r, g, b }), rọi sáng mây
    render(ctx, glow) {
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
        const light = this.moon ? this.moonLight : 0;

        // Ánh trăng: cả bầu trời sáng xanh lên (trăng càng tròn càng sáng, mây che thì tối lại), sáng nhất quanh trăng,
        // sát chân trời sáng hơn một chút. Mặt nước phản chiếu lớp này nên cũng sáng theo.
        if (light > 0.01) {
            const mx = this.moon.x + drift.x;
            const my = this.moon.y + drift.y;
            const sky = ctx.createLinearGradient(0, 0, 0, ground);
            sky.addColorStop(0, `rgba(22, 32, 58, ${0.7 * light})`);
            sky.addColorStop(1, `rgba(38, 52, 84, ${0.85 * light})`);
            ctx.globalAlpha = 1;
            ctx.fillStyle = sky;
            ctx.fillRect(0, 0, this.width, ground);
            const halo = ctx.createRadialGradient(mx, my, this.moon.radius, mx, my, Math.max(this.width, ground) * 0.55);
            halo.addColorStop(0, `rgba(125, 145, 190, ${0.32 * light})`);
            halo.addColorStop(1, 'rgba(125, 145, 190, 0)');
            ctx.fillStyle = halo;
            ctx.fillRect(0, 0, this.width, ground);
        }

        // Sao: lấp lánh nhẹ, mờ dần sát chân trời; trăng càng sáng sao càng mờ. Xếp theo màu nên ít khi phải đổi màu vẽ.
        // Sao càng gần trăng càng bị ánh trăng lấn mất
        const starDim = 1 - 0.6 * light;
        const glare = this.moon ? this.moon.radius * 9 : 1;
        const gx = this.moon ? this.moon.x + drift.x : 0;
        const gy = this.moon ? this.moon.y + drift.y : 0;
        let fill = '';
        this.stars.forEach(star => {
            const x = (star.x + drift.x * 0.6 + this.width) % this.width;
            const y = star.y + drift.y * 0.6;
            const near = Math.min(1, Math.max(0, (ground - y) / (ground * 0.15)));
            const twinkle = calm ? 0.85 : 0.65 + 0.35 * Math.sin(star.twinkle + this.clock * star.speed);
            const lost = light * Math.exp(-((x - gx) ** 2 + (y - gy) ** 2) / (glare * glare));
            ctx.globalAlpha = star.alpha * twinkle * near * starDim * (1 - 0.95 * lost);
            if (star.fill !== fill) {
                fill = star.fill;
                ctx.fillStyle = fill;
            }
            ctx.fillRect(x - star.size / 2, y - star.size / 2, star.size, star.size);
        });

        if (this.moon) {
            const { fraction, radius, warm } = this.moon;
            const sprite = moonSprite(fraction, radius, k, warm);
            const size = sprite.width / k;
            ctx.globalAlpha = 1;
            ctx.drawImage(sprite, this.moon.x + drift.x - size / 2, this.moon.y + drift.y - size / 2, size, size);
        }

        // Mây: che sao, trăng phía sau; thân mây sáng theo ánh trăng; viền trên ánh bạc khi trăng tỏ (gần trăng càng sáng);
        // pháo nổ rọi sáng mây
        const flash = glow ? Math.min(1, (glow.r + glow.g + glow.b) / 300) : 0;
        this.clouds.forEach(cloud => {
            // Mây chưa có ảnh (máy chậm, đang chờ ngoài mép khung) thì chưa vẽ
            if (!cloud.sprites) return;
            const { maps } = cloud.sprites;
            const x = cloud.x - cloud.w / 2;
            const y = cloud.y - cloud.h / 2;
            const fade = this.cloudFade(cloud);
            const mix = this.cloudMix(cloud);
            // Hai dạng hòa vào nhau (hơi bù độ dày lúc giữa chừng)
            const parts = mix ? [[maps[0], Math.pow(1 - mix, 0.6)], [maps[1], Math.pow(mix, 0.6)]] : [[maps[0], 1]];
            let near = 0;
            if (this.moon) {
                const dx = cloud.x - (this.moon.x + drift.x);
                const dy = cloud.y - (this.moon.y + drift.y);
                near = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) / (this.width * 0.5));
            }
            const rim = light * (0.25 + 0.75 * near) + flash * 0.5;
            parts.forEach(([map, weight]) => {
                if (weight < 0.01) return;
                ctx.globalCompositeOperation = 'source-over';
                ctx.globalAlpha = cloud.density * (0.5 + 0.5 * light) * weight * fade;
                ctx.drawImage(map.body, x, y, cloud.w, cloud.h);
                ctx.globalCompositeOperation = 'lighter';
                if (rim > 0.02) {
                    ctx.globalAlpha = Math.min(1, rim) * weight * fade;
                    ctx.drawImage(map.rim, x, y, cloud.w, cloud.h);
                }
                if (flash > 0.02) {
                    ctx.globalAlpha = flash * 0.35 * cloud.density * weight * fade;
                    ctx.drawImage(map.body, x, y, cloud.w, cloud.h);
                }
            });
        });
        // Trăng sau lớp mây mỏng: quầng sáng nhòe quanh trăng
        if (this.moon && this.cover > 0.05) {
            const mx = this.moon.x + drift.x;
            const my = this.moon.y + drift.y;
            const r = this.moon.radius * 3.2;
            const corona = ctx.createRadialGradient(mx, my, this.moon.radius * 0.4, mx, my, r);
            const strength = moonIllumination(this.moon.fraction) * Math.min(1, this.cover * 2) * (1 - this.cover * 0.55);
            corona.addColorStop(0, `rgba(225, 230, 245, ${0.42 * strength})`);
            corona.addColorStop(1, 'rgba(200, 210, 235, 0)');
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = 1;
            ctx.fillStyle = corona;
            ctx.fillRect(mx - r, my - r, r * 2, r * 2);
        }
        ctx.globalCompositeOperation = 'source-over';

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
        // Có mặt nước: cỏ, lau sậy, bụi cây trên bờ đất nhô lên nền trời, đom đóm
        if (horizon() < 1) drawBankSkyline(ctx, this.width, ground, this.clock, calm, glow, bankBandCss(this.height));
        ctx.globalAlpha = 1;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
};
