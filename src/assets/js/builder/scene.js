/*!
 * Trình diễn Pháo hoa – builder (khung cảnh)
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Khung cảnh: khói, sao, mây, trăng, trang trí, mùa, thời tiết, mặt nước, kiểu bờ, khi người nhận xem.

import { BANK_STYLES, validBankStyle } from '../player/bank-styles.js';
import { SEASONS, seasonOfDate, validSeason, validWeather } from '../player/seasons.js';
import { MOON_PHASES, moonFraction, moonIllumination, moonPhaseIndex } from '../player/moon.js';
import { QUALITY_AUTO, validQuality } from '../player/quality.js';
import { state } from './state.js';
import { refreshMiniPreview } from './preview.js';
import { scheduleSettingsSummaries } from './settings.js';

// Khói pháo (Tắt / Nhẹ / Dày) trong Cấu hình chung
export function setSmoke(level) {
    state.smoke = level;
    renderSmoke();
    refreshMiniPreview();
}

// Bầu trời đêm (nhóm "Khung cảnh & hiệu ứng"): sao, trăng, trang trí
export const DECOR_NAMES = { lanterns: 'Đèn trời', balloons: 'Khinh khí cầu', planes: 'Máy bay' };

export function setStars(level) {
    state.stars = level;
    renderSky();
    refreshMiniPreview();
}

export function setMilkyWay(level) {
    state.milkyWay = level;
    renderSky();
    refreshMiniPreview();
}

export function setMeteors(level) {
    state.meteors = level;
    renderSky();
    refreshMiniPreview();
}

export function setClouds(level) {
    state.clouds = level;
    renderSky();
    refreshMiniPreview();
}

// mode: '' không có trăng, 'auto' theo ngày người nhận xem, 'pick' tự chọn pha
export function setMoonMode(mode) {
    if (!mode) state.moon = null;
    else {
        const current = state.moon || { x: 78, y: 80 };
        const phase = mode === 'auto' ? 'auto' : (Number.isInteger(current.phase) ? current.phase : moonPhaseIndex(moonFraction()));
        state.moon = { ...current, phase };
    }
    renderSky();
    refreshMiniPreview();
}

export function setMoonPhase(index) {
    state.moon = { ...(state.moon || { x: 78, y: 80 }), phase: index };
    renderSky();
    refreshMiniPreview();
}

// Mùa: '' hạ, 'auto' theo ngày người nhận xem, 'spring' / 'autumn' / 'winter'
export function setSeason(value) {
    state.season = validSeason(value);
    renderSky();
    refreshMiniPreview();
}

export function setWeather(value) {
    state.weather = validWeather(value);
    renderSky();
    refreshMiniPreview();
}

export function toggleDecor(kind) {
    state.decor = state.decor.includes(kind) ? state.decor.filter(k => k !== kind) : [...state.decor, kind];
    renderSky();
    refreshMiniPreview();
}

export function renderSky() {
    const mark = (selector, attr, value) => document.querySelectorAll(selector).forEach(btn => {
        const on = typeof value === 'function' ? value(btn.dataset[attr]) : btn.dataset[attr] === value;
        btn.classList.toggle('active', on);
        btn.setAttribute('aria-pressed', String(on));
    });
    const moon = state.moon;
    const mode = !moon ? '' : moon.phase === 'auto' ? 'auto' : 'pick';
    mark('.sky-stars [data-stars]', 'stars', state.stars || '');
    mark('.sky-milky-way [data-milky-way]', 'milkyWay', state.milkyWay || '');
    mark('.sky-meteors [data-meteors]', 'meteors', state.meteors || '');
    mark('.sky-clouds [data-clouds]', 'clouds', state.clouds || '');
    mark('.sky-moon [data-moon]', 'moon', mode);
    mark('.scene-decor [data-decor]', 'decor', kind => state.decor.includes(kind));
    mark('.scene-season [data-season]', 'season', state.season);
    mark('.scene-weather [data-weather]', 'weather', state.weather);
    const seasonHint = document.getElementById('season-hint');
    if (seasonHint) {
        const season = SEASONS.find(s => s.value === state.season) || SEASONS.find(s => !s.value);
        const today = SEASONS.find(s => s.value === (seasonOfDate(new Date()) === 'summer' ? '' : seasonOfDate(new Date())));
        seasonHint.textContent = state.season === 'auto'
            ? `Hôm nay: ${today.icon} mùa ${today.name.toLowerCase()}. Người nhận mở vào mùa khác sẽ thấy cảnh của mùa đó.`
            : season.hint;
    }
    const phases = document.getElementById('moon-phases');
    phases.classList.toggle('hide', mode !== 'pick');
    phases.innerHTML = MOON_PHASES.map((p, i) => `
        <button type="button" class="${mode === 'pick' && moon.phase === i ? 'active' : ''}" onclick="setMoonPhase(${i})"
            title="${p.name}" aria-label="${p.name}">${p.emoji}</button>`).join('');
    const hint = document.getElementById('moon-hint');
    if (mode === 'auto') {
        const fraction = moonFraction();
        const today = MOON_PHASES[moonPhaseIndex(fraction)];
        hint.textContent = `Hôm nay: ${today.emoji} ${today.name} (sáng ${Math.round(moonIllumination(fraction) * 100)}%). `
            + 'Người nhận mở vào hôm khác sẽ thấy trăng của hôm đó.';
    } else if (mode === 'pick') {
        hint.textContent = `${MOON_PHASES[moon.phase].emoji} ${MOON_PHASES[moon.phase].name}`;
    } else {
        hint.textContent = '';
    }
    hint.classList.toggle('hide', !mode);
    document.getElementById('moon-position').classList.toggle('hide', !mode);
    if (moon) {
        document.getElementById('moon-x').value = moon.x;
        document.getElementById('moon-y').value = moon.y;
        document.getElementById('out-moon-x').textContent = moon.x;
        document.getElementById('out-moon-y').textContent = moon.y;
    }
    scheduleSettingsSummaries();
}

// Kịch bản cũ ghi trang trí dạng chữ ("both" = đèn trời + khinh khí cầu)
export function normalizeDecor(decor) {
    if (Array.isArray(decor)) return decor.filter(kind => DECOR_NAMES[kind]);
    return { lanterns: ['lanterns'], balloons: ['balloons'], both: ['lanterns', 'balloons'] }[decor] || [];
}

export function normalizeMoon(moon) {
    if (!moon || typeof moon !== 'object') return null;
    const percent = (value, fallback, min, max) => (Number.isFinite(Number(value)) ? Math.max(min, Math.min(max, Math.round(Number(value)))) : fallback);
    const phase = Number.isInteger(Number(moon.phase)) && moon.phase !== '' ? Math.max(0, Math.min(7, Number(moon.phase))) : 'auto';
    return { phase, x: percent(moon.x, 78, 5, 95), y: percent(moon.y, 80, 15, 95) };
}

// Mặt nước (nhóm "Khung cảnh & hiệu ứng")
export function setWater(level) {
    state.water = level;
    renderScene();
    refreshMiniPreview();
}

export function setWaterStyle(style) {
    state.waterStyle = style;
    renderScene();
    refreshMiniPreview();
}

// Kiểu bờ bên kia mặt nước (bờ đất, kè gạch, phố cổ, cầu...)
export function setBank(value) {
    state.bank = validBankStyle(value);
    renderScene();
    refreshMiniPreview();
}

function renderBankStyles() {
    const grid = document.getElementById('bank-grid');
    if (!grid) return;
    grid.innerHTML = BANK_STYLES.map(b => `
        <button type="button" class="shell-option${state.bank === b.value ? ' selected' : ''}" onclick="setBank('${b.value}')">
            <span class="emoji">${b.icon}</span>${b.name}
        </button>`).join('');
    document.getElementById('bank-hint').textContent = (BANK_STYLES.find(b => b.value === state.bank) || BANK_STYLES[0]).hint;
}

export function setFloating(kind) {
    state.floating = kind;
    renderScene();
    refreshMiniPreview();
}

export function renderScene() {
    [['.scene-water [data-water]', 'water', state.water || ''], ['.water-style [data-style]', 'style', state.waterStyle],
        ['.water-floating [data-floating]', 'floating', state.floating || '']].forEach(([selector, attr, value]) => {
        document.querySelectorAll(selector).forEach(btn => {
            const on = btn.dataset[attr] === value;
            btn.classList.toggle('active', on);
            btn.setAttribute('aria-pressed', String(on));
        });
    });
    document.getElementById('water-options')?.classList.toggle('hide', !state.water);
    renderBankStyles();
    document.querySelectorAll('[data-water-thing]').forEach(input => { input.checked = state[input.dataset.waterThing]; });
    // Thước dọc của khung xem nhanh: độ cao 0 là mặt nước
    const level = { third: 2 / 3, half: 0.5 }[state.water] || 1;
    const rulerY = document.getElementById('mini-ruler-y');
    if (rulerY) rulerY.style.height = level < 1 ? `calc(${level * 100}% + 10px)` : '';
    scheduleSettingsSummaries();
}

// Trên mặt nước (mục "Trên mặt nước"); kịch bản cũ chỉ có một công tắc waterLife cho cò, vịt, cá, gỗ
export const WATER_THINGS = ['waterBirds', 'waterDucks', 'waterFish', 'waterFrogs', 'waterLogs', 'waterPlants', 'waterRocks'];

export const WATER_LIFE_THINGS = ['waterBirds', 'waterDucks', 'waterFish', 'waterFrogs', 'waterLogs'];

// Cách xem đặt sẵn (nhóm "Khi người nhận xem"): chỉ lưu mục khác mặc định của trình phát
export const VIEWER_SKY_NAMES = { 0: 'Trời không sáng theo pháo', 1: 'Trời sáng mờ' };

export function setViewerOption(key, value) {
    if (value === '' || value === undefined || value === null) delete state.viewer[key];
    else state.viewer[key] = value;
    renderViewer();
    refreshMiniPreview();
}

export function renderViewer() {
    const v = state.viewer;
    [['.viewer-sky', v.skyLighting]].forEach(([selector, value]) => {
        document.querySelectorAll(`${selector} [data-value]`).forEach(btn => {
            const on = btn.dataset.value === String(value ?? '');
            btn.classList.toggle('active', on);
            btn.setAttribute('aria-pressed', String(on));
        });
    });
    const quality = document.getElementById('viewer-quality');
    if (quality) quality.value = v.quality ?? '';
    const scale = document.getElementById('viewer-scale');
    if (scale) scale.value = v.scaleFactor !== undefined ? String(v.scaleFactor) : '';
    const fullscreen = document.getElementById('viewer-fullscreen');
    if (fullscreen) fullscreen.checked = v.fullscreen === true;
    const controls = document.getElementById('viewer-controls');
    if (controls) controls.checked = v.hideControls === false;
    const tap = document.getElementById('tap-to-launch');
    if (tap) tap.checked = state.tapToLaunch;
    const receiverShare = document.getElementById('receiver-share');
    if (receiverShare) receiverShare.checked = state.receiverShare;
    scheduleSettingsSummaries();
}

// Kịch bản đọc vào: chỉ nhận giá trị hợp lệ
export function normalizeViewer(viewer) {
    const v = viewer && typeof viewer === 'object' ? viewer : {};
    const out = {};
    // Kịch bản cũ ghi Thấp / Vừa / Cao (1-3): đổi sang mức tương ứng (480p, 720p, 4K)
    if (v.quality !== undefined && validQuality(v.quality) !== QUALITY_AUTO) out.quality = validQuality(v.quality);
    if (['0', '1'].includes(String(v.skyLighting))) out.skyLighting = String(v.skyLighting);
    if (Number(v.scaleFactor) >= 0.5 && Number(v.scaleFactor) <= 2) out.scaleFactor = Number(v.scaleFactor);
    if (v.hideControls === false) out.hideControls = false;
    if (v.fullscreen === true) out.fullscreen = true;
    return out;
}

export function renderSmoke() {
    document.querySelectorAll('.smoke-levels [data-smoke]').forEach(btn => {
        const on = btn.dataset.smoke === (state.smoke || '');
        btn.classList.toggle('active', on);
        btn.setAttribute('aria-pressed', String(on));
    });
    scheduleSettingsSummaries();
}

// ---------------------------------------------------------------------------
// MẪU THEO DỊP: chọn dịp + tên -> màn trình diễn hoàn chỉnh để chỉnh tiếp
// ---------------------------------------------------------------------------
