/*!
 * Trình diễn Pháo hoa – trình phát: cảnh vật (mây)
 * Phần bổ sung và chỉnh sửa © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Mây đêm: dáng mây theo loại, dựng ảnh mây từng phần cho không khựng khung hình.

import { fbm, hash, makeNoise, smooth01 } from './util.js';

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

export function* buildCloud(w, h, seed, kind) {
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
