/*!
 * Trình diễn Pháo hoa – builder (mẫu theo dịp)
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Tạo nhanh theo dịp: dải gợi ý, hộp chọn mẫu.

import { OCCASIONS, buildTemplate } from '../templates.js';
import { state } from './state.js';
import { escapeHtml, hideModal, notify, showModal } from './util.js';
import { createNewScript } from './events.js';
import { updateScriptNameLabel } from './timeline.js';
import { toSlug } from './images.js';
import { playMiniPreviewOnce } from './preview.js';
import { loadConfigIntoState } from './config.js';
import { closeMoreMenu } from './layout.js';

let selectedOccasion = OCCASIONS[0].id;

export function renderTemplateChips() {
    const chips = document.getElementById('template-chips');
    if (!chips) return;
    chips.innerHTML = OCCASIONS.map(o => `
        <button type="button" class="template-chip" onclick="openTemplatesModal('${o.id}')">
            <span class="emoji">${o.icon}</span>${escapeHtml(o.name)}
        </button>`).join('');
    // Các dịp nằm trên một hàng cuộn ngang: lăn chuột (dọc) trên dải thì cuộn ngang
    chips.addEventListener('wheel', (e) => {
        if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || chips.scrollWidth <= chips.clientWidth) return;
        chips.scrollLeft += e.deltaY;
        e.preventDefault();
    }, { passive: false });
}

// Kịch bản còn trống (chưa đặt tiêu đề, chưa mở kịch bản nào, tối đa 1 phát bắn): gợi ý tạo nhanh từ mẫu
export function updateTemplateStrip() {
    const strip = document.getElementById('template-strip');
    if (!strip) return;
    const isBlank = !state.currentFilename && state.events.length <= 1 && !document.getElementById('title').value.trim();
    strip.classList.toggle('hide', !isBlank);
}

function renderTemplateGrid() {
    document.getElementById('template-grid').innerHTML = OCCASIONS.map(o => `
        <button type="button" class="shell-option${o.id === selectedOccasion ? ' selected' : ''}" onclick="selectOccasion('${o.id}')">
            <span class="emoji">${o.icon}</span>${escapeHtml(o.name)}
        </button>`).join('');
}

export function selectOccasion(id) {
    selectedOccasion = id;
    renderTemplateGrid();
}

export function openTemplatesModal(occasionId) {
    if (occasionId) selectedOccasion = occasionId;
    closeMoreMenu();
    renderTemplateGrid();
    showModal('templates-modal');
    document.getElementById('tpl-recipient').focus();
}

export function startBlankScript() {
    hideModal('templates-modal');
    createNewScript();
}

export function createFromTemplate() {
    const occasion = OCCASIONS.find(o => o.id === selectedOccasion) || OCCASIONS[0];
    const recipient = document.getElementById('tpl-recipient').value.trim();
    const sender = document.getElementById('tpl-sender').value.trim();
    const config = buildTemplate(occasion.id, { recipient, sender });

    loadConfigIntoState(config, toSlug(`${occasion.id} ${recipient}`).slice(0, 50));
    // Kịch bản mới: lưu lần đầu không ghi đè kịch bản trùng tên (tự thêm số)
    state.currentFilename = null;
    document.getElementById('share-bar').classList.add('hide');
    updateScriptNameLabel();
    updateTemplateStrip();
    hideModal('templates-modal');
    playMiniPreviewOnce();
    notify(`Đã tạo màn trình diễn "${occasion.name}". Xem thử ở khung xem nhanh, chỉnh tiếp rồi bấm Lưu.`, 'success');
}

// ---------------------------------------------------------------------------
// XẾP PHÁO THEO NHỊP NHẠC (beat-sync.js): nghe bài nhạc, tìm nhịp rồi tự đặt pháo
// ---------------------------------------------------------------------------
