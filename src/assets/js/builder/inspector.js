/*!
 * Hanabi – builder (bảng chỉnh)
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Bảng chỉnh phát bắn đang chọn: các mục gấp mở, ô số, ô màu, khung chọn vị trí nổ.

import { EMOJI_GROUPS } from '../text-emojis.js';
import { state } from './state.js';
import { COLOR, COLORS, FRAME_TYPES, GLITTER_TYPES, LAUNCH_STYLES, SHELL_BUILTIN_EFFECTS, SHELL_ICONS, SHELL_TYPES } from './constants.js';
import { escapeHtml, formatNumber } from './util.js';
import { helpTip } from './help.js';
import { addColorToEvent, getBurstEvents, updateEvent } from './events.js';
import { CAPTION_POSITIONS, isFireworkShot, isSyncMode, renderEventList, showActiveEvent } from './timeline.js';
import { paintImageThumb } from './images.js';
import { previewDevice, sendPreview, updateMiniInfo } from './preview.js';

export function closeInspector() {
    state.activeEventId = null;
    showActiveEvent(null);
    renderInspector();
    updateMiniInfo();
    // Xem nhanh quay lại chạy cả kịch bản
    sendPreview(true);
}

// ---------------------------------------------------------------------------
// GIẢI THÍCH NHANH: nút "?" cạnh tên mục (helpTip(key) trong JS, <button class="help-tip" data-help="key"> trong HTML).
// Rê chuột, bấm/chạm hoặc Tab tới để xem giải thích; thêm mục mới chỉ cần thêm một dòng vào HELP_TIPS.
// ---------------------------------------------------------------------------

// Mục nào đang mở/thu gọn (giữ nguyên khi chuyển sang phát bắn khác)
const openSections = { type: false, content: true, basic: true, position: true, color: true, sound: false, advanced: false };

export function rememberSection(el) {
    openSections[el.dataset.section] = el.open;
}

function section(key, icon, title, hint, body, help) {
    return `
        <details class="insp-section" data-section="${key}" ${openSections[key] ? 'open' : ''} ontoggle="rememberSection(this)">
            <summary><i class="fas fa-${icon}"></i><span class="summary-title">${title}${help ? helpTip(help) : ''}</span><span class="summary-hint" id="hint-${key}">${hint}</span></summary>
            <div class="insp-body">${body}</div>
        </details>`;
}

function numberField(event, field, label, { step = 1, min, max, placeholder = '', value, help } = {}) {
    const v = value !== undefined ? value : (event[field] ?? '');
    return `
        <div>
            <label for="f-${field}">${label}${help ? helpTip(help) : ''}</label>
            <input type="number" id="f-${field}" step="${step}" ${min !== undefined ? `min="${min}"` : ''} ${max !== undefined ? `max="${max}"` : ''}
                value="${escapeHtml(v)}" placeholder="${placeholder}" onchange="updateEvent(${event.id}, '${field}', this.value)">
        </div>`;
}

// Ô màu đơn (màu chuyển, nhụy, lấp lánh, nhấp nháy): ô chọn màu + ô gõ tên/mã
function colorField(event, field, label, help) {
    return `
        <div>
            <label>${label}${help ? helpTip(help) : ''}</label>
            <div class="color-field">
                <input type="color" class="${event[field] ? '' : 'is-empty'}" value="${colorInputValue(event[field])}" title="Chọn màu"
                    onchange="updateEvent(${event.id}, '${field}', this.value); this.nextElementSibling.value = this.value; this.classList.remove('is-empty')">
                <input type="text" value="${escapeHtml(event[field])}" placeholder="Mặc định" onchange="updateEvent(${event.id}, '${field}', this.value.trim())">
            </div>
        </div>`;
}

// Giá trị cho <input type="color">: chỉ nhận dạng #rrggbb, tên màu (Gold...) được đổi sang mã tương ứng
function colorInputValue(color) {
    const hex = COLOR[color] || color;
    return typeof hex === 'string' && /^#[0-9a-f]{6}$/i.test(hex) ? hex : '#ffffff';
}

function renderInspectorHeaderText(event) {
    const index = state.events.indexOf(event) + 1;
    const delay = Number(event.delay) ? `trễ ${formatNumber(event.delay)} ms` : 'bắn ngay';
    return {
        title: `#${index} · ${escapeHtml(event.shell)}`,
        sub: event.shell === 'Tạm dừng' ? `Đợt ${escapeHtml(event.burst)}` : `Đợt ${escapeHtml(event.burst)} · ${delay}`
    };
}

// Cập nhật tiêu đề bảng chỉnh sửa mà không dựng lại cả bảng (giữ con trỏ trong ô đang gõ)
export function refreshInspectorHeader() {
    const event = state.events.find(e => e.id === state.activeEventId);
    if (!event) return;
    const { title, sub } = renderInspectorHeaderText(event);
    const titleEl = document.getElementById('insp-title');
    const subEl = document.getElementById('insp-sub');
    if (titleEl) titleEl.innerHTML = title;
    if (subEl) subEl.textContent = sub;
}

export function renderInspector() {
    const panel = document.getElementById('inspector');
    if (!panel) return;
    const event = state.events.find(e => e.id === state.activeEventId);
    panel.classList.toggle('open', !!event);
    positionMobileSheet();

    if (!event) {
        panel.innerHTML = `
            <div class="inspector-empty">
                <div class="empty-icon"><i class="fas fa-hand-pointer"></i></div>
                <h3>Chọn một phát bắn để chỉnh sửa</h3>
                <p>Bấm vào phát bắn bất kỳ trong dòng thời gian, hoặc thêm phát mới.</p>
                <button class="btn primary small" onclick="addEventFromUI()"><i class="fas fa-plus"></i> Thêm phát bắn</button>
            </div>`;
        delete panel.dataset.eventId;
        return;
    }

    // Dựng lại cùng một phát bắn thì giữ vị trí cuộn
    const keepScroll = panel.dataset.eventId === String(event.id) ? panel.scrollTop : 0;
    panel.dataset.eventId = event.id;

    const isPause = event.shell === 'Tạm dừng';
    const { title, sub } = renderInspectorHeaderText(event);

    const header = `
        <div class="inspector-header">
            <span class="shot-icon">${SHELL_ICONS[event.shell] || '🎆'}</span>
            <div class="inspector-title">
                <h3 id="insp-title">${title}</h3>
                <span id="insp-sub">${sub}</span>
            </div>
            <button class="icon-btn" onclick="duplicateEvent(${event.id})" title="Nhân bản"><i class="fas fa-copy"></i></button>
            <button class="icon-btn danger" onclick="removeEvent(${event.id})" title="Xóa phát bắn"><i class="fas fa-trash"></i></button>
            <button class="icon-btn" onclick="closeInspector()" title="Đóng"><i class="fas fa-xmark"></i></button>
        </div>`;

    const typeSection = section('type', 'shapes', 'Loại pháo', `${SHELL_ICONS[event.shell] || ''} ${escapeHtml(event.shell)}`, `
        <div class="shell-grid">
            ${SHELL_TYPES.map(type => `
                <button type="button" class="shell-option${event.shell === type ? ' selected' : ''}" onclick="handleShellChange(${event.id}, '${type}')">
                    <span class="emoji">${SHELL_ICONS[type]}</span>${type}
                </button>`).join('')}
        </div>`, 'shellType');

    let specific = '';
    if (event.shell === 'Văn bản') {
        specific = `
            <div>
                <label for="f-text">Nội dung chữ${helpTip('text')}</label>
                <div class="input-with-btn">
                    <input type="text" id="f-text" value="${escapeHtml(event.text)}" placeholder="VD: HAPPY BIRTHDAY" maxlength="60"
                        oninput="updateEvent(${event.id}, 'text', this.value)">
                    <button type="button" title="Chèn biểu tượng" onclick="toggleEmojiPicker()">😊</button>
                </div>
                <div id="emoji-picker" class="emoji-picker hide">
                    <div class="emoji-tabs">
                        ${EMOJI_GROUPS.map((g, i) => `<button type="button" title="${g.name}" onclick="showEmojiGroup(${i})">${g.icon}</button>`).join('')}
                    </div>
                    <div class="emoji-grid" onclick="pickTextEmoji(${event.id}, event)"></div>
                </div>
                <small class="field-hint">Có thể dùng [YEAR], [LUNAR_YEAR], [SINCE:2000]. Biểu tượng nổ ra giữ màu gốc của nó.</small>
            </div>`;
    } else if (event.shell === 'Hình ảnh') {
        specific = `
            <div>
                <label>Ảnh nổ pháo hoa</label>
                <div class="image-upload-btn-large" onclick="document.getElementById('image-file-${event.id}').click()">
                    ${event.imageUrl ? '<canvas id="image-thumb" class="full-thumb"></canvas>' : '<i class="fas fa-cloud-arrow-up"></i>'}
                    <span>${event.imageUrl ? 'Đổi ảnh khác' : 'Chọn ảnh từ thiết bị'}</span>
                </div>
                <input type="file" id="image-file-${event.id}" class="hide" accept="image/*" onchange="handleImageUpload(${event.id}, this)">
                <div class="image-actions">
                    ${event.imageUrl ? `<button type="button" class="btn secondary small" onclick="openCropper(${event.id})">
                        <i class="fas fa-crop-simple"></i><span>Chọn phần hiển thị</span></button>` : ''}
                    <button type="button" class="btn secondary small library-pick" onclick="openLibrary('images', ${event.id})">
                        <i class="fas fa-images"></i><span>Chọn từ kho ảnh</span></button>
                </div>
            </div>
            <div>
                <label>Khung ảnh</label>
                <div class="shell-grid frame-grid">
                    ${FRAME_TYPES.map(f => `
                        <button type="button" class="shell-option${(event.frame || '') === f.value ? ' selected' : ''}"
                            onclick="updateEvent(${event.id}, 'frame', '${f.value}'); renderInspector()">
                            <span class="emoji">${f.icon}</span>${f.name}
                        </button>`).join('')}
                </div>
                <small class="field-hint">Pháo nổ thành viền theo hình khung, ảnh lớn dần và rõ dần bên trong.</small>
            </div>
            <div>
                <label for="f-duration">Thời gian hiện ảnh (ms)</label>
                <input type="number" id="f-duration" step="500" min="1500" max="20000" value="${escapeHtml(event.duration ?? '')}" placeholder="4500"
                    onchange="updateEvent(${event.id}, 'duration', this.value)">
                <small class="field-hint">Ảnh hiện dần ~1,8 giây, giữ lại, rồi tan thành tia lửa. Muốn đợt sau chờ ảnh tan hết thì thêm phát "Tạm dừng".</small>
            </div>`;
    } else if (event.shell === 'Lời nhắn') {
        const option = (field, value, name) => `<option value="${value}" ${(event[field] || '') === value ? 'selected' : ''}>${name}</option>`;
        specific = `
            <div>
                <label for="f-text">Nội dung lời nhắn</label>
                <textarea id="f-text" rows="3" maxlength="200" placeholder="VD: Chúc mẹ luôn mạnh khỏe và hạnh phúc!"
                    oninput="updateEvent(${event.id}, 'text', this.value)">${escapeHtml(event.text)}</textarea>
                <small class="field-hint">Hiện trên bầu trời như phụ đề, đúng lúc với pháo và nhạc nền. Enter để xuống dòng; có thể dùng [YEAR], [LUNAR_YEAR].</small>
            </div>
            <div class="grid-2">
                <div>
                    <label for="f-duration">Hiện trong (ms)${helpTip('captionDuration')}</label>
                    <input type="number" id="f-duration" step="500" min="1000" max="30000" value="${escapeHtml(event.duration ?? '')}" placeholder="4000"
                        onchange="updateEvent(${event.id}, 'duration', this.value)">
                </div>
                <div>
                    <label for="f-position">Vị trí</label>
                    <select id="f-position" onchange="updateEvent(${event.id}, 'position', this.value)">
                        ${CAPTION_POSITIONS.map(([value, name]) => option('position', value === 'bottom' ? '' : value, name)).join('')}
                    </select>
                </div>
                <div>
                    <label for="f-effect">Hiệu ứng chữ</label>
                    <select id="f-effect" onchange="updateEvent(${event.id}, 'effect', this.value)">
                        ${option('effect', '', 'Hiện dần')}${option('effect', 'type', 'Gõ từng chữ')}
                    </select>
                </div>
                <div>
                    <label for="f-textSize">Cỡ chữ</label>
                    <select id="f-textSize" onchange="updateEvent(${event.id}, 'textSize', this.value)">
                        ${option('textSize', '', 'Vừa')}${option('textSize', 'large', 'Lớn')}
                    </select>
                </div>
            </div>`;
    } else if (isPause) {
        specific = `
            <div>
                <label for="f-duration">Thời gian nghỉ (ms)</label>
                <input type="number" id="f-duration" step="500" min="0" value="${escapeHtml(event.duration || 2000)}" onchange="updateEvent(${event.id}, 'duration', this.value)">
                <small class="field-hint">Kéo dài đợt này thêm một khoảng, các đợt sau sẽ chờ.</small>
            </div>`;
    }

    const basicSection = section('basic', 'clock', 'Thời điểm', '', `
        <div class="grid-2">
            <div>
                <label for="f-burst">Đợt${helpTip('burst')}</label>
                <div class="stepper">
                    <button type="button" onclick="changeBurst(${event.id}, -1)" title="Đợt trước"><i class="fas fa-minus"></i></button>
                    <input type="number" id="f-burst" min="1" step="1" value="${escapeHtml(event.burst)}" onchange="updateEvent(${event.id}, 'burst', this.value)">
                    <button type="button" onclick="changeBurst(${event.id}, 1)" title="Đợt sau"><i class="fas fa-plus"></i></button>
                </div>
            </div>
            ${isPause ? '' : numberField(event, 'delay', isSyncMode() ? 'Nổ sau (ms)' : 'Trễ (ms)', { step: 100, min: 0, max: 60000, help: 'delay' })}
        </div>
        ${isPause ? specific : ''}`);

    // Chữ, ảnh, lời nhắn: mục "Nội dung" riêng ngay dưới loại pháo (thời gian nghỉ của Tạm dừng vẫn ở "Thời điểm")
    const contentIcon = { 'Văn bản': 'font', 'Hình ảnh': 'image', 'Lời nhắn': 'comment-dots' }[event.shell];
    const contentSection = contentIcon ? section('content', contentIcon, 'Nội dung', '', specific) : '';

    if (isPause) {
        panel.innerHTML = header + typeSection + basicSection;
        panel.scrollTop = keepScroll;
        return;
    }

    const others = getBurstEvents(Number(event.burst) || 1).filter(e => e !== event && isFireworkShot(e));
    const positionSection = section('position', 'location-crosshairs', 'Vị trí & kích thước', `${formatNumber(event.x)}, ${formatNumber(event.y)}`, `
        <div id="xy-pad" class="xy-pad${previewDevice === 'mobile' ? ' is-mobile' : ''}" title="Bấm hoặc kéo để chọn điểm nổ">
            ${others.map(o => `<span class="xy-other" style="left:${Number(o.x) || 0}%; top:${100 - (Number(o.y) || 0)}%">${state.events.indexOf(o) + 1}</span>`).join('')}
            <span class="xy-trail"></span>
            <span class="xy-dot"></span>
        </div>
        <div class="grid-3">
            ${numberField(event, 'x', 'X (trái → phải)', { step: 1, min: 0, max: 100, help: 'x' })}
            ${numberField(event, 'y', 'Y (đất → trời)', { step: 1, min: 0, max: 100, help: 'y' })}
            ${numberField(event, 'size', 'Cỡ pháo', { step: 0.5, min: 0, max: 10, help: 'size' })}
        </div>
        <div>
            <div class="field-label-row">
                <label for="f-launchAngle">Góc bắn</label>
                <output id="out-launchAngle">${escapeHtml(event.launchAngle ?? 90)}°</output>
            </div>
            <input type="range" id="f-launchAngle" min="0" max="180" step="5" value="${escapeHtml(event.launchAngle ?? 90)}"
                oninput="document.getElementById('out-launchAngle').textContent = this.value + '°'; updateEvent(${event.id}, 'launchAngle', this.value)">
            <small class="field-hint">90° là bắn thẳng lên; nhỏ hơn nghiêng sang trái, lớn hơn nghiêng sang phải.</small>
        </div>
        ${numberField(event, 'rotation', 'Xoay hình (°)', { step: 15, min: -180, max: 180, placeholder: 'Ngẫu nhiên', help: 'rotation' })}`, 'position');

    const colors = [].concat(event.color || []);
    const presetValues = COLORS.map(c => c.value);
    const customColors = colors.filter(c => !presetValues.includes(c));
    const isCaption = event.shell === 'Lời nhắn';
    const colorSection = section('color', 'palette', event.shell === 'Hình ảnh' ? 'Màu khung ảnh' : isCaption ? 'Màu chữ' : 'Màu sắc', '', `
        <div class="swatches">
            ${COLORS.map(c => `
                <button type="button" class="swatch${c.value === 'Ngẫu nhiên' ? ' random' : ''}${colors.includes(c.value) ? ' selected' : ''}"
                    style="--c: ${COLOR[c.value] || 'transparent'}" title="${c.name}" onclick="toggleEventColor(${event.id}, '${c.value}')"></button>`).join('')}
        </div>
        ${customColors.length ? `<div class="color-chips">${customColors.map(c => `
            <span class="color-tag" style="--tag-color: ${escapeHtml(c)}">
                <span class="dot"></span>${escapeHtml(c)}
                <i class="fas fa-xmark" onclick="removeColorFromEvent(${event.id}, ${colors.indexOf(c)})" title="Bỏ màu này"></i>
            </span>`).join('')}</div>` : ''}
        <div class="color-custom">
            <input type="color" id="picker-color-${event.id}" value="#ff6ad5" title="Chọn màu bất kỳ">
            <input type="text" id="custom-color-${event.id}" placeholder="Mã màu (#ff6ad5) hoặc tên"
                onkeydown="if (event.key === 'Enter') { addColorToEvent(${event.id}, this.value); }">
            <button type="button" class="btn secondary small" onclick="addCustomColor(${event.id})">Thêm</button>
        </div>
        <small class="note">${isCaption
            ? 'Lời nhắn dùng màu đầu tiên; "Ngẫu nhiên" (ô cầu vồng) là chữ trắng.'
            : 'Chọn nhiều màu để pháo đa sắc. "Ngẫu nhiên" (ô cầu vồng) cho mỗi hạt một màu. Bấm lại ô đang chọn để bỏ; không chọn ô nào thì dùng màu mặc định của loại pháo.'
                + (event.shell === 'Văn bản' ? ' Để "Ngẫu nhiên" thì biểu tượng cảm xúc trong chữ (🎓, ❤️...) giữ màu gốc của nó.' : '')}</small>`);

    // Lời nhắn chỉ cần thời điểm, nội dung và màu chữ
    if (isCaption) {
        panel.innerHTML = header + typeSection + contentSection + basicSection + colorSection;
        panel.scrollTop = keepScroll;
        return;
    }

    const soundSelect = (field, label, options) => `
        <div>
            <label for="f-${field}">${label}</label>
            <select id="f-${field}" onchange="updateEvent(${event.id}, '${field}', this.value)">
                ${options.map(([value, name]) => `<option value="${value}" ${(event[field] || '') === value ? 'selected' : ''}>${name}</option>`).join('')}
            </select>
        </div>`;
    const soundSection = section('sound', 'volume-high', 'Âm thanh', '', `
        ${soundSelect('liftSound', 'Khi phóng lên', [
            ['', 'Mặc định'], ['liftWick', 'Ngòi pháo thật'], ['liftDeep', 'Trầm'], ['liftSharp', 'Sắc'], ['liftSoft', 'Mềm'],
            ['burstSmall', 'Nhỏ'], ['crackleSmall', 'Lách tách'], ['liftWhoosh', 'Vút mạnh'], ['none', 'Im lặng']])}
        ${soundSelect('whistleSound', 'Khi bay', [
            ['', 'Không có'], ['whistle', 'Víuuuu cổ điển'], ['whistleHigh', 'Víuuuu cao'], ['whistleSwish', 'Víuuuu rơi'], ['whistleRocket', 'Tên lửa vút']])}
        ${soundSelect('burstSound', 'Khi nổ', [
            ['', 'Mặc định (mạnh)'], ['burstDeep', 'Trầm vang'], ['burstSoft', 'Nhẹ nhàng'], ['burstSmall', 'Nhỏ'], ['burstWhoosh', 'Vút'],
            ['crackleBang', 'Tiếng bụp thật'], ['crackle', 'Lách tách to'], ['crackleHeavy', 'Lách tách dồn dập'],
            ['crackleFirecracker', 'Pháo thật'], ['crackleSmall', 'Lách tách nhỏ'], ['burstOut', 'Tỏa rộng'], ['none', 'Im lặng']])}
        <small class="note">Bật <i class="fas fa-volume-high"></i> ở khung xem nhanh để nghe thử.</small>`, 'sounds');

    const builtin = SHELL_BUILTIN_EFFECTS[event.shell] || [];
    const effectChip = (field, label) => {
        const isBuiltin = builtin.includes(field);
        return `
            <label class="toggle-chip" ${isBuiltin ? 'title="Có sẵn trong loại pháo này"' : ''}>
                <input type="checkbox" ${event[field] || isBuiltin ? 'checked' : ''} ${isBuiltin ? 'disabled' : ''}
                    onchange="updateEvent(${event.id}, '${field}', this.checked)">
                <span>${label}</span>
            </label>`;
    };
    const advancedSection = section('advanced', 'wand-magic-sparkles', 'Hiệu ứng nâng cao', '', `
        <div class="toggle-chips">
            ${effectChip('strobe', 'Nhấp nháy')}
            ${effectChip('crackle', 'Lách tách')}
            ${effectChip('crossette', 'Nổ chéo')}
            ${effectChip('pistil', 'Nhụy ở giữa')}
            ${effectChip('streamers', 'Dải sáng')}
            ${effectChip('horsetail', 'Đuôi ngựa')}
            ${effectChip('floral', 'Hoa nở')}
            ${effectChip('ring', 'Vòng nhẫn')}
            ${effectChip('hang', 'Cháy lâu, rơi chậm')}
        </div>
        <div>
            <label for="f-glitter">Kiểu lấp lánh${helpTip('glitter')}</label>
            <select id="f-glitter" onchange="updateEvent(${event.id}, 'glitter', this.value)">
                ${GLITTER_TYPES.map(g => `<option value="${g.value}" ${(event.glitter || '') === g.value ? 'selected' : ''}>${g.name}</option>`).join('')}
            </select>
        </div>
        <div class="grid-2">
            ${numberField(event, 'starDensity', 'Mật độ hạt (×)', { step: 0.1, min: 0.1, placeholder: '1', help: 'starDensity' })}
            ${numberField(event, 'starCount', 'Số hạt cố định', { step: 10, min: 1, placeholder: 'Tự động', help: 'starCount' })}
            ${numberField(event, 'starLife', 'Tuổi thọ hạt (ms)', { step: 100, min: 100, placeholder: 'Theo loại pháo', help: 'starLife' })}
            ${numberField(event, 'starLifeVariation', 'Độ lệch tuổi thọ', { step: 0.05, min: 0, max: 1, placeholder: 'Theo loại pháo', help: 'starLifeVariation' })}
            ${numberField(event, 'spreadSize', 'Độ rộng vụ nổ', { step: 10, min: 50, placeholder: 'Theo loại pháo', help: 'spreadSize' })}
            ${numberField(event, 'strobeFreq', 'Nhịp nháy (ms)', { step: 10, min: 10, placeholder: '50', help: 'strobeFreq' })}
        </div>
        <div class="grid-2">
            ${colorField(event, 'secondColor', 'Màu chuyển sang', 'secondColor')}
            ${numberField(event, 'transitionTime', 'Lúc chuyển màu (ms)', { step: 100, min: 0, placeholder: 'Tự động', help: 'transitionTime' })}
            ${colorField(event, 'glitterColor', 'Màu lấp lánh', 'glitterColor')}
            ${colorField(event, 'pistilColor', 'Màu nhụy', 'pistilColor')}
            ${colorField(event, 'strobeColor', 'Màu nhấp nháy', 'strobeColor')}
        </div>`, 'effects');

    const launchStyle = LAUNCH_STYLES.find(s => s.value === (event.launchStyle || '')) || LAUNCH_STYLES[0];
    const launchSection = section('launch', 'rocket', 'Kiểu bắn', `${launchStyle.icon} ${launchStyle.name}`, `
        <div class="shell-grid launch-grid">
            ${LAUNCH_STYLES.map(s => `
                <button type="button" class="shell-option${(event.launchStyle || '') === s.value ? ' selected' : ''}"
                    onclick="updateEvent(${event.id}, 'launchStyle', '${s.value}'); renderInspector()">
                    <span class="emoji">${s.icon}</span>${s.name}
                </button>`).join('')}
        </div>
        <small class="field-hint">${launchStyle.hint}</small>`, 'launchStyle');

    // Nội dung và vị trí (chỉnh nhiều nhất) ngay dưới loại pháo để không phải cuộn mới tới; kiểu bắn ít đổi nên xuống dưới
    panel.innerHTML = header + typeSection + contentSection + positionSection + basicSection + launchSection + colorSection + soundSection + advancedSection;
    panel.scrollTop = keepScroll;
    initXYPad(event);
    paintImageThumb(event);
}

// Điện thoại: ngăn chỉnh sửa bắt đầu ngay dưới khung xem nhanh để vừa chỉnh vừa thấy pháo
// (luôn chừa ít nhất 45% chiều cao màn hình cho ngăn chỉnh sửa)
export function positionMobileSheet() {
    const panel = document.getElementById('inspector');
    const preview = document.getElementById('mini-preview');
    if (!panel || !preview) return;
    if (window.innerWidth >= 768) {
        panel.style.top = '';
        return;
    }
    const previewBottom = preview.getBoundingClientRect().bottom;
    panel.style.top = Math.min(Math.max(previewBottom, 0), window.innerHeight * 0.55) + 'px';
}

export function handleShellChange(id, value) {
    updateEvent(id, 'shell', value);
    renderEventList();
    renderInspector();
}

export function changeBurst(id, delta) {
    const event = state.events.find(e => e.id === id);
    if (!event) return;
    updateEvent(id, 'burst', (Number(event.burst) || 1) + delta);
    renderEventList();
    renderInspector();
}

// Bật/tắt một màu có sẵn: "Ngẫu nhiên" là lựa chọn riêng, các màu khác cộng dồn
export function toggleEventColor(id, color) {
    const event = state.events.find(e => e.id === id);
    if (!event) return;
    const current = Array.isArray(event.color) ? event.color : [event.color];
    if (current.includes(color)) {
        // Bấm lại ô đang chọn thì bỏ; bỏ hết thì để trống = màu mặc định của loại pháo
        const rest = current.filter(c => c !== color);
        event.color = rest.length === 0 ? '' : (rest.length === 1 ? rest[0] : rest);
        renderEventList();
        renderInspector();
    } else {
        addColorToEvent(id, color);
    }
}

export function addCustomColor(id) {
    const text = document.getElementById(`custom-color-${id}`);
    const picker = document.getElementById(`picker-color-${id}`);
    addColorToEvent(id, (text && text.value.trim()) || (picker && picker.value));
}

// Khung chọn vị trí nổ: bấm/kéo để đặt X, Y (0-100, Y tính từ mặt đất)
function initXYPad(event) {
    const pad = document.getElementById('xy-pad');
    if (!pad) return;
    syncXYPad(event.id);

    let dragging = false;
    const setFromPointer = (e) => {
        const rect = pad.getBoundingClientRect();
        const clamp = v => Math.max(0, Math.min(100, Math.round(v)));
        event.x = clamp((e.clientX - rect.left) / rect.width * 100);
        event.y = clamp(100 - (e.clientY - rect.top) / rect.height * 100);
        syncXYPad(event.id);
    };
    pad.onpointerdown = (e) => {
        dragging = true;
        pad.setPointerCapture(e.pointerId);
        setFromPointer(e);
    };
    pad.onpointermove = (e) => {
        if (dragging) setFromPointer(e);
    };
    pad.onpointerup = pad.onpointercancel = () => {
        if (!dragging) return;
        dragging = false;
        // Ghi nhận vị trí mới: cập nhật dòng thời gian và bắn lại trong khung xem nhanh
        updateEvent(event.id, 'x', event.x);
        updateEvent(event.id, 'y', event.y);
        renderEventList();
    };
}

// Đồng bộ chấm vị trí, ô X/Y và gợi ý của mục "Vị trí" theo dữ liệu
export function syncXYPad(id) {
    const event = state.events.find(e => e.id === id);
    const pad = document.getElementById('xy-pad');
    if (!event || !pad) return;
    const x = Number(event.x) || 0;
    const y = Number(event.y) || 0;
    const dot = pad.querySelector('.xy-dot');
    const trail = pad.querySelector('.xy-trail');
    dot.style.left = x + '%';
    dot.style.top = (100 - y) + '%';
    trail.style.left = x + '%';
    trail.style.height = y + '%';
    const xInput = document.getElementById('f-x');
    const yInput = document.getElementById('f-y');
    if (xInput && document.activeElement !== xInput) xInput.value = x;
    if (yInput && document.activeElement !== yInput) yInput.value = y;
    const hint = document.getElementById('hint-position');
    if (hint) hint.textContent = `${formatNumber(x)}, ${formatNumber(y)}`;
}
