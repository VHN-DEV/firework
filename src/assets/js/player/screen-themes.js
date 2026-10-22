/*!
 * Trình diễn Pháo hoa – trình phát: giao diện màn mở quà và màn kết theo dịp
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// ---------------------------------------------------------------------------
// GIAO DIỆN MÀN MỞ QUÀ & MÀN KẾT: bộ có sẵn theo dịp (Tết, Giáng sinh, sinh nhật...) gồm màu, kiểu chữ tiêu đề, hiệu
// ứng nền (tuyết rơi, hoa mai đào, trái tim bay...), biểu tượng và kiểu thiệp. Kịch bản lưu `screenTheme`:
// { preset: 'tet', ...phần tự chỉnh } (chỉ lưu những gì khác bộ đã chọn). Dùng chung cho trình phát và builder.
// Thêm bộ mới: thêm một mục vào SCREEN_THEMES (và nếu cần, một kiểu chữ trong SCREEN_FONTS, hiệu ứng trong
// SCREEN_EFFECTS kèm cách vẽ trong EFFECT_MAKERS).
// ---------------------------------------------------------------------------

// Kiểu chữ tiêu đề (Google Fonts, có dấu tiếng Việt). scale: cỡ chữ so với mặc định (chữ viết tay nhỏ hơn cùng cỡ);
// script: kiểu viết tay, tiêu đề VIẾT HOA được đổi sang Viết Hoa Đầu Từ cho dễ đọc
export const SCREEN_FONTS = {
    '': { name: 'Mặc định', family: '', weight: 700, scale: 1 },
    dancing: { name: 'Viết tay', family: 'Dancing Script', weight: 700, scale: 1.12, script: true, google: 'Dancing+Script:wght@700' },
    vibes: { name: 'Bay bổng', family: 'Great Vibes', weight: 400, scale: 1.3, script: true, google: 'Great+Vibes' },
    pacifico: { name: 'Tròn vui', family: 'Pacifico', weight: 400, scale: 0.92, script: true, google: 'Pacifico' },
    lobster: { name: 'Lễ hội', family: 'Lobster', weight: 400, scale: 1.05, script: true, google: 'Lobster' },
    playfair: { name: 'Cổ điển', family: 'Playfair Display', weight: 700, scale: 1, google: 'Playfair+Display:wght@700' },
    hand: { name: 'Nét bút', family: 'Patrick Hand', weight: 400, scale: 1.12, google: 'Patrick+Hand' }
};

// Hiệu ứng nền sau thiệp (lớp vẽ riêng, chỉ chạy khi màn mở quà hoặc màn kết đang hiện)
export const SCREEN_EFFECTS = {
    '': { name: 'Không', icon: '⛔' },
    snow: { name: 'Tuyết rơi', icon: '❄️' },
    blossom: { name: 'Hoa mai, đào', icon: '🌼' },
    petals: { name: 'Cánh hoa', icon: '🌸' },
    hearts: { name: 'Trái tim', icon: '💕' },
    confetti: { name: 'Pháo giấy', icon: '🎊' },
    balloons: { name: 'Bóng bay', icon: '🎈' },
    lanterns: { name: 'Đèn lồng', icon: '🏮' },
    stars: { name: 'Lấp lánh', icon: '✨' }
};

// Kiểu thiệp: kính mờ trong suốt, đậm màu chủ đạo, giấy sáng màu ngà (chữ tối)
export const SCREEN_CARDS = {
    glass: 'Kính mờ',
    tint: 'Đậm màu',
    light: 'Giấy sáng'
};

// Biểu tượng chọn nhanh trên thiệp chào và màn kết
export const SCREEN_ICONS = ['🎁', '💌', '🧧', '🎄', '🎅', '⛄', '🎂', '🎈', '💖', '🌹', '💍', '🎓', '🌷', '💐', '📚', '🏮', '🌕', '🎆', '✨', '🎉'];

// main: màu chính (nút, hộp quà, nền thiệp đậm màu); accent: màu nhấn (chữ người gửi, ruy băng, quầng sáng);
// border: viền kép trang trọng quanh thiệp
export const SCREEN_THEMES = [
    { id: '', name: 'Cổ điển', icon: '🎁', main: '#ff0043', accent: '#ffbf36', font: '', effect: '', card: 'glass', border: false },
    { id: 'tet', name: 'Tết', icon: '🧧', main: '#d7141a', accent: '#ffd23f', font: 'playfair', effect: 'blossom', card: 'tint', border: true },
    { id: 'noel', name: 'Giáng sinh', icon: '🎄', main: '#c41e3a', accent: '#ffd166', font: 'lobster', effect: 'snow', card: 'tint', border: false },
    { id: 'birthday', name: 'Sinh nhật', icon: '🎂', main: '#ff4fa3', accent: '#ffd166', font: 'pacifico', effect: 'balloons', card: 'glass', border: false },
    { id: 'love', name: 'Tình yêu', icon: '💖', main: '#ff2d6f', accent: '#ffb3c7', font: 'dancing', effect: 'hearts', card: 'tint', border: false },
    { id: 'wedding', name: 'Đám cưới', icon: '💍', main: '#b8862b', accent: '#f3dca8', font: 'vibes', effect: 'petals', card: 'light', border: true },
    { id: 'graduation', name: 'Tốt nghiệp', icon: '🎓', main: '#2856d6', accent: '#ffd166', font: 'playfair', effect: 'stars', card: 'tint', border: true },
    { id: 'women', name: 'Ngày Phụ nữ', icon: '🌷', main: '#b14ee8', accent: '#ffc2e2', font: 'dancing', effect: 'petals', card: 'glass', border: false },
    { id: 'teacher', name: 'Nhà giáo', icon: '📚', main: '#1f9d55', accent: '#ffe08a', font: 'hand', effect: 'petals', card: 'tint', border: false },
    { id: 'midautumn', name: 'Trung thu', icon: '🏮', main: '#e8590c', accent: '#ffcf6b', font: 'lobster', effect: 'lanterns', card: 'tint', border: true }
];

const HEX = /^#[0-9a-f]{6}$/i;

// Giao diện đầy đủ từ `screenTheme` của kịch bản: bộ có sẵn + phần tự chỉnh (giá trị lạ thì bỏ qua)
export function resolveScreenTheme(spec) {
    const own = spec && typeof spec === 'object' ? spec : { preset: typeof spec === 'string' ? spec : '' };
    const base = SCREEN_THEMES.find(t => t.id === own.preset) || SCREEN_THEMES[0];
    const theme = { ...base };
    if (HEX.test(own.main)) theme.main = own.main;
    if (HEX.test(own.accent)) theme.accent = own.accent;
    if (typeof own.font === 'string' && own.font in SCREEN_FONTS) theme.font = own.font;
    if (typeof own.effect === 'string' && own.effect in SCREEN_EFFECTS) theme.effect = own.effect;
    if (typeof own.card === 'string' && own.card in SCREEN_CARDS) theme.card = own.card;
    if (typeof own.border === 'boolean') theme.border = own.border;
    if (typeof own.icon === 'string' && own.icon.trim()) theme.icon = [...own.icon.trim()].slice(0, 4).join('');
    return theme;
}

// Phần tự chỉnh so với bộ có sẵn (để lưu gọn vào kịch bản); bộ Cổ điển không chỉnh gì thì không lưu
export function compactScreenTheme(theme) {
    const base = SCREEN_THEMES.find(t => t.id === theme.id) || SCREEN_THEMES[0];
    const out = { preset: base.id || undefined };
    ['main', 'accent', 'font', 'effect', 'card', 'border', 'icon'].forEach(key => {
        if (theme[key] !== base[key]) out[key] = theme[key];
    });
    return Object.values(out).some(v => v !== undefined) ? out : undefined;
}

const toRgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const mixRgb = (rgb, target, t) => rgb.map((v, i) => Math.round(v + (target[i] - v) * t));
const css = rgb => `rgb(${rgb.join(', ')})`;

// Tiêu đề VIẾT HOA với kiểu chữ viết tay: đổi sang Viết Hoa Đầu Từ (chữ viết tay in hoa toàn bộ rất khó đọc)
export function themedTitle(text, theme) {
    const value = String(text || '');
    const font = SCREEN_FONTS[theme && theme.font];
    if (!font || !font.script || value !== value.toLocaleUpperCase('vi') || value === value.toLocaleLowerCase('vi')) return value;
    return value.toLocaleLowerCase('vi').replace(/(^|[\s"“'(\-])(\p{L})/gu, (m, sep, ch) => sep + ch.toLocaleUpperCase('vi'));
}

const loadedFonts = new Map();

// Tải kiểu chữ của giao diện (một lần); xong (hoặc chờ quá lâu) thì báo để hiện thiệp không bị nhảy chữ
export function loadScreenFont(fontKey) {
    const font = SCREEN_FONTS[fontKey];
    if (!font || !font.google || typeof document === 'undefined') return Promise.resolve();
    if (!loadedFonts.has(fontKey)) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = `https://fonts.googleapis.com/css2?family=${font.google}&display=swap`;
        document.head.appendChild(link);
        const ready = new Promise(resolve => {
            link.addEventListener('load', () => {
                const load = document.fonts && document.fonts.load ? document.fonts.load(`${font.weight} 1em "${font.family}"`, 'Chúc mừng') : Promise.resolve();
                load.then(resolve, resolve);
            });
            link.addEventListener('error', resolve);
        });
        loadedFonts.set(fontKey, ready);
    }
    return Promise.race([loadedFonts.get(fontKey), new Promise(resolve => setTimeout(resolve, 1500))]);
}

// Đặt giao diện lên trang (biến màu, kiểu chữ, kiểu thiệp). Trả về promise xong khi kiểu chữ đã tải.
export function applyScreenTheme(theme) {
    const root = document.documentElement;
    const main = toRgb(theme.main);
    const accent = toRgb(theme.accent);
    const font = SCREEN_FONTS[theme.font] || SCREEN_FONTS[''];
    const vars = {
        '--st-main': theme.main,
        '--st-main-rgb': main.join(', '),
        '--st-main-light': css(mixRgb(main, [255, 255, 255], 0.3)),
        '--st-main-dark': css(mixRgb(main, [0, 0, 0], 0.32)),
        '--st-main-deep': css(mixRgb(main, [0, 0, 0], 0.72)),
        // Nền màn chờ: bộ Cổ điển giữ xám đen như trước, các bộ khác ngả nhẹ theo màu chính
        '--st-bg': theme.id || theme.main !== SCREEN_THEMES[0].main ? css(mixRgb(main, [12, 12, 14], 0.8)) : '#1a1a1a',
        '--st-accent': theme.accent,
        '--st-accent-rgb': accent.join(', '),
        '--st-accent-light': css(mixRgb(accent, [255, 255, 255], 0.35)),
        '--st-accent-dark': css(mixRgb(accent, [0, 0, 0], 0.15)),
        '--st-font': font.family ? `"${font.family}", "Roboto", arial, sans-serif` : 'inherit',
        '--st-font-weight': String(font.weight),
        '--st-font-scale': String(font.scale)
    };
    Object.entries(vars).forEach(([key, value]) => root.style.setProperty(key, value));
    root.dataset.stTheme = theme.id || 'classic';
    root.dataset.stCard = theme.card;
    root.dataset.stFont = font.script ? 'script' : theme.font ? 'display' : '';
    root.classList.toggle('st-border', !!theme.border);
    currentTheme = theme;
    return loadScreenFont(theme.font);
}

let currentTheme = SCREEN_THEMES[0];

// Màu pháo giấy, ruy băng khi bung hộp quà: theo giao diện (kèm vài màu tươi cho rực rỡ)
export function themeConfettiColors() {
    const t = currentTheme;
    if (!t.id && t.main === SCREEN_THEMES[0].main && t.accent === SCREEN_THEMES[0].accent) {
        return ['#ff0043', '#ffbf36', '#14fc56', '#1e7fff', '#e60aff', '#ffffff', '#ff6ad5'];
    }
    const main = toRgb(t.main);
    const accent = toRgb(t.accent);
    return [t.main, t.main, t.accent, t.accent, css(mixRgb(main, [255, 255, 255], 0.45)), css(mixRgb(accent, [255, 255, 255], 0.5)), '#ffffff'];
}

// ---------------------------------------------------------------------------
// Hiệu ứng nền: mỗi kiểu tạo các hạt (vị trí, tốc độ, hình vẽ sẵn) rồi cập nhật, vẽ mỗi khung hình
// ---------------------------------------------------------------------------

const rand = (a, b) => a + Math.random() * (b - a);

// Ảnh vẽ sẵn của một hạt (cỡ s x s điểm ảnh), dùng lại cho mọi hạt cùng kiểu, cùng màu
function sprite(size, draw) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    draw(c.getContext('2d'), size);
    return c;
}

const flowerSprite = (petal, center, size = 48) => sprite(size, (g, s) => {
    g.translate(s / 2, s / 2);
    for (let i = 0; i < 5; i++) {
        g.save();
        g.rotate((i / 5) * Math.PI * 2);
        const grad = g.createLinearGradient(0, 0, 0, -s * 0.46);
        grad.addColorStop(0, center);
        grad.addColorStop(0.35, petal);
        grad.addColorStop(1, petal);
        g.fillStyle = grad;
        g.beginPath();
        g.ellipse(0, -s * 0.22, s * 0.15, s * 0.24, 0, 0, Math.PI * 2);
        g.fill();
        g.restore();
    }
    g.fillStyle = center;
    g.beginPath();
    g.arc(0, 0, s * 0.08, 0, Math.PI * 2);
    g.fill();
    // Nhụy hoa: chấm nhỏ tỏa ra
    g.fillStyle = 'rgba(255, 240, 200, 0.9)';
    for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        g.beginPath();
        g.arc(Math.cos(a) * s * 0.12, Math.sin(a) * s * 0.12, s * 0.018, 0, Math.PI * 2);
        g.fill();
    }
});

const petalSprite = (color, size = 32) => sprite(size, (g, s) => {
    const grad = g.createRadialGradient(s * 0.4, s * 0.35, 0, s / 2, s / 2, s * 0.5);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
    grad.addColorStop(0.35, color);
    grad.addColorStop(1, color);
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(s / 2, s * 0.06);
    g.bezierCurveTo(s * 0.92, s * 0.25, s * 0.82, s * 0.85, s / 2, s * 0.94);
    g.bezierCurveTo(s * 0.18, s * 0.85, s * 0.08, s * 0.25, s / 2, s * 0.06);
    g.fill();
});

const heartSprite = (color, size = 48) => sprite(size, (g, s) => {
    g.translate(s / 2, s * 0.56);
    const k = s / 36;
    const grad = g.createRadialGradient(-6 * k, -8 * k, 0, 0, 0, 18 * k);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.75)');
    grad.addColorStop(0.3, color);
    grad.addColorStop(1, color);
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(0, 12 * k);
    g.bezierCurveTo(-18 * k, 0, -14 * k, -16 * k, 0, -7 * k);
    g.bezierCurveTo(14 * k, -16 * k, 18 * k, 0, 0, 12 * k);
    g.fill();
});

const glowSprite = (color, size = 32) => sprite(size, (g, s) => {
    const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.25, color);
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, s, s);
});

const sparkleSprite = (color, size = 40) => sprite(size, (g, s) => {
    g.translate(s / 2, s / 2);
    const glow = g.createRadialGradient(0, 0, 0, 0, 0, s / 2);
    glow.addColorStop(0, color);
    glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
    g.globalAlpha = 0.45;
    g.fillStyle = glow;
    g.fillRect(-s / 2, -s / 2, s, s);
    g.globalAlpha = 1;
    g.fillStyle = '#fff';
    g.beginPath();
    for (let i = 0; i < 8; i++) {
        const r = i % 2 ? s * 0.06 : s * 0.46;
        const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
        g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    g.closePath();
    g.fill();
});

const balloonSprite = (color, size = 64) => sprite(size, (g, s) => {
    const cx = s / 2;
    const r = s * 0.27;
    g.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(cx, s * 0.66);
    g.quadraticCurveTo(cx - s * 0.06, s * 0.8, cx + s * 0.02, s * 0.98);
    g.stroke();
    const grad = g.createRadialGradient(cx - r * 0.35, s * 0.3, 0, cx, s * 0.36, r * 1.15);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
    grad.addColorStop(0.25, color);
    grad.addColorStop(1, color);
    g.fillStyle = grad;
    g.beginPath();
    g.ellipse(cx, s * 0.36, r, r * 1.18, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(cx - s * 0.03, s * 0.66);
    g.lineTo(cx + s * 0.03, s * 0.66);
    g.lineTo(cx, s * 0.62);
    g.fill();
});

const lanternSprite = (color, accent, size = 72) => sprite(size, (g, s) => {
    const cx = s / 2;
    const glow = g.createRadialGradient(cx, s * 0.5, 0, cx, s * 0.5, s * 0.5);
    glow.addColorStop(0, 'rgba(255, 190, 90, 0.45)');
    glow.addColorStop(1, 'rgba(255, 150, 60, 0)');
    g.fillStyle = glow;
    g.fillRect(0, 0, s, s);
    const body = g.createRadialGradient(cx, s * 0.5, s * 0.03, cx, s * 0.5, s * 0.24);
    body.addColorStop(0, '#fff3c4');
    body.addColorStop(0.45, color);
    body.addColorStop(1, color);
    g.fillStyle = body;
    g.beginPath();
    g.ellipse(cx, s * 0.5, s * 0.2, s * 0.24, 0, 0, Math.PI * 2);
    g.fill();
    // Nan đèn
    g.strokeStyle = 'rgba(120, 40, 10, 0.35)';
    g.lineWidth = 1;
    [-0.1, 0, 0.1].forEach(dx => {
        g.beginPath();
        g.ellipse(cx, s * 0.5, Math.abs(dx) * s + 0.5, s * 0.24, 0, 0, Math.PI * 2);
        g.stroke();
    });
    g.fillStyle = accent;
    g.fillRect(cx - s * 0.09, s * 0.25, s * 0.18, s * 0.04);
    g.fillRect(cx - s * 0.09, s * 0.71, s * 0.18, s * 0.04);
    g.strokeStyle = accent;
    g.beginPath();
    g.moveTo(cx, s * 0.75);
    g.lineTo(cx, s * 0.86);
    g.stroke();
});

// Mỗi kiểu: số hạt (máy tính), tạo hạt (lần đầu thì rải khắp màn hình, sau đó vào từ mép), cập nhật và vẽ
const EFFECT_MAKERS = {
    snow: theme => {
        const flake = glowSprite('rgba(235, 245, 255, 0.85)');
        return {
            count: 90,
            spawn: (W, H, first) => ({ x: rand(0, W), y: first ? rand(0, H) : rand(-30, -5), r: rand(1.2, 4.2), vy: rand(22, 58), sway: rand(0.4, 1.4), ph: rand(0, 6), a: rand(0.5, 0.95) }),
            step: (p, dt, t) => { p.y += p.vy * (0.4 + p.r / 5) * dt; p.x += Math.sin(t * p.sway + p.ph) * 14 * dt; },
            draw: (g, p) => { g.globalAlpha = p.a; g.drawImage(flake, p.x - p.r * 2, p.y - p.r * 2, p.r * 4, p.r * 4); },
            gone: (p, W, H) => p.y > H + 20
        };
    },
    blossom: theme => {
        const mai = flowerSprite('#ffd23f', '#e8890c');
        const dao = flowerSprite('#ff9ec4', '#d6336c');
        const petals = [petalSprite('#ffd23f'), petalSprite('#ffb3cf')];
        return {
            count: 34,
            spawn: (W, H, first) => {
                const flower = Math.random() < 0.55;
                return {
                    x: rand(0, W), y: first ? rand(0, H) : rand(-40, -10), size: flower ? rand(14, 26) : rand(8, 13),
                    img: flower ? (Math.random() < 0.5 ? mai : dao) : petals[(Math.random() * 2) | 0], flower,
                    vy: rand(26, 52), sway: rand(0.5, 1.2), ph: rand(0, 6), rot: rand(0, 6), spin: rand(-1.2, 1.2), flip: rand(0, 6)
                };
            },
            step: (p, dt, t) => {
                p.y += p.vy * dt;
                p.x += Math.sin(t * p.sway + p.ph) * 22 * dt;
                p.rot += p.spin * dt;
                p.flip += dt * 2.2;
            },
            draw: (g, p) => {
                g.globalAlpha = 0.95;
                g.save();
                g.translate(p.x, p.y);
                g.rotate(p.rot);
                // Hoa xoay nghiêng khi rơi (dẹt theo một chiều)
                g.scale(p.flower ? 0.75 + 0.25 * Math.cos(p.flip) : Math.cos(p.flip), 1);
                g.drawImage(p.img, -p.size / 2, -p.size / 2, p.size, p.size);
                g.restore();
            },
            gone: (p, W, H) => p.y > H + 30
        };
    },
    petals: theme => {
        const colors = [theme.accent, mixHex(theme.main, '#ffffff', 0.45), '#ffffff', mixHex(theme.accent, '#ffffff', 0.4)];
        const imgs = colors.map(c => petalSprite(c));
        return {
            count: 42,
            spawn: (W, H, first) => ({
                x: rand(0, W), y: first ? rand(0, H) : rand(-30, -8), size: rand(9, 16), img: imgs[(Math.random() * imgs.length) | 0],
                vy: rand(30, 60), sway: rand(0.6, 1.5), ph: rand(0, 6), rot: rand(0, 6), spin: rand(-1.6, 1.6), flip: rand(0, 6), flipSpeed: rand(1.5, 3.5)
            }),
            step: (p, dt, t) => {
                p.y += p.vy * dt;
                p.x += (Math.sin(t * p.sway + p.ph) * 26 + 8) * dt;
                p.rot += p.spin * dt;
                p.flip += p.flipSpeed * dt;
            },
            draw: (g, p) => {
                g.globalAlpha = 0.9;
                g.save();
                g.translate(p.x, p.y);
                g.rotate(p.rot);
                g.scale(Math.cos(p.flip), 1);
                g.drawImage(p.img, -p.size / 2, -p.size / 2, p.size, p.size);
                g.restore();
            },
            gone: (p, W, H) => p.y > H + 30 || p.x > W + 40
        };
    },
    hearts: theme => {
        const imgs = [theme.main, theme.accent, mixHex(theme.main, '#ffffff', 0.35)].map(c => heartSprite(c));
        return {
            count: 26,
            spawn: (W, H, first) => ({
                x: rand(0, W), y: first ? rand(H * 0.2, H + 20) : H + rand(10, 40), size: rand(12, 30), img: imgs[(Math.random() * 3) | 0],
                vy: rand(22, 48), sway: rand(0.6, 1.3), ph: rand(0, 6), life: 0
            }),
            step: (p, dt, t) => { p.y -= p.vy * dt; p.x += Math.sin(t * p.sway + p.ph) * 18 * dt; p.life += dt; },
            draw: (g, p, W, H) => {
                // Mờ dần khi bay lên cao, hiện dần lúc mới xuất hiện
                g.globalAlpha = Math.max(0, Math.min(1, p.life * 1.5, (p.y + 40) / (H * 0.55))) * 0.85;
                const wob = 1 + Math.sin(p.ph + p.life * 3) * 0.06;
                g.drawImage(p.img, p.x - p.size * wob / 2, p.y - p.size * wob / 2, p.size * wob, p.size * wob);
            },
            gone: p => p.y < -40
        };
    },
    confetti: theme => {
        const colors = [theme.main, theme.accent, '#ffffff', '#4dabf7', '#69db7c', '#ff922b', mixHex(theme.main, '#ffffff', 0.4)];
        return {
            count: 70,
            spawn: (W, H, first) => ({
                x: rand(0, W), y: first ? rand(0, H) : rand(-30, -5), w: rand(5, 9), h: rand(8, 14), color: colors[(Math.random() * colors.length) | 0],
                vy: rand(50, 110), sway: rand(0.8, 2), ph: rand(0, 6), rot: rand(0, 6), spin: rand(-3, 3), flip: rand(0, 6), flipSpeed: rand(3, 7)
            }),
            step: (p, dt, t) => {
                p.y += p.vy * dt;
                p.x += Math.sin(t * p.sway + p.ph) * 30 * dt;
                p.rot += p.spin * dt;
                p.flip += p.flipSpeed * dt;
            },
            draw: (g, p) => {
                g.globalAlpha = 0.9;
                g.save();
                g.translate(p.x, p.y);
                g.rotate(p.rot);
                g.fillStyle = p.color;
                const h = p.h * Math.abs(Math.cos(p.flip));
                g.fillRect(-p.w / 2, -h / 2, p.w, h);
                g.restore();
            },
            gone: (p, W, H) => p.y > H + 20
        };
    },
    balloons: theme => {
        const imgs = [theme.main, theme.accent, '#4dabf7', '#69db7c', '#b197fc', mixHex(theme.main, '#ffffff', 0.35)].map(c => balloonSprite(c));
        return {
            count: 14,
            spawn: (W, H, first) => ({
                x: rand(0, W), y: first ? rand(H * 0.1, H + 60) : H + rand(40, 90), size: rand(48, 86), img: imgs[(Math.random() * imgs.length) | 0],
                vy: rand(28, 52), sway: rand(0.4, 0.9), ph: rand(0, 6), tilt: rand(-0.12, 0.12)
            }),
            step: (p, dt, t) => { p.y -= p.vy * dt; p.x += Math.sin(t * p.sway + p.ph) * 12 * dt; },
            draw: (g, p, W, H, t) => {
                g.globalAlpha = 0.92;
                g.save();
                g.translate(p.x, p.y);
                g.rotate(p.tilt + Math.sin(t * p.sway * 1.3 + p.ph) * 0.08);
                g.drawImage(p.img, -p.size / 2, -p.size / 2, p.size, p.size);
                g.restore();
            },
            gone: (p, W, H) => p.y < -p.size
        };
    },
    lanterns: theme => {
        const imgs = [lanternSprite(theme.main, theme.accent), lanternSprite('#e8590c', '#ffd23f'), lanternSprite('#d7141a', '#ffd23f')];
        return {
            count: 12,
            spawn: (W, H, first) => ({
                x: rand(0, W), y: first ? rand(H * 0.15, H + 60) : H + rand(40, 90), size: rand(46, 84), img: imgs[(Math.random() * 3) | 0],
                vy: rand(14, 30), sway: rand(0.3, 0.7), ph: rand(0, 6), flick: rand(0, 6)
            }),
            step: (p, dt, t) => { p.y -= p.vy * dt; p.x += Math.sin(t * p.sway + p.ph) * 8 * dt; },
            draw: (g, p, W, H, t) => {
                // Lửa nến trong đèn chập chờn; lên cao thì mờ dần
                g.globalAlpha = Math.min(1, (p.y + 60) / (H * 0.4)) * (0.82 + 0.18 * Math.sin(t * 7 + p.flick) * Math.sin(t * 3.1 + p.flick));
                g.drawImage(p.img, p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
            },
            gone: p => p.y < -100
        };
    },
    stars: theme => {
        const imgs = [sparkleSprite(theme.accent), sparkleSprite('#ffffff'), sparkleSprite(mixHex(theme.main, '#ffffff', 0.5))];
        return {
            count: 46,
            spawn: (W, H) => ({ x: rand(0, W), y: rand(0, H), size: rand(8, 22), img: imgs[(Math.random() * 3) | 0], ph: rand(0, 6), speed: rand(0.8, 2), life: 0, span: rand(3, 7), vy: rand(-6, -2) }),
            step: (p, dt) => { p.life += dt; p.y += p.vy * dt; },
            draw: (g, p) => {
                // Lấp lánh: chớp sáng rồi tắt dần, xoay nhẹ
                const twinkle = Math.pow(Math.max(0, Math.sin(p.ph + p.life * p.speed * 2)), 3);
                const fade = Math.min(1, p.life, p.span - p.life);
                g.globalAlpha = Math.max(0, twinkle * fade);
                const s = p.size * (0.6 + 0.4 * twinkle);
                g.drawImage(p.img, p.x - s / 2, p.y - s / 2, s, s);
            },
            gone: p => p.life > p.span
        };
    }
};

function mixHex(a, b, t) {
    return css(mixRgb(toRgb(a), toRgb(b), t));
}

// Lớp hiệu ứng nền của một màn (màn mở quà hoặc màn kết): canvas phủ kín màn, nằm sau thiệp. Tự dừng khi màn ẩn đi.
export function createScreenAmbient(host) {
    let canvas = null;
    let frame = 0;
    let maker = null;
    let parts = [];
    let key = '';
    const hidden = () => host.classList.contains('hide') || host.classList.contains('remove') || !host.isConnected;

    const stop = () => {
        cancelAnimationFrame(frame);
        frame = 0;
        if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    };

    function start(theme, { lowQuality = false } = {}) {
        const effect = theme && EFFECT_MAKERS[theme.effect];
        if (!effect) {
            stop();
            if (canvas) canvas.hidden = true;
            key = '';
            return;
        }
        if (!canvas) {
            canvas = document.createElement('canvas');
            canvas.className = 'screen-ambient';
            canvas.setAttribute('aria-hidden', 'true');
            host.prepend(canvas);
        }
        canvas.hidden = false;
        const nextKey = `${theme.effect}_${theme.main}_${theme.accent}`;
        const W = window.innerWidth;
        const H = window.innerHeight;
        if (nextKey !== key || !parts.length) {
            key = nextKey;
            maker = effect(theme);
            const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            // Màn hình nhỏ, máy yếu, người xem muốn giảm chuyển động: ít hạt hơn
            const scale = Math.min(1, (W * H) / (1280 * 720)) * (lowQuality ? 0.6 : 1) * (reduced ? 0.4 : 1);
            parts = Array.from({ length: Math.max(6, Math.round(maker.count * Math.max(0.45, scale))) }, () => maker.spawn(W, H, true));
            maker.slow = reduced ? 0.4 : 1;
        }
        if (frame) return;
        let last = performance.now();
        const loop = now => {
            if (hidden()) {
                stop();
                return;
            }
            const w = window.innerWidth;
            const h = window.innerHeight;
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
                canvas.width = Math.round(w * dpr);
                canvas.height = Math.round(h * dpr);
            }
            const g = canvas.getContext('2d');
            g.setTransform(dpr, 0, 0, dpr, 0, 0);
            g.clearRect(0, 0, w, h);
            const dt = Math.min(0.05, (now - last) / 1000) * maker.slow;
            last = now;
            const t = now / 1000;
            for (let i = 0; i < parts.length; i++) {
                const p = parts[i];
                maker.step(p, dt, t);
                if (maker.gone(p, w, h)) parts[i] = maker.spawn(w, h, false);
                maker.draw(g, parts[i], w, h, t);
            }
            g.globalAlpha = 1;
            frame = requestAnimationFrame(loop);
        };
        frame = requestAnimationFrame(loop);
    }

    return { start, stop };
}
