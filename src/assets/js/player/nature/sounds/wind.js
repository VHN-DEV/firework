/*!
 * Trình diễn Pháo hoa – trình phát: âm thanh thiên nhiên (gió, lá cây)
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Gió lùa qua cây theo loại cây trên bờ và mùa: tán lá xào xạc, liễu rì rào, lau sậy sột soạt, tàu dừa lật phật; mùa
// thu lá khô giòn, mùa đông cành trơ chỉ còn gió hun hút. Gió thổi từng cơn (đường biến thiên chậm), lá kêu theo cơn:
// tiếng "sss" của cả tán và hàng trăm hạt tiếng nhỏ của từng chiếc lá chạm nhau.

import { mixIn, renderLoop } from '../dsp.js';

// veg: 'leafy' cây tán lá, 'willow' liễu, 'reeds' lau sậy, cỏ, 'palm' dừa, 'none' không cây (chỉ có gió).
// center: dải tần tiếng cả tán; grains: số hạt tiếng mỗi giây lúc gió mạnh nhất; grain: độ dài hạt (giây);
// rustle/clatter: độ to tiếng tán, tiếng hạt
const VEG = {
    leafy: { center: 2600, q: 0.7, grains: 220, grain: [0.002, 0.006], rustle: 1, clatter: 0.45 },
    willow: { center: 1800, q: 0.6, grains: 110, grain: [0.002, 0.005], rustle: 0.8, clatter: 0.3, slow: 0.7 },
    reeds: { center: 4200, q: 0.6, grains: 320, grain: [0.001, 0.003], rustle: 0.8, clatter: 0.35 },
    palm: { center: 2200, q: 1.4, grains: 90, grain: [0.008, 0.025], rustle: 0.7, clatter: 0.6, band: 1800 },
    none: { center: 1200, q: 0.5, grains: 0, grain: [0.002, 0.004], rustle: 0.3, clatter: 0 }
};

export const WIND_SOUNDS = {
    leaves: {
        loop: [11.3, 15.7],
        render(s, { veg = 'leafy', season = 'summer' } = {}, { seconds }) {
            const v = VEG[veg] || VEG.leafy;
            const winter = season === 'winter';
            const autumn = season === 'autumn';
            return renderLoop(s, seconds, buf => {
                const n = buf.length;
                // Cơn gió: phần lớn thời gian nhẹ, thỉnh thoảng giật mạnh
                const gustAt = s.drift(0.18 * (v.slow || 1));
                const flutterAt = s.drift(0.9);
                const gust = new Float32Array(n);
                for (let i = 0; i < n; i++) gust[i] = (0.12 + 0.88 * Math.pow(gustAt(), 1.6)) * (0.8 + 0.2 * flutterAt());

                // Thân gió: ồn nâu lọc thấp, mở rộng dần theo cơn
                const body = new Float32Array(n);
                const low = s.filter('lowpass', 200, 0.6);
                for (let i = 0; i < n; i++) {
                    if (i % 64 === 0) low.set(160 + 260 * gust[i], 0.6);
                    body[i] = low.tick(s.brown()) * gust[i];
                }
                mixIn(buf, body, veg === 'none' ? 1 : winter ? 0.6 : 0.35);

                // Cả tán lá: ồn trắng qua dải lọc theo loại cây, lá rung rinh (biến thiên nhanh), sáng hơn khi gió mạnh
                const rustle = new Float32Array(n);
                const band = s.filter('bandpass', v.center, v.q);
                const air = s.filter('lowpass', 4000, 0.7);
                const leafFlutter = s.drift(12, 0.8);
                for (let i = 0; i < n; i++) {
                    const g = gust[i];
                    if (i % 64 === 0) {
                        band.set(v.center * (0.8 + 0.4 * g), v.q);
                        air.set(2500 + 6000 * g, 0.7);
                    }
                    rustle[i] = air.tick(band.tick(s.white())) * Math.pow(g, 1.3) * (0.75 + 0.25 * leafFlutter());
                }
                mixIn(buf, rustle, v.rustle * (winter ? 0.25 : 1) * (veg === 'none' ? 0.3 : 1));

                // Từng chiếc lá chạm nhau: hạt tiếng ngắn, dày lên khi gió giật; lá khô mùa thu giòn hơn, mùa đông gần như
                // không còn lá
                const grains = v.grains * (autumn ? 1.6 : winter ? 0.1 : 1);
                if (grains > 0) {
                    const clatter = new Float32Array(n);
                    s.events(n, grains, i => Math.pow(gust[i], 1.5)).forEach(at => s.grain(clatter, at, s.range(...v.grain), s.skew(0.05, 1, 3)));
                    s.filter('highpass', autumn ? 2500 : 1500, 0.7).run(clatter);
                    if (v.band) s.filter('bandpass', v.band, 2).run(clatter);
                    mixIn(buf, clatter, v.clatter * (autumn ? 1.4 : 1));
                }

                // Mùa đông: gió rít hun hút qua cành trơ (dải lọc hẹp trôi chầm chậm)
                if (winter) {
                    const whistle = new Float32Array(n);
                    const reed = s.filter('bandpass', 700, 12);
                    const pitch = s.drift(0.05);
                    for (let i = 0; i < n; i++) {
                        if (i % 64 === 0) reed.set(450 + 500 * pitch(), 12);
                        whistle[i] = reed.tick(s.white()) * gust[i] * gust[i];
                    }
                    mixIn(buf, whistle, 0.25);
                }
                s.filter('highpass', 30, 0.7).run(buf);
            });
        }
    }
};
