/*!
 * Hanabi – trình phát: cảnh vật (cây đung đưa)
 * Phần bổ sung và chỉnh sửa © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Cây đung đưa theo gió (liễu, cây tán rộng, dừa) theo mùa, dựng sẵn từng mức ngả.

import { season as sceneSeason } from '../state.js';
import { built, snowCap } from './util.js';
import { makeCanvas, seededRandom } from '../utils.js';

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
        atlas.draw(g, sz, seededRandom(131 + t * 977), sway, t, atlas.season);
        if (atlas.season === 'winter') snowCap(atlas.canvas, step * atlas.cw * k, t * atlas.ch * k, atlas.cw * k, atlas.ch * k, k);
        atlas.built[t * TREE_STEPS + step] = true;
    }
}

export function treeAtlas(kind, sz, screenK) {
    const k = screenK * TREE_RES;
    const season = sceneSeason();
    const key = `${kind}_${sz.toFixed(3)}_${k.toFixed(3)}_${season}`;
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
    // Mùa đông đọc lại từng ô để đắp tuyết: để ảnh ở bộ nhớ thường cho đọc nhanh
    const [c, g] = makeCanvas(Math.ceil(TREE_STEPS * spec.cw * k), Math.ceil(spec.kinds * spec.ch * k), { willReadFrequently: season === 'winter' });
    const queue = [];
    TREE_ORDER.forEach(step => {
        for (let t = 0; t < spec.kinds; t++) queue.push([t, step]);
    });
    const atlas = { key, canvas: c, g, k, sz, season, queue, total: queue.length, built: [], ...spec };
    growTreeAtlas(atlas, true);
    treeAtlasCache[kind] = atlas;
    return atlas;
}

// trees: [{ x, t (mẫu cây), phase (nhịp riêng), s (cỡ so với mẫu, mặc định 1) }]
export function drawSwayingTrees(ctx, atlas, trees, ground, clock, calm) {
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
// Màu lá liễu theo mùa (tối tới sáng): xuân lộc non xanh vàng, hạ xanh đậm, thu ngả vàng; đông trụi lá, chỉ còn cành
// mảnh màu nâu xám
const WILLOW_COLORS = {
    spring: ['#101a0c', '#172612', '#203318', '#2a4220', '#365429', '#456833', '#567d3e'],
    summer: ['#0c1610', '#122016', '#192b1d', '#213725', '#2c4630', '#3a573c', '#4d6c4c'],
    autumn: ['#1a160a', '#262010', '#352d15', '#463c1b', '#5a4d22', '#73622a', '#8f7a34'],
    winter: ['#15120e', '#1c1813', '#241f18', '#2c261d', '#352d22', '#3f3628', '#4a402f']
};

function drawWillow(g, sz, rnd, sway, kind, season = 'summer') {
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
    const colors = WILLOW_COLORS[season] || WILLOW_COLORS.summer;
    const bare = season === 'winter';
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
        const n = bare ? 0 : 10 + ((hang / sz / 3) | 0);
        for (let j = 1; j <= n; j++) {
            // Mùa thu lá thưa dần
            if (season === 'autumn' && (j + i) % 3 === 0) continue;
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
        g.lineWidth = (bare ? 0.38 : 0.3) * sz;
        g.stroke(strands[i]);
        g.lineWidth = 0.6 * sz;
        g.stroke(leaves[i]);
    });
}

// Cây xanh tán rộng (như sấu, bàng ven hồ): thân thẳng chia ba bốn cành lớn đỡ tán tròn rộng; tán gồm nhiều chùm lá
// chen nhau, giữa các chùm có chỗ hở thấy trời và thấy cành; mỗi chùm sáng phía trên (ánh trăng), tối phía dưới, lòng
// tán tối sâu, mép tán lởm chởm lá. Gió thổi: ngọn ngả nhiều hơn gốc, lá rung khẽ.
// Màu lá cây tán rộng (tối tới sáng): xanh hạ, lộc non xuân, vàng, đỏ cam mùa thu, hoa đào hồng, hoa trắng
const OAK_COLORS = {
    summer: ['#0b160e', '#102013', '#162a19', '#1e3521', '#28432a', '#345435', '#456843', '#5a7d55'],
    fresh: ['#0e1a0c', '#152612', '#1e3418', '#2a4520', '#3a5a2a', '#4d7036', '#628844', '#7aa055'],
    gold: ['#1e1606', '#2e220a', '#45330f', '#5e4614', '#7a5c1a', '#977322', '#b28a2c', '#cba23a'],
    red: ['#200c06', '#33140a', '#4c1e0f', '#682a14', '#85381a', '#a24a22', '#bb5e2c', '#d07838'],
    pink: ['#2a161d', '#3e2029', '#582d39', '#74404d', '#915663', '#ad6f7c', '#c88b97', '#e0a8b2'],
    white: ['#26262a', '#36363c', '#4a4a52', '#61616a', '#7a7a84', '#93939c', '#adadb5', '#c6c6cc']
};

// Mỗi mẫu cây (0, 1, 2) theo mùa: các loại lá, hoa và tỉ lệ. Xuân: cây đào nở rộ, cây lộc non điểm hoa trắng, cây hoa
// trắng; thu: cây lá vàng, cây lá đỏ cam, cây lá đổi màu lẫn lộn
const OAK_MIX = {
    summer: [[['summer', 1]], [['summer', 1]], [['summer', 1]]],
    spring: [[['pink', 0.82], ['fresh', 0.18]], [['fresh', 0.85], ['white', 0.15]], [['white', 0.55], ['fresh', 0.45]]],
    autumn: [[['gold', 0.85], ['fresh', 0.15]], [['red', 0.7], ['gold', 0.3]], [['gold', 0.45], ['red', 0.35], ['fresh', 0.2]]]
};

function drawOak(g, sz, rnd, sway, kind, season = 'summer') {
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
    if (season === 'winter') {
        // Mùa đông trơ cành: từ đầu mỗi cành lớn tỏa nhiều cành nhỏ, mỗi cành nhỏ lại tẽ nhánh con (tuyết đọng lên sau)
        const twigs = new Path2D();
        const shoots = new Path2D();
        const line = (path, x1, y1, x2, y2) => {
            path.moveTo(x1 + bend(y1), y1);
            path.lineTo(x2 + bend(y2), y2);
        };
        lumps.forEach(lump => {
            for (let i = 0; i < 7; i++) {
                const a = -Math.PI / 2 + (rnd() - 0.5) * 2.5;
                const len = lump.r * (0.6 + rnd() * 0.6);
                const x2 = lump.x + Math.cos(a) * len;
                const y2 = lump.y + Math.sin(a) * len;
                line(twigs, lump.x, lump.y, x2, y2);
                [-1, 1].forEach(side => {
                    const t = 0.4 + rnd() * 0.35;
                    const sx = lump.x + (x2 - lump.x) * t;
                    const sy = lump.y + (y2 - lump.y) * t;
                    const b = a + side * (0.4 + rnd() * 0.45);
                    const l2 = len * (0.3 + rnd() * 0.3);
                    line(shoots, sx, sy, sx + Math.cos(b) * l2, sy + Math.sin(b) * l2);
                });
            }
        });
        g.lineCap = 'round';
        g.lineWidth = 0.5 * sz;
        g.stroke(twigs);
        g.lineWidth = 0.3 * sz;
        g.stroke(shoots);
        return;
    }
    // Lá: hàng trăm lá nhỏ mỗi chùm, dày ở giữa, thưa ở mép; sáng theo hướng trăng chiếu (trên, hơi trái). Mùa xuân lẫn
    // hoa (tròn, nhỏ), mùa thu lá đổi màu, thưa hơn
    const mix = (OAK_MIX[season] || OAK_MIX.summer)[kind % 3];
    const colors = OAK_COLORS.summer;
    const paths = mix.map(() => colors.map(() => new Path2D()));
    const density = season === 'autumn' ? 0.8 : 1;
    const lx = -0.42;
    const ly = -0.9;
    lumps.forEach((lump, li) => {
        const count = Math.round(70 * density * (lump.r / (h * 0.17)) ** 2);
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
            let pick = rnd();
            let m = 0;
            while (m < mix.length - 1 && pick > mix[m][1]) pick -= mix[m++][1];
            // Hoa: cánh tròn, nhỏ hơn lá
            const flower = mix[m][0] === 'pink' || mix[m][0] === 'white';
            const fr = flower ? lr * 0.8 : lr;
            const path = paths[m][ci];
            path.moveTo(x + Math.cos(rot) * fr, y + Math.sin(rot) * fr);
            path.ellipse(x, y, fr, fr * (flower ? 0.85 : 0.6), rot, 0, Math.PI * 2);
        }
    });
    colors.forEach((_, i) => {
        mix.forEach(([name], m) => {
            g.fillStyle = OAK_COLORS[name][i];
            g.fill(paths[m][i]);
        });
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
