/*!
 * Trình diễn Pháo hoa – trình phát: hình dạng
 * Phần bổ sung và chỉnh sửa © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Điểm của các pháo hình (trái tim, ngôi sao, bướm...) và chữ trên trời (kể cả biểu tượng cảm xúc giữ màu gốc).
// Mỗi điểm là hướng bay của một hạt, trong khoảng -1..1.

import { polyfillCountryFlagEmojis } from 'country-flag-emoji-polyfill';
import flagFontUrl from 'country-flag-emoji-polyfill/dist/TwemojiCountryFlags.woff2?url';

// Font emoji của Windows không có cờ (🇻🇳 hiện thành "VN"): trên máy thiếu cờ thì khai báo font cờ riêng.
// Font chỉ áp dụng cho ký tự cờ nên đặt đầu danh sách font cũng không đổi các chữ khác.
export const FLAG_FONT = 'Twemoji Country Flags';
const flagFontNeeded = polyfillCountryFlagEmojis(FLAG_FONT, flagFontUrl);
const TEXT_FONT = `"${FLAG_FONT}", Roboto, sans-serif`;
const FLAG_RE = /\p{Regional_Indicator}/u;

// Canvas chỉ vẽ bằng font đã tải xong: kịch bản có cờ thì tải font cờ trước khi trình diễn, không đợi tới phát bắn
export function preloadFlagFont(texts) {
    if (!flagFontNeeded || !texts.some(t => t && FLAG_RE.test(t))) return null;
    return document.fonts.load(`bold 50px "${FLAG_FONT}"`, '🇻🇳').catch(() => {});
}

// ---- Tùy chỉnh Hình dạng ----
const textCanvas = document.createElement('canvas');
const textCtx = textCanvas.getContext('2d', { willReadFrequently: true });

// Màu hạt lấy từ biểu tượng cảm xúc: kéo sáng lên cho nổi trên trời đêm (giữ sắc màu, vd mũ 🎓 xanh đen thành
// xanh dương), rồi gom về 16 mức mỗi kênh để không sinh quá nhiều nhóm màu khi vẽ
function emojiParticleColor(r, g, b) {
    const max = Math.max(r, g, b);
    const boost = max < 200 ? 200 / Math.max(max, 1) : 1;
    const channel = v => Math.min(255, Math.round(v * boost / 17) * 17).toString(16).padStart(2, '0');
    return `#${channel(r)}${channel(g)}${channel(b)}`;
}

// Phần điểm giữ lại trong lòng chữ (viền chữ giữ hết)
const TEXT_FILL = 0.55;

// Hạt của chữ đã dựng (vẽ chữ rồi đọc điểm ảnh tốn ~10 ms, chữ lặp lại hoặc kịch bản lặp thì dùng lại)
const textParticleCache = new Map();
const TEXT_CACHE_LIMIT = 60;
let textCacheLimit = TEXT_CACHE_LIMIT;

// Kịch bản có nhiều chữ hơn giới hạn: nới ra cho đủ, kẻo vòng lặp nào cũng dựng lại từng chữ
export function reserveTextCache(count) {
    textCacheLimit = Math.max(TEXT_CACHE_LIMIT, count + 20);
}

// ownColors: biểu tượng cảm xúc trong chữ (🎓, ❤️, 🎂...) giữ màu gốc của nó (điểm có thuộc tính color);
// chữ thường vẫn theo màu của phát pháo. Kết quả dùng chung, không được sửa.
export function getTextParticles(text, fontSize = 80, step = 3, ownColors = false) {
    const key = `${fontSize}|${step}|${ownColors ? 1 : 0}|${text}`;
    const cached = textParticleCache.get(key);
    if (cached) return cached;
    const result = buildTextParticles(text, fontSize, step, ownColors);
    // Phông chữ chưa tải xong thì chữ vẽ bằng phông thay thế: không lưu, lần sau dựng lại
    if (!document.fonts || document.fonts.status === 'loaded') {
        if (textParticleCache.size >= textCacheLimit) textParticleCache.delete(textParticleCache.keys().next().value);
        textParticleCache.set(key, result);
    }
    return result;
}

function buildTextParticles(text, fontSize, step, ownColors) {
    textCanvas.width = 1000; // Tăng chiều rộng để hỗ trợ văn bản dài hơn
    textCanvas.height = 200; // Tăng chiều cao
    textCtx.clearRect(0, 0, textCanvas.width, textCanvas.height);
    textCtx.font = `bold ${fontSize}px ${TEXT_FONT}`;
    // Chữ quá dài so với khung vẽ thì thu nhỏ cỡ chữ, tránh bị cắt mất hai đầu
    const maxTextWidth = textCanvas.width - 20;
    const textWidth = textCtx.measureText(text).width;
    if (textWidth > maxTextWidth) {
        textCtx.font = `bold ${Math.floor(fontSize * maxTextWidth / textWidth)}px ${TEXT_FONT}`;
    }
    textCtx.fillStyle = 'white';
    textCtx.textAlign = 'center';
    textCtx.textBaseline = 'middle';
    textCtx.fillText(text, textCanvas.width / 2, textCanvas.height / 2);

    const imgData = textCtx.getImageData(0, 0, textCanvas.width, textCanvas.height).data;
    // Vẽ lại bằng màu đen: chữ thường đổi màu theo, biểu tượng cảm xúc luôn vẽ bằng màu gốc nên giữ nguyên.
    // Nhờ vậy phần trắng của biểu tượng (⚽, 💬...) vẫn được nhận ra là biểu tượng.
    let darkData = null;
    // Cờ (cặp ký tự Regional_Indicator) không thuộc Extended_Pictographic nhưng cũng là biểu tượng màu
    if (ownColors && /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(text)) {
        textCtx.clearRect(0, 0, textCanvas.width, textCanvas.height);
        textCtx.fillStyle = 'black';
        textCtx.fillText(text, textCanvas.width / 2, textCanvas.height / 2);
        darkData = textCtx.getImageData(0, 0, textCanvas.width, textCanvas.height).data;
    }
    const points = [];

    // Lấy điểm theo lưới đều tăm tắp thì chữ trông như bảng đèn LED: mỗi ô lưới lấy một điểm lệch ngẫu nhiên trong ô. Viền
    // chữ giữ đủ điểm cho rõ nét, lòng chữ thưa bớt (còn TEXT_FILL) như chùm hạt pháo thật; biểu tượng màu giữ đủ điểm để
    // còn thấy hình
    const W = textCanvas.width;
    const H = textCanvas.height;
    const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H && imgData[((y | 0) * W + (x | 0)) * 4 + 3] > 128;
    let minX = W, maxX = 0, minY = H, maxY = 0;
    for (let gy = 0; gy < H; gy += step) {
        for (let gx = 0; gx < W; gx += step) {
            const x = Math.min(W - 1, gx + Math.random() * step);
            const y = Math.min(H - 1, gy + Math.random() * step);
            if (!inside(x, y)) continue;
            const index = ((y | 0) * W + (x | 0)) * 4;
            const point = { x, y };
            if (darkData) {
                const r = imgData[index];
                const g = imgData[index + 1];
                const b = imgData[index + 2];
                const change = Math.abs(r - darkData[index]) + Math.abs(g - darkData[index + 1]) + Math.abs(b - darkData[index + 2]);
                if (change < 60) point.color = emojiParticleColor(r, g, b);
            }
            const edge = !inside(x - step, y) || !inside(x + step, y) || !inside(x, y - step) || !inside(x, y + step);
            if (!edge && !point.color && Math.random() > TEXT_FILL) continue;
            points.push(point);
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
        }
    }

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const maxDist = Math.max(maxX - minX, maxY - minY) / 2 || 1;

    const result = points.map(p => ({
        x: (p.x - centerX) / maxDist,
        y: (p.y - centerY) / maxDist,
        color: p.color
    }));

    result.isText = true; // Đánh dấu đây là dữ liệu văn bản
    return result;
}

export function getHeartPoints() {
    const points = [];
    const count = 120;
    for (let i = 0; i < count; i++) {
        const t = (i / count) * Math.PI * 2;
        const x = 16 * Math.pow(Math.sin(t), 3);
        const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
        points.push({ x, y });
    }
    let maxDist = 0;
    for (let p of points) maxDist = Math.max(maxDist, Math.abs(p.x), Math.abs(p.y));
    return points.map(p => ({ x: p.x / maxDist, y: p.y / maxDist }));
}

export function getStarPoints() {
    const points = [];
    const spikes = 5;
    const outerRadius = 1;
    const innerRadius = 0.4;
    let rot = Math.PI / 2 * 3;
    let x = 0, y = 0;
    const step = Math.PI / spikes;
    const vertexes = [];
    for (let i = 0; i < spikes; i++) {
        x = Math.cos(rot) * outerRadius;
        y = Math.sin(rot) * outerRadius;
        vertexes.push({ x, y });
        rot += step;
        x = Math.cos(rot) * innerRadius;
        y = Math.sin(rot) * innerRadius;
        vertexes.push({ x, y });
        rot += step;
    }
    for (let i = 0; i < vertexes.length; i++) {
        let p1 = vertexes[i];
        let p2 = vertexes[(i + 1) % vertexes.length];
        const segments = 15;
        for (let j = 0; j < segments; j++) {
            points.push({
                x: p1.x + (p2.x - p1.x) * (j / segments),
                y: p1.y + (p2.y - p1.y) * (j / segments)
            });
        }
    }
    return points;
}

export function getSmileyPoints() {
    const points = [];
    const segments = 60;
    for (let i = 0; i < segments; i++) {
        const t = (i / segments) * Math.PI * 2;
        points.push({ x: Math.cos(t) * 0.9, y: Math.sin(t) * 0.9 });
    }
    points.push({ x: -0.3, y: -0.3 });
    points.push({ x: -0.3, y: -0.35 });
    points.push({ x: 0.3, y: -0.3 });
    points.push({ x: 0.3, y: -0.35 });
    const smileSegments = 30;
    for (let i = 0; i <= smileSegments; i++) {
        const t = Math.PI * 0.2 + (i / smileSegments) * Math.PI * 0.6;
        points.push({ x: Math.cos(t) * 0.6, y: Math.sin(t) * 0.6 });
    }
    return points;
}

export function getCatPoints() {
    const points = [];
    const segments = 50;
    for (let i = 0; i < segments; i++) {
        const t = (i / segments) * Math.PI * 2;
        points.push({ x: Math.cos(t) * 0.8, y: Math.sin(t) * 0.8 });
    }
    for (let i = 0; i <= 10; i++) {
        points.push({ x: -0.8 + (0.2) * i / 10, y: -0.3 - 0.7 * i / 10 });
        points.push({ x: -0.6 + (0.4) * i / 10, y: -1.0 + 0.5 * i / 10 });
        points.push({ x: 0.8 - (0.2) * i / 10, y: -0.3 - 0.7 * i / 10 });
        points.push({ x: 0.6 - (0.4) * i / 10, y: -1.0 + 0.5 * i / 10 });
    }
    points.push({ x: -0.3, y: -0.1 });
    points.push({ x: 0.3, y: -0.1 });
    for (let i = 0; i <= 5; i++) {
        points.push({ x: -0.5 - 0.4 * i / 5, y: 0.1 + 0.1 * i / 5 });
        points.push({ x: -0.5 - 0.4 * i / 5, y: 0.2 });
        points.push({ x: -0.5 - 0.4 * i / 5, y: 0.3 - 0.1 * i / 5 });
        points.push({ x: 0.5 + 0.4 * i / 5, y: 0.1 + 0.1 * i / 5 });
        points.push({ x: 0.5 + 0.4 * i / 5, y: 0.2 });
        points.push({ x: 0.5 + 0.4 * i / 5, y: 0.3 - 0.1 * i / 5 });
    }
    return points;
}

function getLeafPoints(petals = 4) {
    const points = [];
    for (let p = 0; p < petals; p++) {
        // Xoay để có một cánh ở trên cùng cho cỏ 3 lá, hoặc căn giữa cho cỏ 4 lá
        const angleOffset = (p / petals) * Math.PI * 2 - (petals === 3 ? Math.PI / 2 : 0);

        for (let i = 0; i < 40; i++) {
            const t = (i / 40) * Math.PI * 2;
            // Công thức hình trái tim
            let x = 16 * Math.pow(Math.sin(t), 3);
            let y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));

            // Chuẩn hóa và tỷ lệ lá
            x /= 18;
            y /= 18;

            // Di chuyển để cuống lá ở gần tâm
            y -= 0.8;

            // Tỷ lệ từng lá riêng lẻ
            x *= 0.45;
            y *= 0.45;

            // Xoay lá
            const cosA = Math.cos(angleOffset);
            const sinA = Math.sin(angleOffset);
            points.push({
                x: x * cosA - y * sinA,
                y: x * sinA + y * cosA
            });
        }
    }
    // Không cần thân cây theo yêu cầu người dùng
    return points;
}

export function getCloverPoints() {
    return getLeafPoints(4);
}

export function getClover3Points() {
    return getLeafPoints(3);
}

export function getSaturnPoints() {
    const points = [];
    for (let i = 0; i < 60; i++) {
        const t = (i / 60) * Math.PI * 2;
        points.push({ x: Math.cos(t) * 0.4, y: Math.sin(t) * 0.4 });
    }
    for (let i = 0; i < 90; i++) {
        const t = (i / 90) * Math.PI * 2;
        points.push({ x: Math.cos(t) * 1.0, y: Math.sin(t) * 0.25 });
    }
    return points;
}

export function getSnowflakePoints() {
    const points = [];
    const arms = 6;

    // Lõi trung tâm
    for (let i = 0; i < 30; i++) {
        const t = (i / 30) * Math.PI * 2;
        points.push({ x: Math.cos(t) * 0.1, y: Math.sin(t) * 0.1 });
    }

    for (let i = 0; i < arms; i++) {
        const angle = (i / arms) * Math.PI * 2;
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);

        // Cánh chính
        for (let j = 1; j <= 25; j++) {
            const r = j / 25;
            points.push({ x: cosA * r, y: sinA * r });

            // Các nhánh phụ (V-shape)
            if (j === 12 || j === 18 || j === 22) {
                const branchLen = j === 12 ? 0.25 : (j === 18 ? 0.18 : 0.12);
                const branchAngle = Math.PI / 3;
                for (let k = 1; k <= 8; k++) {
                    const brR = (k / 8) * branchLen;
                    // Nhánh phải
                    const rA = angle + branchAngle;
                    points.push({ x: cosA * r + Math.cos(rA) * brR, y: sinA * r + Math.sin(rA) * brR });
                    // Nhánh trái
                    const lA = angle - branchAngle;
                    points.push({ x: cosA * r + Math.cos(lA) * brR, y: sinA * r + Math.sin(lA) * brR });
                }
            }
        }
    }
    return points;
}

export function getLotusPoints() {
    const points = [];
    const petals = 12;
    for (let p = 0; p < petals; p++) {
        const angleOffset = (p / petals) * Math.PI * 2;
        const layer = p % 2 === 0 ? 0.8 : 0.5;
        for (let i = 0; i <= 20; i++) {
            const t = (i / 20) * Math.PI;
            const r = Math.sin(t) * layer;
            const angle = angleOffset + (t - Math.PI / 2) * 0.5;
            points.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });
        }
    }
    return points;
}

export function getButterflyPoints() {
    const points = [];
    for (let i = 0; i <= 100; i++) {
        const t = (i / 100) * Math.PI * 2;
        const x = Math.sin(t) * (Math.exp(Math.cos(t)) - 2 * Math.cos(4 * t) - Math.pow(Math.sin(t / 12), 5));
        const y = -Math.cos(t) * (Math.exp(Math.cos(t)) - 2 * Math.cos(4 * t) - Math.pow(Math.sin(t / 12), 5));
        points.push({ x: x * 0.3, y: y * 0.3 });
    }
    return points;
}

export function getDiamondPoints() {
    const points = [];
    const drawLine = (x1, y1, x2, y2, density = 15) => {
        for (let i = 0; i <= density; i++) {
            points.push({
                x: x1 + (x2 - x1) * (i / density),
                y: y1 + (y2 - y1) * (i / density)
            });
        }
    };

    // Đường viền và các mặt (Facets)
    drawLine(-0.35, -0.6, 0.35, -0.6); // Mặt bàn (Top table)
    drawLine(-0.35, -0.6, -0.7, -0.2); // Vương miện trái (Left crown)
    drawLine(0.35, -0.6, 0.7, -0.2);  // Vương miện phải (Right crown)
    drawLine(-0.7, -0.2, 0.7, -0.2);  // Thắt lưng (Girdle)
    drawLine(-0.7, -0.2, 0, 0.8);     // Đáy trái (Left pavilion)
    drawLine(0.7, -0.2, 0, 0.8);      // Đáy phải (Right pavilion)

    // Các đường cắt giác bên trong
    drawLine(-0.35, -0.6, 0, -0.2, 10);
    drawLine(0.35, -0.6, 0, -0.2, 10);
    drawLine(0, -0.6, 0, 0.8, 20);      // Trục giữa dọc
    drawLine(-0.7, -0.2, 0, -0.2, 10);
    drawLine(0.7, -0.2, 0, -0.2, 10);
    drawLine(0, -0.2, 0, 0.8, 15);      // Đường đáy giữa

    return points;
}
