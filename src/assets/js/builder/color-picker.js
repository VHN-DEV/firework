/*!
 * Hanabi – builder (bảng chọn màu)
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Bảng chọn màu vẽ theo giao diện builder thay cho bảng gốc của trình duyệt (trên Windows là khung trắng, lạc tông). Ô
// <input type="color"> gốc vẫn là ô hiển thị và giữ giá trị: kéo trong bảng thì phát sự kiện input (xem trực tiếp), đóng bảng
// thì phát change như bảng gốc, nên các ô đang dùng không phải sửa gì. Ô có data-picker-submit="<id nút>" thì cuối bảng có
// thêm nút làm việc của nút đó (data-picker-submit-label là chữ trên nút), vd. Thêm màu.

import { COLOR } from './constants.js';

const RECENT_KEY = 'firework_recent_colors';
const RECENT_MAX = 7;
const PRESETS = [
    [COLOR.Red, 'Đỏ'], ['#ff8a3d', 'Cam'], [COLOR.Gold, 'Vàng'], [COLOR.Green, 'Xanh lá'], ['#3de0ff', 'Xanh ngọc'],
    [COLOR.Blue, 'Xanh dương'], [COLOR.Purple, 'Tím'], ['#ff6ad5', 'Hồng'], [COLOR.White, 'Trắng'], ['#ffd6e8', 'Hồng phấn'],
    ['#c9b8ff', 'Tím nhạt'], ['#a0f0d0', 'Xanh bạc hà'], ['#8f98ad', 'Xám'], ['#0e1119', 'Đen']
];

let panel = null;
let anchor = null;
// Giá trị lúc mở: đóng bảng mà đã khác thì phát change
let startValue = '';
// Giữ màu dạng HSV (không suy lại từ mã màu) để kéo về đen, trắng rồi kéo ra vẫn giữ sắc màu đang chọn
let hsv = { h: 0, s: 0, v: 1 };
// Gom các lần phát input trong một khung hình (kéo chuột phát rất dày)
let frame = 0;
let parser = null;

const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));

function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const rgbToHex = rgb => `#${rgb.map(c => Math.round(c).toString(16).padStart(2, '0')).join('')}`;

function rgbToHsv([r, g, b]) {
    [r, g, b] = [r / 255, g / 255, b / 255];
    const max = Math.max(r, g, b);
    const d = max - Math.min(r, g, b);
    const h = d === 0 ? 0 : max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return { h: h * 60, s: max ? d / max : 0, v: max };
}

function hsvToRgb({ h, s, v }) {
    const f = n => {
        const k = (n + h / 60) % 6;
        return (v - v * s * Math.max(0, Math.min(k, 4 - k, 1))) * 255;
    };
    return [f(5), f(3), f(1)];
}

const hsvToHex = color => rgbToHex(hsvToRgb(color));

// Mã màu gõ tay: #f6a, ff66aa, tên màu CSS (gold), rgb(...), hsl(...) -> #rrggbb; không hiểu thì null
export function parseColor(text) {
    text = String(text || '').trim();
    if (/^#?[0-9a-f]{3}$/i.test(text)) text = text.replace('#', '').replace(/./g, c => c + c);
    if (/^#?[0-9a-f]{6}$/i.test(text)) return `#${text.replace('#', '')}`.toLowerCase();
    if (!text) return null;
    parser = parser || document.createElement('canvas').getContext('2d');
    parser.fillStyle = '#010203';
    parser.fillStyle = text;
    const out = parser.fillStyle;
    return out !== '#010203' && /^#[0-9a-f]{6}$/.test(out) ? out : null;
}

function recentColors() {
    try {
        const list = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
        return Array.isArray(list) ? list.filter(c => /^#[0-9a-f]{6}$/.test(c)).slice(0, RECENT_MAX) : [];
    } catch (e) {
        return [];
    }
}

function rememberColor(hex) {
    try {
        localStorage.setItem(RECENT_KEY, JSON.stringify([hex, ...recentColors().filter(c => c !== hex)].slice(0, RECENT_MAX)));
    } catch (e) {
        // localStorage bị chặn: không nhớ màu gần đây
    }
}

const swatchHtml = ([hex, name]) =>
    `<button type="button" style="--c: ${hex}" data-color="${hex}" title="${name || hex.toUpperCase()}" aria-label="${name || hex.toUpperCase()}"></button>`;

function render() {
    const hex = hsvToHex(hsv);
    const hue = hsvToHex({ h: hsv.h, s: 1, v: 1 });
    panel.style.setProperty('--hue', hue);
    panel.style.setProperty('--color', hex);
    const sv = panel.querySelector('.color-picker__sv');
    sv.querySelector('.color-picker__thumb').style.cssText = `left: ${hsv.s * 100}%; top: ${(1 - hsv.v) * 100}%`;
    sv.setAttribute('aria-valuetext', `Độ đậm ${Math.round(hsv.s * 100)}%, độ sáng ${Math.round(hsv.v * 100)}%`);
    const hueEl = panel.querySelector('.color-picker__hue');
    hueEl.querySelector('.color-picker__thumb').style.left = `${hsv.h / 3.6}%`;
    hueEl.setAttribute('aria-valuenow', Math.round(hsv.h));
    const hexInput = panel.querySelector('.color-picker__hex input');
    if (document.activeElement !== hexInput) hexInput.value = hex.slice(1).toUpperCase();
    panel.querySelectorAll('[data-color]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.color === hex)));
}

function setHsv(next) {
    hsv = next;
    render();
    const hex = hsvToHex(hsv);
    if (!anchor || anchor.value === hex) return;
    anchor.value = hex;
    if (frame) return;
    const target = anchor;
    frame = requestAnimationFrame(() => {
        frame = 0;
        target.dispatchEvent(new Event('input', { bubbles: true }));
    });
}

function setHex(hex) {
    const next = rgbToHsv(hexToRgb(hex));
    // Màu xám, đen, trắng không có sắc: giữ sắc đang chọn
    setHsv(next.s === 0 || next.v === 0 ? { ...next, h: hsv.h } : next);
}

// Ngay dưới ô màu (không đủ chỗ thì lên trên), không tràn khỏi màn hình. Ô màu bị dựng lại thì đóng; cuộn khuất thì đóng,
// trừ khi đang gõ mã màu (điện thoại: bàn phím ảo hiện lên làm trang co lại, cuộn tới ô gõ)
function place() {
    const r = anchor.getBoundingClientRect();
    const typing = document.activeElement === panel.querySelector('.color-picker__hex input');
    if (!anchor.isConnected || ((r.bottom < 0 || r.top > innerHeight) && !typing)) return close();
    const w = panel.offsetWidth;
    const h = panel.offsetHeight;
    const below = innerHeight - r.bottom - 8;
    const up = h + 6 > below && r.top - 8 > below;
    panel.style.left = `${Math.max(8, Math.min(r.left, innerWidth - w - 8))}px`;
    panel.style.top = `${Math.max(8, Math.min(up ? r.top - h - 6 : r.bottom + 6, innerHeight - h - 8))}px`;
}

function open(input) {
    if (anchor === input) return close(true);
    close();
    anchor = input;
    startValue = input.value;
    hsv = rgbToHsv(hexToRgb(parseColor(input.value) || '#ffffff'));
    const recent = recentColors();
    const recentBox = panel.querySelector('.color-picker__group--recent');
    recentBox.classList.toggle('hide', !recent.length);
    recentBox.querySelector('.color-picker__swatches').innerHTML = recent.map(hex => swatchHtml([hex])).join('');
    panel.querySelector('.color-picker__compare span').style.background = startValue;
    const submit = panel.querySelector('.color-picker__submit');
    submit.classList.toggle('hide', !input.dataset.pickerSubmit);
    submit.textContent = input.dataset.pickerSubmitLabel || 'Xong';
    render();
    panel.classList.remove('hide');
    input.classList.add('is-open');
    input.setAttribute('aria-expanded', 'true');
    place();
    panel.querySelector('.color-picker__sv').focus({ preventScroll: true });
}

function close(refocus = false) {
    if (!anchor) return;
    const input = anchor;
    anchor = null;
    if (frame) {
        cancelAnimationFrame(frame);
        frame = 0;
        input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    panel.classList.add('hide');
    input.classList.remove('is-open');
    input.setAttribute('aria-expanded', 'false');
    if (refocus && input.isConnected) input.focus({ preventScroll: true });
    if (input.value !== startValue) {
        rememberColor(input.value);
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }
}

// Bấm/kéo trong một vùng: onMove(x, y) với x, y từ 0 tới 1 trong vùng
function draggable(el, onMove) {
    el.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        el.focus({ preventScroll: true });
        el.setPointerCapture(e.pointerId);
        const move = (ev) => {
            const r = el.getBoundingClientRect();
            onMove(clamp((ev.clientX - r.left) / r.width), clamp((ev.clientY - r.top) / r.height));
        };
        const end = () => {
            el.removeEventListener('pointermove', move);
            el.removeEventListener('pointerup', end);
            el.removeEventListener('pointercancel', end);
        };
        move(e);
        el.addEventListener('pointermove', move);
        el.addEventListener('pointerup', end);
        el.addEventListener('pointercancel', end);
    });
}

function applyHexInput(input) {
    const hex = parseColor(input.value);
    if (hex) setHex(hex);
    input.classList.toggle('is-invalid', !hex);
    return !!hex;
}

export function initColorPicker() {
    panel = document.createElement('div');
    panel.className = 'color-picker hide';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Chọn màu');
    panel.innerHTML = `
        <div class="color-picker__sv" tabindex="0" role="slider" aria-label="Độ đậm (trái, phải) và độ sáng (lên, xuống)">
            <span class="color-picker__thumb"></span></div>
        <div class="color-picker__row">
            ${'EyeDropper' in window ? `<button type="button" class="color-picker__eye" title="Lấy màu trên màn hình" aria-label="Lấy màu trên màn hình">
                <i class="fas fa-eye-dropper"></i></button>` : ''}
            <div class="color-picker__hue" tabindex="0" role="slider" aria-label="Sắc màu" aria-valuemin="0" aria-valuemax="360">
                <span class="color-picker__thumb"></span></div>
        </div>
        <div class="color-picker__row">
            <button type="button" class="color-picker__compare" title="Màu cũ (bấm để quay lại) · màu mới" aria-label="Quay lại màu cũ">
                <span></span><span></span></button>
            <div class="color-picker__hex"><span>#</span><input type="text" spellcheck="false" autocomplete="off" aria-label="Mã màu"></div>
        </div>
        <div class="color-picker__group color-picker__group--recent hide"><span>Dùng gần đây</span><div class="color-picker__swatches"></div></div>
        <div class="color-picker__group"><span>Bảng màu</span><div class="color-picker__swatches">${PRESETS.map(swatchHtml).join('')}</div></div>
        <button type="button" class="btn primary small color-picker__submit hide"></button>`;
    document.body.appendChild(panel);

    draggable(panel.querySelector('.color-picker__sv'), (x, y) => setHsv({ ...hsv, s: x, v: 1 - y }));
    draggable(panel.querySelector('.color-picker__hue'), x => setHsv({ ...hsv, h: x * 360 }));

    panel.querySelector('.color-picker__sv').addEventListener('keydown', (e) => {
        const step = e.shiftKey ? 0.1 : 0.01;
        const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }[e.key];
        if (!d) return;
        e.preventDefault();
        setHsv({ ...hsv, s: clamp(hsv.s + d[0]), v: clamp(hsv.v + d[1]) });
    });
    panel.querySelector('.color-picker__hue').addEventListener('keydown', (e) => {
        const step = e.shiftKey ? 10 : 1;
        const h = { ArrowLeft: hsv.h - step, ArrowDown: hsv.h - step, ArrowRight: hsv.h + step, ArrowUp: hsv.h + step, Home: 0, End: 360 }[e.key];
        if (h === undefined) return;
        e.preventDefault();
        setHsv({ ...hsv, h: clamp(h, 0, 360) });
    });

    // Đang gõ: chỉ đổi màu khi đủ 6 ký tự; tên màu, mã 3 ký tự, rgb(...) áp dụng khi nhấn Enter hoặc rời ô
    const hexInput = panel.querySelector('.color-picker__hex input');
    hexInput.addEventListener('input', () => {
        hexInput.classList.remove('is-invalid');
        if (/^#?[0-9a-f]{6}$/i.test(hexInput.value.trim())) applyHexInput(hexInput);
    });
    hexInput.addEventListener('blur', () => {
        if (anchor) applyHexInput(hexInput);
        hexInput.classList.remove('is-invalid');
        render();
    });
    hexInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && applyHexInput(hexInput)) {
            e.preventDefault();
            close(true);
        }
    });

    panel.addEventListener('click', async (e) => {
        const swatch = e.target.closest('[data-color]');
        if (swatch) setHex(swatch.dataset.color);
        else if (e.target.closest('.color-picker__compare')) setHex(parseColor(startValue) || '#ffffff');
        else if (e.target.closest('.color-picker__eye')) {
            try {
                const { sRGBHex } = await new window.EyeDropper().open();
                const hex = parseColor(sRGBHex);
                if (hex && anchor) setHex(hex);
            } catch (err) {
                // Người dùng nhấn Esc: giữ màu đang chọn
            }
        } else if (e.target.closest('.color-picker__submit')) {
            const button = anchor && document.getElementById(anchor.dataset.pickerSubmit);
            close(true);
            button?.click();
        }
    });
    // Phím bấm trong bảng chỉ dành cho bảng (Delete, Ctrl+D... không đụng tới phát bắn đang chọn; Esc không đóng hộp thoại
    // phía sau)
    panel.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Escape') {
            e.preventDefault();
            close(true);
        }
    });
    // Tab ra khỏi bảng thì đóng
    panel.addEventListener('focusout', (e) => {
        if (e.relatedTarget && !panel.contains(e.relatedTarget) && e.relatedTarget !== anchor) close();
    });

    // Bấm ô màu (hoặc nhãn của nó; Enter, Space cũng là bấm): mở bảng tự vẽ thay cho bảng của trình duyệt
    document.addEventListener('click', (e) => {
        const input = e.target.closest?.('input[type="color"]');
        if (!input) return;
        e.preventDefault();
        if (!input.disabled) open(input);
    }, true);
    // Bấm ra ngoài thì đóng (bấm lại ô đang mở thì lần bấm đó tự đóng)
    const onAnchor = target => target === anchor || target.closest?.('label')?.control === anchor;
    document.addEventListener('pointerdown', (e) => {
        if (anchor && !panel.contains(e.target) && !onAnchor(e.target)) close();
    }, true);
    // Cuộn, đổi cỡ cửa sổ (kể cả bàn phím ảo hiện lên): đi theo ô màu
    document.addEventListener('scroll', (e) => {
        if (anchor && !panel.contains(e.target)) place();
    }, true);
    window.addEventListener('resize', () => anchor && place());
}
