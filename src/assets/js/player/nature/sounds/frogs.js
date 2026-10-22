/*!
 * Trình diễn Pháo hoa – trình phát: âm thanh thiên nhiên (ếch, nhái)
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Ếch kêu "ộp": tổng hợp kiểu nguồn - bộ lọc như tiếng nói: chuỗi xung thanh môn (cao độ lên rồi xuống, hơi rè) qua các
// cộng hưởng của khoang miệng, túi kêu; khép miệng thì tắt nhanh thành tiếng "p". Mỗi con một giọng (hạt giống). Ếch
// nhái ở xa kêu từng tràng, mưa xuống ễnh ương "ồm ộp" trầm và to.

import { peak, renderLoop, renderShot } from '../dsp.js';

const TAU = Math.PI * 2;

// Giọng một con ếch: cao độ, cộng hưởng, độ dài, có tách đôi tiếng "ộp-ộp" trong một lần phồng túi kêu không
function frogVoice(s, deep) {
    return deep
        ? { f0: s.range(78, 98), f1: s.range(300, 380), f2: s.range(800, 1000), len: s.range(0.42, 0.55), rough: s.range(18, 26), split: false }
        : { f0: s.range(105, 170), f1: s.range(420, 600), f2: s.range(1100, 1500), len: s.range(0.22, 0.36), rough: s.range(28, 40), split: s.chance(0.35) };
}

// Một tiếng kêu cộng vào buf từ mẫu at, độ to amp
function croak(s, buf, at, v, amp = 1) {
    const n = Math.min(buf.length - at, s.samples(v.len + 0.08));
    const len = s.samples(v.len);
    const src = new Float32Array(n);
    // Chuỗi xung thanh môn: mỗi chu kỳ một xung, lệch nhịp và lệch độ mạnh chút ít cho tự nhiên
    let next = 0;
    for (let i = 0; i < len; i++) {
        if (i >= next) {
            const p = i / len;
            const f = v.f0 * (0.9 + 0.25 * Math.sin(Math.PI * Math.min(1, p * 1.1)));
            src[i] = s.range(0.85, 1.15);
            if (i + 1 < n) src[i + 1] = -0.5 * src[i];
            next = i + Math.max(2, Math.round(s.rate / f * s.range(0.98, 1.02)));
        }
    }
    // Cộng hưởng: F1 trượt lên khi miệng mở rộng ("ộ" sang "p"), F2, F3 nhỏ dần
    const f1 = s.filter('bandpass', v.f1, 6);
    const f2 = s.filter('bandpass', v.f2, 8);
    const f3 = s.filter('bandpass', 2400, 10);
    const sac = s.filter('lowpass', v.f0 * 2.2, 2);
    const voice = new Float32Array(n);
    let rough = s.rnd();
    for (let i = 0; i < n; i++) {
        const p = i / len;
        if (i % 32 === 0) f1.set(v.f1 * (1 + 0.35 * Math.min(1, p)), 6);
        const x = src[i];
        const y = f1.tick(x) * 1.2 + f2.tick(x) * 0.45 + f3.tick(x) * 0.12 + sac.tick(x) * 0.35;
        // Đường bao: mở nhanh, to dần, khép miệng thì tắt nhanh; "ộp-ộp" thì lõm giữa
        let env = p < 0.06 ? Math.sin(Math.PI / 2 * p / 0.06) : p < 0.72 ? 0.8 + 0.2 * (p - 0.06) / 0.66 : Math.max(0, 1 - (p - 0.72) / 0.28);
        if (v.split) env *= 1 - 0.75 * Math.exp(-Math.pow((p - 0.45) / 0.06, 2));
        rough += v.rough / s.rate;
        env *= 1 - 0.25 * (0.5 + 0.5 * Math.sin(TAU * rough));
        voice[i] = y * env;
    }
    // Tiếng "p" khép miệng: một nhịp trầm rất ngắn, nhỏ hơn nhiều so với tiếng kêu
    const thump = new Float32Array(s.samples(0.05));
    const low = s.filter('lowpass', 140, 0.7);
    for (let i = 0; i < thump.length; i++) thump[i] = low.tick(i < 3 ? 1 : 0);
    const k = amp / (peak(voice) || 1);
    const kt = 0.12 * amp / (peak(thump) || 1);
    for (let i = 0; i < n; i++) buf[at + i] += voice[i] * k;
    for (let i = 0; i < thump.length && at + len + i < buf.length; i++) buf[at + len + i] += thump[i] * kt;
}

const SEASON = {
    spring: { count: 5, rate: 1 },
    summer: { count: 6, rate: 1.2 },
    autumn: { count: 2, rate: 0.6 }
};

export const FROG_SOUNDS = {
    // Một con ếch kêu (ếch đang ngồi phồng túi kêu); variant là giọng của con đó
    frog: {
        render(s) {
            const v = frogVoice(s, false);
            return renderShot(s, v.len + 0.15, buf => croak(s, buf, 0, v));
        }
    },

    // Ếch nhái kêu ở xa quanh bờ: từng con kêu từng tràng rồi nghỉ; xa nên trầm, nhòe, có tiếng vọng
    frogChorus: {
        loop: [12.1, 16.9],
        render(s, { season = 'summer', rain = false } = {}, { seconds }) {
            const k = SEASON[season] || SEASON.summer;
            return renderLoop(s, seconds, buf => {
                const n = buf.length;
                const voices = Math.round(k.count * (rain ? 1.6 : 1)) + (rain && season !== 'autumn' ? 3 : 0);
                for (let c = 0; c < voices; c++) {
                    const deep = rain && season !== 'autumn' && c >= voices - 3;
                    const v = frogVoice(s, deep);
                    const part = new Float32Array(n);
                    const amp = s.skew(0.25, 1, 1.5) * (deep ? 1.4 : 1);
                    let t = s.range(0, 4);
                    while (t < seconds + 0.6) {
                        const bout = 2 + ((s.rnd() * 5) | 0);
                        const gap = s.range(0.4, 0.9) * (deep ? 1.6 : 1);
                        for (let j = 0; j < bout; j++) {
                            const at = s.samples(t + j * gap * s.range(0.9, 1.1));
                            if (at < n) croak(s, part, at, v, amp * s.range(0.8, 1));
                        }
                        t += bout * gap + s.range(2, 8) / k.rate;
                    }
                    s.filter('lowpass', s.range(1400, 2500), 0.7).run(part);
                    for (let i = 0; i < n; i++) buf[i] += part[i];
                }
                // Tiếng vọng mặt nước: vài bản trễ nhỏ dần
                const dry = buf.slice();
                [[0.035, 0.25], [0.077, 0.15], [0.13, 0.08]].forEach(([delay, gain]) => {
                    const d = s.samples(delay);
                    for (let i = d; i < n; i++) buf[i] += dry[i - d] * gain;
                });
                s.filter('highpass', 70, 0.7).run(buf);
            }, 0.08);
        }
    }
};
