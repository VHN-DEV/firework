/*!
 * Hanabi – builder (âm thanh thiên nhiên)
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Âm thanh thiên nhiên của kịch bản: bật/tắt, âm lượng, bật/tắt từng nhóm tiếng (danh sách nhóm dùng chung với trình
// phát: player/nature/scene.js).

import { NATURE_GROUPS, NATURE_VOLUME, ambienceLayers, eventSounds, natureScene, validNatureOff, validNatureVolume } from '../player/nature/scene.js';
import { resolveSeason } from '../player/seasons.js';
import { state } from './state.js';
import { refreshMiniPreview } from './preview.js';
import { scheduleSettingsSummaries } from './settings.js';

// Tiếng nền, tiếng sự việc của trình phát -> nhóm tiếng (tiếng nước bắn do nhiều thứ gây ra nên không tính)
const LAYER_GROUPS = { water: 'water', leaves: 'trees', crickets: 'insects', frogChorus: 'frogs', rain: 'rain' };
const EVENT_GROUPS = { bubble: 'water', shore: 'water', crash: 'water', plip: 'fish', frog: 'frogs', quack: 'ducks', wings: 'ducks', egret: 'birds', egretWings: 'birds' };

// Nhóm tiếng nghe được trong cảnh đang soạn, tính bằng chính cách trình phát chọn tiếng (mùa theo ngày xem: mùa nào có
// cũng tính). Biển khơi không có cò, vịt, ếch như mặt nước của trình phát.
function audibleGroups() {
    const sea = state.bank === 'none';
    const life = { birds: !sea && state.waterBirds, ducks: !sea && state.waterDucks, fish: state.waterFish, frogs: !sea && state.waterFrogs, bubbles: true };
    const seasons = state.season === 'auto' ? ['spring', 'summer', 'autumn', 'winter'] : [resolveSeason(state.season)];
    const groups = new Set();
    seasons.forEach(season => {
        const scene = natureScene({ water: !!state.water, style: state.waterStyle, bank: state.bank, season, weather: state.weather, life, rocks: state.waterRocks });
        ambienceLayers(scene).forEach(layer => groups.add(LAYER_GROUPS[layer.id]));
        eventSounds(scene).forEach(sound => groups.add(EVENT_GROUPS[sound.id]));
    });
    return groups;
}

// Vì sao chưa nghe tiếng này (nút mờ đi, vẫn bật/tắt được)
function silentReason(key) {
    if (key === 'rain') return 'Chọn Mưa ở mục Thời tiết để có tiếng mưa';
    if (!state.water) return 'Bật Mặt nước để có tiếng này';
    return 'Cảnh đang chọn không có tiếng này (theo kiểu bờ, mùa, thời tiết, mục Trên mặt nước)';
}

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
    const audible = audibleGroups();
    chips.querySelectorAll('[data-nature-group]').forEach(input => {
        const key = input.dataset.natureGroup;
        input.checked = !state.natureOff.includes(key);
        const chip = input.closest('.toggle-chip');
        chip.classList.toggle('is-idle', !audible.has(key));
        chip.title = audible.has(key) ? '' : silentReason(key);
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
