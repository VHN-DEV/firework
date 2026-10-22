/*!
 * Trình diễn Pháo hoa – trình phát: cảnh vật (thân bờ)
 * Phần bổ sung và chỉnh sửa © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Thân bờ dưới chân trời (bờ đất, kè gạch, kè đá, bãi cát, chân cầu) theo mùa; chiều cao mặt bờ; bọt sóng bãi cát.

import { bankNoise, fbm, hash, smooth01 } from './util.js';
import { makeCanvas, seededRandom } from '../utils.js';

// Bờ đất bên kia mặt nước (tông đêm, ánh trăng rọi từ trên): mặt bờ gần phẳng, chỗ lở lõm vào chút; vách đất có lớp và
// hạt, rễ cây lòi ra gần mép trên, vài hòn cuội lấp ló, sát nước là dải bùn ướt sẫm ánh lên màu trời, chân bờ bị nước
// khoét lõm tối. Vẽ từng điểm ảnh một lần theo cỡ khung, nằm ở lớp mặt nước (dưới chân trời). Cỏ, lau sậy, bụi cây,
// đom đóm nhô lên trên chân trời vẽ ở lớp bầu trời (drawBankSkyline): các lớp trên trang ghép kiểu "lighten" nên vật tối
// vẽ ở lớp mặt nước mà nằm trước nền trời sáng ánh trăng sẽ bị nhạt màu.
let bankCache = { key: '', canvas: null, over: 0 };

// Mặt bờ lõm xuống bao nhiêu (điểm ảnh CSS) dưới chân trời tại hoành độ X
export function bankDip(X) {
    const noise = bankNoise();
    return Math.max(0, (fbm(noise, X / 80, 0.5, 3) - 0.5) * 3.2 + (noise(X / 7, 4.2) - 0.5) * 0.7);
}

// Bờ đất theo mùa. cap: màu cỏ phủ mặt bờ [r, biên độ r, g, biên độ g, b, biên độ b]; fringe: cỏ ngắn; bush, bushLight:
// bụi cây ở xa và chỗ hứng sáng (mùa đông là tuyết đọng); tuft: 4 màu bụi cỏ, 4 màu lau; head: bông của khóm lau
// ('cattail' cỏ nến, 'plume' bông lau trắng mùa thu); reeds: tỉ lệ khóm lau; flowers: hoa dại lấm tấm (xuân); flies:
// đom đóm (hạ); snow: tuyết phủ (đông)
export const BANK_SEASONS = {
    spring: {
        cap: [32, 20, 52, 32, 26, 12], fringe: ['#2a4421', '#36552a', '#436634', '#223a1f'], bush: '#18271a', bushLight: 'rgba(66, 100, 58, 0.55)',
        tuft: ['#2e4a28', '#3a5a30', '#4a6c3a', '#26402a', '#4a5e38', '#5a6a3c', '#4e6a3a', '#52603a'], head: '', reeds: 0.1, flowers: true
    },
    summer: {
        cap: [28, 20, 44, 30, 26, 14], fringe: ['#24391f', '#2e4628', '#395532', '#1f3120'], bush: '#16231a', bushLight: 'rgba(52, 78, 56, 0.55)',
        tuft: ['#2a4228', '#365231', '#43603a', '#223823', '#45583a', '#56623c', '#625c3f', '#4d5838'], head: 'cattail', reeds: 0.13, flies: true
    },
    autumn: {
        cap: [50, 22, 44, 20, 24, 10], fringe: ['#4a4222', '#5a4f28', '#6a5c30', '#3a3420'], bush: '#2a1c12', bushLight: 'rgba(132, 80, 38, 0.55)',
        tuft: ['#5a5028', '#6a5c2e', '#7a6a36', '#4a4224', '#6a6040', '#7a7048', '#5e5638', '#706644'], head: 'plume', reeds: 0.3
    },
    winter: {
        cap: [28, 20, 44, 30, 26, 14], fringe: ['#4a4436', '#5a5444', '#3c372c', '#6a6454'], bush: '#1e1c1a', bushLight: 'rgba(196, 204, 222, 0.8)',
        tuft: ['#4a4538', '#565040', '#3e3a30', '#605a48', '#5a5040', '#6a5e48', '#4e4636', '#625844'], head: '', reeds: 0.13, snow: true
    }
};

export function bankSprite(W, bankPx, k, style = '', season = 'summer') {
    const key = `${W}_${bankPx}_${k.toFixed(3)}_${style}_${season}`;
    if (bankCache.key === key) return bankCache;
    if (BANK_BODIES[style]) {
        bankCache = { key, canvas: styledBankSprite(W, bankPx, k, style, season), over: 0 };
        return bankCache;
    }
    const look = BANK_SEASONS[season] || BANK_SEASONS.summer;
    const [c, g] = makeCanvas(W, bankPx);
    const noise = bankNoise();
    const rnd = seededRandom(29);
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
            if (look.snow && depth < grass[x] * 1.8 + 1.4) {
                // Mùa đông: tuyết phủ dày trên mặt bờ, mặt tuyết gợn
                const sn = noise(X / 2 + 9, Y * 1.1);
                r = 146 + 22 * sn;
                gg = 154 + 22 * sn;
                b = 174 + 20 * sn;
            } else if (depth < grass[x]) {
                // Mặt bờ phủ cỏ (theo mùa)
                const gn = noise(X / 1.4 + 9, Y * 1.3);
                const [r0, rn, g0, gn0, b0, bn] = look.cap;
                r = r0 + rn * gn;
                gg = g0 + gn0 * gn;
                b = b0 + bn * gn;
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

// Kiểu bờ đang dùng (Water.render đặt mỗi khung; lớp bầu trời vẽ trước lớp mặt nước nên dùng giá trị của khung trước)
export let bankStyle = '';

export const setBankStyle = value => { bankStyle = value; };

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

export function ashlar(noise, X, Y) {
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
export function bankLight(noise, X, Y, rel, r, gg, b, sand) {
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

function styledBankSprite(W, bankPx, k, style, season = 'summer') {
    const snow = season === 'winter' && style !== 'none';
    const [c, g] = makeCanvas(W, bankPx);
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
            // Mùa đông: tuyết phủ mặt kè (bãi cát: tuyết loang lổ)
            if (snow && (Y < 1.8 + 1.6 * noise(X / 5 + 3, 7) || (sand && rel < 0.55 && fbm(noise, X / 9 + 40, Y / 3, 2) > 0.5))) {
                const sn = noise(X / 2 + 9, Y * 1.1);
                r = 152 + 20 * sn;
                gg = 160 + 20 * sn;
                b = 180 + 18 * sn;
            }
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
        const rnd = seededRandom(41);
        for (let x = rnd() * 30 * k; x < W; x += (14 + rnd() * 40) * k) {
            g.fillStyle = `rgba(170, 190, 220, ${0.15 + rnd() * 0.2})`;
            g.fillRect(x, bankPx - Math.max(1, Math.round(2 * k)), (1.5 + rnd() * 3) * k, Math.max(1, Math.round(0.6 * k)));
        }
    }
    return c;
}

// Chiều cao mặt bờ từ chân trời xuống mép nước (điểm ảnh CSS; cssH: chiều cao khung)
export const bankBandCss = cssH => Math.max(8, Math.min(16, cssH * 0.018));

// Bãi cát: bọt sóng trắng đứt quãng dọc bờ, sóng vỗ vào rồi rút ra (dải bọt dịch lên xuống, sáng mờ theo nhịp)
let foamCache = null;

export function drawBeachFoam(ctx, W, surf, k, time, calm) {
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
