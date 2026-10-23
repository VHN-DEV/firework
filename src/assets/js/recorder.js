/*!
 * Trình diễn Pháo hoa – dựng video màn trình diễn
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Mỗi khung hình ghép vào một canvas: màu bầu trời, ảnh nền, hai lớp pháo (hòa trộn "lighten" như trên trang),
// chữ tiêu đề và lời nhắn (vẽ lại từ phần tử HTML, đúng từng dòng đang hiển thị), cuối cùng là thiệp lời chúc.
// Video: từng khung đó được mã hóa H.264, tiếng pháo và nhạc nền trộn sẵn rồi mã hóa AAC, ghép thành MP4.

// "rgba(0, 0, 0, 0.95) 0px 2px 6px, ..." -> [{ color, x, y, blur }]
function parseShadows(value) {
    if (!value || value === 'none') return [];
    return value.split(/,(?![^(]*\))/).map(part => {
        const color = (part.match(/rgba?\([^)]*\)|#[0-9a-f]+/i) || ['rgba(0,0,0,0.5)'])[0];
        const [x = 0, y = 0, blur = 0] = (part.replace(color, '').match(/-?[\d.]+px/g) || []).map(parseFloat);
        return { color, x, y, blur };
    });
}

// Độ mờ thật của phần tử (nhân cả độ mờ của các phần tử cha)
function effectiveOpacity(el) {
    let opacity = 1;
    for (let node = el; node && node.nodeType === 1; node = node.parentElement) {
        const style = getComputedStyle(node);
        if (style.display === 'none' || style.visibility === 'hidden') return 0;
        opacity *= parseFloat(style.opacity);
    }
    return opacity;
}

// Các dòng chữ đúng như trình duyệt đang xuống dòng: đo vị trí từng ký tự, đổi dòng khi ký tự nhảy xuống dưới.
// Lưu lại theo nội dung và khổ của phần tử (chữ gõ từng chữ thì đo lại mỗi lần thêm chữ).
const lineCache = new WeakMap();

function lineBoxes(el, rect) {
    const text = el.textContent;
    const key = `${text}|${Math.round(rect.width)}|${Math.round(rect.height)}`;
    const cached = lineCache.get(el);
    if (cached && cached.key === key) return cached.lines.map(l => ({ ...l, top: rect.top + l.top, bottom: rect.top + l.bottom }));

    const node = [...el.childNodes].find(n => n.nodeType === 3);
    const lines = [];
    if (node) {
        const range = document.createRange();
        const s = node.textContent;
        let line = null;
        for (let i = 0; i < s.length; i++) {
            if (s[i] === '\n') {
                line = null;
                continue;
            }
            const code = s.charCodeAt(i);
            const width = code >= 0xd800 && code <= 0xdbff && i + 1 < s.length ? 2 : 1;
            range.setStart(node, i);
            range.setEnd(node, i + width);
            const piece = s.slice(i, i + width);
            i += width - 1;
            const r = range.getBoundingClientRect();
            if (!r.width && !r.height) {
                if (line) line.text += piece;
                continue;
            }
            if (!line || r.top >= line.bottom - (r.bottom - r.top) * 0.3) {
                line = { text: '', top: r.top, bottom: r.bottom };
                lines.push(line);
            }
            line.text += piece;
            line.top = Math.min(line.top, r.top);
            line.bottom = Math.max(line.bottom, r.bottom);
        }
    }
    const relative = lines.map(l => ({ text: l.text.trim(), top: l.top - rect.top, bottom: l.bottom - rect.top })).filter(l => l.text);
    lineCache.set(el, { key, lines: relative });
    return relative.map(l => ({ ...l, top: rect.top + l.top, bottom: rect.top + l.bottom }));
}

// Xuống dòng theo bề rộng tối đa (thiệp lời chúc cuối video)
function wrapText(ctx, text, maxWidth) {
    const lines = [];
    String(text).split('\n').forEach(paragraph => {
        let line = '';
        paragraph.split(/\s+/).filter(Boolean).forEach(word => {
            const next = line ? `${line} ${word}` : word;
            if (line && ctx.measureText(next).width > maxWidth) {
                lines.push(line);
                line = word;
            } else {
                line = next;
            }
        });
        if (line) lines.push(line);
    });
    return lines;
}

/**
 * Ghép khung hình đang hiện trên trang vào một canvas (dùng cho video và ảnh chụp khoảnh khắc).
 * width, height: cỡ ảnh; container: khung chứa các lớp pháo (đo vị trí chữ theo khung này);
 * background: phần tử ảnh nền; layers: các canvas pháo; texts(): các phần tử chữ cần vẽ;
 * now(): đồng hồ cho thiệp lời chúc hiện dần (video dùng đồng hồ giả lập).
 */
export function createFrameComposer({ width, height, container, background, layers, front = [], texts, now = () => performance.now() }) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const images = new Map();
    const fontFamily = getComputedStyle(document.body).fontFamily;
    let endCard = null;
    let modes = null;

    function backgroundImage() {
        if (!background) return null;
        const style = getComputedStyle(background);
        const match = style.backgroundImage.match(/url\(["']?(.*?)["']?\)/);
        const opacity = parseFloat(style.opacity);
        if (!match || opacity < 0.01) return null;
        let image = images.get(match[1]);
        if (!image) {
            image = new Image();
            image.src = match[1];
            images.set(match[1], image);
        }
        return image.complete && image.naturalWidth ? { image, opacity } : null;
    }

    function paintText(el, box, k) {
        const rect = el.getBoundingClientRect();
        if (!rect.width) return;
        const alpha = effectiveOpacity(el);
        if (alpha < 0.01) return;
        const style = getComputedStyle(el);
        ctx.font = `${style.fontStyle} ${style.fontWeight} ${parseFloat(style.fontSize) * k}px ${style.fontFamily}`;
        if ('letterSpacing' in ctx) ctx.letterSpacing = style.letterSpacing === 'normal' ? '0px' : `${parseFloat(style.letterSpacing) * k}px`;
        const align = /left|start/.test(style.textAlign) ? 'left' : /right|end/.test(style.textAlign) ? 'right' : 'center';
        ctx.textAlign = align;
        ctx.textBaseline = 'middle';
        const x = ((align === 'left' ? rect.left : align === 'right' ? rect.right : rect.left + rect.width / 2) - box.left) * k;
        const upper = style.textTransform === 'uppercase';
        const shadows = parseShadows(style.textShadow);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = style.color;
        lineBoxes(el, rect).forEach(line => {
            const text = upper ? line.text.toLocaleUpperCase('vi') : line.text;
            const y = ((line.top + line.bottom) / 2 - box.top) * k;
            shadows.forEach(s => {
                ctx.shadowColor = s.color;
                ctx.shadowBlur = s.blur * k;
                ctx.shadowOffsetX = s.x * k;
                ctx.shadowOffsetY = s.y * k;
                ctx.fillText(text, x, y);
            });
            ctx.shadowColor = 'transparent';
            ctx.fillText(text, x, y);
        });
        ctx.globalAlpha = 1;
        if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    }

    // Thiệp lời chúc cuối video: nền tối dần, tiêu đề phát sáng, lời chúc và tên người gửi
    function paintEndCard() {
        const t = Math.min(1, (now() - endCard.start) / 700);
        ctx.fillStyle = `rgba(0, 0, 0, ${0.55 * t})`;
        ctx.fillRect(0, 0, width, height);
        const unit = Math.min(width, height);
        const maxWidth = width * 0.84;
        const blocks = [];
        const add = (text, size, weight, color, extra = {}) => {
            if (!text) return;
            ctx.font = `${extra.italic ? 'italic ' : ''}${weight} ${size}px ${fontFamily}`;
            blocks.push({ lines: wrapText(ctx, text, maxWidth), size, weight, color, ...extra });
        };
        add(String(endCard.title || '').toLocaleUpperCase('vi'), unit * 0.075, 700, '#fff', { glow: true });
        add(endCard.message, unit * 0.04, 400, 'rgba(255, 255, 255, 0.88)');
        add(endCard.from, unit * 0.036, 400, '#ffbf36', { italic: true });
        const gap = unit * 0.035;
        const total = blocks.reduce((sum, b) => sum + b.lines.length * b.size * 1.3, 0) + gap * Math.max(0, blocks.length - 1);
        let y = height / 2 - total / 2;
        ctx.globalAlpha = t;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        blocks.forEach(block => {
            ctx.font = `${block.italic ? 'italic ' : ''}${block.weight} ${block.size}px ${fontFamily}`;
            ctx.fillStyle = block.color;
            block.lines.forEach(line => {
                const lineY = y + block.size * 0.65;
                if (block.glow) {
                    ctx.shadowColor = 'rgba(255, 191, 54, 0.6)';
                    ctx.shadowBlur = block.size * 0.6;
                    ctx.fillText(line, width / 2, lineY);
                }
                ctx.shadowColor = 'transparent';
                ctx.fillText(line, width / 2, lineY);
                y += block.size * 1.3;
            });
            y += gap;
        });
        ctx.globalAlpha = 1;
    }

    function paint() {
        const box = container.getBoundingClientRect();
        const k = width / box.width;
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
        ctx.fillStyle = container.style.backgroundColor || '#000';
        ctx.fillRect(0, 0, width, height);
        const bg = backgroundImage();
        if (bg) {
            // Đúng khung và vị trí như trên trang (có mặt nước thì ảnh nền chỉ chiếm phần trời, canh đáy)
            const { image, opacity } = bg;
            const r = background.getBoundingClientRect();
            const bx = (r.left - box.left) * k, by = (r.top - box.top) * k, bw = r.width * k, bh = r.height * k;
            const [px, py] = getComputedStyle(background).backgroundPosition.split(' ').map(v => (Number.isFinite(parseFloat(v)) ? parseFloat(v) : 50) / 100);
            const scale = Math.max(bw / image.naturalWidth, bh / image.naturalHeight);
            const w = image.naturalWidth * scale;
            const h = image.naturalHeight * scale;
            ctx.save();
            ctx.beginPath();
            ctx.rect(bx, by, bw, bh);
            ctx.clip();
            ctx.globalAlpha = opacity;
            ctx.drawImage(image, bx + (bw - w) * px, by + (bh - h) * py, w, h);
            ctx.restore();
        }
        // Ghép như trên trang: lớp nào CSS cộng sáng (plus-lighter: các lớp pháo) thì cộng, còn lại "lighten"
        if (!modes) modes = layers.map(layer => (getComputedStyle(layer).mixBlendMode === 'plus-lighter' ? 'lighter' : 'lighten'));
        layers.forEach((layer, i) => {
            ctx.globalCompositeOperation = modes[i];
            if (layer.width) ctx.drawImage(layer, 0, 0, width, height);
        });
        ctx.globalCompositeOperation = 'source-over';
        // Lớp trước (người ngắm pháo) ghép bình thường như trên trang
        front.forEach(layer => {
            if (layer.width) ctx.drawImage(layer, 0, 0, width, height);
        });
        texts().forEach(el => paintText(el, box, k));
        if (endCard) paintEndCard();
    }

    return {
        canvas,
        paint,
        // Chờ ảnh nền tải xong (ảnh chụp chỉ vẽ một khung, không đợi được khung sau như video)
        load() {
            backgroundImage();
            const pending = [...images.values()].filter(image => !image.complete);
            return Promise.all(pending.map(image => new Promise(resolve => {
                image.addEventListener('load', resolve, { once: true });
                image.addEventListener('error', resolve, { once: true });
            })));
        },
        // Thiệp lời chúc phủ lên các khung hình sau đó (hiện dần)
        setEndCard(card) {
            endCard = { ...card, start: now() };
        }
    };
}

// ---------------------------------------------------------------------------
// Mã hóa MP4: khung hình (canvas) -> H.264, tiếng (AudioBuffer) -> AAC (không được thì Opus) bằng WebCodecs,
// mp4-muxer ghép thành file. Mọi khung giữ trong bộ nhớ tới lúc chốt file nên ghi hình trước, tiếng sau cũng được.
// ---------------------------------------------------------------------------

// High, Main rồi Baseline, cùng mức 4.0 (đủ cho 1080×1920)
const AVC_CODECS = ['avc1.640028', 'avc1.4d0028', 'avc1.42e028'];
const AUDIO_CODECS = [{ codec: 'mp4a.40.2', muxer: 'aac' }, { codec: 'opus', muxer: 'opus' }];
const SAMPLE_RATE = 48000;
const AUDIO_BITRATE = 160000;

export function canEncodeVideo() {
    return typeof VideoEncoder !== 'undefined' && typeof VideoFrame !== 'undefined' && typeof OfflineAudioContext !== 'undefined';
}

// Ưu tiên bộ mã hóa phần cứng (card đồ họa, chip điện thoại): nhanh hơn nhiều lần so với mã hóa bằng CPU
async function pickVideoConfig(width, height, fps, bitrate) {
    for (const hardwareAcceleration of ['prefer-hardware', 'no-preference']) {
        for (const codec of AVC_CODECS) {
            const config = { codec, width, height, bitrate, framerate: fps, avc: { format: 'avc' }, hardwareAcceleration };
            try {
                if ((await VideoEncoder.isConfigSupported(config)).supported) return config;
            } catch (e) {
                // Trình duyệt không nhận cấu hình này: thử cấu hình kế tiếp
            }
        }
    }
    return null;
}

async function pickAudioConfig() {
    if (typeof AudioEncoder === 'undefined') return null;
    for (const { codec, muxer } of AUDIO_CODECS) {
        const config = { codec, sampleRate: SAMPLE_RATE, numberOfChannels: 2, bitrate: AUDIO_BITRATE };
        try {
            if ((await AudioEncoder.isConfigSupported(config)).supported) return { config, muxer };
        } catch (e) {
            // Thử bộ mã hóa kế tiếp
        }
    }
    return null;
}

// Nhường luồng chính một nhịp (không bị trình duyệt hãm như setTimeout khi tab ở nền)
function yieldTask() {
    return new Promise(resolve => {
        const channel = new MessageChannel();
        channel.port1.onmessage = () => resolve();
        channel.port2.postMessage(null);
    });
}

// Nơi nhận tệp MP4 bộ ghép ghi ra theo luồng. Phần đầu (ftyp, đầu hộp mdat: bộ ghép quay lại ghi cỡ mdat lúc kết thúc)
// giữ riêng để sửa được; phần sau ghi nối tiếp, cứ vài MB gom vào Blob một lần (trình duyệt tự cất, cất ra đĩa khi lớn),
// bộ nhớ của trang chỉ giữ vài MB.
const FOLD_BYTES = 8 * 1024 * 1024;

function createFileSink() {
    let head = null;
    let body = new Blob([]);
    let parts = [];
    let pending = 0;
    let end = 0;
    const fold = () => {
        if (!parts.length) return;
        body = new Blob([body, ...parts]);
        parts = [];
        pending = 0;
    };
    return {
        // data: mảng mới của bộ ghép (giữ lại được, không cần chép); position: vị trí trong tệp
        write(data, position) {
            if (!head) {
                head = data;
                end = data.byteLength;
                return;
            }
            if (position + data.byteLength <= head.byteLength) {
                head.set(data, position);
                return;
            }
            if (position !== end) throw new Error('Bộ ghép MP4 ghi lại vào phần đã gom');
            parts.push(data);
            pending += data.byteLength;
            end += data.byteLength;
            if (pending >= FOLD_BYTES) fold();
        },
        blob(type) {
            fold();
            return new Blob([head || new Uint8Array(0), body], { type });
        }
    };
}

/**
 * Bộ ghi MP4 width × height, fps khung/giây. Trả về null nếu trình duyệt không mã hóa được H.264.
 * addFrame(canvas): thêm một khung; addAudio(buffer): thêm tiếng (cả bài một lần); finish(): Blob MP4.
 */
export async function createMp4Writer({ width, height, fps, bitrate }) {
    if (!canEncodeVideo()) return null;
    const videoConfig = await pickVideoConfig(width, height, fps, bitrate);
    if (!videoConfig) return null;
    const audio = await pickAudioConfig();
    const { Muxer, StreamTarget } = await import('mp4-muxer');
    // Ghi theo luồng, siêu dữ liệu (moov) ở cuối tệp: mỗi đoạn vừa mã hóa xong ghi ra ngay (createFileSink). Giữ cả tệp trong
    // bộ nhớ tới cuối (fastStart 'in-memory') rồi chép qua vùng đệm tăng gấp đôi, cắt, tạo Blob thì lúc ghép tệp tốn 4-5 lần
    // cỡ video (3 phút Full HD ~800 MB), điện thoại dễ đóng tab. MP4 thường (không phải fMP4): xem, chia sẻ, tải lên như cũ
    const file = createFileSink();
    const muxer = new Muxer({
        target: new StreamTarget({ onData: (data, position) => file.write(data, position) }),
        video: { codec: 'avc', width, height, frameRate: fps },
        audio: audio ? { codec: audio.muxer, numberOfChannels: 2, sampleRate: SAMPLE_RATE } : undefined,
        fastStart: false,
        firstTimestampBehavior: 'offset'
    });
    let failure = null;
    const fail = e => { failure = failure || e; };
    const videoEncoder = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: fail });
    videoEncoder.configure(videoConfig);
    let frames = 0;

    return {
        hasAudio: !!audio,

        async addFrame(canvas) {
            if (failure) throw failure;
            const frame = new VideoFrame(canvas, { timestamp: Math.round(frames * 1e6 / fps), duration: Math.round(1e6 / fps) });
            // Khung chính mỗi 2 giây: tua video mượt
            videoEncoder.encode(frame, { keyFrame: frames % (fps * 2) === 0 });
            frame.close();
            frames++;
            // Bộ mã hóa đang bận: chờ nó nhả bớt khung (sự kiện dequeue, trình duyệt cũ thì hỏi lại từng nhịp)
            while (videoEncoder.encodeQueueSize > 6) {
                await ('ondequeue' in videoEncoder
                    ? new Promise(resolve => videoEncoder.addEventListener('dequeue', resolve, { once: true }))
                    : yieldTask());
            }
        },

        async addAudio(buffer) {
            if (!audio || !buffer) return;
            const encoder = new AudioEncoder({ output: (chunk, meta) => muxer.addAudioChunk(chunk, meta), error: fail });
            encoder.configure(audio.config);
            const left = buffer.getChannelData(0);
            const right = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : left;
            const size = 4800;
            for (let i = 0; i < buffer.length; i += size) {
                const n = Math.min(size, buffer.length - i);
                const data = new Float32Array(n * 2);
                data.set(left.subarray(i, i + n), 0);
                data.set(right.subarray(i, i + n), n);
                const chunk = new AudioData({
                    format: 'f32-planar', sampleRate: SAMPLE_RATE, numberOfFrames: n, numberOfChannels: 2,
                    timestamp: Math.round(i * 1e6 / SAMPLE_RATE), data
                });
                encoder.encode(chunk);
                chunk.close();
                if (encoder.encodeQueueSize > 20) await yieldTask();
            }
            await encoder.flush();
            encoder.close();
            if (failure) throw failure;
        },

        async finish() {
            await videoEncoder.flush();
            videoEncoder.close();
            if (failure) throw failure;
            muxer.finalize();
            return file.blob('video/mp4');
        },

        close() {
            if (videoEncoder.state !== 'closed') videoEncoder.close();
        }
    };
}

/**
 * Trộn tiếng cho video dài `duration` giây: tiếng pháo đã ghi lại (sounds: { at, buffer, rate, gain }) qua âm lượng
 * chung effectsVolume, và nhạc nền (music: { buffer, offset (giây), volume, loop, start, end (ms) }) to dần 1,2 giây
 * lúc bắt đầu, nhỏ dần 4 giây lúc kết thúc như khi xem thật. Tiếng thiên nhiên (bus: 'nature', không theo âm lượng tiếng
 * pháo) có thêm: pan (-1 trái, 1 phải), lowpass (Hz, tiếng ở xa), loop (tiếng nền lặp), fade (giây to dần), until (ms
 * lúc thôi phát, nhỏ dần 1,5 giây).
 */
export async function mixAudio({ duration, sounds, effectsVolume, music }) {
    const ctx = new OfflineAudioContext(2, Math.max(1, Math.ceil(duration * SAMPLE_RATE)), SAMPLE_RATE);
    const effects = ctx.createGain();
    effects.gain.value = effectsVolume;
    effects.connect(ctx.destination);
    sounds.forEach(sound => {
        if (sound.at / 1000 >= duration) return;
        const t0 = Math.max(0, sound.at / 1000);
        const source = ctx.createBufferSource();
        source.buffer = sound.buffer;
        source.playbackRate.value = sound.rate;
        source.loop = !!sound.loop;
        const gain = ctx.createGain();
        if (sound.fade) {
            gain.gain.setValueAtTime(0, t0);
            gain.gain.linearRampToValueAtTime(sound.gain, t0 + sound.fade);
        } else {
            gain.gain.value = sound.gain;
        }
        let node = source;
        if (sound.lowpass) {
            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = sound.lowpass;
            node.connect(filter);
            node = filter;
        }
        if (sound.pan && ctx.createStereoPanner) {
            const panner = ctx.createStereoPanner();
            panner.pan.value = sound.pan;
            node.connect(panner);
            node = panner;
        }
        node.connect(gain);
        gain.connect(sound.bus === 'nature' ? ctx.destination : effects);
        source.start(t0);
        if (sound.until !== undefined) {
            const t1 = Math.max(t0 + (sound.fade || 0), sound.until / 1000);
            gain.gain.setValueAtTime(sound.gain, t1);
            gain.gain.linearRampToValueAtTime(0, t1 + 1.5);
            source.stop(t1 + 1.6);
        }
    });
    if (music && music.buffer && music.start !== null && music.start / 1000 < duration) {
        const source = ctx.createBufferSource();
        source.buffer = music.buffer;
        source.loop = music.loop;
        const gain = ctx.createGain();
        const t0 = Math.max(0, music.start / 1000);
        source.connect(gain);
        gain.connect(ctx.destination);
        source.start(t0, Math.min(Math.max(0, music.offset), Math.max(0, music.buffer.duration - 0.01)));
        gain.gain.setValueAtTime(0, t0);
        gain.gain.linearRampToValueAtTime(music.volume, t0 + 1.2);
        if (music.end !== null) {
            const t1 = Math.max(t0 + 1.2, music.end / 1000);
            gain.gain.setValueAtTime(music.volume, t1);
            gain.gain.linearRampToValueAtTime(0, t1 + 4);
            source.stop(t1 + 4);
        }
    }
    return ctx.startRendering();
}
