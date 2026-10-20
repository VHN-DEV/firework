/*!
 * Trình diễn Pháo hoa – ảnh xem trước khi chia sẻ
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

/**
 * Ảnh xem trước 1200×630 khi gửi link (Facebook, Zalo, Messenger, Telegram...):
 * bầu trời đêm, các chùm pháo theo màu của kịch bản, tiêu đề, lời chúc và người gửi.
 * Bố cục ngẫu nhiên nhưng cố định theo nội dung, nên cùng một kịch bản luôn cho ra cùng một ảnh.
 */
export const SHARE_IMAGE_WIDTH = 1200;
export const SHARE_IMAGE_HEIGHT = 630;

const COLOR = {
    Red: '#ff0043',
    Green: '#14fc56',
    Blue: '#1e7fff',
    Purple: '#e60aff',
    Gold: '#ffbf36',
    White: '#ffffff'
};

// Giống replacePlaceholders() của trình phát
function replacePlaceholders(text) {
    if (typeof text !== 'string') return '';
    const year = new Date().getFullYear();
    const cans = ['Canh', 'Tân', 'Nhâm', 'Quý', 'Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ'];
    const chis = ['Thân', 'Dậu', 'Tuất', 'Hợi', 'Tí', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi'];
    return text
        .replace(/\[YEAR\]/g, year)
        .replace(/\[LUNAR_YEAR\]/g, `${cans[year % 10]} ${chis[year % 12]}`.toUpperCase())
        .replace(/\[SINCE:(\d+)\]/g, (m, p1) => year - parseInt(p1, 10));
}

function seededRandom(text) {
    let seed = 2166136261;
    for (const ch of text) seed = Math.imul(seed ^ ch.codePointAt(0), 16777619) >>> 0;
    return () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
}

function withAlpha(hex, alpha) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

// Các màu dùng nhiều nhất trong kịch bản (bỏ "Ngẫu nhiên"), thiếu thì bổ sung bằng vàng/tím/xanh
function paletteOf(config) {
    const count = new Map();
    (config.events || []).forEach(e => {
        [].concat(e.color || []).forEach(c => {
            const hex = COLOR[c] || (/^#[0-9a-f]{6}$/i.test(c) ? c : null);
            if (hex) count.set(hex, (count.get(hex) || 0) + 1);
        });
    });
    const used = [...count.entries()].sort((a, b) => b[1] - a[1]).map(([hex]) => hex);
    const palette = [...new Set([...used, COLOR.Gold, COLOR.Purple, COLOR.Blue, COLOR.White])];
    return palette.slice(0, Math.max(4, Math.min(used.length, 5)));
}

function wrapLines(ctx, text, maxWidth, maxLines) {
    const words = text.split(/\s+/).filter(Boolean);
    const lines = [];
    let line = '';
    for (const word of words) {
        const test = line ? `${line} ${word}` : word;
        if (ctx.measureText(test).width <= maxWidth || !line) {
            line = test;
        } else {
            lines.push(line);
            line = word;
        }
    }
    if (line) lines.push(line);
    // Đúng 2 dòng: chọn chỗ ngắt cho hai dòng dài gần bằng nhau ("CHÚC MỪNG / TỐT NGHIỆP")
    if (lines.length === 2 && maxLines >= 2) {
        let best = lines;
        let bestWidth = Infinity;
        for (let i = 1; i < words.length; i++) {
            const pair = [words.slice(0, i).join(' '), words.slice(i).join(' ')];
            const width = Math.max(...pair.map(l => ctx.measureText(l).width));
            if (width <= maxWidth && width < bestWidth) {
                best = pair;
                bestWidth = width;
            }
        }
        return best;
    }
    if (lines.length > maxLines) {
        const kept = lines.slice(0, maxLines);
        let last = kept[maxLines - 1];
        while (last.length > 1 && ctx.measureText(last + '…').width > maxWidth) last = last.slice(0, -1);
        kept[maxLines - 1] = last.trimEnd() + '…';
        return kept;
    }
    return lines;
}

function drawBurst(ctx, cx, cy, radius, color, rand) {
    // Quầng sáng
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 1.3);
    glow.addColorStop(0, withAlpha(color, 0.32));
    glow.addColorStop(0.45, withAlpha(color, 0.1));
    glow.addColorStop(1, withAlpha(color, 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 1.3, 0, Math.PI * 2);
    ctx.fill();

    // Các tia sáng hơi rủ xuống như bị trọng lực kéo
    const rays = 60 + Math.floor(rand() * 36);
    for (let i = 0; i < rays; i++) {
        const angle = (i / rays) * Math.PI * 2 + rand() * 0.07;
        const len = radius * (0.62 + rand() * 0.38);
        const sag = len * 0.16;
        const x1 = cx + Math.cos(angle) * len * 0.16;
        const y1 = cy + Math.sin(angle) * len * 0.16;
        const x2 = cx + Math.cos(angle) * len;
        const y2 = cy + Math.sin(angle) * len + sag;
        const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
        gradient.addColorStop(0, withAlpha(color, 0));
        gradient.addColorStop(1, withAlpha(color, 0.95));
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 1.7;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.quadraticCurveTo(cx + Math.cos(angle) * len * 0.62, cy + Math.sin(angle) * len * 0.62 + sag * 0.25, x2, y2);
        ctx.stroke();

        // Đầu tia: chấm sáng lõi trắng
        ctx.fillStyle = withAlpha(color, 0.65);
        ctx.beginPath();
        ctx.arc(x2, y2, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.beginPath();
        ctx.arc(x2, y2, 1.4, 0, Math.PI * 2);
        ctx.fill();

        // Tàn lấp lánh rơi xuống
        if (rand() < 0.35) {
            for (let k = 1; k <= 3; k++) {
                ctx.fillStyle = withAlpha(color, 0.5 / k);
                ctx.beginPath();
                ctx.arc(x2 + (rand() - 0.5) * 4, y2 + k * (7 + rand() * 6), 1.3, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    // Lõi chớp sáng
    const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 0.22);
    core.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
    core.addColorStop(1, withAlpha(color, 0));
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.22, 0, Math.PI * 2);
    ctx.fill();
}

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}

// Ảnh người dùng chọn: phủ kín khung 1200×630, phần thừa cắt theo `position` (0 = trên/trái, 100 = dưới/phải)
function drawCoverPhoto(ctx, img, W, H, position = 50) {
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    const scale = Math.max(W / iw, H / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    const p = Math.max(0, Math.min(100, Number(position) || 0)) / 100;
    ctx.drawImage(img, -(dw - W) * p, -(dh - H) * p, dw, dh);
}

/**
 * Vẽ ảnh xem trước. Mặc định là thiệp pháo hoa tự động; kịch bản có `seoImage` thì dùng ảnh đó làm nền
 * (`seoImagePosition`: vị trí cắt ảnh, `seoImageText: false`: chỉ để ảnh, không chèn chữ).
 */
export async function renderShareImage(config) {
    const W = SHARE_IMAGE_WIDTH;
    const H = SHARE_IMAGE_HEIGHT;
    const title = replacePlaceholders(config.title || 'Màn trình diễn pháo hoa');
    const subtitle = replacePlaceholders(config.subtitle || '');
    const author = replacePlaceholders(config.author || '');

    // Chờ font của trang (nếu tải được) để chữ trên ảnh đẹp và đúng dấu tiếng Việt
    if (document.fonts && document.fonts.load) {
        await Promise.all([
            document.fonts.load('700 80px Outfit', title),
            document.fonts.load('400 30px Inter', subtitle || 'a'),
            document.fonts.load('italic 500 24px Inter', author || 'a')
        ]).catch(() => { });
    }

    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    let photo = null;
    if (config.seoImage) {
        try {
            photo = await loadImage(config.seoImage);
        } catch (e) {
            // Ảnh lỗi/đã bị xóa: dùng thiệp tự động
        }
    }
    if (photo) {
        drawCoverPhoto(ctx, photo, W, H, config.seoImagePosition ?? 50);
        if (config.seoImageText === false) return canvas;
        // Phủ tối để chữ luôn đọc rõ trên mọi ảnh
        ctx.fillStyle = 'rgba(3, 4, 11, 0.3)';
        ctx.fillRect(0, 0, W, H);
        const photoVeil = ctx.createRadialGradient(W / 2, H / 2, 60, W / 2, H / 2, 640);
        photoVeil.addColorStop(0, 'rgba(3, 4, 11, 0.7)');
        photoVeil.addColorStop(1, 'rgba(3, 4, 11, 0.25)');
        ctx.fillStyle = photoVeil;
        ctx.fillRect(0, 0, W, H);
        drawCardText(ctx, W, H, title, subtitle, author);
        return canvas;
    }

    const rand = seededRandom(`${title}|${subtitle}|${author}`);
    const palette = paletteOf(config);

    // Bầu trời đêm
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#03040b');
    sky.addColorStop(0.55, '#0c0a22');
    sky.addColorStop(1, '#1d0f2e');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 160; i++) {
        ctx.fillStyle = `rgba(255, 255, 255, ${0.15 + rand() * 0.5})`;
        ctx.fillRect(rand() * W, rand() * H, rand() < 0.15 ? 2 : 1, rand() < 0.15 ? 2 : 1);
    }

    // Pháo hoa quanh viền, chừa vùng giữa cho chữ
    const spots = [[150, 135, 150], [1055, 130, 145], [600, 50, 105], [85, 505, 125], [1120, 505, 135], [330, 585, 95], [880, 590, 100]];
    ctx.globalCompositeOperation = 'lighter';
    spots.forEach(([x, y, r], i) => {
        const jitter = () => (rand() - 0.5) * 50;
        drawBurst(ctx, x + jitter(), y + jitter(), r * (0.88 + rand() * 0.24), palette[i % palette.length], rand);
    });
    ctx.globalCompositeOperation = 'source-over';

    // Nền tối mờ phía sau chữ để luôn đọc rõ
    const veil = ctx.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, 560);
    veil.addColorStop(0, 'rgba(3, 4, 11, 0.78)');
    veil.addColorStop(0.6, 'rgba(3, 4, 11, 0.45)');
    veil.addColorStop(1, 'rgba(3, 4, 11, 0)');
    ctx.fillStyle = veil;
    ctx.fillRect(0, 0, W, H);

    drawCardText(ctx, W, H, title, subtitle, author);
    return canvas;
}

// Tiêu đề, lời chúc, người gửi và nút mời bấm xem, căn giữa thiệp
function drawCardText(ctx, W, H, title, subtitle, author) {
    // Tiêu đề: thu nhỏ dần cho vừa tối đa 2 dòng
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    let titleSize = 84;
    let titleLines;
    do {
        ctx.font = `700 ${titleSize}px Outfit, Inter, 'Segoe UI', sans-serif`;
        titleLines = wrapLines(ctx, title, 1000, 2);
        titleSize -= 4;
    } while (titleSize > 40 && titleLines.some(l => ctx.measureText(l).width > 1000));
    titleSize += 4;
    const titleLineH = titleSize * 1.12;

    ctx.font = `400 31px Inter, 'Segoe UI', sans-serif`;
    const subLines = subtitle ? wrapLines(ctx, subtitle, 940, 2) : [];
    const subLineH = 42;

    const blockH = titleLines.length * titleLineH + (subLines.length ? 34 + subLines.length * subLineH : 0) + (author ? 50 : 0);
    let y = (H - blockH) / 2 + titleSize * 0.82 - 18;

    const titleGradient = ctx.createLinearGradient(0, y - titleSize, 0, y + titleLineH * titleLines.length);
    titleGradient.addColorStop(0, '#ffffff');
    titleGradient.addColorStop(1, '#ffd36b');
    ctx.font = `700 ${titleSize}px Outfit, Inter, 'Segoe UI', sans-serif`;
    ctx.fillStyle = titleGradient;
    ctx.shadowColor = 'rgba(255, 191, 54, 0.55)';
    ctx.shadowBlur = 28;
    titleLines.forEach(line => {
        ctx.fillText(line, W / 2, y);
        y += titleLineH;
    });
    ctx.shadowBlur = 0;

    if (subLines.length) {
        // Gạch ngăn mảnh giữa tiêu đề và lời chúc
        const lineY = y - titleLineH + titleSize * 0.42;
        const divider = ctx.createLinearGradient(W / 2 - 120, 0, W / 2 + 120, 0);
        divider.addColorStop(0, 'rgba(255, 211, 107, 0)');
        divider.addColorStop(0.5, 'rgba(255, 211, 107, 0.9)');
        divider.addColorStop(1, 'rgba(255, 211, 107, 0)');
        ctx.fillStyle = divider;
        ctx.fillRect(W / 2 - 120, lineY, 240, 2);

        y = lineY + 34 + 22;
        ctx.font = `400 31px Inter, 'Segoe UI', sans-serif`;
        ctx.fillStyle = 'rgba(236, 239, 247, 0.92)';
        subLines.forEach(line => {
            ctx.fillText(line, W / 2, y);
            y += subLineH;
        });
    }

    if (author) {
        ctx.font = `italic 500 25px Inter, 'Segoe UI', sans-serif`;
        ctx.fillStyle = '#ffbf36';
        ctx.fillText(author, W / 2, y + 12);
    }

    // Nút mời bấm xem
    const cta = '▶  Bấm để xem màn pháo hoa';
    ctx.font = `600 22px Inter, 'Segoe UI', sans-serif`;
    const ctaW = ctx.measureText(cta).width + 56;
    const ctaX = (W - ctaW) / 2;
    const ctaY = H - 74;
    const ctaFill = ctx.createLinearGradient(ctaX, 0, ctaX + ctaW, 0);
    ctaFill.addColorStop(0, '#6366f1');
    ctaFill.addColorStop(1, '#a855f7');
    ctx.fillStyle = ctaFill;
    ctx.shadowColor = 'rgba(124, 108, 255, 0.6)';
    ctx.shadowBlur = 20;
    roundRect(ctx, ctaX, ctaY, ctaW, 46, 23);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'middle';
    ctx.fillText(cta, W / 2, ctaY + 24);
}

export async function renderShareImageDataUrl(config) {
    const canvas = await renderShareImage(config);
    return canvas.toDataURL('image/jpeg', 0.88);
}
