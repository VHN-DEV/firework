/*!
 * Trình diễn Pháo hoa – trình phát
 * Phần bổ sung và chỉnh sửa © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

import fscreen from './fscreen@1.0.1.js';
import { Stage, Ticker } from './Stage@0.1.4.js';
import MyMath from './MyMath.js';
import { printCopyrightNotice } from './copyright.js';
import { createFrameComposer, createMp4Writer, mixAudio } from './recorder.js';
import { now, after, cancel, useSimulatedClock, advanceClock } from './player/clock.js';
import { setupViewerShare } from './viewer-share.js';
import { getOwnerKeys } from './gift-tracking.js';
import '../scss/style.scss';
import {
    IS_PREVIEW, IS_RECORD, IS_HIGH_END_DEVICE, QUALITY_HIGH, QUALITY_NORMAL, IS_DESKTOP, IS_HEADER,
    SKY_LIGHT_NORMAL, getDefaultScaleFactor, SKY_LIGHT_NONE, COLOR, INVISIBLE, PI_2, CONFIG_NAME,
    SKY_LIGHT_DIM, PI_HALF, IS_MOBILE, GRAVITY, MAX_WIDTH, MAX_HEIGHT
} from './player/env.js';
import {
    setQuality, quality, isLowQuality, isHighQuality, stageW, stageH, setStageSize, setSimSpeed, simSpeed,
    setReduceFlashing, setCanPlaySound, setSoundEnabled, setSettings, setIsRunning, setSmokeLevel, setHorizon
} from './player/state.js';
import { QUALITY_AUTO, QUALITY_LEVELS, qualityLevel, validQuality } from './player/quality.js';
import {
    randomColor, makePistilColor, whiteOrGold, resolveSingleColor, resolveEventColor, COLOR_TUPLES,
    COLOR_CODES_W_INVIS
} from './player/colors.js';
import {
    getHeartPoints, getStarPoints, getSmileyPoints, getCatPoints, getTextParticles, getClover3Points,
    getCloverPoints, getSaturnPoints, getSnowflakePoints, getLotusPoints, getButterflyPoints, getDiamondPoints,
    preloadFlagFont, reserveTextCache
} from './player/shapes.js';
import { normalizeAssetPath, replacePlaceholders } from './player/utils.js';
import { Spark, Star, BurstFlash } from './player/particles.js';
import { soundManager, musicPlayer, playGiftOpenSound, getRequiredSoundTypes } from './player/audio.js';
import { shellNames, shellTypes, crysanthemumShell, ringShell, setRandomShell } from './player/shells.js';
import { imageParticleCache, getProcessedImage, ImageBurst } from './player/image-burst.js';
import { imageCacheKey } from './player/image-frame.js';
import { Shell } from './player/shell.js';
import { Smoke, SMOKE_RESOLUTION } from './player/smoke.js';
import { Water, Decor, WATER_RESOLUTION } from './player/scenery.js';
import { MOON_PHASES, moonFraction } from './player/moon.js';
import { START_FRAMES, frameText } from './player/start-frames.js';
import { clearCaptions, showCaption } from './player/captions.js';

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
// Chất lượng "Tự động" (các mức: player/quality.js): máy mạnh bắt đầu ở độ phân giải gốc của màn hình, ít nhất 1080p
// cho đủ hiệu ứng; máy yếu bắt đầu ở 720p HD. autoTuner hạ/nâng khi đang xem, không xuống dưới 360p.
const AUTO_QUALITY_START = (() => {
    if (!IS_HIGH_END_DEVICE) return '720';
    const native = Math.min(window.innerWidth, window.innerHeight) * (window.devicePixelRatio || 1);
    const fits = QUALITY_LEVELS.filter(level => Number(level.value) >= Math.max(native, 1080));
    return (fits[fits.length - 1] || QUALITY_LEVELS[0]).value;
})();
const AUTO_QUALITY_FLOOR = '360';
let autoQuality = AUTO_QUALITY_START;
// Cài đặt khi xem mà kịch bản đặt sẵn được (VIEWER_KEYS) và phần được lưu lại cho người xem
const VIEWER_KEYS = ['quality', 'skyLighting', 'scaleFactor', 'hideControls', 'reduceFlashing'];
const PERSISTED_VIEWER_KEYS = ['quality', 'skyLighting', 'scaleFactor', 'reduceFlashing'];
let burstConfig = null;
let burstCounter = 0;


// Stage.disableHighDPI = true;
const trailsStage = new Stage('trails-canvas');
const mainStage = new Stage('main-canvas');
// Lớp khói tự quản lý kích thước (độ phân giải thấp), không qua Stage
const smokeCanvas = document.getElementById('smoke-canvas');
const smokeCtx = smokeCanvas.getContext('2d');
// Cảnh vật theo kịch bản: trang trí bầu trời (đèn trời, khinh khí cầu) và mặt nước phản chiếu
const decoCanvas = document.getElementById('deco-canvas');
const decoCtx = decoCanvas.getContext('2d');
const waterCanvas = document.getElementById('water-canvas');
const waterCtx = waterCanvas.getContext('2d');
// Kích thước khung (điểm ảnh CSS)
let frameW = 0;
let frameH = 0;
const stages = [
    trailsStage,
    mainStage
];



// Trình trợ giúp toàn màn hình, sử dụng Fscreen cho tiền tố.
function fullscreenEnabled() {
    return fscreen.fullscreenEnabled;
}

// Lưu ý rằng trạng thái toàn màn hình được đồng bộ hóa với cửa hàng và cửa hàng phải là nguồn
// sự thật về việc ứng dụng có ở chế độ toàn màn hình hay không.
function isFullscreen() {
    return !!fscreen.fullscreenElement;
}

// Cố gắng chuyển đổi chế độ toàn màn hình.
function toggleFullscreen() {
    if (fullscreenEnabled()) {
        if (isFullscreen()) {
            fscreen.exitFullscreen();
        } else {
            fscreen.requestFullscreen(document.documentElement);
        }
    }
}

// Đồng bộ hóa các thay đổi toàn màn hình với store. Trình xử lý sự kiện là cần thiết vì người dùng có thể
// chuyển đổi chế độ toàn màn hình trực tiếp thông qua trình duyệt và chúng tôi muốn phản ứng với điều đó.
fscreen.addEventListener('fullscreenchange', () => {
    store.setState({ fullscreen: isFullscreen() });
});




// Vùng chứa trạng thái đơn giản; nguồn gốc của sự thật.
const store = {
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

function togglePause(toggle) {
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

function toggleSound(toggle) {
    if (typeof toggle === 'boolean') {
        store.setState({ soundEnabled: toggle });
    } else {
        store.setState({ soundEnabled: !store.state.soundEnabled });
    }
}

function toggleMenu(toggle) {
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
function configDidUpdate() {
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

const isRunning = (state = store.state) => !state.paused && !state.menuOpen;
// Liệu người dùng có bật âm thanh hay không.
const soundEnabledSelector = (state = store.state) => state.soundEnabled;
// Liệu bất kỳ âm thanh nào có được phép hay không, có tính đến nhiều yếu tố.
const canPlaySoundSelector = (state = store.state) => isRunning(state) && soundEnabledSelector(state);
// Mức chất lượng đang dùng (player/quality.js): chọn "Tự động" thì theo autoQuality
const qualityLevelSelector = () => qualityLevel(store.state.config.quality === QUALITY_AUTO ? autoQuality : store.state.config.quality)
    || qualityLevel(AUTO_QUALITY_START);
// Mức hiệu ứng (1-3) các module hạt pháo dùng
const qualitySelector = () => qualityLevelSelector().tier;
// Người xem tự bật, hoặc người tạo bật sẵn cho cả màn trình diễn (kịch bản có reduceFlashing)
const reduceFlashingSelector = () => !!(store.state.config.reduceFlashing || (burstConfig && burstConfig.reduceFlashing));
// Các module hạt pháo, âm thanh đọc cài đặt của trình phát qua state.js
setReduceFlashing(reduceFlashingSelector);
setCanPlaySound(() => canPlaySoundSelector());
setSoundEnabled(() => soundEnabledSelector());
setSettings(() => store.state.config);
setIsRunning(() => isRunning());
// Khói pháo theo kịch bản ("light" nhẹ, "heavy" dày); chất lượng 480p trở xuống thì tắt để máy yếu không giật
const SMOKE_LEVELS = { light: 1, heavy: 2 };
setSmokeLevel(() => (isLowQuality || !burstConfig ? 0 : SMOKE_LEVELS[burstConfig.smoke] || 0));
// Mặt nước: đường chân trời (điểm phóng) nâng lên 1/3 hoặc nửa màn hình
const WATER_LEVELS = { third: 2 / 3, half: 0.5 };
const horizonSelector = () => (burstConfig && WATER_LEVELS[burstConfig.water]) || 1;
setHorizon(horizonSelector);
// Bầu trời đêm theo kịch bản: sao, trăng, trang trí. Kịch bản cũ ghi decor dạng chữ ("both" = đèn trời + khinh khí cầu).
const DECOR_KINDS = ['lanterns', 'balloons', 'planes'];
const DECOR_ALIASES = { lanterns: ['lanterns'], balloons: ['balloons'], both: ['lanterns', 'balloons'] };
const clampPercent = (value, fallback) => (Number.isFinite(Number(value)) ? Math.max(0, Math.min(100, Number(value))) : fallback);
let skyCache = { config: undefined, background: undefined, key: '', scene: null };
// Tính lại khi đổi kịch bản hoặc bật/tắt ảnh nền; trăng "theo ngày" lấy pha của lúc người xem mở. Bản xem nhanh nhận
// kịch bản mới sau mỗi lần sửa: phần bầu trời không đổi thì giữ nguyên cảnh (không rải lại sao, đèn trời, máy bay).
function sceneSelector() {
    const background = !!store.state.config.showBackground;
    if (skyCache.config === burstConfig && skyCache.background === background) return skyCache.scene;
    const key = burstConfig ? JSON.stringify([burstConfig.decor, burstConfig.stars, burstConfig.moon, background]) : '';
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
        if (decor.length || stars || moon) scene = { decor, stars, moon, background };
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
const shellNameSelector = () => {
    const shells = store.state.config.shell;
    if (Array.isArray(shells) && shells.length > 0) {
        return shells[Math.floor(Math.random() * shells.length)];
    }
    return typeof shells === 'string' ? shells : 'Ngẫu nhiên';
};
// Chuyển đổi kích thước vỏ thành số.
const shellSizeSelector = () => +store.state.config.size;
const finaleSelector = () => store.state.config.finale;
const skyLightingSelector = () => +store.state.config.skyLighting;
const scaleFactorSelector = () => store.state.config.scaleFactor;



// Nội dung trợ giúp
const helpContent = {
    quality: {
        header: 'Chất lượng',
        body: 'Như trang xem phim: số càng lớn hình càng nét nhưng càng nặng máy. Tự động (khuyên dùng): bắt đầu theo màn hình và '
            + 'cấu hình máy, nếu thấy giật thì tự hạ xuống, mượt trở lại thì nâng lên. Từ 1080p trở lên vẽ đầy đủ mọi hiệu ứng; '
            + '720p bớt tia lửa lúc pháo dày đặc nhất; 480p trở xuống nhẹ nhất cho máy yếu, không có khói pháo. Mức cao hơn '
            + 'độ phân giải màn hình thì vẽ bằng độ phân giải gốc của màn hình.'
    },
    skyLighting: {
        header: 'Ánh sáng bầu trời',
        body: 'Bầu trời sáng lên theo màu pháo khi pháo nổ. Nếu nền trông quá sáng trên màn hình của bạn, hãy chọn "Mờ" hoặc "Tắt".'
    },
    scaleFactor: {
        header: 'Thu phóng',
        body: 'Phóng to hoặc thu nhỏ toàn bộ pháo hoa, giống như đứng gần hay xa hơn. Trên điện thoại, thu nhỏ một chút giúp những quả pháo lớn không tràn khỏi màn hình.'
    },
    fullscreen: {
        header: 'Toàn màn hình',
        body: 'Bật/tắt chế độ toàn màn hình.'
    },
    reduceFlashing: {
        header: 'Giảm chớp sáng',
        body: 'Dành cho người nhạy cảm với ánh sáng nhấp nháy: hạt pháo không chớp tắt hay lấp lánh, không có quầng chớp lúc nổ, bầu trời không đổi màu theo pháo. Pháo hoa vẫn nổ đầy đủ.'
    },
    hideControls: {
        header: 'Ẩn nút điều khiển',
        body: 'Ẩn các nút tạm dừng, âm thanh và cài đặt ở phía trên màn hình để xem trọn vẹn. Trên máy tính, đưa chuột lên mép trên là các nút hiện lại; trên điện thoại, chạm vào góc trên bên phải để mở lại bảng này.'
    }
};


// Kết xuất giao diện người dùng ứng dụng/đồng bộ hóa với trạng thái
const appNodes = {
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
        const { header, body } = helpContent[state.openHelpTopic];
        appNodes.helpModalHeader.textContent = header;
        appNodes.helpModalBody.textContent = body;
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
// Chạm góc phải trên để mở menu: trình duyệt di động còn phát thêm một cú click giả lập ngay tại chỗ đó,
// trúng nút Đóng vừa hiện ra làm menu đóng lại ngay. Bỏ qua click đóng trong khoảng ngắn sau khi mở.
let menuOpenedByCornerAt = 0;
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

function randomShellName() {
    return Math.random() < 0.5 ? 'Hoa cúc' : shellNames[(Math.random() * (shellNames.length - 1) + 1) | 0];
}

function randomShell(size) {
    // Lựa chọn đặc biệt cho tiêu đề.
    if (IS_HEADER) return randomFastShell()(size);
    // Hoạt động bình thường
    return shellTypes[randomShellName()](size);
}

// "Ngẫu nhiên" trong danh sách loại pháo
setRandomShell(randomShell);

function shellFromConfig(size) {
    return shellTypes[shellNameSelector()](size);
}

// Nhận một shell ngẫu nhiên, không bao gồm việc xử lý các biến thể chuyên sâu
// Lưu ý rằng điều này chỉ ngẫu nhiên khi shell "Ngẫu nhiên" được chọn trong config.
// Ngoài ra, điều này không tạo ra shell, chỉ trả về hàm xuất xưởng.
const fastShellBlacklist = ['Lá rơi', 'Hoa', 'Liễu', 'Cháy lâu'];
function randomFastShell() {
    const isRandom = shellNameSelector() === 'Ngẫu nhiên';
    let shellName = isRandom ? randomShellName() : shellNameSelector();
    if (isRandom) {
        while (fastShellBlacklist.includes(shellName)) {
            shellName = randomShellName();
        }
    }
    return shellTypes[shellName];
}

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
const configRequest = !IS_PREVIEW && CONFIG_NAME
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

// Dựng khung bắt đầu theo kịch bản (chỉ một lần, trừ remount) và chờ người xem bấm để vào màn trình diễn
function mountStartFrame(config, { remount = false } = {}) {
    if (startFrameMounted && !remount) return;
    startFrameMounted = true;
    // Dựng lại (hết giờ hẹn sau khi thiệp chung đã hiện): bỏ lời mời bấm của lần dựng trước
    if (startFrameAbort) startFrameAbort.abort();
    startFrameAbort = new AbortController();
    reportGiftEvent('view', config);
    renderReduceFlashingToggle(config);
    const frame = START_FRAMES[config && config.startFrame] || START_FRAMES.card;
    const { trigger, open, firstLaunchDelay } = frame.mount(appNodes.startScreen, config);
    if (config) {
        const title = frameText(config.seoTitle) || frameText(config.title);
        if (title) document.title = title;
    }
    appNodes.startScreen.classList.add('is-ready');
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

function beginShow(open, firstLaunchDelay) {
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

function reportGiftEvent(type, config) {
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

let countdownActive = false;

function isLockedUntilLater(config) {
    const target = config && config.openAt ? Date.parse(config.openAt) : NaN;
    return Number.isFinite(target) && target - Date.now() > 1000;
}

function startCountdown(config) {
    countdownActive = true;
    reportGiftEvent('view', config);
    const target = Date.parse(config.openAt);
    const auto = config.openMode === 'countdown';
    const screen = appNodes.startScreen;
    const stage = screen.querySelector('.countdown-stage');
    const recipient = frameText(config.recipient);
    stage.querySelector('.countdown-stage__eyebrow').textContent = recipient ? `Gửi ${recipient}` : 'Bạn có một món quà';
    stage.querySelector('.countdown-stage__title').textContent = auto ? 'Pháo hoa sẽ bắn sau' : 'Món quà sẽ mở sau';
    stage.querySelector('.countdown-stage__date').textContent = 'vào lúc ' + new Date(target).toLocaleString('vi-VN', {
        hour: '2-digit', minute: '2-digit', weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric'
    });
    stage.querySelector('.countdown-stage__message').textContent = frameText(config.introMessage);
    const readyBtn = stage.querySelector('.countdown-stage__ready');
    const hint = stage.querySelector('.countdown-stage__hint');
    readyBtn.hidden = !auto;
    hint.textContent = auto
        ? 'Bấm "Tôi đã sẵn sàng" và giữ trang này mở, pháo hoa sẽ tự bắn khi đếm ngược kết thúc.'
        : 'Hãy quay lại đúng giờ để mở quà nhé!';
    screen.classList.add('frame-countdown', 'is-ready');
    const title = frameText(config.seoTitle) || frameText(config.title);
    if (title) document.title = title;

    let armed = false;
    readyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        armed = true;
        // Mở khóa âm thanh ngay trong lúc bấm và tải sẵn để tới giờ là bắn ngay
        soundManager.resumeAll();
        musicPlayer.unlock();
        configRequest.then(cfg => soundManager.preload(getRequiredSoundTypes(cfg)));
        readyBtn.textContent = '✓ Đã sẵn sàng';
        readyBtn.disabled = true;
        hint.textContent = 'Giữ trang này mở và bật loa nhé, pháo hoa sẽ tự bắn khi đếm ngược kết thúc.';
    }, { once: true });

    const units = {};
    stage.querySelectorAll('[data-unit]').forEach(el => { units[el.dataset.unit] = el; });
    const finalEl = stage.querySelector('.countdown-stage__final');
    const pad = n => String(n).padStart(2, '0');
    let lastFinal = null;
    let timer = null;

    const finish = () => {
        clearInterval(timer);
        countdownActive = false;
        screen.classList.remove('frame-countdown', 'is-final');
        if (auto && armed) {
            // Đúng giờ: vào thẳng màn trình diễn, phát pháo đầu tiên bắn ngay
            beginShow(() => Promise.resolve(), 300);
        } else {
            // Thiệp chào chung đã dựng lúc mạng chậm (có khi đã bấm rồi): dựng lại theo kịch bản
            mountStartFrame(config, { remount: true });
        }
    };

    const tick = () => {
        const left = target - Date.now();
        if (left <= 0) {
            finish();
            return;
        }
        const seconds = Math.ceil(left / 1000);
        units.days.textContent = Math.floor(seconds / 86400);
        units.hours.textContent = pad(Math.floor(seconds / 3600) % 24);
        units.minutes.textContent = pad(Math.floor(seconds / 60) % 60);
        units.seconds.textContent = pad(seconds % 60);
        screen.classList.toggle('has-days', seconds >= 86400);
        // 10 giây cuối: số đếm lớn, mỗi giây một nhịp
        if (seconds <= 10) {
            screen.classList.add('is-final');
            if (seconds !== lastFinal) {
                lastFinal = seconds;
                finalEl.textContent = seconds;
                finalEl.classList.remove('is-beat');
                void finalEl.offsetWidth;
                finalEl.classList.add('is-beat');
            }
        }
        // Gần tới giờ: hẹn đúng thời điểm thay vì chờ nhịp đồng hồ kế tiếp
        if (left < 300) {
            clearInterval(timer);
            setTimeout(finish, left);
        }
    };
    timer = setInterval(tick, 200);
    tick();
}

// Kịch bản không lặp chạy xong: thiệp lời chúc cuối, nút xem lại và nút tạo màn pháo hoa mới
let endScreenTimer = null;

function showEndScreen() {
    // Khung dựng video: thay màn kết bằng thiệp lời chúc trong video rồi xong
    if (IS_RECORD) {
        finishRecording();
        return;
    }
    if (IS_HEADER || !burstConfig || burstConfig.loop) return;
    reportGiftEvent('finish', burstConfig);
    const screen = appNodes.endScreen;
    screen.querySelector('.end-screen__title').textContent = burstConfig.title || 'Cảm ơn bạn đã xem!';
    screen.querySelector('.end-screen__message').textContent =
        String(replacePlaceholders(burstConfig.outroMessage || '')).trim() || burstConfig.subtitle || '';
    screen.querySelector('.end-screen__from').textContent = burstConfig.author || '';
    screen.classList.remove('hide');
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

// Chờ trước phát pháo đầu tiên, và thời gian thiệp lời chúc ở cuối video (ms)
const RECORD_LEAD = 800;
const RECORD_END_CARD = 4000;
const RECORD_FPS = 30;
// Giới hạn an toàn: kịch bản hỏng không làm video dài mãi
const RECORD_MAX_MS = 20 * 60 * 1000;

const recording = {
    // Đang dựng: vòng lặp của Ticker đứng ngoài, chỉ vòng dựng mới cho mô phỏng bước tiếp (xem update())
    active: false,
    stepping: false,
    composer: null,
    // Mốc (đồng hồ giả lập) hết thiệp lời chúc, tức là hết video
    endsAt: null
};

function postToBuilder(message) {
    window.parent.postMessage(message, window.location.origin);
}

// Nhạc nền để trộn vào video: file cùng tên miền (hoặc link cho phép CORS); link ngoài không đọc được thì bỏ qua
async function loadMusicForVideo(music) {
    if (!music || !music.url) return null;
    try {
        const response = await fetch(normalizeAssetPath(music.url));
        if (!response.ok) return null;
        const buffer = await soundManager.ctx.decodeAudioData(await response.arrayBuffer());
        const volume = Number(music.volume);
        return {
            buffer,
            offset: Math.max(0, Number(music.start) || 0),
            volume: Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 0.8,
            // Như khi xem thật: kịch bản khớp nhịp hết bài thì thôi, còn lại phát lặp
            loop: !music.sync
        };
    } catch (e) {
        return null;
    }
}

// Hiệu ứng CSS (tiêu đề hiện dần rồi mờ đi, lời nhắn hiện/ẩn, con trỏ gõ chữ) đi theo đồng hồ giả lập: dừng lại và
// tua đúng `ms` mỗi khung; hiệu ứng mới xuất hiện trong khung này bắt đầu từ 0
const steppedAnimations = new WeakSet();

function stepAnimations(ms) {
    document.getAnimations().forEach(animation => {
        if (!steppedAnimations.has(animation)) {
            steppedAnimations.add(animation);
            animation.pause();
            animation.currentTime = 0;
        } else {
            animation.currentTime = (Number(animation.currentTime) || 0) + ms;
        }
    });
}

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

// Màn trình diễn đã chạy hết (lúc màn kết hiện ra khi xem thật): kết video bằng thiệp lời chúc
function finishRecording() {
    if (!recording.composer || recording.endsAt !== null) return;
    const config = burstConfig;
    recording.composer.setEndCard({
        title: config.title,
        message: frameText(config.outroMessage) || config.subtitle,
        from: config.author
    });
    recording.endsAt = now() + RECORD_END_CARD;
}

appNodes.endScreen.querySelector('.end-screen__replay').addEventListener('click', replayShow);

// Những gì có trên khung hình: ảnh nền, các lớp pháo (dưới lên trên), tiêu đề và lời nhắn (xem recorder.js)
function frameSources() {
    return {
        container: appNodes.stageContainer,
        background: appNodes.backgroundImage,
        layers: [decoCanvas, smokeCanvas, trailsStage.canvas, mainStage.canvas, waterCanvas],
        texts: () => [...document.querySelectorAll('.config-overlay h1, .config-overlay h2, .config-overlay p, .caption-layer .caption')]
    };
}

// ---------------------------------------------------------------------------
// NGƯỜI NHẬN CHỤP KHOẢNH KHẮC, CHIA SẺ, TẠO VIDEO (xem viewer-share.js)
// ---------------------------------------------------------------------------

// Ảnh chụp đúng độ phân giải canvas pháo; giữ lại bộ ghép để ảnh nền chỉ tải một lần
let snapshotComposer = null;

async function composeSnapshot() {
    const { width, height } = mainStage.canvas;
    if (!snapshotComposer || snapshotComposer.canvas.width !== width || snapshotComposer.canvas.height !== height) {
        snapshotComposer = createFrameComposer({ width, height, ...frameSources() });
    }
    await snapshotComposer.load();
    snapshotComposer.paint();
    return snapshotComposer.canvas;
}

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


function fitShellPositionInBoundsH(position) {
    const edge = 0.18;
    return (1 - edge * 2) * position + edge;
}

function fitShellPositionInBoundsV(position) {
    return position * 0.75;
}

function getRandomShellPositionH() {
    return fitShellPositionInBoundsH(Math.random());
}

function getRandomShellPositionV() {
    return fitShellPositionInBoundsV(Math.random());
}

function getRandomShellSize() {
    const baseSize = shellSizeSelector();
    const maxVariance = Math.min(2.5, baseSize);
    const variance = Math.random() * maxVariance;
    const size = baseSize - variance;
    const height = maxVariance === 0 ? Math.random() : 1 - (variance / maxVariance);
    const centerOffset = Math.random() * (1 - height * 0.65) * 0.5;
    const x = Math.random() < 0.5 ? 0.5 - centerOffset : 0.5 + centerOffset;
    return {
        size,
        x: fitShellPositionInBoundsH(x),
        height: fitShellPositionInBoundsV(height)
    };
}


// Khởi chạy shell từ sự kiện con trỏ người dùng, dựa trên state.config
function launchShellFromConfig(event) {
    const shellName = shellNameSelector();
    const size = shellSizeSelector();
    
    const shellProps = shellTypes[shellName](size);
    // Nếu là hình ảnh nổ thủ công, ta thử lấy ảnh từ kịch bản hiện tại nếu có
    if (shellName === 'Hình ảnh' && !shellProps.imageUrl) {
        const firstImgEvent = (burstConfig && burstConfig.events || []).find(e => e.shell === 'Hình ảnh' && e.imageUrl);
        if (firstImgEvent) {
            shellProps.imageUrl = firstImgEvent.imageUrl;
            shellProps.frame = firstImgEvent.frame;
            shellProps.crop = firstImgEvent.crop;
            shellProps.duration = firstImgEvent.duration;
            if (firstImgEvent.color) shellProps.color = resolveSingleColor(Array.isArray(firstImgEvent.color) ? firstImgEvent.color[0] : firstImgEvent.color);
        }
    }
    
    const shell = new Shell(shellProps);
    
    if (event) {
        const scaleFactor = scaleFactorSelector();
        // Bắn chính xác vào vị trí click (đã điều chỉnh theo tỉ lệ zoom)
        // Chạm xuống mặt nước thì nổ ngay trên mép nước
        shell.launchAt(event.x / scaleFactor, Math.min(event.y / scaleFactor, stageH * horizonSelector() - 40));
    } else {
        shell.launch(getRandomShellPositionH(), getRandomShellPositionV());
    }
}


// trình tự
// -----------

function seqRandomShell() {
    const size = getRandomShellSize();
    const shell = new Shell(shellFromConfig(size.size));
    shell.launch(size.x, size.height);

    let extraDelay = shell.starLife;
    if (shell.fallingLeaves) {
        extraDelay = 4600;
    }

    return 900 + Math.random() * 600 + extraDelay;
}

function seqRandomFastShell() {
    const shellType = randomFastShell();
    const size = getRandomShellSize();
    const shell = new Shell(shellType(size.size));
    shell.launch(size.x, size.height);

    let extraDelay = shell.starLife;

    return 900 + Math.random() * 600 + extraDelay;
}

function seqTwoRandom() {
    const size1 = getRandomShellSize();
    const size2 = getRandomShellSize();
    const shell1 = new Shell(shellFromConfig(size1.size));
    const shell2 = new Shell(shellFromConfig(size2.size));
    const leftOffset = Math.random() * 0.2 - 0.1;
    const rightOffset = Math.random() * 0.2 - 0.1;
    shell1.launch(0.3 + leftOffset, size1.height);
    setTimeout(() => {
        shell2.launch(0.7 + rightOffset, size2.height);
    }, 100);

    let extraDelay = Math.max(shell1.starLife, shell2.starLife);
    if (shell1.fallingLeaves || shell2.fallingLeaves) {
        extraDelay = 4600;
    }

    return 900 + Math.random() * 600 + extraDelay;
}

function seqTriple() {
    const shellType = randomFastShell();
    const baseSize = shellSizeSelector();
    const smallSize = Math.max(0, baseSize - 1.25);

    const offset = Math.random() * 0.08 - 0.04;
    const shell1 = new Shell(shellType(baseSize));
    shell1.launch(0.5 + offset, 0.7);

    const leftDelay = 1000 + Math.random() * 400;
    const rightDelay = 1000 + Math.random() * 400;

    setTimeout(() => {
        const offset = Math.random() * 0.08 - 0.04;
        const shell2 = new Shell(shellType(smallSize));
        shell2.launch(0.2 + offset, 0.1);
    }, leftDelay);

    setTimeout(() => {
        const offset = Math.random() * 0.08 - 0.04;
        const shell3 = new Shell(shellType(smallSize));
        shell3.launch(0.8 + offset, 0.1);
    }, rightDelay);

    return 4000;
}

function seqPyramid() {
    const barrageCountHalf = IS_DESKTOP ? 7 : 4;
    const largeSize = shellSizeSelector();
    const smallSize = Math.max(0, largeSize - 3);
    const randomMainShell = Math.random() < 0.78 ? crysanthemumShell : ringShell;
    const randomSpecialShell = randomShell;

    function launchShell(x, useSpecial) {
        const chosenShell = shellNameSelector();
        const isRandom = chosenShell === 'Ngẫu nhiên';
        let shellType = isRandom
            ? useSpecial ? randomSpecialShell : randomMainShell
            : shellTypes[chosenShell];
        const shell = new Shell(shellType(useSpecial ? largeSize : smallSize));
        const height = x <= 0.5 ? x / 0.5 : (1 - x) / 0.5;
        shell.launch(x, useSpecial ? 0.75 : height * 0.42);
    }

    let count = 0;
    let delay = 0;
    while (count <= barrageCountHalf) {
        if (count === barrageCountHalf) {
            setTimeout(() => {
                launchShell(0.5, true);
            }, delay);
        } else {
            const offset = count / barrageCountHalf * 0.5;
            const delayOffset = Math.random() * 30 + 30;
            setTimeout(() => {
                launchShell(offset, false);
            }, delay);
            setTimeout(() => {
                launchShell(1 - offset, false);
            }, delay + delayOffset);
        }

        count++;
        delay += 200;
    }

    return 3400 + barrageCountHalf * 250;
}

function seqSmallBarrage() {
    seqSmallBarrage.lastCalled = Date.now();
    const barrageCount = IS_DESKTOP ? 11 : 5;
    const specialIndex = IS_DESKTOP ? 3 : 1;
    const shellSize = Math.max(0, shellSizeSelector() - 2);
    const randomMainShell = Math.random() < 0.78 ? crysanthemumShell : ringShell;
    const randomSpecialShell = randomFastShell();

    // (cos(x*5π+0.5π)+1)/2 là sóng tùy chỉnh được giới hạn bởi 0 và 1 được sử dụng để đặt các độ cao phóng khác nhau
    function launchShell(x, useSpecial) {
        const chosenShell = shellNameSelector();
        const isRandom = chosenShell === 'Ngẫu nhiên';
        let shellType = isRandom
            ? useSpecial ? randomSpecialShell : randomMainShell
            : shellTypes[chosenShell];
        const shell = new Shell(shellType(shellSize));
        const height = (Math.cos(x * 5 * Math.PI + PI_HALF) + 1) / 2;
        shell.launch(x, height * 0.75);
    }

    let count = 0;
    let delay = 0;
    while (count < barrageCount) {
        if (count === 0) {
            launchShell(0.5, false)
            count += 1;
        }
        else {
            const offset = (count + 1) / barrageCount / 2;
            const delayOffset = Math.random() * 30 + 30;
            const useSpecial = count === specialIndex;
            setTimeout(() => {
                launchShell(0.5 + offset, useSpecial);
            }, delay);
            setTimeout(() => {
                launchShell(0.5 - offset, useSpecial);
            }, delay + delayOffset);
            count += 2;
        }
        delay += 200;
    }

    return 3400 + barrageCount * 120;
}
seqSmallBarrage.cooldown = 15000;
seqSmallBarrage.lastCalled = Date.now();


const sequences = [
    seqRandomShell,
    seqTwoRandom,
    seqTriple,
    seqPyramid,
    seqSmallBarrage
];


let isFirstSeq = true;
const finaleCount = 32;
let currentFinaleCount = 0;
// Các phát bắn đang chờ hết thời gian trễ (delay, ms theo thời gian màn trình diễn: tạm dừng thì cũng dừng chờ).
// Bỏ hết khi chạy lại từ đầu.
let pendingLaunches = [];
// Bản xem nhanh vừa được yêu cầu chạy lại từ đầu, chưa bắn đợt 1
let previewRestartPending = false;

// Tùy chọn pháo và điểm nổ (x, y: 0-1 theo bề ngang, tính từ mép trên) của một phát trong kịch bản
function buildEventShot(event) {
    const size = event.size !== undefined ? event.size : shellSizeSelector();
    let options;

    if (event.shell === 'Văn bản' && event.text) {
        options = {
            shellSize: size,
            color: randomColor(),
            spreadSize: 300 + size * 100,
            starLife: 1400 + size * 200,
            glitter: 'light',
            glitterColor: COLOR.Gold
        };
    } else if (event.shell === 'Hình ảnh' && event.imageUrl) {
        options = {
            shell: 'Hình ảnh',
            imageUrl: event.imageUrl,
            frame: event.frame,
            crop: event.crop,
            shellSize: size,
            spreadSize: 300 + size * 100,
            // Thời gian ảnh hiện trên trời (ms)
            duration: event.duration
        };
    } else {
        const shellType = shellTypes[event.shell] || shellTypes['Văn bản'];
        options = shellType(size);
    }

    if (event.text) {
        const starDensity = event.starDensity !== undefined ? event.starDensity : 1;
        // Bước lấy mẫu tối thiểu 2px để chữ dày không tạo ra hàng chục nghìn hạt làm treo máy
        const step = Math.max(2, Math.round(3 / starDensity));
        // Không chọn màu (để trống hoặc "Ngẫu nhiên"): biểu tượng cảm xúc giữ màu gốc của nó
        const noColor = [].concat(event.color ?? []).every(c => !c || c === 'Ngẫu nhiên' || c === 'random');
        options.shapePoints = getTextParticles(event.text, 50, step, noColor);
    }

    const hasValue = (value) => value !== undefined && value !== null && value !== '';

    if (hasValue(event.color)) {
        const color = resolveEventColor(event.color);
        if (options.shell === 'Hình ảnh') {
            // Khung ảnh chỉ vẽ được một màu
            options.color = color === 'random' ? randomColor() : color;
        } else if (options.color === INVISIBLE && options.secondColor) {
            // Pháo "Ma": giữ hiệu ứng hiện dần từ vô hình, màu đã chọn là màu hiện ra
            if (color !== 'random') options.secondColor = Array.isArray(color) ? color[0] : color;
        } else {
            options.color = color;
        }
    }

    if (hasValue(event.glitterColor)) {
        options.glitterColor = resolveEventColor(event.glitterColor);
    }

    let xVal = event.x !== undefined ? event.x : 50;
    let yVal = event.y !== undefined ? event.y : 50;

    if (IS_MOBILE) {
        // Ánh xạ x vào khoảng an toàn 15% - 85% để tránh pháo bị tràn mép màn hình bên trái/phải
        xVal = 15 + (xVal / 100) * 70;
        // Ánh xạ y vào khoảng an toàn 5% - 95% (rộng hơn nhiều vì màn hình dọc rất dài, tránh làm nổ quá thấp)
        yVal = 5 + (yVal / 100) * 90;
    }

    const x = xVal / 100;
    // Độ cao tính từ đường chân trời (đáy màn hình, hoặc mép nước khi có mặt nước)
    const y = (100 - yVal) / 100 * horizonSelector();

    // Ghi đè các thuộc tính nâng cao từ event nếu có.
    // Áp dụng TRƯỚC khi tạo Shell để số hạt, kích thước trên mobile và giới hạn góc bắn được tính đúng.
    const overrides = [
        'strobe', 'strobeColor', 'pistil', 'pistilColor',
        'streamers', 'crossette', 'crackle', 'horsetail',
        'comet', 'starLife', 'starDensity', 'spreadSize',
        'starCount', 'starLifeVariation', 'glitter', 'secondColor',
        'transitionTime', 'floral', 'ring', 'strobeFreq',
        'launchAngle', 'ascentSpeed', 'rotation',
        'liftSound', 'burstSound', 'whistleSound',
        'launchStyle', 'spiralLift', 'hang'
    ];

    overrides.forEach(prop => {
        const value = event[prop];
        // Bỏ qua ô để trống và ô tích chưa bật (false): giữ mặc định của loại pháo,
        // ví dụ pháo "Nổ lách tách" vẫn lách tách dù builder lưu sẵn crackle: false.
        if (!hasValue(value) || value === false) return;

        if (prop === 'strobeColor' || prop === 'pistilColor' || prop === 'secondColor') {
            options[prop] = resolveSingleColor(value);
        } else if (prop === 'starDensity') {
            // Mật độ là hệ số so với mật độ gốc của loại pháo (1 = giữ nguyên)
            options.starDensity = (options.starDensity || 1) * value;
        } else {
            options[prop] = value;
        }
    });

    // Bật "Cháy lâu" cho loại pháo khác mà không tự đặt tuổi thọ hạt: cho hạt cháy lâu gấp 2,5 lần
    if (event.hang === true && event.shell !== 'Cháy lâu' && !hasValue(event.starLife)) {
        options.starLife *= 2.5;
    }

    return { options, x, y };
}

function launchEventShot(shot) {
    const shell = new Shell(shot.options);
    // Nổ đúng tọa độ đã đặt trong kịch bản
    shell.launchAt(shot.x * stageW, shot.y * stageH);
}

// Thời gian bay (ms) từ lúc phóng tới lúc nổ: chạy thử đúng vật lý sao chổi của launchAt() ở 60 khung hình/giây.
// Pháo bay lên tới độ cao điểm nổ (hoặc lên tới đỉnh, hoặc hết thời gian cháy) thì nổ.
function estimateFlightTime(shot) {
    const { options } = shot;
    const rise = (horizonSelector() - shot.y) * stageH;
    const angle = options.launchAngle !== undefined ? (options.launchAngle - 90) * Math.PI / 180 : 0;
    const burstX = Math.sin(angle) * rise;
    const step = 1000 / 60;
    const gAcc = step / 1000 * GRAVITY;
    let x = 0;
    let y = 0;
    let speedX = 0;
    let speedY = 0;
    let life;
    let targetY;
    // Cùng công thức vận tốc với launchAt() và aimStar()
    const aim = (toX, toY, scale = 1) => {
        const velocity = Math.pow(Math.hypot(toX - x, toY - y) * 0.04, 0.64);
        const direction = Math.atan2(toY - y, toX - x);
        speedX = Math.cos(direction) * velocity * scale;
        speedY = Math.sin(direction) * velocity * scale;
        return velocity;
    };
    // "Bay nhiều tầng": tới từng tầng thì chậm dần, nổ một chùm rồi mới nhắm điểm nổ chính (xem LAUNCH_STYLES.stages)
    const stops = options.launchStyle === 'stages'
        ? (rise > 260 ? [0.42, 0.72] : [0.6]).map(f => ({ x: burstX * f, y: -rise * f }))
        : [];
    if (stops.length) {
        life = 30000;
        aim(stops[0].x, stops[0].y);
    } else {
        const velocity = aim(burstX, -rise, options.horsetail ? 1.2 : 1);
        life = velocity * (options.horsetail ? 100 : 400);
        targetY = -rise;
    }
    let next = 0;
    for (let time = 0; time < 30000; time += step) {
        life -= step;
        if (targetY !== undefined && (y <= targetY || speedY >= 0)) life = 0;
        if (life <= 0) return time;
        x += speedX;
        y += speedY;
        speedX *= Star.airDragHeavy;
        speedY = speedY * Star.airDragHeavy + gAcc;
        if (next < stops.length && (y <= stops[next].y || speedY > -0.15)) {
            next++;
            if (next < stops.length) {
                aim(stops[next].x, stops[next].y);
            } else {
                aim(burstX, -rise);
                targetY = -rise;
            }
        }
    }
    return 30000;
}

// ---------------------------------------------------------------------------
// KHỚP NHỊP NHẠC (music.sync, builder bật khi "Xếp pháo theo nhịp nhạc"): "trễ" của một phát là lúc pháo NỔ
// (tính từ đầu đợt), không phải lúc phóng. Cả kịch bản được xếp lịch trước: mỗi phát phóng sớm hơn đúng bằng
// thời gian bay của nó trên màn hình này, và đồng hồ bám theo vị trí đang phát của bài nhạc, nên tiếng nổ rơi
// đúng nhịp kể cả khi máy giật khung hình. Đồng hồ = 0 là lúc nhạc bắt đầu (từ giây music.start).
// ---------------------------------------------------------------------------

function isMusicSynced(config) {
    return !!(config && config.music && config.music.sync && Array.isArray(config.events));
}

// Thời điểm (ms) mỗi phát nổ hoặc hiện ra và lúc kết thúc; thời lượng đợt tính giống startSequence()
function buildSyncTimeline(events) {
    const burstValues = events.map(e => Number(e.burst)).filter(v => !isNaN(v));
    const maxBurst = burstValues.length > 0 ? Math.max(...burstValues) : 0;
    const items = [];
    let start = 0;
    for (let burst = 1; burst <= maxBurst; burst++) {
        const list = events.filter(e => Number(e.burst) === burst);
        let pause = 0;
        list.forEach(event => {
            if (event.shell === 'Tạm dừng') pause = Math.max(pause, event.duration || 2000);
            else items.push({ time: start + (Number(event.delay) || 0), event });
        });
        start += (list.length > 0 ? 2500 + pause : 1000) * 1.25;
    }
    return { items, end: start };
}

const syncShow = {
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




let activePointerCount = 0;
let isUpdatingSpeed = false;

function handlePointerStart(event) {
    activePointerCount++;
    // Chưa bắt đầu màn trình diễn: bỏ qua, tránh chạm vào góc màn hình chờ làm tạm dừng/mở menu ngầm
    if (appNodes.stageContainer.classList.contains('remove')) return;
    // Khung quay video: bấm nút "Bắt đầu quay" hay lỡ tay bấm vào khung không được bắn thêm pháo vào video
    if (IS_RECORD) return;
    // Bản xem nhanh đang hiện màn mở quà: người nhận thật lúc này chưa thấy sân khấu
    if (previewWaitingOpen) return;
    const btnSize = 50;

    if (event.y < btnSize) {
        if (event.x < btnSize) {
            togglePause();
            return;
        }
        if (event.x > mainStage.width / 2 - btnSize / 2 && event.x < mainStage.width / 2 + btnSize / 2) {
            toggleSound();
            return;
        }
        if (event.x > mainStage.width - btnSize) {
            menuOpenedByCornerAt = Date.now();
            toggleMenu();
            return;
        }
    }

    if (!isRunning()) return;

    if (updateSpeedFromEvent(event)) {
        isUpdatingSpeed = true;
    }
    // Người tạo có thể khóa chạm bắn pháo (kịch bản tapToLaunch: false): chạm vào trời không bắn thêm pháo
    else if (event.onCanvas && !(burstConfig && burstConfig.tapToLaunch === false)) {
        launchShellFromConfig(event);
    }
}

function handlePointerEnd(event) {
    activePointerCount--;
    isUpdatingSpeed = false;
}

function handlePointerMove(event) {
    if (!isRunning()) return;

    if (isUpdatingSpeed) {
        updateSpeedFromEvent(event);
    }
}

function handleKeydown(event) {
    // Đang chọn trong menu thì chỉ giữ lại phím Esc, tránh gõ chữ "o"/"p" làm đóng menu/tạm dừng
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(event.target.tagName) && event.keyCode !== 27) {
        return;
    }
    // Chưa vào màn trình diễn (màn mở quà, đếm ngược): P, O không được chạy ngầm phía sau
    if (appNodes.stageContainer.classList.contains('remove')) return;
    // P
    if (event.keyCode === 80) {
        togglePause();
    }
    // ồ
    else if (event.keyCode === 79) {
        toggleMenu();
    }
    // Thoát
    else if (event.keyCode === 27) {
        toggleMenu(false);
    }
}

mainStage.addEventListener('pointerstart', handlePointerStart);
mainStage.addEventListener('pointerend', handlePointerEnd);
mainStage.addEventListener('pointermove', handlePointerMove);
window.addEventListener('keydown', handleKeydown);


// Tính đến việc thay đổi kích thước cửa sổ và thay đổi tỷ lệ tùy chỉnh.
function handleResize() {
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
    // Nét theo mật độ điểm ảnh của màn hình (tối đa 2) để trăng, sao không nhòe; chất lượng dưới độ phân giải màn hình thì
    // vẽ thưa theo (không thưa hơn điểm ảnh CSS)
    const decoScale = Math.min(2, window.devicePixelRatio || 1, Math.max(1, mainStage.dpr));
    decoCanvas.width = Math.round(containerW * decoScale);
    decoCanvas.height = Math.round(containerH * decoScale);
    decoCanvas.style.width = containerW + 'px';
    decoCanvas.style.height = containerH + 'px';
    waterCanvas.width = Math.round(containerW * WATER_RESOLUTION);
    waterCanvas.height = Math.round(containerH * WATER_RESOLUTION);
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
let currentFrame = 0;
let speedBarOpacity = 0;
let autoLaunchTime = 0;

function updateSpeedFromEvent(event) {
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
function updateGlobals(timeStep, lag) {
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


// Chất lượng khi xem (Tự động hoặc 144p ... 4320p, xem player/quality.js): giới hạn tia lửa của mức, và vẽ khung pháo
// đúng số điểm ảnh của mức ở cạnh ngắn (720p: 720), không vượt độ phân giải gốc của màn hình.
function applyQualityLimits() {
    const level = qualityLevelSelector();
    Spark.budget = level.sparks;
    // Khung quay video giữ đúng độ phân giải video
    if (IS_RECORD) return;
    const shortSide = Math.min(frameW || window.innerWidth, frameH || window.innerHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, Number(level.value) / shortSide);
    if (stages.some(stage => stage.dpr !== dpr)) {
        stages.forEach(stage => { stage.dpr = dpr; });
        handleResize();
    }
}

// Thu phóng trình duyệt, kéo cửa sổ sang màn hình có mật độ điểm ảnh khác: vẽ lại theo mật độ mới cho pháo không nhòe
window.addEventListener('resize', applyQualityLimits);

// "Tự động": bắt đầu theo màn hình và cấu hình máy; lúc đang có pháo mà giật kéo dài (dưới ~26 khung/giây trong 4 giây)
// thì hạ một mức (vd 1080p xuống 720p), mượt lâu (trên ~50 khung/giây) thì nâng lại, không vượt mức ban đầu. Mỗi lần
// hạ, lần nâng sau phải chờ lâu hơn.
const levelIndex = value => QUALITY_LEVELS.findIndex(level => level.value === value);
const autoTuner = {
    last: 0,
    sum: 0,
    count: 0,
    since: 0,
    bad: 0,
    good: 0,
    drops: 0,
    cooldownUntil: 0,

    frame(now) {
        const dt = this.last ? now - this.last : 0;
        this.last = now;
        // Chỉ đo khung hình lúc có pháo; bỏ khung sau khi chuyển tab, tạm dừng (khoảng cách lớn bất thường)
        if (store.state.config.quality !== QUALITY_AUTO || IS_RECORD || !Spark.count || dt <= 0 || dt > 250) return;
        if (!this.count) this.since = now;
        this.sum += dt;
        this.count++;
        if (now - this.since < 2000) return;
        const avg = this.sum / this.count;
        this.sum = 0;
        this.count = 0;
        if (now < this.cooldownUntil) return;
        if (avg > 38) {
            this.good = 0;
            const index = levelIndex(autoQuality);
            if (++this.bad >= 2 && index < levelIndex(AUTO_QUALITY_FLOOR)) this.change(QUALITY_LEVELS[index + 1].value, now, true);
        } else if (avg < 20) {
            this.bad = 0;
            const index = levelIndex(autoQuality);
            if (++this.good >= 5 * (1 + this.drops) && index > levelIndex(AUTO_QUALITY_START)) this.change(QUALITY_LEVELS[index - 1].value, now, false);
        } else {
            this.bad = 0;
            this.good = 0;
        }
    },

    change(level, now, drop) {
        autoQuality = level;
        if (drop) this.drops++;
        this.bad = 0;
        this.good = 0;
        this.cooldownUntil = now + 4000;
        configDidUpdate();
        renderQualityLabel();
    }
};

// Ô chọn chất lượng ghi rõ mức "Tự động" đang dùng
function renderQualityLabel() {
    const option = appNodes.quality && appNodes.quality.querySelector(`option[value="${QUALITY_AUTO}"]`);
    if (option) option.textContent = `Tự động (${autoQuality}p)`;
}

// Cách xem kịch bản đặt sẵn (builder, nhóm "Khi người nhận xem"). Chỉ áp cho mục người xem chưa tự chọn trong Cài đặt;
// người xem vẫn đổi được. Kịch bản sau (bản xem nhanh nhận kịch bản mới) bỏ giá trị cũ rồi mới áp giá trị mới.
const VIEWER_DEFAULTS = {
    // Kịch bản cũ ghi Thấp / Vừa / Cao (1-3): đổi sang mức tương ứng
    quality: v => (validQuality(v) !== QUALITY_AUTO ? validQuality(v) : null),
    skyLighting: v => (['0', '1', '2'].includes(String(v)) ? String(v) : null),
    scaleFactor: v => (Number(v) >= 0.5 && Number(v) <= 2 ? Number(Number(v).toFixed(2)) : null),
    hideControls: v => (typeof v === 'boolean' ? v : null)
};

function applyViewerDefaults(viewer) {
    const prev = store.state.config;
    const next = {};
    store.scriptKeys.forEach(key => { next[key] = store.saved[key]; });
    store.scriptKeys.clear();
    if (viewer && typeof viewer === 'object') {
        Object.entries(VIEWER_DEFAULTS).forEach(([key, read]) => {
            // Khung quay video luôn ở chất lượng Cao
            if (store.chosen.has(key) || viewer[key] === undefined || (IS_RECORD && key === 'quality')) return;
            const value = read(viewer[key]);
            if (value === null) return;
            next[key] = value;
            store.scriptKeys.add(key);
        });
    }
    if (!Object.keys(next).some(key => String(next[key]) !== String(prev[key]))) return;
    store.setState({ config: { ...prev, ...next } });
    configDidUpdate();
    if (String(next.scaleFactor ?? prev.scaleFactor) !== String(prev.scaleFactor)) handleResize();
}

// Bỏ phần tử thứ i: đưa phần tử cuối vào chỗ của nó thay vì splice (splice dồn cả mảng, hàng nghìn tia lửa tắt mỗi
// khung thành hàng triệu thao tác). Vòng cập nhật chạy ngược nên phần tử cuối đã được cập nhật trong khung này.
function removeAt(list, i) {
    const last = list.pop();
    if (i < list.length) list[i] = last;
}

function update(frameTime, lag) {
    // Đang dựng video: chỉ vòng dựng (renderVideo) cho mô phỏng bước tiếp, theo đúng nhịp khung hình của video
    if (recording.active && !recording.stepping) return;
    if (!isRunning()) return;
    autoTuner.frame(performance.now());
    // Kịch bản khớp nhịp: chờ nhạc kêu rồi pháo mới bay tiếp
    if (syncShow.holds(frameTime)) return;

    const width = stageW;
    const height = stageH;
    const timeStep = frameTime * simSpeed;
    const speed = simSpeed * lag;
    const reduceFlashing = reduceFlashingSelector();

    updateGlobals(timeStep, lag);
    ImageBurst.updateAll(timeStep);
    const smokeOn = Smoke.active();
    Decor.sync(sceneSelector(), frameW, frameH);
    Decor.update(timeStep);
    Smoke.update(timeStep, !burstConfig || !SMOKE_LEVELS[burstConfig.smoke]);

    const starDrag = 1 - (1 - Star.airDrag) * speed;
    const starDragHeavy = 1 - (1 - Star.airDragHeavy) * speed;
    const sparkDrag = 1 - (1 - Spark.airDrag) * speed;
    const gAcc = timeStep / 1000 * GRAVITY;

    // Cập nhật Ngôi sao (Stars)
    Object.keys(Star.active).forEach(color => {
        const stars = Star.active[color];
        for (let i = stars.length - 1; i >= 0; i = i - 1) {
            const star = stars[i];
            if (star.updateFrame === currentFrame) {
                continue;
            }
            star.updateFrame = currentFrame;

            star.life -= timeStep;
            if (star.targetY !== undefined && (star.y <= star.targetY || star.speedY >= 0)) {
                star.life = 0; // Buộc nổ khi đạt tới độ cao mục tiêu hoặc bắt đầu rơi xuống
            }
            if (star.life <= 0) {
                removeAt(stars, i);
                Star.returnInstance(star);
            } else {
                const burnRate = Math.pow(star.life / star.fullLife, 0.5);
                const burnRateInverse = 1 - burnRate;

                star.prevX = star.x;
                star.prevY = star.y;
                if (star.orbit) {
                    // Hạt quay quanh tâm vụ nổ: bán kính nở dần tới đích, vòng quay chậm dần, cả vòng rơi nhẹ
                    const o = star.orbit;
                    o.radius += (o.targetRadius - o.radius) * Math.min(1, o.expand * speed);
                    o.angle += o.angularSpeed * speed;
                    o.angularSpeed *= 1 - o.spinDrag * speed;
                    o.fallSpeed += o.fallAcc * speed;
                    o.cy += o.fallSpeed * speed;
                    const lx = Math.cos(o.angle) * o.radius;
                    const ly = Math.sin(o.angle) * o.radius * o.squash;
                    const nx = o.cx + lx * o.tiltCos - ly * o.tiltSin;
                    const ny = o.cy + lx * o.tiltSin + ly * o.tiltCos;
                    // Vận tốc = quãng vừa đi, để vệt sáng đầu hạt và tia lửa đi đúng hướng quay
                    star.speedX = speed ? (nx - star.x) / speed : 0;
                    star.speedY = speed ? (ny - star.y) / speed : 0;
                    star.x = nx;
                    star.y = ny;
                } else {
                    star.x += star.speedX * speed;
                    star.y += star.speedY * speed;
                    if (!star.heavy) {
                        star.speedX *= starDrag;
                        star.speedY *= starDrag;
                    }
                    else {
                        star.speedX *= starDragHeavy;
                        star.speedY *= starDragHeavy;
                    }
                    star.speedY += gAcc * star.gravityScale;

                    if (star.spinRadius) {
                        star.spinAngle += star.spinSpeed * speed;
                        star.x += Math.sin(star.spinAngle) * star.spinRadius * speed;
                        star.y += Math.cos(star.spinAngle) * star.spinRadius * speed;
                    }
                }

                // Hành vi riêng của kiểu bắn (xoắn, lượn, nổ dọc đường, đẩy lên tầng trên...)
                if (star.onUpdate) star.onUpdate(star, timeStep, speed);
                if (star.smokeTrail && smokeOn) Smoke.trail(star, timeStep);

                if (star.sparkFreq) {
                    star.sparkTimer -= timeStep;
                    while (star.sparkTimer < 0) {
                        star.sparkTimer += star.sparkFreq * 0.75 + star.sparkFreq * burnRateInverse * 4;
                        Spark.add(
                            star.x,
                            star.y,
                            star.sparkColor,
                            Math.random() * PI_2,
                            Math.random() * star.sparkSpeed * burnRate,
                            star.sparkLife * 0.8 + Math.random() * star.sparkLifeVariation * star.sparkLife
                        );
                    }
                }

                if (star.life < star.transitionTime) {
                    if (star.secondColor && !star.colorChanged) {
                        star.colorChanged = true;
                        star.color = star.secondColor;
                        removeAt(stars, i);
                        if (!Star.active[star.secondColor]) Star.active[star.secondColor] = [];
                        Star.active[star.secondColor].push(star);
                        if (star.secondColor === INVISIBLE) {
                            star.sparkFreq = 0;
                        }
                    }

                    if (reduceFlashing) {
                        // Giảm chớp sáng: hạt nhấp nháy, lấp lánh giữ sáng đều
                    } else if (star.strobe) {
                        star.visible = Math.floor(star.life / star.strobeFreq) % 3 === 0;
                    } else if (star.twinkle) {
                        // Lấp lánh ngẫu nhiên lúc sắp tàn
                        star.visible = Math.random() < 0.55;
                    }
                }
            }
        }
    });

    // Cập nhật Tia lửa (Sparks)
    Object.keys(Spark.active).forEach(color => {
        const sparks = Spark.active[color];
        for (let i = sparks.length - 1; i >= 0; i = i - 1) {
            const spark = sparks[i];
            spark.life -= timeStep;
            if (spark.life <= 0) {
                removeAt(sparks, i);
                Spark.returnInstance(spark);
            } else {
                spark.prevX = spark.x;
                spark.prevY = spark.y;
                spark.x += spark.speedX * speed;
                spark.y += spark.speedY * speed;
                spark.speedX *= sparkDrag;
                spark.speedY *= sparkDrag;
                spark.speedY += gAcc;
            }
        }
    });

    render(speed);
}

// Lượng làm mờ vệt sáng đang tích lũy (đơn vị: số khung 60Hz)
let trailFadeAmount = 0;

function render(speed) {
    const { dpr } = mainStage;
    const width = stageW;
    const height = stageH;
    const trailsCtx = trailsStage.ctx;
    const mainCtx = mainStage.ctx;

    if (reduceFlashingSelector()) {
        // Giảm chớp sáng: bầu trời giữ màu đen, không lóe sáng theo pháo
        if (currentSkyColor.r || currentSkyColor.g || currentSkyColor.b) {
            currentSkyColor.r = currentSkyColor.g = currentSkyColor.b = 0;
            appNodes.stageContainer.style.backgroundColor = '#000';
        }
    } else if (skyLightingSelector() !== SKY_LIGHT_NONE) {
        colorSky(speed);
    } else if (currentSkyColor.r || currentSkyColor.g || currentSkyColor.b) {
        // Vừa tắt ánh sáng bầu trời: mặt nước, khói đang đọc màu trời này
        currentSkyColor.r = currentSkyColor.g = currentSkyColor.b = 0;
    }

    // Tính đến màn hình có độ phân giải cao và hệ số tỷ lệ tùy chỉnh.
    const scaleFactor = scaleFactorSelector();
    trailsCtx.scale(dpr * scaleFactor, dpr * scaleFactor);
    mainCtx.scale(dpr * scaleFactor, dpr * scaleFactor);

    trailsCtx.globalCompositeOperation = 'source-over';
    if (store.state.config.longExposure) {
        trailsCtx.fillStyle = 'rgba(0, 0, 0, 0.0025)';
        trailsCtx.fillRect(0, 0, width, height);
    } else {
        // Làm mờ vệt sáng theo nhịp ~60 lần/giây. Màn hình 120/144Hz mà phủ mỗi khung một lớp đen quá mỏng thì
        // điểm ảnh tối bị làm tròn giữ nguyên, để lại bóng mờ của pháo cũ trên trời.
        trailFadeAmount += speed;
        if (trailFadeAmount >= 1) {
            trailsCtx.fillStyle = `rgba(0, 0, 0, ${Math.min(1, 0.175 * trailFadeAmount)})`;
            trailsCtx.fillRect(0, 0, width, height);
            trailFadeAmount = 0;
        }
    }

    mainCtx.clearRect(0, 0, width, height);

    // Khói pháo: vẽ cả khi vừa tắt để xóa lớp khói còn lại
    Smoke.render(smokeCtx, smokeCanvas.width / (stageW || 1), currentSkyColor, reduceFlashingSelector());
    Decor.render(decoCtx);

    // Có mặt nước: pháo, tia lửa chỉ vẽ phía trên mép nước (rơi tới mặt nước thì tắt)
    const waterline = height * horizonSelector();
    const clipped = waterline < height;
    if (clipped) {
        [trailsCtx, mainCtx].forEach(ctx => {
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, 0, width, waterline);
            ctx.clip();
        });
    }

    // Vẽ các đèn flash xếp hàng đợi
    // Chúng cũng phải được vẽ bằng cách sử dụng nguồn qua Safari. Có vẻ như việc hiển thị độ dốc bằng cách sử dụng ánh sáng sẽ vẽ các hộp đen lớn thay thế.
    // Rất may, những tia chớp này trông khá giống nhau.
    while (BurstFlash.active.length) {
        const bf = BurstFlash.active.pop();

        // Kiểm tra an toàn để tránh lỗi non-finite
        if (!Number.isFinite(bf.x) || !Number.isFinite(bf.y) || !Number.isFinite(bf.radius) || bf.radius <= 0) {
            BurstFlash.returnInstance(bf);
            continue;
        }

        const burstGradient = trailsCtx.createRadialGradient(bf.x, bf.y, 0, bf.x, bf.y, bf.radius);
        burstGradient.addColorStop(0.024, 'rgba(255, 255, 255, 1)');
        burstGradient.addColorStop(0.125, 'rgba(255, 160, 20, 0.2)');
        burstGradient.addColorStop(0.32, 'rgba(255, 140, 20, 0.11)');
        burstGradient.addColorStop(1, 'rgba(255, 120, 20, 0)');
        trailsCtx.fillStyle = burstGradient;
        trailsCtx.fillRect(bf.x - bf.radius, bf.y - bf.radius, bf.radius * 2, bf.radius * 2);

        BurstFlash.returnInstance(bf);
    }

    // Bản vẽ còn lại trên canvas đường nhỏ sẽ sử dụng chế độ hòa trộn 'làm sáng'
    trailsCtx.globalCompositeOperation = 'lighten';

    // Vẽ ngôi sao
    trailsCtx.lineWidth = Star.drawWidth;
    trailsCtx.lineCap = isLowQuality ? 'square' : 'round';
    mainCtx.strokeStyle = '#fff';
    mainCtx.lineWidth = 1;
    mainCtx.beginPath();
    Object.keys(Star.active).forEach(color => {
        if (color === INVISIBLE || color === '_pool') return;
        const stars = Star.active[color];
        if (stars.length === 0) return;
        
        trailsCtx.strokeStyle = color;
        trailsCtx.beginPath();
        for (let i = 0; i < stars.length; i++) {
            const star = stars[i];
            if (star.visible) {
                trailsCtx.moveTo(star.x, star.y);
                trailsCtx.lineTo(star.prevX, star.prevY);
                mainCtx.moveTo(star.x, star.y);
                mainCtx.lineTo(star.x - star.speedX * 1.6, star.y - star.speedY * 1.6);
            }
        }
        trailsCtx.stroke();
    });
    mainCtx.stroke();

    // Vẽ tia lửa
    trailsCtx.lineWidth = Spark.drawWidth;
    trailsCtx.lineCap = 'butt';
    Object.keys(Spark.active).forEach(color => {
        if (color === INVISIBLE || color === '_pool') return;
        const sparks = Spark.active[color];
        if (sparks.length === 0) return;

        trailsCtx.strokeStyle = color;
        trailsCtx.beginPath();
        for (let i = 0; i < sparks.length; i++) {
            const spark = sparks[i];
            trailsCtx.moveTo(spark.x, spark.y);
            trailsCtx.lineTo(spark.prevX, spark.prevY);
        }
        trailsCtx.stroke();
    });


    // Vẽ hình ảnh phóng to
    ImageBurst.drawAll(mainCtx);


    if (clipped) {
        trailsCtx.restore();
        mainCtx.restore();
    }

    // Hiển thị thanh tốc độ nếu hiển thị
    if (speedBarOpacity) {
        const speedBarHeight = 6;
        mainCtx.globalAlpha = speedBarOpacity;
        mainCtx.fillStyle = COLOR.Blue;
        mainCtx.fillRect(0, height - speedBarHeight, width * simSpeed, speedBarHeight);
        mainCtx.globalAlpha = 1;
    }


    trailsCtx.setTransform(1, 0, 0, 1, 0, 0);
    mainCtx.setTransform(1, 0, 0, 1, 0, 0);

    // Mặt nước phản chiếu mọi thứ phía trên (vẽ sau cùng để bắt kịp khung hình này)
    Water.render(waterCtx, {
        // Lớp đang trống (không trang trí, không khói) thì bỏ qua cho nhẹ máy
        sources: [Decor.active() && decoCanvas, Smoke.count() && smokeCanvas, trailsStage.canvas, mainStage.canvas],
        background: store.state.config.showBackground ? appNodes.backgroundImage : null,
        sky: currentSkyColor,
        cssW: frameW,
        cssH: frameH,
        time: now(),
        style: burstConfig && burstConfig.waterStyle === 'river' ? 'river' : 'lake',
        floating: burstConfig && ['lanterns', 'petals'].includes(burstConfig.floating) ? burstConfig.floating : '',
        calm: reduceFlashingSelector(),
        life: !burstConfig || burstConfig.waterLife !== false
    });
}


// Vẽ lớp phủ màu dựa trên độ sáng kết hợp của các ngôi sao (thắp sáng bầu trời!)
// Lưu ý: điều này được áp dụng cho màu nền của vùng chứa canvas, vì vậy nó nằm phía sau các hạt
const currentSkyColor = { r: 0, g: 0, b: 0 };
const targetSkyColor = { r: 0, g: 0, b: 0 };
function colorSky(speed) {
    // Giá trị r, g hoặc b tối đa sẽ được sử dụng (255 sẽ không biểu thị mức tối đa)
    const maxSkySaturation = skyLightingSelector() * 15;
    // Tổng cộng cần bao nhiêu ngôi sao để đạt được độ sáng bầu trời tối đa
    const maxStarCount = 500;
    let totalStarCount = 0;
    // Khởi tạo bầu trời có màu đen
    targetSkyColor.r = 0;
    targetSkyColor.g = 0;
    targetSkyColor.b = 0;
    // Thêm từng màu đã biết vào bầu trời, nhân với số lượng hạt của màu đó. Điều này sẽ khiến các giá trị RGB vượt quá giới hạn nhưng chúng tôi sẽ điều chỉnh lại chúng sau.
    // Đồng thời cộng tổng số sao.
    Object.keys(Star.active).forEach(color => {
        if (color === INVISIBLE || color === '_pool') return;
        let tuple = COLOR_TUPLES[color];
        if (!tuple) {
            // Phân tích màu rgb/hex nếu không có trong COLOR_TUPLES
            if (color.startsWith('rgb')) {
                const match = color.match(/\d+/g);
                if (match) tuple = { r: parseInt(match[0]), g: parseInt(match[1]), b: parseInt(match[2]) };
            } else if (color.startsWith('#')) {
                const hex = color.substring(1);
                tuple = {
                    r: parseInt(hex.substring(0, 2), 16),
                    g: parseInt(hex.substring(2, 4), 16),
                    b: parseInt(hex.substring(4, 6), 16)
                };
            }
        }
        if (!tuple) tuple = { r: 255, g: 255, b: 255 };

        const count = Star.active[color].length;
        totalStarCount += count;
        targetSkyColor.r += tuple.r * count;
        targetSkyColor.g += tuple.g * count;
        targetSkyColor.b += tuple.b * count;
    });

    // Cường độ kẹp ở mức 1,0 và ánh xạ tới đường cong phi tuyến tính tùy chỉnh. Điều này cho phép một số ngôi sao sáng lên bầu trời một cách rõ ràng, trong khi nhiều ngôi sao hơn tiếp tục tăng độ sáng nhưng với tốc độ thấp hơn. Điều này phù hợp hơn với nhận thức độ sáng phi tuyến tính của con người.
    const intensity = Math.pow(Math.min(1, totalStarCount / maxStarCount), 0.3);
    // Tìm ra thành phần màu nào có giá trị cao nhất để chúng ta có thể chia tỷ lệ chúng mà không ảnh hưởng đến tỷ lệ.
    // Ngăn chặn việc sử dụng 0 để chúng ta không chia cho 0 ở bước tiếp theo.
    const maxColorComponent = Math.max(1, targetSkyColor.r, targetSkyColor.g, targetSkyColor.b);
    // Chia tỷ lệ tất cả các thành phần màu lên mức tối đa `maxSkySaturation` và áp dụng cường độ.
    targetSkyColor.r = targetSkyColor.r / maxColorComponent * maxSkySaturation * intensity;
    targetSkyColor.g = targetSkyColor.g / maxColorComponent * maxSkySaturation * intensity;
    targetSkyColor.b = targetSkyColor.b / maxColorComponent * maxSkySaturation * intensity;

    // Tạo hiệu ứng thay đổi màu sắc để làm mượt các chuyển tiếp.
    const colorChange = 10;
    currentSkyColor.r += (targetSkyColor.r - currentSkyColor.r) / colorChange * speed;
    currentSkyColor.g += (targetSkyColor.g - currentSkyColor.g) / colorChange * speed;
    currentSkyColor.b += (targetSkyColor.b - currentSkyColor.b) / colorChange * speed;

    appNodes.stageContainer.style.backgroundColor = `rgb(${currentSkyColor.r | 0}, ${currentSkyColor.g | 0}, ${currentSkyColor.b | 0})`;
}

mainStage.addEventListener('ticker', update);




// Bắt đầu mọi thứ.

function setLoadingStatus(status) {
    appNodes.loadingStatus.textContent = status;
}

// Bản xem nhanh: đang hiện màn mở quà, chờ người tạo chạm mở như người nhận
let previewWaitingOpen = false;
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
    const frame = START_FRAMES[config.startFrame] || START_FRAMES.card;
    const { trigger, open, firstLaunchDelay } = frame.mount(screen, config);
    screen.classList.add('is-ready');
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
