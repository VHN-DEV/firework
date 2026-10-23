/*!
 * Hanabi – builder (âm thanh thiên nhiên)
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Âm thanh thiên nhiên của kịch bản: bật/tắt, âm lượng, bật/tắt từng nhóm tiếng (danh sách nhóm dùng chung với trình
// phát: player/nature/scene.js).

import { NATURE_GROUPS, NATURE_VOLUME, validNatureOff, validNatureVolume } from '../player/nature/scene.js';
import { state } from './state.js';
import { refreshMiniPreview } from './preview.js';
import { scheduleSettingsSummaries } from './settings.js';

export function renderNatureSound() {
    const toggle = document.getElementById('nature-sound');
    if (!toggle) return;
    toggle.checked = state.natureSound;
    document.getElementById('nature-options').classList.toggle('hide', !state.natureSound);
    const volume = Math.round(state.natureVolume * 100);
    document.getElementById('nature-volume').value = volume;
    document.getElementById('out-nature-volume').textContent = volume + '%';
    const chips = document.getElementById('nature-things');
    if (!chips.children.length) {
        chips.innerHTML = NATURE_GROUPS.map(group => `
            <label class="toggle-chip"><input type="checkbox" data-nature-group="${group.key}"><span>${group.icon} ${group.name}</span></label>`).join('');
    }
    chips.querySelectorAll('[data-nature-group]').forEach(input => {
        input.checked = !state.natureOff.includes(input.dataset.natureGroup);
    });
    scheduleSettingsSummaries();
}

export function setupNatureSound() {
    document.getElementById('nature-sound')?.addEventListener('change', (e) => {
        state.natureSound = e.target.checked;
        renderNatureSound();
        refreshMiniPreview();
    });
    document.getElementById('nature-volume')?.addEventListener('input', (e) => {
        state.natureVolume = Number(e.target.value) / 100;
        document.getElementById('out-nature-volume').textContent = e.target.value + '%';
        refreshMiniPreview();
    });
    document.getElementById('nature-things')?.addEventListener('change', (e) => {
        const key = e.target.dataset.natureGroup;
        if (!key) return;
        state.natureOff = validNatureOff(e.target.checked ? state.natureOff.filter(k => k !== key) : [...state.natureOff, key]);
        refreshMiniPreview();
    });
    renderNatureSound();
}

// Phần ghi vào kịch bản: chỉ ghi khi khác mặc định
export function natureSoundConfig() {
    return {
        natureSound: state.natureSound ? undefined : false,
        natureVolume: state.natureVolume !== NATURE_VOLUME ? state.natureVolume : undefined,
        natureOff: state.natureOff.length ? [...state.natureOff] : undefined
    };
}

// Kịch bản đọc vào (không có thì về mặc định: bật, âm lượng mặc định, nghe mọi nhóm)
export function loadNatureSound(config = {}) {
    state.natureSound = config.natureSound !== false;
    state.natureVolume = validNatureVolume(config.natureVolume);
    state.natureOff = validNatureOff(config.natureOff);
    renderNatureSound();
}
