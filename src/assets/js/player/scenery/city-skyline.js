/*!
 * Hanabi – trình phát: cảnh vật (thành phố bên sông)
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Thành phố về đêm bên sông (như Sài Gòn nhìn từ bờ bên kia): dãy nhà cao tầng xa mờ trong sương đêm; phía trước là
// những tòa tháp: tháp búp sen có sân đỗ trực thăng nhô ra (đèn viền chạy vòng), đỉnh sáng trắng; tháp cao nhất mặt kính
// đổi màu chầm chậm (tím, hồng, lam), đỉnh bậc thang rực vàng, chóp nhọn; khách sạn mặt tiền hồng, tháp đỉnh vàng, tháp
// mặt kính đèn LED theo tầng có dải sáng chạy dọc, khối nhà đỏ, văn phòng ô cửa trắng, biển quảng cáo LED đổi hình; nóc
// nhà mỗi tòa một kiểu (bậc thang, ăng-ten đèn đỏ, biển hiệu sáng). Dọc bờ là dãy nhà thấp kiểu Pháp sáng vàng, hàng cây
// giăng đèn nhiều màu, cột đèn, đường ven sông xe chạy (ô tô đèn pha trắng một chiều, đèn hậu đỏ chiều kia, xe máy lố
// nhố). Đèn đỏ trên nóc nhà cao tầng nhấp nháy; quầng sáng thành phố hắt lên trời. Đèn sáng in vệt dài lấp lánh xuống
// sông (cityLightStreaks, mặt nước vẽ). Tọa độ điểm ảnh CSS, gốc ở chân trời (lên trên là âm). Dùng trong BANK_SKYLINES
// (skylines.js).

import { radialGlow, tintCanvas } from './util.js';
import { drawLampPost } from './skyline-parts.js';
import { glowSprite } from './sky-life/light.js';
import { makeCanvas } from '../utils.js';

// Nhà cao nhất cao bấy nhiêu phần bầu trời
const CITY_HEIGHT = 0.62;

const WARM = ['255, 214, 150', '255, 226, 170', '255, 198, 120'];
const COOL = ['226, 236, 255', '206, 222, 255', '242, 246, 255'];
const GOLD = '255, 210, 95';

// Nhà cao tầng: x tâm (tỉ lệ bề ngang), w bề rộng (điểm ảnh ở khung 1280), h chiều cao (tỉ lệ lớp vẽ), kiểu, màu đèn hắt
// mặt tiền, có biển quảng cáo LED không. Nhà cao vẽ trước (phía sau), nhà thấp vẽ sau (che chân nhà cao)
const TOWERS = [
    { x: 0.05, w: 52, h: 0.2, kind: 'block' },
    { x: 0.115, w: 36, h: 0.32, kind: 'grid' },
    { x: 0.205, w: 34, h: 0.88, kind: 'lotus' },
    { x: 0.29, w: 62, h: 0.36, kind: 'block', wash: '255, 120, 190' },
    { x: 0.355, w: 32, h: 0.52, kind: 'crown' },
    { x: 0.415, w: 42, h: 0.3, kind: 'block', wash: '235, 60, 50' },
    { x: 0.465, w: 34, h: 0.62, kind: 'led' },
    { x: 0.545, w: 48, h: 0.44, kind: 'grid', board: true },
    { x: 0.62, w: 30, h: 0.27, kind: 'block' },
    { x: 0.715, w: 44, h: 1, kind: 'spire' },
    { x: 0.79, w: 34, h: 0.3, kind: 'grid' },
    { x: 0.855, w: 56, h: 0.24, kind: 'block', wash: '90, 140, 255', board: true },
    { x: 0.935, w: 44, h: 0.36, kind: 'grid' }
].sort((a, b) => b.h - a.h);

// hsl (độ, 0-1, 0-1) -> 'r, g, b'
function hslRgb(h, s, l) {
    const f = n => {
        const k = (n + h / 30) % 12;
        return Math.round(255 * (l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
    };
    return `${f(0)}, ${f(8)}, ${f(4)}`;
}

// Màu mặt kính tháp cao nhất (đổi chầm chậm tím, hồng, lam), màu đèn LED theo tầng (xanh lá, ngọc, lam)
const spireHue = (clock, calm) => 290 + 40 * Math.sin(clock * (calm ? 0.00004 : 0.00009)) + 35 * Math.sin(clock * (calm ? 0.00011 : 0.00023) + 1);
const ledHue = (clock, calm, i) => 140 + 50 * Math.sin(clock * (calm ? 0.00008 : 0.00022) + i * 2);

// Thân nhà: kính tối, trên sáng hơn chút (ánh trời thành phố), mép trái hứng ánh trăng
function body(g, x, top, w, color = '#0a0e1a') {
    g.fillStyle = color;
    g.fillRect(x, top, w, -top);
    const sheen = g.createLinearGradient(0, top, 0, 0);
    sheen.addColorStop(0, 'rgba(150, 160, 200, 0.05)');
    sheen.addColorStop(1, 'rgba(150, 160, 200, 0)');
    g.fillStyle = sheen;
    g.fillRect(x, top, w, -top);
    g.fillStyle = 'rgba(170, 180, 210, 0.12)';
    g.fillRect(x, top, Math.max(0.5, w * 0.04), -top);
}

// Ô cửa sáng đèn theo lưới tầng: mỗi tầng có lúc tắt gần hết (văn phòng về đêm), có lúc sáng dày; vẽ vào lớp sáng
function windows(gl, rnd, x, top, w, bottom, floor, { lit = 0.45, colors = WARM, alpha = [0.3, 0.75] } = {}) {
    const rows = Math.floor((bottom - top) / floor);
    const cols = Math.max(2, Math.round(w / (floor * 0.95)));
    const cw = w / cols;
    // Mỗi tòa sáng một kiểu: có tòa gần như tắt hết, có tòa sáng dày
    const mood = 0.55 + rnd() * 0.75;
    for (let r = 0; r < rows; r++) {
        const rowLit = lit * mood * (rnd() < 0.2 ? 0.1 : rnd() < 0.15 ? 1.7 : 1);
        for (let c = 0; c < cols; c++) {
            if (rnd() > rowLit) continue;
            gl.globalAlpha = alpha[0] + (alpha[1] - alpha[0]) * rnd() * rnd();
            gl.fillStyle = `rgb(${colors[(rnd() * colors.length) | 0]})`;
            gl.fillRect(x + c * cw + cw * 0.25, top + r * floor + floor * 0.3, cw * 0.5, floor * 0.42);
        }
    }
    gl.globalAlpha = 1;
}

// Đèn hắt mặt tiền: sáng nhất ở chân, nhạt dần lên trên (đèn chiếu từ dưới lên)
function wash(gl, x, top, w, bottom, rgb, low, high) {
    const grad = gl.createLinearGradient(0, bottom, 0, top);
    grad.addColorStop(0, `rgba(${rgb}, ${low})`);
    grad.addColorStop(1, `rgba(${rgb}, ${high})`);
    gl.fillStyle = grad;
    gl.fillRect(x, top, w, bottom - top);
}

// Phần sáng đổi màu mỗi khung (mặt kính, dải LED) vẽ riêng màu trắng: paint(g, w, h) vẽ trong khung riêng; trả canvas và
// chỗ đặt (tính từ chân trời)
function maskLayer(x, top, w, h, k, paint) {
    const [c, g] = makeCanvas(Math.max(1, Math.ceil(w * k)), Math.max(1, Math.ceil(h * k)));
    g.setTransform(k, 0, 0, k, 0, 0);
    paint(g, w, h);
    return { canvas: c, x, y: top, w, h };
}

// b: { cx, w, H, floor, sz, k, rnd, data, t } của một tòa nhà
function block(g, gl, b) {
    const { cx, w, H, floor, sz, rnd, data, t } = b;
    const x = cx - w / 2;
    body(g, x, -H, w, '#0e1322');
    // Nóc nhà mỗi tòa một kiểu: lùi bậc, ăng-ten đèn đỏ, biển hiệu sáng, phòng kỹ thuật
    const roof = rnd();
    g.fillStyle = '#0c101c';
    if (roof < 0.28) {
        g.fillRect(x + w * 0.1, -H - floor * 1.4, w * 0.8, floor * 1.4);
        g.fillRect(x + w * 0.28, -H - floor * 2.5, w * 0.44, floor * 1.1);
    } else if (roof < 0.52) {
        g.fillRect(x + w * 0.2, -H - floor * 0.9, w * 0.3, floor * 0.9);
        g.fillRect(x + w * 0.62, -H - floor * 5, Math.max(0.5, 0.5 * sz), floor * 5);
        data.beacons.push({ x: x + w * 0.62, y: -H - floor * 5 - 0.6 * sz });
    } else if (roof < 0.74 && !t.wash) {
        g.fillRect(x + w * 0.15, -H - floor * 1.3, w * 0.7, floor * 1.3);
        gl.fillStyle = 'rgba(236, 242, 255, 0.85)';
        gl.fillRect(x + w * 0.2, -H - floor * 1.05, w * 0.6, floor * 0.8);
        radialGlow(gl, cx, -H - floor * 0.6, w * 0.5, '220, 232, 255', 0.15);
    } else {
        g.fillRect(x + w * 0.2, -H - floor * 0.9, w * 0.3, floor * 0.9);
    }
    if (t.wash) wash(gl, x, -H, w, 0, t.wash, 0.5, 0.16);
    windows(gl, rnd, x, -H + floor * 0.6, w, 0, floor, { lit: t.wash ? 0.35 : 0.5, colors: t.wash ? ['255, 236, 214'] : WARM });
    if (t.wash) {
        gl.fillStyle = `rgba(${t.wash}, 0.7)`;
        gl.fillRect(x, -H, w, Math.max(0.6, floor * 0.25));
        data.streaks.push({ x: cx, w: w * 0.7, rgb: t.wash, a: 0.3, reach: 0.4 });
    }
}

function grid(g, gl, b) {
    const { cx, w, H, floor, rnd } = b;
    const x = cx - w / 2;
    body(g, x, -H, w, '#0b1120');
    windows(gl, rnd, x, -H + floor * 0.4, w, 0, floor, { lit: 0.6, colors: COOL, alpha: [0.35, 0.9] });
}

// Tháp đỉnh vàng: ô cửa trắng, chóp mái rực vàng
function crown(g, gl, b) {
    const { cx, w, H, floor, rnd, data } = b;
    const x = cx - w / 2;
    body(g, x, -H, w, '#0c1222');
    g.fillStyle = '#121626';
    g.fillRect(x + w * 0.15, -H - floor * 2.2, w * 0.7, floor * 2.2);
    windows(gl, rnd, x, -H + floor * 1.6, w, 0, floor, { lit: 0.62, colors: COOL });
    wash(gl, x + w * 0.15, -H - floor * 2.2, w * 0.7, -H, GOLD, 0.85, 0.55);
    wash(gl, x, -H, w, -H + floor * 1.6, GOLD, 0.5, 0.75);
    data.beacons.push({ x: cx, y: -H - floor * 2.2 - b.sz });
    data.streaks.push({ x: cx, w: w * 0.5, rgb: GOLD, a: 0.35, reach: 0.5 });
}

// Tháp mặt kính đèn LED theo tầng (mỗi khung tô màu, có dải sáng chạy dọc)
function led(g, gl, b) {
    const { cx, w, H, floor, k, rnd, data } = b;
    const x = cx - w / 2;
    body(g, x, -H, w, '#0a1018');
    g.fillStyle = '#0a0f17';
    g.fillRect(x + w * 0.25, -H - floor * 1.2, w * 0.5, floor * 1.2);
    windows(gl, rnd, x, -H + floor, w, 0, floor, { lit: 0.25, colors: COOL, alpha: [0.25, 0.55] });
    data.leds.push(maskLayer(x, -H, w, H, k, (m, mw, mh) => {
        for (let y = floor * 0.5, i = 0; y < mh - floor * 0.5; y += floor, i++) {
            const grad = m.createLinearGradient(0, 0, mw, 0);
            const a = 0.55 + 0.35 * Math.sin(i * 0.7);
            grad.addColorStop(0, `rgba(255, 255, 255, ${a * 0.3})`);
            grad.addColorStop(0.5, `rgba(255, 255, 255, ${a})`);
            grad.addColorStop(1, `rgba(255, 255, 255, ${a * 0.3})`);
            m.fillStyle = grad;
            m.fillRect(0, y, mw, Math.max(0.5, floor * 0.22));
        }
    }));
    data.beacons.push({ x: cx, y: -H - floor * 1.2 - b.sz });
    data.streaks.push({ x: cx, w: w * 0.6, led: data.leds.length - 1, a: 0.35, reach: 0.55 });
}

// Tháp búp sen: thân phình nhẹ rồi thuôn nhọn lệch về một bên, sân đỗ trực thăng nhô ra (đèn viền chạy vòng), đỉnh sáng
function lotus(g, gl, b) {
    const { cx, w, H, floor, sz, rnd, data } = b;
    const L = cx - w / 2;
    const R = cx + w / 2;
    const path = c => {
        c.beginPath();
        c.moveTo(L, 0);
        c.quadraticCurveTo(L - w * 0.08, -H * 0.5, L + w * 0.14, -H * 0.86);
        c.lineTo(cx + w * 0.16, -H);
        c.lineTo(R - w * 0.04, -H * 0.8);
        c.quadraticCurveTo(R + w * 0.07, -H * 0.45, R, 0);
        c.closePath();
    };
    g.fillStyle = '#0d1424';
    path(g);
    g.fill();
    gl.save();
    path(gl);
    gl.clip();
    windows(gl, rnd, L - w * 0.1, -H, w * 1.2, 0, floor, { lit: 0.42, colors: COOL, alpha: [0.3, 0.8] });
    // Gân kính đứng mờ, đỉnh tháp sáng trắng
    gl.fillStyle = 'rgba(190, 210, 255, 0.08)';
    for (let i = 1; i < 6; i++) gl.fillRect(L + w * i / 6, -H, 0.5 * sz, H);
    wash(gl, L - w * 0.1, -H, w * 1.2, -H * 0.7, '225, 235, 255', 0.15, 0.6);
    gl.restore();
    // Sân đỗ trực thăng nhô ra một bên
    const hy = -H * 0.74;
    const hx = L + w * 0.08;
    const rx = w * 0.62;
    const ry = Math.max(1.4, w * 0.09);
    g.fillStyle = '#151b2a';
    g.beginPath();
    g.ellipse(hx, hy, rx, ry, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(160, 175, 210, 0.25)';
    g.fillRect(hx - rx, hy - ry * 0.2, rx * 2, 0.5 * sz);
    data.helipad = [];
    for (let a = 0.1; a < Math.PI - 0.05; a += Math.PI / 12) data.helipad.push({ x: hx + Math.cos(a) * rx, y: hy + Math.sin(a) * ry });
    data.beacons.push({ x: cx + w * 0.16, y: -H - b.sz });
    data.streaks.push({ x: cx, w: w * 0.45, rgb: '225, 235, 255', a: 0.3, reach: 0.6 });
}

// Tháp cao nhất: mặt kính đổi màu chầm chậm, đỉnh ba bậc rực vàng, chóp nhọn
function spire(g, gl, b) {
    const { cx, w, H, floor, sz, k, rnd, data } = b;
    const x = cx - w / 2;
    const bodyTop = -H * 0.8;
    body(g, x, bodyTop, w, '#100f22');
    const steps = [[0.8, 0.86, 0.06], [0.56, 0.91, 0.05], [0.3, 0.95, 0.04]];
    g.fillStyle = '#16142a';
    steps.forEach(([sw, top, sh]) => g.fillRect(cx - w * sw / 2, -H * top, w * sw, H * sh));
    g.fillStyle = '#20203a';
    g.fillRect(cx - 0.6 * sz, -H, 1.2 * sz, H * 0.05);
    // Mặt kính: đèn hắt từ chân lên, gân đứng; màu tô mỗi khung
    data.facades.push(maskLayer(x, bodyTop, w, -bodyTop, k, (m, mw, mh) => {
        const grad = m.createLinearGradient(0, mh, 0, 0);
        grad.addColorStop(0, 'rgba(255, 255, 255, 0.55)');
        grad.addColorStop(1, 'rgba(255, 255, 255, 0.16)');
        m.fillStyle = grad;
        m.fillRect(0, 0, mw, mh);
        m.fillStyle = 'rgba(255, 255, 255, 0.25)';
        for (let i = 1; i < 8; i++) m.fillRect(mw * i / 8, 0, 0.4 * sz, mh);
    }));
    windows(gl, rnd, x, bodyTop + floor * 0.5, w, 0, floor, { lit: 0.4, colors: ['255, 236, 255', '255, 220, 245'], alpha: [0.15, 0.5] });
    steps.forEach(([sw, top, sh]) => wash(gl, cx - w * sw / 2, -H * top, w * sw, -H * (top - sh), GOLD, 0.85, 0.6));
    radialGlow(gl, cx, -H * 0.9, w * 0.9, '255, 200, 90', 0.18);
    radialGlow(gl, cx, -H, 2.2 * sz, '255, 255, 255', 0.9);
    data.beacons.push({ x: cx, y: -H - 1 * sz });
    data.streaks.push({ x: cx, w: w * 0.75, spire: true, a: 0.38, reach: 0.65 }, { x: cx, w: w * 0.28, rgb: GOLD, a: 0.3, reach: 0.75 });
}

// Biển quảng cáo LED trên mặt tiền phía trên (vẽ mỗi khung: hình chạy, đổi màu)
function billboard(b) {
    const { cx, w, H, floor, data } = b;
    const bw = w * 0.7;
    const bh = Math.max(floor * 3, bw * 0.45);
    data.boards.push({ x: cx - bw / 2, y: -H + floor * 2, w: bw, h: bh, seed: data.boards.length * 2.3 + 0.7 });
    data.streaks.push({ x: cx, w: bw * 0.6, board: data.boards.length - 1, a: 0.3, reach: 0.45 });
}

// Dãy nhà thấp kiểu Pháp ven sông: tường sáng vàng ấm, cửa vòm sáng đèn; hàng cây giăng đèn nhiều màu; cột đèn
function riverfront(g, gl, rnd, cssW, up, ws, sz, data) {
    // Mặt đường ven sông ở chân dãy nhà (đèn hắt mặt tiền, ô cửa dừng ở mép đường)
    const road = 3.4 * sz;
    for (let x = -rnd() * 20; x < cssW + 10;) {
        const w = (60 + rnd() * 80) * ws;
        const h = (0.045 + rnd() * 0.04) * up;
        g.fillStyle = '#2b2218';
        g.fillRect(x, -h, w, h);
        g.fillStyle = '#1a140f';
        g.fillRect(x - 1 * sz, -h - 1.2 * sz, w + 2 * sz, 1.4 * sz);
        // Có nhà có mái vòm, tháp nhỏ
        if (rnd() < 0.3) {
            g.beginPath();
            g.ellipse(x + w / 2, -h - 1.2 * sz, w * 0.12, w * 0.12, 0, Math.PI, Math.PI * 2);
            g.fill();
        }
        const facade = h - road;
        wash(gl, x, -h, w, -road, '255, 196, 105', 0.36 + rnd() * 0.12, 0.1);
        const cols = Math.max(2, Math.round(w / (7 * sz)));
        const rows = Math.max(1, Math.round(facade / (7 * sz)));
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (rnd() < 0.25) continue;
                const wx = x + (c + 0.5) * w / cols;
                const wy = -h + (r + 0.35) * facade / rows;
                const ww = Math.min(2.4 * sz, w / cols * 0.45);
                gl.fillStyle = `rgba(255, 222, 160, ${0.35 + rnd() * 0.4})`;
                gl.fillRect(wx - ww / 2, wy, ww, facade / rows * 0.45);
                gl.beginPath();
                gl.arc(wx, wy, ww / 2, Math.PI, Math.PI * 2);
                gl.fill();
            }
        }
        data.streaks.push({ x: x + w / 2, w: w * 0.5, rgb: '255, 200, 120', a: 0.2, reach: 0.3 });
        x += w + (rnd() < 0.3 ? (4 + rnd() * 14) * ws : 0);
    }
    // Đường ven sông: mặt đường nhựa, vạch kẻ đứt quãng, vỉa hè hắt ánh đèn
    g.fillStyle = '#121419';
    g.fillRect(0, -road, cssW, road);
    g.fillStyle = 'rgba(200, 170, 120, 0.3)';
    g.fillRect(0, -0.6 * sz, cssW, 0.6 * sz);
    g.fillStyle = 'rgba(225, 225, 205, 0.28)';
    for (let x = 0; x < cssW; x += 6 * sz) g.fillRect(x, -1.8 * sz, 3 * sz, 0.25 * sz);
    // Hàng cây ven sông giăng đèn: phần lớn đèn vàng ấm, có cây đèn hồng, tím, lam như công viên bến Bạch Đằng
    const FAIRY = ['255, 236, 190', '255, 236, 190', '255, 110, 190', '170, 120, 255', '110, 200, 255', '255, 214, 90'];
    for (let x = rnd() * 30 * ws; x < cssW; x += (22 + rnd() * 26) * ws) {
        const r = (5 + rnd() * 4) * sz;
        const cy = -r * 0.9;
        g.fillStyle = '#0b120c';
        g.beginPath();
        g.ellipse(x, cy, r * 1.15, r, 0, 0, Math.PI * 2);
        g.fill();
        g.fillRect(x - 0.5 * sz, cy, 1 * sz, -cy);
        const fairy = FAIRY[(rnd() * FAIRY.length) | 0];
        for (let i = 0; i < 34; i++) {
            const a = rnd() * Math.PI * 2;
            const d = Math.sqrt(rnd());
            gl.fillStyle = `rgba(${fairy}, ${0.45 + rnd() * 0.55})`;
            gl.fillRect(x + Math.cos(a) * d * r * 1.1, cy + Math.sin(a) * d * r * 0.95, 0.7 * sz, 0.7 * sz);
        }
        radialGlow(gl, x, cy, r * 2, fairy, 0.16);
    }
    for (let x = 40 * ws; x < cssW; x += 110 * ws) drawLampPost(g, gl, x, 0, 12 * sz, sz * 0.6);
}

// Đường ven sông: làn gần đèn pha trắng ấm chạy một chiều, làn xa đèn hậu đỏ chạy chiều kia; ô tô hai đèn, xe máy một đèn
function traffic(rnd, cssW, sz) {
    const lanes = [{ y: -1.1 * sz, dir: 1, rgb: '255, 238, 205' }, { y: -2.5 * sz, dir: -1, rgb: '255, 55, 40' }];
    const cars = [];
    lanes.forEach(lane => {
        const n = Math.round(cssW / 22);
        for (let i = 0; i < n; i++) {
            const car = rnd() < 0.35;
            cars.push({ lane, car, x0: rnd() * (cssW + 40), speed: car ? 0.035 + rnd() * 0.025 : 0.022 + rnd() * 0.02 });
        }
    });
    return cars;
}

export const CITY_SKYLINE = {
    // Nhà cao tầng cao tới gần 2/3 bầu trời: lớp vẽ sẵn cao hơn các kiểu bờ khác
    up: ground => ground * CITY_HEIGHT,

    build(g, gl, { cssW, sz, rnd, ground, k }) {
        const up = ground * CITY_HEIGHT;
        // Bề rộng nhà theo bề ngang khung (điện thoại hẹp thì nhà thon lại), tầng nhà theo cỡ
        const ws = Math.max(0.42, Math.min(1.2, cssW / 1280));
        const floor = Math.max(2.2, 3.4 * Math.sqrt(ws) * sz);
        const data = { leds: [], facades: [], boards: [], beacons: [], streaks: [], helipad: [], cssW };

        // Quầng sáng thành phố hắt lên trời: vẽ ở lớp đặc trước nhà nên chỉ thấy ở khoảng trời giữa các tòa nhà
        const sky = g.createLinearGradient(0, 0, 0, -up);
        sky.addColorStop(0, 'rgba(120, 62, 58, 0.42)');
        sky.addColorStop(0.3, 'rgba(70, 38, 72, 0.2)');
        sky.addColorStop(1, 'rgba(40, 30, 70, 0)');
        g.fillStyle = sky;
        g.fillRect(0, -up, cssW, up);

        // Dãy nhà xa mờ trong sương đêm
        for (let x = -10; x < cssW + 10;) {
            const w = (16 + rnd() * 34) * ws;
            const h = (0.07 + rnd() * 0.2) * up;
            body(g, x, -h, w, '#080b16');
            windows(gl, rnd, x, -h + floor * 0.5, w, 0, floor, { lit: 0.3, colors: rnd() < 0.5 ? WARM : COOL, alpha: [0.12, 0.35] });
            x += w * (0.7 + rnd() * 0.5);
        }
        const haze = g.createLinearGradient(0, 0, 0, -up * 0.3);
        haze.addColorStop(0, 'rgba(50, 46, 80, 0.2)');
        haze.addColorStop(1, 'rgba(50, 46, 80, 0)');
        g.fillStyle = haze;
        g.fillRect(0, -up * 0.3, cssW, up * 0.3);

        const draw = { lotus, spire, crown, led, grid, block };
        TOWERS.forEach(t => {
            const b = { cx: t.x * cssW, w: t.w * ws, H: t.h * up, floor, sz, k, rnd, data, t };
            draw[t.kind](g, gl, b);
            if (t.board) billboard(b);
        });

        riverfront(g, gl, rnd, cssW, up, ws, sz, data);
        data.traffic = traffic(rnd, cssW, sz);
        return data;
    },

    lights(ctx, layer, { ground, clock, calm }) {
        const { leds, facades, boards, beacons, helipad, traffic: cars, cssW } = layer.data;
        const sz = layer.sz;
        // Mặt kính tháp cao nhất đổi màu chầm chậm
        facades.forEach(f => {
            const tmp = tintCanvas(f.canvas, `hsl(${spireHue(clock, calm) | 0}, 75%, 60%)`);
            ctx.globalAlpha = 0.85;
            ctx.drawImage(tmp, 0, 0, f.canvas.width, f.canvas.height, f.x, ground + f.y, f.w, f.h);
        });
        // Đèn LED theo tầng: cả mặt sáng mờ, một dải sáng rực chạy từ chân lên đỉnh
        leds.forEach((led, i) => {
            const tmp = tintCanvas(led.canvas, `hsl(${ledHue(clock, calm, i) | 0}, 85%, 55%)`);
            const cw = led.canvas.width;
            const ch = led.canvas.height;
            ctx.globalAlpha = 0.55;
            ctx.drawImage(tmp, 0, 0, cw, ch, led.x, ground + led.y, led.w, led.h);
            if (!calm) {
                const p = (clock * 0.00012 + i * 0.37) % 1;
                const band = 0.22;
                const from = Math.max(0, 1 - p - band);
                const to = Math.min(1, 1 - p + band * 0.2);
                if (to > from) {
                    ctx.globalAlpha = 0.9;
                    ctx.drawImage(tmp, 0, from * ch, cw, (to - from) * ch, led.x, ground + led.y + from * led.h, led.w, (to - from) * led.h);
                }
            }
        });
        // Biển quảng cáo LED: hai màu loang chạy ngang, sọc sáng quét qua, đổi cảnh vài giây một lần
        boards.forEach(bd => {
            const scene = Math.floor(clock / 4000 + bd.seed);
            const h1 = (scene * 67 + bd.seed * 100) % 360;
            const h2 = (h1 + 140) % 360;
            const shift = calm ? 0.5 : (clock * 0.0003 + bd.seed) % 1;
            const y = ground + bd.y;
            const grad = ctx.createLinearGradient(bd.x - bd.w * shift, 0, bd.x + bd.w * (2 - shift), 0);
            grad.addColorStop(0, `hsl(${h1 | 0}, 90%, 55%)`);
            grad.addColorStop(0.5, `hsl(${h2 | 0}, 90%, 60%)`);
            grad.addColorStop(1, `hsl(${h1 | 0}, 90%, 55%)`);
            ctx.globalAlpha = 0.8;
            ctx.fillStyle = grad;
            ctx.fillRect(bd.x, y, bd.w, bd.h);
            if (!calm) {
                const sweep = (clock * 0.0006 + bd.seed) % 1.4 - 0.2;
                ctx.globalAlpha = 0.35;
                ctx.fillStyle = '#fff';
                ctx.fillRect(bd.x + bd.w * Math.max(0, sweep), y, bd.w * Math.max(0, Math.min(0.12, 1 - sweep)), bd.h);
            }
            ctx.globalAlpha = 0.18;
            ctx.drawImage(glowSprite(hslRgb(h2, 0.9, 0.6)), bd.x - bd.w * 0.5, y - bd.h, bd.w * 2, bd.h * 3);
        });
        // Đèn viền sân đỗ trực thăng chạy vòng
        helipad.forEach((p, i) => {
            const on = calm ? 0.6 : 0.25 + 0.75 * Math.pow(Math.max(0, Math.sin(clock * 0.006 - i * 0.55)), 4);
            ctx.globalAlpha = on;
            ctx.drawImage(glowSprite('235, 242, 255'), p.x - 1.8 * sz, ground + p.y - 1.8 * sz, 3.6 * sz, 3.6 * sz);
        });
        // Đèn đỏ báo không trên nóc nhà cao tầng: mỗi tòa một nhịp chớp
        const r = 5 * sz;
        beacons.forEach((b, i) => {
            const on = calm ? 0.7 : Math.pow(Math.max(0, Math.sin(clock * 0.0035 + i * 1.7)), 6);
            if (on < 0.02) return;
            ctx.globalAlpha = on;
            ctx.drawImage(glowSprite('255, 60, 50'), b.x - r, ground + b.y - r, r * 2, r * 2);
        });
        // Xe chạy trên đường ven sông
        const span = cssW + 40;
        cars.forEach(c => {
            const x = ((c.x0 + c.lane.dir * c.speed * clock) % span + span) % span - 20;
            const y = ground + c.lane.y;
            const glow = glowSprite(c.lane.rgb);
            if (c.car) {
                const rr = 2.2 * sz;
                ctx.globalAlpha = 0.9;
                ctx.drawImage(glow, x - rr, y - rr, rr * 2, rr * 2);
                ctx.drawImage(glow, x + 1.3 * sz - rr, y - rr, rr * 2, rr * 2);
            } else {
                const rr = 1.5 * sz;
                ctx.globalAlpha = 0.75;
                ctx.drawImage(glow, x - rr, y - rr, rr * 2, rr * 2);
            }
        });
        ctx.globalAlpha = 1;
    }
};

// Vệt sáng in xuống sông của những đèn sáng nhất (mặt kính màu, đỉnh tháp, đèn LED, biển quảng cáo, dãy nhà ven sông):
// [{ x (điểm ảnh CSS), w, rgb, a, reach (phần độ sâu mặt nước) }], màu đổi theo đèn đang đổi màu
export function cityLightStreaks(data, clock, calm) {
    return data.streaks.map(s => {
        let rgb = s.rgb;
        if (s.spire) rgb = hslRgb(spireHue(clock, calm), 0.75, 0.6);
        else if (s.led !== undefined) rgb = hslRgb(ledHue(clock, calm, s.led), 0.85, 0.55);
        else if (s.board !== undefined) rgb = hslRgb((Math.floor(clock / 4000 + data.boards[s.board].seed) * 67 + data.boards[s.board].seed * 100 + 140) % 360, 0.9, 0.6);
        return { ...s, rgb };
    });
}
