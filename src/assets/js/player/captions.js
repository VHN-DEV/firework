/*!
 * Hanabi – trình phát: lời nhắn
 * Phần bổ sung và chỉnh sửa © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Lời nhắn theo thời gian: phát "Lời nhắn" hiện một dòng chữ như phụ đề, khớp nhịp với pháo và nhạc nền.
// Trường của phát: text, duration (ms, mặc định 4000), position ('bottom' | 'middle' | 'top'),
// effect ('' hiện dần | 'type' gõ từng chữ), textSize ('' | 'large'), color (màu đầu tiên).

import { replacePlaceholders } from './utils.js';
import { COLOR } from './env.js';
import { after, every, cancel } from './clock.js';

const stageContainer = () => document.querySelector('.stage-container');

function getCaptionLayer() {
    let layer = stageContainer().querySelector('.caption-layer');
    if (!layer) {
        layer = document.createElement('div');
        layer.className = 'caption-layer';
        stageContainer().appendChild(layer);
    }
    return layer;
}

function dismissCaption(el) {
    if (!el.isConnected || el.classList.contains('is-leaving')) return;
    cancel(el.typingTimer);
    el.classList.add('is-leaving');
    after(700, () => el.remove());
}

// Chạy lại kịch bản (xem nhanh, "Xem lại"): bỏ các lời nhắn đang hiện
export function clearCaptions() {
    const layer = stageContainer().querySelector('.caption-layer');
    if (layer) layer.querySelectorAll('.caption').forEach(el => {
        cancel(el.typingTimer);
        el.remove();
    });
}

export function showCaption(event) {
    const text = String(replacePlaceholders(event.text || '')).trim();
    if (!text) return;
    const position = ['top', 'middle', 'bottom'].includes(event.position) ? event.position : 'bottom';
    const layer = getCaptionLayer();
    // Lời nhắn mới ở cùng vị trí thay cho lời nhắn cũ, như phụ đề
    layer.querySelectorAll(`.caption--${position}`).forEach(dismissCaption);

    const el = document.createElement('div');
    el.className = `caption caption--${position}${event.textSize === 'large' ? ' caption--large' : ''}`;
    const first = Array.isArray(event.color) ? event.color[0] : event.color;
    el.style.setProperty('--caption-color', !first || first === 'Ngẫu nhiên' || first === 'random' ? '#ffffff' : (COLOR[first] || first));
    layer.appendChild(el);

    const chars = Array.from(text);
    let duration = Math.max(1000, Number(event.duration) || 4000);
    if (event.effect === 'type') {
        // Gõ từng chữ, con trỏ nhấp nháy; luôn giữ chữ đủ lâu sau khi gõ xong
        el.classList.add('caption--typing');
        let shown = 0;
        el.textContent = '';
        el.typingTimer = every(45, () => {
            shown++;
            el.textContent = chars.slice(0, shown).join('');
            if (shown >= chars.length) {
                cancel(el.typingTimer);
                el.classList.remove('caption--typing');
            }
        });
        duration = Math.max(duration, chars.length * 45 + 1500);
    } else {
        el.textContent = text;
    }
    after(duration, () => dismissCaption(el));
}
