/*!
 * Trình diễn Pháo hoa – trình phát: âm thanh thiên nhiên (dế, côn trùng)
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Dế kêu đêm ven bờ: mỗi con một cao độ, một nhịp riêng (mỗi tiếng "re re" là 3-5 xung ngắn ~4-5 kHz), con gần con
// xa, thỉnh thoảng nghỉ; nền rả rích của dế mèn, muỗm ở xa. Trời ấm kêu nhanh, mùa thu lạnh kêu chậm và thưa (định
// luật Dolbear), mưa thì gần như im.

import { mixIn, renderLoop } from '../dsp.js';

const TAU = Math.PI * 2;

// Số con, chu kỳ tiếng kêu (giây), nền rả rích theo mùa
const SEASON = {
    spring: { count: 3, period: [0.45, 0.65], trill: 0.15 },
    summer: { count: 5, period: [0.36, 0.52], trill: 0.35 },
    autumn: { count: 4, period: [0.6, 0.95], trill: 0.45 }
};

// Một con dế: chuỗi tiếng kêu, mỗi tiếng vài xung sin có đường bao tròn, cao độ hơi trượt xuống trong mỗi xung
function cricket(s, out, period, slow) {
    const n = out.length;
    const f = s.range(3900, 5000);
    const pulses = 3 + ((s.rnd() * 3) | 0);
    const pulseLen = s.range(0.012, 0.018);
    const gap = s.range(0.032, 0.042) * slow;
    const chirp = s.range(...period);
    const amp = s.skew(0.15, 1, 1.5);
    let t = s.range(0, chirp);
    let restUntil = -1;
    while (t * s.rate < n) {
        // Nghỉ một lúc rồi kêu tiếp
        if (t > restUntil && s.chance(0.04)) {
            restUntil = t + s.range(1, 4);
            t = restUntil;
            continue;
        }
        const k = pulses + (s.chance(0.2) ? (s.chance(0.5) ? 1 : -1) : 0);
        for (let p = 0; p < k; p++) {
            const at = Math.floor((t + p * gap) * s.rate);
            const len = s.samples(pulseLen);
            let phase = 0;
            for (let i = 0; i < len && at + i < n; i++) {
                const q = i / len;
                phase += TAU * f * (1 - 0.03 * q) / s.rate;
                const env = Math.sin(Math.PI * q);
                out[at + i] += amp * env * env * (Math.sin(phase) + 0.12 * Math.sin(2 * phase));
            }
        }
        t += chirp * s.range(0.96, 1.04);
    }
}

// Nền rả rích: vài giọng ngân liên tục, rung theo nhịp xung ~50 Hz, to nhỏ chầm chậm
function trill(s, out) {
    const n = out.length;
    for (let v = 0; v < 2; v++) {
        const f = s.range(2600, 3300);
        const rate = s.range(42, 60);
        const level = s.drift(0.1);
        let phase = 0;
        let pulse = s.rnd();
        for (let i = 0; i < n; i++) {
            phase += TAU * f / s.rate;
            pulse += rate / s.rate;
            const a = Math.max(0, Math.sin(TAU * pulse));
            out[i] += Math.sin(phase) * a * a * a * (0.3 + 0.7 * level());
        }
    }
}

export const INSECT_SOUNDS = {
    crickets: {
        loop: [10.7, 14.3],
        render(s, { season = 'summer', rain = false } = {}, { seconds }) {
            const k = SEASON[season] || SEASON.summer;
            return renderLoop(s, seconds, buf => {
                const n = buf.length;
                const chirps = new Float32Array(n);
                const count = rain ? 1 : k.count;
                for (let c = 0; c < count; c++) cricket(s, chirps, k.period, season === 'autumn' ? 1.25 : 1);
                mixIn(buf, chirps, 1);
                if (!rain && k.trill) {
                    const bed = new Float32Array(n);
                    trill(s, bed);
                    mixIn(buf, bed, k.trill);
                }
                s.filter('highpass', 2000, 0.7).run(buf);
                s.filter('lowpass', 9000, 0.7).run(buf);
            }, 0.07);
        }
    }
};
