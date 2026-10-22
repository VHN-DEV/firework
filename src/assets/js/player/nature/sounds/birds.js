/*!
 * Trình diễn Pháo hoa – trình phát: âm thanh thiên nhiên (vịt trời, cò)
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Vịt trời kêu "quạc": nguồn răng cưa giàu họa âm (thêm họa âm phụ một nửa cao độ cho tiếng rè, hơi thở) qua ba cộng
// hưởng giọng mũi; F1 trượt lên đầu tiếng ("qu-"). Vịt mái kêu to, từng tràng nhỏ dần; vịt đực khàn, trầm, nhỏ. Cất
// cánh: cánh vỗ nhanh rít gió, chân đạp nước. Cò kêu khàn "khoác" (xung thanh môn rất lệch nhịp, nhiều tiếng ồn), cánh
// vỗ chậm, sâu.

import { mixIn, renderShot } from '../dsp.js';

const TAU = Math.PI * 2;

// Sóng răng cưa không răng cưa giả (PolyBLEP)
function polyBlep(t, dt) {
    if (t < dt) {
        t /= dt;
        return t + t - t * t - 1;
    }
    if (t > 1 - dt) {
        t = (t - 1) / dt;
        return t * t + t + t + 1;
    }
    return 0;
}

function duckVoice(s, kind) {
    return kind === 'male'
        ? { f0: s.range(140, 180), f1: s.range(750, 850), f2: s.range(1500, 1700), len: [0.12, 0.18], sub: 0.45, breath: 0.35 }
        : { f0: s.range(280, 340), f1: s.range(900, 1050), f2: s.range(1900, 2300), len: [0.11, 0.17], sub: 0.25, breath: 0.12 };
}

// Một tiếng "quạc" cộng vào buf từ mẫu at
function quack(s, buf, at, v, amp, pitch) {
    const len = s.samples(s.range(...v.len));
    const n = Math.min(buf.length - at, len + s.samples(0.03));
    const f1 = s.filter('bandpass', v.f1, 4.5);
    const f2 = s.filter('bandpass', v.f2, 6);
    const f3 = s.filter('bandpass', 3100, 8);
    const wobble = s.drift(30);
    let phase = 0;
    let odd = false;
    for (let i = 0; i < n; i++) {
        const p = i / len;
        const f = v.f0 * pitch * (1 - 0.18 * Math.min(1, p)) * (1 + 0.03 * (wobble() - 0.5));
        const dt = f / s.rate;
        phase += dt;
        if (phase >= 1) {
            phase -= 1;
            odd = !odd;
        }
        const saw = 2 * phase - 1 - polyBlep(phase, dt);
        const x = saw * (odd ? 1 + v.sub : 1 - v.sub) + s.white() * v.breath;
        if (i % 32 === 0) f1.set(v.f1 * (0.68 + 0.32 * Math.min(1, p / 0.2)), 4.5);
        const env = p < 0.05 ? p / 0.05 : p < 0.3 ? 1 : Math.pow(Math.max(0, 1 - (p - 0.3) / 0.7), 1.5);
        buf[at + i] += (f1.tick(x) + f2.tick(x) * 0.75 + f3.tick(x) * 0.35) * env * amp;
    }
}

function egretVoice(s) {
    return { f0: s.range(95, 135), f1: s.range(650, 800), f2: s.range(1300, 1600) };
}

// Một tiếng kêu khàn của cò dài len giây, cộng vào buf từ mẫu at
function egretCall(s, buf, at, v, len, amp) {
    const total = s.samples(len);
    const n = Math.min(buf.length - at, total + s.samples(0.03));
    const src = new Float32Array(n);
    let next = 0;
    for (let i = 0; i < total; i++) {
        if (i >= next) {
            src[i] = s.range(0.6, 1.4);
            next = i + Math.max(2, Math.round(s.rate / (v.f0 * s.range(0.94, 1.06))));
        }
        src[i] += s.white() * 0.15;
    }
    const f1 = s.filter('bandpass', v.f1, 3);
    const f2 = s.filter('bandpass', v.f2, 4);
    const f3 = s.filter('bandpass', 2600, 5);
    const soft = s.filter('lowpass', 3000, 0.7);
    for (let i = 0; i < n; i++) {
        const p = i / total;
        const env = p < 0.04 ? p / 0.04 : p < 0.8 ? 1 - 0.2 * (p - 0.04) / 0.76 : Math.max(0, 0.8 * (1 - (p - 0.8) / 0.2));
        const x = src[i];
        buf[at + i] += soft.tick(f1.tick(x) + f2.tick(x) * 0.6 + f3.tick(x) * 0.25) * env * amp;
    }
}

export const BIRD_SOUNDS = {
    // kind: 'female' | 'male'; series: vịt mái kêu cả tràng to rồi nhỏ dần
    quack: {
        render(s, { kind = 'female', series = false } = {}) {
            const v = duckVoice(s, kind);
            const count = kind === 'male' ? 1 + ((s.rnd() * 3) | 0) : series ? 3 + ((s.rnd() * 4) | 0) : 1 + (s.chance(0.4) ? 1 : 0);
            const gap = kind === 'male' ? s.range(0.2, 0.3) : s.range(0.16, 0.22);
            return renderShot(s, count * gap + 0.4, buf => {
                for (let j = 0; j < count; j++) quack(s, buf, s.samples(j * gap * s.range(0.95, 1.05)), v, Math.pow(0.82, j), Math.pow(0.97, j));
            });
        }
    },

    // Đàn vịt cất cánh: cánh vỗ nhanh (mỗi con một nhịp), tiếng gió rít qua lông cánh, chân đạp nước lúc chạy lấy đà
    wings: {
        render(s) {
            return renderShot(s, 1.9, buf => {
                const n = buf.length;
                const beats = new Float32Array(n);
                const whistle = new Float32Array(n);
                const feet = new Float32Array(n);
                const birds = 2 + ((s.rnd() * 2) | 0);
                const band = s.filter('bandpass', 2300, 3);
                for (let b = 0; b < birds; b++) {
                    const rate = s.range(7.5, 9.2);
                    const amp = s.range(0.6, 1);
                    for (let t = s.range(0, 0.1); t < 1.6; t += s.range(0.95, 1.05) / rate) {
                        s.grain(beats, s.samples(t), s.range(0.03, 0.05), amp * Math.exp(-t / 0.9));
                    }
                    for (let i = 0; i < s.samples(1.7); i++) {
                        const t = i / s.rate;
                        const flap = 0.5 + 0.5 * Math.sin(TAU * rate * t);
                        whistle[i] += s.white() * flap * flap * Math.exp(-t / 0.9) * amp;
                    }
                }
                for (let j = 0, k = 4 + ((s.rnd() * 4) | 0); j < k; j++) {
                    const at = s.samples(j * s.range(0.08, 0.11));
                    s.bubble(feet, at, s.logRange(500, 1200), s.range(0.006, 0.01), 0.5, s.range(0.5, 1) * (1 - j / k));
                    s.grain(feet, at, 0.008, 0.4 * (1 - j / k));
                }
                mixIn(buf, s.filter('bandpass', 700, 0.8).run(beats), 1);
                mixIn(buf, band.run(whistle), 0.3);
                mixIn(buf, s.filter('lowpass', 3000, 0.7).run(feet), 0.5);
            });
        }
    },

    // Cò kêu khàn: một tiếng dài, hai tiếng, hoặc mấy tiếng cụt "khoác khoác" (variant)
    egret: {
        render(s, params, { variant = 0 }) {
            const v = egretVoice(s);
            const notes = variant === 3 ? [0.08, 0.08, 0.09] : variant === 2 ? [0.3, 0.36] : [s.range(0.28, 0.5)];
            const gap = variant === 3 ? 0.13 : 0.42;
            return renderShot(s, notes.length * gap + 0.6, buf => {
                notes.forEach((len, j) => egretCall(s, buf, s.samples(j * gap), v, len, j ? 0.85 : 1));
            });
        }
    },

    // Cò vỗ cánh chậm, sâu (cất cánh, sắp đáp)
    egretWings: {
        render(s) {
            return renderShot(s, 1.8, buf => {
                const low = s.filter('lowpass', 600, 0.7);
                const rate = s.range(2.2, 2.8);
                const beats = 3 + ((s.rnd() * 2) | 0);
                for (let b = 0; b < beats; b++) {
                    const at = s.samples(b / rate);
                    const amp = Math.pow(0.85, b);
                    for (let i = 0; i < s.samples(0.3) && at + i < buf.length; i++) {
                        const t = i / s.rate;
                        buf[at + i] += s.pink() * (t < 0.04 ? t / 0.04 : Math.exp(-(t - 0.04) / 0.12)) * amp;
                    }
                }
                low.run(buf);
            });
        }
    }
};
