/*!
 * Hanabi – trình phát: cảnh vật (người ngắm pháo: bờ bên này)
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Bờ bên này (chỗ người ngắm pháo đứng), dải dưới đáy khung, hợp với kiểu bờ bên kia: lối đi lát đá có bó vỉa sát mép
// nước (kè, phố cổ, cầu, thành phố), bãi cỏ mép bờ lởm chởm ngọn cỏ (bờ đất), bãi cát có bọt sóng liếm vào (bãi cát, biển
// khơi). Mùa đông phủ tuyết; trời mưa mặt đất ướt sẫm, loáng ánh pháo. Vẽ sẵn một lần theo cỡ khung, mỗi khung chỉ chép
// ảnh rồi phủ ánh pháo lên.

import { makeCanvas, seededRandom } from '../../utils.js';

// Góc nhìn hơi từ trên xuống: điểm xa hơn lên cao chừng này phần
export const TILT = 0.26;
// Mép nước cách chỗ người đứng (mét); bãi biển thì đứng lùi xa hơn cho sóng tràn lên cát không tới chân
const EDGE = 0.62;
const SEA_EDGE = 2.2;
// Chiều cao chàng trai (mét): theo đó tính cỡ trên màn hình
export const MAN_HEIGHT = 1.8;

export const groundKind = bank => (bank === '' ? 'grass' : bank === 'sand' || bank === 'none' ? 'sand' : 'stone');

// Dải bờ bên này theo khung (điểm ảnh CSS; level: chân trời, phần chiều cao khung): người cao chừng 1/5 màn hình, đầu
// (kể cả ô giơ cao) không vượt quá chân trời. ppm: điểm ảnh mỗi mét, top: mép nước (đỉnh dải bờ), gy: chỗ chân người.
// Người ngắm pháo đứng trên dải này; biển khơi (sea) thì có hay không có người cũng là bãi cát rộng cho sóng tràn lên
// (chỗ chân người vẫn thế, mép nước lùi xa hơn)
export function nearBank(cssW, cssH, level, sea = false) {
    const horizonY = level * cssH;
    const meters = sea ? SEA_EDGE : EDGE;
    let Hp = Math.min(cssH * 0.22, cssW * 0.55);
    for (let i = 0; i < 2; i++) {
        const ppm = Hp / MAN_HEIGHT;
        const band = (meters * TILT + 0.3) * ppm;
        const gy = cssH - band + meters * TILT * ppm;
        Hp = Math.min(Hp, (gy - horizonY - 4) / 1.3);
    }
    Hp = Math.max(40, Hp);
    const ppm = Hp / MAN_HEIGHT;
    const edge = meters * TILT * ppm;
    const band = edge + 0.3 * ppm;
    return { ppm, top: cssH - band, gy: cssH - band + edge };
}

let cache = { key: '', canvas: null };

const rgb = (c, k = 1, a = 1) => `rgba(${Math.max(0, Math.min(255, c[0] * k)) | 0}, ${Math.max(0, Math.min(255, c[1] * k)) | 0}, ${Math.max(0, Math.min(255, c[2] * k)) | 0}, ${a})`;

// W, H: cỡ dải (điểm ảnh thật), k: điểm ảnh thật mỗi điểm ảnh CSS
export function groundSprite(W, H, k, kind, season, wet) {
    const key = `${W}_${H}_${k.toFixed(3)}_${kind}_${season}_${wet}`;
    if (cache.key === key) return cache.canvas;
    const [c, g] = makeCanvas(W, H);
    const rnd = seededRandom(73);
    const h = H / k;
    const w = W / k;
    g.scale(k, k);
    const dark = wet ? 0.7 : 1;
    if (kind === 'stone') {
        // Lối đi lát đá: đá lát sẫm, hàng gạch to dần về phía người xem; bó vỉa đá hoa cương sát mép nước
        const base = g.createLinearGradient(0, 0, 0, h);
        base.addColorStop(0, rgb([46, 48, 54], dark));
        base.addColorStop(1, rgb([18, 19, 22], dark));
        g.fillStyle = base;
        g.fillRect(0, 0, w, h);
        const kerb = Math.max(2.2, h * 0.13);
        let y = kerb + 0.6;
        let row = 0;
        let rh = Math.max(2.4, h * 0.11);
        while (y < h) {
            const tile = rh * (2.4 + rnd() * 0.6);
            let x = -(row % 2) * tile * 0.5 - rnd() * tile;
            const t = y / h;
            while (x < w) {
                const shade = 0.85 + rnd() * 0.3;
                g.fillStyle = rgb([50 - 22 * t, 52 - 23 * t, 58 - 25 * t], shade * dark);
                g.fillRect(x + 0.35, y + 0.35, tile - 0.7, rh - 0.7);
                x += tile;
            }
            y += rh;
            rh *= 1.24;
            row++;
        }
        // Mép trên bó vỉa ướt ánh lên, mạch nối, bóng đổ ngay dưới bó vỉa
        g.fillStyle = rgb([72, 74, 82], dark);
        g.fillRect(0, 0, w, kerb);
        g.fillStyle = 'rgba(150, 160, 180, 0.55)';
        g.fillRect(0, 0, w, Math.max(0.6, kerb * 0.22));
        g.fillStyle = 'rgba(0, 0, 0, 0.45)';
        g.fillRect(0, kerb, w, 0.7);
        for (let x = rnd() * 40; x < w; x += 46 + rnd() * 30) g.fillRect(x, 0, 0.6, kerb);
    } else if (kind === 'grass') {
        // Bãi cỏ: nền cỏ sẫm, mép bờ lởm chởm ngọn cỏ nổi lên trên mặt nước
        const base = g.createLinearGradient(0, 0, 0, h);
        const top = season === 'autumn' ? [44, 40, 24] : [26, 36, 22];
        base.addColorStop(0, rgb(top, dark));
        base.addColorStop(1, rgb([8, 11, 8], dark));
        g.fillStyle = base;
        g.fillRect(0, 0, w, h);
        const lip = h * 0.18;
        g.lineCap = 'round';
        for (let x = 0; x < w; x += 0.7 + rnd() * 1.1) {
            const tall = rnd() < 0.08 ? 2.2 : 1;
            const bh = (2 + rnd() * 4.5) * tall;
            const lean = (rnd() - 0.4) * 2.4;
            g.strokeStyle = rgb(season === 'autumn' ? [70, 62, 34] : [34, 50, 30], (0.7 + rnd() * 0.6) * dark);
            g.lineWidth = 0.5 + rnd() * 0.5;
            g.beginPath();
            g.moveTo(x, lip + 1.5);
            g.quadraticCurveTo(x + lean * 0.3, lip - bh * 0.5, x + lean, lip - bh);
            g.stroke();
        }
        // Cỏ lăn tăn trên mặt bãi
        for (let i = 0; i < w * h * 0.06; i++) {
            const x = rnd() * w;
            const yy = lip + rnd() * (h - lip);
            g.strokeStyle = rgb([30, 42, 26], (0.6 + rnd() * 0.6) * dark * (1 - yy / h * 0.5));
            g.lineWidth = 0.5;
            g.beginPath();
            g.moveTo(x, yy);
            g.lineTo(x + (rnd() - 0.5) * 1.5, yy - 1 - rnd() * 2);
            g.stroke();
        }
        if (season === 'spring') {
            for (let i = 0; i < w * 0.12; i++) {
                g.fillStyle = ['rgba(230, 220, 240, 0.7)', 'rgba(240, 190, 210, 0.7)', 'rgba(240, 225, 140, 0.7)'][(rnd() * 3) | 0];
                g.fillRect(rnd() * w, lip + rnd() * (h - lip), 0.9, 0.9);
            }
        } else if (season === 'autumn') {
            for (let i = 0; i < w * 0.2; i++) {
                g.fillStyle = ['rgba(190, 96, 40, 0.75)', 'rgba(160, 60, 34, 0.7)', 'rgba(200, 150, 60, 0.7)'][(rnd() * 3) | 0];
                g.beginPath();
                g.ellipse(rnd() * w, lip + rnd() * (h - lip), 1.2, 0.6, rnd() * 3, 0, Math.PI * 2);
                g.fill();
            }
        }
    } else {
        // Bãi cát: cát mịn gợn sóng, sát nước là dải cát ướt sẫm
        const base = g.createLinearGradient(0, 0, 0, h);
        base.addColorStop(0, rgb([62, 58, 50], dark));
        base.addColorStop(0.3, rgb([76, 70, 58], dark));
        base.addColorStop(1, rgb([30, 27, 22], dark));
        g.fillStyle = base;
        g.fillRect(0, 0, w, h);
        g.fillStyle = 'rgba(20, 22, 30, 0.45)';
        g.fillRect(0, 0, w, h * 0.22);
        for (let i = 0; i < w * 0.5; i++) {
            const x = rnd() * w;
            const yy = h * 0.25 + rnd() * h * 0.75;
            g.strokeStyle = `rgba(0, 0, 0, ${0.08 + rnd() * 0.1})`;
            g.lineWidth = 0.6;
            g.beginPath();
            g.moveTo(x, yy);
            g.quadraticCurveTo(x + 3, yy - 0.8, x + 6 + rnd() * 6, yy);
            g.stroke();
        }
        for (let i = 0; i < w * 0.08; i++) {
            g.fillStyle = `rgba(200, 195, 180, ${0.2 + rnd() * 0.3})`;
            g.fillRect(rnd() * w, h * 0.3 + rnd() * h * 0.7, 0.8, 0.6);
        }
    }
    if (season === 'winter') {
        // Tuyết phủ: dày ở mặt bãi, mép bờ còn lộ chút
        for (let i = 0; i < w * h * 0.03; i++) {
            const x = rnd() * w;
            const yy = h * 0.12 + rnd() * h * 0.88;
            const r = 2 + rnd() * 6;
            const grad = g.createRadialGradient(x, yy, 0, x, yy, r);
            grad.addColorStop(0, `rgba(196, 204, 222, ${0.55 + rnd() * 0.3})`);
            grad.addColorStop(1, 'rgba(196, 204, 222, 0)');
            g.fillStyle = grad;
            g.fillRect(x - r, yy - r, r * 2, r * 2);
        }
        g.fillStyle = 'rgba(190, 200, 220, 0.35)';
        g.fillRect(0, h * 0.1, w, h * 0.9);
    }
    // Phía người xem tối dần
    const shade = g.createLinearGradient(0, 0, 0, h);
    shade.addColorStop(0, 'rgba(0, 0, 0, 0)');
    shade.addColorStop(1, 'rgba(0, 0, 0, 0.45)');
    g.fillStyle = shade;
    g.fillRect(0, 0, w, h);
    cache = { key, canvas: c };
    return c;
}

// Vẽ bờ bên này lên ctx (đang ở điểm ảnh thật): ảnh vẽ sẵn, ánh pháo rọi xuống (sáng hơn ở mép nước), mặt ướt loáng
// sáng; bãi cát có bọt sóng liếm vào rồi rút ra (foam: false thì không, biển khơi có sóng tràn lên riêng)
export function drawGround(ctx, { W, top, k, kind, season, wet, sky, time, calm, foam = true }) {
    const H = ctx.canvas.height;
    const y0 = Math.round(top * k);
    const h = H - y0;
    if (h <= 0) return;
    ctx.drawImage(groundSprite(W, h, k, kind, season, wet), 0, y0);
    const glow = (sky.r + sky.g + sky.b) / 3;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if (glow > 0.5) {
        const g = ctx.createLinearGradient(0, y0, 0, H);
        const m = (wet ? 1.3 : 0.75);
        g.addColorStop(0, rgb([sky.r, sky.g, sky.b], m * 1.3));
        g.addColorStop(0.35, rgb([sky.r, sky.g, sky.b], m * 0.55));
        g.addColorStop(1, rgb([sky.r, sky.g, sky.b], m * 0.15));
        ctx.fillStyle = g;
        ctx.fillRect(0, y0, W, h);
    }
    if (foam && kind === 'sand' && season !== 'winter') {
        // Bọt sóng: hai lớp lượn sóng trắng mờ, liếm vào rồi rút ra
        for (let i = 0; i < 2; i++) {
            const phase = calm ? 0.5 : 0.5 + 0.5 * Math.sin(time * 0.0009 + i * 2.1);
            const y = y0 + (0.5 + i * 2.2 + phase * 2.6) * k;
            ctx.globalAlpha = (0.16 + 0.22 * (1 - phase)) * (i ? 0.6 : 1);
            ctx.fillStyle = 'rgb(200, 212, 228)';
            ctx.beginPath();
            ctx.moveTo(0, y);
            for (let x = 0; x <= W; x += 12 * k) {
                ctx.lineTo(x, y + Math.sin(x / k * 0.05 + time * 0.0011 * (i ? -1 : 1) + i) * 1.1 * k);
            }
            ctx.lineTo(W, y + 1.4 * k);
            ctx.lineTo(0, y + 1.4 * k);
            ctx.closePath();
            ctx.fill();
        }
    }
    ctx.restore();
}
