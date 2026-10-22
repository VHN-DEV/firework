/*!
 * Trình diễn Pháo hoa – trình phát: âm thanh thiên nhiên (bộ xử lý âm thanh)
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Bộ xử lý nhỏ để tổng hợp tiếng thiên nhiên từng mẫu một, không cần file âm thanh: bộ lọc, tiếng ồn, độ biến thiên
// chậm (gió giật, nước dâng), bong bóng nước, hạt tiếng (lá chạm nhau), nối vòng lặp liền mạch. Không dùng DOM hay
// Web Audio nên chạy được trong worker và trong Node (kiểm thử).

import { seededRandom } from '../utils.js';

// Số mẫu mỗi giây của tiếng tổng hợp: đủ cho tiếng thiên nhiên (tới 16 kHz), nhẹ hơn 44,1/48 kHz
export const RATE = 32000;

const TAU = Math.PI * 2;

// Bộ lọc hai cực (công thức RBJ): 'lowpass', 'highpass', 'bandpass' (đỉnh 0 dB), 'peak' (tăng/giảm gain dB quanh freq)
export class Biquad {
    constructor(rate, type, freq, q = 0.707, gain = 0) {
        this.rate = rate;
        this.type = type;
        this.x1 = this.x2 = this.y1 = this.y2 = 0;
        this.set(freq, q, gain);
    }

    set(freq, q = this.q, gain = this.gain) {
        this.freq = freq;
        this.q = q;
        this.gain = gain;
        const w = TAU * Math.max(10, Math.min(freq, this.rate * 0.45)) / this.rate;
        const cos = Math.cos(w);
        const alpha = Math.sin(w) / (2 * q);
        let b0, b1, b2, a0, a1, a2;
        if (this.type === 'lowpass') {
            b0 = b2 = (1 - cos) / 2;
            b1 = 1 - cos;
        } else if (this.type === 'highpass') {
            b0 = b2 = (1 + cos) / 2;
            b1 = -(1 + cos);
        } else if (this.type === 'bandpass') {
            b0 = alpha;
            b1 = 0;
            b2 = -alpha;
        }
        a0 = 1 + alpha;
        a1 = -2 * cos;
        a2 = 1 - alpha;
        if (this.type === 'peak') {
            const A = Math.pow(10, gain / 40);
            b0 = 1 + alpha * A;
            b1 = -2 * cos;
            b2 = 1 - alpha * A;
            a0 = 1 + alpha / A;
            a2 = 1 - alpha / A;
        }
        this.b0 = b0 / a0;
        this.b1 = b1 / a0;
        this.b2 = b2 / a0;
        this.a1 = a1 / a0;
        this.a2 = a2 / a0;
        return this;
    }

    tick(x) {
        const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
        this.x2 = this.x1;
        this.x1 = x;
        this.y2 = this.y1;
        this.y1 = y;
        return y;
    }

    // Lọc cả đoạn [from, to) của buf tại chỗ
    run(buf, from = 0, to = buf.length) {
        for (let i = from; i < to; i++) buf[i] = this.tick(buf[i]);
        return buf;
    }
}

// Một lần tổng hợp: số ngẫu nhiên theo hạt giống (cùng hạt giống ra cùng tiếng) và các khối dựng tiếng
export class Synth {
    constructor(rate = RATE, seed = 1) {
        this.rate = rate;
        this.rnd = seededRandom(Math.max(1, Math.floor(seed * 2147483646) % 2147483646 || 1));
        this.pinkState = [0, 0, 0, 0, 0, 0, 0];
        this.brownState = 0;
    }

    range(a, b) {
        return a + (b - a) * this.rnd();
    }

    // Phân bố lệch về phía nhỏ (nhiều tiếng nhỏ, ít tiếng to): hợp với tiếng mưa, bong bóng, lá
    skew(a, b, power = 2) {
        return a + (b - a) * Math.pow(this.rnd(), power);
    }

    // Phân bố đều theo thang log (tần số)
    logRange(a, b) {
        return a * Math.pow(b / a, this.rnd());
    }

    chance(p) {
        return this.rnd() < p;
    }

    samples(seconds) {
        return Math.max(1, Math.round(seconds * this.rate));
    }

    filter(type, freq, q, gain) {
        return new Biquad(this.rate, type, freq, q, gain);
    }

    white() {
        return this.rnd() * 2 - 1;
    }

    // Tiếng ồn hồng (năng lượng giảm dần theo tần số, như mưa, gió): bộ lọc của Paul Kellet
    pink() {
        const w = this.white();
        const b = this.pinkState;
        b[0] = 0.99886 * b[0] + w * 0.0555179;
        b[1] = 0.99332 * b[1] + w * 0.0750759;
        b[2] = 0.969 * b[2] + w * 0.153852;
        b[3] = 0.8665 * b[3] + w * 0.3104856;
        b[4] = 0.55 * b[4] + w * 0.5329522;
        b[5] = -0.7616 * b[5] - w * 0.016898;
        const out = b[0] + b[1] + b[2] + b[3] + b[4] + b[5] + b[6] + w * 0.5362;
        b[6] = w * 0.115926;
        return out * 0.11;
    }

    // Tiếng ồn nâu (trầm, ầm ì như nước chảy xa, gió lớn)
    brown() {
        this.brownState = (this.brownState + 0.02 * this.white()) / 1.02;
        return this.brownState * 3.5;
    }

    // Đường biến thiên chậm, mượt trong [0, 1]: mỗi khoảng ~1/hz giây đi tới một giá trị ngẫu nhiên mới (gió giật, sóng)
    drift(hz, jitter = 0.5) {
        const s = this;
        let from = s.rnd();
        let to = s.rnd();
        let len = s.samples((1 + s.range(-jitter, jitter)) / hz);
        let i = 0;
        return () => {
            if (++i >= len) {
                i = 0;
                from = to;
                to = s.rnd();
                len = s.samples((1 + s.range(-jitter, jitter)) / hz);
            }
            const p = i / len;
            return from + (to - from) * (0.5 - 0.5 * Math.cos(Math.PI * p));
        };
    }

    // Thời điểm (mẫu) các sự việc ngẫu nhiên trong [0, n), trung bình perSecond lần mỗi giây; rateAt(i) (0-1) đổi mật độ
    // theo thời gian (gió mạnh thì lá chạm nhau nhiều hơn)
    events(n, perSecond, rateAt) {
        const out = [];
        if (perSecond <= 0) return out;
        const mean = this.rate / perSecond;
        for (let t = -Math.log(1 - this.rnd()) * mean; t < n; t += -Math.log(1 - this.rnd()) * mean) {
            if (!rateAt || this.rnd() < rateAt(Math.floor(t))) out.push(Math.floor(t));
        }
        return out;
    }

    // Bong bóng nước (cộng vào buf từ mẫu at): sóng sin tắt dần, cao độ trượt lên khi bong bóng co lại (tiếng "tóp", "lách
    // tách" của nước). f0: Hz, tau: giây (thời gian tắt), glide: cao độ tăng thêm tối đa bao nhiêu phần (trượt nhanh lúc đầu
    // rồi dừng, 1 = lên một quãng tám)
    bubble(buf, at, f0, tau, glide, amp) {
        const n = Math.min(buf.length - at, Math.ceil(tau * 6 * this.rate));
        const attack = Math.max(2, Math.round(0.0004 * this.rate));
        const decay = Math.exp(-1 / (tau * this.rate));
        let env = amp;
        let phase = this.rnd() * 0.3;
        for (let i = 0; i < n; i++) {
            const f = f0 * (1 + glide * (1 - Math.exp(-i / (1.5 * tau * this.rate))));
            phase += TAU * f / this.rate;
            buf[at + i] += env * (i < attack ? i / attack : 1) * Math.sin(phase);
            env *= decay;
        }
    }

    // Hạt tiếng ồn ngắn có cửa sổ Hann (lá chạm nhau, hạt mưa, tiếng cát): cộng vào buf từ mẫu at
    grain(buf, at, seconds, amp) {
        const n = Math.min(buf.length - at, this.samples(seconds));
        for (let i = 0; i < n; i++) buf[at + i] += amp * this.white() * (0.5 - 0.5 * Math.cos(TAU * i / n));
    }
}

// Vòng lặp liền mạch: buf dài hơn vòng lặp fade mẫu; đoạn đuôi trộn dần vào đầu (trộn giữ năng lượng) nên chỗ nối không
// nghe thấy. Trả về mảng dài buf.length - fade.
export function loopify(buf, fade) {
    const n = buf.length - fade;
    const out = buf.slice(0, n);
    for (let i = 0; i < fade; i++) {
        const p = (i + 0.5) / fade;
        out[i] = buf[i] * Math.sin(p * Math.PI / 2) + buf[n + i] * Math.cos(p * Math.PI / 2);
    }
    return out;
}

export function rms(buf) {
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    return Math.sqrt(sum / Math.max(1, buf.length));
}

export function peak(buf) {
    let max = 0;
    for (let i = 0; i < buf.length; i++) max = Math.max(max, Math.abs(buf[i]));
    return max;
}

// Cộng một thành phần vào bản phối với độ to (RMS) cho trước: mỗi thành phần dựng riêng rồi phối theo tỉ lệ rõ ràng,
// không phụ thuộc mật độ hạt tiếng hay bộ lọc của nó
export function mixIn(dst, part, level) {
    const k = level / (rms(part) || 1);
    for (let i = 0; i < dst.length && i < part.length; i++) dst[i] += part[i] * k;
    return dst;
}

// Đưa về cùng độ to để phối tiếng dễ đoán: tiếng nền theo RMS, tiếng ngắn theo đỉnh; luôn chừa khoảng an toàn khỏi vỡ
// tiếng (đỉnh tối đa 0,95)
export function normalize(buf, { rms: targetRms, peak: targetPeak = 0.95 } = {}) {
    const p = peak(buf);
    if (!p) return buf;
    let k = targetRms ? targetRms / (rms(buf) || 1) : targetPeak / p;
    k = Math.min(k, 0.95 / p);
    for (let i = 0; i < buf.length; i++) buf[i] *= k;
    return buf;
}

// Nén mềm các đỉnh vượt crest lần RMS (một hạt lá, hạt mưa to bất thường): tiếng nền không bị vài đỉnh hiếm kéo nhỏ cả
// đoạn khi chuẩn hóa, cũng không nghe thấy tiếng tách
export function limit(buf, crest = 4) {
    const t = crest * rms(buf);
    if (!t) return buf;
    for (let i = 0; i < buf.length; i++) {
        const a = Math.abs(buf[i]);
        if (a > t) buf[i] = Math.sign(buf[i]) * (t + (a - t) / (1 + 2 * (a - t) / t));
    }
    return buf;
}

// Mở/tắt nhẹ ở hai đầu (tránh tiếng tách khi phát tiếng ngắn)
export function fadeEdges(buf, rate, seconds = 0.004) {
    const n = Math.min(buf.length >> 1, Math.round(seconds * rate));
    for (let i = 0; i < n; i++) {
        const k = i / n;
        buf[i] *= k;
        buf[buf.length - 1 - i] *= k;
    }
    return buf;
}

// Dựng một đoạn lặp dài seconds giây: fill(buf, s) ghi tiếng vào buf (dài hơn vòng lặp 0,6 giây để nối), xong thì nối
// vòng và chuẩn hóa độ to
export function renderLoop(s, seconds, fill, level = 0.1) {
    const fade = s.samples(0.6);
    const buf = new Float32Array(s.samples(seconds) + fade);
    fill(buf, s);
    return normalize(limit(loopify(buf, fade)), { rms: level });
}

// Dựng một tiếng ngắn dài tối đa seconds giây, cắt phần lặng ở cuối
export function renderShot(s, seconds, fill, level = 0.9) {
    const buf = new Float32Array(s.samples(seconds));
    fill(buf, s);
    let end = buf.length;
    const floor = peak(buf) * 0.002;
    while (end > 1 && Math.abs(buf[end - 1]) < floor) end--;
    return normalize(fadeEdges(buf.slice(0, Math.min(buf.length, end + s.samples(0.01))), s.rate), { peak: level });
}
