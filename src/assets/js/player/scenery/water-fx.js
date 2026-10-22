/*!
 * Trình diễn Pháo hoa – trình phát: cảnh vật (hiệu ứng mặt nước)
 * Phần bổ sung và chỉnh sửa © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Hiệu ứng mặt nước dùng chung: bóng phản chiếu gợn sóng, phần chìm khúc xạ, nước rẽ quanh vật, vật trôi
// né đá, mặt băng mùa đông, vệt sáng của đèn in dài xuống nước.

import { IS_MOBILE } from '../env.js';
import { fbm, hash, makeNoise, smooth01 } from './util.js';
import { makeCanvas, seededRandom } from '../utils.js';

// Vệt sáng của một ngọn đèn in dài xuống mặt nước (như ảnh chụp sông về đêm): sóng cắt vệt thành từng nét ngang ngắn
// lấp lánh, lệch qua lại, xa mép nước thì thưa, mờ và loang rộng. x: tâm; top: mép nước; reach: dài; width: rộng ở mép
// nước; s: cỡ một nét (cùng đơn vị với tọa độ); seed: lệch nhịp riêng của từng đèn. Vẽ cộng sáng (ctx đặt sẵn lighter).
export function drawLightStreak(ctx, x, top, reach, width, rgb, alpha, time, seed, s) {
    if (alpha <= 0.01 || reach <= 0) return;
    ctx.fillStyle = `rgb(${rgb})`;
    const n = Math.max(6, Math.round(reach / (2.2 * s)));
    for (let i = 0; i < n; i++) {
        const q = i / n;
        const wobble = Math.sin(time * 0.004 + i * 1.7 + seed * 9) * (1 + 2.5 * q) * s;
        ctx.globalAlpha = alpha * Math.pow(1 - q, 1.3) * (0.55 + 0.45 * Math.sin(time * 0.006 + i * 2.3 + seed * 5));
        const w = width * (1 + 0.8 * q) * (0.6 + 0.4 * Math.sin(i * 3.1 + seed * 7 + time * 0.002));
        ctx.fillRect(x + wobble - w / 2, top + q * reach, w, Math.max(0.5, 0.55 * s));
    }
    ctx.globalAlpha = 1;
}

// Vệt sóng sau vật: những mảnh vòng sóng nhỏ tách ra từ hai bên đuôi vật, trôi ra sau, nở rộng, dạt dần sang hai bên
// rồi tan; mảnh này chưa tan mảnh khác đã tới, mỗi lượt một dáng (chỗ tách, độ cong, độ dài cung) nên mềm và sống như
// nước thật chứ không cứng như hai nét kẻ. Không lưu trạng thái: mỗi mảnh là một pha thời gian.
// dir: 1 vệt kéo về bên phải (hạ nguồn), -1 bên trái; strength 0-1. Tọa độ điểm ảnh CSS (lớp đã nhân k).
export function drawWakeTrail(ctx, x, y, half, s, k, time, seed, dir, strength) {
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
export function drawReflection(ctx, sprite, x, y, w, wlOff, alpha, time, seed, s) {
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
export function drawMirrorSlices(ctx, surf, lift, x, halfW, alpha, time, seed, s, squash = 0.85) {
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
export function drawSubmerged(ctx, sprite, x, y, w, below, time, seed, s) {
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
export function drawFlowMarks(ctx, x, y, half, s, k, time, seed, river, strength) {
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

// Cỡ vật trên mặt nước theo độ xa d (0 sát chân trời, 1 sát người xem)
export const depthScale = d => (0.6 + d * 1.1) * (IS_MOBILE ? 0.85 : 1);

// Trôi theo dòng (điểm ảnh CSS / ms) ở độ xa d, khớp với các vệt sáng của mặt nước; hồ thì đứng yên
export const flowSpeed = (d, river) => (river ? 0.03 * (0.4 + 1.2 * d) : 0);

// Né đá, gò đất: dòng nước rẽ qua vật cản đẩy vật trôi dạt dần sang bên từ khá xa phía trước, mạnh dần khi tới gần, êm
// lại sau khi qua; tốc độ dạt ngang có quán tính nên không giật ngang. x, half: tâm và nửa bề ngang vật (điểm ảnh CSS);
// dir: hướng vật đang đi (1 sang phải, -1 sang trái, 0 đứng yên: chỉ dạt khi chồng lên vật cản).
export function steerAround(item, x, half, rocks, dt, depthCss, dir = 1) {
    let push = 0;
    for (const rock of rocks) {
        const rockHalf = rock.size * depthScale(rock.d) / 2;
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

// Mặt băng mùa đông (vẽ sẵn theo cỡ khung): sương giá mờ, tuyết phủ loang lổ thành từng mảng (sát bờ dày thành dải tuyết),
// vài vết nứt dài tẽ nhánh. Xa chân trời mảng tuyết dẹt và nhỏ lại, gần người xem to ra (phối cảnh)
let iceCache = { key: '', canvas: null };

export function iceSheet(W, H, surf, k) {
    const key = `${W}_${H}_${surf}_${k.toFixed(3)}`;
    if (iceCache.key === key) return iceCache.canvas;
    const h = H - surf;
    const [c, g] = makeCanvas(W, Math.max(1, h));
    // Mảng tuyết, sương giá: tính thưa (nửa độ phân giải) rồi phóng lên cho mềm
    const sw = Math.max(1, Math.ceil(W / 2));
    const sh = Math.max(1, Math.ceil(h / 2));
    const [small, sg] = makeCanvas(sw, sh);
    const img = sg.createImageData(sw, sh);
    const noise = makeNoise(91);
    // Chiếu phối cảnh mặt phẳng băng: hàng cách chân trời r điểm ảnh ở xa 1/r; ngang và dọc trên mặt băng cùng co theo xa
    // gần (mảng xa nhỏ và dẹt, mảng gần to), mảng gần người xem rộng gấp ~2,5 lần bề dọc
    const patchPx = 110 * k;
    for (let py = 0; py < sh; py++) {
        const d = py / sh;
        const r = py * 2 + 4 * k;
        const Q = 2.5 * h * h / (r * patchPx);
        const shore = Math.pow(Math.max(0, 1 - d / 0.07), 2);
        for (let px = 0; px < sw; px++) {
            const P = (px * 2 - W / 2) * h / (r * patchPx);
            const patch = smooth01(0.55, 0.72, fbm(noise, P, Q, 4));
            const frost = fbm(noise, P * 4 + 50, Q * 4, 2);
            const a = Math.min(0.85, patch * 0.42 + frost * 0.08 + shore * 0.7);
            const i = (py * sw + px) * 4;
            const tone = 0.9 + 0.12 * frost;
            img.data[i] = 176 * tone;
            img.data[i + 1] = 186 * tone;
            img.data[i + 2] = 208 * tone;
            img.data[i + 3] = 255 * a;
        }
    }
    sg.putImageData(img, 0, 0);
    g.imageSmoothingEnabled = true;
    g.drawImage(small, 0, 0, sw, sh, 0, 0, W, h);
    // Vết nứt: đường gãy khúc dài, tẽ nhánh; xa chân trời nằm ngang, gần người xem xiên nhiều hơn
    const rnd = seededRandom(53);
    const crack = (x, y, a, steps, width) => {
        const path = [[x, y]];
        for (let i = 0; i < steps; i++) {
            const d = Math.max(0, Math.min(1, y / h));
            a += (rnd() - 0.5) * 0.9;
            const flat = 0.25 + 0.75 * d;
            const len = (6 + 26 * d) * k * (0.6 + rnd() * 0.8);
            x += Math.cos(a) * len;
            y += Math.sin(a) * len * flat * 0.5;
            path.push([x, y]);
            if (rnd() < 0.18 && steps > 4) crack(x, y, a + (rnd() < 0.5 ? -1 : 1) * (0.6 + rnd() * 0.6), (steps / 3) | 0, width * 0.7);
            if (y < 0 || y > h) break;
        }
        [['rgba(8, 14, 26, 0.35)', 1], ['rgba(214, 228, 248, 0.32)', 0]].forEach(([color, off]) => {
            g.strokeStyle = color;
            g.lineWidth = width;
            g.beginPath();
            path.forEach(([px, py], i) => (i ? g.lineTo(px, py + off * k * 0.6) : g.moveTo(px, py + off * k * 0.6)));
            g.stroke();
        });
    };
    for (let i = 0; i < 7; i++) crack(rnd() * W, h * (0.15 + rnd() * 0.8), (rnd() < 0.5 ? 0 : Math.PI) + (rnd() - 0.5) * 0.8, 10 + ((rnd() * 10) | 0), Math.max(1, 0.7 * k));
    iceCache = { key, canvas: c };
    return c;
}
