/*!
 * Trình diễn Pháo hoa – builder (cài đặt chung)
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Khung bắt đầu, giao diện màn mở quà và màn kết, nhóm cài đặt và dòng tóm tắt, hẹn giờ mở quà.

import { BANK_STYLES } from '../player/bank-styles.js';
import { PEOPLE_OPTIONS } from '../player/people-options.js';
import { SEASONS, WEATHERS } from '../player/seasons.js';
import { SCREEN_CARDS, SCREEN_EFFECTS, SCREEN_FONTS, SCREEN_ICONS, SCREEN_THEMES, compactScreenTheme, loadScreenFont, resolveScreenTheme } from '../player/screen-themes.js';
import { MOON_PHASES } from '../player/moon.js';
import { qualityLevel } from '../player/quality.js';
import { state } from './state.js';
import { START_FRAMES } from './constants.js';
import { showActiveEvent } from './timeline.js';
import { renderInspector } from './inspector.js';
import { getPreviewFrame, previewMode, previewReady, sendPreview, setPreviewMode, toggleMiniPreview } from './preview.js';
import { DECOR_NAMES, VIEWER_SKY_NAMES } from './scene.js';
import { share } from './share.js';
import { toggleSidebar } from './layout.js';

// Lưới chọn khung bắt đầu trong nhóm "Màn mở quà & màn kết"
export function renderStartFrames() {
    const grid = document.getElementById('start-frame-grid');
    if (!grid) return;
    grid.innerHTML = START_FRAMES.map(f => `
        <button type="button" class="shell-option${state.startFrame === f.value ? ' selected' : ''}" onclick="setStartFrame('${f.value}')">
            <span class="emoji">${f.icon}</span>${f.name}
        </button>`).join('');
    const current = START_FRAMES.find(f => f.value === state.startFrame) || START_FRAMES[0];
    document.getElementById('start-frame-hint').textContent = `${current.hint} Bấm nút quà ở khung xem nhanh để trải nghiệm như người nhận.`;
}

export function setStartFrame(value) {
    state.startFrame = value;
    renderStartFrames();
}

// ---------------------------------------------------------------------------
// Giao diện màn mở quà & màn kết theo dịp (screen-themes.js): chọn bộ có sẵn hoặc tự chỉnh từng phần
// ---------------------------------------------------------------------------

// Tên giao diện cho dòng tóm tắt: bộ đã chọn, có tự chỉnh thì ghi thêm
function screenThemeLabel() {
    const compact = compactScreenTheme(state.screenTheme);
    const base = SCREEN_THEMES.find(t => t.id === state.screenTheme.id) || SCREEN_THEMES[0];
    if (!compact) return '';
    return Object.keys(compact).some(key => key !== 'preset' && compact[key] !== undefined) ? `${base.name} (tự chỉnh)` : base.name;
}

export function renderScreenTheme() {
    const grid = document.getElementById('screen-theme-grid');
    if (!grid) return;
    const theme = state.screenTheme;
    grid.innerHTML = SCREEN_THEMES.map(t => `
        <button type="button" class="theme-option${theme.id === t.id ? ' selected' : ''}" onclick="setScreenThemePreset('${t.id}')"
            title="${t.name}" style="--a: ${t.main}; --b: ${t.accent}">
            <span class="theme-option__swatch"><span>${t.icon}</span></span>${t.name}
        </button>`).join('');
    document.getElementById('st-main').value = theme.main;
    document.getElementById('st-accent').value = theme.accent;
    document.getElementById('st-fonts').innerHTML = Object.entries(SCREEN_FONTS).map(([key, f]) => `
        <button type="button" class="theme-font${theme.font === key ? ' selected' : ''}" onclick="setScreenThemeField('font', '${key}')"
            style="font-family: ${f.family ? `'${f.family}', ` : ''}'Inter', sans-serif; font-weight: ${f.weight}">
            <span>Chúc mừng</span><small>${f.name}</small>
        </button>`).join('');
    document.getElementById('st-effects').innerHTML = Object.entries(SCREEN_EFFECTS).map(([key, e]) => `
        <button type="button" class="theme-chip${theme.effect === key ? ' selected' : ''}" onclick="setScreenThemeField('effect', '${key}')">
            <span>${e.icon}</span>${e.name}
        </button>`).join('');
    document.getElementById('st-icons').innerHTML = SCREEN_ICONS.map(icon => `
        <button type="button" class="theme-chip${theme.icon === icon ? ' selected' : ''}" onclick="setScreenThemeField('icon', '${icon}')" aria-label="${icon}">${icon}</button>`).join('');
    document.getElementById('st-cards').innerHTML = Object.entries(SCREEN_CARDS).map(([key, name]) => `
        <button type="button" class="${theme.card === key ? 'active' : ''}" onclick="setScreenThemeField('card', '${key}')">${name}</button>`).join('');
    document.getElementById('st-border').checked = !!theme.border;
    const base = SCREEN_THEMES.find(t => t.id === theme.id) || SCREEN_THEMES[0];
    const label = screenThemeLabel();
    document.getElementById('screen-theme-custom-hint').textContent = label.includes('(tự chỉnh)') ? 'đã chỉnh' : '';
    document.getElementById('st-reset').disabled = !label.includes('(tự chỉnh)');
    document.querySelector('#st-reset span').textContent = `Về mặc định của bộ "${base.name}"`;
}

// Mở phần tự chỉnh thì tải các kiểu chữ để nút chọn hiện đúng dáng chữ
export function initScreenThemeControls() {
    const custom = document.getElementById('screen-theme-custom');
    custom?.addEventListener('toggle', () => {
        if (custom.open) Object.keys(SCREEN_FONTS).forEach(key => loadScreenFont(key));
    });
    renderScreenTheme();
}

// Chọn bộ có sẵn: bỏ phần đã tự chỉnh, xem ngay màn mở quà với giao diện mới
export function setScreenThemePreset(id) {
    state.screenTheme = resolveScreenTheme({ preset: id });
    renderScreenTheme();
    previewScreen('start');
}

// Tự chỉnh một phần (màu, kiểu chữ, hiệu ứng...): đổi ngay trên màn đang xem nhanh, không chạy lại kịch bản
export function setScreenThemeField(key, value) {
    state.screenTheme = { ...state.screenTheme, [key]: value };
    if (key === 'font') loadScreenFont(value);
    renderScreenTheme();
    pushScreenThemeToPreview();
}

export function resetScreenTheme() {
    setScreenThemePreset(state.screenTheme.id);
}

let screenThemePushFrame = 0;

function pushScreenThemeToPreview() {
    cancelAnimationFrame(screenThemePushFrame);
    screenThemePushFrame = requestAnimationFrame(() => {
        const frame = getPreviewFrame();
        if (!state.miniPreviewEnabled || !previewReady || !frame || !frame.contentWindow) return;
        frame.contentWindow.postMessage({ type: 'firework-preview-theme', screenTheme: { preset: state.screenTheme.id, ...state.screenTheme } },
            window.location.origin);
    });
}

// Xem trước màn mở quà (chạm mở thì chạy kịch bản như người nhận) hoặc màn kết trong khung xem nhanh
export function previewScreen(kind) {
    if (state.activeEventId) {
        state.activeEventId = null;
        showActiveEvent(null);
        renderInspector();
    }
    if (!state.miniPreviewEnabled) toggleMiniPreview();
    if (previewMode === 'idle') setPreviewMode('once');
    const info = document.getElementById('mini-preview-info');
    if (kind === 'end') {
        if (info) info.innerText = 'Màn kết: hiện khi kịch bản chạy hết một lượt';
        sendPreview(true, { endScreen: true });
    } else {
        if (info) info.innerText = 'Chạm vào khung xem nhanh để mở quà như người nhận';
        sendPreview(true, { startFrame: true });
    }
}

// ---------------------------------------------------------------------------
// "Cấu hình chung" chia nhóm gấp/mở: nhớ nhóm đang mở, tóm tắt nhóm đang gấp
// ---------------------------------------------------------------------------
const SETTINGS_GROUPS_KEY = 'firework_builder_groups';

export function initSettingsGroups() {
    let saved = {};
    try {
        saved = JSON.parse(localStorage.getItem(SETTINGS_GROUPS_KEY) || '{}') || {};
    } catch (e) {
        // Không đọc được: giữ mặc định (chỉ mở "Thông tin chung")
    }
    document.querySelectorAll('.settings-group').forEach(group => {
        if (typeof saved[group.dataset.group] === 'boolean') group.open = saved[group.dataset.group];
        group.addEventListener('toggle', () => {
            saved[group.dataset.group] = group.open;
            try {
                localStorage.setItem(SETTINGS_GROUPS_KEY, JSON.stringify(saved));
            } catch (e) {
                // Chế độ ẩn danh, bị chặn lưu: lần sau mở lại theo mặc định
            }
        });
    });
    // Mọi thao tác trong cột cấu hình đều có thể đổi phần tóm tắt
    const panel = document.getElementById('settings-panel');
    ['input', 'change', 'click'].forEach(type => panel?.addEventListener(type, scheduleSettingsSummaries));
    renderSettingsSummaries();
}

let settingsSummaryFrame = 0;

export function scheduleSettingsSummaries() {
    cancelAnimationFrame(settingsSummaryFrame);
    settingsSummaryFrame = requestAnimationFrame(renderSettingsSummaries);
}

function settingsSummaries() {
    const value = id => (document.getElementById(id)?.value || '').trim();
    const checked = id => !!document.getElementById(id)?.checked;
    const frame = START_FRAMES.find(f => f.value === state.startFrame) || START_FRAMES[0];
    const recipient = value('recipient');
    const music = state.music;
    const musicName = music ? (music.name || decodeURIComponent(music.url.split('/').pop().split('?')[0])) : '';
    const moon = state.moon;
    const scene = [
        state.showBackground && 'Ảnh nền',
        { few: 'Ít sao', many: 'Nhiều sao' }[state.stars],
        { faint: 'Ngân Hà mờ', bright: 'Ngân Hà rõ' }[state.milkyWay],
        { few: 'Sao băng', shower: 'Mưa sao băng' }[state.meteors],
        { few: 'Ít mây', many: 'Nhiều mây' }[state.clouds],
        !moon ? '' : moon.phase === 'auto' ? 'Trăng theo ngày' : `${MOON_PHASES[moon.phase].emoji} ${MOON_PHASES[moon.phase].name}`,
        state.decor.map(kind => DECOR_NAMES[kind]).join(', '),
        state.smoke === 'light' ? 'Khói nhẹ' : state.smoke === 'heavy' ? 'Khói dày' : '',
        state.water ? `${state.waterStyle === 'river' ? 'Sông' : 'Hồ'} ${state.water === 'third' ? '1/3' : 'nửa'} màn hình` : '',
        state.water && state.bank && BANK_STYLES.find(b => b.value === state.bank).name,
        state.water && state.people && `Người ngắm pháo: ${PEOPLE_OPTIONS.find(p => p.value === state.people).name.toLowerCase()}${state.nearBank || state.bank === 'none' ? '' : ' ở bờ bên kia'}`,
        state.season && `Mùa ${state.season === 'auto' ? 'theo ngày xem' : SEASONS.find(s => s.value === state.season).name.toLowerCase()}`,
        state.weather && WEATHERS.find(w => w.value === state.weather).name,
        state.water && { lanterns: 'hoa đăng', petals: 'cánh hoa' }[state.floating]
    ].filter(Boolean);
    const filename = value('filename');
    return {
        viewer: [
            qualityLevel(state.viewer.quality) ? `Chất lượng ${state.viewer.quality}p` : 'Chất lượng tự động',
            VIEWER_SKY_NAMES[state.viewer.skyLighting],
            state.viewer.scaleFactor !== undefined && `Thu phóng ${Math.round(state.viewer.scaleFactor * 100)}%`,
            state.viewer.fullscreen && 'Toàn màn hình',
            state.viewer.hideControls === false && 'Hiện nút',
            !state.tapToLaunch && 'Khóa chạm bắn pháo',
            !state.receiverShare && 'Khóa chia sẻ',
            state.reduceFlashing && 'Giảm chớp sáng'
        ].filter(Boolean).join(' · '),
        basics: value('title') || 'Chưa có tiêu đề',
        gift: [frame.name, screenThemeLabel(), recipient && `Gửi ${recipient}`, checked('loop') ? 'Lặp lại' : 'Chạy một lượt', state.openAt && 'Hẹn giờ']
            .filter(Boolean).join(' · '),
        sound: [music ? musicName + (music.sync ? ' · khớp nhịp' : '') : 'Chưa có nhạc', state.natureSound && 'Tiếng thiên nhiên'].filter(Boolean).join(' · '),
        scene: scene.join(' · ') || 'Không có',
        share: [filename && filename + '.json', state.seo.mode === 'custom' ? 'Ảnh của bạn' : 'Thiệp tự động'].filter(Boolean).join(' · ')
    };
}

function renderSettingsSummaries() {
    const summaries = settingsSummaries();
    document.querySelectorAll('[data-summary]').forEach(el => {
        el.textContent = summaries[el.dataset.summary] || '';
    });
}

// Đưa người soạn tới một ô trong "Cấu hình chung": mở ngăn (tablet/điện thoại), mở nhóm chứa ô, cuộn tới và đặt con trỏ
export function revealSetting(id) {
    const el = document.getElementById(id);
    if (!el) return;
    const group = el.closest('.settings-group');
    if (group && !group.open) group.open = true;
    const panel = document.getElementById('settings-panel');
    if (window.innerWidth < 1200 && !panel.classList.contains('open')) toggleSidebar();
    setTimeout(() => {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        el.focus({ preventScroll: true });
    }, 50);
}

// Giá trị cho ô datetime-local (giờ trên máy người soạn)
function toLocalInputValue(iso) {
    const d = new Date(iso);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Mục "Hẹn giờ mở quà": công tắc, giờ hẹn, cách mở, giải thích theo lựa chọn
export function renderSchedule() {
    const toggle = document.getElementById('schedule-toggle');
    if (!toggle) return;
    const on = !!state.openAt;
    toggle.checked = on;
    document.getElementById('schedule-options').classList.toggle('hide', !on);
    if (!on) return;
    document.getElementById('open-at').value = toLocalInputValue(state.openAt);
    document.getElementById('open-mode-lock').classList.toggle('active', state.openMode !== 'countdown');
    document.getElementById('open-mode-countdown').classList.toggle('active', state.openMode === 'countdown');
    const offset = -new Date().getTimezoneOffset() / 60;
    const zone = `GMT${offset >= 0 ? '+' : ''}${offset}`;
    const hint = state.openMode === 'countdown'
        ? 'Người xem bấm "Tôi đã sẵn sàng" trước giờ hẹn; 10 giây cuối hiện số đếm lớn, đúng giờ pháo hoa tự bắn (hợp cho giao thừa).'
        : 'Trước giờ hẹn người nhận thấy đồng hồ đếm ngược; tới giờ mới mở được quà.';
    const past = Date.parse(state.openAt) <= Date.now() ? ' Giờ hẹn đã qua: link sẽ mở như bình thường.' : '';
    document.getElementById('schedule-hint').textContent = `${hint} Giờ theo máy của bạn (${zone}).${past}`;
}

export function setOpenMode(mode) {
    state.openMode = mode;
    renderSchedule();
}
