/*!
 * Trình diễn Pháo hoa – trình phát: âm thanh và nhạc nền
 * Phần bổ sung và chỉnh sửa © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Tiếng pháo (soundManager: chỉ tải nhóm âm thanh kịch bản dùng tới), tiếng mở hộp quà, nhạc nền (musicPlayer: phát từ
// giây đã chọn cùng đợt pháo đầu, nhỏ dần khi hết, báo vị trí đang phát cho kịch bản khớp nhịp).

import MyMath from '../MyMath.js';
import { canPlaySound, simSpeed } from './state.js';
import { IS_PREVIEW } from './env.js';
import { normalizeAssetPath } from './utils.js';

// Lấy URL thật của các file âm thanh từ Vite: đúng cả khi chạy dev (src/assets/audio) lẫn bản build (assets/audio)
const AUDIO_URLS = import.meta.glob('../../audio/**/*.mp3', { eager: true, query: '?url', import: 'default' });

export const soundManager = {
    baseURL: '../../audio/',
    ctx: new (window.AudioContext || window.webkitAudioContext),
    sources: {
        // === Âm thanh phóng ===
        lift: {
            label: 'Phóng – Mặc định',
            volume: 1,
            playbackRateMin: 0.85,
            playbackRateMax: 0.95,
            fileNames: ['lift/lift1.mp3', 'lift/lift2.mp3', 'lift/lift3.mp3']
        },
        liftDeep: {
            label: 'Phóng – Trầm',
            volume: 1.1,
            playbackRateMin: 0.55,
            playbackRateMax: 0.65,
            fileNames: ['lift/lift1.mp3', 'lift/lift2.mp3']
        },
        liftSharp: {
            label: 'Phóng – Sắc',
            volume: 0.9,
            playbackRateMin: 1.35,
            playbackRateMax: 1.55,
            fileNames: ['lift/lift2.mp3', 'lift/lift3.mp3']
        },
        liftSoft: {
            label: 'Phóng – Mềm',
            volume: 0.5,
            playbackRateMin: 0.75,
            playbackRateMax: 0.85,
            fileNames: ['lift/lift3.mp3']
        },
        // === Âm thanh nổ ===
        burst: {
            label: 'Nổ – Mạnh',
            volume: 1,
            playbackRateMin: 0.8,
            playbackRateMax: 0.9,
            fileNames: ['burst/burst1.mp3', 'burst/burst2.mp3']
        },
        burstDeep: {
            label: 'Nổ – Trầm vũ',
            volume: 1.2,
            playbackRateMin: 0.45,
            playbackRateMax: 0.55,
            fileNames: ['burst/burst1.mp3', 'burst/burst2.mp3']
        },
        burstSoft: {
            label: 'Nổ – Nhẹ nhàng',
            volume: 0.35,
            playbackRateMin: 0.9,
            playbackRateMax: 1.1,
            fileNames: ['burst/burst-sm-1.mp3', 'burst/burst-sm-2.mp3']
        },
        burstSmall: {
            label: 'Nổ – Nhỏ',
            volume: 0.25,
            playbackRateMin: 0.8,
            playbackRateMax: 1,
            fileNames: ['burst/burst-sm-1.mp3', 'burst/burst-sm-2.mp3']
        },
        burstWhoosh: {
            label: 'Nổ – Vút',
            volume: 0.8,
            playbackRateMin: 1.5,
            playbackRateMax: 1.8,
            fileNames: ['burst/burst1.mp3']
        },
        // === Tiếng lach tách ===
        crackle: {
            label: 'Lách tách – To',
            volume: 0.2,
            playbackRateMin: 1,
            playbackRateMax: 1,
            fileNames: ['burst/crackle1.mp3']
        },
        crackleHeavy: {
            label: 'Lách tách – Dồn dập',
            volume: 0.45,
            playbackRateMin: 0.7,
            playbackRateMax: 0.8,
            fileNames: ['burst/crackle1.mp3']
        },
        crackleSmall: {
            label: 'Lách tách – Nhỏ',
            volume: 0.3,
            playbackRateMin: 1,
            playbackRateMax: 1,
            fileNames: ['burst/crackle-sm-1.mp3']
        },
        crackleFirecracker: {
            label: 'Lách tách – Pháo thật',
            volume: 0.6,
            playbackRateMin: 0.9,
            playbackRateMax: 1.0,
            fileNames: ['burst/crackle-heavy-1.mp3']
        },
        crackleBang: {
            label: 'Nổ – Tiếng bụp',
            volume: 0.8,
            playbackRateMin: 0.85,
            playbackRateMax: 1.15,
            fileNames: ['burst/crackle-bang-1.mp3']
        },
        // === Âm thanh phóng thật (từ BigSoundBank CC) ===
        liftWick: {
            label: 'Phóng – Ngòi pháo thật',
            volume: 0.85,
            playbackRateMin: 0.9,
            playbackRateMax: 1.1,
            fileNames: ['lift/lift-wick-1.mp3', 'lift/lift-wick-2.mp3', 'lift/lift-wick-3.mp3', 'lift/lift-wick-4.mp3']
        },
        // === Âm thanh bay (Whistle) ===
        whistle: {
            label: 'Bay – Víuuuu classic',
            volume: 0.6,
            playbackRateMin: 0.9,
            playbackRateMax: 1.1,
            fileNames: ['whistle/firework-whistle.mp3']
        },
        whistleHigh: {
            label: 'Bay – Víuuuu cao',
            volume: 0.6,
            playbackRateMin: 1.3,
            playbackRateMax: 1.6,
            fileNames: ['whistle/tiny_rocketwav.mp3']
        },
        whistleSwish: {
            label: 'Bay – Víuuuu rơi',
            volume: 0.7,
            playbackRateMin: 0.8,
            playbackRateMax: 1.0,
            fileNames: ['whistle/falling-whistle-swish.mp3']
        },
        // === Âm thanh mới từ Pixabay ===
        liftWhoosh: {
            label: 'Phóng – Vút mạnh',
            volume: 0.8,
            playbackRateMin: 0.9,
            playbackRateMax: 1.1,
            fileNames: ['lift/lift-whoosh-4.mp3', 'lift/lift-whoosh-2.mp3']
        },
        whistleRocket: {
            label: 'Bay – Tên lửa vút',
            volume: 0.7,
            playbackRateMin: 0.9,
            playbackRateMax: 1.1,
            fileNames: ['whistle/firework-whistle.mp3', 'whistle/whistling-rocket.mp3', 'whistle/tiny_rocketwav.mp3']
        },
        burstOut: {
            label: 'Nổ – Tỏa rộng',
            volume: 0.9,
            playbackRateMin: 0.8,
            playbackRateMax: 1.0,
            fileNames: ['burst/burst-out.mp3']
        }
    },

    // Bộ nhớ đệm theo file: nhiều loại âm thanh dùng chung file (vd. lift1.mp3) chỉ tải và giải mã một lần
    _fileBuffers: new Map(),

    _loadFile(fileName) {
        if (!this._fileBuffers.has(fileName)) {
            const filePath = AUDIO_URLS[this.baseURL + fileName];
            const promise = fetch(filePath)
                .then(response => {
                    if (response.status < 200 || response.status >= 300) throw new Error(response.statusText);
                    return response.arrayBuffer();
                })
                .then(data => new Promise(resolve => {
                    const decodePromise = this.ctx.decodeAudioData(data, resolve, () => resolve(null));
                    // Chặn lỗi "Uncaught (in promise)" trên trình duyệt mới
                    if (decodePromise && typeof decodePromise.catch === 'function') decodePromise.catch(() => {});
                }))
                .catch(() => null);
            this._fileBuffers.set(fileName, promise);
        }
        return this._fileBuffers.get(fileName);
    },

    // Tải các loại âm thanh `types` (mặc định: tất cả). Trả về promise xong khi mọi loại đã sẵn sàng.
    preload(types = Object.keys(this.sources)) {
        return Promise.all(types.map(type => {
            const source = this.sources[type];
            if (!source) return null;
            if (!source.loading) {
                source.loading = Promise.all(source.fileNames.map(fileName => this._loadFile(fileName)))
                    .then(buffers => {
                        source.buffers = buffers.filter(b => b !== null);
                    });
            }
            return source.loading;
        }));
    },

    pauseAll() {
        this.ctx.suspend();
    },

    resumeAll() {
        // Phát âm thanh không có âm lượng cho iOS. Điều này 'mở khóa' bối cảnh âm thanh khi người dùng bật âm thanh lần đầu tiên.
        this.playSound('lift', 0);
        // Chrome dành cho thiết bị di động yêu cầu tương tác trước khi bắt đầu ngữ cảnh âm thanh.
        // Nút chuyển đổi âm thanh được kích hoạt khi 'chạm khởi động', nút này dường như không được tính là đầy đủ
        // tương tác với Chrome. Tôi đoán nó cần một cú nhấp chuột? Dù sao đi nữa, nếu điều đầu tiên người dùng làm
        // bật âm thanh thì nó không hoạt động. Việc sử dụng setTimeout cho phép đăng ký tương tác đầu tiên.
        // Có lẽ giải pháp tốt hơn là theo dõi xem người dùng đã tương tác hay chưa và nếu chưa thì họ hãy thử bật
        // âm thanh, hiển thị chú giải công cụ mà họ nên nhấn lại để bật âm thanh.
        setTimeout(() => {
            this.ctx.resume();
        }, 250);
    },

    // Sở hữu tư nhân dùng để điều tiết những âm thanh bùng nổ nhỏ.
    _lastSmallBurstTime: 0,

    /**
     * Play a sound of `type`. Will randomly pick a file associated with type, and play it at the specified volume
     * and play speed, with a bit of random variance in play speed. This is all based on `sources` config.
     *
     * @param  {string} type - The type of sound to play.
     * @param  {?number} scale=1 - Value between 0 and 1 (values outside range will be clamped). Scales less than one
     *                             descrease volume and increase playback speed. This is because large explosions are
     *                             louder, deeper, and reverberate longer than small explosions.
     *                             Note that a scale of 0 will mute the sound.
     */
    playSound(type, scale = 1) {
        // Đảm bảo `scale` nằm trong phạm vi hợp lệ (NaN sẽ khiến gain.value ném lỗi).
        scale = Number.isFinite(scale) ? MyMath.clamp(scale, 0, 1) : 1;

        // Không cho phép bắt đầu âm thanh mới nếu âm thanh bị tắt, ứng dụng đang chạy ở chế độ chuyển động chậm hoặc bị tạm dừng.
        // Kiểm tra chuyển động chậm có một số khoảng trống trong trường hợp người dùng không kéo xong thanh tốc độ
        // *tất cả* đường về.
        if (!canPlaySound() || simSpeed < 0.95) {
            return;
        }

        // Van tiết lưu nổ nhỏ, vì vỏ hoa/lá rụng có rất nhiều.
        if (type === 'burstSmall') {
            const now = Date.now();
            if (now - this._lastSmallBurstTime < 20) {
                return;
            }
            this._lastSmallBurstTime = now;
        }

        const source = this.sources[type];

        // Tên âm thanh lạ trong kịch bản, hoặc file chưa tải xong/tải lỗi: bỏ qua thay vì làm hỏng khung hình.
        // Loại chưa tải (không có trong kịch bản lúc mở) thì tải ngay để lần sau phát được.
        if (!source) return;
        if (!source.loading) this.preload([type]);
        if (!source.buffers || source.buffers.length === 0) {
            return;
        }

        const initialVolume = source.volume;
        const initialPlaybackRate = MyMath.random(
            source.playbackRateMin,
            source.playbackRateMax
        );

        // Khối lượng giảm theo quy mô.
        const scaledVolume = initialVolume * scale;
        // Tốc độ phát lại tăng theo quy mô. Đối với điều này, chúng tôi ánh xạ tỷ lệ 0-1 thành tỷ lệ 2-1.
        // Vì vậy, ở thang âm 1, âm thanh phát bình thường, nhưng khi thang âm tiến tới 0 thì tốc độ sẽ tăng gấp đôi.
        const scaledPlaybackRate = initialPlaybackRate * (2 - scale);

        const gainNode = this.ctx.createGain();
        gainNode.gain.value = scaledVolume;

        const buffer = MyMath.randomChoice(source.buffers);
        const bufferSource = this.ctx.createBufferSource();
        bufferSource.playbackRate.value = scaledPlaybackRate;
        bufferSource.buffer = buffer;
        bufferSource.connect(gainNode);
        gainNode.connect(this.effectsGain);
        bufferSource.start(0);
    },

    // Âm lượng chung của tiếng pháo (0-1), ví dụ để nhỏ lại khi có nhạc nền
    setEffectsVolume(volume) {
        const value = Number(volume);
        this.effectsGain.gain.value = Number.isFinite(value) ? MyMath.clamp(value, 0, 1) : 1;
    }
};
// Mọi tiếng pháo đi qua một nút âm lượng chung
soundManager.effectsGain = soundManager.ctx.createGain();
soundManager.effectsGain.connect(soundManager.ctx.destination);


// Các loại âm thanh một kịch bản cần: bộ cơ bản của trình mô phỏng + âm thanh riêng các phát bắn chọn
export function getRequiredSoundTypes(config) {
    // Phóng, nổ, nổ nhỏ (hoa, lá rơi, nổ dọc đường), lách tách (pháo lách tách, nổ chéo, ảnh tan)
    const types = new Set(['lift', 'burst', 'burstSmall', 'crackle', 'crackleSmall']);
    ((config && config.events) || []).forEach(event => {
        ['liftSound', 'whistleSound', 'burstSound'].forEach(key => {
            if (event[key] && event[key] !== 'none') types.add(event[key]);
        });
        if (event.launchStyle === 'stages') {
            types.add('burstSoft');
            types.add('liftSoft');
        }
    });
    return [...types].filter(type => soundManager.sources[type]);
}

// Tiếng "bụp" lúc hộp quà bung nắp kèm vài tiếng chuông lấp lánh, tổng hợp bằng Web Audio
// (lúc này âm thanh pháo chưa tải xong và màn trình diễn chưa chạy)
export function playGiftOpenSound() {
    if (!canPlaySound()) return;
    try {
        const ctx = soundManager.ctx;
        const now = ctx.currentTime;
        const length = Math.floor(ctx.sampleRate * 0.3);
        const noise = ctx.createBuffer(1, length, ctx.sampleRate);
        const data = noise.getChannelData(0);
        for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 3);
        const pop = ctx.createBufferSource();
        pop.buffer = noise;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 900;
        filter.Q.value = 0.7;
        const popGain = ctx.createGain();
        popGain.gain.value = 1.2;
        pop.connect(filter).connect(popGain).connect(ctx.destination);
        pop.start(now);

        [1568, 2093, 2637, 3136].forEach((frequency, i) => {
            const start = now + 0.06 + i * 0.07;
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = frequency;
            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0.0001, start);
            gain.gain.exponentialRampToValueAtTime(0.08, start + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.6);
            osc.connect(gain).connect(ctx.destination);
            osc.start(start);
            osc.stop(start + 0.65);
        });
    } catch (e) {
        // Không phát được tiếng (trình duyệt cũ): bỏ qua, hiệu ứng hình vẫn chạy
    }
}

// Một đoạn WAV im lặng 0,1 giây, dùng để "mở khóa" phần tử audio lúc người dùng bấm nút
function createSilentWavUrl() {
    const samples = 800;
    const buffer = new ArrayBuffer(44 + samples);
    const view = new DataView(buffer);
    const writeText = (offset, text) => [...text].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
    writeText(0, 'RIFF');
    view.setUint32(4, 36 + samples, true);
    writeText(8, 'WAVEfmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, 1, true); // mono
    view.setUint32(24, 8000, true);
    view.setUint32(28, 8000, true);
    view.setUint16(32, 1, true);
    view.setUint16(34, 8, true);
    writeText(36, 'data');
    view.setUint32(40, samples, true);
    new Uint8Array(buffer, 44).fill(128);
    return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
}

/**
 * Nhạc nền của màn trình diễn: kịch bản có "music": { url, volume, start }.
 * Nhạc bắt đầu cùng đợt pháo đầu tiên (từ giây `start`), lặp lại suốt màn trình diễn,
 * dừng/tiếp tục theo nút tạm dừng và nút âm thanh, nhỏ dần khi kịch bản không lặp đã chạy xong.
 */
export const musicPlayer = {
    audio: null,
    gain: null,
    config: null,
    volume: 0,
    started: false,
    finished: false,
    // Nhạc đang thực sự kêu: vị trí phát đã nhích lên kể từ lúc bắt đầu phát / chạy lại (resumeFrom).
    // Sau play() và cả sau sự kiện 'playing' vẫn còn một quãng ngắn nhạc chưa kêu.
    progressing: false,
    resumeFrom: 0,
    fadeTimer: null,

    // Gọi ngay trong lúc người dùng bấm "Bắt đầu": trình duyệt (nhất là iPhone) chỉ cho phát nhạc
    // về sau nếu phần tử audio đã từng được play() trong một thao tác của người dùng.
    unlock() {
        if (this.audio) return;
        this.audio = new Audio();
        this.audio.loop = true;
        this.audio.src = createSilentWavUrl();
        const attempt = this.audio.play();
        if (attempt && attempt.catch) attempt.catch(() => {});
    },

    load(music) {
        if (IS_PREVIEW || !music || !music.url) return;
        this.config = music;
        if (!this.audio) this.unlock();
        const url = normalizeAssetPath(music.url);
        this.audio.pause();
        if (!this.audio.dataset.watched) {
            this.audio.dataset.watched = '1';
            ['playing', 'pause', 'waiting', 'seeking', 'ended', 'emptied'].forEach(type => {
                this.audio.addEventListener(type, () => this.markStalled());
            });
        }
        // Kịch bản khớp nhịp được xếp theo đúng bài nhạc: hết bài thì thôi, không phát lại từ đầu
        this.audio.loop = !music.sync;
        this.audio.preload = 'auto';
        this.audio.src = url;
        this.audio.load();
        // File nhạc cùng tên miền: đưa qua Web Audio để chỉnh âm lượng được cả trên iPhone (iOS bỏ qua audio.volume).
        // Link ngoài thì không (Web Audio sẽ tắt tiếng nguồn khác tên miền không cho phép CORS).
        let sameOrigin = /^(data:|blob:)/i.test(url);
        try {
            sameOrigin = sameOrigin || new URL(url, window.location.href).origin === window.location.origin;
        } catch (e) {
            // URL lỗi: phát trực tiếp
        }
        if (sameOrigin && !this.gain) {
            try {
                const source = soundManager.ctx.createMediaElementSource(this.audio);
                this.gain = soundManager.ctx.createGain();
                source.connect(this.gain);
                this.gain.connect(soundManager.ctx.destination);
            } catch (e) {
                this.gain = null;
            }
        }
        this.setVolume(0);
    },

    targetVolume() {
        const value = Number(this.config && this.config.volume);
        return Number.isFinite(value) ? MyMath.clamp(value, 0, 1) : 0.8;
    },

    setVolume(volume) {
        this.volume = volume;
        if (!this.audio) return;
        if (this.gain) {
            this.gain.gain.value = volume;
            this.audio.volume = 1;
        } else {
            this.audio.volume = MyMath.clamp(volume, 0, 1);
        }
    },

    fadeTo(target, duration, onDone) {
        clearInterval(this.fadeTimer);
        const from = this.volume;
        const startTime = performance.now();
        this.fadeTimer = setInterval(() => {
            const p = Math.min(1, (performance.now() - startTime) / duration);
            this.setVolume(from + (target - from) * p);
            if (p >= 1) {
                clearInterval(this.fadeTimer);
                onDone && onDone();
            }
        }, 50);
    },

    // Đợt pháo đầu tiên vừa bắn: phát nhạc từ giây đã chọn
    start() {
        if (!this.config || this.started) return;
        this.started = true;
        const begin = () => {
            const startAt = Math.max(0, Number(this.config.start) || 0);
            try {
                if (startAt) this.audio.currentTime = startAt;
            } catch (e) {
                // Máy chủ không hỗ trợ tua: phát từ đầu
            }
            if (canPlaySound()) this.resume();
        };
        if (this.audio.readyState >= 1) begin();
        else this.audio.addEventListener('loadedmetadata', begin, { once: true });
    },

    // Tua sẵn tới giây bắt đầu để lúc vào nhạc phát được ngay (kịch bản khớp nhịp)
    cue() {
        if (!this.config || this.started || !this.audio || this.audio.readyState < 1) return;
        try {
            this.audio.currentTime = Math.max(0, Number(this.config.start) || 0);
        } catch (e) {
            // Máy chủ không hỗ trợ tua
        }
    },

    markStalled() {
        this.progressing = false;
        this.resumeFrom = this.audio.currentTime;
    },

    checkProgress() {
        const audio = this.audio;
        if (!this.progressing && !audio.seeking && Math.abs(audio.currentTime - this.resumeFrom) > 0.001) this.progressing = true;
        return this.progressing;
    },

    // Đã bảo phát (vừa bắt đầu, vừa chạy lại sau tạm dừng, đang tải thêm) nhưng nhạc chưa kêu
    isStarting() {
        const audio = this.audio;
        return !!(this.started && !this.finished && audio && !audio.paused && !audio.ended && !audio.error && !this.checkProgress());
    },

    seekBy(ms) {
        try {
            this.audio.currentTime += ms / 1000;
            this.markStalled();
        } catch (e) {
            // Máy chủ không hỗ trợ tua
        }
    },

    // Vị trí đang phát (ms tính từ giây bắt đầu) cho kịch bản khớp nhịp: null khi nhạc chưa kịp chạy,
    // undefined khi không có nhạc để bám (không có nhạc, lỗi, hết bài, đang nhỏ dần để kết thúc)
    position() {
        const audio = this.audio;
        if (!this.config || !audio || this.finished || audio.ended || audio.error) return undefined;
        if (!this.started || audio.paused || !this.checkProgress()) return null;
        return (audio.currentTime - Math.max(0, Number(this.config.start) || 0)) * 1000;
    },

    resume() {
        if (!this.started || this.finished || document.hidden) return;
        const attempt = this.audio.play();
        if (attempt && attempt.catch) attempt.catch(err => console.warn('[Firework] Không phát được nhạc nền:', err.message));
        this.fadeTo(this.targetVolume(), 1200);
    },

    pause() {
        if (!this.started || !this.audio) return;
        clearInterval(this.fadeTimer);
        this.audio.pause();
        // Lần phát tiếp theo sẽ to dần lên, không bật đột ngột
        this.setVolume(0);
    },

    // Kịch bản không lặp đã chạy xong: nhạc nhỏ dần rồi dừng
    finish(delay) {
        if (!this.started || this.finished) return;
        this.finished = true;
        // Màn trình diễn đã hết: bài nhạc hết trong lúc nhỏ dần thì dừng luôn, không phát lại từ đầu
        if (this.audio) this.audio.loop = false;
        this.finishTimer = setTimeout(() => this.fadeTo(0, 4000, () => this.audio.pause()), delay);
    },

    // Xem lại từ đầu: nhạc phát lại từ giây đã chọn cùng đợt pháo đầu tiên
    restart() {
        if (!this.config || !this.audio) return;
        clearTimeout(this.finishTimer);
        clearInterval(this.fadeTimer);
        this.audio.pause();
        this.audio.loop = !this.config.sync;
        this.setVolume(0);
        this.started = false;
        this.finished = false;
    }
};
