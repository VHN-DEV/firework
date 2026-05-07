import fscreen from './fscreen@1.0.1.js';
import { Stage, Ticker } from './Stage@0.1.4.js';
import MyMath from './MyMath.js';
import '../scss/style.scss';

// Assign to window for global access (needed by HTML and other scripts)
window.fscreen = fscreen;
window.Stage = Stage;
window.Ticker = Ticker;
window.MyMath = MyMath;

'use strict';
console.clear();

// Đây là một ví dụ điển hình về những gì bắt đầu như một dự án đơn giản
// và những quả cầu tuyết vượt quá kích thước dự định của nó. Nó hơi rắc rối một chút
// đang đọc/làm việc trên một tệp duy nhất này, nhưng dù sao thì nó vẫn ở đây :)

const IS_MOBILE = window.innerWidth <= 640;
const IS_DESKTOP = window.innerWidth > 800;
const IS_HEADER = IS_DESKTOP && window.innerHeight < 300;
// Phát hiện các thiết bị cao cấp. Đây sẽ là một mục tiêu di động.
const IS_HIGH_END_DEVICE = (() => {
    const hwConcurrency = navigator.hardwareConcurrency;
    if (!hwConcurrency) {
        return false;
    }
    // Màn hình lớn cho thấy máy tính có kích thước đầy đủ, ngày nay thường có siêu phân luồng.
    // Vì vậy, một máy tính để bàn lõi tứ có 8 lõi. Chúng tôi sẽ đặt ngưỡng tối thiểu cao hơn ở đó.
    const minCount = window.innerWidth <= 1024 ? 4 : 8;
    return hwConcurrency >= minCount;
})();
// Ngăn không cho canvas trở nên quá lớn trên các kích thước màn hình lố bịch.
// 8K - có thể hạn chế điều này nếu cần
const MAX_WIDTH = 7680;
const MAX_HEIGHT = 4320;
const GRAVITY = 0.9; // Gia tốc tính bằng px/s
let simSpeed = 1;
let burstConfig = null;
let burstCounter = 0;

function getDefaultScaleFactor() {
    if (IS_MOBILE) return 0.9;
    if (IS_HEADER) return 0.75;
    return 1;
}

// Các giá trị chiều rộng/chiều cao có tính đến tỷ lệ.
// SỬ DỤNG NHỮNG ĐIỀU NÀY ĐỂ VẼ VỊ TRÍ
let stageW, stageH;

// Tất cả các hình ảnh toàn cầu chất lượng sẽ được ghi đè và cập nhật thông qua `configDidUpdate`.
let quality = 1;
let isLowQuality = false;
let isNormalQuality = true;
let isHighQuality = false;

const QUALITY_LOW = 1;
const QUALITY_NORMAL = 2;
const QUALITY_HIGH = 3;

const SKY_LIGHT_NONE = 0;
const SKY_LIGHT_DIM = 1;
const SKY_LIGHT_NORMAL = 2;

const COLOR = {
    Red: '#ff0043',
    Green: '#14fc56',
    Blue: '#1e7fff',
    Purple: '#e60aff',
    Gold: '#ffbf36',
    White: '#ffffff'
};

// Màu vô hình đặc biệt (không được hiển thị và do đó không có trong bản đồ MÀU)
const INVISIBLE = '_INVISIBLE_';

const PI_2 = Math.PI * 2;
const PI_HALF = Math.PI * 0.5;

// Stage.disableHighDPI = true;
const trailsStage = new Stage('trails-canvas');
const mainStage = new Stage('main-canvas');
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
        soundEnabled: true,
        menuOpen: false,
        openHelpTopic: null,
        fullscreen: isFullscreen(),
        // Lưu ý rằng các giá trị cấu hình được sử dụng cho <select> phải là chuỗi, trừ khi chuyển đổi giá trị thành chuỗi theo cách thủ công
        // tại thời điểm kết xuất và phân tích cú pháp khi thay đổi.
        config: {
            quality: String(IS_HIGH_END_DEVICE ? QUALITY_HIGH : QUALITY_NORMAL), // sẽ được phản ánh thành một biến toàn cục có tên `quality` trong `configDidUpdate`, để hoàn thiện.
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
                'Liễu'
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
            scaleFactor: getDefaultScaleFactor()
        }
    },

    setState(nextState) {
        const prevState = this.state;
        this.state = Object.assign({}, this.state, nextState);
        this._dispatch(prevState);
        this.persist();
    },

    subscribe(listener) {
        this._listeners.add(listener);
        return () => this._listeners.remove(listener);
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
                case '1.1':
                    config.quality = data.quality;
                    config.size = data.size;
                    config.skyLighting = data.skyLighting;
                    break;
                case '1.2':
                    config.quality = data.quality;
                    config.size = data.size;
                    config.skyLighting = data.skyLighting;
                    config.scaleFactor = data.scaleFactor || getDefaultScaleFactor();
                    break;
                default:
                    throw new Error('version switch should be exhaustive');
            }
            console.log(`Loaded config (schema version ${schemaVersion})`);
        }
        // Định dạng dữ liệu không được dùng nữa. Đã kiểm tra cẩn thận (nó không được đặt tên).
        else if (localStorage.getItem('schemaVersion') === '1') {
            let size;
            // Cố gắng phân tích dữ liệu, bỏ qua nếu có lỗi.
            try {
                const sizeRaw = localStorage.getItem('configSize');
                size = typeof sizeRaw === 'string' && JSON.parse(sizeRaw);
            }
            catch (e) {
                console.log('Recovered from error parsing saved config:');
                console.error(e);
                return;
            }
            // Chỉ khôi phục các giá trị được xác thực
            const sizeInt = parseInt(size, 10);
            if (sizeInt >= 0 && sizeInt <= 4) {
                this.state.config.size = String(sizeInt);
            }
        }
    },

    persist() {
        const config = this.state.config;
        localStorage.setItem('cm_fireworks_data', JSON.stringify({
            schemaVersion: '1.2',
            data: {
                quality: config.quality,
                size: config.size,
                skyLighting: config.skyLighting,
                scaleFactor: config.scaleFactor
            }
        }));
    }
};


if (!IS_HEADER) {
    store.load();
}

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

function updateConfig(nextConfig) {
    nextConfig = nextConfig || getConfigFromDOM();
    store.setState({
        config: Object.assign({}, store.state.config, nextConfig)
    });

    configDidUpdate();
}

// Ánh xạ cấu hình tới các thuộc tính khác nhau và áp dụng các tác dụng phụ
function configDidUpdate() {
    const config = store.state.config;

    quality = qualitySelector();
    isLowQuality = quality === QUALITY_LOW;
    isNormalQuality = quality === QUALITY_NORMAL;
    isHighQuality = quality === QUALITY_HIGH;

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
// Chuyển đổi chất lượng thành số.
const qualitySelector = () => +store.state.config.quality;
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
    shellType: {
        header: 'Loại pháo',
        body: 'Loại pháo hoa sẽ được bắn. Chọn "Ngẫu nhiên" để có sự kết hợp thú vị!'
    },
    shellSize: {
        header: 'Kích thước pháo',
        body: 'Kích thước của pháo hoa. Lấy cảm hứng từ kích thước pháo hoa thật, pháo lớn hơn sẽ có chùm nổ to hơn với nhiều sao hơn, và đôi khi có các hiệu ứng phức tạp hơn. Tuy nhiên, pháo lớn cũng đòi hỏi sức mạnh xử lý cao hơn và có thể gây giật lag.'
    },
    quality: {
        header: 'Chất lượng',
        body: 'Chất lượng đồ họa tổng thể. Nếu hình ảnh chuyển động không mượt mà, hãy thử giảm chất lượng xuống. Chất lượng cao làm tăng đáng kể số lượng tia lửa được hiển thị và có thể gây giật lag.'
    },
    skyLighting: {
        header: 'Ánh sáng bầu trời',
        body: 'Chiếu sáng nền khi pháo hoa nổ. Nếu nền trông quá sáng trên màn hình của bạn, hãy thử đặt thành "Mờ" hoặc "Không".'
    },
    scaleFactor: {
        header: 'Tỉ lệ',
        body: 'Cho phép điều chỉnh kích thước của tất cả pháo hoa, thực chất là đưa bạn lại gần hoặc ra xa hơn. Đối với các loại pháo lớn, việc giảm tỉ lệ một chút có thể thuận tiện hơn, đặc biệt là trên điện thoại hoặc máy tính bảng.'
    },
    autoLaunch: {
        header: 'Tự động bắn',
        body: 'Tự động bắn pháo hoa liên tục. Hãy ngồi lại và thưởng thức buổi trình diễn, hoặc tắt đi để tự điều khiển.'
    },
    finaleMode: {
        header: 'Chế độ kết thúc',
        body: 'Bắn những loạt pháo hoa dữ dội. Có thể gây giật lag. Yêu cầu bật "Tự động bắn".'
    },
    hideControls: {
        header: 'Ẩn điều khiển',
        body: 'Ẩn các điều khiển bán trong suốt dọc theo phía trên màn hình. Hữu ích khi chụp ảnh màn hình, hoặc chỉ để có trải nghiệm liền mạch hơn. Khi bị ẩn, bạn vẫn có thể chạm vào góc trên bên phải để mở lại menu này.'
    },
    fullscreen: {
        header: 'Toàn màn hình',
        body: 'Bật/tắt chế độ toàn màn hình.'
    },
    longExposure: {
        header: 'Mở màn trập',
        body: 'Hiệu ứng thử nghiệm giữ lại những vệt sáng dài, tương tự như việc mở màn trập máy ảnh.'
    }
};

const nodeKeyToHelpKey = {
    shellTypeLabel: 'shellType',
    shellSizeLabel: 'shellSize',
    qualityLabel: 'quality',
    skyLightingLabel: 'skyLighting',
    scaleFactorLabel: 'scaleFactor',
    autoLaunchLabel: 'autoLaunch',
    finaleModeLabel: 'finaleMode',
    hideControlsLabel: 'hideControls',
    fullscreenLabel: 'fullscreen',
    longExposureLabel: 'longExposure'
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
    shellType: '.shell-type-list',
    shellTypeLabel: '.shell-type-label',
    customText: '.custom-text',
    shellSize: '.shell-size',
    shellSizeLabel: '.shell-size-label',
    quality: '.quality-ui',
    qualityLabel: '.quality-ui-label',
    skyLighting: '.sky-lighting',
    skyLightingLabel: '.sky-lighting-label',
    scaleFactor: '.scaleFactor',
    scaleFactorLabel: '.scaleFactor-label',
    autoLaunch: '.auto-launch',
    autoLaunchLabel: '.auto-launch-label',
    finaleModeFormOption: '.form-option--finale-mode',
    finaleMode: '.finale-mode',
    finaleModeLabel: '.finale-mode-label',
    hideControls: '.hide-controls',
    hideControlsLabel: '.hide-controls-label',
    fullscreenFormOption: '.form-option--fullscreen',
    fullscreen: '.fullscreen',
    fullscreenLabel: '.fullscreen-label',
    showBackground: '.show-background',
    showBackgroundLabel: '.show-background-label',
    longExposure: '.long-exposure',
    longExposureLabel: '.long-exposure-label',

    // Giao diện trợ giúp
    helpModal: '.help-modal',
    loadingInit: '.loading-init',
    loadingStatus: '.loading-init__status',
    helpModalOverlay: '.help-modal__overlay',
    helpModalHeader: '.help-modal__header',
    helpModalBody: '.help-modal__body',
    helpModalCloseBtn: '.help-modal__close-btn',

    // Màn hình bắt đầu
    startScreen: '.start-screen',
    btnStart: '.btn-start'
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
    appNodes.finaleModeFormOption.style.opacity = state.config.autoLaunch ? 1 : 0.32;

    appNodes.quality.value = state.config.quality;
    appNodes.customText.value = state.config.customText;
    const selectedShells = Array.isArray(state.config.shell) ? state.config.shell : [state.config.shell];
    appNodes.shellType.querySelectorAll('input').forEach(cb => {
        cb.checked = selectedShells.includes(cb.value);
    });
    appNodes.shellSize.value = state.config.size;
    appNodes.autoLaunch.checked = state.config.autoLaunch;
    appNodes.finaleMode.checked = state.config.finale;
    appNodes.skyLighting.value = state.config.skyLighting;
    appNodes.hideControls.checked = state.config.hideControls;
    appNodes.showBackground.checked = state.config.showBackground;
    appNodes.fullscreen.checked = state.fullscreen;

    // Hiển thị/ẩn nền
    appNodes.backgroundImage.classList.toggle('show', state.config.showBackground);
    appNodes.longExposure.checked = state.config.longExposure;
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
        } else {
            soundManager.pauseAll();
        }
    }
}

store.subscribe(handleStateChange);


function getConfigFromDOM() {
    return {
        quality: appNodes.quality.value,
        customText: appNodes.customText.value,
        shell: Array.from(appNodes.shellType.querySelectorAll('input:checked')).map(cb => cb.value),
        size: appNodes.shellSize.value,
        autoLaunch: appNodes.autoLaunch.checked,
        finale: appNodes.finaleMode.checked,
        skyLighting: appNodes.skyLighting.value,
        longExposure: appNodes.longExposure.checked,
        hideControls: appNodes.hideControls.checked,
        showBackground: appNodes.showBackground.checked,
        // Lưu trữ giá trị dưới dạng số.
        scaleFactor: parseFloat(appNodes.scaleFactor.value)
    };
};

const updateConfigNoEvent = () => updateConfig();
appNodes.quality.addEventListener('input', updateConfigNoEvent);
appNodes.customText.addEventListener('input', updateConfigNoEvent);
appNodes.shellType.addEventListener('change', (e) => {
    const target = e.target;
    if (target.tagName !== 'INPUT') return;

    const allCheckboxes = Array.from(appNodes.shellType.querySelectorAll('input'));
    const randomCheckbox = allCheckboxes.find(cb => cb.value === 'Ngẫu nhiên');

    if (target.value === 'Ngẫu nhiên') {
        if (target.checked) {
            // Nếu chọn "Ngẫu nhiên", bỏ chọn tất cả các loại khác
            allCheckboxes.forEach(cb => {
                if (cb !== target) cb.checked = false;
            });
        }
    } else {
        if (target.checked) {
            // Nếu chọn bất kỳ loại nào khác, bỏ chọn "Ngẫu nhiên"
            if (randomCheckbox) randomCheckbox.checked = false;
        }
    }

    // Luôn đảm bảo có ít nhất một loại được chọn. Nếu không có gì được chọn, tự động chọn lại "Ngẫu nhiên".
    if (!allCheckboxes.some(cb => cb.checked)) {
        if (randomCheckbox) randomCheckbox.checked = true;
    }

    updateConfig();
});
appNodes.shellSize.addEventListener('input', updateConfigNoEvent);
appNodes.autoLaunch.addEventListener('click', () => setTimeout(updateConfig, 0));
appNodes.finaleMode.addEventListener('click', () => setTimeout(updateConfig, 0));
appNodes.skyLighting.addEventListener('input', updateConfigNoEvent);
appNodes.longExposure.addEventListener('click', () => setTimeout(updateConfig, 0));
appNodes.hideControls.addEventListener('click', () => setTimeout(updateConfig, 0));
appNodes.showBackground.addEventListener('click', () => setTimeout(updateConfig, 0));
const stopAndRun = (fn) => (e) => {
    e.stopPropagation();
    e.preventDefault();
    fn(e);
};

appNodes.pauseBtn.addEventListener('click', stopAndRun(() => togglePause()));
appNodes.soundBtn.addEventListener('click', stopAndRun(() => toggleSound()));
appNodes.settingsBtn.addEventListener('click', stopAndRun(() => toggleMenu()));
appNodes.closeMenuBtn.addEventListener('click', stopAndRun(() => toggleMenu(false)));

// Ngăn chặn các sự kiện chuột và chạm nổi bọt lên document (nơi Stage đang lắng nghe)
const stopPropagation = (e) => e.stopPropagation();
[appNodes.pauseBtn, appNodes.soundBtn, appNodes.settingsBtn, appNodes.closeMenuBtn, appNodes.btnStart].forEach(node => {
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

Object.keys(nodeKeyToHelpKey).forEach(nodeKey => {
    const helpKey = nodeKeyToHelpKey[nodeKey];
    appNodes[nodeKey].addEventListener('click', () => {
        store.setState({ openHelpTopic: helpKey });
    });
});

appNodes.helpModalCloseBtn.addEventListener('click', () => {
    store.setState({ openHelpTopic: null });
});

appNodes.helpModalOverlay.addEventListener('click', () => {
    store.setState({ openHelpTopic: null });
});



// Đạo hàm hằng số
const COLOR_NAMES = Object.keys(COLOR);
const COLOR_CODES = COLOR_NAMES.map(colorName => COLOR[colorName]);
// Những ngôi sao vô hình cần một bộ nhận dạng, ngay cả khi chúng không được hiển thị - vật lý vẫn được áp dụng.
const COLOR_CODES_W_INVIS = [...COLOR_CODES, INVISIBLE];
// Ánh xạ mã màu tới chỉ mục của chúng trong mảng. Hữu ích để xác định nhanh xem màu đã được cập nhật trong vòng lặp hay chưa.
const COLOR_CODE_INDEXES = COLOR_CODES_W_INVIS.reduce((obj, code, i) => {
    obj[code] = i;
    return obj;
}, {});
// Bộ dữ liệu là một khóa ánh xạ theo mã màu (hex) với các giá trị của bộ dữ liệu { r, g, b } (vẫn chỉ là đối tượng).
const COLOR_TUPLES = {};
COLOR_CODES.forEach(hex => {
    COLOR_TUPLES[hex] = {
        r: parseInt(hex.substr(1, 2), 16),
        g: parseInt(hex.substr(3, 2), 16),
        b: parseInt(hex.substr(5, 2), 16),
    };
});

// Nhận một màu ngẫu nhiên.
function randomColorSimple() {
    return COLOR_CODES[Math.random() * COLOR_CODES.length | 0];
}

// Nhận màu ngẫu nhiên, với một số tùy chọn tùy chỉnh có sẵn.
let lastColor;
function randomColor(options) {
    const notSame = options && options.notSame;
    const notColor = options && options.notColor;
    const limitWhite = options && options.limitWhite;
    let color = randomColorSimple();

    // giới hạn số lượng màu trắng được chọn ngẫu nhiên
    if (limitWhite && color === COLOR.White && Math.random() < 0.6) {
        color = randomColorSimple();
    }

    if (notSame) {
        while (color === lastColor) {
            color = randomColorSimple();
        }
    }
    else if (notColor) {
        while (color === notColor) {
            color = randomColorSimple();
        }
    }

    lastColor = color;
    return color;
}

function whiteOrGold() {
    return Math.random() < 0.5 ? COLOR.Gold : COLOR.White;
}


// Người trợ giúp vỏ
function makePistilColor(shellColor) {
    return (shellColor === COLOR.White || shellColor === COLOR.Gold) ? randomColor({ notColor: shellColor }) : whiteOrGold();
}

// Các loại vỏ độc đáo
const crysanthemumShell = (size = 1) => {
    const glitter = Math.random() < 0.25;
    const singleColor = Math.random() < 0.72;
    const color = singleColor ? randomColor({ limitWhite: true }) : [randomColor(), randomColor({ notSame: true })];
    const pistil = singleColor && Math.random() < 0.42;
    const pistilColor = pistil && makePistilColor(color);
    const secondColor = singleColor && (Math.random() < 0.2 || color === COLOR.White) ? pistilColor || randomColor({ notColor: color, limitWhite: true }) : null;
    const streamers = !pistil && color !== COLOR.White && Math.random() < 0.42;
    let starDensity = glitter ? 1.1 : 1.25;
    if (isLowQuality) starDensity *= 0.8;
    if (isHighQuality) starDensity = 1.2;
    return {
        shellSize: size,
        spreadSize: 300 + size * 100,
        starLife: 900 + size * 200,
        starDensity,
        color,
        secondColor,
        glitter: glitter ? 'light' : '',
        glitterColor: whiteOrGold(),
        pistil,
        pistilColor,
        streamers
    };
};


const ghostShell = (size = 1) => {
    // Mở rộng vỏ crysanthemum
    const shell = crysanthemumShell(size);
    // Hiệu ứng ma có thể nhanh nên kéo dài tuổi thọ của sao
    shell.starLife *= 1.5;
    // Đảm bảo chúng tôi luôn có một màu duy nhất ngoài màu trắng
    let ghostColor = randomColor({ notColor: COLOR.White });
    // Luôn sử dụng dây truyền và đôi khi là nhụy hoa
    shell.streamers = true;
    const pistil = Math.random() < 0.42;
    const pistilColor = pistil && makePistilColor(ghostColor);
    // Hiệu ứng ma quái - chuyển từ màu vô hình sang màu đã chọn
    shell.color = INVISIBLE;
    shell.secondColor = ghostColor;
    // Chúng tôi không muốn những ngôi sao vô hình phun ra ánh sáng lấp lánh và hiện tại chúng tôi cũng không muốn
    // có cách chuyển sang trạng thái long lanh. Vì vậy chúng ta sẽ vô hiệu hóa nó.
    shell.glitter = '';

    return shell;
};


const strobeShell = (size = 1) => {
    const color = randomColor({ limitWhite: true });
    return {
        shellSize: size,
        spreadSize: 280 + size * 92,
        starLife: 1100 + size * 200,
        starLifeVariation: 0.40,
        starDensity: 1.1,
        color,
        glitter: 'light',
        glitterColor: COLOR.White,
        strobe: true,
        strobeColor: Math.random() < 0.5 ? COLOR.White : null,
        pistil: Math.random() < 0.5,
        pistilColor: makePistilColor(color)
    };
};


const palmShell = (size = 1) => {
    const color = randomColor();
    const thick = Math.random() < 0.5;
    return {
        shellSize: size,
        color,
        spreadSize: 250 + size * 75,
        starDensity: thick ? 0.15 : 0.4,
        starLife: 1800 + size * 200,
        glitter: thick ? 'thick' : 'heavy'
    };
};

const ringShell = (size = 1) => {
    const color = randomColor();
    const pistil = Math.random() < 0.75;
    return {
        shellSize: size,
        ring: true,
        color,
        spreadSize: 300 + size * 100,
        starLife: 900 + size * 200,
        starCount: 2.2 * PI_2 * (size + 1),
        pistil,
        pistilColor: makePistilColor(color),
        glitter: !pistil ? 'light' : '',
        glitterColor: color === COLOR.Gold ? COLOR.Gold : COLOR.White,
        streamers: Math.random() < 0.3
    };
    // return Object.sign({}, defaultShell, config);
};

const crossetteShell = (size = 1) => {
    const color = randomColor({ limitWhite: true });
    return {
        shellSize: size,
        spreadSize: 300 + size * 100,
        starLife: 750 + size * 160,
        starLifeVariation: 0.4,
        starDensity: 0.85,
        color,
        crossette: true,
        pistil: Math.random() < 0.5,
        pistilColor: makePistilColor(color)
    };
};

const floralShell = (size = 1) => ({
    shellSize: size,
    spreadSize: 300 + size * 120,
    starDensity: 0.12,
    starLife: 500 + size * 50,
    starLifeVariation: 0.5,
    color: Math.random() < 0.65 ? 'random' : (Math.random() < 0.15 ? randomColor() : [randomColor(), randomColor({ notSame: true })]),
    floral: true
});

const fallingLeavesShell = (size = 1) => ({
    shellSize: size,
    color: INVISIBLE,
    spreadSize: 300 + size * 120,
    starDensity: 0.12,
    starLife: 500 + size * 50,
    starLifeVariation: 0.5,
    glitter: 'medium',
    glitterColor: COLOR.Gold,
    fallingLeaves: true
});

const willowShell = (size = 1) => ({
    shellSize: size,
    spreadSize: 300 + size * 100,
    starDensity: 0.7,
    starLife: 3000 + size * 300,
    glitter: 'willow',
    glitterColor: COLOR.Gold,
    color: COLOR.Gold,
    comet: true
});

const crackleShell = (size = 1) => {
    // ủng hộ vàng
    const color = Math.random() < 0.75 ? COLOR.Gold : randomColor();
    return {
        shellSize: size,
        spreadSize: 380 + size * 75,
        starDensity: isLowQuality ? 0.65 : 1,
        starLife: 600 + size * 100,
        starLifeVariation: 0.32,
        glitter: 'light',
        glitterColor: COLOR.Gold,
        color,
        crackle: true,
        pistil: Math.random() < 0.65,
        pistilColor: makePistilColor(color)
    };
};

const horsetailShell = (size = 1) => {
    const color = randomColor();
    return {
        shellSize: size,
        horsetail: true,
        color,
        spreadSize: 250 + size * 38,
        starDensity: 0.9,
        starLife: 2500 + size * 300,
        glitter: 'medium',
        glitterColor: Math.random() < 0.5 ? whiteOrGold() : color,
        // Thêm hiệu ứng nhấp nháy vào đuôi ngựa màu trắng để làm cho chúng thú vị hơn
        strobe: color === COLOR.White
    };
};

function randomShellName() {
    return Math.random() < 0.5 ? 'Hoa cúc' : shellNames[(Math.random() * (shellNames.length - 1) + 1) | 0];
}

function randomShell(size) {
    // Lựa chọn đặc biệt cho tiêu đề.
    if (IS_HEADER) return randomFastShell()(size);
    // Hoạt động bình thường
    return shellTypes[randomShellName()](size);
}

function shellFromConfig(size) {
    return shellTypes[shellNameSelector()](size);
}

// Nhận một shell ngẫu nhiên, không bao gồm việc xử lý các biến thể chuyên sâu
// Lưu ý rằng điều này chỉ ngẫu nhiên khi shell "Ngẫu nhiên" được chọn trong config.
// Ngoài ra, điều này không tạo ra shell, chỉ trả về hàm xuất xưởng.
const fastShellBlacklist = ['Lá rơi', 'Hoa', 'Liễu'];
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



// ---- Tùy chỉnh Hình dạng ----
const textCanvas = document.createElement('canvas');
const textCtx = textCanvas.getContext('2d', { willReadFrequently: true });

function getTextParticles(text, fontSize = 80) {
    textCanvas.width = 1000; // Tăng chiều rộng để hỗ trợ văn bản dài hơn
    textCanvas.height = 200; // Tăng chiều cao
    textCtx.clearRect(0, 0, textCanvas.width, textCanvas.height);
    textCtx.font = `bold ${fontSize}px Roboto, sans-serif`;
    textCtx.fillStyle = 'white';
    textCtx.textAlign = 'center';
    textCtx.textBaseline = 'middle';
    textCtx.fillText(text, textCanvas.width / 2, textCanvas.height / 2);

    const imgData = textCtx.getImageData(0, 0, textCanvas.width, textCanvas.height).data;
    const points = [];
    const step = 3; // Giảm bước nhảy xuống 3 để tăng độ chi tiết (Chi tiết gấp đôi so với 6)

    let minX = textCanvas.width, maxX = 0, minY = textCanvas.height, maxY = 0;
    for (let y = 0; y < textCanvas.height; y += step) {
        for (let x = 0; x < textCanvas.width; x += step) {
            const index = (y * textCanvas.width + x) * 4;
            const alpha = imgData[index + 3];
            if (alpha > 128) {
                points.push({ x, y });
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        }
    }

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const maxDist = Math.max(maxX - minX, maxY - minY) / 2 || 1;

    const result = points.map(p => ({
        x: (p.x - centerX) / maxDist,
        y: (p.y - centerY) / maxDist
    }));

    result.isText = true; // Đánh dấu đây là dữ liệu văn bản
    return result;
}

const imageParticleCache = new Map();

function getProcessedImage(img, frame = '') {
    const size = 500; // Độ phân giải cao hơn cho hình ảnh phóng to
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (frame) {
        ctx.save();
        ctx.beginPath();
        if (frame === 'circle') {
            ctx.arc(size / 2, size / 2, size / 2, 0, PI_2);
        } else if (frame === 'square') {
            ctx.rect(0, 0, size, size);
        } else if (frame === 'triangle') {
            ctx.moveTo(size / 2, 0);
            ctx.lineTo(size, size);
            ctx.lineTo(0, size);
            ctx.closePath();
        } else if (frame === 'heart') {
            const x = size / 2, y = size / 2, r = size / 2.2;
            ctx.moveTo(x, y + r / 4);
            ctx.bezierCurveTo(x, y, x - r / 2, y - r / 2, x - r, y - r / 4);
            ctx.bezierCurveTo(x - r, y + r / 4, x, y + r, x, y + r);
            ctx.bezierCurveTo(x, y + r, x + r, y + r / 4, x + r, y - r / 4);
            ctx.bezierCurveTo(x + r, y - r / 2, x, y, x, y + r / 4);
        }
        ctx.clip();
    }

    ctx.drawImage(img, 0, 0, size, size);
    if (frame) ctx.restore();
    return canvas;
}

function drawFramePath(ctx, x, y, size, frame) {
    ctx.beginPath();
    const r = size / 2;
    if (frame === 'circle') {
        ctx.arc(x, y, r, 0, PI_2);
    } else if (frame === 'square') {
        ctx.rect(x - r, y - r, size, size);
    } else if (frame === 'triangle') {
        ctx.moveTo(x, y - r);
        ctx.lineTo(x + r, y + r);
        ctx.lineTo(x - r, y + r);
        ctx.closePath();
    } else if (frame === 'heart') {
        ctx.save();
        ctx.translate(x, y);
        ctx.beginPath();
        // Phương thức vẽ trái tim chuẩn hơn (Heart curve)
        for (let t = 0; t <= Math.PI * 2; t += 0.1) {
            const hx = 16 * Math.pow(Math.sin(t), 3);
            const hy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
            const scaleFactor = size / 35;
            if (t === 0) ctx.moveTo(hx * scaleFactor, hy * scaleFactor);
            else ctx.lineTo(hx * scaleFactor, hy * scaleFactor);
        }
        ctx.closePath();
        ctx.restore();
    }
}

class ImageBurst {
    constructor(x, y, img, size, frame, color) {
        this.x = x;
        this.y = y;
        this.img = img;
        this.frame = frame;
        this.color = color;
        this.maxSize = size * 500; // Tỷ lệ hóa size
        this.totalLife = 2000; // 2 giây hiển thị
        this.life = this.totalLife;
    }

    static active = [];

    static updateAll(timeStep) {
        for (let i = this.active.length - 1; i >= 0; i--) {
            const b = this.active[i];
            b.life -= timeStep;
            if (b.life <= 0) this.active.splice(i, 1);
        }
    }

    static drawAll(ctx) {
        this.active.forEach(b => {
            const progress = 1 - (b.life / b.totalLife);
            // Sử dụng easeOut để hiệu ứng phóng to mượt mà hơn
            const easeProgress = 1 - Math.pow(1 - progress, 3);
            const scale = (0.1 + easeProgress * 0.9) * b.maxSize;
            const opacity = 1 - Math.pow(progress, 2); // Mờ dần nhanh hơn ở cuối

            ctx.save();
            ctx.globalAlpha = opacity;
            
            // Vẽ khung màu nếu có
            if (b.color && b.color !== INVISIBLE) {
                ctx.strokeStyle = b.color;
                ctx.lineWidth = Math.max(3, scale * 0.02);
                drawFramePath(ctx, b.x, b.y, scale, b.frame);
                ctx.stroke();
            }

            ctx.drawImage(b.img, b.x - scale / 2, b.y - scale / 2, scale, scale);
            ctx.restore();
        });
    }
}

function getHeartPoints() {
    const points = [];
    const count = 120;
    for (let i = 0; i < count; i++) {
        const t = (i / count) * Math.PI * 2;
        const x = 16 * Math.pow(Math.sin(t), 3);
        const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
        points.push({ x, y });
    }
    let maxDist = 0;
    for (let p of points) maxDist = Math.max(maxDist, Math.abs(p.x), Math.abs(p.y));
    return points.map(p => ({ x: p.x / maxDist, y: p.y / maxDist }));
}

function getStarPoints() {
    const points = [];
    const spikes = 5;
    const outerRadius = 1;
    const innerRadius = 0.4;
    let rot = Math.PI / 2 * 3;
    let x = 0, y = 0;
    const step = Math.PI / spikes;
    const vertexes = [];
    for (let i = 0; i < spikes; i++) {
        x = Math.cos(rot) * outerRadius;
        y = Math.sin(rot) * outerRadius;
        vertexes.push({ x, y });
        rot += step;
        x = Math.cos(rot) * innerRadius;
        y = Math.sin(rot) * innerRadius;
        vertexes.push({ x, y });
        rot += step;
    }
    for (let i = 0; i < vertexes.length; i++) {
        let p1 = vertexes[i];
        let p2 = vertexes[(i + 1) % vertexes.length];
        const segments = 15;
        for (let j = 0; j < segments; j++) {
            points.push({
                x: p1.x + (p2.x - p1.x) * (j / segments),
                y: p1.y + (p2.y - p1.y) * (j / segments)
            });
        }
    }
    return points;
}

function getSmileyPoints() {
    const points = [];
    const segments = 60;
    for (let i = 0; i < segments; i++) {
        const t = (i / segments) * Math.PI * 2;
        points.push({ x: Math.cos(t) * 0.9, y: Math.sin(t) * 0.9 });
    }
    points.push({ x: -0.3, y: -0.3 });
    points.push({ x: -0.3, y: -0.35 });
    points.push({ x: 0.3, y: -0.3 });
    points.push({ x: 0.3, y: -0.35 });
    const smileSegments = 30;
    for (let i = 0; i <= smileSegments; i++) {
        const t = Math.PI * 0.2 + (i / smileSegments) * Math.PI * 0.6;
        points.push({ x: Math.cos(t) * 0.6, y: Math.sin(t) * 0.6 });
    }
    return points;
}

function getCatPoints() {
    const points = [];
    const segments = 50;
    for (let i = 0; i < segments; i++) {
        const t = (i / segments) * Math.PI * 2;
        points.push({ x: Math.cos(t) * 0.8, y: Math.sin(t) * 0.8 });
    }
    for (let i = 0; i <= 10; i++) {
        points.push({ x: -0.8 + (0.2) * i / 10, y: -0.3 - 0.7 * i / 10 });
        points.push({ x: -0.6 + (0.4) * i / 10, y: -1.0 + 0.5 * i / 10 });
        points.push({ x: 0.8 - (0.2) * i / 10, y: -0.3 - 0.7 * i / 10 });
        points.push({ x: 0.6 - (0.4) * i / 10, y: -1.0 + 0.5 * i / 10 });
    }
    points.push({ x: -0.3, y: -0.1 });
    points.push({ x: 0.3, y: -0.1 });
    for (let i = 0; i <= 5; i++) {
        points.push({ x: -0.5 - 0.4 * i / 5, y: 0.1 + 0.1 * i / 5 });
        points.push({ x: -0.5 - 0.4 * i / 5, y: 0.2 });
        points.push({ x: -0.5 - 0.4 * i / 5, y: 0.3 - 0.1 * i / 5 });
        points.push({ x: 0.5 + 0.4 * i / 5, y: 0.1 + 0.1 * i / 5 });
        points.push({ x: 0.5 + 0.4 * i / 5, y: 0.2 });
        points.push({ x: 0.5 + 0.4 * i / 5, y: 0.3 - 0.1 * i / 5 });
    }
    return points;
}

function getLeafPoints(petals = 4) {
    const points = [];
    for (let p = 0; p < petals; p++) {
        // Xoay để có một cánh ở trên cùng cho cỏ 3 lá, hoặc căn giữa cho cỏ 4 lá
        const angleOffset = (p / petals) * Math.PI * 2 - (petals === 3 ? Math.PI / 2 : 0);

        for (let i = 0; i < 40; i++) {
            const t = (i / 40) * Math.PI * 2;
            // Công thức hình trái tim
            let x = 16 * Math.pow(Math.sin(t), 3);
            let y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));

            // Chuẩn hóa và tỷ lệ lá
            x /= 18;
            y /= 18;

            // Di chuyển để cuống lá ở gần tâm
            y -= 0.8;

            // Tỷ lệ từng lá riêng lẻ
            x *= 0.45;
            y *= 0.45;

            // Xoay lá
            const cosA = Math.cos(angleOffset);
            const sinA = Math.sin(angleOffset);
            points.push({
                x: x * cosA - y * sinA,
                y: x * sinA + y * cosA
            });
        }
    }
    // Không cần thân cây theo yêu cầu người dùng
    return points;
}

function getCloverPoints() {
    return getLeafPoints(4);
}

function getClover3Points() {
    return getLeafPoints(3);
}

function getSaturnPoints() {
    const points = [];
    for (let i = 0; i < 60; i++) {
        const t = (i / 60) * Math.PI * 2;
        points.push({ x: Math.cos(t) * 0.4, y: Math.sin(t) * 0.4 });
    }
    for (let i = 0; i < 90; i++) {
        const t = (i / 90) * Math.PI * 2;
        points.push({ x: Math.cos(t) * 1.0, y: Math.sin(t) * 0.25 });
    }
    return points;
}

function getSnowflakePoints() {
    const points = [];
    const arms = 6;

    // Lõi trung tâm
    for (let i = 0; i < 30; i++) {
        const t = (i / 30) * Math.PI * 2;
        points.push({ x: Math.cos(t) * 0.1, y: Math.sin(t) * 0.1 });
    }

    for (let i = 0; i < arms; i++) {
        const angle = (i / arms) * Math.PI * 2;
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);

        // Cánh chính
        for (let j = 1; j <= 25; j++) {
            const r = j / 25;
            points.push({ x: cosA * r, y: sinA * r });

            // Các nhánh phụ (V-shape)
            if (j === 12 || j === 18 || j === 22) {
                const branchLen = j === 12 ? 0.25 : (j === 18 ? 0.18 : 0.12);
                const branchAngle = Math.PI / 3;
                for (let k = 1; k <= 8; k++) {
                    const brR = (k / 8) * branchLen;
                    // Nhánh phải
                    const rA = angle + branchAngle;
                    points.push({ x: cosA * r + Math.cos(rA) * brR, y: sinA * r + Math.sin(rA) * brR });
                    // Nhánh trái
                    const lA = angle - branchAngle;
                    points.push({ x: cosA * r + Math.cos(lA) * brR, y: sinA * r + Math.sin(lA) * brR });
                }
            }
        }
    }
    return points;
}

function getLotusPoints() {
    const points = [];
    const petals = 12;
    for (let p = 0; p < petals; p++) {
        const angleOffset = (p / petals) * Math.PI * 2;
        const layer = p % 2 === 0 ? 0.8 : 0.5;
        for (let i = 0; i <= 20; i++) {
            const t = (i / 20) * Math.PI;
            const r = Math.sin(t) * layer;
            const angle = angleOffset + (t - Math.PI / 2) * 0.5;
            points.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });
        }
    }
    return points;
}

function getButterflyPoints() {
    const points = [];
    for (let i = 0; i <= 100; i++) {
        const t = (i / 100) * Math.PI * 2;
        const x = Math.sin(t) * (Math.exp(Math.cos(t)) - 2 * Math.cos(4 * t) - Math.pow(Math.sin(t / 12), 5));
        const y = -Math.cos(t) * (Math.exp(Math.cos(t)) - 2 * Math.cos(4 * t) - Math.pow(Math.sin(t / 12), 5));
        points.push({ x: x * 0.3, y: y * 0.3 });
    }
    return points;
}

function getDiamondPoints() {
    const points = [];
    const drawLine = (x1, y1, x2, y2, density = 15) => {
        for (let i = 0; i <= density; i++) {
            points.push({
                x: x1 + (x2 - x1) * (i / density),
                y: y1 + (y2 - y1) * (i / density)
            });
        }
    };

    // Đường viền và các mặt (Facets)
    drawLine(-0.35, -0.6, 0.35, -0.6); // Mặt bàn (Top table)
    drawLine(-0.35, -0.6, -0.7, -0.2); // Vương miện trái (Left crown)
    drawLine(0.35, -0.6, 0.7, -0.2);  // Vương miện phải (Right crown)
    drawLine(-0.7, -0.2, 0.7, -0.2);  // Thắt lưng (Girdle)
    drawLine(-0.7, -0.2, 0, 0.8);     // Đáy trái (Left pavilion)
    drawLine(0.7, -0.2, 0, 0.8);      // Đáy phải (Right pavilion)

    // Các đường cắt giác bên trong
    drawLine(-0.35, -0.6, 0, -0.2, 10);
    drawLine(0.35, -0.6, 0, -0.2, 10);
    drawLine(0, -0.6, 0, 0.8, 20);      // Trục giữa dọc
    drawLine(-0.7, -0.2, 0, -0.2, 10);
    drawLine(0.7, -0.2, 0, -0.2, 10);
    drawLine(0, -0.2, 0, 0.8, 15);      // Đường đáy giữa

    return points;
}

const heartShell = (size = 1) => {
    const color = randomColor();
    return {
        shellSize: size,
        color,
        spreadSize: 300 + size * 100,
        starLife: 1000 + size * 200,
        starLifeVariation: 0.2,
        shapePoints: getHeartPoints(),
        glitter: 'light',
        glitterColor: COLOR.White,
    };
};

const starShapeShell = (size = 1) => {
    const color = randomColor();
    return {
        shellSize: size,
        color,
        spreadSize: 350 + size * 100,
        starLife: 1200 + size * 200,
        shapePoints: getStarPoints(),
        glitter: 'light',
        glitterColor: COLOR.Gold,
    };
};

const smileyShell = (size = 1) => {
    const color = randomColor();
    return {
        shellSize: size,
        color,
        spreadSize: 300 + size * 100,
        starLife: 1200 + size * 200,
        shapePoints: getSmileyPoints(),
        glitter: 'light',
        glitterColor: color,
    };
};

const catShell = (size = 1) => {
    const color = randomColor();
    return {
        shellSize: size,
        color,
        spreadSize: 350 + size * 100,
        starLife: 1200 + size * 200,
        shapePoints: getCatPoints(),
        glitter: 'light',
        glitterColor: color,
    };
};

const textShell = (size = 1) => {
    const color = randomColor();
    let textStr = store.state.config.customText || '';
    let text = '';

    if (!textStr.trim()) {
        text = 'HAPPY';
    } else {
        // Tách chuỗi bằng dấu phẩy và chọn ngẫu nhiên một phần tử
        const parts = textStr.split(',').map(s => s.trim()).filter(s => s.length > 0);
        text = parts[(Math.random() * parts.length) | 0];
    }

    return {
        shellSize: size,
        color,
        spreadSize: 300 + size * 100, // Thêm spreadSize để tránh lỗi NaN
        starLife: 1400 + size * 200,
        shapePoints: getTextParticles(text, 50),
        glitter: 'light',
        glitterColor: COLOR.Gold,
    };
};

const clover3Shell = (size = 1) => {
    const color = COLOR.Green;
    return {
        shellSize: size,
        color,
        spreadSize: 300 + size * 100,
        starLife: 1200 + size * 200,
        shapePoints: getClover3Points(),
        glitter: 'light',
        glitterColor: COLOR.White,
    };
};

const cloverShell = (size = 1) => {
    const color = COLOR.Green;
    return {
        shellSize: size,
        color,
        spreadSize: 300 + size * 100,
        starLife: 1200 + size * 200,
        shapePoints: getCloverPoints(),
        glitter: 'light',
        glitterColor: COLOR.White,
    };
};

const saturnShell = (size = 1) => {
    const color = COLOR.Gold;
    return {
        shellSize: size,
        color,
        spreadSize: 400 + size * 100,
        starLife: 1500 + size * 200,
        shapePoints: getSaturnPoints(),
        glitter: 'light',
        glitterColor: COLOR.White,
    };
};

const snowflakeShell = (size = 1) => {
    const color = COLOR.White;
    return {
        shellSize: size,
        color,
        spreadSize: 350 + size * 100,
        starLife: 1500 + size * 200,
        shapePoints: getSnowflakePoints(),
        glitter: 'light',
        glitterColor: COLOR.Blue,
    };
};

const lotusShell = (size = 1) => {
    const color = Math.random() < 0.5 ? COLOR.Purple : COLOR.Red;
    return {
        shellSize: size,
        color,
        spreadSize: 350 + size * 100,
        starLife: 1500 + size * 200,
        shapePoints: getLotusPoints(),
        glitter: 'light',
        glitterColor: COLOR.Gold,
    };
};

const butterflyShell = (size = 1) => {
    const color = randomColor();
    return {
        shellSize: size,
        color,
        spreadSize: 300 + size * 100,
        starLife: 1500 + size * 200,
        shapePoints: getButterflyPoints(),
        glitter: 'light',
        glitterColor: COLOR.White,
    };
};

const diamondShell = (size = 1) => {
    const color = randomColor();
    return {
        shellSize: size,
        color,
        spreadSize: 300 + size * 100,
        starLife: 1200 + size * 200,
        shapePoints: getDiamondPoints(),
        glitter: 'heavy',
        glitterColor: COLOR.White,
    };
};

const imageShell = (size = 1) => {
    return {
        shell: 'Hình ảnh',
        shellSize: size,
        spreadSize: 300 + size * 100,
        starLife: 2000,
        glitter: 'light'
    };
};

const shellTypes = {
    'Ngẫu nhiên': randomShell,
    'Trái tim': heartShell,
    'Ngôi sao': starShapeShell,
    'Hình ảnh': imageShell,
    'Mặt mèo': catShell,
    'Mặt cười': smileyShell,
    'Văn bản': textShell,
    'Cỏ 3 lá': clover3Shell,
    'Cỏ 4 lá': cloverShell,
    'Hành tinh': saturnShell,
    'Bông tuyết': snowflakeShell,
    'Bông sen': lotusShell,
    'Con bướm': butterflyShell,
    'Kim cương': diamondShell,
    'Nổ lách tách': crackleShell,
    'Nổ chéo': crossetteShell,
    'Hoa cúc': crysanthemumShell,
    'Lá rơi': fallingLeavesShell,
    'Lá rụng': fallingLeavesShell,
    'Hoa': floralShell,
    'Ma': ghostShell,
    'Đuôi ngựa': horsetailShell,
    'Cây cọ': palmShell,
    'Vòng nhẫn': ringShell,
    'Nhấp nháy': strobeShell,
    'Liễu': willowShell
};

const shellNames = Object.keys(shellTypes);

function getLunarYearName(year) {
    const cans = ["Canh", "Tân", "Nhâm", "Quý", "Giáp", "Ất", "Bính", "Đinh", "Mậu", "Kỷ"];
    const chis = ["Thân", "Dậu", "Tuất", "Hợi", "Tí", "Sửu", "Dần", "Mão", "Thìn", "Tỵ", "Ngọ", "Mùi"];
    return `${cans[year % 10]} ${chis[year % 12]}`;
}

function replacePlaceholders(text) {
    if (typeof text !== 'string') return text;
    const now = new Date();
    const year = now.getFullYear();
    return text
        .replace(/\[YEAR\]/g, year)
        .replace(/\[LUNAR_YEAR\]/g, getLunarYearName(year).toUpperCase())
        .replace(/\[SINCE:(\d+)\]/g, (match, p1) => {
            return year - parseInt(p1);
        });
}

window.preloadFireworkImage = (url, frame) => {
    if (!url) return;
    const normalizedUrl = normalizeAssetPath(url);
    const cacheKey = `${normalizedUrl}_${frame || ''}`;
    if (!imageParticleCache.has(cacheKey)) {
        console.log('[Firework] Preloading image:', normalizedUrl);
        const img = new Image();
        // img.crossOrigin = "Anonymous"; // Bỏ cái này nếu gặp lỗi CORS trên localhost
        img.onload = () => {
            console.log('[Firework] Image loaded successfully:', normalizedUrl);
            const processed = getProcessedImage(img, frame);
            imageParticleCache.set(cacheKey, processed);
        };
        img.onerror = (e) => {
            console.error('[Firework] Failed to load image:', normalizedUrl, e);
        };
        img.src = normalizedUrl;
    }
};

function normalizeAssetPath(path) {
    if (!path) return path;
    const isDist = window.location.pathname.includes('/dist/') || !window.location.port || window.location.port === '80';
    
    // Xử lý đường dẫn tương đối
    let cleanPath = path.replace(/^\.\//, '');
    
    if (isDist) {
        // Trong dist, nếu đường dẫn có 'src/assets/', chuyển thành 'assets/'
        if (cleanPath.startsWith('src/assets/')) {
            cleanPath = cleanPath.replace('src/assets/', 'assets/');
        }
        // Luôn đảm bảo không có 'dist/' lặp lại trong đường dẫn nếu ta đã ở trong dist
        return './' + cleanPath.replace(/^dist\//, '');
    } else {
        // Trong dev (src), đảm bảo có 'src/assets/' nếu nó trỏ vào assets
        if (cleanPath.startsWith('assets/') && !cleanPath.startsWith('src/assets/')) {
            cleanPath = 'src/' + cleanPath;
        }
        return './' + cleanPath;
    }
}

async function loadBurstConfig() {
    const urlParams = new URLSearchParams(window.location.search);
    const configName = urlParams.get('config');
    if (!configName) return;

    try {
        const isStaticEnv = window.location.hostname.includes('github.io') || 
                            window.location.hostname.includes('vercel.app') || 
                            window.location.hostname.includes('netlify.app') || 
                            window.location.protocol === 'file:';

        let config;
        if (isStaticEnv) {
            const localScripts = JSON.parse(localStorage.getItem('my_firework_scripts') || '{}');
            if (localScripts[configName]) {
                config = localScripts[configName];
            }
        }

        if (!config) {
            const response = await fetch(`./static/configs/${configName}.json`);
            if (!response.ok) throw new Error('Config not found');
            config = await response.json();
        }

        burstConfig = config;

        
        // Background support
        if (burstConfig.background) {
            appNodes.backgroundImage.style.backgroundImage = `url(${burstConfig.background})`;
        } else {
            appNodes.backgroundImage.style.backgroundImage = ''; // Use default from CSS
        }
        
        if (burstConfig.showBackground !== undefined) {
            store.setState({ config: { ...store.state.config, showBackground: !!burstConfig.showBackground } });
        }

        // Xử lý các placeholder trong text
        if (burstConfig.title) burstConfig.title = replacePlaceholders(burstConfig.title);
        if (burstConfig.subtitle) burstConfig.subtitle = replacePlaceholders(burstConfig.subtitle);
        if (burstConfig.events) {
            const imagePromises = [];
            burstConfig.events.forEach(event => {
                if (event.text) event.text = replacePlaceholders(event.text);
                
                if (event.shell === 'Hình ảnh' && event.imageUrl) {
                    const normalizedUrl = normalizeAssetPath(event.imageUrl);
                    const cacheKey = `${normalizedUrl}_${event.frame || ''}`;
                    if (!imageParticleCache.has(cacheKey)) {
                        const p = new Promise(resolve => {
                            const img = new Image();
                            img.crossOrigin = "Anonymous";
                            img.onload = () => {
                                const processed = getProcessedImage(img, event.frame);
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
            if (imagePromises.length > 0) {
                setLoadingStatus('Đang chuẩn bị hình ảnh...');
                await Promise.all(imagePromises);
            }
        }

        console.log('Loaded burst config:', burstConfig);

        // Cập nhật tiêu đề trang (SEO) nếu có
        if (burstConfig.seoTitle) {
            document.title = burstConfig.seoTitle;
        } else if (burstConfig.title) {
            document.title = `${burstConfig.title} | Trình mô phỏng Pháo hoa`;
        }

        // Hiển thị overlay thông tin nếu có
        if (burstConfig.title || burstConfig.author) {
            const overlay = document.createElement('div');
            overlay.className = 'config-overlay';
            overlay.innerHTML = `
                ${burstConfig.title ? `<h1>${burstConfig.title}</h1>` : ''}
                ${burstConfig.subtitle ? `<h2>${burstConfig.subtitle}</h2>` : ''}
                ${burstConfig.author ? `<p>${burstConfig.author}</p>` : ''}
            `;
            document.body.appendChild(overlay);
            setTimeout(() => overlay.classList.add('fade-out'), 5000);
            setTimeout(() => overlay.remove(), 7000);
        }
    } catch (e) {
        console.error('Error loading burst config:', e);
    }
}

async function init() {
    // Xóa trạng thái tải
    appNodes.loadingInit.remove();
    appNodes.stageContainer.classList.remove('remove');

    // Điền vào danh sách thả xuống
    function setOptionsForSelect(node, options) {
        node.innerHTML = options.reduce((acc, opt) => acc += `<option value="${opt.value}">${opt.label}</option>`, '');
    }

    // loại vỏ
    let checkboxes = '';
    shellNames.forEach(opt => checkboxes += `
        <label>
            <input type="checkbox" name="shellType" value="${opt}">
            ${opt}
        </label>`);
    appNodes.shellType.innerHTML = checkboxes;
    // kích thước vỏ
    let options = '';
    ['3"', '4"', '6"', '8"', '12"', '16"'].forEach((opt, i) => options += `<option value="${i}">${opt}</option>`);
    appNodes.shellSize.innerHTML = options;

    setOptionsForSelect(appNodes.quality, [
        { label: 'Low', value: QUALITY_LOW },
        { label: 'Normal', value: QUALITY_NORMAL },
        { label: 'High', value: QUALITY_HIGH }
    ]);

    setOptionsForSelect(appNodes.skyLighting, [
        { label: 'None', value: SKY_LIGHT_NONE },
        { label: 'Dim', value: SKY_LIGHT_DIM },
        { label: 'Normal', value: SKY_LIGHT_NORMAL }
    ]);

    // 0.9 là mặc định trên thiết bị di động
    setOptionsForSelect(
        appNodes.scaleFactor,
        [0.5, 0.62, 0.75, 0.9, 1.0, 1.5, 2.0]
            .map(value => ({ value: value.toFixed(2), label: `${value * 100}%` }))
    );

    // Bắt đầu mô phỏng
    togglePause(false);

    // kết xuất ban đầu
    renderApp(store.state);

    // Áp dụng cấu hình ban đầu
    configDidUpdate();

    // Load burst config từ URL
    await loadBurstConfig();
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
    
    const x = event ? event.x / mainStage.width : getRandomShellPositionH();
    const y = event ? 1 - event.y / mainStage.height : getRandomShellPositionV();
    
    const shellProps = shellTypes[shellName](size);
    // Nếu là hình ảnh nổ thủ công, ta thử lấy ảnh từ kịch bản hiện tại nếu có
    if (shellName === 'Hình ảnh' && !shellProps.imageUrl) {
        const firstImgEvent = (burstConfig.events || []).find(e => e.shell === 'Hình ảnh' && e.imageUrl);
        if (firstImgEvent) {
            shellProps.imageUrl = firstImgEvent.imageUrl;
            shellProps.frame = firstImgEvent.frame;
            shellProps.color = firstImgEvent.color;
        }
    }
    
    const shell = new Shell(shellProps);
    shell.launch(x, y);
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
function startSequence() {
    // Kiểm tra burst config nếu có
    if (burstConfig && burstConfig.events) {
        burstCounter++;

        // Tìm burst lớn nhất để biết khi nào kết thúc/lặp lại
        const burstValues = burstConfig.events.map(e => Number(e.burst)).filter(v => !isNaN(v));
        const maxBurst = burstValues.length > 0 ? Math.max(...burstValues) : 0;

        console.log(`[Firework] Sequence status: Counter=${burstCounter}, MaxBurst=${maxBurst}, EventsCount=${burstConfig.events.length}`);

        // Nếu vượt quá đợt cuối
        if (burstCounter > maxBurst) {
            if (burstConfig.loop) {
                burstCounter = 0; // Reset về 0
                console.log('[Firework] Loop active: Resetting to start.');
                return 2000; // Nghỉ 2 giây trước khi lặp lại
            } else {
                console.log('[Firework] Sequence finished.');
                return 5000;
            }
        }

        const events = burstConfig.events.filter(e => Number(e.burst) === burstCounter);
        console.log(`[Firework] Firing ${events.length} events for burst ${burstCounter}`);

        if (events.length > 0) {
            let extraDelay = 0;
            events.forEach(event => {
                if (event.shell === 'Tạm dừng') {
                    extraDelay = Math.max(extraDelay, event.duration || 2000);
                    return;
                }

                const launch = () => {
                    let shell;
                    const size = event.size !== undefined ? event.size : shellSizeSelector();

                    if (event.shell === 'Văn bản' && event.text) {
                        let finalColor;
                        if (Array.isArray(event.color)) {
                            finalColor = event.color.map(c => COLOR[c] || c);
                        } else {
                            finalColor = (event.color && COLOR[event.color]) || event.color || randomColor();
                        }

                        shell = new Shell({
                            shellSize: size,
                            color: finalColor,
                            spreadSize: 300 + size * 100,
                            starLife: 1400 + size * 200,
                            shapePoints: getTextParticles(event.text, 50),
                            glitter: 'light',
                            glitterColor: COLOR.Gold
                        });
                    } else if (event.shell === 'Hình ảnh' && event.imageUrl) {
                        shell = new Shell({
                            shell: 'Hình ảnh',
                            imageUrl: event.imageUrl,
                            frame: event.frame,
                            size: size,
                            color: event.color,
                            spreadSize: event.spreadSize || (300 + size * 100)
                        });
                    } else {
                        const shellType = shellTypes[event.shell] || shellTypes['Văn bản'];
                        shell = new Shell(shellType(size));

                        if (event.text) {
                            shell.shapePoints = getTextParticles(event.text, 50);
                        }

                        if (event.color) {
                            if (Array.isArray(event.color)) {
                                shell.color = event.color.map(c => COLOR[c] || c);
                            } else if (COLOR[event.color]) {
                                shell.color = COLOR[event.color];
                            } else if (event.color === 'Ngẫu nhiên' || event.color === 'random') {
                                shell.color = 'random';
                            } else {
                                shell.color = event.color;
                            }
                        }

                        if (event.glitterColor) {
                            if (Array.isArray(event.glitterColor)) {
                                shell.glitterColor = event.glitterColor.map(c => COLOR[c] || c);
                            } else if (COLOR[event.glitterColor]) {
                                shell.glitterColor = COLOR[event.glitterColor];
                            } else if (event.glitterColor === 'Ngẫu nhiên' || event.glitterColor === 'random') {
                                shell.glitterColor = 'random';
                            } else {
                                shell.glitterColor = event.glitterColor;
                            }
                        }
                    }

                    const x = event.x !== undefined ? event.x : 0.5;
                    const y = event.y !== undefined ? event.y : 0.5;

                    // Ghi đè các thuộc tính nâng cao từ event nếu có
                    const overrides = [
                        'strobe', 'strobeColor', 'pistil', 'pistilColor',
                        'streamers', 'crossette', 'crackle', 'horsetail',
                        'comet', 'starLife', 'starDensity', 'spreadSize'
                    ];

                    overrides.forEach(prop => {
                        if (event[prop] !== undefined) {
                            if (prop === 'strobeColor' || prop === 'pistilColor') {
                                shell[prop] = COLOR[event[prop]] || event[prop];
                            } else {
                                shell[prop] = event[prop];
                            }
                        }
                    });

                    shell.launch(x, y);
                };

                if (event.delay) {
                    setTimeout(launch, event.delay);
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
            toggleMenu();
            return;
        }
    }

    if (!isRunning()) return;

    if (updateSpeedFromEvent(event)) {
        isUpdatingSpeed = true;
    }
    else if (event.onCanvas) {
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
    // Tính đến quy mô
    const scaleFactor = scaleFactorSelector();
    stageW = containerW / scaleFactor;
    stageH = containerH / scaleFactor;
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
        simSpeed = Math.min(Math.max(newSpeed, 0), 1);
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

    // tự động phóng đạn
    if (store.state.config.autoLaunch) {
        autoLaunchTime -= timeStep;
        if (autoLaunchTime <= 0) {
            autoLaunchTime = startSequence() * 1.25;
        }
    }
}


function update(frameTime, lag) {
    if (!isRunning()) return;

    const width = stageW;
    const height = stageH;
    const timeStep = frameTime * simSpeed;
    const speed = simSpeed * lag;

    updateGlobals(timeStep, lag);
    ImageBurst.updateAll(timeStep);

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
            if (star.life <= 0) {
                stars.splice(i, 1);
                Star.returnInstance(star);
            } else {
                const burnRate = Math.pow(star.life / star.fullLife, 0.5);
                const burnRateInverse = 1 - burnRate;

                star.prevX = star.x;
                star.prevY = star.y;
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
                star.speedY += gAcc;

                if (star.spinRadius) {
                    star.spinAngle += star.spinSpeed * speed;
                    star.x += Math.sin(star.spinAngle) * star.spinRadius * speed;
                    star.y += Math.cos(star.spinAngle) * star.spinRadius * speed;
                }

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
                        stars.splice(i, 1);
                        if (!Star.active[star.secondColor]) Star.active[star.secondColor] = [];
                        Star.active[star.secondColor].push(star);
                        if (star.secondColor === INVISIBLE) {
                            star.sparkFreq = 0;
                        }
                    }

                    if (star.strobe) {
                        star.visible = Math.floor(star.life / star.strobeFreq) % 3 === 0;
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
                sparks.splice(i, 1);
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

function render(speed) {
    const { dpr } = mainStage;
    const width = stageW;
    const height = stageH;
    const trailsCtx = trailsStage.ctx;
    const mainCtx = mainStage.ctx;

    if (skyLightingSelector() !== SKY_LIGHT_NONE) {
        colorSky(speed);
    }

    // Tính đến màn hình có độ phân giải cao và hệ số tỷ lệ tùy chỉnh.
    const scaleFactor = scaleFactorSelector();
    trailsCtx.scale(dpr * scaleFactor, dpr * scaleFactor);
    mainCtx.scale(dpr * scaleFactor, dpr * scaleFactor);

    trailsCtx.globalCompositeOperation = 'source-over';
    trailsCtx.fillStyle = `rgba(0, 0, 0, ${store.state.config.longExposure ? 0.0025 : 0.175 * speed})`;
    trailsCtx.fillRect(0, 0, width, height);

    mainCtx.clearRect(0, 0, width, height);

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
        stars.forEach(star => {
            if (star.visible) {
                trailsCtx.moveTo(star.x, star.y);
                trailsCtx.lineTo(star.prevX, star.prevY);
                mainCtx.moveTo(star.x, star.y);
                mainCtx.lineTo(star.x - star.speedX * 1.6, star.y - star.speedY * 1.6);
            }
        });
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
        sparks.forEach(spark => {
            trailsCtx.moveTo(spark.x, spark.y);
            trailsCtx.lineTo(spark.prevX, spark.prevY);
        });
        trailsCtx.stroke();
    });


    // Vẽ hình ảnh phóng to
    ImageBurst.drawAll(mainCtx);


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


// Trình trợ giúp được sử dụng để phân tán các hạt bán ngẫu nhiên trên một vòng cung
// Các giá trị rất linh hoạt - `start` và `arcLength` có thể âm và `randomness` chỉ đơn giản là một hệ số nhân cho phép cộng ngẫu nhiên.
function createParticleArc(start, arcLength, count, randomness, particleFactory) {
    const angleDelta = arcLength / count;
    // Đôi khi có thêm một phần tử ở cuối, quá gần phần đầu. Trừ một nửa gócDelta đảm bảo rằng nó bị bỏ qua.
    // Sẽ rất tốt nếu khắc phục điều này một cách tốt hơn.
    const end = start + arcLength - (angleDelta * 0.5);

    if (end > start) {
        // Tối ưu hóa: `angle=angle+angleDelta` so với góc+=angleDelta
        // V8 hủy tối ưu hóa bằng phép gán phức hợp let
        for (let angle = start; angle < end; angle = angle + angleDelta) {
            particleFactory(angle + Math.random() * angleDelta * randomness);
        }
    } else {
        for (let angle = start; angle > end; angle = angle + angleDelta) {
            particleFactory(angle + Math.random() * angleDelta * randomness);
        }
    }
}


/**
 * Helper used to create a spherical burst of particles.
 *
 * @param  {Number} count               The desired number of stars/particles. This value is a suggestion, and the
 *                                      created burst may have more particles. The current algorithm can't perfectly
 *                                      distribute a specific number of points evenly on a sphere's surface.
 * @param  {Function} particleFactory   Called once per star/particle generated. Passed two arguments:
 *                                        `angle`: The direction of the star/particle.
 *                                        `speed`: A multipler for the particle speed, from 0.0 to 1.0.
 * @param  {Number} startAngle=0        For segmented bursts, you can generate only a partial arc of particles. This
 *                                      allows setting the starting arc angle (radians).
 * @param  {Number} arcLength=TAU       The length of the arc (radians). Defaults to a full circle.
 *
 * @return {void}              Returns nothing; it's up to `particleFactory` to use the given data.
 */
function createBurst(count, particleFactory, startAngle = 0, arcLength = PI_2) {
    // Giả sử hình cầu có diện tích bề mặt là `count`, hãy tính các
    // thuộc tính của quả cầu nói trên (đơn vị là ngôi sao).
    // Bán kính
    const R = 0.5 * Math.sqrt(count / Math.PI);
    // Đường tròn
    const C = 2 * R * Math.PI;
    // Nửa chu vi
    const C_HALF = C / 2;

    // Tạo một loạt các vòng, kích thước chúng như thể chúng cách đều nhau
    // dọc theo bề mặt cong của hình cầu.
    for (let i = 0; i <= C_HALF; i++) {
        const ringAngle = i / C_HALF * PI_HALF;
        const ringSize = Math.cos(ringAngle);
        const partsPerFullRing = C * ringSize;
        const partsPerArc = partsPerFullRing * (arcLength / PI_2);

        const angleInc = PI_2 / partsPerFullRing;
        const angleOffset = Math.random() * angleInc + startAngle;
        // Mỗi hạt cần một chút ngẫu nhiên để cải thiện hình thức.
        const maxRandomAngleOffset = angleInc * 0.33;

        for (let i = 0; i < partsPerArc; i++) {
            const randomAngleOffset = Math.random() * maxRandomAngleOffset;
            let angle = angleInc * i + angleOffset + randomAngleOffset;
            particleFactory(angle, ringSize);
        }
    }
}

// Hiệu ứng sao khác nhau.
// Chúng được thiết kế để gắn vào sự kiện `onDeath` của một ngôi sao.

// Crossette chia ngôi sao thành bốn mảnh cùng màu, phân nhánh thành hình chữ thập.
function crossetteEffect(star) {
    const startAngle = Math.random() * PI_HALF;
    createParticleArc(startAngle, PI_2, 4, 0.5, (angle) => {
        Star.add(
            star.x,
            star.y,
            star.color,
            angle,
            Math.random() * 0.6 + 0.75,
            600
        );
    });
}

// Hoa giống như một chiếc vỏ nhỏ
function floralEffect(star) {
    const count = 12 + 6 * quality;
    createBurst(count, (angle, speedMult) => {
        Star.add(
            star.x,
            star.y,
            star.color,
            angle,
            speedMult * 2.4,
            1000 + Math.random() * 300,
            star.speedX,
            star.speedY
        );
    });
    // Kết xuất flash hàng đợi
    BurstFlash.add(star.x, star.y, 46);
    soundManager.playSound('burstSmall');
}

// Hoa nở sao liễu
function fallingLeavesEffect(star) {
    createBurst(7, (angle, speedMult) => {
        const newStar = Star.add(
            star.x,
            star.y,
            INVISIBLE,
            angle,
            speedMult * 2.4,
            2400 + Math.random() * 600,
            star.speedX,
            star.speedY
        );

        newStar.sparkColor = COLOR.Gold;
        newStar.sparkFreq = 144 / quality;
        newStar.sparkSpeed = 0.28;
        newStar.sparkLife = 750;
        newStar.sparkLifeVariation = 3.2;
    });
    // Kết xuất flash hàng đợi
    BurstFlash.add(star.x, star.y, 46);
    soundManager.playSound('burstSmall');
}

// Crackle biến thành một đám mây nhỏ có tia lửa vàng.
function crackleEffect(star) {
    const count = isHighQuality ? 32 : 16;
    createParticleArc(0, PI_2, count, 1.8, (angle) => {
        Spark.add(
            star.x,
            star.y,
            COLOR.Gold,
            angle,
            // áp dụng lượng rơi gần khối để tăng tốc độ (đặt nhiều hạt hơn về phía bên ngoài)
            Math.pow(Math.random(), 0.45) * 2.4,
            300 + Math.random() * 200
        );
    });
}



/**
 * Shell can be constructed with options:
 *
 * spreadSize:      Size of the burst.
 * starCount: Number of stars to create. This is optional, and will be set to a reasonable quantity for size if omitted.
 * starLife:
 * starLifeVariation:
 * color:
 * glitterColor:
 * glitter: One of: 'light', 'medium', 'heavy', 'streamer', 'willow'
 * pistil:
 * pistilColor:
 * streamers:
 * crossette:
 * floral:
 * crackle:
 */
class Shell {
    constructor(options) {
        Object.assign(this, options);
        this.starLifeVariation = options.starLifeVariation || 0.125;
        this.color = options.color || randomColor();
        this.glitterColor = options.glitterColor || this.color;

        // Đặt starCount mặc định nếu cần, sẽ dựa trên kích thước vỏ và tỷ lệ theo cấp số nhân, chẳng hạn như diện tích bề mặt của hình cầu.
        if (!this.starCount) {
            const density = options.starDensity || 1;
            const scaledSize = this.spreadSize / 54;
            this.starCount = Math.max(6, scaledSize * scaledSize * density);
        }
    }

    launch(position, launchHeight) {
        const width = stageW;
        const height = stageH;
        // Khoảng cách từ các cạnh của màn hình để giữ vỏ.
        const hpad = 60;
        // Khoảng cách từ đỉnh màn hình để giữ cho vỏ nổ.
        const vpad = 50;
        // Chiều cao bùng nổ tối thiểu, tính theo phần trăm chiều cao sân khấu
        const minHeightPercent = 0.45;
        // Chiều cao bùng nổ tối thiểu tính bằng px
        const minHeight = height - height * minHeightPercent;

        const launchX = position * (width - hpad * 2) + hpad;
        const launchY = height;
        const burstY = minHeight - (launchHeight * (minHeight - vpad));

        const launchDistance = launchY - burstY;
        // Cần sử dụng đường cong công suất tùy chỉnh để ước chừng Vi để đạt được Khoảng cách phóng dưới tác dụng của trọng lực và lực cản của không khí.
        // Những con số kỳ diệu đến từ thử nghiệm.
        const launchVelocity = Math.pow(launchDistance * 0.04, 0.64);

        const comet = this.comet = Star.add(
            launchX,
            launchY,
            typeof this.color === 'string' && this.color !== 'random' ? this.color : COLOR.White,
            Math.PI,
            launchVelocity * (this.horsetail ? 1.2 : 1),
            // Thời gian treo được suy ra tuyến tính từ Vi; con số chính xác đến từ thử nghiệm
            launchVelocity * (this.horsetail ? 100 : 400)
        );

        // làm sao chổi trở nên “nặng” hạn chế lực cản không khí
        comet.heavy = true;
        // vệt tia lửa sao chổi
        comet.spinRadius = MyMath.random(0.32, 0.85);
        comet.sparkFreq = 32 / quality;
        if (isHighQuality) comet.sparkFreq = 8;
        comet.sparkLife = 320;
        comet.sparkLifeVariation = 3;
        if (this.glitter === 'willow' || this.fallingLeaves) {
            comet.sparkFreq = 20 / quality;
            comet.sparkSpeed = 0.5;
            comet.sparkLife = 500;
        }
        if (this.color === INVISIBLE) {
            comet.sparkColor = COLOR.Gold;
        }

        // Ngẫu nhiên làm cho sao chổi “cháy” sớm một chút.
        // Tính năng này bị vô hiệu hóa đối với vỏ đuôi ngựa do thời gian phát sóng của chúng rất ngắn.
        // Không áp dụng cho các loại vỏ tàng hình (như lá rơi) hoặc Liễu để tránh làm biến mất vệt sáng phóng lên.
        if (Math.random() > 0.4 && !this.horsetail && this.color !== INVISIBLE && this.glitter !== 'willow') {
            comet.secondColor = INVISIBLE;
            comet.transitionTime = Math.pow(Math.random(), 1.5) * 700 + 500;
        }

        comet.onDeath = comet => this.burst(comet.x, comet.y);

        soundManager.playSound('lift');
    }

    burst(x, y) {
        // Nếu là loại hình ảnh, ta tạo ImageBurst thay vì pháo hạt
        if (this.shell === 'Hình ảnh' && this.imageUrl) {
            console.log('[Firework] Main simulation bursting image:', this.imageUrl);
            const normalizedUrl = normalizeAssetPath(this.imageUrl);
            const cacheKey = `${normalizedUrl}_${this.frame || ''}`;
            const img = imageParticleCache.get(cacheKey);
            if (img) {
                // Lấy màu đầu tiên từ mảng color hoặc chính nó nếu là string
                const burstColor = Array.isArray(this.color) ? this.color[0] : (this.color || COLOR.White);
                ImageBurst.active.push(new ImageBurst(x, y, img, this.shellSize || 1, this.frame, burstColor));
                console.log('[Firework] ImageBurst created on Main stage. Active list:', ImageBurst.active.length);
                
                // Kết xuất flash hàng đợi
                BurstFlash.add(x, y, this.spreadSize / 4);
                if (this.comet) {
                    soundManager.playSound('burst', 1);
                }
                return;
            } else {
                console.warn('[Firework] Image not ready in Main simulation cache:', cacheKey);
                window.preloadFireworkImage && window.preloadFireworkImage(this.imageUrl, this.frame);
            }
        }

        // Đặt tốc độ chụp liên tục để tổng số lần chụp tăng lên theo kích thước đã đặt. Công thức cụ thể này được rút ra từ thử nghiệm và bị ảnh hưởng bởi lực cản không khí mô phỏng.
        const speed = this.spreadSize / 96;

        let color, onDeath, sparkFreq, sparkSpeed, sparkLife;
        let sparkLifeVariation = 0.25;
        // Một số hiệu ứng chết chóc, chẳng hạn như tiếng crackle, phát ra âm thanh nhưng chỉ nên phát một lần.
        let playedDeathSound = false;

        if (this.crossette) onDeath = (star) => {
            if (!playedDeathSound) {
                soundManager.playSound('crackleSmall');
                playedDeathSound = true;
            }
            crossetteEffect(star);
        }
        if (this.crackle) onDeath = (star) => {
            if (!playedDeathSound) {
                soundManager.playSound('crackle');
                playedDeathSound = true;
            }
            crackleEffect(star);
        }
        if (this.floral) onDeath = floralEffect;
        if (this.fallingLeaves) onDeath = fallingLeavesEffect;

        if (this.glitter === 'light') {
            sparkFreq = 400;
            sparkSpeed = 0.3;
            sparkLife = 300;
            sparkLifeVariation = 2;
        }
        else if (this.glitter === 'medium') {
            sparkFreq = 200;
            sparkSpeed = 0.44;
            sparkLife = 700;
            sparkLifeVariation = 2;
        }
        else if (this.glitter === 'heavy') {
            sparkFreq = 80;
            sparkSpeed = 0.8;
            sparkLife = 1400;
            sparkLifeVariation = 2;
        }
        else if (this.glitter === 'thick') {
            sparkFreq = 16;
            sparkSpeed = isHighQuality ? 1.65 : 1.5;
            sparkLife = 1400;
            sparkLifeVariation = 3;
        }
        else if (this.glitter === 'streamer') {
            sparkFreq = 32;
            sparkSpeed = 1.05;
            sparkLife = 620;
            sparkLifeVariation = 2;
        }
        else if (this.glitter === 'willow') {
            sparkFreq = 80;
            sparkSpeed = 0.48;
            sparkLife = 1500;
            sparkLifeVariation = 3.8;
        }

        // Áp dụng chất lượng cho số lượng tia lửa
        sparkFreq = sparkFreq / quality;

        // Nhà máy sao cho cụm sơ cấp, nhụy hoa và bộ truyền phát.
        let firstStar = true;
        const starFactory = (angle, speedMult) => {
            // Đối với đạn pháo không phải đuôi ngựa, hãy tính tốc độ thẳng đứng ban đầu để thêm vào vụ nổ sao.
            // Con số kỳ diệu đến từ việc thử nghiệm những gì trông đẹp nhất. Lý tưởng là tất cả vỏ
            // các vụ nổ xuất hiện ở trung tâm một cách trực quan trong phần lớn thời gian tồn tại của sao (không bao gồm cây liễu, v.v.)
            const standardInitialSpeed = this.spreadSize / 1800;

            const star = Star.add(
                x,
                y,
                color,
                angle,
                speedMult * speed,
                // thêm biến thể nhỏ vào cuộc sống của ngôi sao
                this.starLife + Math.random() * this.starLife * this.starLifeVariation,
                this.horsetail ? this.comet && this.comet.speedX : 0,
                this.horsetail ? this.comet && this.comet.speedY : -standardInitialSpeed
            );

            if (this.secondColor) {
                star.transitionTime = this.starLife * (Math.random() * 0.05 + 0.32);
                star.secondColor = this.secondColor;
            }

            if (this.strobe) {
                star.transitionTime = this.starLife * (Math.random() * 0.08 + 0.46);
                star.strobe = true;
                // Có bao nhiêu mili giây giữa lần chuyển đổi trạng thái nhấp nháy "tích tắc". Lưu ý rằng kiểu nhấp nháy
                // đang bật:tắt:tắt, vì vậy đây là khoảng thời gian "bật", trong khi khoảng thời gian "tắt" dài gấp đôi.
                star.strobeFreq = Math.random() * 20 + 40;
                if (this.strobeColor) {
                    star.secondColor = this.strobeColor;
                }
            }

            star.onDeath = onDeath;

            if (this.glitter) {
                star.sparkFreq = sparkFreq;
                star.sparkSpeed = sparkSpeed;
                star.sparkLife = sparkLife;
                star.sparkLifeVariation = sparkLifeVariation;
                if (this.glitterColor === 'random') {
                    star.sparkColor = star.color;
                } else if (Array.isArray(this.glitterColor)) {
                    star.sparkColor = this.glitterColor[Math.floor(Math.random() * this.glitterColor.length)];
                } else {
                    star.sparkColor = this.glitterColor;
                }
                star.sparkTimer = Math.random() * star.sparkFreq;
            }
        };


        if (typeof this.color === 'string' || Array.isArray(this.color)) {
            color = this.color;

            // Các vòng có tính ngẫu nhiên về vị trí nhưng được xoay ngẫu nhiên
            if (this.shapePoints) {
                // Chỉ xoay ngẫu nhiên nếu KHÔNG phải là pháo văn bản để giữ chữ dễ đọc
                const isText = this.shapePoints.isText;
                const shapeStartAngle = isText ? 0 : (Math.random() - 0.5) * 0.4;
                const cosA = Math.cos(shapeStartAngle);
                const sinA = Math.sin(shapeStartAngle);

            this.shapePoints.forEach(p => {
                // Xoay điểm p theo shapeStartAngle
                const rx = p.x * cosA - p.y * sinA;
                const ry = p.x * sinA + p.y * cosA;

                // Sử dụng trực tiếp rx, ry để gán tốc độ, đảm bảo đúng hướng tuyệt đối
                const finalX = rx;
                const finalY = ry;

                const star = Star.add(
                    x,
                    y,
                    p.color || color,
                    0, // Angle không quan trọng vì ta sẽ ghi đè speedX/Y
                    0, // Speed không quan trọng vì ta sẽ ghi đè speedX/Y
                    this.starLife + Math.random() * this.starLife * this.starLifeVariation
                );

                star.speedX = finalX * speed;
                star.speedY = finalY * speed;

                if (this.glitter) {
                    star.sparkFreq = sparkFreq;
                    star.sparkSpeed = sparkSpeed;
                    star.sparkLife = sparkLife;
                    star.sparkLifeVariation = sparkLifeVariation;
                    if (this.glitterColor === 'random') {
                        star.sparkColor = star.color;
                    } else if (Array.isArray(this.glitterColor)) {
                        star.sparkColor = this.glitterColor[Math.floor(Math.random() * this.glitterColor.length)];
                    } else {
                        star.sparkColor = this.glitterColor;
                    }
                    star.sparkTimer = Math.random() * star.sparkFreq;
                }
            });
            } else if (this.ring) {
                const ringStartAngle = Math.random() * Math.PI;
                const ringSquash = Math.pow(Math.random(), 2) * 0.85 + 0.15;;

                createParticleArc(0, PI_2, this.starCount, 0, angle => {
                    // Tạo hình vòng, ép ngang
                    const initSpeedX = Math.sin(angle) * speed * ringSquash;
                    const initSpeedY = Math.cos(angle) * speed;
                    // Xoay vòng
                    const newSpeed = MyMath.pointDist(0, 0, initSpeedX, initSpeedY);
                    const newAngle = MyMath.pointAngle(0, 0, initSpeedX, initSpeedY) + ringStartAngle;
                    const star = Star.add(
                        x,
                        y,
                        color,
                        newAngle,
                        // áp dụng lượng rơi gần khối để tăng tốc độ (đặt nhiều hạt hơn về phía bên ngoài)
                        newSpeed,//tốc độ,
                        // thêm biến thể nhỏ vào cuộc sống của ngôi sao
                        this.starLife + Math.random() * this.starLife * this.starLifeVariation
                    );

                    if (this.glitter) {
                        star.sparkFreq = sparkFreq;
                        star.sparkSpeed = sparkSpeed;
                        star.sparkLife = sparkLife;
                        star.sparkLifeVariation = sparkLifeVariation;
                        if (this.glitterColor === 'random') {
                            star.sparkColor = star.color;
                        } else if (Array.isArray(this.glitterColor)) {
                            star.sparkColor = this.glitterColor[Math.floor(Math.random() * this.glitterColor.length)];
                        } else {
                            star.sparkColor = this.glitterColor;
                        }
                        star.sparkTimer = Math.random() * star.sparkFreq;
                    }
                });
            }
            // Nổ bình thường
            else {
                createBurst(this.starCount, starFactory);
            }
        }
        else {
            throw new Error('Invalid shell color. Expected string or array of strings, but got: ' + this.color);
        }

        if (this.pistil) {
            const innerShell = new Shell({
                spreadSize: this.spreadSize * 0.5,
                starLife: this.starLife * 0.6,
                starLifeVariation: this.starLifeVariation,
                starDensity: 1.4,
                color: this.pistilColor,
                glitter: 'light',
                glitterColor: this.pistilColor === COLOR.Gold ? COLOR.Gold : COLOR.White
            });
            innerShell.burst(x, y);
        }

        if (this.streamers) {
            const innerShell = new Shell({
                spreadSize: this.spreadSize * 0.9,
                starLife: this.starLife * 0.8,
                starLifeVariation: this.starLifeVariation,
                starCount: Math.floor(Math.max(6, this.spreadSize / 45)),
                color: COLOR.White,
                glitter: 'streamer'
            });
            innerShell.burst(x, y);
        }

        // Kết xuất flash hàng đợi
        BurstFlash.add(x, y, this.spreadSize / 4);

        // Phát âm thanh, nhưng chỉ dành cho vỏ "nguyên bản", loại đã được ra mắt.
        // Chúng tôi không muốn có nhiều âm thanh từ nhụy hoa hoặc "vỏ phụ" của bộ truyền phát.
        // Điều này có thể được phát hiện bởi sự hiện diện của sao chổi.
        if (this.comet) {
            // Chia tỷ lệ âm thanh nổ dựa trên kích thước vỏ hiện tại và kích thước vỏ đã chọn (tối đa).
            // Chụp kích thước vỏ đã chọn sẽ luôn phát ra âm thanh giống nhau bất kể kích thước đã chọn,
            // nhưng khi đạn nhỏ hơn được bắn tự động, chúng sẽ phát ra âm thanh nhỏ hơn. Nghe có vẻ không hay lắm
            // Tuy nhiên, khi một giá trị quá nhỏ được đưa ra, thay vì dựa vào tỷ lệ, chúng ta chỉ
            // hãy nhìn vào sự khác biệt về kích thước và ánh xạ nó tới một phạm vi được cho là có âm thanh hay.
            const maxDiff = 2;
            const sizeDifferenceFromMaxSize = Math.min(maxDiff, shellSizeSelector() - this.shellSize);
            const soundScale = (1 - sizeDifferenceFromMaxSize / maxDiff) * 0.3 + 0.7;
            soundManager.playSound('burst', soundScale);
        }
    }
}



const BurstFlash = {
    active: [],
    _pool: [],

    _new() {
        return {}
    },

    add(x, y, radius) {
        const instance = this._pool.pop() || this._new();

        instance.x = x;
        instance.y = y;
        instance.radius = radius;

        this.active.push(instance);
        return instance;
    },

    returnInstance(instance) {
        this._pool.push(instance);
    }
};



// Trình trợ giúp tạo các đối tượng để lưu trữ các hạt hoạt động.
// Các hạt được lưu trữ trong các mảng được khóa theo màu (mã chứ không phải tên) để cải thiện hiệu suất hiển thị.
function createParticleCollection() {
    const collection = {};
    COLOR_CODES_W_INVIS.forEach(color => {
        collection[color] = [];
    });
    return collection;
}


// Thuộc tính sao (WIP)
// --------------
// transitionTime - quá trình chuyển đổi ngôi sao diễn ra gần đến cuối cuộc đời như thế nào

const Star = {
    // Thuộc tính hình ảnh
    drawWidth: 3,
    airDrag: 0.98,
    airDragHeavy: 0.992,

    // Các hạt sao sẽ được khóa theo màu sắc
    active: createParticleCollection(),
    _pool: [],

    _new() {
        return {};
    },

    add(x, y, color, angle, speed, life, speedOffX, speedOffY) {
        const instance = this._pool.pop() || this._new();

        let finalColor;
        if (Array.isArray(color)) {
            finalColor = color[Math.floor(Math.random() * color.length)];
        } else {
            finalColor = (color && color !== 'random') ? color : randomColor();
        }

        instance.visible = true;
        instance.heavy = false;
        instance.x = x;
        instance.y = y;
        instance.prevX = x;
        instance.prevY = y;
        instance.color = finalColor;
        instance.speedX = Math.sin(angle) * speed + (speedOffX || 0);
        instance.speedY = Math.cos(angle) * speed + (speedOffY || 0);
        instance.life = life;
        instance.fullLife = life;
        instance.spinAngle = Math.random() * PI_2;
        instance.spinSpeed = 0.8;
        instance.spinRadius = 0;
        instance.sparkFreq = 0; // ms giữa lượng phát ra tia lửa
        instance.sparkSpeed = 1;
        instance.sparkTimer = 0;
        instance.sparkColor = finalColor;
        instance.sparkLife = 750;
        instance.sparkLifeVariation = 0.25;
        instance.strobe = false;

        if (!this.active[finalColor]) {
            this.active[finalColor] = [];
        }
        this.active[finalColor].push(instance);
        return instance;
    },

    // Phương thức công khai để dọn dẹp và trả lại một phiên bản trở lại nhóm.
    returnInstance(instance) {
        // Gọi trình xử lý onDeath nếu có (và truyền cho nó phiên bản sao hiện tại)
        instance.onDeath && instance.onDeath(instance);
        // Dọn dẹp
        instance.onDeath = null;
        instance.secondColor = null;
        instance.transitionTime = 0;
        instance.colorChanged = false;
        // Thêm trở lại hồ bơi.
        this._pool.push(instance);
    }
};


const Spark = {
    // Thuộc tính hình ảnh
    drawWidth: 0, // được đặt trong `configDidUpdate()`
    airDrag: 0.9,

    // Các hạt sao sẽ được khóa theo màu sắc
    active: createParticleCollection(),
    _pool: [],

    _new() {
        return {};
    },

    add(x, y, color, angle, speed, life) {
        const instance = this._pool.pop() || this._new();

        instance.x = x;
        instance.y = y;
        instance.prevX = x;
        instance.prevY = y;
        instance.color = color;
        instance.speedX = Math.sin(angle) * speed;
        instance.speedY = Math.cos(angle) * speed;
        instance.life = life;

        if (!this.active[color]) {
            this.active[color] = [];
        }
        this.active[color].push(instance);
        return instance;
    },

    // Phương thức công khai để dọn dẹp và trả lại một phiên bản trở lại nhóm.
    returnInstance(instance) {
        // Thêm trở lại hồ bơi.
        this._pool.push(instance);
    }
};



// Đảm bảo các file âm thanh được Vite nhận diện và đưa vào thư mục build
import.meta.glob('../audio/*.mp3');

const soundManager = {
    baseURL: './assets/audio/',
    ctx: new (window.AudioContext || window.webkitAudioContext),
    sources: {
        lift: {
            volume: 1,
            playbackRateMin: 0.85,
            playbackRateMax: 0.95,
            fileNames: [
                'lift1.mp3',
                'lift2.mp3',
                'lift3.mp3'
            ]
        },
        burst: {
            volume: 1,
            playbackRateMin: 0.8,
            playbackRateMax: 0.9,
            fileNames: [
                'burst1.mp3',
                'burst2.mp3'
            ]
        },
        burstSmall: {
            volume: 0.25,
            playbackRateMin: 0.8,
            playbackRateMax: 1,
            fileNames: [
                'burst-sm-1.mp3',
                'burst-sm-2.mp3'
            ]
        },
        crackle: {
            volume: 0.2,
            playbackRateMin: 1,
            playbackRateMax: 1,
            fileNames: ['crackle1.mp3']
        },
        crackleSmall: {
            volume: 0.3,
            playbackRateMin: 1,
            playbackRateMax: 1,
            fileNames: ['crackle-sm-1.mp3']
        }
    },

    preload() {
        const allFilePromises = [];

        function checkStatus(response) {
            if (response.status >= 200 && response.status < 300) {
                return response;
            }
            const customError = new Error(response.statusText);
            customError.response = response;
            throw customError;
        }

        const types = Object.keys(this.sources);
        types.forEach(type => {
            const source = this.sources[type];
            const { fileNames } = source;
            const filePromises = [];
            fileNames.forEach(fileName => {
                const fileURL = this.baseURL + fileName;
                // Promise sẽ giải quyết bằng bộ đệm âm thanh được giải mã.
                const promise = fetch(fileURL)
                    .then(checkStatus)
                    .then(response => response.arrayBuffer())
                    .then(data => new Promise(resolve => {
                        this.ctx.decodeAudioData(data, resolve);
                    }));

                filePromises.push(promise);
                allFilePromises.push(promise);
            });

            Promise.all(filePromises)
                .then(buffers => {
                    source.buffers = buffers;
                });
        });

        return Promise.all(allFilePromises);
    },

    pauseAll() {
        this.ctx.suspend();
    },

    resumeAll() {
        // Phát âm thanh không có âm lượng cho iOS. Điều này 'mở khóa' bối cảnh âm thanh khi người dùng bật âm thanh lần đầu tiên.
        this.playSound('lift', 0);
        // Chrome dành cho thiết bị di động yêu cầu tương tác trước khi bắt đầu ngữ cảnh âm thanh.
        // Nút chuyển đổi âm thanh được kích hoạt khi 'chạm khởi động', nút này dường như không được tính là đầy đủ
        // tương tác với Chrome. Tôi đoán nó cần một cú nhấp chuột? Dù sao đi nữa, nếu điều đầu tiên người dùng làm
        // bật âm thanh thì nó không hoạt động. Việc sử dụng setTimeout cho phép đăng ký tương tác đầu tiên.
        // Có lẽ giải pháp tốt hơn là theo dõi xem người dùng đã tương tác hay chưa và nếu chưa thì họ hãy thử bật
        // âm thanh, hiển thị chú giải công cụ mà họ nên nhấn lại để bật âm thanh.
        setTimeout(() => {
            this.ctx.resume();
        }, 250);
    },

    // Sở hữu tư nhân dùng để điều tiết những âm thanh bùng nổ nhỏ.
    _lastSmallBurstTime: 0,

    /**
     * Play a sound of `type`. Will randomly pick a file associated with type, and play it at the specified volume
     * and play speed, with a bit of random variance in play speed. This is all based on `sources` config.
     *
     * @param  {string} type - The type of sound to play.
     * @param  {?number} scale=1 - Value between 0 and 1 (values outside range will be clamped). Scales less than one
     *                             descrease volume and increase playback speed. This is because large explosions are
     *                             louder, deeper, and reverberate longer than small explosions.
     *                             Note that a scale of 0 will mute the sound.
     */
    playSound(type, scale = 1) {
        // Đảm bảo `scale` nằm trong phạm vi hợp lệ.
        scale = MyMath.clamp(scale, 0, 1);

        // Không cho phép bắt đầu âm thanh mới nếu âm thanh bị tắt, ứng dụng đang chạy ở chế độ chuyển động chậm hoặc bị tạm dừng.
        // Kiểm tra chuyển động chậm có một số khoảng trống trong trường hợp người dùng không kéo xong thanh tốc độ
        // *tất cả* đường về.
        if (!canPlaySoundSelector() || simSpeed < 0.95) {
            return;
        }

        // Van tiết lưu nổ nhỏ, vì vỏ hoa/lá rụng có rất nhiều.
        if (type === 'burstSmall') {
            const now = Date.now();
            if (now - this._lastSmallBurstTime < 20) {
                return;
            }
            this._lastSmallBurstTime = now;
        }

        const source = this.sources[type];

        if (!source) {
            throw new Error(`Sound of type "${type}" doesn't exist.`);
        }

        const initialVolume = source.volume;
        const initialPlaybackRate = MyMath.random(
            source.playbackRateMin,
            source.playbackRateMax
        );

        // Khối lượng giảm theo quy mô.
        const scaledVolume = initialVolume * scale;
        // Tốc độ phát lại tăng theo quy mô. Đối với điều này, chúng tôi ánh xạ tỷ lệ 0-1 thành tỷ lệ 2-1.
        // Vì vậy, ở thang âm 1, âm thanh phát bình thường, nhưng khi thang âm tiến tới 0 thì tốc độ sẽ tăng gấp đôi.
        const scaledPlaybackRate = initialPlaybackRate * (2 - scale);

        const gainNode = this.ctx.createGain();
        gainNode.gain.value = scaledVolume;

        const buffer = MyMath.randomChoice(source.buffers);
        const bufferSource = this.ctx.createBufferSource();
        bufferSource.playbackRate.value = scaledPlaybackRate;
        bufferSource.buffer = buffer;
        bufferSource.connect(gainNode);
        gainNode.connect(this.ctx.destination);
        bufferSource.start(0);
    }
};




// Bắt đầu mọi thứ.

function setLoadingStatus(status) {
    appNodes.loadingStatus.textContent = status;
}

// Tiêu đề hồ sơ không cần âm thanh, chỉ cần khởi tạo.
if (IS_HEADER) {
    init();
} else {
    // Đợi người dùng nhấn "Bắt đầu"
    appNodes.btnStart.addEventListener('click', (e) => {
        // Ngăn chặn sự kiện nổi bọt để tránh Stage nhận được tín hiệu bắn pháo hoa
        e.stopPropagation();
        e.preventDefault();

        // Ẩn màn hình bắt đầu và hiện màn hình loading
        appNodes.startScreen.classList.add('hide');
        appNodes.loadingInit.classList.remove('remove');

        // Kích hoạt âm thanh ngay lập tức (mở khóa AudioContext)
        soundManager.resumeAll();

        // Đặt một khoảng thời gian chờ cho phát bắn tự động đầu tiên 
        // để không bị chồng lấp với hành động nhấn nút
        autoLaunchTime = 2500;

        // Bắt đầu tải dữ liệu
        setLoadingStatus('Đang châm ngòi');
        setTimeout(() => {
            soundManager.preload()
                .then(
                    init,
                    reason => {
                        init();
                        return Promise.reject(reason);
                    }
                );
        }, 500); // Đợi một chút cho hiệu ứng chuyển cảnh
    }, { once: true });
}
