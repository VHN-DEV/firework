/*!
 * Trình diễn Pháo hoa – trình phát: âm thanh thiên nhiên
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Âm thanh thiên nhiên của cảnh. Tiếng nền (nước, gió lá, dế, ếch nhái xa, mưa) lặp liên tục; đổi cảnh thì tiếng cũ nhỏ
// dần, tiếng mới to dần. Tiếng sự việc do cảnh vật báo (ếch kêu, cá quẫy, vịt kêu, cò cất cánh...) phát đúng chỗ: trái
// phải theo vị trí, ở xa thì nhỏ và trầm hơn. Mọi tiếng tổng hợp sẵn (renderer.js, sounds/), không cần file âm thanh.
// Lúc dựng video thì không phát ra loa mà ghi vào soundManager.capture để trộn cùng tiếng pháo (recorder.js).

import { soundManager } from '../audio.js';
import { canPlaySound, simSpeed } from '../state.js';
import { now } from '../clock.js';
import { RATE } from './dsp.js';
import { ambienceLayers, eventSound, eventSounds } from './scene.js';
import { renderInBackground } from './renderer.js';

// Độ to chung so với tiếng pháo; có nhạc nền thì nhỏ bớt cho nghe rõ nhạc
const MASTER = 0.5;
const MUSIC_DUCK = 0.6;
// Tiếng nền to dần, nhỏ dần (giây)
const FADE_IN = 2.5;
const FADE_OUT = 1.5;
// Hai đoạn lặp của một lớp tiếng nền: một lệch trái, một lệch phải
const LAYER_PAN = [-0.6, 0.6];
// Số tiếng sự việc phát cùng lúc tối đa
const MAX_VOICES = 12;
// Giữ tối đa bấy nhiêu tiếng đã dựng (builder đổi cảnh nhiều lần), riêng đoạn lặp tiếng nền (~1,5 MB mỗi đoạn) ít hơn:
// bỏ tiếng lâu không dùng trước
const MAX_BUFFERS = 120;
const MAX_LOOPS = 16;

const bufferKey = (id, params, part) => `${id}|${JSON.stringify(params)}|${part}`;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const NatureSound = {
    ctx: soundManager.ctx,
    bus: null,
    // Tiếng đã dựng: khóa -> { buffer (AudioBuffer; null khi đang dựng), promise }
    buffers: new Map(),
    // Lớp tiếng nền đang phát: khóa lớp -> { gain, sources }
    layers: new Map(),
    // Đang dựng video: khóa lớp -> các mục đã ghi vào capture
    captured: new Map(),
    captureRef: null,
    scene: null,
    targets: [],
    dirty: false,
    voices: 0,
    last: {},

    level(scene) {
        return scene.volume * MASTER * (scene.music ? MUSIC_DUCK : 1);
    },

    get(id, params, part, loop = false) {
        const key = bufferKey(id, params, part);
        let entry = this.buffers.get(key);
        if (entry) {
            this.buffers.delete(key);
            this.buffers.set(key, entry);
            return entry;
        }
        entry = { buffer: null, loop };
        entry.promise = renderInBackground({ id, params, part }).then(data => {
            const buffer = this.ctx.createBuffer(1, data.length, RATE);
            buffer.getChannelData(0).set(data);
            entry.buffer = buffer;
            this.dirty = true;
            return buffer;
        }).catch(e => {
            console.warn('[Firework] Không dựng được tiếng', id, e);
            return null;
        });
        this.buffers.set(key, entry);
        this.trim();
        return entry;
    },

    trim() {
        const loops = [...this.buffers].filter(([, entry]) => entry.loop);
        loops.slice(0, Math.max(0, loops.length - MAX_LOOPS)).forEach(([key]) => this.buffers.delete(key));
        while (this.buffers.size > MAX_BUFFERS) this.buffers.delete(this.buffers.keys().next().value);
    },

    // Dựng sẵn mọi tiếng cảnh này cần: tiếng ngắn trước (nhẹ, sinh vật có tiếng ngay), tiếng nền sau
    prepare(scene) {
        const jobs = [];
        eventSounds(scene).forEach(({ id, params, variants }) => {
            for (let v = 0; v < variants; v++) jobs.push(this.get(id, params, v).promise);
        });
        ambienceLayers(scene).forEach(layer => LAYER_PAN.forEach((pan, part) => jobs.push(this.get(layer.id, layer.params, part, true).promise)));
        return Promise.all(jobs);
    },

    // Gọi mỗi khung hình với cảnh hiện tại (cùng cảnh thì gần như không tốn gì)
    update(scene) {
        if (scene !== this.scene) {
            const changed = !this.scene || this.scene.key !== scene.key;
            this.scene = scene;
            if (changed) {
                this.targets = ambienceLayers(scene);
                this.prepare(scene);
                this.dirty = true;
            }
        }
        const capture = soundManager.capture;
        if (capture !== this.captureRef) {
            this.captureRef = capture;
            this.captured = new Map();
            this.dirty = true;
        }
        if (!this.dirty) return;
        this.dirty = false;
        if (capture) this.syncCapture(capture);
        else this.syncLive();
    },

    connectPanned(node, pan, destination) {
        if (!this.ctx.createStereoPanner) {
            node.connect(destination);
            return;
        }
        const panner = this.ctx.createStereoPanner();
        panner.pan.value = pan;
        node.connect(panner);
        panner.connect(destination);
    },

    syncLive() {
        const ctx = this.ctx;
        if (!this.bus) {
            this.bus = ctx.createGain();
            this.bus.connect(ctx.destination);
        }
        this.bus.gain.setTargetAtTime(this.scene && !document.hidden ? this.level(this.scene) : 0, ctx.currentTime, 0.3);
        const wanted = new Set(this.targets.map(layer => layer.key));
        [...this.layers.keys()].forEach(key => {
            if (!wanted.has(key)) this.stopLayer(key);
        });
        this.targets.forEach(layer => {
            if (this.layers.has(layer.key)) return;
            const buffers = LAYER_PAN.map((pan, part) => this.get(layer.id, layer.params, part, true).buffer);
            if (buffers.every(Boolean)) this.startLayer(layer, buffers);
        });
    },

    startLayer(layer, buffers) {
        const ctx = this.ctx;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.setTargetAtTime(layer.gain, ctx.currentTime, FADE_IN / 3);
        gain.connect(this.bus);
        const sources = buffers.map((buffer, i) => {
            const source = ctx.createBufferSource();
            source.buffer = buffer;
            source.loop = true;
            this.connectPanned(source, LAYER_PAN[i], gain);
            // Mỗi lần nghe bắt đầu ở một chỗ khác trong vòng lặp
            source.start(ctx.currentTime, Math.random() * buffer.duration);
            return source;
        });
        sources[0].onended = () => gain.disconnect();
        this.layers.set(layer.key, { gain, sources });
    },

    stopLayer(key) {
        const layer = this.layers.get(key);
        this.layers.delete(key);
        const t = this.ctx.currentTime;
        layer.gain.gain.setTargetAtTime(0, t, FADE_OUT / 3);
        layer.sources.forEach(source => source.stop(t + FADE_OUT * 2));
    },

    // Dựng video: tiếng nền ghi một lần lúc bắt đầu (lặp tới hết video), lớp nào thôi phát thì ghi lúc dừng
    syncCapture(capture) {
        [...this.layers.keys()].forEach(key => this.stopLayer(key));
        const t = now();
        const level = this.scene ? this.level(this.scene) : 0;
        const wanted = new Set(this.targets.map(layer => layer.key));
        this.captured.forEach((entries, key) => {
            if (wanted.has(key)) return;
            entries.forEach(entry => { entry.until = t; });
            this.captured.delete(key);
        });
        this.targets.forEach(layer => {
            if (this.captured.has(layer.key)) return;
            const buffers = LAYER_PAN.map((pan, part) => this.get(layer.id, layer.params, part, true).buffer);
            if (!buffers.every(Boolean)) return;
            const entries = buffers.map((buffer, i) => ({
                at: t, buffer, rate: 1, gain: layer.gain * level, pan: LAYER_PAN[i], loop: true, fade: FADE_IN, bus: 'nature'
            }));
            entries.forEach(entry => capture.push(entry));
            this.captured.set(layer.key, entries);
        });
    },

    // Sự việc của cảnh vật (u: 0-1 theo bề ngang; d: độ xa, 0 xa - 1 gần; extra: xem scene.js eventSound, thêm delay (ms))
    event(name, u, d, extra) {
        const scene = this.scene;
        if (!scene || !scene.on) return;
        const capture = soundManager.capture;
        if (!capture && (!canPlaySound() || simSpeed < 0.95)) return;
        const sound = eventSound(name, extra);
        if (!sound || scene.off.has(sound.group)) return;
        const t = now();
        if (sound.gap && t - (this.last[name] ?? -Infinity) < sound.gap) return;
        const entry = this.get(sound.id, sound.params, sound.variant);
        if (!entry.buffer) return;
        this.last[name] = t;
        const near = clamp(Number(d) || 0, 0, 1);
        const gain = sound.gain * (0.25 + 0.75 * Math.pow(near, 1.2));
        const pan = clamp(((Number.isFinite(u) ? u : 0.5) * 2 - 1) * 0.85, -0.95, 0.95);
        const lowpass = 2000 + 14000 * near * near;
        const rate = 0.96 + Math.random() * 0.08;
        // Trễ một chút cho khớp hình (ếch: to nhất lúc túi kêu căng nhất)
        const delay = Math.max(0, Number(extra && extra.delay) || 0);
        if (capture) {
            capture.push({ at: t + delay, buffer: entry.buffer, rate, gain: gain * this.level(scene), pan, lowpass, bus: 'nature' });
            return;
        }
        if (this.voices >= MAX_VOICES || !this.bus) return;
        const ctx = this.ctx;
        const source = ctx.createBufferSource();
        source.buffer = entry.buffer;
        source.playbackRate.value = rate;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = lowpass;
        const amp = ctx.createGain();
        amp.gain.value = gain;
        source.connect(filter);
        this.connectPanned(filter, pan, amp);
        amp.connect(this.bus);
        this.voices++;
        source.onended = () => {
            this.voices--;
            amp.disconnect();
        };
        source.start(ctx.currentTime + delay / 1000);
    }
};

// Chuyển sang tab, ứng dụng khác thì pháo đứng lại, nhạc dừng: tiếng thiên nhiên cũng nhỏ dần rồi im, quay lại thì to lại
document.addEventListener('visibilitychange', () => {
    if (!NatureSound.bus) return;
    const level = NatureSound.scene && !document.hidden ? NatureSound.level(NatureSound.scene) : 0;
    NatureSound.bus.gain.setTargetAtTime(level, NatureSound.ctx.currentTime, 0.15);
});
