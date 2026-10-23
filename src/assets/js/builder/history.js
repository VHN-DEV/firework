/*!
 * Hanabi – builder (hoàn tác, bản nháp)
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Hoàn tác, làm lại, bản nháp tự lưu, hỏi khôi phục bản nháp.

import { state } from './state.js';
import { notify } from './util.js';
import { selectEvent, updateScriptNameLabel } from './timeline.js';
import { getFinalConfig, loadConfigIntoState } from './config.js';
import { updateTemplateStrip } from './templates-ui.js';

const DRAFT_KEY = 'firework_builder_draft';

const HISTORY_LIMIT = 100;

const editHistory = { entries: [], index: -1 };

// Bản chụp ứng với lần lưu/mở gần nhất: trùng với nó thì không cần nháp
let savedSnapshot = null;

let checkpointTimer = null;

let restoringSnapshot = false;

export let draftSavedAt = null;

let draftWarningShown = false;

// Ảnh/nhạc dạng DataURL (bản tĩnh) nặng vài MB: trong lịch sử mỗi nội dung chỉ giữ một bản, các bản chụp trỏ tới nó
const dataUrlIds = new Map();

const dataUrlsById = new Map();

function compactSnapshot(value) {
    return JSON.stringify(value, (key, v) => {
        if (typeof v !== 'string' || v.length < 2000 || !v.startsWith('data:')) return v;
        let id = dataUrlIds.get(v);
        if (!id) {
            id = `@@data:${dataUrlIds.size + 1}`;
            dataUrlIds.set(v, id);
            dataUrlsById.set(id, v);
        }
        return id;
    });
}

function expandSnapshot(text) {
    return JSON.parse(text, (key, v) => (typeof v === 'string' && v.startsWith('@@data:') ? dataUrlsById.get(v) ?? v : v));
}

function currentSnapshot() {
    return compactSnapshot({
        config: getFinalConfig(),
        filename: document.getElementById('filename').value.trim(),
        // Tiêu đề đúng như trong ô (getFinalConfig điền "Kịch bản mới" khi để trống)
        title: document.getElementById('title').value
    });
}

// Kịch bản trống (chưa có tiêu đề, tên file, tối đa 1 phát bắn) thì không cần giữ nháp
// Chưa đặt tên, chưa có tiêu đề, tối đa một phát bắn và chưa chọn nhạc: không cần lưu nháp
function isBlankSnapshot(data) {
    return !data.filename && !(data.title ?? data.config.title).trim() && data.config.events.length <= 1 && !data.config.music;
}

function saveDraft(snapshot) {
    const data = expandSnapshot(snapshot);
    if (isBlankSnapshot(data)) {
        clearDraft();
        return;
    }
    try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...data, currentFilename: state.currentFilename || null, savedAt: Date.now() }));
        draftSavedAt = new Date();
    } catch (e) {
        // Thường do vượt giới hạn bộ nhớ của trình duyệt (ảnh lớn dạng DataURL)
        if (!draftWarningShown) {
            draftWarningShown = true;
            notify('Bản nháp quá lớn để tự lưu trong trình duyệt (thường do ảnh lớn). Nhớ bấm Lưu thường xuyên.', 'warning');
        }
    }
    updateScriptNameLabel();
}

export function clearDraft() {
    try {
        localStorage.removeItem(DRAFT_KEY);
    } catch (e) {
        // localStorage bị chặn: không có gì để xóa
    }
    draftSavedAt = null;
    updateScriptNameLabel();
}

// Chụp kịch bản hiện tại; khác lần trước thì ghi vào lịch sử và lưu nháp
function checkpoint() {
    clearTimeout(checkpointTimer);
    if (restoringSnapshot || editHistory.index < 0) return;
    const snapshot = currentSnapshot();
    if (snapshot === editHistory.entries[editHistory.index]) return;
    editHistory.entries = editHistory.entries.slice(0, editHistory.index + 1);
    editHistory.entries.push(snapshot);
    if (editHistory.entries.length > HISTORY_LIMIT) editHistory.entries.shift();
    editHistory.index = editHistory.entries.length - 1;
    updateUndoButtons();
    if (snapshot === savedSnapshot) clearDraft();
    else saveDraft(snapshot);
}

export function scheduleCheckpoint() {
    clearTimeout(checkpointTimer);
    checkpointTimer = setTimeout(checkpoint, 400);
}

// Vừa lưu xong hoặc vừa mở một kịch bản đã lưu: trạng thái này không cần nháp
export function markSaved() {
    savedSnapshot = currentSnapshot();
    checkpoint();
    clearDraft();
}

function applySnapshot(data) {
    restoringSnapshot = true;
    const activeIndex = state.events.findIndex(e => e.id === state.activeEventId);
    const currentFilename = state.currentFilename;
    loadConfigIntoState(data.config, data.filename || '', { migrate: false });
    if (typeof data.title === 'string') document.getElementById('title').value = data.title;
    // Hoàn tác không đổi kịch bản đang sửa trên máy chủ (quyền ghi đè khi lưu)
    state.currentFilename = currentFilename;
    updateScriptNameLabel();
    updateTemplateStrip();
    if (activeIndex >= 0 && state.events[activeIndex]) selectEvent(state.events[activeIndex].id);
    restoringSnapshot = false;
}

function moveInHistory(step) {
    const target = editHistory.index + step;
    if (target < 0 || target >= editHistory.entries.length) return;
    clearTimeout(checkpointTimer);
    editHistory.index = target;
    applySnapshot(expandSnapshot(editHistory.entries[target]));
    // Dựng lại có thể chuẩn hóa vài giá trị: lấy đúng bản chụp sau khi dựng để không sinh bước thừa
    editHistory.entries[target] = currentSnapshot();
    updateUndoButtons();
    if (editHistory.entries[target] === savedSnapshot) clearDraft();
    else saveDraft(editHistory.entries[target]);
}

export function undo() {
    moveInHistory(-1);
}

export function redo() {
    moveInHistory(1);
}

function updateUndoButtons() {
    const undoBtn = document.getElementById('btn-undo');
    const redoBtn = document.getElementById('btn-redo');
    if (undoBtn) undoBtn.disabled = editHistory.index <= 0;
    if (redoBtn) redoBtn.disabled = editHistory.index >= editHistory.entries.length - 1;
}

function formatDraftTime(date) {
    const time = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    return date.toDateString() === new Date().toDateString()
        ? `${time} hôm nay`
        : `${time} ngày ${date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}`;
}

// Mở builder: có bản nháp chưa lưu từ lần trước thì hỏi khôi phục (không chặn thao tác khác)
function offerDraftRestore() {
    let draft = null;
    try {
        draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
    } catch (e) {
        draft = null;
    }
    if (!draft || !draft.config || !Array.isArray(draft.config.events)) return;

    const bar = document.getElementById('draft-bar');
    const title = draft.config.title && draft.config.title !== 'Kịch bản mới' ? ` "${draft.config.title}"` : '';
    document.getElementById('draft-info').textContent =
        `Có bản nháp chưa lưu${title} (${draft.config.events.length} phát bắn) từ ${formatDraftTime(new Date(draft.savedAt))}.`;
    bar.classList.remove('hide');

    document.getElementById('btn-draft-restore').onclick = () => {
        bar.classList.add('hide');
        applySnapshot(draft);
        state.currentFilename = draft.currentFilename || null;
        updateTemplateStrip();
        checkpoint();
        notify('Đã khôi phục bản nháp.', 'success');
    };
    document.getElementById('btn-draft-discard').onclick = () => {
        bar.classList.add('hide');
        // Chỉ xóa nếu trong máy vẫn là bản nháp cũ (chưa bị thay bằng nháp của lần soạn này)
        try {
            const stored = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
            if (stored && stored.savedAt === draft.savedAt) clearDraft();
        } catch (e) {
            // Không đọc được: bỏ qua
        }
    };
}

export function initEditHistory() {
    offerDraftRestore();
    savedSnapshot = currentSnapshot();
    editHistory.entries = [savedSnapshot];
    editHistory.index = 0;
    updateUndoButtons();

    // Mọi thao tác của người dùng đều có thể đổi kịch bản: chụp lại sau khi thao tác lắng xuống
    ['input', 'change', 'click', 'pointerup', 'keyup'].forEach(type => document.addEventListener(type, scheduleCheckpoint, true));
    // Thay đổi đến sau (tải ảnh/nhạc lên xong...)
    setInterval(checkpoint, 3000);

    document.addEventListener('keydown', (e) => {
        if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
        // Trong ô nhập, Ctrl+Z hoàn tác chữ đang gõ như bình thường
        if (e.target.closest('input, textarea, select, [contenteditable="true"]')) return;
        // Đang mở hộp thoại (cắt ảnh, kho nhạc...): không đổi kịch bản phía sau hộp thoại
        if (document.querySelector('.modal:not(.hide)')) return;
        const key = e.key.toLowerCase();
        if (key === 'z' && !e.shiftKey) {
            e.preventDefault();
            undo();
        } else if (key === 'y' || (key === 'z' && e.shiftKey)) {
            e.preventDefault();
            redo();
        }
    });
}
