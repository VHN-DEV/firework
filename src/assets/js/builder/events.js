/*!
 * Trình diễn Pháo hoa – builder (phát bắn)
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Phát bắn trong kịch bản: thêm, sửa, xóa, nhân bản, màu, chèn biểu tượng vào chữ, thời lượng đợt bắn.

import { resolveScreenTheme } from '../player/screen-themes.js';
import { EMOJI_GROUPS } from '../text-emojis.js';
import backgroundImgUrl from '../../img/background.webp';
import { state } from './state.js';
import { confirmAction, notify, syncLoopState } from './util.js';
import { renderEventList, selectEvent, updateScriptNameLabel } from './timeline.js';
import { refreshInspectorHeader, renderInspector, syncXYPad } from './inspector.js';
import { renderMusic } from './music.js';
import { refreshMiniPreview, stopPreviewMusic, updateMiniInfo } from './preview.js';
import { renderSchedule, renderScreenTheme, renderStartFrames } from './settings.js';
import { WATER_THINGS, renderScene, renderSky, renderSmoke, renderViewer } from './scene.js';
import { renderNotifyOpen } from './gift-watch.js';
import { loadNatureSound } from './nature-ui.js';
import { renderSeoControls } from './share.js';

export function addEvent(config = null, { render = true } = {}) {
    const id = state.nextId++;
    let newEvent;

    if (config) {
        // Đảm bảo các trường còn thiếu có giá trị mặc định
        newEvent = {
            burst: 1,
            shell: "Hoa cúc",
            color: "Ngẫu nhiên",
            x: 50,
            y: 50,
            delay: 0,
            size: 1,
            strobe: false,
            pistil: false,
            streamers: false,
            crossette: false,
            crackle: false,
            horsetail: false,
            comet: false,
            floral: false,
            ring: false,
            starDensity: 1,
            strobeFreq: 50,
            launchAngle: 90,
            ascentSpeed: 1,
            rotation: undefined,
            liftSound: '',
            burstSound: '',
            expanded: false,
            ...config,
            id: id
        };
        if (newEvent.spiralLift && !newEvent.launchStyle) newEvent.launchStyle = 'spiral';
        delete newEvent.spiralLift;
    } else {
        // Luôn sử dụng giá trị mặc định cố định theo yêu cầu
        newEvent = {
            id: id,
            burst: 1,
            shell: "Hoa cúc",
            color: "Ngẫu nhiên",
            x: 50,
            y: 50,
            delay: 0,
            size: 1,
            strobe: false,
            strobeColor: "",
            pistil: false,
            pistilColor: "",
            streamers: false,
            crossette: false,
            crackle: false,
            horsetail: false,
            comet: false,
            starDensity: 1,
            starCount: undefined,
            // Tuổi thọ hạt, độ lệch tuổi thọ, độ rộng vụ nổ để trống: mỗi loại pháo dùng thông số riêng của nó
            // (ví dụ "Cháy lâu" cháy ~6 giây, "Liễu" ~3 giây). Đặt sẵn một số sẽ ghi đè và làm mọi loại giống nhau.
            starLife: undefined,
            starLifeVariation: undefined,
            spreadSize: undefined,
            glitterColor: "",
            secondColor: "",
            transitionTime: undefined,
            floral: false,
            ring: false,
            strobeFreq: 50,
            launchAngle: 90,
            ascentSpeed: 1,
            rotation: undefined,
            liftSound: '',
            burstSound: '',
            expanded: false
        };
    }

    state.events.push(newEvent);
    if (render) renderEventList();
}

export function addColorToEvent(id, color) {
    const event = state.events.find(e => e.id === id);
    color = typeof color === 'string' ? color.trim() : color;
    if (!event || !color) return;

    const current = Array.isArray(event.color) ? event.color : [event.color];
    if (color === 'Ngẫu nhiên' || !event.color || event.color === 'Ngẫu nhiên') {
        // "Ngẫu nhiên" là lựa chọn riêng: chọn màu cụ thể thì thay thế nó (không tạo mảng ["Ngẫu nhiên", "Red"])
        event.color = color;
    } else if (!current.includes(color)) {
        event.color = [...current, color];
    }
    renderEventList();
    renderInspector();
}

export function removeColorFromEvent(id, index) {
    const event = state.events.find(e => e.id === id);
    if (!event) return;
    if (!Array.isArray(event.color)) {
        // Nếu là string, không thể xóa bằng index (về mặc định)
        event.color = '';
    } else {
        event.color.splice(index, 1);
        if (event.color.length === 1) event.color = event.color[0];
        if (event.color.length === 0) event.color = '';
    }
    renderEventList();
    renderInspector();
}

export function createNewScript() {
    confirmAction('Bạn có chắc chắn muốn tạo kịch bản mới? Mọi thay đổi chưa lưu sẽ bị mất.', () => {
        // Reset state
        state.events = [];
        state.nextId = 1;
        state.currentFilename = null;
        state.activeEventId = null;

        // Reset UI
        document.getElementById('title').value = '';
        document.getElementById('subtitle').value = '';
        document.getElementById('seo-title').value = '';
        document.getElementById('seo-description').value = '';
        state.seo = { mode: 'auto', image: null, imageText: true, imagePosition: 50, axis: 'y' };
        renderSeoControls();
        document.getElementById('author').value = '';
        document.getElementById('recipient').value = '';
        state.startFrame = '';
        renderStartFrames();
        state.screenTheme = resolveScreenTheme();
        renderScreenTheme();
        state.openAt = '';
        state.openMode = 'lock';
        renderSchedule();
        state.notifyOpen = true;
        renderNotifyOpen();
        state.reduceFlashing = false;
        document.getElementById('reduce-flashing').checked = false;
        document.getElementById('intro-message').value = '';
        document.getElementById('outro-message').value = '';
        document.getElementById('filename').value = '';
        document.getElementById('loop').checked = true;
        syncLoopState();
        document.getElementById('share-bar').classList.add('hide');

        state.smoke = '';
        renderSmoke();
        state.water = '';
        state.waterStyle = 'lake';
        state.bank = '';
        state.people = '';
        state.nearBank = true;
        state.floating = '';
        WATER_THINGS.forEach(key => { state[key] = true; });
        renderScene();
        state.viewer = {};
        state.tapToLaunch = true;
        state.receiverShare = true;
        renderViewer();
        state.decor = [];
        state.stars = '';
        state.milkyWay = '';
        state.meteors = '';
        state.clouds = '';
        state.moon = null;
        state.season = '';
        state.weather = '';
        renderSky();

        // Reset background
        state.showBackground = false;
        state.background = null;
        document.getElementById('show-background').checked = false;
        document.getElementById('background-upload-container').classList.add('hide');
        document.getElementById('background-preview').src = backgroundImgUrl;
        refreshMiniPreview();

        // Bỏ nhạc nền
        state.music = null;
        state.effectsVolume = 1;
        loadNatureSound();
        stopPreviewMusic();
        renderMusic();

        // Add one default event
        addEvent();
        renderInspector();
        updateScriptNameLabel();

        notify('Đã tạo kịch bản mới!', 'success');
    });
}

export function removeEvent(id) {
    state.events = state.events.filter(e => e.id !== id);
    if (state.activeEventId === id) {
        state.activeEventId = null;
        renderInspector();
        updateMiniInfo();
    }
    renderEventList();
}

export function duplicateEvent(id) {
    const index = state.events.findIndex(e => e.id === id);
    if (index === -1) return;

    const eventToCopy = state.events[index];
    // Create a deep copy of the event (except the id and expanded state)
    const { id: _, expanded, ...eventData } = eventToCopy;

    const newId = state.nextId++;
    const newEvent = {
        ...JSON.parse(JSON.stringify(eventData)),
        id: newId,
        expanded: false
    };

    // Insert after the original event
    state.events.splice(index + 1, 0, newEvent);
    renderEventList();

    // Mở luôn bản sao để chỉnh tiếp
    selectEvent(newId);
    notify('Đã nhân bản phát bắn!', 'success');
}

// Giá trị dùng khi người dùng xóa trống các ô bắt buộc (thiếu "Đợt" thì phát bắn không bao giờ được bắn)
const REQUIRED_NUMBER_DEFAULTS = { burst: 1, x: 50, y: 50, size: 1, delay: 0 };

// Nhóm biểu tượng đang xem trong bảng chọn, giữ lại khi chuyển sang phát bắn khác
let emojiGroup = 0;

// Mở/đóng bảng chọn biểu tượng của pháo chữ. Lưới chỉ dựng khi mở vì có nhóm vài trăm biểu tượng.
export function toggleEmojiPicker() {
    const picker = document.getElementById('emoji-picker');
    if (!picker) return;
    if (picker.classList.toggle('hide')) return;
    showEmojiGroup(emojiGroup);
}

export function showEmojiGroup(index) {
    emojiGroup = index;
    document.querySelectorAll('#emoji-picker .emoji-tabs button').forEach((tab, i) => tab.classList.toggle('active', i === index));
    const grid = document.querySelector('#emoji-picker .emoji-grid');
    grid.innerHTML = EMOJI_GROUPS[index].emojis.map(e => `<button type="button">${e}</button>`).join('');
    grid.scrollTop = 0;
}

// Bấm vào lưới: lấy biểu tượng của nút được bấm
export function pickTextEmoji(id, e) {
    const button = e.target.closest('button');
    if (button) insertTextEmoji(id, button.textContent);
}

// Chèn biểu tượng vào chỗ con trỏ trong ô chữ, không vượt quá giới hạn ký tự của ô
function insertTextEmoji(id, emoji) {
    const input = document.getElementById('f-text');
    if (!input) return;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? start;
    const value = input.value.slice(0, start) + emoji + input.value.slice(end);
    if (value.length > input.maxLength) {
        notify('Nội dung chữ đã đủ dài, không chèn thêm được.', 'warning');
        return;
    }
    input.value = value;
    // Không cuộn khung chỉnh sửa, để bảng biểu tượng đứng yên khi chọn tiếp
    input.focus({ preventScroll: true });
    input.setSelectionRange(start + emoji.length, start + emoji.length);
    updateEvent(id, 'text', value);
}

export function updateEvent(id, field, value) {
    const event = state.events.find(e => e.id === id);
    if (event) {
        let needsRender = false;
        if (['burst', 'x', 'y', 'delay', 'size', 'duration', 'starLife', 'starDensity', 'spreadSize', 'starCount', 'starLifeVariation', 'transitionTime', 'strobeFreq', 'launchAngle', 'ascentSpeed', 'rotation'].includes(field)) {
            // Handle explicit undefined (e.g. rotation cleared to "random")
            if (value === undefined || value === null) {
                event[field] = undefined;
            } else {
                let num = value === '' ? NaN : Number(value);
                if (isNaN(num)) {
                    // Ô tùy chọn để trống = tự động (undefined); ô bắt buộc thì về giá trị mặc định
                    num = REQUIRED_NUMBER_DEFAULTS[field];
                    needsRender = num !== undefined;
                }
                if (num !== undefined) {
                    // Clamping logic for security
                    if (field === 'x' || field === 'y') num = Math.max(0, Math.min(100, num));
                    if (field === 'size') num = Math.max(0, Math.min(10, num));
                    if (field === 'delay') num = Math.max(0, Math.min(60000, num));
                    // Đợt phải là số nguyên, nếu không sẽ không khớp với bộ đếm đợt khi trình diễn
                    if (field === 'burst') num = Math.max(1, Math.round(num));
                    if (field === 'starLifeVariation') num = Math.max(0, Math.min(1, num));
                    if (field === 'launchAngle') num = Math.max(0, Math.min(180, num));
                    if (field === 'ascentSpeed') num = Math.max(0.1, Math.min(5, num));
                }
                event[field] = num;
            }
        } else if (['strobe', 'pistil', 'streamers', 'crossette', 'crackle', 'horsetail', 'comet', 'floral', 'ring', 'hang'].includes(field)) {
            event[field] = value === true;
        } else if (field === 'launchStyle') {
            // "Theo loại pháo" không lưu vào kịch bản
            event[field] = value || undefined;
        } else if (field === 'imageUrl') {
            // Đổi ảnh thì phần ảnh đã chọn của ảnh cũ không còn đúng
            event.imageUrl = value;
            event.crop = undefined;
        } else {
            event[field] = value;
        }

        // Cập nhật dòng thời gian (kèm bản xem nhanh). Bảng chỉnh sửa chỉ dựng lại khi cần hiện lại
        // giá trị mặc định của ô vừa bị xóa trống, để không làm mất con trỏ trong ô đang gõ.
        renderEventList();
        if (needsRender) {
            renderInspector();
        } else if (state.activeEventId === id) {
            refreshInspectorHeader();
            if (field === 'x' || field === 'y') syncXYPad(id);
        }
    }
}

// ---------------------------------------------------------------------------
// DÒNG THỜI GIAN: các phát bắn gom theo đợt
// ---------------------------------------------------------------------------

// Thời lượng một đợt (ms), giống trình phát (startSequence × 1.25):
// đợt có pháo = 2500ms + "Tạm dừng" dài nhất, đợt trống = 1000ms.
export function getBurstDuration(events) {
    if (events.length === 0) return 1000 * 1.25;
    const pauses = events.filter(e => e.shell === 'Tạm dừng').map(e => Number(e.duration) || 2000);
    return (2500 + Math.max(0, ...pauses)) * 1.25;
}

export function getMaxBurst() {
    return state.events.length > 0 ? Math.max(...state.events.map(e => Number(e.burst) || 1)) : 0;
}

export function getBurstEvents(burst) {
    return state.events.filter(e => (Number(e.burst) || 1) === burst);
}
