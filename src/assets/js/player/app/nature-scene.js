/*!
 * Trình diễn Pháo hoa – trình phát (âm thanh thiên nhiên của cảnh)
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Cảnh để nghe tiếng thiên nhiên: theo kịch bản (mặt nước, kiểu bờ, mùa, thời tiết, sinh vật, natureSound, natureVolume,
// natureOff) và cài đặt của người xem (Cài đặt > Âm thanh thiên nhiên).

import { season, weather } from '../state.js';
import { validBankStyle } from '../bank-styles.js';
import { resolveSeason, validWeather } from '../seasons.js';
import { natureScene, validNatureOff, validNatureVolume } from '../nature/scene.js';
import { burstConfig, store, waterLifeFlags } from '../../script.js';

// Cảnh của một kịch bản (mùa "theo ngày xem", thời tiết: đã tính sẵn thì truyền vào)
export function natureSceneOf(config, { viewer = store.state.config.natureSound !== false, seasonNow, weatherNow } = {}) {
    const c = config || {};
    return natureScene({
        on: viewer && c.natureSound !== false,
        volume: validNatureVolume(c.natureVolume),
        off: validNatureOff(c.natureOff),
        water: ['third', 'half'].includes(c.water),
        style: c.waterStyle,
        bank: validBankStyle(c.bank),
        season: seasonNow ?? resolveSeason(c.season),
        weather: weatherNow ?? (validWeather(c.weather) || ''),
        life: waterLifeFlags(c),
        music: !!c.music
    });
}

let cache = { config: undefined, viewer: undefined, season: '', weather: '', scene: null };

// Cảnh đang xem (gọi mỗi khung hình): chỉ tính lại khi kịch bản, cài đặt người xem, mùa, thời tiết đổi; cùng cảnh như
// trước (kịch bản xem nhanh gửi lại sau mỗi lần sửa) thì giữ nguyên đối tượng cũ
export function currentNatureScene() {
    const viewer = store.state.config.natureSound !== false;
    const s = season();
    const w = weather();
    if (cache.scene && cache.config === burstConfig && cache.viewer === viewer && cache.season === s && cache.weather === w) return cache.scene;
    const scene = natureSceneOf(burstConfig, { viewer, seasonNow: s, weatherNow: w });
    cache = { config: burstConfig, viewer, season: s, weather: w, scene: cache.scene && cache.scene.key === scene.key ? cache.scene : scene };
    return cache.scene;
}
