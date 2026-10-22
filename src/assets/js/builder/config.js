/*!
 * Trình diễn Pháo hoa – builder (lưu, nạp kịch bản)
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Kịch bản cuối cùng (getFinalConfig), kiểm tra, lưu lên máy chủ, nạp lại vào trình soạn.

import { renderShareImage } from '../share-image.js';
import { validBankStyle } from '../player/bank-styles.js';
import { validSeason, validWeather } from '../player/seasons.js';
import { compactScreenTheme, resolveScreenTheme } from '../player/screen-themes.js';
import { getOwnerKeys, saveOwnerKey } from '../gift-tracking.js';
import backgroundImgUrl from '../../img/background.webp';
import { isStaticEnv, state } from './state.js';
import { START_FRAMES } from './constants.js';
import { hideLoading, hideModal, notify, showLoading, showModal, syncLoopState } from './util.js';
import { addEvent } from './events.js';
import { renderEventList, updateScriptNameLabel } from './timeline.js';
import { renderInspector } from './inspector.js';
import { renderMusic } from './music.js';
import { refreshMiniPreview, stopPreviewMusic, updateMiniInfo } from './preview.js';
import { clearDraft, markSaved } from './history.js';
import { renderSchedule, renderScreenTheme, renderStartFrames, revealSetting } from './settings.js';
import { WATER_LIFE_THINGS, WATER_THINGS, normalizeDecor, normalizeMoon, normalizeViewer, renderScene, renderSky, renderSmoke, renderViewer } from './scene.js';
import { renderNotifyOpen } from './gift-watch.js';
import { detectSeoImageAxis, getSeoImageConfig, openShareModal, renderSeoControls, scheduleSeoPreview, updateShareBar } from './share.js';

function validateConfig() {
    let isValid = true;
    const errors = [];

    // Reset previous errors
    document.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
    document.querySelectorAll('.validation-error-text').forEach(el => el.remove());

    const filenameInput = document.getElementById('filename');
    const filename = filenameInput.value.trim();

    if (!filename) {
        isValid = false;
        errors.push('Tên file không được để trống');
        filenameInput.classList.add('is-invalid');
    } else if (!/^[a-zA-Z0-9_-]+$/.test(filename)) {
        isValid = false;
        errors.push('Tên file chỉ được chứa chữ cái, số, gạch nối và gạch dưới');
        filenameInput.classList.add('is-invalid');
    }

    if (state.events.length === 0) {
        isValid = false;
        errors.push('Kịch bản phải có ít nhất một phát bắn');
    }

    // Đủ cho cả một bài nhạc xếp pháo theo nhịp (khoảng 10 phút)
    if (state.events.length > 500) {
        isValid = false;
        errors.push('Kịch bản quá lớn (tối đa 500 phát bắn)');
    }

    // Check for high burst counts
    const highBurstEvent = state.events.find(e => e.burst > 200);
    if (highBurstEvent) {
        isValid = false;
        errors.push(`Phát bắn #${state.events.indexOf(highBurstEvent) + 1} có số đợt quá lớn (tối đa 200)`);
    }

    if (!isValid) {
        errors.forEach(err => notify(err, 'error'));
        if (filenameInput.classList.contains('is-invalid')) revealSetting('filename');
    }

    return isValid;
}

export function getFinalConfig() {
    return {
        title: document.getElementById('title').value || "Kịch bản mới",
        subtitle: document.getElementById('subtitle').value || "",
        seoTitle: document.getElementById('seo-title').value.trim() || undefined,
        seoDescription: document.getElementById('seo-description').value.trim() || undefined,
        ...getSeoImageConfig(),
        author: document.getElementById('author').value.trim(),
        startFrame: state.startFrame || undefined,
        screenTheme: compactScreenTheme(state.screenTheme),
        openAt: state.openAt || undefined,
        notifyOpen: state.notifyOpen,
        reduceFlashing: state.reduceFlashing || undefined,
        openMode: state.openAt && state.openMode === 'countdown' ? 'countdown' : undefined,
        recipient: document.getElementById('recipient').value.trim() || undefined,
        introMessage: document.getElementById('intro-message').value.trim() || undefined,
        outroMessage: document.getElementById('outro-message').value.trim() || undefined,
        loop: document.getElementById('loop').checked,
        showBackground: state.showBackground,
        smoke: state.smoke || undefined,
        season: state.season || undefined,
        weather: state.weather || undefined,
        water: state.water || undefined,
        waterStyle: state.water && state.waterStyle === 'river' ? 'river' : undefined,
        bank: state.water && state.bank ? state.bank : undefined,
        floating: state.water && state.floating ? state.floating : undefined,
        ...Object.fromEntries(WATER_THINGS.map(key => [key, state.water && !state[key] ? false : undefined])),
        viewer: Object.keys(state.viewer).length ? { ...state.viewer } : undefined,
        tapToLaunch: state.tapToLaunch ? undefined : false,
        receiverShare: state.receiverShare ? undefined : false,
        decor: state.decor.length ? [...state.decor] : undefined,
        stars: state.stars || undefined,
        clouds: state.clouds || undefined,
        moon: state.moon ? { ...state.moon } : undefined,
        background: state.background,
        music: state.music ? { ...state.music } : undefined,
        effectsVolume: state.effectsVolume < 1 ? state.effectsVolume : undefined,
        events: state.events.map(e => {
            const { id, expanded, ...cleanEvent } = e;
            return cleanEvent;
        })
    };
}

// Backend Integration
// Helpers
async function getAvailableScripts() {
    if (isStaticEnv) {
        const localScripts = JSON.parse(localStorage.getItem('my_firework_scripts') || '{}');
        const localIds = Object.keys(localScripts);
        try {
            const response = await fetch('configs/configs_index.json');
            const staticScripts = await response.json();
            const staticIds = staticScripts.map(s => s.id);
            return [...new Set([...localIds, ...staticIds])].filter(id => id !== 'configs_index');
        } catch (e) {
            return localIds;
        }
    } else {
        try {
            const response = await fetch('api/manage_configs.php?action=list');
            const data = await response.json();
            return Array.isArray(data) ? data.map(s => s.id) : null;
        } catch (e) {
            return null;
        }
    }
}

export async function getUniqueFilename(requestedName, currentFilename) {
    const available = await getAvailableScripts();
    const reqLower = requestedName.toLowerCase();
    const currentLower = currentFilename ? currentFilename.toLowerCase() : '';

    // Nếu tên trùng với tên hiện tại đang sửa (không phân biệt hoa thường) thì cho phép ghi đè
    if (reqLower === currentLower) {
        return requestedName;
    }
    if (!available) {
        throw new Error('Không kiểm tra được tên kịch bản trên máy chủ, vui lòng thử lại.');
    }
    const existingIds = available.map(id => id.toLowerCase());

    // Nếu chưa tồn tại trong danh sách đã có thì dùng luôn
    if (!existingIds.includes(reqLower)) {
        return requestedName;
    }

    // Nếu đã tồn tại thì thêm số thứ tự
    let counter = 1;
    let newName = `${requestedName}_${counter}`;
    while (existingIds.includes(newName.toLowerCase())) {
        counter++;
        newName = `${requestedName}_${counter}`;
    }
    return newName;
}

export async function saveConfig(isPreview = false) {
    // If called from event listener, isPreview will be the event object (truthy)
    if (typeof isPreview !== 'boolean') isPreview = false;

    if (!isPreview && !validateConfig()) {
        return;
    }

    let filename = document.getElementById('filename').value.trim();

    if (isPreview) {
        // Máy chủ đặt tên ngẫu nhiên cho mỗi lần xem thử; trang tĩnh lưu trong trình duyệt của mình nên dùng tên chung
        filename = 'preview_temp';
    } else if (!filename) {
        notify('Vui lòng nhập tên file!', 'warning');
        return;
    }

    // Khóa các nút Lưu (desktop + mobile) ngay từ đầu để bấm 2 lần không lưu 2 lần
    const saveBtns = document.querySelectorAll('#btn-save, .btn-save-mobile');
    const setSaving = (saving) => saveBtns.forEach(btn => btn.disabled = saving);
    setSaving(true);

    // Xử lý tên file duy nhất nếu không phải xem thử
    if (!isPreview) {
        const originalName = filename;
        try {
            filename = await getUniqueFilename(filename, state.currentFilename);
        } catch (e) {
            setSaving(false);
            notify(e.message, 'error');
            return;
        }
        if (filename !== originalName) {
            document.getElementById('filename').value = filename;
            notify(`Tên file đã tồn tại, tự động đổi thành: ${filename}`, 'info');
        }
    }

    const config = getFinalConfig();

    if (!isPreview) {
        showModal('save-modal');
        document.getElementById('save-status').innerText = 'Đang lưu kịch bản...';
        document.getElementById('save-spinner').classList.remove('hide');
        document.getElementById('save-actions').classList.add('hide');
    } else {
        showLoading('Đang chuẩn bị xem thử...');
    }

    if (isStaticEnv) {
        // Handle static environment (GitHub Pages) using localStorage
        return new Promise((resolve) => {
            setTimeout(() => {
                setSaving(false);
                try {
                    const localScripts = JSON.parse(localStorage.getItem('my_firework_scripts') || '{}');
                    localScripts[filename] = config;
                    const json = JSON.stringify(localScripts);
                    try {
                        localStorage.setItem('my_firework_scripts', json);
                    } catch (quotaError) {
                        // Bản nháp tự lưu chiếm chỗ: kịch bản sắp được lưu hẳn nên bỏ nháp rồi thử lại
                        clearDraft();
                        localStorage.setItem('my_firework_scripts', json);
                    }
                } catch (e) {
                    // Thường do vượt giới hạn ~5MB của localStorage (ảnh nền/ảnh pháo lưu dạng DataURL rất nặng)
                    hideLoading();
                    hideModal('save-modal');
                    notify('Không thể lưu vào trình duyệt: dữ liệu quá lớn (hãy dùng ảnh nhẹ hơn hoặc bớt ảnh).', 'error');
                    resolve(null);
                    return;
                }

                if (!isPreview) {
                    state.currentFilename = filename;
                    document.getElementById('save-status').innerText = 'Đã lưu kịch bản thành công! (Lưu cục bộ tại trình duyệt)';
                    document.getElementById('save-spinner').classList.add('hide');
                    document.getElementById('save-actions').classList.remove('hide');
                    updateShareBar(filename);
                    markSaved();

                    // Lưu xong: đóng thông báo và mở hộp Chia sẻ để gửi tặng ngay
                    setTimeout(() => {
                        hideModal('save-modal');
                        openShareModal();
                    }, 1200);
                } else {
                    hideLoading();
                }
                resolve(filename);
            }, 500);
        });
    }

    // Ảnh xem trước khi gửi link (Facebook, Zalo...), máy chủ lưu thành configs/<tên>.jpg
    let shareImage;
    if (!isPreview) {
        try {
            shareImage = (await renderShareImage(config)).toDataURL('image/jpeg', 0.88);
        } catch (e) {
            // Không vẽ được ảnh thì vẫn lưu kịch bản, trang chia sẻ dùng ảnh chung
        }
    }

    return fetch('api/save_config.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // key: mã của máy đã tạo kịch bản, cần để lưu đè kịch bản của mình
        body: JSON.stringify({ filename, config, shareImage, key: getOwnerKeys()[filename], preview: isPreview || undefined })
    })
        .then(response => response.json())
        .then(async data => {
            if (!data.success && data.code === 'not_owner' && !isPreview) {
                // Kịch bản trùng tên do máy khác tạo (vd mở kịch bản của người khác rồi sửa): lưu thành bản mới của mình
                const newName = await getUniqueFilename(filename, null);
                document.getElementById('filename').value = newName;
                state.currentFilename = null;
                notify(`"${filename}" do máy khác tạo nên không ghi đè được, đã lưu thành bản mới: ${newName}`, 'info');
                setSaving(false);
                return saveConfig();
            }
            if (data.success) {
                if (data.trackKey) saveOwnerKey(data.filename, data.trackKey);
                if (!isPreview) {
                    state.currentFilename = data.filename;
                    document.getElementById('save-status').innerText = 'Đã lưu kịch bản thành công!';
                    document.getElementById('save-spinner').classList.add('hide');
                    document.getElementById('save-actions').classList.remove('hide');
                    updateShareBar(data.filename);
                    markSaved();

                    // Lưu xong: đóng thông báo và mở hộp Chia sẻ để gửi tặng ngay
                    setTimeout(() => {
                        hideModal('save-modal');
                        openShareModal();
                    }, 1200);
                } else {
                    hideLoading();
                }
                return data.filename;
            } else {
                hideLoading();
                if (!isPreview) {
                    notify('Lỗi: ' + data.message, 'error');
                    hideModal('save-modal');
                } else {
                    notify('Lỗi xem thử: ' + data.message, 'error');
                }
                throw new Error(data.message);
            }
        })
        .catch(error => {
            hideLoading();
            if (!isPreview) {
                hideModal('save-modal');
                notify('Đã xảy ra lỗi khi lưu kịch bản.', 'error');
            }
        })
        .finally(() => {
            setSaving(false);
        });
}


// ---------------------------------------------------------------------------
// LƯU NHÁP TỰ ĐỘNG & HOÀN TÁC
// Sau mỗi thao tác, chụp lại toàn bộ kịch bản đang soạn. Khác lần trước thì thêm vào lịch sử hoàn tác
// và lưu nháp vào trình duyệt, nên lỡ đóng tab hay tắt máy vẫn khôi phục được.
// Chụp cả kịch bản thay vì ghi từng thao tác: mọi cách sửa (ô nhập, kéo thả, tải ảnh, mẫu...) đều được tính.
// ---------------------------------------------------------------------------

export function loadConfigIntoState(config, filename, { migrate = true } = {}) {
    document.getElementById('title').value = config.title || '';
    document.getElementById('subtitle').value = config.subtitle || '';
    document.getElementById('seo-title').value = config.seoTitle || '';
    document.getElementById('seo-description').value = config.seoDescription || '';
    const seoPosition = Number(config.seoImagePosition);
    state.seo = {
        mode: config.seoImage ? 'custom' : 'auto',
        image: typeof config.seoImage === 'string' ? config.seoImage : null,
        imageText: config.seoImageText !== false,
        imagePosition: config.seoImagePosition !== undefined && Number.isFinite(seoPosition) ? Math.max(0, Math.min(100, seoPosition)) : 50,
        axis: 'y'
    };
    detectSeoImageAxis();
    renderSeoControls();
    scheduleSeoPreview();
    document.getElementById('author').value = config.author || '';
    document.getElementById('recipient').value = config.recipient || '';
    state.startFrame = START_FRAMES.some(f => f.value === config.startFrame) ? config.startFrame : '';
    renderStartFrames();
    state.screenTheme = resolveScreenTheme(config.screenTheme);
    renderScreenTheme();
    state.openAt = config.openAt && Number.isFinite(Date.parse(config.openAt)) ? config.openAt : '';
    state.openMode = config.openMode === 'countdown' ? 'countdown' : 'lock';
    renderSchedule();
    // Kịch bản cũ chưa có lựa chọn này: bật như kịch bản mới
    state.notifyOpen = config.notifyOpen !== false;
    renderNotifyOpen();
    state.reduceFlashing = config.reduceFlashing === true;
    document.getElementById('reduce-flashing').checked = state.reduceFlashing;
    document.getElementById('intro-message').value = config.introMessage || '';
    document.getElementById('outro-message').value = config.outroMessage || '';
    document.getElementById('loop').checked = config.loop !== false;
    document.getElementById('filename').value = filename;

    state.events = [];
    state.nextId = 1;
    state.activeEventId = null;
    state.currentFilename = filename;
    state.showBackground = !!config.showBackground;
    state.smoke = ['light', 'heavy'].includes(config.smoke) ? config.smoke : '';
    renderSmoke();
    state.water = ['third', 'half'].includes(config.water) ? config.water : '';
    state.waterStyle = config.waterStyle === 'river' ? 'river' : 'lake';
    state.bank = validBankStyle(config.bank);
    state.floating = ['lanterns', 'petals'].includes(config.floating) ? config.floating : '';
    // Kịch bản cũ ghi waterLife: false (tắt cả cò, vịt, cá, gỗ)
    WATER_THINGS.forEach(key => {
        state[key] = config[key] !== false && !(config.waterLife === false && WATER_LIFE_THINGS.includes(key));
    });
    state.viewer = normalizeViewer(config.viewer);
    state.tapToLaunch = config.tapToLaunch !== false;
    state.receiverShare = config.receiverShare !== false;
    renderViewer();
    renderScene();
    state.decor = normalizeDecor(config.decor);
    state.stars = ['few', 'many'].includes(config.stars) ? config.stars : '';
    state.clouds = ['few', 'many'].includes(config.clouds) ? config.clouds : '';
    state.moon = normalizeMoon(config.moon);
    state.season = validSeason(config.season);
    state.weather = validWeather(config.weather);
    renderSky();
    state.background = config.background || null;
    state.music = config.music && typeof config.music.url === 'string' ? { ...config.music } : null;
    const effectsVolume = Number(config.effectsVolume);
    state.effectsVolume = config.effectsVolume !== undefined && Number.isFinite(effectsVolume) ? Math.max(0, Math.min(1, effectsVolume)) : 1;
    stopPreviewMusic();
    renderMusic();

    document.getElementById('show-background').checked = state.showBackground;
    document.getElementById('background-upload-container').classList.toggle('hide', !state.showBackground);
    if (state.background) {
        document.getElementById('background-preview').src = state.background;
    } else {
        document.getElementById('background-preview').src = backgroundImgUrl;
    }
    refreshMiniPreview();

    if (config.events && Array.isArray(config.events)) {
        // Kịch bản lưu bởi builder phiên bản cũ dùng tọa độ 0-1: đổi sang 0-100. Chỉ khi mọi phát có tọa độ đều trong 0-1
        // (kịch bản mới có thể có phát sát góc, vd x=1, y=0), và không làm khi hoàn tác/khôi phục nháp.
        const positioned = config.events.filter(ev => typeof ev.x === 'number' && typeof ev.y === 'number');
        if (migrate && positioned.length && positioned.every(ev => ev.x <= 1 && ev.y <= 1)) {
            positioned.forEach(ev => {
                // Làm tròn 1 chữ số thập phân (0.3 * 100 = 30.000000000000004)
                ev.x = Math.round(ev.x * 1000) / 10;
                ev.y = Math.round(ev.y * 1000) / 10;
            });
        }
        // Vẽ danh sách một lần sau khi thêm đủ (vẽ lại sau mỗi phát thì kịch bản dài rất chậm)
        config.events.forEach(ev => addEvent(ev, { render: false }));
        renderEventList();
    } else {
        addEvent();
    }
    renderInspector();
    updateMiniInfo();
    updateScriptNameLabel();
    // Sau khi đã có phát bắn của kịch bản mới: chạy lại khung xem nhanh từ đầu theo kịch bản này
    syncLoopState();
}
