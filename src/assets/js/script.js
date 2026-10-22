/*!
 * Trình diễn Pháo hoa – trình phát
 * Phần bổ sung và chỉnh sửa © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Điểm vào của trình phát: tạo lớp vẽ, kho cài đặt, nối giao diện, nạp kịch bản, khởi động theo chế độ (xem thường,
// xem nhanh trong builder, dựng video). Câu lệnh chạy ngay ở cấp ngoài cùng giữ ở đây theo đúng thứ tự. Phần còn lại trong
// player/app/: fullscreen, help-content, shell-picker (chọn pháo ngẫu nhiên), countdown (hẹn giờ mở quà), recording (dựng
// video, chụp ảnh), sequences (chuỗi bắn tự động), event-shots (phát bắn theo kịch bản, khớp nhịp nhạc), input (chạm,
// phím), quality-tuning (độ phân giải, vẽ dư, chất lượng tự động), viewer-defaults, render-loop (cập nhật, vẽ mỗi khung),
// sky-color (màu trời theo pháo).

import '../scss/style.scss';
import fscreen from './fscreen@1.0.1.js';
import { Stage, Ticker } from './Stage@0.1.4.js';
import MyMath from './MyMath.js';
import { printCopyrightNotice } from './copyright.js';
import { createFrameComposer, createMp4Writer, mixAudio } from './recorder.js';
import { advanceClock, after, cancel, now, useSimulatedClock } from './player/clock.js';
import { setupViewerShare } from './viewer-share.js';
import { getOwnerKeys } from './gift-tracking.js';
import { CONFIG_NAME, IS_DESKTOP, IS_HEADER, IS_HIGH_END_DEVICE, IS_PREVIEW, IS_RECORD, MAX_HEIGHT, MAX_WIDTH, QUALITY_HIGH, QUALITY_NORMAL, SKY_LIGHT_DIM, SKY_LIGHT_NONE, SKY_LIGHT_NORMAL, getDefaultScaleFactor } from './player/env.js';
import { isLowQuality, quality, setCanPlaySound, setHorizon, setIsRunning, setQuality, setReduceFlashing, setSeason, setSettings, setSimSpeed, setSmokeLevel, setSoundEnabled, setStageSize, setWeather } from './player/state.js';
import { QUALITY_AUTO, QUALITY_LEVELS, qualityLevel, validQuality } from './player/quality.js';
import { preloadFlagFont, reserveTextCache } from './player/shapes.js';
import { normalizeAssetPath, replacePlaceholders } from './player/utils.js';
import { Spark } from './player/particles.js';
import { getRequiredSoundTypes, musicPlayer, soundManager } from './player/audio.js';
import { crysanthemumShell, setRandomShell } from './player/shells.js';
import { getProcessedImage, imageParticleCache } from './player/image-burst.js';
import { imageCacheKey } from './player/image-frame.js';
import { Shell } from './player/shell.js';
import { SMOKE_RESOLUTION } from './player/smoke.js';
import { WATER_RESOLUTION } from './player/scenery/index.js';
import { resolveSeason, validWeather } from './player/seasons.js';
import { MOON_PHASES, moonFraction } from './player/moon.js';
import { START_FRAMES, frameText } from './player/start-frames.js';
import { applyScreenTheme, createScreenAmbient, resolveScreenTheme, themedTitle } from './player/screen-themes.js';
import { clearCaptions, showCaption } from './player/captions.js';
import { fullscreenEnabled, isFullscreen, toggleFullscreen } from './player/app/fullscreen.js';
import { helpContent } from './player/app/help-content.js';
import { randomShell } from './player/app/shell-picker.js';
import { countdownActive, isLockedUntilLater, startCountdown } from './player/app/countdown.js';
import { RECORD_FPS, RECORD_LEAD, RECORD_MAX_MS, composeSnapshot, finishRecording, frameSources, loadMusicForVideo, postToBuilder, recording, stepAnimations } from './player/app/recording.js';
import { seqPyramid, seqRandomFastShell, seqRandomShell, seqSmallBarrage, seqTriple, seqTwoRandom } from './player/app/sequences.js';
import { buildEventShot, buildSyncTimeline, estimateFlightTime, isMusicSynced, launchEventShot } from './player/app/event-shots.js';
import { handleKeydown, handlePointerEnd, handlePointerMove, handlePointerStart, isUpdatingSpeed, menuOpenedByCornerAt } from './player/app/input.js';
import { AUTO_QUALITY_START, applyQualityLimits, autoQuality, renderQualityLabel, superSampler } from './player/app/quality-tuning.js';
import { applyViewerDefaults } from './player/app/viewer-defaults.js';
import { update } from './player/app/render-loop.js';

// Assign to window for global access (needed by HTML and other scripts)
window.fscreen = fscreen;

window.Stage = Stage;

window.Ticker = Ticker;

window.MyMath = MyMath;

'use strict';

console.clear();

printCopyrightNotice('Trình diễn Pháo hoa');

// Màn trình diễn tặng riêng (?config=..., có tên người nhận) không đưa lên công cụ tìm kiếm.
// Đặt ngay khi tải trang vì Google không bấm nút "Bắt đầu".
if (IS_PREVIEW || IS_RECORD || new URLSearchParams(window.location.search).get('config')) {
    document.querySelector('meta[name="robots"]')?.setAttribute('content', 'noindex, follow');
}

// Cài đặt khi xem mà kịch bản đặt sẵn được (VIEWER_KEYS) và phần được lưu lại cho người xem
const VIEWER_KEYS = ['quality', 'skyLighting', 'scaleFactor', 'hideControls', 'reduceFlashing'];

const PERSISTED_VIEWER_KEYS = ['quality', 'skyLighting', 'scaleFactor', 'reduceFlashing'];

export let burstConfig = null;

let burstCounter = 0;

// Stage.disableHighDPI = true;
export const trailsStage = new Stage('trails-canvas');

export const mainStage = new Stage('main-canvas');

// Lớp khói tự quản lý kích thước (độ phân giải thấp), không qua Stage
export const smokeCanvas = document.getElementById('smoke-canvas');

export const smokeCtx = smokeCanvas.getContext('2d');

// Cảnh vật theo kịch bản: trang trí bầu trời (đèn trời, khinh khí cầu) và mặt nước phản chiếu
export const decoCanvas = document.getElementById('deco-canvas');

export const decoCtx = decoCanvas.getContext('2d');

export const waterCanvas = document.getElementById('water-canvas');

export const waterCtx = waterCanvas.getContext('2d');

// Kích thước khung (điểm ảnh CSS)
export let frameW = 0;

export let frameH = 0;

// Lớp mặt nước đang vẽ thưa theo chất lượng thấp không (xem handleResize)
export let waterLowQuality = null;

export const stages = [
    trailsStage,
    mainStage
];

// Đồng bộ hóa các thay đổi toàn màn hình với store. Trình xử lý sự kiện là cần thiết vì người dùng có thể
// chuyển đổi chế độ toàn màn hình trực tiếp thông qua trình duyệt và chúng tôi muốn phản ứng với điều đó.
fscreen.addEventListener('fullscreenchange', () => {
    store.setState({ fullscreen: isFullscreen() });
});

// Vùng chứa trạng thái đơn giản; nguồn gốc của sự thật.
export const store = {
    _listeners: new Set(),
    _dispatch(prevState) {
        this._listeners.forEach(listener => listener(this.state, prevState))
    },

    state: {
        // sẽ được bỏ tạm dừng trong init()
        paused: true,
        // Xem nhanh trong builder thì tắt tiếng (iframe không có thao tác người dùng để mở âm thanh)
        soundEnabled: !IS_PREVIEW,
        menuOpen: false,
        openHelpTopic: null,
        fullscreen: isFullscreen(),
        // Lưu ý rằng các giá trị cấu hình được sử dụng cho <select> phải là chuỗi, trừ khi chuyển đổi giá trị thành chuỗi theo cách thủ công
        // tại thời điểm kết xuất và phân tích cú pháp khi thay đổi.
        config: {
            // Tự động theo máy (xem autoQuality); khung quay video luôn vẽ đủ hiệu ứng (độ phân giải theo video)
            quality: IS_RECORD ? '2160' : QUALITY_AUTO,
            customText: '',
            shell: [
                'Nổ lách tách',
                'Nổ chéo',
                'Hoa cúc',
                'Lá rơi',
                'Lá rụng',
                'Hoa',
                'Ma',
                'Đuôi ngựa',
                'Cây cọ',
                'Vòng nhẫn',
                'Nhấp nháy',
                'Liễu',
                'Xoay vòng',
                'Xoắn ốc',
                'Cháy lâu'
            ],
            size: IS_DESKTOP
                ? '3' // Mặc định trên màn hình
                : IS_HEADER
                    ? '1.2' // Mặc định tiêu đề hồ sơ (không cần phải là int)
                    : '2', // Mặc định trên thiết bị di động
            autoLaunch: true,
            finale: false,
            skyLighting: SKY_LIGHT_NORMAL + '',
            hideControls: true,
            showBackground: false,
            longExposure: false,
            // Giảm chớp sáng (người nhạy cảm với ánh sáng nhấp nháy): mặc định theo cài đặt "giảm chuyển động" của máy
            reduceFlashing: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
            scaleFactor: getDefaultScaleFactor()
        }
    },

    // Mục người xem đã tự chọn trong Cài đặt (kịch bản đặt sẵn giá trị khác cũng không ghi đè), giá trị đã lưu của họ, và
    // các mục đang mang giá trị kịch bản đặt sẵn (khi lưu thì ghi giá trị của người xem, không ghi giá trị kịch bản)
    chosen: new Set(),
    saved: {},
    scriptKeys: new Set(),

    setState(nextState) {
        const prevState = this.state;
        this.state = Object.assign({}, this.state, nextState);
        this._dispatch(prevState);
        this.persist();
    },

    subscribe(listener) {
        this._listeners.add(listener);
        return () => this._listeners.delete(listener);
    },

    // Tải/duy trì trạng thái chọn vào localStorage
    // Thay đổi trạng thái vì `store.load()` chỉ được gọi một lần ngay sau khi cửa hàng được tạo, trước bất kỳ đăng ký nào.
    load() {
        const serializedData = localStorage.getItem('cm_fireworks_data');
        if (serializedData) {
            const {
                schemaVersion,
                data
            } = JSON.parse(serializedData);

            const config = this.state.config;
            switch (schemaVersion) {
                // Kích thước pháo đã lưu từ bản cũ bỏ qua: menu không còn mục này nên không đổi lại được
                case '1.1':
                    config.quality = validQuality(data.quality);
                    config.skyLighting = data.skyLighting;
                    break;
                case '1.2':
                    config.quality = validQuality(data.quality);
                    config.skyLighting = data.skyLighting;
                    config.scaleFactor = data.scaleFactor || getDefaultScaleFactor();
                    if (typeof data.reduceFlashing === 'boolean') config.reduceFlashing = data.reduceFlashing;
                    if (Array.isArray(data.chosen)) {
                        data.chosen.forEach(key => this.chosen.add(key));
                    } else {
                        // Bản lưu cũ chưa ghi mục nào tự chọn: giá trị khác mặc định của máy thì coi như người xem đã tự chọn
                        const defaults = {
                            quality: String(IS_HIGH_END_DEVICE ? QUALITY_HIGH : QUALITY_NORMAL),
                            skyLighting: SKY_LIGHT_NORMAL + '',
                            scaleFactor: getDefaultScaleFactor(),
                            reduceFlashing: window.matchMedia('(prefers-reduced-motion: reduce)').matches
                        };
                        Object.keys(defaults).forEach(key => {
                            if (key === 'quality' && data.quality === QUALITY_AUTO) return;
                            if (data[key] !== undefined && String(data[key]) !== String(defaults[key])) this.chosen.add(key);
                        });
                    }
                    break;
                default:
                    throw new Error('version switch should be exhaustive');
            }
            console.log(`Loaded config (schema version ${schemaVersion})`);
        }
    },

    persist() {
        // Bản xem nhanh, khung quay video (có thể giả lập điện thoại) không được ghi đè cài đặt thật của người dùng
        if (IS_PREVIEW || IS_RECORD) return;
        const config = this.state.config;
        // Mục đang theo kịch bản: giữ giá trị của người xem
        const value = key => (this.scriptKeys.has(key) && key in this.saved ? this.saved[key] : config[key]);
        const data = {
            quality: value('quality'),
            skyLighting: value('skyLighting'),
            scaleFactor: value('scaleFactor'),
            reduceFlashing: value('reduceFlashing'),
            chosen: [...this.chosen].filter(key => PERSISTED_VIEWER_KEYS.includes(key))
        };
        this.saved = data;
        try {
            localStorage.setItem('cm_fireworks_data', JSON.stringify({ schemaVersion: '1.2', data }));
        } catch (e) {
            // localStorage không khả dụng (chế độ ẩn danh, bị chặn...) - bỏ qua
        }
    }
};

if (!IS_HEADER && !IS_PREVIEW && !IS_RECORD) {
    try {
        store.load();
    } catch (e) {
        // Dữ liệu đã lưu bị hỏng hoặc không đọc được: dùng cấu hình mặc định thay vì làm treo ứng dụng
        console.error('Không thể tải cấu hình đã lưu:', e);
    }
}

// Giá trị của người xem (đã lưu hoặc mặc định), để trả lại khi kịch bản thôi đặt sẵn
VIEWER_KEYS.forEach(key => { store.saved[key] = store.state.config[key]; });

// hành động
// ---------

export function togglePause(toggle) {
    const paused = store.state.paused;
    let newValue;
    if (typeof toggle === 'boolean') {
        newValue = toggle;
    } else {
        newValue = !paused;
    }

    if (paused !== newValue) {
        store.setState({ paused: newValue });
    }
}

export function toggleSound(toggle) {
    if (typeof toggle === 'boolean') {
        store.setState({ soundEnabled: toggle });
    } else {
        store.setState({ soundEnabled: !store.state.soundEnabled });
    }
}

export function toggleMenu(toggle) {
    if (typeof toggle === 'boolean') {
        store.setState({ menuOpen: toggle });
    } else {
        store.setState({ menuOpen: !store.state.menuOpen });
    }
}

// Mọi lần gọi đều từ thao tác của người xem trong Cài đặt (hoặc nút Giảm chớp sáng ở màn mở quà): mục nào đổi thì ghi
// nhận là người xem tự chọn, kịch bản đặt sẵn giá trị khác cũng không ghi đè
function updateConfig(nextConfig) {
    nextConfig = nextConfig || getConfigFromDOM();
    // Người xem chọn lại mức chất lượng: thử vẽ dư lại từ đầu
    if ('quality' in nextConfig && String(nextConfig.quality) !== String(store.state.config.quality)) superSampler.reset();
    VIEWER_KEYS.forEach(key => {
        if (key in nextConfig && String(nextConfig[key]) !== String(store.state.config[key])) {
            store.chosen.add(key);
            store.scriptKeys.delete(key);
        }
    });
    store.setState({
        config: Object.assign({}, store.state.config, nextConfig)
    });

    configDidUpdate();
}

// Ánh xạ cấu hình tới các thuộc tính khác nhau và áp dụng các tác dụng phụ
export function configDidUpdate() {
    const config = store.state.config;

    setQuality(qualitySelector());
    applyQualityLimits();

    if (skyLightingSelector() === SKY_LIGHT_NONE) {
        appNodes.stageContainer.style.backgroundColor = '#000';
    }

    Spark.drawWidth = quality === QUALITY_HIGH ? 0.75 : 1;
}

// Bộ chọn
// -----------

export const isRunning = (state = store.state) => !state.paused && !state.menuOpen;

// Liệu người dùng có bật âm thanh hay không.
const soundEnabledSelector = (state = store.state) => state.soundEnabled;

// Liệu bất kỳ âm thanh nào có được phép hay không, có tính đến nhiều yếu tố.
const canPlaySoundSelector = (state = store.state) => isRunning(state) && soundEnabledSelector(state);

// Mức chất lượng đang dùng (player/quality.js): chọn "Tự động" thì theo autoQuality
export const qualityLevelSelector = () => qualityLevel(store.state.config.quality === QUALITY_AUTO ? autoQuality : store.state.config.quality)
    || qualityLevel(AUTO_QUALITY_START);

// Mức hiệu ứng (1-3) các module hạt pháo dùng
const qualitySelector = () => qualityLevelSelector().tier;

// Người xem tự bật, hoặc người tạo bật sẵn cho cả màn trình diễn (kịch bản có reduceFlashing)
export const reduceFlashingSelector = () => !!(store.state.config.reduceFlashing || (burstConfig && burstConfig.reduceFlashing));

// Các module hạt pháo, âm thanh đọc cài đặt của trình phát qua state.js
setReduceFlashing(reduceFlashingSelector);

setCanPlaySound(() => canPlaySoundSelector());

setSoundEnabled(() => soundEnabledSelector());

setSettings(() => store.state.config);

setIsRunning(() => isRunning());

// Khói pháo theo kịch bản ("light" nhẹ, "heavy" dày); chất lượng 480p trở xuống thì tắt để máy yếu không giật
export const SMOKE_LEVELS = { light: 1, heavy: 2 };

setSmokeLevel(() => (isLowQuality || !burstConfig ? 0 : SMOKE_LEVELS[burstConfig.smoke] || 0));

// Mặt nước: đường chân trời (điểm phóng) nâng lên 1/3 hoặc nửa màn hình
const WATER_LEVELS = { third: 2 / 3, half: 0.5 };

export const horizonSelector = () => (burstConfig && WATER_LEVELS[burstConfig.water]) || 1;

// Sinh vật trên mặt nước bật/tắt riêng từng loại; kịch bản cũ ghi waterLife: false là tắt hết
export const waterLifeFlags = () => {
    const config = burstConfig || {};
    const off = config.waterLife === false;
    return {
        birds: !off && config.waterBirds !== false,
        ducks: !off && config.waterDucks !== false,
        fish: !off && config.waterFish !== false,
        logs: !off && config.waterLogs !== false,
        frogs: !off && config.waterFrogs !== false,
        // Bong bóng nước nổi lên rồi vỡ: luôn có (là một phần của mặt nước)
        bubbles: true
    };
};

setHorizon(horizonSelector);

// Mùa của cảnh (theo ngày xem thì tính một lần khi mở kịch bản) và thời tiết
let seasonCache = { config: undefined, value: 'summer' };

setSeason(() => {
    if (seasonCache.config !== burstConfig) seasonCache = { config: burstConfig, value: resolveSeason(burstConfig && burstConfig.season) };
    return seasonCache.value;
});

setWeather(() => (burstConfig && validWeather(burstConfig.weather)) || '');

// Bầu trời đêm theo kịch bản: sao, trăng, trang trí. Kịch bản cũ ghi decor dạng chữ ("both" = đèn trời + khinh khí cầu).
const DECOR_KINDS = ['lanterns', 'balloons', 'planes'];

const DECOR_ALIASES = { lanterns: ['lanterns'], balloons: ['balloons'], both: ['lanterns', 'balloons'] };

const clampPercent = (value, fallback) => (Number.isFinite(Number(value)) ? Math.max(0, Math.min(100, Number(value))) : fallback);

let skyCache = { config: undefined, background: undefined, key: '', scene: null };

// Tính lại khi đổi kịch bản hoặc bật/tắt ảnh nền; trăng "theo ngày" lấy pha của lúc người xem mở. Bản xem nhanh nhận
// kịch bản mới sau mỗi lần sửa: phần bầu trời không đổi thì giữ nguyên cảnh (không rải lại sao, đèn trời, máy bay).
export function sceneSelector() {
    const background = !!store.state.config.showBackground;
    if (skyCache.config === burstConfig && skyCache.background === background) return skyCache.scene;
    const key = burstConfig ? JSON.stringify([burstConfig.decor, burstConfig.stars, burstConfig.moon, burstConfig.clouds, background]) : '';
    if (burstConfig && key === skyCache.key) {
        skyCache.config = burstConfig;
        return skyCache.scene;
    }
    let scene = null;
    if (burstConfig) {
        const decor = Array.isArray(burstConfig.decor)
            ? burstConfig.decor.filter(kind => DECOR_KINDS.includes(kind))
            : DECOR_ALIASES[burstConfig.decor] || [];
        const stars = ['few', 'many'].includes(burstConfig.stars) ? burstConfig.stars : '';
        const m = burstConfig.moon;
        const phase = m && Number.isInteger(Number(m.phase)) ? MOON_PHASES[Math.max(0, Math.min(7, Number(m.phase)))] : null;
        const moon = m && typeof m === 'object'
            ? { fraction: phase ? phase.fraction : moonFraction(new Date()), x: clampPercent(m.x, 78), y: clampPercent(m.y, 80) }
            : null;
        const clouds = ['few', 'many'].includes(burstConfig.clouds) ? burstConfig.clouds : '';
        if (decor.length || stars || moon || clouds) scene = { decor, stars, moon, clouds, background };
    }
    skyCache = { config: burstConfig, background, key, scene };
    return scene;
}

// Ảnh nền đứng trên mép nước khi có mặt nước
function applyScenery(config) {
    const level = (config && WATER_LEVELS[config.water]) || 1;
    appNodes.backgroundImage.style.height = level < 1 ? `${level * 100}%` : '';
    appNodes.backgroundImage.style.backgroundPosition = level < 1 ? 'center bottom' : '';
}

export const shellNameSelector = () => {
    const shells = store.state.config.shell;
    if (Array.isArray(shells) && shells.length > 0) {
        return shells[Math.floor(Math.random() * shells.length)];
    }
    return typeof shells === 'string' ? shells : 'Ngẫu nhiên';
};

// Chuyển đổi kích thước vỏ thành số.
export const shellSizeSelector = () => +store.state.config.size;

const finaleSelector = () => store.state.config.finale;

export const skyLightingSelector = () => +store.state.config.skyLighting;

export const scaleFactorSelector = () => store.state.config.scaleFactor;

// Kết xuất giao diện người dùng ứng dụng/đồng bộ hóa với trạng thái
export const appNodes = {
    stageContainer: '.stage-container',
    backgroundImage: '.background-image',
    canvasContainer: '.canvas-container',
    controls: '.controls',
    menu: '.menu',
    menuInnerWrap: '.menu__inner-wrap',
    pauseBtn: '.pause-btn',
    pauseBtnSVG: '.pause-btn use',
    soundBtn: '.sound-btn',
    soundBtnSVG: '.sound-btn use',
    settingsBtn: '.settings-btn',
    closeMenuBtn: '.close-menu-btn',
    quality: '.quality-ui',
    skyLighting: '.sky-lighting',
    scaleFactor: '.scaleFactor',
    hideControls: '.hide-controls',
    fullscreenFormOption: '.form-option--fullscreen',
    fullscreen: '.fullscreen',
    reduceFlashing: '.reduce-flashing',
    reduceFlashingToggle: '.start-screen__a11y',

    // Giao diện trợ giúp
    helpModal: '.help-modal',
    loadingInit: '.loading-init',
    loadingStatus: '.loading-init__status',
    helpModalOverlay: '.help-modal__overlay',
    helpModalHeader: '.help-modal__header',
    helpModalBody: '.help-modal__body',
    helpModalCloseBtn: '.help-modal__close-btn',

    // Màn hình bắt đầu và màn kết
    startScreen: '.start-screen',
    btnStart: '.btn-start',
    endScreen: '.end-screen'
};

// Chuyển đổi bộ chọn appNodes thành nút dom
Object.keys(appNodes).forEach(key => {
    appNodes[key] = document.querySelector(appNodes[key]);
});

// Xóa kiểm soát toàn màn hình nếu không được hỗ trợ.
if (!fullscreenEnabled()) {
    appNodes.fullscreenFormOption.classList.add('remove');
}

// Kết xuất đầu tiên được gọi trong init()
function renderApp(state) {
    const pauseBtnIcon = `#icon-${state.paused ? 'play' : 'pause'}`;
    const soundBtnIcon = `#icon-sound-${soundEnabledSelector() ? 'on' : 'off'}`;
    appNodes.pauseBtnSVG.setAttribute('href', pauseBtnIcon);
    appNodes.pauseBtnSVG.setAttribute('xlink:href', pauseBtnIcon);
    appNodes.soundBtnSVG.setAttribute('href', soundBtnIcon);
    appNodes.soundBtnSVG.setAttribute('xlink:href', soundBtnIcon);
    appNodes.controls.classList.toggle('hide', state.menuOpen || state.config.hideControls);
    appNodes.canvasContainer.classList.toggle('blur', state.menuOpen);
    appNodes.menu.classList.toggle('hide', !state.menuOpen);

    appNodes.quality.value = state.config.quality;
    appNodes.skyLighting.value = state.config.skyLighting;
    appNodes.hideControls.checked = state.config.hideControls;
    appNodes.fullscreen.checked = state.fullscreen;

    // Hiển thị/ẩn nền
    appNodes.backgroundImage.classList.toggle('show', state.config.showBackground);
    // Kịch bản bật sẵn giảm chớp sáng: công tắc hiện bật và khóa lại (như nút trên màn mở quà)
    const flashForced = !!(burstConfig && burstConfig.reduceFlashing);
    appNodes.reduceFlashing.checked = flashForced || state.config.reduceFlashing;
    appNodes.reduceFlashing.disabled = flashForced;
    renderReduceFlashingToggle();
    appNodes.scaleFactor.value = (state.config.scaleFactor || 1).toFixed(2);

    appNodes.menuInnerWrap.style.opacity = state.openHelpTopic ? 0.12 : 1;
    appNodes.helpModal.classList.toggle('active', !!state.openHelpTopic);
    if (state.openHelpTopic) {
        const { header, body, extra } = helpContent[state.openHelpTopic];
        appNodes.helpModalHeader.textContent = header;
        appNodes.helpModalBody.textContent = extra ? `${body} ${extra()}` : body;
    }
}

store.subscribe(renderApp);

// Thực hiện các tác dụng phụ khi thay đổi trạng thái
function handleStateChange(state, prevState) {
    const canPlaySound = canPlaySoundSelector(state);
    const canPlaySoundPrev = canPlaySoundSelector(prevState);

    if (canPlaySound !== canPlaySoundPrev) {
        if (canPlaySound) {
            soundManager.resumeAll();
            musicPlayer.resume();
        } else {
            soundManager.pauseAll();
            musicPlayer.pause();
        }
    }
}

store.subscribe(handleStateChange);

// Chuyển sang ứng dụng/tab khác thì pháo đứng lại, nhạc cũng dừng theo để không lệch nhịp
document.addEventListener('visibilitychange', () => {
    if (document.hidden) musicPlayer.pause();
    else if (canPlaySoundSelector()) musicPlayer.resume();
});

// Chỉ các cài đặt còn trên menu; loại pháo, kích thước, tự động bắn... giữ giá trị mặc định (kịch bản tự quyết)
function getConfigFromDOM() {
    return {
        quality: appNodes.quality.value,
        skyLighting: appNodes.skyLighting.value,
        // Đang khóa theo kịch bản: giữ lựa chọn riêng của người xem
        reduceFlashing: appNodes.reduceFlashing.disabled ? store.state.config.reduceFlashing : appNodes.reduceFlashing.checked,
        hideControls: appNodes.hideControls.checked,
        // Lưu trữ giá trị dưới dạng số.
        scaleFactor: parseFloat(appNodes.scaleFactor.value)
    };
}

const updateConfigNoEvent = () => updateConfig();

appNodes.quality.addEventListener('input', updateConfigNoEvent);

appNodes.skyLighting.addEventListener('input', updateConfigNoEvent);

appNodes.reduceFlashing.addEventListener('click', () => setTimeout(updateConfig, 0));

// Nút "Giảm chớp sáng" trên màn mở quà: bật trước khi pháo bắt đầu
appNodes.reduceFlashingToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    updateConfig({ reduceFlashing: !store.state.config.reduceFlashing });
});

// config: kịch bản đang mở quà (lúc đó trình phát chưa nạp kịch bản)
function renderReduceFlashingToggle(config = burstConfig) {
    const toggle = appNodes.reduceFlashingToggle;
    if (!toggle) return;
    const forced = !!(config && config.reduceFlashing);
    const on = forced || store.state.config.reduceFlashing;
    toggle.setAttribute('aria-pressed', String(on));
    toggle.disabled = forced;
    toggle.querySelector('span').textContent = forced ? 'Đã giảm chớp sáng' : on ? 'Giảm chớp sáng: bật' : 'Giảm chớp sáng';
}

appNodes.hideControls.addEventListener('click', () => setTimeout(updateConfig, 0));

const stopAndRun = (fn) => (e) => {
    e.stopPropagation();
    e.preventDefault();
    fn(e);
};

appNodes.pauseBtn.addEventListener('click', stopAndRun(() => togglePause()));

appNodes.soundBtn.addEventListener('click', stopAndRun(() => toggleSound()));

appNodes.settingsBtn.addEventListener('click', stopAndRun(() => toggleMenu()));

appNodes.closeMenuBtn.addEventListener('click', stopAndRun(() => {
    if (Date.now() - menuOpenedByCornerAt < 600) return;
    toggleMenu(false);
}));

// Ngăn chặn các sự kiện chuột và chạm nổi bọt lên document (nơi Stage đang lắng nghe)
const stopPropagation = (e) => e.stopPropagation();
[appNodes.pauseBtn, appNodes.soundBtn, appNodes.settingsBtn, appNodes.closeMenuBtn, appNodes.btnStart, appNodes.startScreen,
    appNodes.endScreen.querySelector('.end-screen__content')].forEach(node => {
    if (!node) return;
    node.addEventListener('mousedown', stopPropagation);
    node.addEventListener('touchstart', stopPropagation);
});

appNodes.fullscreen.addEventListener('click', () => setTimeout(toggleFullscreen, 0));

// Việc thay đổi thang đo cũng yêu cầu kích hoạt mã xử lý thay đổi kích thước.
appNodes.scaleFactor.addEventListener('input', () => {
    updateConfig();
    handleResize();
});

// Nút "?" cạnh từng cài đặt mở lời giải thích (bấm vào tên cài đặt thì đổi cài đặt như bình thường)
appNodes.menu.querySelectorAll('[data-help]').forEach(btn => {
    btn.addEventListener('click', () => store.setState({ openHelpTopic: btn.dataset.help }));
});

appNodes.helpModalCloseBtn.addEventListener('click', () => {
    store.setState({ openHelpTopic: null });
});

appNodes.helpModalOverlay.addEventListener('click', () => {
    store.setState({ openHelpTopic: null });
});

// "Ngẫu nhiên" trong danh sách loại pháo
setRandomShell(randomShell);

window.preloadFireworkImage = (url, frame, crop) => {
    if (!url) return;
    const normalizedUrl = normalizeAssetPath(url);
    const cacheKey = imageCacheKey(normalizedUrl, frame, crop);
    if (!imageParticleCache.has(cacheKey)) {
        const img = new Image();
        // img.crossOrigin = "Anonymous"; // Bỏ cái này nếu gặp lỗi CORS trên localhost
        img.onload = () => {
            const processed = getProcessedImage(img, frame, crop);
            imageParticleCache.set(cacheKey, processed);
        };
        img.onerror = (e) => {
            console.error('[Firework] Failed to load image:', normalizedUrl, e);
        };
        img.src = normalizedUrl;
    }
};

// Đọc kịch bản trong link (?config=<tên>): bản lưu trong trình duyệt (trang tĩnh) hoặc file configs/<tên>.json
async function fetchBurstConfig(configName) {
    const isStaticEnv = window.location.hostname.includes('github.io') ||
                        window.location.hostname.includes('vercel.app') ||
                        window.location.hostname.includes('netlify.app') ||
                        window.location.protocol === 'file:';

    let config;
    if (isStaticEnv) {
        try {
            const localScripts = JSON.parse(localStorage.getItem('my_firework_scripts') || '{}');
            if (localScripts[configName]) {
                config = localScripts[configName];
            }
        } catch (e) {
            // localStorage hỏng hoặc bị chặn: thử tải file kịch bản bên dưới
        }
    }

    if (!config) {
        const response = await fetch(`./configs/${encodeURIComponent(configName)}.json`);
        if (!response.ok) throw new Error('Config not found');
        config = await response.json();
    }

    if (!config || !Array.isArray(config.events)) {
        throw new Error('Invalid config: missing events');
    }
    return config;
}

export const configRequest = !IS_PREVIEW && CONFIG_NAME
    ? fetchBurstConfig(CONFIG_NAME).catch(e => {
        console.error('Error loading burst config:', e);
        return null;
    })
    : Promise.resolve(null);

async function loadBurstConfig() {
    const config = await configRequest;
    if (!config) return;
    viewerShare.setConfig(config);
    try {
        burstConfig = await prepareBurstConfig(config, { showOverlay: true });
        soundManager.setEffectsVolume(burstConfig.effectsVolume ?? 1);
        musicPlayer.load(burstConfig.music);
    } catch (e) {
        console.error('Error loading burst config:', e);
    }
}

let startFrameMounted = false;

let startFrameAbort = null;

// Giao diện theo dịp (màu, kiểu chữ, kiểu thiệp, hiệu ứng nền) cho màn mở quà, màn đếm ngược và màn kết
export let screenTheme = resolveScreenTheme();

export const startAmbient = createScreenAmbient(appNodes.startScreen);

const endAmbient = createScreenAmbient(appNodes.endScreen);

// Áp giao diện của kịch bản; trả về promise xong khi kiểu chữ tiêu đề đã tải (để thiệp hiện ra không bị nhảy chữ)
export function themeScreens(config) {
    screenTheme = resolveScreenTheme(config && config.screenTheme);
    const ready = applyScreenTheme(screenTheme);
    // Biểu tượng trên thiệp chào; màn kết của bộ Cổ điển giữ phong thư như trước
    appNodes.startScreen.querySelector('.start-screen__gift').textContent = screenTheme.icon;
    appNodes.endScreen.querySelector('.end-screen__icon').textContent =
        screenTheme.id || (config && config.screenTheme && config.screenTheme.icon) ? screenTheme.icon : '💌';
    const endTitle = appNodes.endScreen.querySelector('.end-screen__title');
    if (endTitle.textContent) endTitle.textContent = themedTitle(endTitle.dataset.raw || endTitle.textContent, screenTheme);
    return ready;
}

// Dựng khung bắt đầu theo kịch bản (chỉ một lần, trừ remount) và chờ người xem bấm để vào màn trình diễn
export function mountStartFrame(config, { remount = false } = {}) {
    if (startFrameMounted && !remount) return;
    startFrameMounted = true;
    // Dựng lại (hết giờ hẹn sau khi thiệp chung đã hiện): bỏ lời mời bấm của lần dựng trước
    if (startFrameAbort) startFrameAbort.abort();
    startFrameAbort = new AbortController();
    reportGiftEvent('view', config);
    renderReduceFlashingToggle(config);
    const themed = themeScreens(config);
    const frame = START_FRAMES[config && config.startFrame] || START_FRAMES.card;
    const { trigger, open, firstLaunchDelay } = frame.mount(appNodes.startScreen, config);
    if (config) {
        const title = frameText(config.seoTitle) || frameText(config.title);
        if (title) document.title = title;
    }
    themed.then(() => appNodes.startScreen.classList.add('is-ready'));
    startAmbient.start(screenTheme, { lowQuality: isLowQuality });
    trigger.addEventListener('click', (e) => {
        // Ngăn chặn sự kiện nổi bọt để tránh Stage nhận được tín hiệu bắn pháo hoa
        e.stopPropagation();
        e.preventDefault();
        // Kịch bản muốn xem toàn màn hình: chỉ bật được ngay trong lúc người xem chạm (trình duyệt không cho tự bật)
        if (config && config.viewer && config.viewer.fullscreen === true && !IS_PREVIEW && !IS_RECORD && !isFullscreen()) {
            toggleFullscreen();
        }
        beginShow(open, firstLaunchDelay);
    }, { once: true, signal: startFrameAbort.signal });
}

export function beginShow(open, firstLaunchDelay) {
    // Mở khóa âm thanh ngay trong lúc người xem bấm (AudioContext và phần tử phát nhạc nền)
    soundManager.resumeAll();
    musicPlayer.unlock();

    // Khoảng chờ tới phát bắn tự động đầu tiên, để không chồng lấp với lúc bấm
    autoLaunchTime = firstLaunchDelay;

    // Tải trong lúc chạy hiệu ứng mở: chỉ các âm thanh kịch bản dùng tới
    const ready = configRequest.then(config => soundManager.preload(getRequiredSoundTypes(config)));
    let loaded = false;
    ready.then(() => { loaded = true; }, () => { loaded = true; });

    open().then(() => {
        appNodes.startScreen.classList.add('hide');
        if (!loaded) {
            appNodes.loadingInit.classList.remove('remove');
            setLoadingStatus('Đang châm ngòi');
        }
        const start = () => {
            // Mạng chậm: người xem bấm thiệp chào chung trước khi kịch bản tải xong, mà kịch bản hẹn giờ chưa tới thì
            // quay về màn đếm ngược (startCountdown đã chạy lúc kịch bản tới)
            if (countdownActive) {
                appNodes.loadingInit.classList.add('remove');
                appNodes.startScreen.classList.remove('hide');
                return;
            }
            configRequest.then(config => reportGiftEvent('open', config));
            init();
        };
        ready.then(
            start,
            reason => {
                start();
                return Promise.reject(reason);
            }
        );
    });
}

// ---------------------------------------------------------------------------
// BÁO MỞ QUÀ (kịch bản bật notifyOpen, bản có máy chủ PHP, xem api/opens.php): ghi lại lúc người nhận mở link, bấm
// mở quà, xem hết (chỉ thời điểm và loại thiết bị) để người gửi biết. Người gửi tự mở thử trên máy mình thì không
// tính; tải lại trang trong 30 phút cũng không tính lại. Người nhận được báo trước bằng một dòng nhỏ dưới khung mở quà.
// ---------------------------------------------------------------------------

const REPORTED_KEY = 'firework_reported';

export function reportGiftEvent(type, config) {
    if (!config || config.notifyOpen !== true || !CONFIG_NAME || IS_PREVIEW || IS_RECORD || IS_HEADER) return;
    if (type === 'view') showOpenNotice();
    if (getOwnerKeys()[CONFIG_NAME]) return;
    try {
        const reported = JSON.parse(localStorage.getItem(REPORTED_KEY) || '{}');
        const key = `${CONFIG_NAME}:${type}`;
        if (Date.now() - (reported[key] || 0) < 30 * 60 * 1000) return;
        reported[key] = Date.now();
        localStorage.setItem(REPORTED_KEY, JSON.stringify(reported));
    } catch (e) {
        // localStorage bị chặn: vẫn báo
    }
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const device = !coarse ? 'desktop' : Math.min(screen.width, screen.height) < 600 ? 'mobile' : 'tablet';
    const body = JSON.stringify({ id: CONFIG_NAME, event: type, device });
    const url = 'api/opens.php?action=record';
    if (!(navigator.sendBeacon && navigator.sendBeacon(url, body))) {
        fetch(url, { method: 'POST', body, keepalive: true }).catch(() => {});
    }
}

function showOpenNotice() {
    const legal = appNodes.startScreen.querySelector('.start-screen__legal');
    if (!legal || legal.querySelector('.start-screen__notice')) return;
    const notice = document.createElement('span');
    notice.className = 'start-screen__notice';
    notice.textContent = 'Người gửi sẽ biết khi bạn mở quà';
    legal.prepend(notice);
}

// ---------------------------------------------------------------------------
// HẸN GIỜ MỞ QUÀ: kịch bản có `openAt` (thời điểm ISO) chưa tới thì hiện màn đếm ngược.
// openMode 'lock' (mặc định): tới giờ mới hiện khung bắt đầu để mở quà.
// openMode 'countdown': người xem bấm "Tôi đã sẵn sàng" (trình duyệt chỉ cho phát tiếng sau một lần bấm),
// 10 giây cuối hiện số đếm lớn, đúng giờ pháo hoa tự bắn (vd. giao thừa). Không bấm thì tới giờ hiện khung bắt đầu.
// ---------------------------------------------------------------------------

// Kịch bản không lặp chạy xong: thiệp lời chúc cuối, nút xem lại và nút tạo màn pháo hoa mới
let endScreenTimer = null;

// force: bản xem nhanh muốn xem trước màn kết (kể cả khi kịch bản đang lặp)
function showEndScreen(force = false) {
    // Khung dựng video: thay màn kết bằng thiệp lời chúc trong video rồi xong
    if (IS_RECORD) {
        finishRecording();
        return;
    }
    if (IS_HEADER || !burstConfig || (burstConfig.loop && !force)) return;
    if (!force) reportGiftEvent('finish', burstConfig);
    const screen = appNodes.endScreen;
    const title = screen.querySelector('.end-screen__title');
    title.dataset.raw = burstConfig.title || 'Cảm ơn bạn đã xem!';
    title.textContent = title.dataset.raw;
    themeScreens(burstConfig);
    screen.querySelector('.end-screen__message').textContent =
        String(replacePlaceholders(burstConfig.outroMessage || '')).trim() || burstConfig.subtitle || '';
    screen.querySelector('.end-screen__from').textContent = burstConfig.author || '';
    screen.classList.remove('hide');
    endAmbient.start(screenTheme, { lowQuality: isLowQuality });
    if (IS_PREVIEW) previewInteractive(true);
}

// Bản xem nhanh: builder chỉ cho chạm vào khung khi đang có màn mở quà hoặc màn kết (bình thường chạm nhầm sẽ bắn pháo)
function previewInteractive(on) {
    window.parent.postMessage({ type: 'firework-preview-interactive', on }, window.location.origin);
}

function replayShow() {
    // Bản xem nhanh: builder chạy lại cả kịch bản (kèm nhạc nếu đang bật âm thanh)
    if (IS_PREVIEW) {
        appNodes.endScreen.classList.add('hide');
        previewInteractive(false);
        window.parent.postMessage({ type: 'firework-preview-replay' }, window.location.origin);
        return;
    }
    cancel(endScreenTimer);
    appNodes.endScreen.classList.add('hide');
    pendingLaunches = [];
    burstCounter = 0;
    syncShow.reset();
    autoLaunchTime = 800;
    musicPlayer.restart();
    clearCaptions();
    togglePause(false);
}

// ---------------------------------------------------------------------------
// DỰNG VIDEO (builder > Tạo video, người nhận > Tạo video): trang gửi kịch bản và cỡ video sang khung ẩn
// (index.html?record=1). Khung chạy màn trình diễn một lượt theo đồng hồ giả lập, từng khung hình một và nhanh hết
// mức máy cho phép (không phải chờ theo thời gian thật, không cần phát ra loa), mã hóa thành MP4 kèm tiếng pháo và
// nhạc nền trộn sẵn, kết bằng thiệp lời chúc, rồi gửi file về. Xem recorder.js, player/clock.js.
// ---------------------------------------------------------------------------

async function renderVideo({ config: source, options }) {
    if (recording.active) return;
    recording.active = true;
    const fail = message => postToBuilder({ type: 'firework-record-error', message });
    try {
        const { width, height, bitrate } = options;
        const fps = RECORD_FPS;
        const timing = { start: performance.now(), simulate: 0, paint: 0, encode: 0 };
        const writer = await createMp4Writer({ width, height, fps, bitrate });
        if (!writer) {
            fail('unsupported');
            return;
        }
        // Video chỉ chạy một lượt
        const config = await prepareBurstConfig({ ...source, loop: false }, { showOverlay: false });
        soundManager.setEffectsVolume(config.effectsVolume ?? 1);
        await soundManager.preload(getRequiredSoundTypes(config));
        const music = await loadMusicForVideo(config.music);
        if (document.fonts) await document.fonts.ready;

        // Từ đây thời gian chỉ trôi theo từng khung hình của video. Bỏ hẹn giờ màn kết (đồng hồ thật) của kịch bản rỗng
        // lúc khung vừa mở, kẻo nó kết video giữa chừng
        cancel(endScreenTimer);
        pendingLaunches = [];
        clearCaptions();
        document.querySelectorAll('.config-overlay').forEach(el => el.remove());
        useSimulatedClock();
        soundManager.capture = [];
        musicPlayer.captureOnly(config.music);
        burstConfig = config;
        burstCounter = 0;
        syncShow.reset();
        autoLaunchTime = RECORD_LEAD;
        showTitleOverlay(config);
        const composer = recording.composer = createFrameComposer({ width, height, ...frameSources(), now });
        await composer.load();

        timing.frames = performance.now();
        const step = 1000 / fps;
        const estimate = Math.max(1, Number(options.length) || 60) * 1000;
        let frames = 0;
        let lastReport = 0;
        while (recording.endsAt === null || now() < recording.endsAt) {
            if (frames * step > RECORD_MAX_MS) break;
            let t = performance.now();
            advanceClock(step);
            recording.stepping = true;
            try {
                update(step, step / 16.6667);
            } finally {
                recording.stepping = false;
            }
            stepAnimations(step);
            timing.simulate += performance.now() - t;
            t = performance.now();
            composer.paint();
            timing.paint += performance.now() - t;
            t = performance.now();
            await writer.addFrame(composer.canvas);
            timing.encode += performance.now() - t;
            frames++;
            // Báo tiến độ khoảng 4 lần mỗi giây thật
            if (performance.now() - lastReport > 250) {
                lastReport = performance.now();
                postToBuilder({ type: 'firework-record-progress', phase: 'frames', progress: Math.min(0.95, (frames * step) / estimate) * 0.9 });
            }
        }

        timing.audio = performance.now();
        postToBuilder({ type: 'firework-record-progress', phase: 'audio', progress: 0.92 });
        const duration = frames / fps;
        const audio = await mixAudio({
            duration,
            sounds: soundManager.capture,
            effectsVolume: soundManager.effectsGain.gain.value,
            music: music && { ...music, start: musicPlayer.capture.start, end: musicPlayer.capture.end }
        });
        await writer.addAudio(audio);
        const blob = await writer.finish();
        postToBuilder({
            type: 'firework-record-done',
            blob,
            elapsed: duration,
            // Nhạc từ link trang khác không đọc được nên không có trong video
            musicCaptured: !config.music || !!music,
            hasAudio: writer.hasAudio,
            // Thời gian thật (ms) của từng bước: chuẩn bị, dựng hình, ghép tiếng
            timing: {
                prepare: Math.round(timing.frames - timing.start),
                frames: Math.round(timing.audio - timing.frames),
                simulate: Math.round(timing.simulate),
                paint: Math.round(timing.paint),
                encode: Math.round(timing.encode),
                audio: Math.round(performance.now() - timing.audio)
            }
        });
    } catch (e) {
        console.error('[Firework] Không dựng được video:', e);
        fail(e && e.message ? e.message : String(e));
    } finally {
        soundManager.capture = null;
    }
}

appNodes.endScreen.querySelector('.end-screen__replay').addEventListener('click', replayShow);

const viewerShare = setupViewerShare({
    composeFrame: composeSnapshot,
    describe() {
        const config = burstConfig || {};
        const title = replacePlaceholders(config.seoTitle) || config.title || 'Trình diễn Pháo hoa';
        const description = replacePlaceholders(config.seoDescription) || [config.subtitle, config.author].filter(Boolean).join(' – ');
        return { title, description };
    },
    pauseShow(paused) {
        const was = store.state.paused;
        togglePause(paused);
        return was;
    },
    configName: CONFIG_NAME,
    preview: IS_PREVIEW,
    off: IS_RECORD || IS_HEADER,
    reduceFlashing: reduceFlashingSelector
});

// Kịch bản tạo bởi builder phiên bản cũ dùng tọa độ 0-1 thay vì 0-100 (mọi phát bắn dồn vào góc dưới trái).
// Phát bắn nào có cả x và y trong khoảng 0-1 được đổi sang thang 0-100.
// Chỉ khi mọi phát có tọa độ đều nằm trong 0-1: kịch bản mới có thể có phát sát góc (x=1, y=0) mà không phải thang cũ.
function migrateLegacyCoordinates(events) {
    const positioned = events.filter(e => typeof e.x === 'number' && typeof e.y === 'number');
    if (!positioned.length || !positioned.every(e => e.x <= 1 && e.y <= 1)) return;
    positioned.forEach(e => {
        e.x *= 100;
        e.y *= 100;
    });
}

// Chuẩn bị kịch bản để trình diễn: nền, chữ giữ chỗ, tải trước ảnh, tiêu đề.
// Dùng chung cho trình phát thường và bản xem nhanh trong builder.
async function prepareBurstConfig(burstConfig, { showOverlay }) {
    migrateLegacyCoordinates(burstConfig.events);

    // Background support
    if (burstConfig.background) {
        appNodes.backgroundImage.style.backgroundImage = `url(${JSON.stringify(normalizeAssetPath(burstConfig.background))})`;
    } else {
        appNodes.backgroundImage.style.backgroundImage = ''; // Use default from CSS
    }
    
    if (burstConfig.showBackground !== undefined) {
        store.setState({ config: { ...store.state.config, showBackground: !!burstConfig.showBackground } });
    }
    applyScenery(burstConfig);
    applyViewerDefaults(burstConfig.viewer);

    // Xử lý các placeholder trong text
    if (burstConfig.title) burstConfig.title = replacePlaceholders(burstConfig.title);
    if (burstConfig.subtitle) burstConfig.subtitle = replacePlaceholders(burstConfig.subtitle);
    if (burstConfig.events) {
        const imagePromises = [];
        burstConfig.events.forEach(event => {
            if (event.text) event.text = replacePlaceholders(event.text);
            
            if (event.shell === 'Hình ảnh' && event.imageUrl) {
                const normalizedUrl = normalizeAssetPath(event.imageUrl);
                const cacheKey = imageCacheKey(normalizedUrl, event.frame, event.crop);
                if (!imageParticleCache.has(cacheKey)) {
                    const p = new Promise(resolve => {
                        const img = new Image();
                        img.onload = () => {
                            const processed = getProcessedImage(img, event.frame, event.crop);
                            imageParticleCache.set(cacheKey, processed);
                            resolve();
                        };
                        img.onerror = () => {
                            console.error('Failed to load firework image:', normalizedUrl);
                            resolve();
                        };
                        img.src = normalizedUrl;
                    });
                    imagePromises.push(p);
                }
            }
        });
        const flagFont = preloadFlagFont(burstConfig.events.map(e => e.text));
        if (flagFont) imagePromises.push(flagFont);
        if (imagePromises.length > 0) {
            setLoadingStatus('Đang chuẩn bị hình ảnh...');
            await Promise.all(imagePromises);
        }
        // Dựng sẵn hạt cho các phát pháo chữ (lúc người xem còn ở màn mở quà) để lúc nổ không bị khựng
        const textEvents = burstConfig.events.filter(event => event.text && event.shell !== 'Lời nhắn' && event.shell !== 'Tạm dừng');
        reserveTextCache(new Set(textEvents.map(event => event.text)).size);
        textEvents.forEach(event => buildEventShot(event));
    }

    if (!showOverlay) return burstConfig;

    // Cập nhật tiêu đề trang (SEO) nếu có
    if (burstConfig.seoTitle) {
        document.title = burstConfig.seoTitle;
    } else if (burstConfig.title) {
        document.title = `${burstConfig.title} | Trình diễn Pháo hoa`;
    }
    // Mô tả trang theo kịch bản (mô tả tự nhập khi chia sẻ, không có thì ghép dòng phụ và người thực hiện)
    const description = replacePlaceholders(burstConfig.seoDescription) || [burstConfig.subtitle, burstConfig.author].filter(Boolean).join(' – ');
    if (description) document.querySelector('meta[name="description"]')?.setAttribute('content', description);

    showTitleOverlay(burstConfig);
    return burstConfig;
}

// Tiêu đề, dòng phụ, người thực hiện hiện giữa màn hình lúc bắt đầu rồi mờ dần
function showTitleOverlay(config) {
    if (!config.title && !config.author) return;
    const overlay = document.createElement('div');
    overlay.className = 'config-overlay';
    [['h1', config.title], ['h2', config.subtitle], ['p', config.author]].forEach(([tag, text]) => {
        if (!text) return;
        const el = document.createElement(tag);
        // Dùng textContent: kịch bản do người khác soạn không thể chèn mã HTML/JS vào trang
        el.textContent = text;
        overlay.appendChild(el);
    });
    document.body.appendChild(overlay);
    after(5000, () => overlay.classList.add('fade-out'));
    after(7000, () => overlay.remove());
}

async function init() {
    // Tải kịch bản từ URL trước khi chạy mô phỏng: tránh bắn pháo ngẫu nhiên khi mạng chậm
    // và giữ được dòng trạng thái "Đang chuẩn bị hình ảnh..." trên màn hình tải.
    await loadBurstConfig();

    // Xóa trạng thái tải
    appNodes.loadingInit.remove();
    appNodes.stageContainer.classList.remove('remove');

    // Điền vào danh sách thả xuống
    function setOptionsForSelect(node, options) {
        node.innerHTML = options.reduce((acc, opt) => acc += `<option value="${opt.value}">${opt.label}</option>`, '');
    }

    setOptionsForSelect(appNodes.quality, [{ label: 'Tự động', value: QUALITY_AUTO }, ...QUALITY_LEVELS]);
    renderQualityLabel();

    setOptionsForSelect(appNodes.skyLighting, [
        { label: 'Tắt', value: SKY_LIGHT_NONE },
        { label: 'Mờ', value: SKY_LIGHT_DIM },
        { label: 'Bình thường', value: SKY_LIGHT_NORMAL }
    ]);

    // Tỉ lệ mặc định trên điện thoại tính theo chiều rộng màn hình (vd 0.83) nên phải có trong danh sách,
    // nếu không ô chọn bị trống và lần đổi cài đặt kế tiếp sẽ đọc ra NaN làm hỏng hình vẽ.
    const scaleValues = [0.5, 0.62, 0.75, 0.9, 1.0, 1.5, 2.0];
    const currentScale = Number((store.state.config.scaleFactor || 1).toFixed(2));
    if (!scaleValues.includes(currentScale)) {
        scaleValues.push(currentScale);
        scaleValues.sort((a, b) => a - b);
    }
    setOptionsForSelect(
        appNodes.scaleFactor,
        scaleValues.map(value => ({ value: value.toFixed(2), label: `${Math.round(value * 100)}%` }))
    );

    // Bắt đầu mô phỏng
    togglePause(false);

    // kết xuất ban đầu
    renderApp(store.state);

    // Áp dụng cấu hình ban đầu
    configDidUpdate();
}

seqSmallBarrage.cooldown = 15000;

seqSmallBarrage.lastCalled = Date.now();

let isFirstSeq = true;

const finaleCount = 32;

let currentFinaleCount = 0;

// Các phát bắn đang chờ hết thời gian trễ (delay, ms theo thời gian màn trình diễn: tạm dừng thì cũng dừng chờ).
// Bỏ hết khi chạy lại từ đầu.
let pendingLaunches = [];

// Bản xem nhanh vừa được yêu cầu chạy lại từ đầu, chưa bắn đợt 1
let previewRestartPending = false;

export const syncShow = {
    // 'idle': chưa xếp lịch | 'running': đang chạy | 'done': đã chạy xong (không lặp)
    state: 'idle',
    queue: [],
    next: 0,
    end: 0,
    clock: 0,
    musicStarted: false,
    // Đang bám theo nhạc / vừa tua nhạc cho khớp pháo đang bay
    following: false,
    seeked: false,
    held: 0,
    // Bản xem nhanh: vị trí nhạc builder gửi sang { position, at }
    remote: null,

    reset() {
        this.state = 'idle';
        this.queue = [];
        this.next = 0;
    },

    // Xếp lịch cả kịch bản. keepClock: builder vừa sửa kịch bản giữa chừng, chạy tiếp từ vị trí hiện tại.
    schedule(config, keepClock) {
        const { items, end } = buildSyncTimeline(config.events);
        this.queue = items.map(({ time, event }) => {
            if (event.shell === 'Lời nhắn') return { launch: time, event };
            const shot = buildEventShot(event);
            return { launch: time - estimateFlightTime(shot), event, shot };
        }).sort((a, b) => a.launch - b.launch);
        this.end = end;
        if (keepClock) {
            this.next = this.queue.findIndex(item => item.launch > this.clock);
            if (this.next === -1) this.next = this.queue.length;
            return;
        }
        this.next = 0;
        // Phát nổ ngay đầu bài phải được phóng trước khi nhạc bắt đầu
        this.clock = Math.min(0, this.queue.length > 0 ? this.queue[0].launch : 0);
        this.musicStarted = false;
        this.following = false;
        this.seeked = false;
        this.state = 'running';
        musicPlayer.cue();
    },

    startMusic() {
        this.musicStarted = true;
        musicPlayer.start();
        // Bản xem nhanh: builder phát nhạc đúng lúc này
        if (IS_PREVIEW) {
            previewRestartPending = false;
            window.parent.postMessage({ type: 'firework-preview-started' }, window.location.origin);
        }
    },

    // Vị trí bài nhạc (ms tính từ giây bắt đầu): số khi đang phát, null khi nhạc chưa kịp chạy,
    // undefined khi không có nhạc để bám
    musicPosition() {
        if (!IS_PREVIEW) return musicPlayer.position();
        const remote = this.remote;
        const age = remote ? performance.now() - remote.at : Infinity;
        return age < 1000 ? remote.position + age : undefined;
    },

    // Nhạc đã được bảo phát nhưng chưa kêu: giữ cả bầu trời đứng yên một chút (tối đa 1 giây)
    // để pháo đang bay không nổ trước nhạc
    holds(frameTime) {
        if (this.state !== 'running' || !this.musicStarted || IS_PREVIEW || !musicPlayer.isStarting()) {
            this.held = 0;
            return false;
        }
        this.held += frameTime;
        return this.held < 1000;
    },

    // Gọi mỗi khung hình với bước thời gian của mô phỏng, để đồng hồ đi cùng pháo đang bay
    update(timeStep) {
        if (this.state !== 'running') return;
        this.clock += timeStep;
        if (!this.musicStarted) {
            if (this.clock >= 0) this.startMusic();
        } else {
            const position = this.musicPosition();
            if (typeof position !== 'number') {
                // Nhạc chưa chạy, đang tạm dừng hoặc không có nhạc: chạy theo đồng hồ của mô phỏng
                this.following = false;
            } else {
                const drift = position - this.clock;
                if (!this.following && !this.seeked && !IS_PREVIEW && drift < -25 && drift > -1500) {
                    // Nhạc vừa chạy (hoặc chạy lại sau tạm dừng) chậm hơn pháo đang bay: tua nhạc lên cho khớp.
                    // Lúc này nhạc còn đang to dần lên từ 0 nên không nghe thấy chỗ nhảy.
                    musicPlayer.seekBy(-drift);
                    this.seeked = true;
                } else {
                    // Bám theo nhạc; lệch quá xa (vừa tua, nhạc quay lại đầu bài) thì bỏ qua
                    if (Math.abs(drift) > 25 && Math.abs(drift) < 3000) this.clock = position;
                    this.following = true;
                    this.seeked = false;
                }
            }
        }
        // Phóng ở khung hình gần giờ phóng nhất (sớm tối đa nửa khung hình)
        while (this.next < this.queue.length && this.queue[this.next].launch <= this.clock + 8) {
            const item = this.queue[this.next++];
            if (item.shot) launchEventShot(item.shot);
            else showCaption(item.event);
        }
        if (this.next >= this.queue.length && this.clock >= this.end) this.finish();
    },

    finish() {
        if (burstConfig.loop) {
            // Lặp lại: nhạc cũng phát lại từ đầu để vẫn khớp nhịp
            this.state = 'idle';
            musicPlayer.restart();
            autoLaunchTime = 2000;
            return;
        }
        this.state = 'done';
        musicPlayer.finish(3000);
        cancel(endScreenTimer);
        endScreenTimer = after(4500, showEndScreen);
        if (IS_PREVIEW) {
            window.parent.postMessage({ type: 'firework-preview-ended' }, window.location.origin);
        }
    }
};

function startSequence() {
    // Kiểm tra burst config nếu có
    if (burstConfig && burstConfig.events) {
        // Bản xem nhanh chưa có phát nào (builder để trống khi đứng yên): chờ, không chạy nhạc, không hiện màn kết
        if (IS_PREVIEW && !burstConfig.events.length) return 1000;
        // Kịch bản khớp nhịp nhạc: syncShow.update() bắn theo từng khung hình
        if (isMusicSynced(burstConfig)) {
            if (syncShow.state === 'idle') syncShow.schedule(burstConfig);
            return 400;
        }
        if (syncShow.state !== 'idle') syncShow.reset();
        burstCounter++;

        // Tìm burst lớn nhất để biết khi nào kết thúc/lặp lại
        const burstValues = burstConfig.events.map(e => Number(e.burst)).filter(v => !isNaN(v));
        const maxBurst = burstValues.length > 0 ? Math.max(...burstValues) : 0;



        // Nếu vượt quá đợt cuối
        if (burstCounter > maxBurst) {
            if (burstConfig.loop) {
                burstCounter = 0; // Reset về 0
                return 2000; // Nghỉ 2 giây trước khi lặp lại
            } else {
                if (burstCounter === maxBurst + 1) {
                    // Chờ những phát cuối tàn hẳn rồi cho nhạc nhỏ dần và hiện màn kết
                    musicPlayer.finish(3000);
                    cancel(endScreenTimer);
                    endScreenTimer = after(4500, showEndScreen);
                    // Báo cho builder biết bản xem nhanh đã chạy xong một lượt
                    if (IS_PREVIEW) {
                        window.parent.postMessage({ type: 'firework-preview-ended' }, window.location.origin);
                    }
                }
                return 5000;
            }
        }

        if (burstCounter === 1) {
            // Nhạc nền bắt đầu cùng đợt pháo đầu tiên (lần lặp sau nhạc vẫn chạy tiếp)
            musicPlayer.start();
            // Bản xem nhanh vừa chạy lại từ đầu: builder phát nhạc khớp nhịp với lúc này
            if (IS_PREVIEW && previewRestartPending) {
                previewRestartPending = false;
                window.parent.postMessage({ type: 'firework-preview-started' }, window.location.origin);
            }
        }

        const events = burstConfig.events.filter(e => Number(e.burst) === burstCounter);


        if (events.length > 0) {
            let extraDelay = 0;
            events.forEach(event => {
                if (event.shell === 'Tạm dừng') {
                    extraDelay = Math.max(extraDelay, event.duration || 2000);
                    return;
                }

                // Lời nhắn: hiện chữ như phụ đề, không bắn pháo
                const launch = event.shell === 'Lời nhắn' ? () => showCaption(event) : () => launchEventShot(buildEventShot(event));

                if (event.delay) {
                    pendingLaunches.push({ left: Number(event.delay) || 0, launch });
                } else {
                    launch();
                }
            });

            return 2500 + extraDelay;
        } else {
            // Nếu đợt này trống, chờ 1 giây rồi sang đợt kế tiếp
            return 1000;
        }
    }
    
    // Nếu đã có kịch bản (burstConfig) thì tuyệt đối KHÔNG chạy pháo hoa ngẫu nhiên bên dưới
    if (burstConfig) {
        return 1000; // Chờ 1 giây rồi thử lại đợt tiếp theo (logic an toàn)
    }

    // Chỉ bắn pháo hoa mặc định ở lần đầu tiên nếu KHÔNG có kịch bản đang chạy
    if (isFirstSeq && !burstConfig) {
        isFirstSeq = false;
        if (IS_HEADER) {
            return seqTwoRandom();
        }
        else {
            const shell = new Shell(crysanthemumShell(shellSizeSelector()));
            shell.launch(0.5, 0.5);
            return 2400;
        }
    }

    if (finaleSelector()) {
        seqRandomFastShell();
        if (currentFinaleCount < finaleCount) {
            currentFinaleCount++;
            return 170;
        }
        else {
            currentFinaleCount = 0;
            return 6000;
        }
    }

    const rand = Math.random();

    if (rand < 0.08 && Date.now() - seqSmallBarrage.lastCalled > seqSmallBarrage.cooldown) {
        return seqSmallBarrage();
    }

    if (rand < 0.1) {
        return seqPyramid();
    }

    if (rand < 0.6 && !IS_HEADER) {
        return seqRandomShell();
    }
    else if (rand < 0.8) {
        return seqTwoRandom();
    }
    else if (rand < 1) {
        return seqTriple();
    }
}

mainStage.addEventListener('pointerstart', handlePointerStart);

mainStage.addEventListener('pointerend', handlePointerEnd);

mainStage.addEventListener('pointermove', handlePointerMove);

window.addEventListener('keydown', handleKeydown);

// Tính đến việc thay đổi kích thước cửa sổ và thay đổi tỷ lệ tùy chỉnh.
export function handleResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    // Cố gắng áp dụng kích thước màn hình, chú ý đến kích thước tối đa được chỉ định
    const containerW = Math.min(w, MAX_WIDTH);
    // Trên màn hình nhỏ, hãy sử dụng toàn bộ chiều cao của thiết bị
    const containerH = w <= 420 ? h : Math.min(h, MAX_HEIGHT);
    appNodes.stageContainer.style.width = containerW + 'px';
    appNodes.stageContainer.style.height = containerH + 'px';
    stages.forEach(stage => stage.resize(containerW, containerH));
    smokeCanvas.width = Math.round(containerW * SMOKE_RESOLUTION);
    smokeCanvas.height = Math.round(containerH * SMOKE_RESOLUTION);
    smokeCanvas.style.width = containerW + 'px';
    smokeCanvas.style.height = containerH + 'px';
    frameW = containerW;
    frameH = containerH;
    // Nét theo mật độ điểm ảnh của màn hình (cả màn nét gấp 3 của điện thoại) để trăng, sao, cây, mặt nước không nhòe; chất
    // lượng dưới độ phân giải màn hình thì vẽ thưa theo khung pháo (không thưa hơn điểm ảnh CSS); đang vẽ dư (mức cao hơn
    // màn hình) thì vẽ dư theo khung pháo
    const deviceScale = window.devicePixelRatio || 1;
    const decoScale = mainStage.dpr > deviceScale ? mainStage.dpr : Math.min(deviceScale, Math.max(1, mainStage.dpr));
    decoCanvas.width = Math.round(containerW * decoScale);
    decoCanvas.height = Math.round(containerH * decoScale);
    decoCanvas.style.width = containerW + 'px';
    decoCanvas.style.height = containerH + 'px';
    // Mặt nước nét như trăng, sao (khúc gỗ, cò, hoa đăng, vệt sóng); chất lượng 480p trở xuống vẽ thưa cho nhẹ máy
    const waterScale = isLowQuality ? WATER_RESOLUTION : decoScale;
    waterLowQuality = isLowQuality;
    waterCanvas.width = Math.round(containerW * waterScale);
    waterCanvas.height = Math.round(containerH * waterScale);
    waterCanvas.style.width = containerW + 'px';
    waterCanvas.style.height = containerH + 'px';
    // Tính đến quy mô
    const scaleFactor = scaleFactorSelector();
    setStageSize(containerW / scaleFactor, containerH / scaleFactor);
}

// Tính kích thước ban đầu
handleResize();

window.addEventListener('resize', handleResize);

// Toàn cầu động
export let currentFrame = 0;

export let speedBarOpacity = 0;

let autoLaunchTime = 0;

export function updateSpeedFromEvent(event) {
    if (isUpdatingSpeed || event.y >= mainStage.height - 44) {
        // Trên điện thoại, thật khó để chạm vào các pixel ở cạnh để đặt tốc độ ở mức 0 hoặc 1, do đó, một số phần đệm được cung cấp để giúp việc đó trở nên dễ dàng hơn.
        const edge = 16;
        const newSpeed = (event.x - edge) / (mainStage.width - edge * 2);
        setSimSpeed(Math.min(Math.max(newSpeed, 0), 1));
        // hiển thị thanh tốc độ sau khi cập nhật
        speedBarOpacity = 1;
        // Nếu chúng tôi cập nhật tốc độ, hãy trả về true
        return true;
    }
    // Trả về sai nếu tốc độ không được cập nhật
    return false;
}

// Hàm được trích xuất để giữ cho `update()` được tối ưu hóa
export function updateGlobals(timeStep, lag) {
    currentFrame++;

    // Luôn cố gắng làm mờ thanh tốc độ
    if (!isUpdatingSpeed) {
        speedBarOpacity -= lag / 30; // nửa giây
        if (speedBarOpacity < 0) {
            speedBarOpacity = 0;
        }
    }

    // tự động phóng đạn (bản xem nhanh đang hiện màn mở quà thì chờ)
    if (store.state.config.autoLaunch && !previewWaitingOpen) {
        syncShow.update(timeStep);
        autoLaunchTime -= timeStep;
        if (autoLaunchTime <= 0) {
            autoLaunchTime = startSequence() * 1.25;
        }
    }

    if (pendingLaunches.length) {
        const due = [];
        pendingLaunches = pendingLaunches.filter(item => {
            item.left -= timeStep;
            if (item.left > 0) return true;
            due.push(item);
            return false;
        });
        due.forEach(item => item.launch());
    }
}

// Thu phóng trình duyệt, kéo cửa sổ sang màn hình có mật độ điểm ảnh khác: vẽ lại theo mật độ mới cho pháo không nhòe
window.addEventListener('resize', applyQualityLimits);

mainStage.addEventListener('ticker', update);




// Bắt đầu mọi thứ.

function setLoadingStatus(status) {
    appNodes.loadingStatus.textContent = status;
}

// Bản xem nhanh: đang hiện màn mở quà, chờ người tạo chạm mở như người nhận
export let previewWaitingOpen = false;

let previewFrameToken = 0;

let previewFrameAbort = null;

// Dựng lại màn mở quà của kịch bản (thiệp chào hoặc hộp quà) trong bản xem nhanh. Chạm mở thì màn trình diễn chạy từ
// đầu như khi người nhận mở link: tiêu đề mở đầu, pháo, màn kết.
function showPreviewStartFrame(config) {
    const token = ++previewFrameToken;
    if (previewFrameAbort) previewFrameAbort.abort();
    previewFrameAbort = new AbortController();
    const screen = appNodes.startScreen;
    screen.className = 'start-screen';
    document.querySelectorAll('.confetti-layer').forEach(el => el.remove());
    renderReduceFlashingToggle(config);
    themeScreens(config);
    const frame = START_FRAMES[config.startFrame] || START_FRAMES.card;
    const { trigger, open, firstLaunchDelay } = frame.mount(screen, config);
    screen.classList.add('is-ready');
    startAmbient.start(screenTheme, { lowQuality: isLowQuality });
    previewWaitingOpen = true;
    previewInteractive(true);
    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        if (token !== previewFrameToken) return;
        soundManager.resumeAll();
        open().then(() => {
            if (token !== previewFrameToken) return;
            screen.classList.add('hide');
            previewWaitingOpen = false;
            previewInteractive(false);
            burstCounter = 0;
            syncShow.reset();
            autoLaunchTime = firstLaunchDelay;
            previewRestartPending = true;
            clearCaptions();
            showTitleOverlay(config);
        });
    }, { once: true, signal: previewFrameAbort.signal });
}

function hidePreviewStartFrame() {
    previewFrameToken++;
    if (previewFrameAbort) previewFrameAbort.abort();
    previewWaitingOpen = false;
    appNodes.startScreen.className = 'start-screen remove';
    document.querySelectorAll('.confetti-layer').forEach(el => el.remove());
}

if (IS_PREVIEW) {
    // Bản xem nhanh trong builder: không có màn hình chờ, và chưa nhận kịch bản thì không bắn pháo ngẫu nhiên
    appNodes.startScreen.classList.add('remove');
    document.documentElement.classList.add('is-preview');
    burstConfig = { events: [] };
    // Trình duyệt chặn tiếng trong khung (vd Safari): chạm vào khung một lần là có tiếng
    document.addEventListener('pointerdown', () => {
        if (store.state.soundEnabled) soundManager.resumeAll();
    }, true);

    let previewVersion = 0;
    window.addEventListener('message', async (e) => {
        const msg = e.data;
        if (e.origin !== window.location.origin || !msg) return;
        // Vị trí nhạc builder đang phát, để kịch bản khớp nhịp bám theo
        if (msg.type === 'firework-preview-clock') {
            syncShow.remote = { position: Number(msg.position) || 0, at: performance.now() };
            return;
        }
        // Builder đang chỉnh giao diện màn mở quà, màn kết: đổi ngay trên màn đang hiện, không chạy lại kịch bản
        if (msg.type === 'firework-preview-theme') {
            if (burstConfig) burstConfig.screenTheme = msg.screenTheme;
            themeScreens({ screenTheme: msg.screenTheme });
            if (!appNodes.startScreen.classList.contains('remove')) startAmbient.start(screenTheme, { lowQuality: isLowQuality });
            if (!appNodes.endScreen.classList.contains('hide')) endAmbient.start(screenTheme, { lowQuality: isLowQuality });
            return;
        }
        if (msg.type !== 'firework-preview') return;

        const version = ++previewVersion;
        viewerShare.setConfig(msg.config);
        const config = await prepareBurstConfig(msg.config, { showOverlay: false });
        // Trong lúc đang tải ảnh, builder đã gửi một kịch bản mới hơn
        if (version !== previewVersion) return;

        burstConfig = config;
        // Âm thanh theo nút Âm thanh của builder: tiếng pháo (nhạc nền do builder phát)
        soundManager.setEffectsVolume(config.effectsVolume ?? 1);
        if (typeof msg.sound === 'boolean' && msg.sound !== store.state.soundEnabled) {
            store.setState({ soundEnabled: msg.sound });
        }
        if (msg.sound) soundManager.preload(getRequiredSoundTypes(config));
        if (msg.restart) {
            cancel(endScreenTimer);
            appNodes.endScreen.classList.add('hide');
            hidePreviewStartFrame();
            if (!msg.startFrame) previewInteractive(false);
            // Chạy lại từ đợt 1 ngay lập tức, bỏ các phát bắn còn đang chờ của kịch bản trước
            pendingLaunches = [];
            burstCounter = 0;
            syncShow.reset();
            autoLaunchTime = 0;
            previewRestartPending = true;
            clearCaptions();
            document.querySelectorAll('.config-overlay').forEach(el => el.remove());
            if (msg.startFrame) showPreviewStartFrame(config);
            // Xem trước màn kết (builder đang chỉnh giao diện)
            else if (msg.endScreen) showEndScreen(true);
            // Chạy kịch bản từ đầu: tiêu đề mở đầu như khi người nhận vừa mở quà
            else if (msg.intro) showTitleOverlay(config);
        } else if (syncShow.state === 'running' && isMusicSynced(config)) {
            // Sửa kịch bản giữa chừng: xếp lại lịch, chạy tiếp từ vị trí hiện tại
            syncShow.schedule(config, true);
        }
    });

    init().then(() => window.parent.postMessage({ type: 'firework-preview-ready' }, window.location.origin));
}

else if (IS_RECORD) {
    // Khung dựng video (ẩn trong builder hoặc trang xem): không có màn chờ, chưa nhận kịch bản thì không bắn pháo ngẫu nhiên
    document.documentElement.classList.add('is-record-mode');
    appNodes.startScreen.classList.add('remove');
    burstConfig = { events: [] };

    window.addEventListener('message', (e) => {
        const msg = e.data;
        if (e.origin !== window.location.origin || !msg) return;
        if (msg.type === 'firework-record-load') renderVideo(msg);
    });

    init().then(() => window.parent.postMessage({ type: 'firework-record-frame-ready' }, window.location.origin));
}

// Tiêu đề hồ sơ không cần âm thanh, chỉ cần khởi tạo.
else if (IS_HEADER) {
    appNodes.startScreen.classList.add('hide');
    init();
} else {
    // Đợi người xem mở khung bắt đầu của kịch bản (thiệp chào, hộp quà...), xem START_FRAMES.
    // Hẹn giờ mở quà chưa tới thì đếm ngược trước.
    configRequest.then(config => {
        if (isLockedUntilLater(config)) startCountdown(config);
        // Thiệp chào chung đã hiện (mạng chậm): vẫn báo đã mở link và hiện dòng "Người gửi sẽ biết..."
        else if (startFrameMounted) reportGiftEvent('view', config);
        else mountStartFrame(config);
    });
    // Mạng chậm: không bắt người xem chờ mãi, dùng thiệp chào chung
    setTimeout(() => {
        if (!countdownActive) mountStartFrame(null);
    }, 2500);
}
