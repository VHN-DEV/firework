/*!
 * Trình diễn Pháo hoa – trình phát: âm thanh thiên nhiên (mưa)
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Mưa: tiếng rào rào nền (ồn hồng), hàng trăm hạt mưa mỗi giây (rơi xuống nước thì mỗi hạt là một bong bóng "tí tách"
// cao, xuống đất, mặt băng thì là tiếng gõ khô), vài hạt to "lộp độp", mưa trên tán lá.

import { mixIn, renderLoop } from '../dsp.js';

export const RAIN_SOUNDS = {
    // water: mưa rơi xuống mặt nước (không đóng băng); trees: có cây trên bờ
    rain: {
        loop: [9.1, 12.7],
        render(s, { water = true, trees = false } = {}, { seconds }) {
            return renderLoop(s, seconds, buf => {
                const n = buf.length;
                const hiss = new Float32Array(n);
                const high = s.filter('highpass', 350, 0.7);
                const low = s.filter('lowpass', 7500, 0.7);
                const swell = s.drift(0.15);
                for (let i = 0; i < n; i++) hiss[i] = low.tick(high.tick(s.pink())) * (0.85 + 0.15 * swell());
                mixIn(buf, hiss, 1);

                const drops = new Float32Array(n);
                s.events(n, 450).forEach(at => {
                    if (water && s.chance(0.75)) s.bubble(drops, at, s.logRange(1500, 5500), s.range(0.0015, 0.004), 0.4, s.skew(0.02, 1, 3));
                    else s.grain(drops, at, s.range(0.001, 0.0025), s.skew(0.02, 1, 3));
                });
                if (!water) s.filter('lowpass', 5000, 0.7).run(drops);
                mixIn(buf, drops, 0.6);

                const big = new Float32Array(n);
                s.events(n, 4).forEach(at => {
                    if (water) s.bubble(big, at, s.logRange(700, 1800), s.range(0.006, 0.012), 0.5, s.skew(0.3, 1));
                    else s.grain(big, at, s.range(0.004, 0.008), s.skew(0.3, 1));
                });
                mixIn(buf, big, 0.3);

                if (trees) {
                    const leaves = new Float32Array(n);
                    s.events(n, 120).forEach(at => s.grain(leaves, at, s.range(0.003, 0.008), s.skew(0.05, 1, 2)));
                    mixIn(buf, s.filter('bandpass', 2000, 0.8).run(leaves), 0.3);
                }
                s.filter('highpass', 150, 0.7).run(buf);
            });
        }
    }
};
