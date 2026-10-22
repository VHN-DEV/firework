/*!
 * Trình diễn Pháo hoa – trình phát: cảnh vật (mặt trăng)
 * Phần bổ sung và chỉnh sửa © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Mặt trăng: bề mặt có biển, miệng hố, đúng pha.

import { moonIllumination } from '../moon.js';
import { fbm, makeNoise, smooth01, sprites } from './util.js';
import { makeCanvas, seededRandom } from '../utils.js';

// Mặt trăng thật: bề mặt dựng một lần từng điểm ảnh trên khối cầu (nhìn từ Trái Đất, bắc ở trên, đông bên phải).
// Biển tối đặt đúng chỗ như trăng thật theo kinh độ, vĩ độ: Đại dương Bão, Biển Mưa, Biển Trong Sáng, Biển Yên Tĩnh,
// Biển Nguy Hiểm, Biển Phong Phú, Biển Mật, Biển Mây, Biển Ẩm, Biển Lạnh... Cao nguyên sáng lấm tấm hố va chạm (nhỏ
// nhiều, lớn ít; hố sát mép đĩa bị nén dẹt theo mặt cầu); hố trẻ sáng (Tycho, Copernicus, Kepler, Aristarchus) có tia
// sáng tỏa ra, hố đáy tối (Plato, Grimaldi). Ghi độ phản xạ (albedo) và độ cao từng điểm để chiếu sáng theo pha.
// D: cạnh ảnh (điểm ảnh), vừa đủ nét với cỡ trăng trên màn hình; cần to hơn thì dựng lại.
let moonSurfaceCache = null;

function moonSurface(D) {
    if (moonSurfaceCache && moonSurfaceCache.D >= D) return moonSurfaceCache;
    const R = D / 2 - 1;
    const noise = makeNoise(4242);
    const deg = Math.PI / 180;
    // Điểm trên mặt trăng theo vĩ độ (bắc dương), kinh độ (đông dương) -> vectơ (x phải, y xuống, z về phía người xem)
    const at = (lat, lon) => [Math.cos(lat * deg) * Math.sin(lon * deg), -Math.sin(lat * deg), Math.cos(lat * deg) * Math.cos(lon * deg)];
    const albedo = new Float32Array(D * D);
    const height = new Float32Array(D * D);
    const mare = new Float32Array(D * D);
    const inside = new Uint8Array(D * D);
    const P = new Float32Array(D * D * 3);
    for (let py = 0; py < D; py++) {
        for (let px = 0; px < D; px++) {
            const u = (px + 0.5 - D / 2) / R;
            const v = (py + 0.5 - D / 2) / R;
            const q = u * u + v * v;
            if (q > 1.02) continue;
            const j = py * D + px;
            const z = Math.sqrt(Math.max(0, 1 - q));
            const n = Math.sqrt(u * u + v * v + z * z);
            P[j * 3] = u / n;
            P[j * 3 + 1] = v / n;
            P[j * 3 + 2] = z / n;
            inside[j] = 1;
        }
    }
    // Biển tối: [vĩ độ, kinh độ, bán kính góc (độ), độ đậm, độ sáng của nền biển]; Đại dương Bão, Biển Lạnh ghép từ
    // nhiều mảng. Biển Yên Tĩnh, Biển Nguy Hiểm sẫm hơn; Biển Trong Sáng, Biển Lạnh nhạt hơn
    const MARIA = [
        [33, -16, 19, 1, 0.5], [28, 17.5, 11.5, 1, 0.55], [8.5, 31, 14, 1, 0.42], [17, 59, 8, 1.15, 0.42], [-7.8, 51, 12, 0.9, 0.47],
        [-15, 35, 6, 0.95, 0.46], [-21, -16, 11, 0.85, 0.53], [-24.4, -38.6, 6.8, 0.95, 0.48], [13.3, 3.6, 4.5, 0.8, 0.5], [2, 1, 3.6, 0.7, 0.52],
        [28, -50, 15, 0.95, 0.48], [10, -55, 14, 0.95, 0.47], [-3, -45, 12, 0.85, 0.5], [40, -45, 10, 0.85, 0.5], [-10, -30, 8, 0.75, 0.52],
        [56, -25, 6, 0.75, 0.57], [57, -5, 6, 0.75, 0.57], [56, 15, 5.5, 0.7, 0.57], [55, 35, 4.5, 0.65, 0.57], [-5, 18, 6, 0.6, 0.52],
        [44, 26, 6, 0.7, 0.53], [20, 30, 5, 0.6, 0.48]
    ].map(([lat, lon, r, k, tone]) => ({ c: at(lat, lon), r: r * deg * 1.12, k, tone, reach: Math.cos(Math.min(Math.PI, r * deg * 2.5)) }));
    for (let j = 0; j < D * D; j++) {
        if (!inside[j]) continue;
        const x = P[j * 3];
        const y = P[j * 3 + 1];
        const z = P[j * 3 + 2];
        const lat = -Math.asin(Math.max(-1, Math.min(1, y)));
        const lon = Math.atan2(x, z);
        // Các mảng biển hòa vào nhau thành vùng liền (không thành chấm tròn rời), bờ biển lượn khúc theo nhiễu
        let dens = 0;
        let toneSum = 0;
        MARIA.forEach(({ c, r, k, tone, reach }) => {
            const dot = x * c[0] + y * c[1] + z * c[2];
            if (dot < reach) return;
            const d = Math.acos(Math.max(-1, Math.min(1, dot)));
            const w = k * Math.exp(-((d / r) ** 2) * 1.4);
            dens += w;
            toneSum += w * tone;
        });
        const tone = dens > 0 ? toneSum / dens : 0.5;
        const coast = (fbm(noise, lon * 3 + 10, lat * 3 + 3, 4) - 0.5) * 0.55;
        const m = smooth01(0.3, 0.6, dens + coast);
        const hi = fbm(noise, lon * 9 + 40, lat * 9 + 7, 3);
        const fine = noise(lon * 40 + 5, lat * 40 + 9);
        const highland = 0.8 + (hi - 0.5) * 0.18 + (fine - 0.5) * 0.06;
        const sea = m > 0.01 ? tone + (fbm(noise, lon * 7 + 70, lat * 7 + 20, 3) - 0.5) * 0.16 + (fine - 0.5) * 0.03 : 0;
        albedo[j] = highland + (sea - highland) * m;
        mare[j] = m;
        // Mặt đất gồ ghề nhẹ: cao nguyên lởm chởm hơn biển (biển là dung nham phẳng)
        height[j] = (hi - 0.5) * 0.012 * (1 - 0.7 * m) + (fine - 0.5) * 0.002;
    }
    // Hố va chạm: rải từng hố lên các điểm quanh nó (nhanh hơn dò mọi hố cho từng điểm)
    const rnd = seededRandom(913);
    const craters = [
        // [vĩ độ, kinh độ, bán kính (độ), độ sáng đáy hố (cộng thêm), tia sáng dài (độ, 0 = không)]
        [-43.3, -11.2, 1.5, 0.3, 55], [9.6, -20.1, 1.6, 0.2, 22], [8.1, -38, 0.6, 0.3, 14], [23.7, -47.4, 0.7, 0.55, 10],
        [51.6, -9.4, 1.7, -0.25, 0], [-5.2, -68.6, 2.8, -0.25, 0], [-8.9, 61, 2.2, 0.08, 0], [-11.4, 26.4, 1.7, 0.08, 0],
        [-58.4, -14.4, 3.7, 0, 0], [-9.3, -1.9, 2.5, -0.05, 0], [-25.1, 60.4, 2.9, 0.05, 0], [-20, 9, 1.3, 0, 0],
        [-12, -4, 1.6, 0, 0], [-31, 1, 1.9, 0, 0], [-49, 29, 1.6, 0, 0], [-64, 30, 2, 0, 0], [70, 5, 1.5, 0, 0], [-28, -48, 1, 0.15, 12]
    ].map(([lat, lon, r, b, ray]) => ({ c: at(lat, lon), r: r * deg, b, ray: ray * deg }));
    for (let i = 0; i < 230; i++) {
        // Bán kính theo luật lũy thừa: hố nhỏ rất nhiều, hố lớn hiếm
        const r = (0.25 + 2.6 * Math.pow(rnd(), 3.2)) * deg;
        const lat = Math.asin(rnd() * 2 - 1) / deg;
        const lon = (rnd() * 2 - 1) * 95;
        craters.push({ c: at(lat, lon), r, b: rnd() < 0.12 ? 0.12 : 0, ray: 0, random: true });
    }
    craters.forEach(({ c, r, b, ray, random }) => {
        if (c[2] < -0.05) return;
        const reach = Math.max(r * 1.8, ray);
        const span = Math.ceil(Math.sin(Math.min(Math.PI / 2, reach)) * R) + 2;
        const cx = Math.round(c[0] * R + D / 2);
        const cy = Math.round(c[1] * R + D / 2);
        // Tia sáng: những vệt hẹp tỏa ra quanh hố, dài ngắn khác nhau
        const rays = ray ? Array.from({ length: 16 }, () => ({ a: rnd() * Math.PI * 2, w: 0.05 + rnd() * 0.12, len: ray * (0.35 + rnd() * 0.65) })) : null;
        const east = [c[2], 0, -c[0]];
        const el = Math.hypot(east[0], east[2]) || 1;
        east[0] /= el;
        east[2] /= el;
        const side = [c[1] * east[2], c[2] * east[0] - c[0] * east[2], -c[1] * east[0]];
        for (let py = Math.max(0, cy - span); py < Math.min(D, cy + span); py++) {
            for (let px = Math.max(0, cx - span); px < Math.min(D, cx + span); px++) {
                const j = py * D + px;
                if (!inside[j]) continue;
                const x = P[j * 3];
                const y = P[j * 3 + 1];
                const z = P[j * 3 + 2];
                const d = Math.acos(Math.max(-1, Math.min(1, x * c[0] + y * c[1] + z * c[2])));
                if (d > reach) continue;
                const t = d / r;
                // Biển ít hố (hố ngẫu nhiên phần lớn đã bị dung nham lấp); sát mép đĩa hố nén dẹt, gần như không thấy
                const keep = (random ? 1 - 0.75 * mare[j] : 1) * smooth01(0.06, 0.32, z);
                if (t < 1.8) {
                    const depth = r * 0.22 * keep;
                    const bowl = t < 1 ? (t * t - 1) * 0.9 : 0;
                    const rim = 0.32 * Math.exp(-(((t - 1) / 0.2) ** 2));
                    const ejecta = t > 1 ? 0.08 * Math.exp(-(t - 1) / 0.35) : 0;
                    height[j] += depth * (bowl + rim + ejecta);
                    if (b && t < 1.15) albedo[j] += b * (1 - smooth01(0.8, 1.15, t));
                    if (b > 0 && t >= 1 && t < 1.8) albedo[j] += b * 0.35 * (1 - smooth01(1, 1.8, t));
                }
                if (rays && d > r * 1.2) {
                    const dx = x * east[0] + z * east[2];
                    const dy = x * side[0] + y * side[1] + z * side[2];
                    const a = Math.atan2(dy, dx);
                    let s = 0;
                    rays.forEach((rayItem, k) => {
                        let da = Math.abs(a - rayItem.a);
                        if (da > Math.PI) da = Math.PI * 2 - da;
                        if (d < rayItem.len) {
                            const streak = 0.45 + 0.55 * noise(d * 40 + k * 7, k * 3.3);
                            s = Math.max(s, Math.exp(-((da / rayItem.w) ** 2)) * (1 - d / rayItem.len) * streak);
                        }
                    });
                    albedo[j] += 0.13 * s;
                }
            }
        }
    });
    moonSurfaceCache = { D, R, albedo, height, mare, inside, P };
    return moonSurfaceCache;
}

// Đĩa trăng theo pha: phần sáng gần như đều tới tận mép (bụi trăng phản xạ ngược về phía Mặt Trời, không tối dần như quả
// bóng), sát đường ranh sáng tối thì Mặt Trời xiên thấp nên gờ hố, đồi núi đổ bóng dài, nổi khối rõ; phần tối có ánh
// đất mờ xanh xám (Trái Đất rọi sáng, rõ nhất lúc trăng lưỡi liềm). warm 0..1: trăng sát chân trời ngả vàng cam.
function moonDisc(fraction, warm, size) {
    const key = `lunar${fraction.toFixed(3)}_${warm.toFixed(2)}_${size}`;
    if (sprites[key]) return sprites[key];
    Object.keys(sprites).filter(name => name.startsWith('lunar')).forEach(name => delete sprites[name]);
    const { D, R, albedo, height, mare, inside, P } = moonSurface(size);
    const theta = fraction * Math.PI * 2;
    const L = [Math.sin(theta), 0, -Math.cos(theta)];
    const dir = L[0] >= 0 ? 1 : -1;
    // Bóng đổ chỉ có khi nắng chiếu xiên ngang mặt đĩa (trăng tròn nắng rọi thẳng thì không có bóng)
    const oblique = smooth01(0.3, 0.6, Math.abs(L[0]));
    const ash = 0.06 * Math.pow(1 - moonIllumination(fraction), 2.5);
    const tint = [1, 1 - 0.2 * warm, 1 - 0.42 * warm];
    const c = document.createElement('canvas');
    c.width = c.height = D;
    const img = c.getContext('2d').createImageData(D, D);
    const out = img.data;
    const px2r = 2 / D;
    for (let py = 0; py < D; py++) {
        for (let px = 0; px < D; px++) {
            const j = py * D + px;
            if (!inside[j]) continue;
            const x = P[j * 3];
            const y = P[j * 3 + 1];
            const z = P[j * 3 + 2];
            // Pháp tuyến nghiêng theo độ cao (gờ hố, đồi núi): bớt đi phần dốc nằm trên mặt tiếp xúc của khối cầu
            const hx = (height[j + (px < D - 1 && inside[j + 1] ? 1 : 0)] - height[j - (px > 0 && inside[j - 1] ? 1 : 0)]) / (2 * px2r);
            const hy = (height[j + (py < D - 1 && inside[j + D] ? D : 0)] - height[j - (py > 0 && inside[j - D] ? D : 0)]) / (2 * px2r);
            const along = hx * x + hy * y;
            let nx = x - (hx - along * x);
            let ny = y - (hy - along * y);
            let nz = z + along * z;
            const nl = Math.hypot(nx, ny, nz);
            nx /= nl;
            ny /= nl;
            nz /= nl;
            const geo = x * L[0] + y * L[1] + z * L[2];
            const mu0 = nx * L[0] + ny * L[1] + nz * L[2];
            // Bóng đổ khi Mặt Trời xiên thấp: dò về phía Mặt Trời xem có gờ nào cao hơn tia sáng không
            let shadow = 1;
            if (oblique > 0 && geo > -0.02 && geo < 0.4) {
                const tanE = Math.max(0.01, geo) / Math.sqrt(Math.max(0.0001, 1 - geo * geo));
                for (let s = 1; s < 26; s++) {
                    const sx = px + dir * s;
                    if (sx < 0 || sx >= D || !inside[py * D + sx]) break;
                    if (height[py * D + sx] - height[j] > s * px2r * tanE) {
                        shadow = 1 - 0.92 * oblique;
                        break;
                    }
                }
            }
            // Lommel-Seeliger: trăng tròn thì gần như phẳng sáng đều, hố chỉ nổi khi nắng xiên
            const lommel = mu0 > 0 ? (2 * mu0) / (mu0 + Math.max(0.05, nz)) : 0;
            let lit = 1.22 * albedo[j] * (0.74 * Math.min(1.5, lommel) + 0.26 * Math.max(0, mu0)) * shadow * smooth01(-0.035, 0.05, geo);
            lit = Math.max(0, lit);
            // Ánh đất trên phần tối
            const earth = ash * albedo[j] * (1 - smooth01(-0.05, 0.1, geo));
            const m = mare[j];
            const base = [255 - 20 * m, 250 - 14 * m, 238 - 4 * m];
            const r = base[0] * lit * tint[0] + 180 * earth;
            const g = base[1] * lit * tint[1] + 194 * earth;
            const b = base[2] * lit * tint[2] + 220 * earth;
            // Mép đĩa mịn (khử răng cưa); chỗ tối gần trong suốt để nền trời (đã sáng nhờ tán xạ) lộ qua
            const u = (px + 0.5 - D / 2) / R;
            const v = (py + 0.5 - D / 2) / R;
            const cover = 1 - smooth01(1 - 1.2 / R, 1 + 1.2 / R, Math.sqrt(u * u + v * v));
            const a = Math.min(1, lit * 4 + earth * 3) * cover;
            if (a <= 0) continue;
            const i = j * 4;
            out[i] = Math.min(255, r / Math.max(a, 0.001) * cover);
            out[i + 1] = Math.min(255, g / Math.max(a, 0.001) * cover);
            out[i + 2] = Math.min(255, b / Math.max(a, 0.001) * cover);
            out[i + 3] = 255 * a;
        }
    }
    c.getContext('2d').putImageData(img, 0, 0);
    c.R = R;
    sprites[key] = c;
    return c;
}

// Trăng kèm quầng sáng: lớp sát đĩa sáng đậm (tán xạ trong không khí), lớp ngoài loang rộng, mờ dần; đậm theo phần
// trăng được chiếu sáng; trăng thấp thì quầng cũng ngả vàng
export function moonSprite(fraction, radius, scale, warm = 0) {
    const key = `moon${fraction.toFixed(3)}_${radius.toFixed(1)}_${scale}_${warm.toFixed(2)}`;
    if (sprites[key]) return sprites[key];
    Object.keys(sprites).filter(name => name.startsWith('moon')).forEach(name => delete sprites[name]);
    const r = radius * scale;
    const size = Math.ceil(r * 8);
    const [c, g] = makeCanvas(size, size);
    const lit = moonIllumination(fraction);
    const tone = `255, ${Math.round(246 - 40 * warm)}, ${Math.round(226 - 90 * warm)}`;
    g.translate(size / 2, size / 2);
    // Quầng tỏa từ phần đang sáng (trăng khuyết thì lệch về phía có nắng, không tỏa quanh phần tối)
    const side = (fraction < 0.5 ? 1 : -1) * (1 - lit) * r * 0.6;
    const outer = g.createRadialGradient(side, 0, r * 0.95 * (0.4 + 0.6 * lit), side, 0, r * 4);
    outer.addColorStop(0, `rgba(${tone}, ${0.16 * lit})`);
    outer.addColorStop(0.25, `rgba(${tone}, ${0.06 * lit})`);
    outer.addColorStop(0.6, `rgba(${tone}, ${0.018 * lit})`);
    outer.addColorStop(1, `rgba(${tone}, 0)`);
    g.fillStyle = outer;
    g.fillRect(-size / 2, -size / 2, size, size);
    const inner = g.createRadialGradient(side, 0, r * 0.98 * (0.4 + 0.6 * lit), side, 0, r * (1 + 0.6 * lit));
    inner.addColorStop(0, `rgba(${tone}, ${0.3 * lit})`);
    inner.addColorStop(0.4, `rgba(${tone}, ${0.08 * lit})`);
    inner.addColorStop(1, `rgba(${tone}, 0)`);
    g.fillStyle = inner;
    g.fillRect(-size / 2, -size / 2, size, size);
    // Đĩa trăng dựng sẵn hơi to hơn cỡ cần, thu nhỏ dần từng nửa cho mịn (không lấm tấm răng cưa)
    let disc = moonDisc(fraction, warm, Math.min(256, Math.max(96, Math.ceil((r * 2.3) / 32) * 32)));
    let discR = disc.R;
    while (discR / 2 >= r * 1.05) {
        const [half, hg] = makeCanvas(Math.ceil(disc.width / 2), Math.ceil(disc.width / 2));
        hg.imageSmoothingQuality = 'high';
        hg.drawImage(disc, 0, 0, half.width, half.height);
        discR = discR * half.width / disc.width;
        disc = half;
    }
    const k = r / discR;
    g.imageSmoothingQuality = 'high';
    g.drawImage(disc, -disc.width * k / 2, -disc.height * k / 2, disc.width * k, disc.height * k);
    sprites[key] = c;
    return c;
}
