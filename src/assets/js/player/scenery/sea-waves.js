/*!
 * Hanabi – trình phát: cảnh vật (sóng biển)
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Biển khơi: sóng lừng nối nhau từ chân trời chạy vào bãi cát bên này. Hàng sóng thứ n tính từ người xem ở độ xa
// d = 1 / (1 + LAMBDA * n) (phối cảnh: xa thì nhỏ, sát nhau; gần thì to, thưa), cứ SEA_PERIOD lại thêm một hàng. Ngọn
// sóng đứt quãng từng đoạn, gợn bậc thang kiểu tranh điểm ảnh, bắt ánh pháo, ánh trăng; lác đác sóng bạc đầu rồi để lại
// vệt bọt tan dần. Bóng phản chiếu (Water.render bước 3) lệch theo sườn sóng (seaFace) nên bóng pháo, bóng trăng vỡ thành
// từng dải chạy theo sóng. Vào gần bờ sóng dựng lên, vỡ trắng xóa rồi tràn lên cát, lượt to lượt nhỏ, chỗ tràn xa chỗ
// tràn gần; nước rút để lại viền bọt, vệt cát ướt sẫm khô dần. Đá giữa biển: hàng sóng tới là đánh vào mặt đá phía biển,
// nước vọt lên sau đá thành từng tia tỏa hình quạt rồi vỡ thành giọt, bụi nước lơ lửng, nước xối xuống sườn đá, bọt loang
// quanh chân đá. Sóng vỗ bờ, sóng đánh vào đá có tiếng (sound-hook.js).

import { isLowQuality } from '../state.js';
import { hash, litCanvas, rand, smooth01 } from './util.js';
import { sceneSound } from './sound-hook.js';
import { drawGround } from './people/ground.js';

// Hai hàng sóng nối nhau cách nhau (ms)
const SEA_PERIOD = 6500;
const LAMBDA = 0.55;
// Một đơn vị bề ngang mặt biển khi ở sát người xem (phần bề ngang khung); ngọn sóng chia ô dài CELL đơn vị, mỗi ô một đoạn
const UNIT = 0.9;
const CELL = 0.2;
const TAU = Math.PI * 2;
const FOAM = 'rgb(222, 231, 244)';
// Giọt nước bay lên rồi rơi (điểm ảnh CSS mỗi ms², nhân cỡ theo độ xa)
const GRAVITY = 0.0009;
// Sóng tràn lên cát (ms): tràn lên, rút xuống, cát ướt khô dần
const UPRUSH = 1100;
const BACKWASH = 2600;
const DRY = 4200;
// Sóng dựng lên rồi vỡ trong khoảng này (độ xa) trước mép bãi cát
const BREAK_ZONE = 0.17;

// Lớp tạm vẽ khối nước tung lên ở đá (dùng chung)
let splashCanvas = null;

const frac = v => v - Math.floor(v);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// Số hàng sóng (kể cả phần lẻ) đã qua độ xa d lúc time: tăng một là có thêm một ngọn sóng chạy tới đó
const rowAt = (d, time) => (1 / Math.max(0.01, d) - 1) / LAMBDA + time / SEA_PERIOD;

// Sườn sóng ở độ xa d (1 sườn quay về người xem, -1 sườn sau, 0 ngọn và chân sóng). Chỗ các hàng sóng sát nhau hơn vài dải
// bóng phản chiếu (bandCss) thì nhạt dần về 0 cho khỏi răng cưa; depthCss: bề sâu mặt nước
export function seaFace(d, time, bandCss, depthCss) {
    const fade = smooth01(3 * bandCss, 7 * bandCss, LAMBDA * d * d * depthCss);
    return fade > 0 ? -Math.sin(TAU * frac(rowAt(d, time))) * fade : 0;
}

// Màu ánh pháo (fireLight: một màu, hoặc dải màu theo bề ngang khung rộng W)
function lightStyle(ctx, light, W) {
    if (typeof light === 'string') return light;
    const grad = ctx.createLinearGradient(0, 0, W, 0);
    light.forEach(([u, color]) => grad.addColorStop(u, color));
    return grad;
}

export const SeaWaves = {
    cssW: 0,
    // Các lượt sóng tràn lên bãi cát, số hàng sóng vừa tới bờ
    swash: [],
    beachRow: null,

    // Hình một hàng sóng theo tọa độ mặt biển (x: điểm ảnh khi ở sát người xem, tính từ giữa khung; y: từ đường ngọn
    // sóng): các đoạn ngọn sóng và mặt sóng dưới ngọn. Hàng sóng tiến vào thì chỉ phóng theo chiều ngang (drawCrests), nên
    // dựng sẵn, chỉ dựng lại khi độ dày, độ gợn, mặt sóng đổi một nấc. near: gợn bậc thang, hai đầu thon (hàng gần)
    crestRows: new Map(),

    crestRow(j, { th, amp, faceH, near, unit, c0, c1 }) {
        const key = `${th}_${Math.round(amp * 2)}_${faceH}_${near}_${Math.round(unit)}`;
        const row = this.crestRows.get(j);
        if (row && row.key === key && row.c0 <= c0 && row.c1 >= c1) return row;
        const path = new Path2D();
        const body = faceH > 0 ? new Path2D() : null;
        for (let c = c0; c <= c1; c++) {
            // Mỗi ô một đoạn ngọn sóng (thỉnh thoảng trống)
            if (hash(j * 131.7 + c * 17.3) > 0.8) continue;
            const start = (c + hash(j * 71.3 + c * 5.1) * 0.45) * CELL;
            const len = (0.22 + 0.58 * hash(j * 37.9 + c * 9.7)) * CELL;
            const x0 = start * unit;
            const w = len * unit;
            if (body) body.rect(x0, 0, w, faceH);
            if (!near) {
                path.rect(x0, Math.round(Math.sin(start * 30 + j * 1.7) * amp) - th, w, th);
                continue;
            }
            for (let i = 0; i < 4; i++) {
                const yy = Math.round(Math.sin((start + len * i / 4) * 30 + j * 1.7) * amp);
                const thick = Math.max(1, Math.round(th * (0.45 + 0.55 * Math.sin(Math.PI * (i + 0.5) / 4))));
                path.rect(x0 + w * i / 4, yy - thick, w / 4, thick);
            }
        }
        const made = { key, c0, c1, path, body, faceH };
        this.crestRows.set(j, made);
        return made;
    },

    // Ngọn sóng, sóng bạc đầu (lớp đang ở điểm ảnh thật; surf: mép trên mặt nước, H - surf: bề sâu; light: ánh pháo;
    // moon: Decor.moonGlow(); beachD: độ xa của mép bãi cát bên này, sóng tới đó thì vỡ lên bờ)
    drawCrests(ctx, { W, H, k, cssW, surf, time, light, moon, beachD }) {
        this.cssW = cssW;
        const span = H - surf;
        const P = time / SEA_PERIOD;
        const unit = UNIT * cssW * k;
        const cx = W / 2;
        const dMin = isLowQuality ? 0.14 : 0.1;
        const moonLight = moon ? moon.light : 0;
        const all = new Path2D();
        const rows = [];
        for (let j = Math.floor(P) + 1; ; j++) {
            const n = j - P;
            const d = 1 / (1 + LAMBDA * n);
            if (d < dMin) break;
            // Sát bờ là sóng vỡ (drawBreakers)
            if (d > beachD - BREAK_ZONE * 0.6) continue;
            // Chỗ các hàng sóng sát nhau quá (gần chân trời) thì mờ dần
            const spacing = LAMBDA * d * d * span;
            const fade = smooth01(2 * k, 8 * k, spacing) * smooth01(dMin, dMin + 0.06, d)
                * (1 - smooth01(beachD - BREAK_ZONE, beachD - BREAK_ZONE * 0.6, d));
            if (fade <= 0) continue;
            const y = Math.round(surf + d * span);
            const half = cx / (d * unit) / CELL;
            const shape = this.crestRow(j, {
                th: Math.max(1, Math.round((0.6 + 2.6 * d) * k)), amp: (0.4 + 2.2 * d) * k,
                faceH: d > 0.2 ? Math.round(Math.min(spacing * 0.4, (4 + 22 * d) * k)) : 0,
                near: d >= 0.4, unit, c0: Math.floor(-half) - 1, c1: Math.floor(half) + 1
            });
            const at = new DOMMatrix([d, 0, 0, 1, cx, y]);
            rows.push({ j, n, d, y, fade, shape, at, th: Math.max(1, Math.round((0.6 + 2.6 * d) * k)) });
            all.addPath(shape.path, at);
        }
        // Hàng đã chạy vào bờ thì bỏ
        this.crestRows.forEach((row, j) => j <= P && this.crestRows.delete(j));

        ctx.globalCompositeOperation = 'source-over';
        rows.forEach(r => {
            ctx.setTransform(r.at);
            // Mặt sóng dưới ngọn (quay về người xem, soi phần trời cao tối hơn), nhạt dần xuống
            if (r.shape.body) {
                const shade = ctx.createLinearGradient(0, 0, 0, r.shape.faceH);
                shade.addColorStop(0, `rgba(3, 7, 16, ${0.5 * r.d * r.fade})`);
                shade.addColorStop(1, 'rgba(3, 7, 16, 0)');
                ctx.globalAlpha = 1;
                ctx.fillStyle = shade;
                ctx.fill(r.shape.body);
            }
            ctx.globalAlpha = (0.1 + 0.3 * r.d) * r.fade * (0.75 + 0.5 * moonLight);
            ctx.fillStyle = 'rgb(160, 184, 224)';
            ctx.fill(r.shape.path);
        });
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        // Ngọn sóng bắt ánh sáng: dưới trăng ánh bạc, ánh pháo rọi khắp mặt biển (theo màu pháo từng chỗ)
        ctx.globalCompositeOperation = 'lighter';
        if (moon && moonLight > 0.03) {
            const tone = `255, ${Math.round(244 - 40 * moon.warm)}, ${Math.round(222 - 95 * moon.warm)}`;
            const mx = moon.x * k;
            const half = moon.radius * k * 7;
            const glade = ctx.createLinearGradient(mx - half, 0, mx + half, 0);
            glade.addColorStop(0, `rgba(${tone}, 0)`);
            glade.addColorStop(0.5, `rgba(${tone}, 1)`);
            glade.addColorStop(1, `rgba(${tone}, 0)`);
            ctx.globalAlpha = 0.55 * moonLight;
            ctx.fillStyle = glade;
            ctx.fill(all);
        }
        if (light) {
            ctx.globalAlpha = 0.5;
            ctx.fillStyle = lightStyle(ctx, light, W);
            ctx.fill(all);
        }

        // Sóng bạc đầu: ngọn sóng vỡ trắng một quãng rồi để lại vệt bọt nằm lại chỗ vỡ, loang ra, tan dần
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = FOAM;
        const bright = 0.7 + 0.4 * moonLight;
        rows.forEach(r => {
            if (r.d < 0.18) return;
            for (let i = 0; i < 2; i++) {
                if (hash(r.j * 41.3 + i * 7.7) > 0.5) continue;
                const nb = 0.6 + hash(r.j * 23.1 + i * 3.3) * 4.5;
                const life = 0.5 + hash(r.j * 13.7 + i) * 0.6;
                const age = nb - r.n;
                if (age < 0 || age > life + 1.3) continue;
                const wx = (hash(r.j * 19.3 + i * 3.1) - 0.5) * 4.4;
                const seed = hash(r.j * 7.1 + i);
                if (age < life) {
                    const env = age < 0.12 ? age / 0.12 : Math.pow(1 - (age - 0.12) / (life - 0.12), 1.4);
                    const x = cx + wx * r.d * unit;
                    const wd = (0.05 + 0.07 * seed) * unit * r.d * (0.7 + 0.8 * age / life);
                    ctx.globalAlpha = 0.75 * env * bright;
                    ctx.fillRect(Math.round(x - wd / 2), r.y - Math.round(r.th * 1.7), Math.round(wd), Math.round(r.th * 1.9));
                    ctx.globalAlpha = 0.45 * env * bright;
                    ctx.fillRect(Math.round(x - wd * 0.28 + wd * 0.2 * (seed - 0.5)), r.y - Math.round(r.th * 2.9), Math.round(wd * 0.55), r.th);
                }
                // Vệt bọt nằm lại chỗ vỡ
                const left = (age - life * 0.5) / (life * 0.5 + 1.3);
                if (left <= 0 || left >= 1) continue;
                const db = 1 / (1 + LAMBDA * nb);
                const yb = Math.round(surf + db * span);
                const xb = cx + wx * db * unit;
                const wb = (0.07 + 0.08 * seed) * unit * db * (1 + left);
                const dot = Math.max(1, Math.round((0.8 + 1.6 * db) * k));
                ctx.globalAlpha = 0.4 * (1 - left) * bright;
                for (let m = 0; m < 9; m++) {
                    const u = hash(seed * 50 + m) - 0.5;
                    const v = hash(seed * 70 + m) - 0.5;
                    ctx.fillRect(Math.round(xb + u * wb), yb + Math.round(v * (2 + 5 * db) * k * (1 + left)), Math.round(dot * (1.5 + 2 * hash(m + seed))), dot);
                }
            }
        });
        ctx.globalAlpha = 1;
    },

    // Đá giữa biển: hàng sóng tới là đánh vào đá (rocks: đá của mặt nước, chỉ đá biển kind 'sea'). Nước tung lên thành
    // từng cụm bọt (puffs) tỏa hình quạt, giọt nước (drops) bay rồi rơi; tọa độ tính từ chân đá giữa mặt nước
    updateRocks(rocks, time, dt) {
        rocks.forEach(rock => {
            if (rock.kind !== 'sea') return;
            const row = Math.floor(rowAt(rock.d, time));
            if (rock.row !== undefined && row !== rock.row) {
                const q = hash(row * 7.31 + rock.seed * 91.7);
                if (q > 0.12) this.crash(rock, 0.3 + 0.7 * q, time);
            }
            rock.row = row;
            const move = p => {
                p.age += dt;
                if (p.age < p.delay) return true;
                p.x += p.vx * dt;
                p.y += p.vy * dt;
                p.vy += p.g * dt;
                return p.age < p.life && !(p.y > 0 && p.vy > 0);
            };
            rock.drops = (rock.drops || []).filter(move);
            rock.puffs = (rock.puffs || []).filter(p => {
                // Nước tung lên bị không khí cản, bay ngang chậm dần
                p.vx *= Math.exp(-dt / 900);
                return move(p);
            });
        });
    },

    crash(rock, q, time) {
        rock.crashes = (rock.crashes || []).filter(c => time - c.t0 < 5000);
        rock.crashes.push({ t0: time, q, seed: Math.random() * 100 });
        sceneSound('crash', this.cssW ? rock.x / this.cssW : 0.5, rock.d, { size: q });
        const geo = rock.geo;
        if (!geo) return;
        const few = isLowQuality ? 0.5 : 1;
        const g = GRAVITY * geo.s;
        // Sóng đánh vào mặt đá phía biển (phía xa) rồi vọt lên thành từng tia tỏa hình quạt (dồn về giữa, dài ngắn, nghiêng
        // khác nhau; sóng to vọt quá đỉnh đá). Mỗi tia phun liền một chuỗi cụm bọt: ngọn nhỏ bay nhanh, gốc to bay chậm nên
        // thành dải nước thuôn dần; cụm bọt teo dần nên ngọn tia vỡ thành giọt. Chân đá phía sau nước dâng trắng xóa
        const gp = g * 0.75;
        for (let jn = 0, jets = Math.round((8 + 8 * q) * (isLowQuality ? 0.6 : 1)); jn < jets; jn++) {
            const side = (rand(-0.5, 0.5) + rand(-0.5, 0.5)) * 0.8;
            const ang = side * 1.6;
            const lift = rand(0.5, 1.6) * (1 - 0.45 * Math.abs(side));
            const v = Math.sqrt(2 * gp * geo.hUp * q * lift);
            const vx = Math.sin(ang) * v * 0.85;
            const vy = -Math.cos(ang) * v;
            const x = side * geo.w * 0.6;
            const start = rand(0, 180);
            for (let i = 0, n = Math.round((10 + 6 * q) * few); i < n; i++) {
                const u = i / (n - 1);
                const slow = 1 - 0.45 * u;
                rock.puffs.push({
                    x: x + rand(-0.6, 0.6) * geo.s, y: -0.08 * geo.hUp, vx: vx * slow, vy: vy * slow, g: gp,
                    r: (1.4 + 3.6 * u) * geo.s * rand(0.85, 1.15), age: 0, delay: start + i * 16, life: rand(700, 1100) + 300 * u
                });
            }
        }
        for (let i = 0, n = Math.round(20 * few); i < n; i++) {
            rock.puffs.push({
                x: rand(-0.55, 0.55) * geo.w, y: -0.06 * geo.hUp, vx: rand(-0.01, 0.01) * geo.s, vy: -Math.sqrt(2 * gp * geo.hUp * q * rand(0.1, 0.35)),
                g: gp, r: rand(2.5, 4.5) * geo.s, age: 0, delay: rand(0, 200), life: rand(900, 1400), swell: true
            });
        }
        for (let i = 0, n = Math.round((20 + 40 * q) * few); i < n; i++) {
            const side = rand(-0.5, 0.5);
            const height = geo.hUp * q * rand(0.4, 1.5);
            rock.drops.push({
                x: side * geo.w * 0.9, y: -rand(0, 0.35) * geo.hUp, vx: (side * rand(0.03, 0.1) + rand(-0.015, 0.015)) * geo.s,
                vy: -Math.sqrt(2 * g * height), g, size: rand(0.8, 2) * geo.s, age: 0, delay: rand(0, 200), life: 3200
            });
        }
    },

    // Nước quanh chân đá và sóng đánh vào đá (lớp đã nhân k, điểm ảnh CSS; y: mặt nước chỗ đá, w: bề ngang đá, hUp: đá
    // nhô cao khỏi mặt nước, s: cỡ theo độ xa; light: ánh pháo chỗ đá)
    drawRockSurf(ctx, rock, y, w, hUp, s, k, time, light) {
        rock.geo = { w, hUp, s };
        const x0 = rock.x - w / 2;
        const px = Math.max(1 / k, 0.8 * s);
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = FOAM;
        // Viền bọt dập dềnh quanh chân đá
        for (let i = 0; i < 10; i++) {
            const fx = x0 + w * (0.06 + i * 0.09) + Math.sin(time * 0.002 + i * 1.9 + rock.seed * 5) * 1.5 * s;
            ctx.globalAlpha = 0.2 + 0.25 * (0.5 + 0.5 * Math.sin(time * 0.003 + i * 2.3 + rock.seed * 3));
            ctx.fillRect(fx, y - 0.6 * s, (3 + (i % 3) * 2) * s, px);
        }
        rock.crashes = (rock.crashes || []).filter(c => time - c.t0 < 5000);
        rock.crashes.forEach(c => {
            const age = time - c.t0;
            const q = c.q;
            // Bọt loang ra quanh chân đá thành ren bọt vụn, tan dần (chỗ khuất sau đá thì không thấy)
            const p = age / 5000;
            const rx = w * (0.45 + 0.75 * (1 - Math.pow(1 - Math.min(1, age / 2000), 2)));
            ctx.globalAlpha = 0.6 * q * Math.pow(1 - p, 1.2);
            for (let m = 0; m < 34; m++) {
                const a = hash(c.seed + m * 3.1) * TAU;
                const r = rx * (0.55 + 0.5 * hash(c.seed + m * 5.7));
                const fx = Math.cos(a) * r;
                const fy = Math.sin(a) * (r * 0.15 + 1.2 * s);
                if (fy < 0 && Math.abs(fx) < w * 0.38) continue;
                ctx.fillRect(rock.x + fx, y + 0.6 * s + fy, (1.5 + 3.5 * hash(m + c.seed)) * s, px);
            }
            // Nước xối xuống sườn đá thành từng dòng mảnh
            if (age > 450 && age < 2200) {
                const t = (age - 450) / 1750;
                ctx.globalAlpha = 0.32 * q * (1 - t);
                for (let i = 0; i < 6; i++) {
                    const fx = x0 + w * (0.2 + 0.6 * hash(c.seed * 9 + i));
                    const from = hUp * q * (0.4 + 0.4 * hash(c.seed * 3 + i));
                    const len = (4 + 6 * hash(c.seed + i * 1.3)) * s;
                    const top = y - from * (1 - t) - len * 0.5;
                    ctx.fillRect(fx, top, px, Math.max(0, Math.min(len, y - top)));
                }
            }
            // Màn bụi nước còn lơ lửng sau khi sóng vỡ, tan chậm
            if (age > 200 && age < 3200) {
                const t = (age - 200) / 3000;
                const bx = rock.x + (hash(c.seed * 7) - 0.5) * w * 0.3;
                const by = y - hUp * q * (0.55 + 0.35 * t);
                const r = w * (0.35 + 0.35 * t) * (0.6 + 0.6 * q);
                const mist = ctx.createRadialGradient(bx, by, 0, bx, by, r);
                mist.addColorStop(0, 'rgba(215, 225, 240, 1)');
                mist.addColorStop(1, 'rgba(215, 225, 240, 0)');
                ctx.globalAlpha = 0.3 * q * Math.sin(Math.PI * Math.min(1, t * 1.6 + 0.1)) * (1 - t);
                ctx.fillStyle = mist;
                ctx.fillRect(bx - r, by - r, r * 2, r * 2);
                // Ánh pháo rọi lên màn bụi nước
                if (light) {
                    const lit = ctx.createRadialGradient(bx, by, 0, bx, by, r);
                    lit.addColorStop(0, light);
                    lit.addColorStop(1, 'rgba(0, 0, 0, 0)');
                    ctx.globalCompositeOperation = 'lighter';
                    ctx.fillStyle = lit;
                    ctx.fillRect(bx - r, by - r, r * 2, r * 2);
                    ctx.globalCompositeOperation = 'source-over';
                }
                ctx.fillStyle = FOAM;
            }
        });
        ctx.fillStyle = FOAM;
        (rock.drops || []).forEach(p => {
            if (p.age < p.delay) return;
            ctx.globalAlpha = 0.85 * (1 - p.age / p.life);
            ctx.fillRect(rock.x + p.x - p.size / 2, y + p.y - p.size / 2, p.size, p.size);
        });
        ctx.globalAlpha = 1;
    },

    // Nước tung lên khi sóng đánh vào đá (vẽ trước tảng đá: sóng đánh vào mặt phía biển nên đá che phần giữa, thấy nước vọt
    // qua đỉnh, tràn hai bên): các cụm bọt vẽ liền thành một khối trên lớp tạm (chồng nhau không thành vòng tròn trong
    // suốt), mặt trên sáng, mép dưới phải xám như có khối; cụm bọt cuối đời thì teo lại nên khối nước tan dần từ mép. Ánh
    // pháo rọi lên khối nước
    drawSplash(ctx, rock, y, k, light) {
        const live = (rock.puffs || []).filter(p => p.age >= p.delay);
        if (!live.length) return;
        // Nước vọt lên càng bay xa càng vỡ thành giọt (teo dần); nước dâng ở chân đá thì phồng ra rồi tan
        const size = p => {
            const t = (p.age - p.delay) / p.life;
            return p.r * (p.swell ? (1 + 0.8 * t) * (1 - Math.pow(t, 2.5)) : 1 - 0.75 * t);
        };
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        live.forEach(p => {
            const r = size(p) * 1.4;
            x0 = Math.min(x0, p.x - r);
            x1 = Math.max(x1, p.x + r);
            y0 = Math.min(y0, Math.min(0, p.y) - r);
            y1 = Math.max(y1, Math.min(0, p.y) + r);
        });
        const w = Math.ceil((x1 - x0) * k) + 2;
        const h = Math.ceil((y1 - y0) * k) + 2;
        if (!splashCanvas) splashCanvas = document.createElement('canvas');
        if (splashCanvas.width < w || splashCanvas.height < h) {
            splashCanvas.width = Math.max(splashCanvas.width, w);
            splashCanvas.height = Math.max(splashCanvas.height, h);
        }
        const g = splashCanvas.getContext('2d');
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.clearRect(0, 0, w, h);
        g.setTransform(k, 0, 0, k, -x0 * k, -y0 * k);
        [['rgb(165, 178, 202)', 0.15, 0.2, 1], ['rgb(235, 241, 250)', -0.05, -0.08, 0.9]].forEach(([color, ox, oy, scale]) => {
            g.fillStyle = color;
            g.beginPath();
            live.forEach(p => {
                const r = size(p);
                if (r <= 0) return;
                const cx = p.x + r * ox;
                const cy = Math.min(0, p.y) + r * oy;
                g.moveTo(cx + r * scale, cy);
                g.arc(cx, cy, r * scale, 0, TAU);
            });
            g.fill();
        });
        const dx = rock.x + x0;
        const dy = y + y0;
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 0.92;
        ctx.drawImage(splashCanvas, 0, 0, w, h, dx, dy, w / k, h / k);
        if (light) {
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = 0.6;
            ctx.drawImage(litCanvas(splashCanvas, light, 0, 0, w, h), 0, 0, w, h, dx, dy, w / k, h / k);
            ctx.globalCompositeOperation = 'source-over';
        }
        ctx.globalAlpha = 1;
    },

    // Sóng vỡ sát bờ (lớp đang ở điểm ảnh thật): ngọn sóng dựng lên, mặt sóng sẫm lại, rồi vỡ trắng từng quãng (chỗ vỡ
    // trước chỗ vỡ sau), bọt cuộn đổ xuống mặt sóng, sau lưng để lại vệt bọt; chỗ vỡ mạnh tung bụi nước. Dáng riêng của
    // mỗi hàng sóng (độ lổn nhổn, chỗ vỡ trước sau, độ lượn) không đổi nên tính sẵn một lần (breakRows)
    breakRows: new Map(),

    breakRow(j, cols, step, k) {
        const key = `${j}_${cols}_${step}`;
        let row = this.breakRows.get(key);
        if (row) return row;
        row = { lump: new Float32Array(cols), pb: new Float32Array(cols), bend: new Float32Array(cols), down: new Float32Array(cols), spray: new Float32Array(cols), trail: new Float32Array(cols) };
        for (let i = 0; i < cols; i++) {
            const u = i * step / k;
            row.lump[i] = clamp(0.5 + 0.35 * Math.sin(u / 41 + j * 2.1) + 0.22 * Math.sin(u / 17 + j * 5.3) + 0.1 * Math.sin(u / 7.3 + j), 0, 1.2);
            // Chỗ vỡ trước chỗ vỡ sau dọc ngọn sóng, có quãng tới sát bờ mới vỡ
            row.pb[i] = 0.5 * (0.6 * Math.sin(u / 140 + j * 1.3) + 0.4 * Math.sin(u / 47 + j * 3.7));
            // Dòng sóng không thẳng tắp: lượn theo đáy biển, chỗ tới trước chỗ tới sau
            row.bend[i] = Math.sin(u / 260 + j * 1.7) * 5 + Math.sin(u / 97 + j * 0.7) * 2.5;
            row.down[i] = 0.4 + 0.8 * hash(i * 0.37 + j);
            row.spray[i] = hash(i * 2.3 + j * 1.9) < 0.3 ? hash(i * 5.1 + j) : -1;
            row.trail[i] = hash(i * 1.31 + j * 7.7);
        }
        this.breakRows.set(key, row);
        if (this.breakRows.size > 6) this.breakRows.delete(this.breakRows.keys().next().value);
        return row;
    },

    drawBreakers(ctx, { W, H, k, surf, beachD, time, light, bright }) {
        const span = H - surf;
        const P = time / SEA_PERIOD;
        const from = beachD - BREAK_ZONE;
        const step = Math.max(1, Math.round(4 * k));
        const cols = Math.ceil(W / step);
        const px = Math.max(1, Math.round(k));
        for (let j = Math.floor(P) + 1; ; j++) {
            const d = 1 / (1 + LAMBDA * (j - P));
            if (d < from) break;
            if (d > beachD) continue;
            const p = (d - from) / BREAK_ZONE;
            const y = Math.round(surf + d * span);
            const row = this.breakRow(j, cols, step, k);
            const swell = Math.sin(Math.PI * Math.min(1, p * 1.2));
            const bendK = k * (0.4 + 0.6 * p);
            const fh = Math.round((2 + 12 * p) * k);
            // Mặt sóng dựng sẫm ngay dưới ngọn, nhạt dần xuống (lượn theo dòng sóng)
            const face = new Path2D();
            face.moveTo(0, y - Math.round(swell * k - row.bend[0] * bendK));
            for (let i = 4; i < cols + 4; i += 4) {
                const c = Math.min(cols - 1, i);
                face.lineTo(Math.min(W, i * step), y - Math.round(swell * k - row.bend[c] * bendK));
            }
            for (let i = cols + 3 - ((cols + 3) % 4); i >= 0; i -= 4) {
                const c = Math.min(cols - 1, i);
                face.lineTo(Math.min(W, i * step), y - Math.round(swell * k - row.bend[c] * bendK) + fh);
            }
            face.closePath();
            const lip = new Path2D();
            const foam = new Path2D();
            const top = new Path2D();
            const trail = new Path2D();
            const spray = new Path2D();
            for (let i = 0; i < cols; i++) {
                const x = i * step;
                const pb = clamp(p * 1.5 - 0.45 + row.pb[i], 0, 1);
                const crest = y - Math.round(swell * (1 + 2.5 * row.lump[i]) * k - row.bend[i] * bendK);
                if (pb < 0.15) {
                    lip.rect(x, crest - px, step, px);
                    continue;
                }
                // Cuộn bọt: phần dưới xám (khuất sáng), mặt trên trắng
                const up = Math.round((1.5 + 9 * pb) * k * (0.4 + 0.9 * row.lump[i]));
                const down = Math.round((1 + 7 * pb) * k * row.down[i]);
                foam.rect(x, crest - up, step, up + down);
                top.rect(x, crest - up, step, Math.max(1, Math.round(up * 0.6)));
                // Chỗ vỡ mạnh tung bụi nước
                if (pb > 0.6 && row.spray[i] >= 0) spray.rect(x + (i % 3) * px, crest - up - Math.round((3 + 8 * pb) * k * row.spray[i]), px, px);
                // Vệt bọt sau lưng sóng đã vỡ
                if (row.trail[i] < 0.45 * pb) trail.rect(x, crest - up - Math.round((3 + 16 * pb) * k * row.down[i] * 0.8), step, px);
            }
            const show = smooth01(0, 0.25, p);
            ctx.globalCompositeOperation = 'source-over';
            const shade = ctx.createLinearGradient(0, y - 6 * k, 0, y + fh + 6 * k);
            shade.addColorStop(0, 'rgba(4, 9, 20, 1)');
            shade.addColorStop(1, 'rgba(4, 9, 20, 0)');
            ctx.globalAlpha = 0.6 * (1 - 0.4 * p);
            ctx.fillStyle = shade;
            ctx.fill(face);
            ctx.fillStyle = FOAM;
            ctx.globalAlpha = 0.35 * bright;
            ctx.fill(lip);
            ctx.globalAlpha = 0.45 * bright * show;
            ctx.fill(trail);
            ctx.globalAlpha = 0.9 * show;
            ctx.fillStyle = `rgb(${Math.round(120 + 40 * bright)}, ${Math.round(136 + 40 * bright)}, ${Math.round(165 + 40 * bright)})`;
            ctx.fill(foam);
            ctx.fillStyle = FOAM;
            ctx.globalAlpha = 0.95 * bright * show;
            ctx.fill(top);
            ctx.globalAlpha = 0.6 * bright * show;
            ctx.fill(spray);
            if (light) {
                ctx.globalCompositeOperation = 'lighter';
                ctx.globalAlpha = 0.45 * show;
                ctx.fillStyle = lightStyle(ctx, light, W);
                ctx.fill(foam);
            }
        }
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
    },

    // Dáng riêng của một lượt sóng tràn lên (chỗ tràn xa chỗ tràn gần, bọt dày mỏng, ren bọt, bọt li ti) không đổi suốt
    // lượt đó: tính sẵn một lần theo số cột
    swashShape(sw, cols, step, k) {
        if (sw.cols === cols) return sw;
        sw.cols = cols;
        sw.shape = new Float32Array(cols);
        sw.lump = new Float32Array(cols);
        sw.crashLump = new Float32Array(cols);
        sw.h = new Float32Array(cols);
        sw.h2 = new Float32Array(cols);
        for (let i = 0; i < cols; i++) {
            const u = i * step / k;
            // Mỗi lượt một dáng, thêm các doi cát cố định dọc bờ
            sw.shape[i] = clamp(0.55 + 0.22 * Math.sin(u / 190 + sw.seed) + 0.14 * Math.sin(u / 71 + sw.seed * 1.7)
                + 0.07 * Math.sin(u / 27 + sw.seed * 2.3) + 0.1 * Math.sin(u / 113), 0.12, 1);
            sw.lump[i] = 0.5 + 0.3 * Math.sin(u / 23 + sw.seed * 3) + 0.2 * Math.sin(u / 9 + sw.seed);
            sw.crashLump[i] = 0.5 + 0.3 * Math.sin(u / 31 + sw.seed * 2) + 0.2 * Math.sin(u / 11 + sw.seed * 4);
            sw.h[i] = hash(i * 1.7 + sw.seed);
            sw.h2[i] = hash(i * 3.3 + sw.seed);
        }
        return sw;
    },

    // Bãi cát bên này (lớp đang ở điểm ảnh thật): sóng vỡ sát bờ, cát, ánh pháo rọi (people/ground.js), rồi sóng tràn
    // lên. topCss: mép nước (đỉnh dải cát); reachCss: sóng to nhất tràn lên tới đâu; beachD: độ xa của mép nước; surf:
    // mép trên mặt nước; mirror: như drawCrests; sky: màu trời theo ánh pháo
    drawBeach(ctx, { W, H, k, surf, topCss, reachCss, beachD, time, sky, season, wet, calm, mirror, light }) {
        const y0 = Math.round(topCss * k);
        const band = H - y0;
        if (band <= 0) return;
        const bright = 0.75 + 0.25 * smooth01(0, 3, (sky.r + sky.g + sky.b) / 3);
        this.drawBreakers(ctx, { W, H, k, surf, beachD, time, light, bright });
        drawGround(ctx, { W, top: topCss, k, kind: 'sand', season, wet, sky, time, calm, foam: false });
        // Mỗi hàng sóng tới bờ là một lượt sóng tràn lên, lượt to lượt nhỏ
        const row = Math.floor(rowAt(beachD, time));
        if (this.beachRow !== null && row !== this.beachRow) {
            const q = 0.35 + 0.65 * hash(row * 3.71 + 0.5);
            this.swash.push({ t0: time, q, seed: hash(row * 9.13) * 100, cols: 0 });
            if (this.swash.length > 3) this.swash.shift();
            sceneSound('shore', 0.5, 1, { size: q });
        }
        this.beachRow = row;
        this.swash = this.swash.filter(sw => time - sw.t0 < UPRUSH + BACKWASH + DRY);

        const step = Math.max(2, Math.round(5 * k));
        const cols = Math.ceil(W / step);
        const px = Math.max(1, Math.round(k));
        // Đỉnh đa giác (lớp nước, cát ướt) cách nhau hai cột: mép mượt, đỡ tốn
        const outline = (heights, scale) => {
            const path = new Path2D();
            path.moveTo(0, y0);
            for (let i = 0; i < cols; i += 2) path.lineTo(i * step, y0 + Math.round(heights[i] * scale));
            path.lineTo(W, y0 + Math.round(heights[cols - 1] * scale));
            path.lineTo(W, y0);
            path.closePath();
            return path;
        };
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, y0, W, band);
        ctx.clip();
        // Mép nước: bọt mỏng lấp lánh đứt quãng
        ctx.fillStyle = FOAM;
        for (let i = 0; i < cols; i += 6) {
            const a = 0.5 + 0.5 * Math.sin(time * 0.0016 + hash(i) * 20);
            if (a < 0.35) continue;
            ctx.globalAlpha = (a - 0.35) * 0.4 * bright;
            ctx.fillRect(i * step, y0, step * 4, px);
        }
        const front = new Float32Array(cols);
        this.swash.forEach((sw, n) => {
            const age = time - sw.t0;
            const reach = Math.min(band, reachCss * k) * (0.3 + 0.7 * sw.q);
            const { shape, lump, crashLump, h, h2 } = this.swashShape(sw, cols, step, k);
            // Tràn lên nhanh rồi chậm lại; rút về chậm hơn ở chỗ tràn xa
            const up = 1 - Math.pow(1 - Math.min(1, age / UPRUSH), 2);
            const back = age < UPRUSH ? 0 : Math.min(1, (age - UPRUSH) / BACKWASH);
            for (let i = 0; i < cols; i++) front[i] = reach * shape[i] * (back ? 1 - smooth01(0, 1, back * (1.3 - 0.45 * shape[i])) : up);
            // Cát ướt sẫm tới chỗ nước lên cao nhất, khô dần (hai lượt gần nhất)
            const wetness = 1 - smooth01(UPRUSH + BACKWASH * 0.4, UPRUSH + BACKWASH + DRY, age);
            if (age > UPRUSH * 0.5 && wetness > 0 && n >= this.swash.length - 2) {
                ctx.globalAlpha = 0.32 * wetness * sw.q;
                ctx.fillStyle = 'rgb(6, 8, 14)';
                ctx.fill(outline(shape, reach));
            }
            if (back >= 1) return;
            // Lớp nước mỏng tràn trên cát, soi phần trời thấp (ánh chân trời, ánh pháo) ép dẹt lại
            const sheet = outline(front, 1);
            ctx.globalAlpha = 0.5 * (1 - back);
            ctx.fillStyle = 'rgb(70, 92, 130)';
            ctx.fill(sheet);
            ctx.save();
            ctx.clip(sheet);
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = 0.4 * (1 - back);
            ctx.drawImage(mirror, 0, 0, W, Math.max(1, Math.round(mirror.height * 0.5)), 0, y0, W, Math.ceil(reach) + 1);
            ctx.restore();
            // Bọt: đang tràn lên thì ngay sau mép nước là dải nước sủi trắng, mép nước là viền bọt dày mỏng không đều; bọt
            // li ti trong nước, dày dần về phía mép; lúc rút là ren bọt nằm lại chỗ cao nhất, mép nước rút còn bọt mỏng
            const boring = age < UPRUSH * 1.2 ? 1 - age / (UPRUSH * 1.2) : 0;
            const bore = new Path2D();
            const fizz = new Path2D();
            const foam = new Path2D();
            const lace = new Path2D();
            const thick = (2 + 4 * sw.q * (1 - back)) * k;
            for (let i = 0; i < cols; i++) {
                const f = Math.round(front[i]);
                if (f >= 1) {
                    const t = Math.max(px, Math.round(thick * (0.4 + 0.9 * lump[i])));
                    foam.rect(i * step, y0 + f - t, step, t);
                    if (!(i & 1)) {
                        if (boring > 0) {
                            const bh = Math.round(f * (0.25 + 0.2 * h2[i]));
                            bore.rect(i * step, y0 + f - bh, step * 2, bh);
                        }
                        if (h[i] < 0.55) fizz.rect(i * step + Math.round(h2[i] * step), y0 + Math.round(f * (1 - h[i] * h[i] * 1.6)), Math.round(step * (0.4 + h[i])), px);
                    }
                }
                if (back > 0 && h[i] > 0.3 && !(i & 1)) {
                    const yy = y0 + Math.round(reach * shape[i] - (h2[i] * 2.5 + 0.5) * k);
                    lace.rect(i * step + Math.round(h[i] * step * 0.4), yy, Math.round(step * (1 + h[i])), Math.max(px, Math.round(k * (0.5 + h[i]))));
                }
            }
            ctx.fillStyle = FOAM;
            if (boring > 0) {
                ctx.globalAlpha = 0.45 * boring * bright;
                ctx.fill(bore);
            }
            ctx.globalAlpha = 0.45 * (1 - back) * bright;
            ctx.fill(fizz);
            ctx.globalAlpha = (age < UPRUSH ? 0.85 : 0.45 * (1 - back)) * bright;
            ctx.fill(foam);
            if (back > 0) {
                ctx.globalAlpha = 0.6 * (1 - smooth01(0.2, 1, (age - UPRUSH) / (BACKWASH + 1400))) * bright;
                ctx.fill(lace);
            }
            // Sóng vừa đổ ập vào mép cát: cả mảng bọt trắng lổn nhổn rồi tan vào lớp nước tràn
            if (age < 800) {
                const crash = new Path2D();
                const fade = (2 + 6 * sw.q) * k * (1 - age / 800);
                for (let i = 0; i < cols; i += 2) crash.rect(i * step, y0, step * 2, Math.max(px, Math.round(fade * crashLump[i])));
                ctx.globalAlpha = 0.85 * bright;
                ctx.fill(crash);
            }
            // Ánh pháo rọi lên bọt sóng
            if (light) {
                ctx.globalCompositeOperation = 'lighter';
                ctx.globalAlpha = 0.4 * (1 - back);
                ctx.fillStyle = lightStyle(ctx, light, W);
                ctx.fill(foam);
                ctx.globalCompositeOperation = 'source-over';
            }
        });
        ctx.restore();
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
    }
};
