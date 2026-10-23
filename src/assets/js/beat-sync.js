/*!
 * Hanabi – xếp pháo theo nhịp nhạc
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Nghe bài nhạc ngay trong trình duyệt (không gửi đi đâu) rồi tự xếp pháo:
// analyzeMusic() tìm nhịp (BPM), vị trí từng phách, phách đầu ô nhịp, độ sôi động từng đoạn và những chỗ nhạc bùng lên;
// buildBeatShow() đặt pháo vào đó: đoạn êm bắn thưa và nhẹ, đoạn sôi động bắn dày, chỗ bùng lên nổ cả chùm.
// Kịch bản tạo ra dùng music.sync: "trễ" của mỗi phát là lúc pháo NỔ, trình phát tự phóng sớm hơn cho kịp.

const RATE = 11025;          // đủ để nghe trống và nhịp, nhẹ để phân tích nhanh
const FRAME = 512;           // cửa sổ phân tích ~46 ms
const HOP = 128;             // bước ~11,6 ms
const FPS = RATE / HOP;      // số khung phân tích mỗi giây
// Đỉnh độ bật phổ đến sớm hơn tiếng trống thật chừng này (giây) so với giữa cửa sổ (đo bằng bài nhịp chuẩn)
const ONSET_DELAY = 0.009;
// Thời lượng một đợt không có "Tạm dừng" (giống trình phát: 2500 ms × 1,25)
const BURST_MS = 3125;

// ---------------------------------------------------------------------------
// ĐỌC BÀI NHẠC
// ---------------------------------------------------------------------------

function renderOffline(context) {
    return new Promise((resolve, reject) => {
        context.oncomplete = e => resolve(e.renderedBuffer);
        const result = context.startRendering();
        if (result && result.then) result.then(resolve, reject);
    });
}

// Gộp mỗi `factor` mẫu thành một (đã lọc chống răng cưa khi trình duyệt hạ tần số)
function decimate(samples, factor) {
    if (factor === 1) return samples;
    const out = new Float32Array(Math.floor(samples.length / factor));
    for (let i = 0; i < out.length; i++) {
        let sum = 0;
        for (let j = 0; j < factor; j++) sum += samples[i * factor + j];
        out[i] = sum / factor;
    }
    return out;
}

// Một kênh, RATE mẫu/giây
async function decodeMusic(url) {
    const response = await fetch(url);
    if (!response.ok) throw Object.assign(new Error(`HTTP ${response.status}`), { code: 'fetch' });
    const data = await response.arrayBuffer();
    const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const decoded = await new Promise((resolve, reject) => {
        const result = new Offline(1, 1, 44100).decodeAudioData(data, resolve, reject);
        if (result && result.then) result.then(resolve, reject);
    }).catch(() => { throw Object.assign(new Error('decode'), { code: 'decode' }); });

    // Trình duyệt tự trộn về một kênh và hạ tần số; máy nào không cho tần số thấp thì hạ một phần rồi gộp mẫu
    let lastError;
    for (const factor of [1, 2, 4]) {
        try {
            const rate = RATE * factor;
            const context = new Offline(1, Math.max(1, Math.ceil(decoded.duration * rate)), rate);
            const source = context.createBufferSource();
            source.buffer = decoded;
            source.connect(context.destination);
            source.start();
            const rendered = await renderOffline(context);
            return { samples: decimate(rendered.getChannelData(0), factor), duration: decoded.duration };
        } catch (e) {
            lastError = e;
        }
    }
    throw lastError;
}

// ---------------------------------------------------------------------------
// ĐẶC TRƯNG TỪNG KHUNG: độ bật phổ (spectral flux) toàn dải và dải trầm, âm lượng, phổ thô dải giữa
// ---------------------------------------------------------------------------

function createFft(n) {
    const bits = Math.log2(n);
    const reverse = new Uint16Array(n);
    for (let i = 0; i < n; i++) {
        let r = 0;
        for (let b = 0; b < bits; b++) r = (r << 1) | ((i >> b) & 1);
        reverse[i] = r;
    }
    const cos = new Float32Array(n / 2);
    const sin = new Float32Array(n / 2);
    for (let i = 0; i < n / 2; i++) {
        cos[i] = Math.cos(2 * Math.PI * i / n);
        sin[i] = Math.sin(2 * Math.PI * i / n);
    }
    return (re, im) => {
        for (let i = 0; i < n; i++) {
            const j = reverse[i];
            if (j > i) {
                let t = re[i]; re[i] = re[j]; re[j] = t;
                t = im[i]; im[i] = im[j]; im[j] = t;
            }
        }
        for (let size = 2; size <= n; size *= 2) {
            const half = size / 2;
            const step = n / size;
            for (let start = 0; start < n; start += size) {
                for (let j = 0, k = 0; j < half; j++, k += step) {
                    const a = start + j;
                    const b = a + half;
                    const tre = re[b] * cos[k] + im[b] * sin[k];
                    const tim = im[b] * cos[k] - re[b] * sin[k];
                    re[b] = re[a] - tre;
                    im[b] = im[a] - tim;
                    re[a] += tre;
                    im[a] += tim;
                }
            }
        }
    };
}

// Dải giữa chia 12 băng (150 Hz - 3 kHz) để nhận ra chỗ đổi hợp âm (thường là đầu ô nhịp)
const BANDS = 12;

async function extractFeatures(samples, onProgress) {
    const frames = Math.max(0, Math.floor((samples.length - FRAME) / HOP) + 1);
    const flux = new Float32Array(frames);
    const low = new Float32Array(frames);
    const rms = new Float32Array(frames);
    const bands = new Float32Array(frames * BANDS);
    const bins = FRAME / 2;
    const binHz = RATE / FRAME;
    const lowTop = Math.round(200 / binHz);
    const bandOf = new Int8Array(bins).fill(-1);
    for (let k = 1; k < bins; k++) {
        const hz = k * binHz;
        if (hz >= 150 && hz < 3000) bandOf[k] = Math.min(BANDS - 1, Math.floor(Math.log2(hz / 150) / Math.log2(20) * BANDS));
    }
    const hann = new Float32Array(FRAME);
    for (let i = 0; i < FRAME; i++) hann[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / FRAME);
    const fft = createFft(FRAME);
    const re = new Float32Array(FRAME);
    const im = new Float32Array(FRAME);
    let prev = new Float32Array(bins);
    let cur = new Float32Array(bins);

    for (let t = 0; t < frames; t++) {
        const offset = t * HOP;
        let energy = 0;
        for (let i = 0; i < FRAME; i++) {
            const v = samples[offset + i];
            energy += v * v;
            re[i] = v * hann[i];
            im[i] = 0;
        }
        rms[t] = Math.sqrt(energy / FRAME);
        fft(re, im);
        let f = 0;
        let fl = 0;
        for (let k = 1; k < bins; k++) {
            const mag = Math.log1p(100 * Math.sqrt(re[k] * re[k] + im[k] * im[k]));
            cur[k] = mag;
            const rise = mag - prev[k];
            if (rise > 0) {
                f += rise;
                if (k <= lowTop) fl += rise;
            }
            if (bandOf[k] >= 0) bands[t * BANDS + bandOf[k]] += mag;
        }
        if (t > 0) {
            flux[t] = f;
            low[t] = fl;
        }
        const swap = prev;
        prev = cur;
        cur = swap;
        if (t % 1500 === 1499) {
            if (onProgress) onProgress(0.15 + 0.75 * t / frames);
            await new Promise(resolve => setTimeout(resolve));
        }
    }
    return { frames, flux, low, rms, bands };
}

// ---------------------------------------------------------------------------
// NHỊP VÀ PHÁCH
// ---------------------------------------------------------------------------

// Chỉ giữ các cú bật lên so với mức nền xung quanh (~0,5 giây)
function onsetEnvelope(flux) {
    const n = flux.length;
    const half = Math.round(FPS * 0.25);
    const prefix = new Float64Array(n + 1);
    for (let i = 0; i < n; i++) prefix[i + 1] = prefix[i] + flux[i];
    const env = new Float32Array(n);
    for (let t = 0; t < n; t++) {
        const a = Math.max(0, t - half);
        const b = Math.min(n, t + half + 1);
        env[t] = Math.max(0, flux[t] - (prefix[b] - prefix[a]) / (b - a));
    }
    return env;
}

function autocorrelation(values, maxLag) {
    const n = values.length;
    let mean = 0;
    for (let i = 0; i < n; i++) mean += values[i];
    mean /= n || 1;
    const centered = values.map(v => v - mean);
    const result = new Float64Array(maxLag + 1);
    for (let lag = 1; lag <= maxLag; lag++) {
        let sum = 0;
        for (let t = lag; t < n; t++) sum += centered[t] * centered[t - lag];
        result[lag] = sum / (n - lag);
    }
    return result;
}

// Chu kỳ phách (số khung, có phần lẻ): tự tương quan của đường bao, ưu tiên quanh 120 BPM và nhịp đều đặn (gấp đôi cũng khớp)
function estimatePeriod(env) {
    const minLag = Math.floor(FPS * 60 / 200);
    const maxLag = Math.ceil(FPS * 60 / 60);
    const ac = autocorrelation(env, maxLag * 2 + 1);
    const score = new Float64Array(maxLag + 2);
    let best = minLag;
    for (let lag = minLag; lag <= maxLag; lag++) {
        const bpm = 60 * FPS / lag;
        const prior = Math.exp(-0.5 * Math.pow(Math.log2(bpm / 120), 2));
        score[lag] = (ac[lag] + 0.5 * ac[lag * 2]) * prior;
        if (score[lag] > score[best]) best = lag;
    }
    // Nội suy parabol quanh đỉnh để có chu kỳ lẻ khung
    const a = score[best - 1];
    const b = score[best];
    const c = score[best + 1];
    const denom = a - 2 * b + c;
    const shift = best > minLag && best < maxLag && denom < 0 ? Math.max(-0.5, Math.min(0.5, 0.5 * (a - c) / denom)) : 0;
    return best + shift;
}

function median(values) {
    if (!values.length) return 0;
    const sorted = [...values].sort((x, y) => x - y);
    return sorted[Math.floor(sorted.length / 2)];
}

function percentile(values, p) {
    if (!values.length) return 0;
    const sorted = [...values].sort((x, y) => x - y);
    return sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))))];
}

// Dò phách bằng quy hoạch động (Ellis 2007): mỗi phách vừa trúng cú bật mạnh, vừa cách phách trước gần đúng một chu kỳ
function trackBeats(env, period) {
    const n = env.length;
    let sum = 0;
    let sq = 0;
    for (let i = 0; i < n; i++) {
        sum += env[i];
        sq += env[i] * env[i];
    }
    const std = Math.sqrt(Math.max(1e-12, sq / n - (sum / n) * (sum / n)));
    const radius = Math.round(period);
    const sigma = period / 32;
    const kernel = [];
    for (let i = -radius; i <= radius; i++) kernel.push(Math.exp(-0.5 * (i / sigma) * (i / sigma)));
    const local = new Float32Array(n);
    for (let t = 0; t < n; t++) {
        let v = 0;
        for (let i = -radius; i <= radius; i++) {
            const j = t + i;
            if (j >= 0 && j < n) v += env[j] * kernel[i + radius];
        }
        local[t] = v / std;
    }

    const lo = Math.max(1, Math.round(period / 2));
    const hi = Math.round(period * 2);
    const penalty = new Float64Array(hi + 1);
    for (let d = lo; d <= hi; d++) penalty[d] = -100 * Math.pow(Math.log(d / period), 2);
    let maxLocal = 0;
    for (let t = 0; t < n; t++) maxLocal = Math.max(maxLocal, local[t]);
    const threshold = 0.01 * maxLocal;
    const cum = new Float64Array(n);
    const back = new Int32Array(n).fill(-1);
    let started = false;
    for (let t = 0; t < n; t++) {
        let best = -Infinity;
        let from = -1;
        for (let d = lo; d <= hi && t - d >= 0; d++) {
            const v = cum[t - d] + penalty[d];
            if (v > best) {
                best = v;
                from = t - d;
            }
        }
        cum[t] = local[t] + (from >= 0 ? best : 0);
        // Chưa tới cú bật đầu tiên thì không nối chuỗi phách vào khoảng lặng đầu bài
        if (from >= 0 && (started || local[t] >= threshold)) back[t] = from;
        if (local[t] >= threshold) started = true;
    }

    // Phách cuối: đỉnh cục bộ cuối cùng đủ cao của điểm tích lũy
    const peaks = [];
    for (let t = 1; t < n - 1; t++) if (cum[t] > cum[t - 1] && cum[t] >= cum[t + 1]) peaks.push(t);
    const cut = 0.5 * median(peaks.map(t => cum[t]));
    const eligible = peaks.filter(t => cum[t] >= cut);
    let last = eligible.length ? eligible[eligible.length - 1] : n - 1;
    const beats = [];
    for (let t = last; t >= 0; t = back[t]) beats.push(t);
    beats.reverse();

    // Bỏ các phách yếu ở đầu và cuối (khoảng lặng, đoạn nhạc tắt dần)
    const level = 0.5 * Math.sqrt(beats.reduce((s, t) => s + local[t] * local[t], 0) / (beats.length || 1));
    while (beats.length && local[beats[0]] < level) beats.shift();
    while (beats.length && local[beats[beats.length - 1]] < level) beats.pop();
    return beats;
}

// Dò nhầm nửa nhịp hoặc gấp đôi nhịp là lỗi hay gặp: xem lại bằng chính các phách vừa tìm được.
// Giữa hai phách vẫn có cú bật gần mạnh bằng phách (vd. trống snare): nhịp thật nhanh gấp đôi.
// Giữa hai phách trống trơn và các phách mạnh yếu xen kẽ: đang nghe cả nửa phách, nhịp thật chậm một nửa.
function checkTempoOctave(env, period) {
    const beats = trackBeats(env, period);
    if (beats.length < 8) return beats;
    const peak = frame => {
        let max = 0;
        for (let t = Math.round(frame) - 2; t <= Math.round(frame) + 2; t++) if (t >= 0 && t < env.length) max = Math.max(max, env[t]);
        return max;
    };
    const average = values => values.reduce((s, v) => s + v, 0) / (values.length || 1);
    const on = beats.map(peak);
    const between = average(beats.slice(1).map((t, i) => peak((t + beats[i]) / 2))) / (average(on) || 1);
    const even = average(on.filter((_, i) => i % 2 === 0));
    const odd = average(on.filter((_, i) => i % 2 === 1));
    const alternation = Math.min(even, odd) / (Math.max(even, odd) || 1);
    const bpm = 60 * FPS / period;
    if (bpm <= 90 && between >= 0.85) return trackBeats(env, period / 2);
    if (bpm >= 120 && between < 0.35 && alternation < 0.8) return trackBeats(env, period * 2);
    return beats;
}

// Phách (số khung lẻ) chính xác hơn: đỉnh cú bật gần nhất, nội suy parabol
function refineBeat(env, t) {
    let best = t;
    for (let d = -2; d <= 2; d++) {
        const j = t + d;
        if (j > 0 && j < env.length - 1 && env[j] > env[best]) best = j;
    }
    const a = env[best - 1] || 0;
    const b = env[best];
    const c = env[best + 1] || 0;
    const denom = a - 2 * b + c;
    return best + (denom < 0 ? Math.max(-0.5, Math.min(0.5, 0.5 * (a - c) / denom)) : 0);
}

const frameToTime = frame => (frame * HOP + FRAME / 2) / RATE + ONSET_DELAY;

// ---------------------------------------------------------------------------
// PHÂN TÍCH CẢ BÀI
// ---------------------------------------------------------------------------

/**
 * Kết quả: { duration, bpm, beats: [{ time, level (0-1, độ sôi động đoạn đó), strength (0-1, độ mạnh của phách),
 * downbeat (đầu ô nhịp), inBar (0-3), bar, silent (không có nhạc) }], drops: [chỉ số phách nhạc bùng lên],
 * envelope: [âm lượng 0-1 từng khung], envelopeRate (số khung mỗi giây) }
 */
export async function analyzeMusic(url, onProgress) {
    const progress = value => onProgress && onProgress(Math.min(1, value));
    progress(0.02);
    const { samples, duration } = await decodeMusic(url);
    progress(0.15);
    const features = await extractFeatures(samples, onProgress);
    const env = onsetEnvelope(features.flux);
    const period = estimatePeriod(env);
    progress(0.92);
    await new Promise(resolve => setTimeout(resolve));
    const tracked = checkTempoOctave(env, period).map(t => refineBeat(env, t));
    if (tracked.length < 8) throw Object.assign(new Error('no-beat'), { code: 'no-beat' });

    // Chu kỳ phách chính xác (số khung lẻ): đường thẳng khớp nhất qua các phách tìm được
    const meanIndex = (tracked.length - 1) / 2;
    const meanFrame = tracked.reduce((s, t) => s + t, 0) / tracked.length;
    let num = 0;
    let den = 0;
    tracked.forEach((t, i) => {
        num += (i - meanIndex) * (t - meanFrame);
        den += (i - meanIndex) * (i - meanIndex);
    });
    const step = num / den || period;

    // Phủ lưới phách ra cả đoạn đầu và cuối bài (đoạn dạo, đoạn tắt dần) để vẫn đặt được pháo nhẹ ở đó
    const head = [];
    for (let t = tracked[0] - step; t > 0; t -= step) head.unshift(t);
    const tail = [];
    for (let t = tracked[tracked.length - 1] + step; t < features.frames - 1; t += step) tail.push(t);
    const exact = [...head, ...tracked, ...tail];
    const frames = exact.map(Math.round);

    // Mỗi phách: âm lượng, mật độ cú bật và độ mạnh trong khoảng tới phách sau
    const count = frames.length;
    const loud = [];
    const busy = [];
    const hit = [];
    const bass = [];
    for (let i = 0; i < count; i++) {
        const a = frames[i];
        const b = i + 1 < count ? frames[i + 1] : Math.min(features.frames, a + Math.round(step));
        let energy = 0;
        let onsets = 0;
        for (let t = a; t < b; t++) {
            energy += features.rms[t] * features.rms[t];
            onsets += env[t];
        }
        loud.push(10 * Math.log10(energy / Math.max(1, b - a) + 1e-10));
        busy.push(onsets / Math.max(1, b - a));
        let peak = 0;
        let lowPeak = 0;
        for (let t = Math.max(0, a - 2); t <= Math.min(features.frames - 1, a + 2); t++) {
            peak = Math.max(peak, env[t]);
            lowPeak = Math.max(lowPeak, features.low[t]);
        }
        hit.push(peak);
        bass.push(lowPeak);
    }
    const normalize = (values, lowP, highP) => {
        const lo = percentile(values, lowP);
        const hi = percentile(values, highP);
        return values.map(v => Math.max(0, Math.min(1, (v - lo) / Math.max(1e-9, hi - lo))));
    };
    // Phách im lặng (nhạc đã tắt hoặc chưa vào): nhỏ hơn mức giữa của bài từ 30 dB trở xuống
    const silentBelow = percentile(loud, 0.5) - 30;
    const loudN = normalize(loud, 0.1, 0.95);
    const busyN = normalize(busy, 0.1, 0.95);
    const strength = normalize(hit, 0, 0.95);
    const raw = loudN.map((v, i) => 0.65 * v + 0.35 * busyN[i]);
    // Độ sôi động: làm mượt qua khoảng hai ô nhịp
    const level = raw.map((_, i) => {
        let sum = 0;
        let weight = 0;
        for (let d = -4; d <= 4; d++) {
            const j = i + d;
            if (j < 0 || j >= count) continue;
            const w = 5 - Math.abs(d);
            sum += raw[j] * w;
            weight += w;
        }
        return sum / weight;
    });

    // Phách đầu ô nhịp (nhịp 4/4): vị trí có trống trầm mạnh và hay đổi hợp âm nhất
    const change = frames.map((t, i) => {
        if (i === 0 || i + 1 >= count) return 0;
        let diff = 0;
        for (let k = 0; k < BANDS; k++) {
            let before = 0;
            let after = 0;
            for (let f = frames[i - 1]; f < t; f++) before += features.bands[f * BANDS + k];
            for (let f = t; f < frames[i + 1]; f++) after += features.bands[f * BANDS + k];
            diff += Math.abs(after / Math.max(1, frames[i + 1] - t) - before / Math.max(1, t - frames[i - 1]));
        }
        return diff;
    });
    const bassN = normalize(bass, 0, 0.95);
    const changeN = normalize(change, 0, 0.95);
    const phaseScore = [0, 1, 2, 3].map(phase => {
        let sum = 0;
        let n = 0;
        for (let i = phase; i < count; i += 4) {
            sum += bassN[i] + 0.5 * strength[i] + changeN[i];
            n++;
        }
        return n ? sum / n : 0;
    });
    const phase = phaseScore.indexOf(Math.max(...phaseScore));

    // Chỗ nhạc bùng lên: 8 phách sau sôi động hơn hẳn 8 phách trước
    const rise = raw.map((_, i) => {
        if (i < 8 || i + 8 > count) return 0;
        const before = raw.slice(i - 8, i).reduce((s, v) => s + v, 0) / 8;
        const after = raw.slice(i, i + 8).reduce((s, v) => s + v, 0) / 8;
        return after >= 0.55 ? after - before : 0;
    });
    const drops = [];
    rise.forEach((value, i) => {
        if (value < 0.22) return;
        // Đỉnh trong khoảng ±4 phách, cách chỗ bùng lên trước ít nhất 16 phách
        for (let d = -4; d <= 4; d++) if (rise[i + d] > value) return;
        // Nhạc thường bùng lên ở phách đầu ô nhịp: lấy phách đầu ô nhịp gần nhất
        const at = [0, -1, 1, -2, 2].map(d => i + d).find(j => j >= 0 && j < count && (j - phase) % 4 === 0) ?? i;
        if (drops.length && at - drops[drops.length - 1] < 16) return;
        drops.push(at);
    });

    // Hình sóng cho dòng thời gian theo giây: âm lượng từng khung, chuẩn hóa theo đỉnh (căn bậc hai cho dễ nhìn)
    let peakRms = 0;
    for (let t = 0; t < features.frames; t++) peakRms = Math.max(peakRms, features.rms[t]);
    const envelope = Array.from(features.rms, v => Math.round(Math.sqrt(v / (peakRms || 1)) * 1000) / 1000);

    const beatPeriod = step / FPS;
    progress(1);
    return {
        duration,
        envelope,
        envelopeRate: FPS,
        bpm: Math.round(600 / beatPeriod) / 10,
        beats: exact.map((frame, i) => ({
            time: Math.max(0, frameToTime(frame)),
            level: level[i],
            strength: strength[i],
            downbeat: (i - phase) % 4 === 0,
            inBar: (i - phase + 4) % 4,
            // Các phách trước phách đầu ô nhịp đầu tiên tính là ô nhịp 0
            bar: Math.floor((i - phase + 4) / 4),
            silent: loud[i] < silentBelow
        })),
        drops
    };
}

// ---------------------------------------------------------------------------
// XẾP PHÁO
// ---------------------------------------------------------------------------

const PALETTES = [['Gold', 'Red'], ['Blue', 'Purple'], ['Green', 'Gold'], ['Purple', 'Red'], ['White', 'Blue'], ['Red', 'Gold']];
// Vị trí ngang lần lượt, để pháo trải đều bầu trời
const SPOTS = [50, 30, 70, 40, 60, 22, 78, 35, 65];
const SOFT = ['Liễu', 'Hoa cúc', 'Cháy lâu', 'Nhấp nháy', 'Liễu', 'Vòng nhẫn'];
const MEDIUM = ['Hoa cúc', 'Vòng nhẫn', 'Cây cọ', 'Nổ chéo', 'Hoa cúc', 'Xoắn ốc'];
const STRONG = ['Hoa cúc', 'Nổ chéo', 'Nổ lách tách', 'Cây cọ', 'Xoay vòng', 'Hoa cúc', 'Nổ nhiều lần'];
export const BEAT_DENSITIES = { low: 0.7, medium: 1, high: 1.35 };
// Builder cho tối đa 500 phát mỗi kịch bản; chừa chỗ cho "Tạm dừng"
const MAX_SHOTS = 480;
// Giữ lại từ kịch bản cũ: chữ, ảnh trên trời và lời nhắn
export const KEEP_SHELLS = ['Văn bản', 'Hình ảnh', 'Lời nhắn'];

const round = (value, digits = 1) => Math.round(value * 10 ** digits) / 10 ** digits;

/**
 * Kịch bản từ kết quả analyzeMusic().
 * start: giây bắt đầu phát nhạc; length: số giây bắn (Infinity = hết bài); density: 'low' | 'medium' | 'high';
 * keep: các phát giữ lại (chữ, ảnh, lời nhắn), đặt lần lượt vào các phách đầu ô nhịp trải đều.
 * Trả về { events, shots }: events dùng cho music.sync (đợt + "trễ" là lúc nổ tính từ đầu bài nhạc đã chọn).
 */
export function buildBeatShow(analysis, { start = 0, length = Infinity, density = 'medium', keep = [] } = {}) {
    const factor = BEAT_DENSITIES[density] || 1;
    const end = start + length;
    const indexed = analysis.beats.map((beat, index) => ({ ...beat, index }));
    const beats = indexed.filter(b => b.time >= start - 0.02 && b.time <= end && !b.silent);
    if (beats.length < 8) throw Object.assign(new Error('too-short'), { code: 'too-short' });
    const period = median(beats.slice(1).map((b, i) => b.time - beats[i].time));
    const drops = new Set(analysis.drops);

    // Đoạn kết: phách đầu ô nhịp cuối cùng còn đủ sôi động
    const downbeats = beats.filter(b => b.downbeat);
    const finale = [...downbeats].reverse().find(b => b.level >= 0.25) || downbeats[downbeats.length - 1] || beats[beats.length - 1];

    const shots = [];
    let spot = 0;
    let pick = 0;
    let palette = 0;
    let barsInPalette = 0;
    const nextX = () => SPOTS[spot++ % SPOTS.length];
    const fromPool = pool => pool[pick++ % pool.length];
    // priority: thứ tự giữ lại khi phải lược bớt (cao giữ trước)
    let priority = 0;
    const add = (time, shot) => shots.push({ time, priority, ...shot });

    for (let i = 0; i < beats.length; i++) {
        const beat = beats[i];
        if (beat.time > finale.time) break;
        const time = beat.time;
        const intensity = Math.min(1, beat.level * factor);
        if (beat.downbeat && ++barsInPalette > 8) {
            palette++;
            barsInPalette = 1;
        }

        priority = beat === finale || drops.has(beat.index) ? 5 : beat.downbeat ? 4 : beat.inBar === 2 ? 2 : 1;
        if (beat === finale) {
            // Kết: ba phát cháy lâu vàng lơ lửng giữa trời, lách tách hai bên
            [[30, 62], [50, 72], [70, 62]].forEach(([x, y]) => add(time, { shell: 'Cháy lâu', x, y, size: 1.3, color: 'Gold' }));
            add(time, { shell: 'Nổ lách tách', x: 15, y: 48, size: 1, color: 'Gold' });
            add(time, { shell: 'Nổ lách tách', x: 85, y: 48, size: 1, color: 'Gold' });
            break;
        }

        if (drops.has(beat.index)) {
            // Nhạc bùng lên: đổi màu và nổ cả chùm cùng lúc
            palette++;
            barsInPalette = 0;
            const colors = PALETTES[palette % PALETTES.length];
            add(time, { shell: 'Nổ nhiều lần', x: 50, y: 72, size: 1.6, color: colors[0], launchStyle: 'spiral' });
            [[18, 52], [34, 62], [66, 62], [82, 52]].forEach(([x, y], k) => add(time, {
                shell: 'Hoa cúc', x, y, size: 1.15, color: colors[k % 2], streamers: k % 2 === 0
            }));
            continue;
        }

        const colors = PALETTES[palette % PALETTES.length];
        const accent = beat.strength > 0.85 && intensity > 0.45;
        if (beat.downbeat) {
            // Đoạn rất êm: hai ô nhịp một phát
            if (intensity < 0.15 && beat.bar % 2 !== 0) continue;
            const pool = intensity < 0.3 ? SOFT : intensity < 0.65 ? MEDIUM : STRONG;
            const x = nextX();
            add(time, {
                shell: fromPool(pool), x, y: Math.round(55 + intensity * 15 + (x % 3) * 2), size: round(0.9 + intensity * 0.5),
                color: colors[beat.bar % 2],
                // Đoạn êm thỉnh thoảng dùng đạn tàng hình: pháo bất ngờ nở đúng nhịp
                launchStyle: intensity < 0.3 && beat.bar % 4 === 2 ? 'stealth' : undefined,
                burstSound: intensity < 0.3 ? 'burstSoft' : undefined
            });
            if (intensity > 0.8 || accent) {
                priority = 3;
                add(time, { shell: 'Hoa cúc', x: x < 50 ? 82 : 18, y: 50, size: 1, color: colors[(beat.bar + 1) % 2] });
            }
        } else if (beat.inBar === 2) {
            if (intensity <= 0.3 && !accent) continue;
            add(time, {
                shell: fromPool(intensity > 0.65 ? STRONG : MEDIUM), x: nextX(), y: Math.round(50 + intensity * 12),
                size: round(0.8 + intensity * 0.35), color: colors[(beat.bar + 1) % 2]
            });
        } else if (intensity > 0.6 || accent) {
            // Phách 2 và 4: phát nhỏ hai bên
            const x = beat.inBar === 1 ? 20 + (beat.bar % 3) * 6 : 80 - (beat.bar % 3) * 6;
            add(time, {
                shell: intensity > 0.85 ? 'Nổ lách tách' : 'Hoa cúc', x, y: Math.round(44 + intensity * 10), size: 0.75,
                color: colors[beat.inBar === 1 ? 0 : 1], burstSound: 'burstSmall'
            });
            if (factor > 1.2 && intensity > 0.85) {
                add(time, { shell: 'Hoa cúc', x: 100 - x, y: Math.round(44 + intensity * 10), size: 0.75, color: colors[1], burstSound: 'burstSmall' });
            }
        }

        // "Dày" và đoạn rất sôi động: thêm phát nhỏ giữa hai phách
        const next = beats[i + 1];
        if (factor > 1.2 && intensity > 0.9 && next && next.time <= finale.time) {
            priority = 0;
            add((time + next.time) / 2, {
                shell: 'Nhấp nháy', x: 30 + (i % 5) * 10, y: 40, size: 0.6, color: 'White', burstSound: 'burstSmall'
            });
        }
    }

    // Chữ, ảnh, lời nhắn giữ lại: đặt vào các phách đầu ô nhịp trải đều; chữ và ảnh cần bầu trời thoáng để dễ nhìn
    if (keep.length) {
        const barTime = period * 4;
        let slots = downbeats.filter(b => b.level >= 0.25 && !drops.has(b.index)
            && b.time > start + 2 * barTime && b.time < finale.time - barTime);
        if (!slots.length) slots = downbeats.filter(b => b.time < finale.time);
        if (!slots.length) slots = [beats[0]];
        keep.forEach((event, k) => {
            const slot = slots[Math.min(slots.length - 1, Math.floor((k + 0.5) * slots.length / keep.length))];
            if (event.shell !== 'Lời nhắn') {
                for (let j = shots.length - 1; j >= 0; j--) {
                    const s = shots[j];
                    if (!s.keep && s.time > slot.time - period * 1.1 && s.time < slot.time + period * 2.1) shots.splice(j, 1);
                }
            }
            shots.push({ ...event, time: slot.time, keep: true, priority: 6 });
        });
    }

    shots.sort((a, b) => a.time - b.time);
    thinOut(shots, MAX_SHOTS);
    return { events: toBurstEvents(shots, start), shots: shots.filter(s => s.shell !== 'Lời nhắn').length };
}

// Quá nhiều phát (bài dài, chọn "Dày"): bỏ bớt các phát ít quan trọng nhất, rải đều suốt bài
function thinOut(shots, max) {
    for (let priority = 0; shots.length > max && priority < 5; priority++) {
        const group = shots.filter(s => s.priority === priority);
        const excess = shots.length - max;
        const drop = new Set(excess >= group.length
            ? group
            : Array.from({ length: excess }, (_, k) => group[Math.floor((k + 0.5) * group.length / excess)]));
        for (let i = shots.length - 1; i >= 0; i--) if (drop.has(shots[i])) shots.splice(i, 1);
    }
}

// Thời điểm nổ (giây trong bài) -> đợt + "trễ" (ms tính từ đầu đợt). Mỗi đợt dài 3,125 giây; khoảng trống dài
// thì kéo dài đợt trước bằng "Tạm dừng" để không có đợt trống (đợt trống trình phát chỉ chờ 1,25 giây).
function toBurstEvents(shots, start) {
    const events = [];
    let burst = 1;
    let burstStart = 0;
    let burstHasEvents = false;
    shots.forEach(({ time, keep, priority, ...shot }) => {
        const at = Math.max(0, (time - start) * 1000);
        if (at >= burstStart + BURST_MS) {
            if (burstHasEvents && at < burstStart + 2 * BURST_MS) {
                burstStart += BURST_MS;
            } else {
                const pause = Math.round((at - burstStart) / 1.25 - 2500);
                events.push({ burst, shell: 'Tạm dừng', duration: pause });
                burstStart += (2500 + pause) * 1.25;
            }
            burst++;
        }
        burstHasEvents = true;
        const event = { ...shot, burst, delay: Math.max(0, Math.round(at - burstStart)) };
        Object.keys(event).forEach(key => event[key] === undefined && delete event[key]);
        events.push(event);
    });
    return events;
}
