/*!
 * Trình diễn Pháo hoa – trình phát: cảnh vật (kiểu bờ)
 * Phần bổ sung và chỉnh sửa © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Phần nhô lên trời của từng kiểu bờ (kè gạch, kè đá, bãi cát, phố cổ, cầu đá, thành phố), dựng sẵn rồi vẽ
// mỗi khung kèm cây, đèn.

import { season as sceneSeason } from '../state.js';
import { radialGlow, snowCap, tintCanvas } from './util.js';
import { bankStyle } from './bank.js';
import { drawSwayingTrees, treeAtlas } from './trees.js';
import { LANTERN_COLORS, archGeometry, archRing, drawLampPost, drawRailing, drawShophouse, lanternSprites, stoneFacing } from './skyline-parts.js';
import { CITY_SKYLINE } from './city-skyline.js';
import { makeCanvas, seededRandom } from '../utils.js';

// Phần nhô lên trời của từng kiểu bờ. build: vẽ phần đứng yên (g) và ánh đèn đứng yên (gl, cộng sáng), trả dữ liệu cho
// phần chuyển động; before: vẽ mỗi khung trước phần đứng yên (cây đung đưa phía sau lan can, cầu); frame: vẽ mỗi khung
// sau phần đứng yên; lights: vẽ mỗi khung, cộng sáng (đèn đổi màu); up(ground, sz): cao bao nhiêu trên chân trời (mặc
// định 120 * sz)
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
        build(g, gl, { cssW, sz, rnd, season }) {
            // Thảm cỏ thấp trên mặt kè (theo mùa)
            g.fillStyle = { spring: '#2a4421', autumn: '#4e4424', winter: '#4a4436' }[season] || '#22361f';
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
        build(g, gl, { cssW, sz, rnd, season }) {
            // Cỏ biển lưa thưa trên cát (theo mùa)
            g.strokeStyle = { autumn: '#54502e', winter: '#4a4436' }[season] || '#2c3a24';
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
    // Thành phố về đêm bên sông (city-skyline.js)
    city: CITY_SKYLINE
};

export let skylineCache = { key: '' };

// Phần đứng yên của kiểu bờ: vẽ sẵn (và lớp ánh đèn riêng để cộng sáng) theo cỡ khung, mật độ điểm ảnh
// drop: chiều cao mặt bờ dưới chân trời; lớp vẽ kéo xuống tới mép nước (chân cầu đứng dưới nước)
function skylineLayer(style, cssW, ground, k, drop) {
    const sz = Math.max(0.6, Math.min(1.25, Math.min(ground / 420, cssW / 700)));
    const season = sceneSeason();
    const key = `${style}_${Math.round(cssW)}_${Math.round(ground)}_${k.toFixed(3)}_${drop.toFixed(2)}_${season}`;
    if (skylineCache.key === key) return skylineCache;
    const up = Math.ceil(BANK_SKYLINES[style].up ? BANK_SKYLINES[style].up(ground, sz) : 120 * sz);
    const make = () => {
        const [c, g] = makeCanvas(Math.ceil(cssW * k), Math.ceil((up + drop + 4) * k));
        g.setTransform(k, 0, 0, k, 0, up * k);
        return [c, g];
    };
    const [canvas, g] = make();
    const [glow, gl] = make();
    const rnd = seededRandom(97);
    const data = BANK_SKYLINES[style].build(g, gl, { cssW, sz, rnd, ground, k, drop, season }) || {};
    // Mùa đông: tuyết đọng trên lan can, mái nhà, mặt cầu, cột đèn, cỏ
    if (season === 'winter') snowCap(canvas, 0, 0, canvas.width, canvas.height, k);
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
export function drawStyledSkyline(ctx, cssW, ground, clock, calm, glow, drop) {
    const style = BANK_SKYLINES[bankStyle];
    if (!style) return;
    const k = ctx.getTransform().a || 1;
    const layer = skylineLayer(bankStyle, cssW, ground, k, drop);
    const w = layer.canvas.width / k;
    const h = layer.canvas.height / k;
    // Đặt ảnh vẽ sẵn đúng lưới điểm ảnh thật: chân trời thường lẻ nửa điểm ảnh (vd 969 / 2), vẽ lệch thì mỗi nét 1 điểm
    // ảnh (mạch đá, lan can, mái nhà) tách thành hai hàng mờ
    const y0 = Math.round((ground - layer.up) * k) / k;
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
