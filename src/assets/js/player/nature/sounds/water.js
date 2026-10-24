/*!
 * Hanabi – trình phát: âm thanh thiên nhiên (tiếng nước)
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Tiếng nước: dòng sông chảy, hồ vỗ bờ (bờ đất, kè đá, bãi cát sóng vỗ bọt trắng, biển khơi); tiếng nước bắn khi cá
// quẫy, ếch nhảy tõm, vịt đáp; cá đớp mồi; bong bóng vỡ; biển khơi: sóng đánh vào đá, sóng vỗ bãi cát bên này. Tiếng nước phần lớn là bong bóng: mỗi bong bóng kêu một
// tiếng "tóp" ngắn, cao độ trượt lên (mô hình Minnaert), hàng trăm cái chồng lên nhau thành tiếng róc rách.

import { mixIn, renderLoop, renderShot } from '../dsp.js';

// Bờ ở mép nước: 'earth' bờ đất, lau sậy (nước óc ách chỗ bùn); 'wall' kè, chân cầu, nhà phố (nước vỗ "clốp" vào đá);
// 'sand' bãi cát (sóng vỗ bọt trắng); 'sea' biển khơi (sóng lừng, không có bờ)

// Lớp nước trầm ầm ì: tiếng ồn nâu lọc thấp, dâng lên hạ xuống chậm
function body(s, n, cutoff, hz, depth) {
    const out = new Float32Array(n);
    const low = s.filter('lowpass', cutoff, 0.6);
    const swell = s.drift(hz);
    for (let i = 0; i < n; i++) out[i] = low.tick(s.brown()) * (1 - depth + depth * swell());
    return out;
}

// Nước gợn: tiếng "sss" ở dải giữa lúc to lúc nhỏ (cắt bớt phần cao kẻo nghe như tiếng rè)
function wash(s, n, center, hz) {
    const out = new Float32Array(n);
    const band = s.filter('bandpass', center, 0.7);
    const soft = s.filter('lowpass', 2200, 0.7);
    const mod = s.drift(hz);
    for (let i = 0; i < n; i++) out[i] = soft.tick(band.tick(s.pink())) * (0.3 + 0.7 * mod());
    return out;
}

// Bong bóng lăn tăn rải rác và từng chùm (nước cuộn qua đá, chân cầu)
function babble(s, n, single, clusters, low = 380, high = 1500) {
    const out = new Float32Array(n);
    s.events(n, single).forEach(at => s.bubble(out, at, s.logRange(low, high), s.range(0.004, 0.012), s.range(0.1, 0.5), s.skew(0.05, 0.45)));
    s.events(n, clusters).forEach(at => {
        const k = 3 + ((s.rnd() * 6) | 0);
        for (let j = 0; j < k; j++) {
            s.bubble(out, Math.min(n - 1, at + s.samples(s.range(0, 0.12))), s.logRange(low * 0.7, high * 0.6), s.range(0.008, 0.02), s.range(0.2, 0.7), s.skew(0.1, 0.5));
        }
    });
    return s.filter('lowpass', 3400, 0.7).run(out);
}

// Nước vỗ vào kè, chân cầu: tiếng "clốp" (va đập dải giữa + bong bóng trầm của hốc nước)
function slaps(s, n, perSecond) {
    const out = new Float32Array(n);
    const hit = new Float32Array(n);
    s.events(n, perSecond).forEach(at => {
        s.grain(hit, at, s.range(0.03, 0.06), s.range(0.4, 1));
        s.bubble(out, Math.min(n - 1, at + s.samples(0.008)), s.range(220, 380), s.range(0.02, 0.035), s.range(0.3, 0.6), s.range(0.5, 1));
        if (s.chance(0.6)) s.bubble(out, Math.min(n - 1, at + s.samples(s.range(0.05, 0.2))), s.logRange(600, 1500), s.range(0.005, 0.01), 0.4, s.range(0.2, 0.5));
    });
    s.filter('bandpass', s.range(550, 850), 1.2).run(hit);
    for (let i = 0; i < n; i++) out[i] += hit[i] * 0.6;
    return out;
}

// Hồ vỗ bờ: từng con sóng nhỏ (dải lọc trượt lên rồi xuống) rồi vài giọt "lóc bóc" khi nước rút
function laps(s, n, shore) {
    const drops = new Float32Array(n);
    const band = s.filter('bandpass', 300, 0.9);
    const wave = new Float32Array(n);
    let t = s.samples(s.range(0, 1.5));
    while (t < n) {
        const len = s.samples(s.range(0.5, 0.95));
        const rise = s.range(0.12, 0.22);
        const top = shore === 'earth' ? s.range(420, 560) : s.range(560, 780);
        const amp = s.range(0.5, 1);
        for (let i = 0; i < len && t + i < n; i++) {
            const p = i / len;
            const env = p < rise ? Math.sin(Math.PI / 2 * p / rise) : Math.exp(-(p - rise) * 5);
            if (i % 32 === 0) band.set(260 + (top - 260) * Math.sin(Math.PI * Math.min(1, p * 1.4)), 0.9);
            wave[t + i] += band.tick(s.pink()) * env * amp;
        }
        // Tên riêng cho số giọt: trùng tên mảng drops thì giọt nước ghi vào một con số, lớp "lóc bóc" câm hẳn
        const dropCount = 1 + ((s.rnd() * 4) | 0);
        for (let j = 0; j < dropCount; j++) {
            const at = t + s.samples(rise * 0.9 + s.range(0.05, 0.35));
            if (at < n) s.bubble(drops, at, s.logRange(shore === 'earth' ? 380 : 500, 1400), s.range(0.006, 0.015), s.range(0.2, 0.6), s.skew(0.15, 0.6));
        }
        if (shore === 'wall' && s.chance(0.7)) {
            const at = t + s.samples(rise * 0.8);
            if (at < n) s.bubble(drops, at, s.range(300, 450), s.range(0.02, 0.032), 0.4, s.range(0.4, 0.8));
        }
        t += s.samples(s.range(1.6, 4));
    }
    return mixIn(mixIn(new Float32Array(n), wave, 1), drops, 0.35);
}

// Sóng vỗ bãi cát: sóng dâng (tiếng ồn sáng dần) rồi vỡ, bọt trắng xèo xèo tan dần (hàng trăm bong bóng li ti)
function surf(s, n, strength) {
    const waves = new Float32Array(n);
    const swellBand = s.filter('lowpass', 400, 0.7);
    const foamHigh = s.filter('highpass', 1200, 0.7);
    const foamLow = s.filter('lowpass', 7000, 0.7);
    const fizz = new Float32Array(n);
    let t = s.samples(s.range(0, 2));
    while (t < n) {
        const up = s.samples(s.range(1, 1.6) * strength);
        const down = s.samples(s.range(1.6, 2.6) * strength);
        const amp = s.range(0.6, 1);
        for (let i = 0; i < up + down && t + i < n; i++) {
            const rising = i < up;
            const p = rising ? i / up : (i - up) / down;
            if (i % 32 === 0) swellBand.set(rising ? 300 + 2200 * p * p : 2500 - 1800 * p, 0.7);
            const swell = swellBand.tick(s.pink()) * (rising ? p * p : Math.exp(-p * 3));
            const foam = rising ? 0 : foamLow.tick(foamHigh.tick(s.white())) * Math.exp(-p * 2.2) * 0.6;
            waves[t + i] += (swell + foam) * amp;
        }
        // Bọt vỡ: bong bóng li ti dày đặc lúc sóng vừa vỡ, thưa dần
        s.events(down, 160, i => Math.exp(-3 * i / down)).forEach(i => {
            if (t + up + i < n) s.bubble(fizz, t + up + i, s.logRange(1800, 5200), s.range(0.0015, 0.004), 0.3, s.skew(0.05, 0.4));
        });
        t += up + down + s.samples(s.range(1.5, 4.5) * strength);
    }
    return mixIn(mixIn(new Float32Array(n), waves, 1), fizz, 0.3);
}

export const WATER_SOUNDS = {
    // Tiếng nước nền theo kiểu mặt nước (style: 'river' sông chảy, 'lake' hồ) và bờ (shore)
    water: {
        loop: [9.6, 13.4],
        render(s, { style = 'lake', shore = 'earth' } = {}, { seconds }) {
            return renderLoop(s, seconds, buf => {
                const n = buf.length;
                if (style === 'river') {
                    mixIn(buf, body(s, n, 380, 0.2, 0.35), 1);
                    mixIn(buf, wash(s, n, 700, 0.5), 0.25);
                    mixIn(buf, babble(s, n, 30, shore === 'wall' ? 1.4 : 1), 0.6);
                    if (shore === 'wall') mixIn(buf, slaps(s, n, 0.35), 0.3);
                    if (shore === 'earth') mixIn(buf, babble(s, n, 2, 0.5, 200, 600), 0.2);
                    if (shore === 'sand') mixIn(buf, surf(s, n, 0.7), 0.45);
                    if (shore === 'sea') mixIn(buf, body(s, n, 160, 0.08, 0.6), 0.6);
                } else if (shore === 'sand') {
                    mixIn(buf, body(s, n, 220, 0.12, 0.5), 0.35);
                    mixIn(buf, surf(s, n, 1), 1);
                } else if (shore === 'sea') {
                    mixIn(buf, body(s, n, 160, 0.08, 0.6), 1);
                    mixIn(buf, wash(s, n, 600, 0.1), 0.3);
                    mixIn(buf, slaps(s, n, 0.25), 0.22);
                } else {
                    mixIn(buf, body(s, n, 220, 0.15, 0.5), 0.45);
                    mixIn(buf, laps(s, n, shore), 1);
                    mixIn(buf, babble(s, n, 0.6, 0, 700, 2000), 0.12);
                    if (shore === 'wall') mixIn(buf, slaps(s, n, 0.2), 0.3);
                }
                s.filter('highpass', 40, 0.7).run(buf);
            });
        }
    },

    // Nước bắn: cá quẫy, ếch nhảy tõm, vịt đáp, cò mổ cá. size: 'small' | 'medium' | 'large'
    splash: {
        render(s, { size = 'medium' } = {}) {
            const z = { small: 0.4, medium: 0.7, large: 1.1 }[size] || 0.7;
            return renderShot(s, 0.5 + 0.6 * z, buf => {
                const n = buf.length;
                // Va đập: tiếng ồn ngắn, dải lọc trượt từ cao xuống trầm
                const hit = s.filter('bandpass', 2200, 0.7);
                const len = s.samples(0.06 + 0.12 * z);
                const tau = (0.02 + 0.05 * z) * s.rate;
                for (let i = 0; i < len; i++) {
                    if (i % 32 === 0) hit.set(2200 - 1400 * i / len, 0.7);
                    buf[i] += hit.tick(s.pink()) * Math.min(1, i / 30) * Math.exp(-i / tau) * 1.6;
                }
                // Hốc nước khép lại: tiếng "tõm" trầm, cao độ trượt lên
                s.bubble(buf, s.samples(s.range(0.005, 0.015)), s.range(0.85, 1.15) * 700 / (0.6 + z), 0.02 + 0.03 * z, s.range(0.6, 1), 0.8);
                for (let j = 0; j < 2 + ((s.rnd() * 3) | 0); j++) {
                    s.bubble(buf, s.samples(s.range(0.02, 0.08)), s.logRange(400, 1200), s.range(0.006, 0.014), s.range(0.3, 0.6), s.range(0.2, 0.45));
                }
                // Nước rơi lại lách tách
                for (let j = 0; j < 3 + Math.round(6 * z * s.range(0.7, 1.3)); j++) {
                    const at = s.samples(s.range(0.08, 0.35 + 0.2 * z));
                    if (at < n) s.bubble(buf, at, s.logRange(900, 2600), s.range(0.003, 0.007), 0.4, s.skew(0.1, 0.45));
                }
                // Cá lớn: thêm tiếng "ùm" trầm
                if (z > 0.9) {
                    const low = s.filter('lowpass', 250, 0.7);
                    for (let i = 0; i < s.samples(0.4); i++) buf[i] += low.tick(s.brown()) * Math.exp(-i / (0.08 * s.rate)) * 1.2;
                }
            });
        }
    },

    // Sóng đánh vào đá giữa biển: tiếng "ầm" trầm lúc sóng đập vào đá, nước tung xối xả (ồn sáng, dải lọc trượt xuống),
    // nước rơi lại lộp độp, bọt xèo xèo tan dần. size: 'small' | 'large'
    crash: {
        render(s, { size = 'large' } = {}) {
            const z = size === 'small' ? 0.6 : 1;
            return renderShot(s, 2.2 + 0.8 * z, buf => {
                const n = buf.length;
                const low = s.filter('lowpass', 140 + 80 * z, 0.7);
                const attack = s.samples(0.02);
                for (let i = 0, len = Math.min(n, s.samples(1.2)); i < len; i++) {
                    buf[i] += low.tick(s.brown()) * Math.min(1, i / attack) * Math.exp(-i / (0.22 * s.rate)) * 1.8 * z;
                }
                const band = s.filter('bandpass', 2600, 0.6);
                for (let i = 0, len = Math.min(n, s.samples(1.3 + 0.6 * z)); i < len; i++) {
                    const p = i / len;
                    if (i % 32 === 0) band.set(2800 - 2000 * p, 0.6);
                    buf[i] += band.tick(s.pink()) * Math.min(1, i / s.samples(0.04)) * Math.exp(-p * 3) * 1.1;
                }
                for (let j = 0; j < Math.round(16 * z); j++) {
                    const at = s.samples(s.range(0.3, 1.5));
                    if (at < n) s.bubble(buf, at, s.logRange(500, 1800), s.range(0.004, 0.012), s.range(0.2, 0.5), s.skew(0.1, 0.5));
                }
                const fizz = new Float32Array(n);
                const from = s.samples(0.25);
                s.events(n - from, 200 * z, i => Math.exp(-2.5 * i / (n - from))).forEach(i => {
                    s.bubble(fizz, from + i, s.logRange(1800, 5200), s.range(0.0015, 0.004), 0.3, s.skew(0.05, 0.4));
                });
                mixIn(buf, fizz, 0.3);
            });
        }
    },

    // Sóng vỗ bãi cát bên này của biển khơi: sóng đổ "ào" xuống mép cát rồi tràn lên, bọt xèo xèo tan dần lúc nước rút.
    // size: 'small' | 'large'
    shore: {
        render(s, { size = 'large' } = {}) {
            const z = size === 'small' ? 0.65 : 1;
            return renderShot(s, 3.2, buf => {
                const n = buf.length;
                const wash = s.filter('lowpass', 300, 0.7);
                const up = s.samples(0.1);
                const down = Math.min(n - up, s.samples(2.4));
                for (let i = 0; i < up + down; i++) {
                    const rising = i < up;
                    const p = rising ? i / up : (i - up) / down;
                    if (i % 32 === 0) wash.set(rising ? 600 + 1600 * p : 2200 - 1700 * p, 0.7);
                    buf[i] += wash.tick(s.pink()) * (rising ? p : Math.exp(-p * 2.6)) * z;
                }
                const low = s.filter('lowpass', 180, 0.7);
                for (let i = 0, len = s.samples(0.6); i < len && up + i < n; i++) {
                    buf[up + i] += low.tick(s.brown()) * Math.exp(-i / (0.15 * s.rate)) * 0.9 * z;
                }
                const fizz = new Float32Array(n);
                s.events(down, 220 * z, i => Math.exp(-2.2 * i / down)).forEach(i => {
                    if (up + i < n) s.bubble(fizz, up + i, s.logRange(1800, 5600), s.range(0.0015, 0.004), 0.3, s.skew(0.05, 0.4));
                });
                mixIn(buf, fizz, 0.35);
            });
        }
    },

    // Cá đớp mồi: tiếng "tóp" nhỏ và một giọt nhỏ hơn ngay sau
    plip: {
        render(s) {
            return renderShot(s, 0.2, buf => {
                const f = s.range(450, 900);
                s.bubble(buf, 2, f, s.range(0.01, 0.018), s.range(0.7, 1.1), 1);
                s.grain(buf, 0, 0.004, 0.25);
                s.bubble(buf, s.samples(s.range(0.03, 0.06)), f * s.range(1.3, 1.7), 0.006, 0.5, 0.3);
            });
        }
    },

    // Bong bóng nổi lên mặt nước vỡ "tách"
    bubble: {
        render(s) {
            return renderShot(s, 0.06, buf => {
                s.bubble(buf, 2, s.range(1400, 3000), s.range(0.003, 0.006), 0.4, 1);
                s.grain(buf, 0, 0.001, 0.3);
            });
        }
    }
};
