/*!
 * Trình diễn Pháo hoa – trình phát: cảnh vật (ảnh vật trên nước)
 * Phần bổ sung và chỉnh sửa © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Ảnh vẽ sẵn của vật trên mặt nước: hoa đăng, khúc gỗ, lá bèo, đá, gò đất (đổi màu theo mùa).

import { built, fbm, hdSprite, makeNoise, snowCap, sprites } from './util.js';

// Hoa đăng: đế hoa sen giấy, nến cháy ở giữa
export function floatLanternSprite() {
    if (sprites.floatLantern) return sprites.floatLantern;
    const [c, g] = hdSprite(48, 40);
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
export const LOG_KINDS = 5;

// Ảnh vật trên nước vẽ sẵn gấp mấy lần điểm ảnh CSS: theo mật độ điểm ảnh lớp mặt nước đang vẽ (Water.render), màn 2K/4K
// hay đang vẽ dư thì gấp 4 cho khỏi nhòe khi phóng to
export let spriteRes = 2;

export const setSpriteRes = value => { spriteRes = value; };

export function logSprite(variant) {
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

// Lá bèo (lá súng) nằm phẳng trên nước (nhìn chếch nên dẹt), có khe hình nêm; kiểu 3 có hoa súng hồng
export function padSprite(variant) {
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

const waterWarm = new Set();

export function warmWaterSprites() {
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
export function rockSprite(variant) {
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
export function moundSprite(variant) {
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

// Lá rụng (thu: vàng, cam, đỏ, nâu) và cánh hoa đào (xuân: hồng, trắng): mỗi loại một ảnh nhỏ, vẽ xoay, lật khi bay,
// nằm dẹt khi trôi trên mặt nước. Màu dịu theo ánh trăng
export const LEAF_COLORS = {
    autumn: [['#b88a24', '#6e4c10'], ['#c0681c', '#70340c'], ['#a8401e', '#5a1c0c'], ['#8c6834', '#4a3216'], ['#c8a43a', '#7a5e16']],
    spring: [['#d8a2b4', '#9a5c70'], ['#e4c2cc', '#a8808c'], ['#ece0e2', '#b0989e'], ['#cc8aa2', '#8e4e64']]
};

let leafSprites = {};

export function fallingLeafSprite(season, i) {
    const key = `${season}_${i}`;
    if (leafSprites[key]) return leafSprites[key];
    const c = document.createElement('canvas');
    c.width = c.height = 48;
    const g = c.getContext('2d');
    const [fill, vein] = LEAF_COLORS[season][i % LEAF_COLORS[season].length];
    g.translate(24, 24);
    if (season === 'autumn') {
        // Lá: phiến thon hai đầu nhọn, mép hơi lượn, gân giữa, gân bên, cuống
        g.fillStyle = fill;
        g.beginPath();
        g.moveTo(0, -20);
        g.bezierCurveTo(14, -12, 12, 8, 0, 17);
        g.bezierCurveTo(-12, 8, -14, -12, 0, -20);
        g.fill();
        g.strokeStyle = vein;
        g.lineWidth = 1.6;
        g.beginPath();
        g.moveTo(0, -17);
        g.lineTo(0, 23);
        for (let y = -10; y <= 8; y += 6) {
            g.moveTo(0, y);
            g.lineTo(7, y - 5);
            g.moveTo(0, y);
            g.lineTo(-7, y - 5);
        }
        g.stroke();
    } else {
        // Cánh hoa đào: tròn, khuyết nhẹ ở đầu, gốc thon ửng đậm
        g.fillStyle = fill;
        g.beginPath();
        g.moveTo(0, 14);
        g.bezierCurveTo(-15, 4, -12, -15, -3, -14);
        g.lineTo(0, -10);
        g.lineTo(3, -14);
        g.bezierCurveTo(12, -15, 15, 4, 0, 14);
        g.fill();
        g.fillStyle = vein;
        g.globalAlpha = 0.5;
        g.beginPath();
        g.ellipse(0, 9, 3, 4, 0, 0, Math.PI * 2);
        g.fill();
    }
    leafSprites[key] = c;
    return c;
}

// Đá, gò đất, lá bèo theo mùa: thu cỏ, rêu, lá bèo ngả vàng úa; đông cỏ rêu bạc màu, tuyết đọng mặt trên, lau sậy khô
// không bông. Đổi màu từng điểm (chỗ xanh lá) một lần rồi giữ lại
const seasonSprites = new Map();

export function seasonSprite(sprite, season) {
    if (season !== 'autumn' && season !== 'winter') return sprite;
    let made = seasonSprites.get(sprite);
    if (!made) seasonSprites.set(sprite, made = {});
    if (made[season]) return made[season];
    const c = document.createElement('canvas');
    c.width = sprite.width;
    c.height = sprite.height;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(sprite, 0, 0);
    const img = g.getImageData(0, 0, c.width, c.height);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
        const green = d[i + 1] - Math.max(d[i], d[i + 2]);
        if (green < 3 || d[i + 3] < 8) continue;
        const t = Math.min(1, green / 26);
        const [r, gg, b] = [d[i], d[i + 1], d[i + 2]];
        const [tr, tg, tb] = season === 'autumn' ? [gg * 1.18, gg * 0.92, b * 0.55] : [(r + gg + b) / 3 * 1.25 + 30, (r + gg + b) / 3 * 1.28 + 34, (r + gg + b) / 3 * 1.38 + 44];
        d[i] = r + (tr - r) * t * (season === 'winter' ? 0.85 : 1);
        d[i + 1] = gg + (tg - gg) * t * (season === 'winter' ? 0.85 : 1);
        d[i + 2] = b + (tb - b) * t * (season === 'winter' ? 0.85 : 1);
    }
    g.putImageData(img, 0, 0);
    if (season === 'winter' && sprite.wl) snowCap(c, 0, 0, c.width, sprite.wl, spriteRes, 1.6);
    const reedColor = season === 'autumn' ? '#6a5c32' : '#5c5442';
    Object.assign(c, {
        wl: sprite.wl,
        logicalW: sprite.logicalW,
        reeds: sprite.reeds && sprite.reeds.map(reed => ({ ...reed, color: reedColor, cattail: season === 'autumn' && reed.cattail }))
    });
    made[season] = c;
    return c;
}
