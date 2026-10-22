/*!
 * Trình diễn Pháo hoa – trình phát: cảnh vật (chi tiết kiểu bờ)
 * Phần bổ sung và chỉnh sửa © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Chi tiết dùng chung khi dựng phần nhô lên của các kiểu bờ: mặt đá cầu, vành vòm, cột đèn, lan can, nhà
// phố cổ, đèn lồng.

import { bankNoise, radialGlow } from './util.js';
import { ashlar, bankLight } from './bank.js';

// Mặt đá xếp của cầu đá (vẽ từng điểm ảnh, cùng kiểu đá với kè: ashlar). Phủ kiểu source-atop: chỉ tô lên phần đã vẽ
// (thân cầu), giữ nguyên hình. x, w: đoạn phủ; top: độ cao đỉnh trên chân trời; drop: chân cầu dưới chân trời (tới mép
// nước), đoạn này đổ sáng như kè (rêu, ướt sẫm sát nước) để chân cầu liền với kè; phía trên chân trời sáng đều ánh trăng
export function stoneFacing(g, x, w, top, drop, k) {
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
export function archRing(g, cx, cy, R, ring, sz) {
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

// Hình dáng cầu vòm cong. ground: chân trời (điểm ảnh CSS); R: bán kính vòm, half: nửa chiều dài cầu
export function archGeometry(cssW, ground) {
    const R = Math.max(22, Math.min(56, ground * 0.085));
    return { cx: cssW / 2, R, half: Math.min(cssW * 0.32, R * 4.2) };
}

// Cột đèn cổ: đế, thân, mũ, khung kính sáng ấm; quầng sáng và vũng sáng dưới chân vẽ vào lớp sáng (gl)
export function drawLampPost(g, gl, x, base, h, sz, warm = '255, 214, 150') {
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
export function drawRailing(g, cssW, sz) {
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

// Nhà phố cổ: tường vàng ố, mái ngói âm dương có bờ nóc, nhà hai tầng có mái hiên và ban công gỗ, cửa gỗ, cửa sổ sáng
// đèn (quầng sáng vẽ vào lớp sáng gl)
export function drawShophouse(g, gl, x, w, wallH, two, sz, rnd) {
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

export const LANTERN_COLORS = ['225, 48, 42', '242, 177, 52', '238, 122, 46', '214, 60, 120', '120, 70, 200', '60, 160, 90'];

let lanternSpriteCache = { key: '', list: null };

// Đèn lồng (mỗi màu một ảnh): quầng sáng, thân bầu có nan, chóp và đáy vàng, tua rua
export function lanternSprites(sz, k) {
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
export function spanLights(span, sz, k) {
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
