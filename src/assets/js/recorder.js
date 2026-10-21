/*!
 * Trình diễn Pháo hoa – quay video màn trình diễn
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Mỗi khung hình ghép vào một canvas: màu bầu trời, ảnh nền, hai lớp pháo (hòa trộn "lighten" như trên trang),
// chữ tiêu đề và lời nhắn (vẽ lại từ phần tử HTML, đúng từng dòng đang hiển thị), cuối cùng là thiệp lời chúc.
// MediaRecorder ghi canvas đó cùng tiếng pháo và nhạc nền (lấy thẳng từ Web Audio) thành MP4, không được thì WebM.

const MIME_TYPES = [
    'video/mp4;codecs="avc1.640028,mp4a.40.2"',
    'video/mp4;codecs=avc1,opus',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm'
];

export function pickVideoMimeType() {
    if (!window.MediaRecorder || !MediaRecorder.isTypeSupported) return '';
    return MIME_TYPES.find(type => MediaRecorder.isTypeSupported(type)) || '';
}

export function canRecordVideo() {
    return !!(window.MediaRecorder && HTMLCanvasElement.prototype.captureStream && pickVideoMimeType());
}

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
 * background: phần tử ảnh nền; layers: các canvas pháo; texts(): các phần tử chữ cần vẽ.
 */
export function createFrameComposer({ width, height, container, background, layers, texts }) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const images = new Map();
    const fontFamily = getComputedStyle(document.body).fontFamily;
    let endCard = null;

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
        const t = Math.min(1, (performance.now() - endCard.start) / 700);
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
        ctx.globalCompositeOperation = 'lighten';
        layers.forEach(layer => {
            if (layer.width) ctx.drawImage(layer, 0, 0, width, height);
        });
        ctx.globalCompositeOperation = 'source-over';
        texts().forEach(el => paintText(el, box, k));
        if (endCard) paintEndCard();
    }

    return {
        canvas,
        paint,
        // Thiệp lời chúc phủ lên các khung hình sau đó (hiện dần)
        setEndCard(card) {
            endCard = { ...card, start: performance.now() };
        }
    };
}

/**
 * Như createFrameComposer, thêm audioContext + audioNodes: nguồn tiếng (tiếng pháo, nhạc nền) để ghi vào video.
 */
export function createVideoRecorder({ width, height, fps = 30, bitrate = 8e6, container, background, layers, texts, audioContext, audioNodes = [] }) {
    const composer = createFrameComposer({ width, height, container, background, layers, texts });
    const { canvas, paint } = composer;
    const mimeType = pickVideoMimeType();
    let recorder = null;
    let destination = null;
    let chunks = [];
    let frame = null;
    let lastPaint = 0;
    let startedAt = 0;
    let pausedAt = 0;
    let pausedTotal = 0;

    function loop(now) {
        frame = requestAnimationFrame(loop);
        // Vẽ vừa đủ số khung hình của video
        if (now - lastPaint < 1000 / fps - 4) return;
        lastPaint = now;
        paint();
    }

    return {
        canvas,
        mimeType,

        start() {
            const stream = canvas.captureStream(fps);
            if (audioContext && audioNodes.length) {
                destination = audioContext.createMediaStreamDestination();
                audioNodes.forEach(node => node && node.connect(destination));
                destination.stream.getAudioTracks().forEach(track => stream.addTrack(track));
            }
            chunks = [];
            recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: bitrate, audioBitsPerSecond: 160000 });
            recorder.ondataavailable = e => {
                if (e.data && e.data.size) chunks.push(e.data);
            };
            paint();
            recorder.start(1000);
            startedAt = performance.now();
            frame = requestAnimationFrame(loop);
        },

        // Thời gian đã quay (giây), không tính lúc tạm dừng
        elapsed() {
            if (!startedAt) return 0;
            return ((pausedAt || performance.now()) - startedAt - pausedTotal) / 1000;
        },

        pause() {
            if (!recorder || recorder.state !== 'recording') return;
            recorder.pause();
            pausedAt = performance.now();
        },

        resume() {
            if (!recorder || recorder.state !== 'paused') return;
            pausedTotal += performance.now() - pausedAt;
            pausedAt = 0;
            recorder.resume();
        },

        // Hiện thiệp lời chúc trong `duration` ms rồi xong
        showEndCard(card, duration) {
            composer.setEndCard(card);
            return new Promise(resolve => setTimeout(resolve, duration));
        },

        stop() {
            return new Promise(resolve => {
                if (!recorder || recorder.state === 'inactive') {
                    resolve(null);
                    return;
                }
                recorder.onstop = () => {
                    cancelAnimationFrame(frame);
                    if (destination) audioNodes.forEach(node => node && node.disconnect(destination));
                    resolve(new Blob(chunks, { type: (recorder.mimeType || mimeType).split(';')[0] }));
                };
                recorder.stop();
            });
        }
    };
}
