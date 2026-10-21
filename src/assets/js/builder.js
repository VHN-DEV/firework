/*!
 * Trình diễn Pháo hoa – trình soạn kịch bản (builder)
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

import fscreen from './fscreen@1.0.1.js';
import qrcode from 'qrcode-generator';
import { renderShareImage } from './share-image.js';
import { OCCASIONS, buildTemplate } from './templates.js';
import { analyzeMusic, buildBeatShow, KEEP_SHELLS } from './beat-sync.js';
import { eventTimes, layoutBursts, isPauseEvent, BURST_MS } from './timeline.js';
import { createTimelineTrack } from './timeline-track.js';
import { EMOJI_GROUPS } from './text-emojis.js';
import { polyfillCountryFlagEmojis } from 'country-flag-emoji-polyfill';
import flagFontUrl from 'country-flag-emoji-polyfill/dist/TwemojiCountryFlags.woff2?url';
import {
    getOwnerKeys, saveOwnerKey, removeOwnerKey, fetchOpenStatus, trackingUrl, formatWhen, lastEvent, describeOpenStatus
} from './gift-tracking.js';
import { printCopyrightNotice } from './copyright.js';
import '../scss/builder.scss';
import backgroundImgUrl from '../img/background.webp';

// Assign to window for global access
window.fscreen = fscreen;
printCopyrightNotice('Trình diễn Pháo hoa – Builder');
// Windows không có cờ trong font emoji: khai báo font cờ riêng (đã đặt đầu font-family của trang)
polyfillCountryFlagEmojis('Twemoji Country Flags', flagFontUrl);

/**
 * Firework Script Builder Logic - Enhanced
 */

const state = {
    events: [],
    nextId: 1,
    currentFilename: '',
    activeEventId: null,
    miniPreviewEnabled: false,
    showBackground: false,
    // Khói pháo: '' tắt, 'light' nhẹ, 'heavy' dày
    smoke: '',
    // Cảnh vật: mặt nước ('' không, 'third' 1/3, 'half' nửa màn hình), trang trí ('lanterns', 'balloons', 'both')
    water: '',
    decor: '',
    background: null,
    // Nhạc nền { url, name, volume (0-1), start (giây) } và âm lượng tiếng pháo (0-1)
    music: null,
    effectsVolume: 1,
    // Khung bắt đầu ('' = thiệp chào), xem START_FRAMES
    startFrame: '',
    // Hẹn giờ mở quà: thời điểm ISO ('' = không hẹn) và cách mở khi tới giờ ('lock' | 'countdown')
    openAt: '',
    openMode: 'lock',
    // Báo cho người gửi khi người nhận mở quà (cần máy chủ PHP)
    notifyOpen: true,
    // Giảm chớp sáng cho cả màn trình diễn
    reduceFlashing: false,
    // Ảnh khi chia sẻ: 'auto' = thiệp pháo hoa tự vẽ, 'custom' = ảnh người dùng chọn
    seo: { mode: 'auto', image: null, imageText: true, imagePosition: 50, axis: 'y' }
};

const isStaticEnv = window.location.hostname.includes('github.io') ||
    window.location.hostname.includes('vercel.app') ||
    window.location.hostname.includes('netlify.app') ||
    window.location.protocol === 'file:';


const COLOR = {
    Red: '#ff0043',
    Green: '#14fc56',
    Blue: '#1e7fff',
    Purple: '#e60aff',
    Gold: '#ffbf36',
    White: '#ffffff'
};

// Thứ tự hiển thị trong lưới chọn loại pháo. Gồm cả các loại trình phát hỗ trợ nhưng trước đây builder thiếu
// (Con bướm, Cỏ 3 lá, Cỏ 4 lá): kịch bản dùng chúng sẽ không còn bị hiện nhầm thành "Hoa cúc".
const SHELL_TYPES = [
    "Hoa cúc", "Liễu", "Cây cọ", "Xoay vòng", "Xoắn ốc", "Cháy lâu", "Vòng nhẫn", "Nổ chéo", "Nổ lách tách",
    "Nhấp nháy", "Đuôi ngựa", "Ma", "Nổ nhiều lần", "Trái tim", "Ngôi sao", "Kim cương", "Bông tuyết", "Bông sen",
    "Hành tinh", "Con bướm", "Cỏ 3 lá", "Cỏ 4 lá", "Mặt cười", "Mặt mèo", "Văn bản", "Hình ảnh", "Lời nhắn", "Tạm dừng"
];

const SHELL_ICONS = {
    'Hoa cúc': '🌼', 'Liễu': '🌿', 'Cây cọ': '🌴', 'Xoay vòng': '🎡', 'Xoắn ốc': '🌀', 'Cháy lâu': '🕯️',
    'Vòng nhẫn': '⭕', 'Nổ chéo': '✖️', 'Nổ lách tách': '🎇', 'Nhấp nháy': '✨', 'Đuôi ngựa': '🐎', 'Ma': '👻',
    'Nổ nhiều lần': '💥', 'Trái tim': '❤️', 'Ngôi sao': '⭐', 'Kim cương': '💎', 'Bông tuyết': '❄️',
    'Bông sen': '🌸', 'Hành tinh': '🪐', 'Con bướm': '🦋', 'Cỏ 3 lá': '☘️', 'Cỏ 4 lá': '🍀', 'Mặt cười': '😊',
    'Mặt mèo': '🐱', 'Văn bản': '🔤', 'Hình ảnh': '🖼️', 'Lời nhắn': '💬', 'Tạm dừng': '⏸️'
};

// Hiệu ứng luôn có sẵn trong loại pháo (trình phát tự bật), hiển thị dạng đã tích và khóa trong mục Nâng cao
const SHELL_BUILTIN_EFFECTS = {
    'Nổ lách tách': ['crackle'],
    'Nổ chéo': ['crossette'],
    'Vòng nhẫn': ['ring'],
    'Nhấp nháy': ['strobe'],
    'Đuôi ngựa': ['horsetail'],
    'Ma': ['streamers'],
    'Cháy lâu': ['hang']
};

// Kiểu bắn: cách quả pháo bay lên điểm nổ, dùng được cho mọi loại pháo.
// Giá trị khớp với LAUNCH_STYLES trong trình phát (script.js); thêm kiểu mới thì thêm ở cả hai nơi.
const LAUNCH_STYLES = [
    { value: '', name: 'Theo loại pháo', icon: '🎆', hint: 'Bay thẳng lên; riêng pháo "Xoắn ốc" bay xoắn đôi.' },
    { value: 'straight', name: 'Bay thẳng', icon: '⬆️', hint: 'Bay thẳng một mạch lên điểm nổ.' },
    { value: 'spiral', name: 'Xoắn đôi', icon: '➰', hint: 'Hai vệt sáng uốn lượn quấn vào nhau như lò xo khi bay lên.' },
    { value: 'popping', name: 'Nổ dọc đường', icon: '🎉', hint: 'Vừa bay lên vừa nổ lụp bụp từng chùm nhỏ.' },
    { value: 'stages', name: 'Bay nhiều tầng', icon: '🚀', hint: 'Bay chậm dần, nổ một chùm rồi vọt lên tầng tiếp theo, lặp lại trước khi nổ chính. Bay lâu hơn khoảng 2 giây.' },
    { value: 'wander', name: 'Bay lượn', icon: '〰️', hint: 'Chao qua chao lại ngẫu nhiên, không theo đường thẳng.' },
    { value: 'stealth', name: 'Đạn tàng hình', icon: '👂', hint: 'Không thấy đường đạn bay lên, chỉ nghe tiếng phóng rồi pháo bất ngờ nổ giữa trời.' }
];

// Khung bắt đầu: màn hình người xem thấy trước khi màn trình diễn bắt đầu.
// Giá trị khớp với START_FRAMES trong trình phát (script.js); thêm khung mới thì thêm ở cả hai nơi.
const START_FRAMES = [
    { value: '', name: 'Thiệp chào', icon: '💌', hint: 'Thiệp với lời mời và nút "Mở quà".' },
    { value: 'gift', name: 'Hộp quà', icon: '🎁', hint: 'Hộp quà rung rinh; chạm vào thì bung nắp, nổ tung ruy băng và pháo giấy rồi mới bắt đầu.' }
];

const FRAME_TYPES = [
    // Phát bắn chưa chọn khung (frame trống) thực tế hiển thị không khung, nên cần một lựa chọn tương ứng
    { name: 'Không khung', value: '', icon: '🖼️' },
    { name: 'Trái tim', value: 'heart', icon: '❤️' },
    { name: 'Ngôi sao', value: 'star', icon: '⭐' },
    { name: 'Tròn', value: 'circle', icon: '⚪' },
    { name: 'Bo góc', value: 'rounded', icon: '🔲' },
    { name: 'Vuông', value: 'square', icon: '⬜' },
    { name: 'Tam giác', value: 'triangle', icon: '🔺' }
];

// Thoát ký tự HTML trước khi chèn dữ liệu người dùng (chữ, màu, tên kịch bản...) vào innerHTML.
// Tránh vỡ giao diện khi chữ có dấu nháy và tránh chạy mã độc từ kịch bản do người khác lưu.
function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function normalizeAssetPath(path) {
    if (!path) return path;

    // Ảnh dạng data:/blob: (ảnh lưu cục bộ trên GitHub Pages) và URL tuyệt đối thì giữ nguyên
    if (/^(data:|blob:|https?:|\/)/i.test(path)) return path;

    // Xử lý đường dẫn tương đối
    let cleanPath = path.replace(/^\.\//, '');

    if (import.meta.env.DEV) {
        // Trong môi trường dev, đảm bảo có 'src/assets/'
        if (cleanPath.startsWith('assets/')) {
            cleanPath = 'src/' + cleanPath;
        }
    } else if (cleanPath.startsWith('src/assets/')) {
        // Trong bản build, chuyển 'src/assets/' thành 'assets/'
        cleanPath = cleanPath.replace('src/assets/', 'assets/');
    }
    // Đảm bảo đường dẫn là tương đối từ gốc site
    return './' + cleanPath.replace(/^dist\//, '');
}

// Link xem/chia sẻ kịch bản, tính từ vị trí builder.html hiện tại (đúng cả khi URL không có ".html")
function getShowUrl(filename) {
    const url = new URL('index.html', window.location.href);
    url.searchParams.set('config', filename);
    return url.href;
}

const GLITTER_TYPES = [
    { name: "Mặc định", value: "" },
    { name: "Nhẹ (Light)", value: "light" },
    { name: "Vừa (Medium)", value: "medium" },
    { name: "Dày (Heavy)", value: "heavy" },
    { name: "Đặc (Thick)", value: "thick" },
    { name: "Dải sáng (Streamer)", value: "streamer" },
    { name: "Liễu (Willow)", value: "willow" }
];

const COLORS = [
    { name: "Ngẫu nhiên", value: "Ngẫu nhiên" },
    { name: "Đỏ (Red)", value: "Red" },
    { name: "Xanh lá (Green)", value: "Green" },
    { name: "Xanh dương (Blue)", value: "Blue" },
    { name: "Tím (Purple)", value: "Purple" },
    { name: "Vàng (Gold)", value: "Gold" },
    { name: "Trắng (White)", value: "White" },
];

// Initialize UI
document.addEventListener('DOMContentLoaded', () => {
    // Buttons
    // Bọc trong arrow function: nếu truyền thẳng hàm, đối tượng MouseEvent sẽ bị coi là tham số
    document.getElementById('btn-add-event')?.addEventListener('click', () => addEventFromUI());
    document.getElementById('btn-fab-add')?.addEventListener('click', () => addEventFromUI());
    document.getElementById('btn-save')?.addEventListener('click', saveConfig);
    document.getElementById('btn-preview')?.addEventListener('click', previewConfig);
    document.getElementById('btn-copy-link')?.addEventListener('click', copyShareLink);
    document.getElementById('btn-toggle-mini-preview')?.addEventListener('click', () => toggleMiniPreview());
    document.getElementById('btn-help')?.addEventListener('click', () => showModal('help-modal'));
    document.getElementById('sidebar-overlay')?.addEventListener('click', toggleSidebar);

    // Tên kịch bản trên thanh trên cùng
    document.getElementById('title')?.addEventListener('input', updateScriptNameLabel);
    document.getElementById('filename')?.addEventListener('input', updateScriptNameLabel);

    renderStartFrames();

    // Hẹn giờ mở quà
    document.getElementById('schedule-toggle')?.addEventListener('change', (e) => {
        if (e.target.checked) {
            // Mặc định: 0 giờ ngày mai
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(0, 0, 0, 0);
            state.openAt = tomorrow.toISOString();
        } else {
            state.openAt = '';
        }
        renderSchedule();
    });
    document.getElementById('open-at')?.addEventListener('change', (e) => {
        const time = Date.parse(e.target.value);
        if (Number.isFinite(time)) state.openAt = new Date(time).toISOString();
        renderSchedule();
    });
    renderSchedule();
    renderSmoke();
    renderScene();

    // Dải mẫu theo dịp ẩn khi bắt đầu tự soạn
    document.getElementById('title')?.addEventListener('input', updateTemplateStrip);
    renderTemplateChips();

    // Chia sẻ & SEO: thẻ xem trước cập nhật theo nội dung
    ['title', 'subtitle', 'author', 'seo-title', 'seo-description'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', scheduleSeoPreview);
    });
    document.getElementById('seo-image-file')?.addEventListener('change', (e) => handleSeoImageUpload(e.target));
    document.getElementById('seo-image-text')?.addEventListener('change', (e) => {
        state.seo.imageText = e.target.checked;
        scheduleSeoPreview();
    });
    document.getElementById('seo-image-position')?.addEventListener('input', (e) => {
        state.seo.imagePosition = Number(e.target.value);
        renderSeoControls();
        scheduleSeoPreview();
    });

    // Background logic
    const bgToggle = document.getElementById('show-background');
    const bgContainer = document.getElementById('background-upload-container');
    const bgFile = document.getElementById('background-file');
    const bgPreview = document.getElementById('background-preview');

    bgToggle?.addEventListener('change', (e) => {
        state.showBackground = e.target.checked;
        bgContainer?.classList.toggle('hide', !state.showBackground);
        refreshMiniPreview();
    });

    bgFile?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            state.background = event.target.result;
            if (bgPreview) bgPreview.src = state.background;
            refreshMiniPreview();
        };
        reader.readAsDataURL(file);
    });

    document.getElementById('loop')?.addEventListener('change', syncLoopState);

    // Nhạc nền
    document.getElementById('music-file')?.addEventListener('change', (e) => handleMusicUpload(e.target));
    document.getElementById('music-url')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') setMusicFromUrl();
    });
    document.getElementById('music-start')?.addEventListener('change', (e) => {
        if (!state.music) return;
        state.music.start = Math.max(0, Math.round((Number(e.target.value) || 0) * 10) / 10);
        e.target.value = state.music.start;
        afterMusicStartChange();
    });
    document.getElementById('music-sync')?.addEventListener('change', (e) => {
        if (!state.music) return;
        state.music.sync = e.target.checked || undefined;
        renderMusic();
        renderEventList();
        if (state.activeEventId) renderInspector();
    });
    document.getElementById('music-volume')?.addEventListener('input', (e) => {
        if (!state.music) return;
        state.music.volume = Number(e.target.value) / 100;
        document.getElementById('out-music-volume').textContent = e.target.value + '%';
        getMusicAudio().volume = state.music.volume;
    });
    const musicAudio = getMusicAudio();
    musicAudio?.addEventListener('play', () => document.getElementById('music-card').classList.add('playing'));
    musicAudio?.addEventListener('pause', () => document.getElementById('music-card').classList.remove('playing'));
    document.getElementById('effects-volume')?.addEventListener('input', (e) => {
        state.effectsVolume = Number(e.target.value) / 100;
        document.getElementById('out-effects-volume').textContent = e.target.value + '%';
    });
    if (isStaticEnv) {
        document.getElementById('music-hint').textContent = 'Trang tĩnh (GitHub Pages) không tải file lên được: hãy dán link trực tiếp tới file nhạc, '
            + 'hoặc chép file vào src/static/uploads/music/ rồi dán đường dẫn ./uploads/music/ten-file.mp3.';
    }
    renderMusic();
    if (isStaticEnv) {
        document.getElementById('seo-image-hint').innerHTML = 'Trang tĩnh (GitHub Pages) không tự đăng được ảnh này. Để link gửi đi hiện ảnh mới: '
            + 'bấm <strong>Lưu</strong>, trong hộp Chia sẻ bấm <strong>Tải ảnh thiệp</strong>, rồi chép file <code>.jpg</code> đó '
            + '(cùng file <code>.json</code> bấm <strong>Xuất</strong>) vào <code>src/static/configs/</code> và đăng lại trang.';
    }
    renderSeoControls();
    scheduleSeoPreview();

    // File Import
    document.getElementById('import-file')?.addEventListener('change', importConfig);

    document.getElementById('more-menu')?.addEventListener('click', (e) => {
        if (e.target.closest('button, a')) closeMoreMenu();
    });

    // Đóng menu "⋯" khi bấm ra ngoài
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.more-menu')) closeMoreMenu();
    });

    // Esc: đóng menu, ngăn cấu hình, bảng chỉnh sửa (trên điện thoại)
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape' || document.querySelector('.modal:not(.hide)')) return;
        if (!document.getElementById('more-menu').classList.contains('hide')) return closeMoreMenu();
        if (document.getElementById('settings-panel').classList.contains('open')) return toggleSidebar();
        if (state.activeEventId) closeInspector();
    });

    // Initial event if empty
    if (state.events.length === 0) {
        addEvent();
    }
    renderInspector();
    updateScriptNameLabel();

    // Điện thoại mặc định xem như trên điện thoại
    if (window.innerWidth < 768) setPreviewDevice('mobile');
    toggleMiniPreview(true);

    // Lưu nháp tự động, hoàn tác/làm lại
    initEditHistory();

    // Nút "?" giải thích từng mục
    helpTooltip.init();
    initSettingsGroups();

    // Báo mở quà: công tắc, hỏi trạng thái các món quà của mình
    document.getElementById('notify-open')?.addEventListener('change', (e) => {
        state.notifyOpen = e.target.checked;
        renderNotifyOpen();
    });
    document.getElementById('reduce-flashing')?.addEventListener('change', (e) => {
        state.reduceFlashing = e.target.checked;
        refreshMiniPreview();
    });
    renderNotifyOpen();
    startGiftWatch();
});

// Đồng bộ chế độ xem nhanh và nút "Chạy kịch bản" với ô "Tự động lặp lại",
// kể cả khi ô này được đổi bằng code (tạo mới, mở/nhập kịch bản) vì khi đó không có sự kiện 'change'.
function syncLoopState() {
    const isLoop = document.getElementById('loop').checked;
    previewMode = isLoop ? 'loop' : 'idle';
    document.getElementById('btn-play-mini')?.classList.toggle('hide', isLoop);
    updateMiniInfo();
    sendPreview(true);
}

function notify(message, type = 'info') {
    const container = document.getElementById('notification-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = 'info-circle';
    if (type === 'success') icon = 'check-circle';
    if (type === 'error') icon = 'exclamation-circle';
    if (type === 'warning') icon = 'exclamation-triangle';

    toast.innerHTML = `
        <i class="fas fa-${icon}"></i>
        <span>${escapeHtml(message)}</span>
    `;

    container.appendChild(toast);

    // Auto remove
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function showLoading(message = 'Đang xử lý...') {
    const loader = document.getElementById('global-loading');
    const msgEl = document.getElementById('loading-message');
    if (loader && msgEl) {
        msgEl.innerText = message;
        loader.classList.remove('hide');
    }
}

function hideLoading() {
    const loader = document.getElementById('global-loading');
    if (loader) {
        loader.classList.add('hide');
    }
}

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

function confirmAction(message, onConfirm) {
    const modal = document.getElementById('confirm-modal');
    const msgEl = document.getElementById('confirm-message');
    const yesBtn = document.getElementById('btn-confirm-yes');
    const noBtn = document.getElementById('btn-confirm-no');

    msgEl.innerText = message;
    modal.classList.remove('hide');

    const handleYes = () => {
        cleanup();
        onConfirm();
    };

    const handleNo = () => {
        cleanup();
    };

    const cleanup = () => {
        modal.classList.add('hide');
        yesBtn.removeEventListener('click', handleYes);
        noBtn.removeEventListener('click', handleNo);
    };

    yesBtn.addEventListener('click', handleYes);
    noBtn.addEventListener('click', handleNo);
}

function addEvent(config = null, { render = true } = {}) {
    const id = state.nextId++;
    let newEvent;

    if (config) {
        // Đảm bảo các trường còn thiếu có giá trị mặc định
        newEvent = {
            burst: 1,
            shell: "Hoa cúc",
            color: "Ngẫu nhiên",
            x: 50,
            y: 50,
            delay: 0,
            size: 1,
            strobe: false,
            pistil: false,
            streamers: false,
            crossette: false,
            crackle: false,
            horsetail: false,
            comet: false,
            floral: false,
            ring: false,
            starDensity: 1,
            strobeFreq: 50,
            launchAngle: 90,
            ascentSpeed: 1,
            rotation: undefined,
            liftSound: '',
            burstSound: '',
            expanded: false,
            ...config,
            id: id
        };
        if (newEvent.spiralLift && !newEvent.launchStyle) newEvent.launchStyle = 'spiral';
        delete newEvent.spiralLift;
    } else {
        // Luôn sử dụng giá trị mặc định cố định theo yêu cầu
        newEvent = {
            id: id,
            burst: 1,
            shell: "Hoa cúc",
            color: "Ngẫu nhiên",
            x: 50,
            y: 50,
            delay: 0,
            size: 1,
            strobe: false,
            strobeColor: "",
            pistil: false,
            pistilColor: "",
            streamers: false,
            crossette: false,
            crackle: false,
            horsetail: false,
            comet: false,
            starDensity: 1,
            starCount: undefined,
            // Tuổi thọ hạt, độ lệch tuổi thọ, độ rộng vụ nổ để trống: mỗi loại pháo dùng thông số riêng của nó
            // (ví dụ "Cháy lâu" cháy ~6 giây, "Liễu" ~3 giây). Đặt sẵn một số sẽ ghi đè và làm mọi loại giống nhau.
            starLife: undefined,
            starLifeVariation: undefined,
            spreadSize: undefined,
            glitterColor: "",
            secondColor: "",
            transitionTime: undefined,
            floral: false,
            ring: false,
            strobeFreq: 50,
            launchAngle: 90,
            ascentSpeed: 1,
            rotation: undefined,
            liftSound: '',
            burstSound: '',
            expanded: false
        };
    }

    state.events.push(newEvent);
    if (render) renderEventList();
}

function addColorToEvent(id, color) {
    const event = state.events.find(e => e.id === id);
    color = typeof color === 'string' ? color.trim() : color;
    if (!event || !color) return;

    const current = Array.isArray(event.color) ? event.color : [event.color];
    if (color === 'Ngẫu nhiên' || !event.color || event.color === 'Ngẫu nhiên') {
        // "Ngẫu nhiên" là lựa chọn riêng: chọn màu cụ thể thì thay thế nó (không tạo mảng ["Ngẫu nhiên", "Red"])
        event.color = color;
    } else if (!current.includes(color)) {
        event.color = [...current, color];
    }
    renderEventList();
    renderInspector();
}

function removeColorFromEvent(id, index) {
    const event = state.events.find(e => e.id === id);
    if (!event) return;
    if (!Array.isArray(event.color)) {
        // Nếu là string, không thể xóa bằng index (về mặc định)
        event.color = '';
    } else {
        event.color.splice(index, 1);
        if (event.color.length === 1) event.color = event.color[0];
        if (event.color.length === 0) event.color = '';
    }
    renderEventList();
    renderInspector();
}

function createNewScript() {
    confirmAction('Bạn có chắc chắn muốn tạo kịch bản mới? Mọi thay đổi chưa lưu sẽ bị mất.', () => {
        // Reset state
        state.events = [];
        state.nextId = 1;
        state.currentFilename = null;
        state.activeEventId = null;

        // Reset UI
        document.getElementById('title').value = '';
        document.getElementById('subtitle').value = '';
        document.getElementById('seo-title').value = '';
        document.getElementById('seo-description').value = '';
        state.seo = { mode: 'auto', image: null, imageText: true, imagePosition: 50, axis: 'y' };
        renderSeoControls();
        document.getElementById('author').value = '';
        document.getElementById('recipient').value = '';
        state.startFrame = '';
        renderStartFrames();
        state.openAt = '';
        state.openMode = 'lock';
        renderSchedule();
        state.notifyOpen = true;
        renderNotifyOpen();
        state.reduceFlashing = false;
        document.getElementById('reduce-flashing').checked = false;
        document.getElementById('intro-message').value = '';
        document.getElementById('outro-message').value = '';
        document.getElementById('filename').value = '';
        document.getElementById('loop').checked = true;
        syncLoopState();
        document.getElementById('share-bar').classList.add('hide');

        state.smoke = '';
        renderSmoke();
        state.water = '';
        state.decor = '';
        renderScene();

        // Reset background
        state.showBackground = false;
        state.background = null;
        document.getElementById('show-background').checked = false;
        document.getElementById('background-upload-container').classList.add('hide');
        document.getElementById('background-preview').src = backgroundImgUrl;
        refreshMiniPreview();

        // Bỏ nhạc nền
        state.music = null;
        state.effectsVolume = 1;
        previewMusicOn = false;
        renderMusic();

        // Add one default event
        addEvent();
        renderInspector();
        updateScriptNameLabel();

        notify('Đã tạo kịch bản mới!', 'success');
    });
}

function removeEvent(id) {
    state.events = state.events.filter(e => e.id !== id);
    if (state.activeEventId === id) {
        state.activeEventId = null;
        renderInspector();
        updateMiniInfo();
    }
    renderEventList();
}

function duplicateEvent(id) {
    const index = state.events.findIndex(e => e.id === id);
    if (index === -1) return;

    const eventToCopy = state.events[index];
    // Create a deep copy of the event (except the id and expanded state)
    const { id: _, expanded, ...eventData } = eventToCopy;

    const newId = state.nextId++;
    const newEvent = {
        ...JSON.parse(JSON.stringify(eventData)),
        id: newId,
        expanded: false
    };

    // Insert after the original event
    state.events.splice(index + 1, 0, newEvent);

    // Mở luôn bản sao để chỉnh tiếp
    selectEvent(newId);
    notify('Đã nhân bản phát bắn!', 'success');
}

// Giá trị dùng khi người dùng xóa trống các ô bắt buộc (thiếu "Đợt" thì phát bắn không bao giờ được bắn)
const REQUIRED_NUMBER_DEFAULTS = { burst: 1, x: 50, y: 50, size: 1, delay: 0 };

// Nhóm biểu tượng đang xem trong bảng chọn, giữ lại khi chuyển sang phát bắn khác
let emojiGroup = 0;

// Mở/đóng bảng chọn biểu tượng của pháo chữ. Lưới chỉ dựng khi mở vì có nhóm vài trăm biểu tượng.
function toggleEmojiPicker() {
    const picker = document.getElementById('emoji-picker');
    if (!picker) return;
    if (picker.classList.toggle('hide')) return;
    showEmojiGroup(emojiGroup);
}

function showEmojiGroup(index) {
    emojiGroup = index;
    document.querySelectorAll('#emoji-picker .emoji-tabs button').forEach((tab, i) => tab.classList.toggle('active', i === index));
    const grid = document.querySelector('#emoji-picker .emoji-grid');
    grid.innerHTML = EMOJI_GROUPS[index].emojis.map(e => `<button type="button">${e}</button>`).join('');
    grid.scrollTop = 0;
}

// Bấm vào lưới: lấy biểu tượng của nút được bấm
function pickTextEmoji(id, e) {
    const button = e.target.closest('button');
    if (button) insertTextEmoji(id, button.textContent);
}

// Chèn biểu tượng vào chỗ con trỏ trong ô chữ, không vượt quá giới hạn ký tự của ô
function insertTextEmoji(id, emoji) {
    const input = document.getElementById('f-text');
    if (!input) return;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? start;
    const value = input.value.slice(0, start) + emoji + input.value.slice(end);
    if (value.length > input.maxLength) {
        notify('Nội dung chữ đã đủ dài, không chèn thêm được.', 'warning');
        return;
    }
    input.value = value;
    // Không cuộn khung chỉnh sửa, để bảng biểu tượng đứng yên khi chọn tiếp
    input.focus({ preventScroll: true });
    input.setSelectionRange(start + emoji.length, start + emoji.length);
    updateEvent(id, 'text', value);
}

function updateEvent(id, field, value) {
    const event = state.events.find(e => e.id === id);
    if (event) {
        let needsRender = false;
        if (['burst', 'x', 'y', 'delay', 'size', 'duration', 'starLife', 'starDensity', 'spreadSize', 'starCount', 'starLifeVariation', 'transitionTime', 'strobeFreq', 'launchAngle', 'ascentSpeed', 'rotation'].includes(field)) {
            // Handle explicit undefined (e.g. rotation cleared to "random")
            if (value === undefined || value === null) {
                event[field] = undefined;
            } else {
                let num = value === '' ? NaN : Number(value);
                if (isNaN(num)) {
                    // Ô tùy chọn để trống = tự động (undefined); ô bắt buộc thì về giá trị mặc định
                    num = REQUIRED_NUMBER_DEFAULTS[field];
                    needsRender = num !== undefined;
                }
                if (num !== undefined) {
                    // Clamping logic for security
                    if (field === 'x' || field === 'y') num = Math.max(0, Math.min(100, num));
                    if (field === 'size') num = Math.max(0, Math.min(10, num));
                    if (field === 'delay') num = Math.max(0, Math.min(60000, num));
                    // Đợt phải là số nguyên, nếu không sẽ không khớp với bộ đếm đợt khi trình diễn
                    if (field === 'burst') num = Math.max(1, Math.round(num));
                    if (field === 'starLifeVariation') num = Math.max(0, Math.min(1, num));
                    if (field === 'launchAngle') num = Math.max(0, Math.min(180, num));
                    if (field === 'ascentSpeed') num = Math.max(0.1, Math.min(5, num));
                }
                event[field] = num;
            }
        } else if (['strobe', 'pistil', 'streamers', 'crossette', 'crackle', 'horsetail', 'comet', 'floral', 'ring', 'hang'].includes(field)) {
            event[field] = value === true;
        } else if (field === 'launchStyle') {
            // "Theo loại pháo" không lưu vào kịch bản
            event[field] = value || undefined;
        } else {
            event[field] = value;
        }

        // Cập nhật dòng thời gian (kèm bản xem nhanh). Bảng chỉnh sửa chỉ dựng lại khi cần hiện lại
        // giá trị mặc định của ô vừa bị xóa trống, để không làm mất con trỏ trong ô đang gõ.
        renderEventList();
        if (needsRender) {
            renderInspector();
        } else if (state.activeEventId === id) {
            refreshInspectorHeader();
            if (field === 'x' || field === 'y') syncXYPad(id);
        }
    }
}

// ---------------------------------------------------------------------------
// DÒNG THỜI GIAN: các phát bắn gom theo đợt
// ---------------------------------------------------------------------------

// Thời lượng một đợt (ms), giống trình phát (startSequence × 1.25):
// đợt có pháo = 2500ms + "Tạm dừng" dài nhất, đợt trống = 1000ms.
function getBurstDuration(events) {
    if (events.length === 0) return 1000 * 1.25;
    const pauses = events.filter(e => e.shell === 'Tạm dừng').map(e => Number(e.duration) || 2000);
    return (2500 + Math.max(0, ...pauses)) * 1.25;
}

function getMaxBurst() {
    return state.events.length > 0 ? Math.max(...state.events.map(e => Number(e.burst) || 1)) : 0;
}

function getBurstEvents(burst) {
    return state.events.filter(e => (Number(e.burst) || 1) === burst);
}

function formatDuration(ms) {
    const seconds = Math.round(ms / 100) / 10;
    if (seconds < 60) return `${seconds.toLocaleString('vi-VN')} giây`;
    const minutes = Math.floor(seconds / 60);
    const rest = Math.round(seconds - minutes * 60);
    return rest ? `${minutes} phút ${rest} giây` : `${minutes} phút`;
}

function formatNumber(value) {
    return Number(value ?? 0).toLocaleString('vi-VN', { maximumFractionDigits: 1 });
}

function updateTimelineSummary() {
    const el = document.getElementById('timeline-summary');
    if (!el) return;
    const maxBurst = getMaxBurst();
    let total = 0;
    for (let b = 1; b <= maxBurst; b++) total += getBurstDuration(getBurstEvents(b));
    const shots = state.events.filter(isFireworkShot).length;
    el.textContent = state.events.length
        ? `${maxBurst} đợt · ${shots} phát bắn · khoảng ${formatDuration(total)}`
        : 'Chưa có phát bắn nào';
}

function updateScriptNameLabel() {
    const label = document.getElementById('script-name-label');
    if (!label) return;
    const title = document.getElementById('title').value.trim();
    const filename = document.getElementById('filename').value.trim();
    label.textContent = (title || 'Kịch bản mới') + (filename ? ` · ${filename}.json` : '')
        + (draftSavedAt ? ` · đã lưu nháp ${draftSavedAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}` : '');
}

// Các chấm màu (hoặc ảnh thu nhỏ) của một phát bắn
function renderColorDots(event) {
    if (event.shell === 'Hình ảnh' && event.imageUrl) {
        return `<img class="thumb" src="${escapeHtml(normalizeAssetPath(event.imageUrl))}" alt="">`;
    }
    const colors = [].concat(event.color || []);
    return colors.slice(0, 5).map(c => (c === 'Ngẫu nhiên' || c === 'random')
        ? '<span class="dot random" title="Ngẫu nhiên"></span>'
        : `<span class="dot" style="--c: ${escapeHtml(COLOR[c] || c)}" title="${escapeHtml(c)}"></span>`
    ).join('');
}

// Phát bắn ra pháo (không phải "Tạm dừng" hay "Lời nhắn")
function isFireworkShot(event) {
    return event.shell !== 'Tạm dừng' && event.shell !== 'Lời nhắn';
}

const CAPTION_POSITIONS = [['bottom', 'Dưới (như phụ đề)'], ['middle', 'Giữa'], ['top', 'Trên']];

// Kịch bản khớp nhịp nhạc: "trễ" là lúc pháo nổ, dòng thời gian hiện mốc giây trong bài nhạc
function isSyncMode() {
    return !!(state.music && state.music.sync);
}

// Mốc trong bài nhạc (phút:giây,phần mười) của thời điểm `ms` tính từ lúc nhạc bắt đầu
function formatMusicTime(ms) {
    const total = Math.max(0, (Number(state.music?.start) || 0) + ms / 1000);
    const minutes = Math.floor(total / 60);
    const seconds = (total - minutes * 60).toFixed(1).padStart(4, '0').replace('.', ',');
    return `${minutes}:${seconds}`;
}

function renderShotRow(event, burstStart = 0) {
    const index = state.events.indexOf(event) + 1;
    const isPause = event.shell === 'Tạm dừng';
    const delayText = isSyncMode()
        ? formatMusicTime(burstStart + (Number(event.delay) || 0))
        : Number(event.delay) ? `+${formatNumber(event.delay)} ms` : 'Ngay';
    const meta = isPause
        ? `<span><i class="fas fa-hourglass-half"></i>Nghỉ ${formatDuration(Number(event.duration) || 2000)}</span>`
        : event.shell === 'Lời nhắn'
        ? `<span><i class="fas fa-${isSyncMode() ? 'music' : 'clock'}"></i>${delayText}</span>
           <span><i class="fas fa-hourglass-half"></i>Hiện ${formatDuration(Number(event.duration) || 4000)}</span>
           <span><i class="fas fa-up-down"></i>${(CAPTION_POSITIONS.find(([v]) => v === (event.position || 'bottom')) || [, ''])[1]}</span>`
        : `<span><i class="fas fa-location-dot"></i>${formatNumber(event.x)}, ${formatNumber(event.y)}</span>
           <span><i class="fas fa-${isSyncMode() ? 'music' : 'clock'}"></i>${delayText}</span>
           <span><i class="fas fa-maximize"></i>Cỡ ${formatNumber(event.size ?? 1)}</span>
           ${event.launchStyle ? `<span><i class="fas fa-rocket"></i>${(LAUNCH_STYLES.find(s => s.value === event.launchStyle) || {}).name || ''}</span>` : ''}`;

    return `
        <div class="shot-row${state.activeEventId === event.id ? ' active' : ''}${isPause ? ' is-pause' : ''}"
            data-id="${event.id}" role="button" tabindex="0"
            onclick="selectEvent(${event.id})" onkeydown="if (event.key === 'Enter') selectEvent(${event.id})">
            <span class="shot-icon">${SHELL_ICONS[event.shell] || '🎆'}</span>
            <div class="shot-main">
                <div class="shot-title">
                    <span class="shot-index">#${index}</span>${escapeHtml(event.shell)}
                    ${event.text ? `<span class="shot-text">“${escapeHtml(event.text)}”</span>` : ''}
                </div>
                <div class="shot-meta">${meta}</div>
            </div>
            <div class="shot-colors">${isPause ? '' : renderColorDots(event)}</div>
            <div class="shot-actions">
                <button class="icon-btn" onclick="event.stopPropagation(); duplicateEvent(${event.id})" title="Nhân bản"><i class="fas fa-copy"></i></button>
                <button class="icon-btn danger" onclick="event.stopPropagation(); removeEvent(${event.id})" title="Xóa"><i class="fas fa-trash"></i></button>
            </div>
        </div>`;
}

function renderBurstGroup(burst, events, burstStart = 0) {
    const duration = getBurstDuration(events);
    const shots = events.filter(isFireworkShot).length;
    const maxDelay = Math.max(0, ...events.map(e => Number(e.delay) || 0));
    // Phát bắn có thời gian trễ dài hơn cả đợt sẽ nổ chồng sang đợt sau
    const warn = maxDelay > duration
        ? `<span class="warn" title="Thêm phát Tạm dừng để kéo dài đợt này"><i class="fas fa-triangle-exclamation"></i> Có phát trễ quá thời lượng đợt</span>`
        : '';
    const info = !events.length
        ? `Trống · ${formatDuration(duration)}`
        : `${shots ? `${shots} phát` : 'Nghỉ'} · ${formatDuration(duration)} ${warn}`;

    return `
        <section class="burst-group${events.length ? '' : ' is-empty'}">
            <header class="burst-header">
                <span class="burst-badge">Đợt ${burst}</span>
                <span class="burst-info">${info}</span>
                ${isSyncMode() ? `<span class="burst-time" title="Mốc trong bài nhạc">♪ ${formatMusicTime(burstStart)}</span>` : ''}
                <button class="btn ghost small burst-add" onclick="addEventFromUI(${burst})" title="Thêm phát bắn vào đợt ${burst}">
                    <i class="fas fa-plus"></i><span>Thêm</span>
                </button>
            </header>
            <div class="burst-shots">${events.map(e => renderShotRow(e, burstStart)).join('')}</div>
        </section>`;
}

function renderEventList() {
    const container = document.getElementById('event-list');
    updateTimelineSummary();
    updateTemplateStrip();
    // Thiệp chia sẻ tự động lấy màu theo các phát bắn
    scheduleSeoPreview();

    // Xem theo giây (chỉ khi đã có phát bắn; trống thì vẫn hiện lời mời thêm phát)
    document.querySelectorAll('.timeline-views button').forEach(btn => btn.classList.toggle('active', btn.dataset.view === timelineView));
    document.getElementById('track-tools')?.classList.toggle('hide', timelineView !== 'track');
    const showTrack = timelineView === 'track' && state.events.length > 0;
    container.classList.toggle('hide', showTrack);
    document.getElementById('track-view')?.classList.toggle('hide', !showTrack);
    if (showTrack) {
        renderTrackTools();
        getTrack().render();
        refreshMiniPreview();
        return;
    }

    if (state.events.length === 0) {
        container.innerHTML = `
            <div class="timeline-empty">
                <i class="fas fa-wand-magic-sparkles"></i>
                <p>Chưa có phát bắn nào. Thêm phát đầu tiên để bắt đầu màn trình diễn.</p>
                <button class="btn primary" onclick="addEventFromUI()"><i class="fas fa-plus"></i> Thêm phát bắn</button>
            </div>`;
        refreshMiniPreview();
        return;
    }

    let html = '';
    const maxBurst = getMaxBurst();
    let burstStart = 0;
    for (let b = 1; b <= maxBurst; b++) {
        const events = getBurstEvents(b);
        html += renderBurstGroup(b, events, burstStart);
        burstStart += getBurstDuration(events);
    }
    container.innerHTML = html;
    // Danh sách thay đổi (thêm/xóa/nhân bản/đổi màu/loại pháo...) thì cập nhật bản xem nhanh
    refreshMiniPreview();
}

// Thêm phát bắn từ giao diện rồi mở luôn bảng chỉnh sửa.
// Mặc định vào cùng đợt với phát đang chọn (không chọn thì vào đợt cuối).
function addEventFromUI(burst) {
    const active = state.events.find(e => e.id === state.activeEventId);
    const targetBurst = burst ?? (active ? Number(active.burst) || 1 : Math.max(1, getMaxBurst()));
    addEvent({ burst: targetBurst });

    // Đặt ngay sau phát cuối cùng của đợt đó để số thứ tự (#) liền mạch
    const added = state.events.pop();
    let insertAt = 0;
    state.events.forEach((e, i) => { if ((Number(e.burst) || 1) <= targetBurst) insertAt = i + 1; });
    state.events.splice(insertAt, 0, added);

    selectEvent(added.id);
    document.querySelector(`.shot-row[data-id="${added.id}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

// Thêm một phát bắn ở đợt mới (sau đợt cuối)
function addBurst() {
    addEventFromUI(getMaxBurst() + 1);
}

function selectEvent(id) {
    state.activeEventId = id;
    renderEventList();
    if (timelineView === 'track' && track) track.reveal(id);
    renderInspector();
    updateMiniInfo();
    // Bắn ngay phát vừa chọn trong khung xem nhanh
    sendPreview(true);
}

function closeInspector() {
    state.activeEventId = null;
    renderEventList();
    renderInspector();
    updateMiniInfo();
    // Xem nhanh quay lại chạy cả kịch bản
    sendPreview(true);
}

// ---------------------------------------------------------------------------
// GIẢI THÍCH NHANH: nút "?" cạnh tên mục (helpTip(key) trong JS, <button class="help-tip" data-help="key"> trong HTML).
// Rê chuột, bấm/chạm hoặc Tab tới để xem giải thích; thêm mục mới chỉ cần thêm một dòng vào HELP_TIPS.
// ---------------------------------------------------------------------------

const HELP_TIPS = {
    // Cấu hình chung
    title: 'Dòng chữ lớn hiện khi màn trình diễn bắt đầu. Cũng là tiêu đề khi gửi link nếu mục <strong>Chia sẻ & SEO</strong> để trống.',
    subtitle: 'Câu ngắn hiện dưới tiêu đề. Ô <strong>Lời chúc ở màn kết</strong> và mô tả khi chia sẻ để trống thì dùng câu này.',
    author: 'Tên người tặng, hiện dưới tiêu đề và trên màn kết. VD: <em>Từ: Con gái</em>.',
    startFrame: 'Màn hình đầu tiên khi mở link. Trình duyệt chỉ cho phát âm thanh sau một lần chạm nên người xem luôn mở quà trước. '
        + '<strong>Thiệp chào</strong>: lời mời và nút Mở quà. <strong>Hộp quà</strong>: hộp rung rinh, chạm vào thì bung ruy băng.',
    recipient: 'Tên người nhận. Có tên thì link mở bằng "Gửi [tên]" và nút "Mở quà"; để trống thì hiện lời chào chung.',
    introMessage: 'Một hai câu trên thiệp hoặc hộp quà trước khi mở. VD: <em>Bật loa lên và mở quà nhé!</em>',
    outroMessage: 'Lời chúc trên màn kết, hiện khi chạy hết một lượt (chỉ khi tắt <strong>Tự động lặp lại</strong>). Để trống thì dùng Dòng phụ.',
    schedule: 'Trước giờ hẹn, link chỉ hiện đồng hồ đếm ngược. <strong>Khóa tới giờ</strong>: tới giờ người nhận tự mở quà. '
        + '<strong>Bắn đúng giờ</strong>: ai bấm "Tôi đã sẵn sàng" và để trang mở sẽ thấy pháo tự bắn đúng khoảnh khắc, hợp cho giao thừa. '
        + 'Người ở múi giờ khác vẫn mở đúng lúc.',
    seoTitle: 'Tiêu đề in đậm trong khung xem trước khi gửi link qua Messenger, Zalo, Facebook. Để trống thì dùng Tiêu đề.',
    seoDescription: 'Dòng mô tả dưới tiêu đề trong khung xem trước khi gửi link. Để trống thì ghép từ Dòng phụ và Người thực hiện.',
    seoImage: 'Ảnh 1200×630 hiện khi gửi link. <strong>Thiệp tự động</strong>: vẽ từ tiêu đề và màu pháo. '
        + '<strong>Ảnh của bạn</strong>: tải ảnh lên, chọn có chèn chữ và chỗ cắt ảnh. Ảnh được tạo lại mỗi lần bấm Lưu.',
    background: 'Cảnh thành phố về đêm phía dưới bầu trời. Bật lên rồi bấm vào ảnh để thay bằng ảnh của bạn.',
    water: 'Nâng đường chân trời lên 1/3 hoặc nửa màn hình: pháo bắn lên từ mép nước, phía dưới là mặt nước phản chiếu pháo, '
        + 'khói, đèn trời và ảnh nền (ảnh nền đứng trên mép nước). Độ cao 0 của mỗi phát bắn là mặt nước, nên bố cục cũ vẫn giữ nguyên, '
        + 'chỉ thu gọn vào phần trời.',
    decor: '<strong>Đèn trời</strong>: những chiếc đèn lồng giấy chập chờn bay lên chậm. <strong>Khinh khí cầu</strong>: vài khinh khí cầu '
        + 'trôi ngang, thỉnh thoảng bừng sáng khi đốt lửa. Chỉ để trang trí, không ảnh hưởng tới các phát bắn.',
    smoke: 'Như pháo hoa thật: mỗi quả nổ để lại một đám khói trắng, đường bay lên có vệt khói mảnh. Khói nở dần, trôi theo gió rồi tan, '
        + 'và được những quả nổ sau rọi màu. <strong>Nhẹ</strong>: thoáng qua. <strong>Dày</strong>: đám khói đặc, lâu tan. '
        + 'Máy người xem đặt chất lượng Thấp thì không có khói để khỏi giật.',
    reduceFlashing: 'Bật khi người nhận nhạy cảm với ánh sáng nhấp nháy (người lớn tuổi, người dễ bị co giật do ánh sáng...): hạt pháo không chớp tắt hay lấp lánh, '
        + 'không có quầng chớp lúc nổ, bầu trời không đổi màu theo pháo. Người xem cũng tự bật được bằng nút "Giảm chớp sáng" trên màn mở quà.',
    loop: 'Bật: chạy hết đợt cuối thì quay lại đợt đầu, bắn mãi. Tắt: chạy một lượt rồi hiện màn kết với lời chúc và nút Xem lại.',
    music: 'Nhạc phát cùng đợt pháo đầu tiên. Chọn file từ máy (tối đa 20MB) hoặc dán link trực tiếp tới file .mp3; link trang YouTube, Zing không dùng được.',
    musicStart: 'Bỏ đoạn dạo đầu: nhạc phát từ giây này. Nghe trên thanh phát rồi bấm nút <i class="fas fa-location-crosshairs"></i> để lấy đúng chỗ đang nghe.',
    musicVolume: 'Độ to của nhạc nền so với tiếng pháo.',
    musicSync: 'Bật: "Nổ sau" của mỗi phát là lúc pháo <strong>nổ</strong> (pháo tự phóng sớm cho kịp) và pháo bám theo bài nhạc nên nổ đúng phách; '
        + 'dòng thời gian hiện mốc ♪ trong bài. Nút <strong>Xếp pháo theo nhịp nhạc</strong> tự bật mục này.',
    effectsVolume: 'Độ to của tiếng phóng và tiếng nổ. Có nhạc nền thì nên giảm để nghe rõ nhạc; 0% là tắt hẳn.',
    filename: 'Tên dùng để lưu và làm link chia sẻ (…/s/ten-file.html). Chỉ chữ không dấu, số, gạch nối, gạch dưới. Trùng tên kịch bản khác thì tự thêm số.',
    timelineTrack: 'Mỗi nút là một phát bắn đặt đúng thời điểm (lúc phóng; khi khớp nhịp nhạc là lúc nổ), phía trên là sóng nhạc và vạch phách. '
        + '<strong>Kéo ngang</strong> để đổi thời điểm (bám phách hoặc theo 0,1 giây; giữ Alt để thả tự do), <strong>bấm</strong> để chỉnh, '
        + '<strong>nhấn đúp</strong> chỗ trống để thêm phát, phím mũi tên để nhích. Các phát khác giữ nguyên thời điểm, đợt được xếp lại tự động.',
    timeline: 'Kịch bản gồm các <strong>đợt</strong> chạy lần lượt, mỗi đợt khoảng 3 giây. Các phát cùng đợt bắn cùng lúc, trừ khi đặt <strong>Trễ</strong>. '
        + 'Thêm phát <strong>Tạm dừng</strong> để kéo dài một đợt. Bấm vào một phát để chỉnh.',
    preview: 'Chạy chính trình phát thật nên giống hệt khi gửi đi. Đang chọn một phát thì chỉ bắn lặp phát đó. '
        + 'Khung này không có tiếng pháo: bấm <i class="fas fa-music"></i> để nghe nhạc nền, hoặc <strong>Xem thử</strong> để nghe đầy đủ.',
    // Xếp pháo theo nhịp nhạc
    beatDensity: '<strong>Thưa</strong>: chủ yếu phách đầu mỗi ô nhịp. <strong>Vừa</strong>: thêm các phách khác ở đoạn sôi động. '
        + '<strong>Dày</strong>: thêm phát nhỏ giữa các phách ở đoạn cao trào; máy yếu có thể giật.',
    beatLength: 'Bắn tới đâu trong bài, tính từ giây bắt đầu ở mục Nhạc nền. Bài rất dài thì tối đa 8 phút.',
    beatKeep: 'Chữ trên trời, hình ảnh và lời nhắn đang có được đặt vào các phách mạnh trải đều suốt bài, giữ thứ tự cũ. '
        + 'Quanh chữ và ảnh không bắn pháo khác cho dễ nhìn.',
    // Bảng chỉnh sửa phát bắn
    shellType: 'Hình dạng khi nổ. <strong>Văn bản</strong>: chữ trên trời. <strong>Hình ảnh</strong>: ảnh lớn dần trong khung. '
        + '<strong>Lời nhắn</strong>: dòng chữ như phụ đề, không bắn pháo. <strong>Tạm dừng</strong>: kéo dài đợt.',
    launchStyle: 'Cách pháo bay lên trước khi nổ (xoắn đôi, nổ dọc đường, bay nhiều tầng, đạn tàng hình...). Dùng được với mọi loại pháo.',
    burst: 'Các phát cùng đợt bắn cùng lúc; các đợt chạy lần lượt từ nhỏ đến lớn. Đổi số đợt để chuyển phát này sang đợt khác.',
    delay: () => (isSyncMode()
        ? 'Kịch bản đang <strong>khớp nhịp nhạc</strong>: đây là lúc pháo <strong>nổ</strong>, tính từ đầu đợt (1000 ms = 1 giây). Pháo tự phóng sớm hơn cho kịp.'
        : 'Chờ bao lâu kể từ đầu đợt rồi mới phóng (1000 ms = 1 giây). Dùng để các phát nổ nối tiếp nhau thay vì cùng lúc.'),
    text: 'Chữ hiện trên trời bằng hạt pháo, tối đa 60 ký tự; chèn được biểu tượng cảm xúc (🎓, ❤️, 🎂...), để màu "Ngẫu nhiên" thì '
        + 'biểu tượng giữ màu gốc của nó. Mã tự thay: <strong>[YEAR]</strong> năm hiện tại, '
        + '<strong>[LUNAR_YEAR]</strong> tên năm âm lịch, <strong>[SINCE:2000]</strong> số năm kể từ năm 2000.',
    captionDuration: 'Lời nhắn hiện trên màn hình bao lâu rồi mờ dần (1000 ms = 1 giây).',
    position: 'Bấm hoặc kéo trên khung để chọn điểm nổ. Số nhỏ trên khung là các phát khác cùng đợt, giúp tránh nổ chồng lên nhau.',
    x: 'Vị trí ngang của điểm nổ: 0 là mép trái, 100 là mép phải. Trên điện thoại được thu vào giữa cho khỏi tràn màn hình.',
    y: 'Độ cao của điểm nổ: 0 là mặt đất, 100 là đỉnh trời. Cao hơn thì pháo bay lâu hơn.',
    size: 'Cỡ chùm nổ, 1 là cỡ chuẩn. Lớn hơn thì chùm to và nhiều hạt hơn, máy yếu có thể giật.',
    rotation: 'Xoay các pháo hình (trái tim, ngôi sao, bướm...) theo độ. Để trống thì mỗi lần nổ nghiêng ngẫu nhiên một chút. Chữ không bị xoay.',
    sounds: 'Âm thanh lúc phóng, lúc bay (tiếng huýt) và lúc nổ; "Mặc định" là âm của loại pháo. Khung xem nhanh không phát tiếng, bấm <strong>Xem thử</strong> để nghe.',
    effects: '<ul>'
        + '<li><strong>Nhấp nháy</strong>: hạt chớp tắt liên tục.</li>'
        + '<li><strong>Lách tách</strong>: hạt tàn thì nổ lép bép.</li>'
        + '<li><strong>Nổ chéo</strong>: mỗi hạt tách thành 4 tia.</li>'
        + '<li><strong>Nhụy ở giữa</strong>: thêm một chùm nhỏ ở tâm.</li>'
        + '<li><strong>Dải sáng</strong>: vài vệt sáng dài bay xa.</li>'
        + '<li><strong>Đuôi ngựa</strong>: hạt rủ xuống như bờm ngựa.</li>'
        + '<li><strong>Hoa nở</strong>: mỗi hạt tàn lại nở thành một chùm nhỏ.</li>'
        + '<li><strong>Vòng nhẫn</strong>: hạt xếp thành vòng tròn.</li>'
        + '<li><strong>Cháy lâu, rơi chậm</strong>: hạt sáng lâu và lơ lửng.</li>'
        + '</ul>Ô đã tích sẵn và không bỏ được là hiệu ứng có sẵn của loại pháo.',
    glitter: 'Tia lửa nhỏ tóe ra sau mỗi hạt khi bay: Nhẹ, Vừa, Dày, Đặc là nhiều dần; Dải sáng là vệt dài; Liễu là tia rủ xuống.',
    starDensity: 'Nhân số hạt so với mặc định của loại pháo: 2 là gấp đôi (dày hơn, nặng máy hơn), 0,5 là một nửa.',
    starCount: 'Đặt đúng số hạt, bỏ qua Mật độ hạt. Để trống thì tự tính theo cỡ pháo.',
    starLife: 'Mỗi hạt sáng bao lâu rồi tắt (1000 ms = 1 giây). Để trống thì theo loại pháo, VD Liễu khoảng 3 giây, Cháy lâu khoảng 6 giây.',
    starLifeVariation: 'Độ chênh tuổi thọ giữa các hạt, từ 0 đến 1. 0: mọi hạt tắt cùng lúc. Lớn hơn: tắt lác đác, trông tự nhiên hơn.',
    spreadSize: 'Độ rộng chùm nổ: lớn hơn thì hạt bay xa tâm hơn. Để trống thì theo loại pháo và cỡ pháo.',
    strobeFreq: 'Dùng khi bật Nhấp nháy: mỗi lần chớp cách nhau bao nhiêu ms. Nhỏ hơn thì nháy nhanh hơn.',
    secondColor: 'Hạt đổi sang màu này sau một lúc; chọn thời điểm ở ô Lúc chuyển màu.',
    transitionTime: 'Sau bao nhiêu ms kể từ lúc nổ thì hạt đổi sang Màu chuyển sang. Để trống thì tự chọn.',
    glitterColor: 'Màu tia lửa lấp lánh tóe ra sau mỗi hạt.',
    pistilColor: 'Màu chùm nhỏ ở tâm, dùng khi bật Nhụy ở giữa.',
    // Báo mở quà
    notifyOpen: 'Biết khi người nhận <strong>mở link</strong>, <strong>bấm mở quà</strong> và <strong>xem hết</strong> (chỉ thời điểm và loại thiết bị, '
        + 'không có thông tin cá nhân). Xem trong hộp Chia sẻ, danh sách Kịch bản của tôi hoặc link theo dõi riêng. '
        + 'Người nhận thấy một dòng nhỏ "Người gửi sẽ biết khi bạn mở quà". Cần bản có máy chủ PHP.',
    giftTracking: 'Trạng thái món quà: đã mở link, đã mở quà, đã xem hết. Link theo dõi riêng mở được trên mọi máy, hãy giữ bí mật. '
        + 'Bạn tự mở thử trên máy này (hoặc máy đã mở link theo dõi) thì không tính là người nhận mở.',
    // Xuất video
    videoFormat: '<strong>Dọc 9:16</strong>: TikTok, Story, Reels, xem trên điện thoại (pháo bố trí như trên điện thoại). '
        + '<strong>Ngang 16:9</strong>: YouTube, Facebook, màn hình máy tính. <strong>Vuông 1:1</strong>: bài đăng Facebook, Instagram.',
    videoQuality: '<strong>Full HD</strong> (1080p): nét nhất, file nặng hơn. <strong>HD</strong> (720p): file nhẹ khoảng một nửa, '
        + 'gửi qua Zalo, Messenger nhanh hơn và đỡ nặng máy khi quay.',
    strobeColor: 'Màu lúc hạt chớp sáng, dùng khi bật Nhấp nháy.'
};

function helpTip(key) {
    return `<button type="button" class="help-tip" data-help="${key}" aria-label="Giải thích">?</button>`;
}

// Một khung giải thích dùng chung, đặt ngay dưới (hoặc trên) nút "?" và không tràn khỏi màn hình
const helpTooltip = {
    el: null,
    anchor: null,
    // Bấm/chạm để ghim: chỉ đóng khi bấm ra ngoài, bấm lại nút hoặc nhấn Esc
    pinned: false,
    timer: null,
    frame: null,

    init() {
        const el = document.createElement('div');
        el.id = 'help-tooltip';
        el.className = 'help-tooltip';
        el.setAttribute('role', 'tooltip');
        el.hidden = true;
        el.innerHTML = '<div class="help-tooltip__body"></div><span class="help-tooltip__arrow"></span>';
        document.body.appendChild(el);
        this.el = el;

        // Pha bắt: nút "?" nằm trong nhãn, tiêu đề mục thu gọn, dòng phát bắn... không để các phần đó nhận cú bấm
        document.addEventListener('click', (e) => {
            const tip = e.target.closest('.help-tip[data-help]');
            if (tip) {
                e.preventDefault();
                e.stopPropagation();
                if (this.anchor === tip && this.pinned) this.hide();
                else this.show(tip, true);
            } else if (this.anchor && !el.contains(e.target)) {
                this.hide();
            }
        }, true);

        if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
            document.addEventListener('mouseover', (e) => {
                const tip = e.target.closest && e.target.closest('.help-tip[data-help]');
                if (!tip) return;
                clearTimeout(this.timer);
                if (tip !== this.anchor) this.timer = setTimeout(() => this.show(tip, false), 120);
            });
            document.addEventListener('mouseout', (e) => {
                const tip = e.target.closest && e.target.closest('.help-tip[data-help]');
                if (!tip || tip.contains(e.relatedTarget)) return;
                clearTimeout(this.timer);
                if (tip === this.anchor && !this.pinned) this.timer = setTimeout(() => this.hide(), 120);
            });
        }

        // Bàn phím: Tab tới nút thì hiện, rời đi thì ẩn, Esc để đóng
        document.addEventListener('focusin', (e) => {
            if (e.target.matches('.help-tip[data-help]') && e.target.matches(':focus-visible')) this.show(e.target, false);
        });
        document.addEventListener('focusout', (e) => {
            if (e.target === this.anchor && !this.pinned) this.hide();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.anchor) {
                // Chỉ đóng khung giải thích, chưa đóng hộp thoại phía sau
                e.stopPropagation();
                this.hide();
            }
        }, true);
    },

    show(anchor, pinned) {
        const tip = HELP_TIPS[anchor.dataset.help];
        if (!tip) return;
        clearTimeout(this.timer);
        if (this.anchor && this.anchor !== anchor) this.release();
        this.anchor = anchor;
        this.pinned = pinned;
        anchor.classList.add('active');
        anchor.setAttribute('aria-describedby', 'help-tooltip');
        this.el.querySelector('.help-tooltip__body').innerHTML = typeof tip === 'function' ? tip() : tip;
        this.el.hidden = false;
        this.place();
        // Bám theo nút khi cuộn hoặc bảng được dựng lại
        if (!this.frame) this.follow();
    },

    hide() {
        clearTimeout(this.timer);
        cancelAnimationFrame(this.frame);
        this.frame = null;
        this.release();
        this.anchor = null;
        this.pinned = false;
        this.el.hidden = true;
    },

    release() {
        if (!this.anchor) return;
        this.anchor.classList.remove('active');
        this.anchor.removeAttribute('aria-describedby');
    },

    follow() {
        this.frame = requestAnimationFrame(() => {
            this.frame = null;
            if (!this.anchor) return;
            if (!this.anchor.isConnected || !this.anchor.offsetParent) {
                this.hide();
                return;
            }
            this.place();
            this.follow();
        });
    },

    place() {
        const margin = 8;
        const gap = 10;
        const rect = this.anchor.getBoundingClientRect();
        // Nút đã cuộn ra khỏi màn hình
        if (rect.bottom < 0 || rect.top > window.innerHeight) {
            this.hide();
            return;
        }
        const el = this.el;
        const width = el.offsetWidth;
        const height = el.offsetHeight;
        const center = rect.left + rect.width / 2;
        const left = Math.max(margin, Math.min(center - width / 2, window.innerWidth - width - margin));
        // Ưu tiên hiện bên dưới; không đủ chỗ thì lật lên trên
        const below = rect.bottom + gap + height <= window.innerHeight - margin || rect.top - gap - height < margin;
        el.style.left = `${Math.round(left)}px`;
        el.style.top = `${Math.round(below ? rect.bottom + gap : rect.top - gap - height)}px`;
        el.classList.toggle('is-above', !below);
        el.style.setProperty('--arrow-x', `${Math.round(center - left)}px`);
    }
};

// ---------------------------------------------------------------------------
// BẢNG CHỈNH SỬA phát bắn đang chọn
// ---------------------------------------------------------------------------

// Mục nào đang mở/thu gọn (giữ nguyên khi chuyển sang phát bắn khác)
const openSections = { type: false, basic: true, position: true, color: true, sound: false, advanced: false };

function rememberSection(el) {
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
        sub: event.shell === 'Tạm dừng' ? `Đợt ${event.burst}` : `Đợt ${event.burst} · ${delay}`
    };
}

// Cập nhật tiêu đề bảng chỉnh sửa mà không dựng lại cả bảng (giữ con trỏ trong ô đang gõ)
function refreshInspectorHeader() {
    const event = state.events.find(e => e.id === state.activeEventId);
    if (!event) return;
    const { title, sub } = renderInspectorHeaderText(event);
    const titleEl = document.getElementById('insp-title');
    const subEl = document.getElementById('insp-sub');
    if (titleEl) titleEl.innerHTML = title;
    if (subEl) subEl.textContent = sub;
}

function renderInspector() {
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
                    ${event.imageUrl ? `<img src="${escapeHtml(normalizeAssetPath(event.imageUrl))}" class="full-thumb" alt="">` : '<i class="fas fa-cloud-arrow-up"></i>'}
                    <span>${event.imageUrl ? 'Đổi ảnh khác' : 'Chọn ảnh từ thiết bị'}</span>
                </div>
                <input type="file" id="image-file-${event.id}" class="hide" accept="image/*" onchange="handleImageUpload(${event.id}, this)">
                <button type="button" class="btn secondary small library-pick" onclick="openLibrary('images', ${event.id})">
                    <i class="fas fa-images"></i><span>Chọn từ kho ảnh</span></button>
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
                <input type="number" id="f-duration" step="500" min="1500" max="20000" value="${event.duration ?? ''}" placeholder="4500"
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
                    <input type="number" id="f-duration" step="500" min="1000" max="30000" value="${event.duration ?? ''}" placeholder="4000"
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
                <input type="number" id="f-duration" step="500" min="0" value="${event.duration || 2000}" onchange="updateEvent(${event.id}, 'duration', this.value)">
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
        ${specific}`);

    if (isPause) {
        panel.innerHTML = header + basicSection;
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
                <output id="out-launchAngle">${event.launchAngle ?? 90}°</output>
            </div>
            <input type="range" id="f-launchAngle" min="0" max="180" step="5" value="${event.launchAngle ?? 90}"
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
        panel.innerHTML = header + typeSection + basicSection + colorSection;
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
        <small class="note">Âm thanh chỉ nghe được khi bấm "Xem thử" (khung xem nhanh không phát tiếng).</small>`, 'sounds');

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

    // Vị trí (chỉnh nhiều nhất) ngay dưới loại pháo để không phải cuộn mới tới; kiểu bắn ít đổi nên xuống dưới
    panel.innerHTML = header + typeSection + positionSection + basicSection + launchSection + colorSection + soundSection + advancedSection;
    panel.scrollTop = keepScroll;
    initXYPad(event);
}

// Điện thoại: ngăn chỉnh sửa bắt đầu ngay dưới khung xem nhanh để vừa chỉnh vừa thấy pháo
// (luôn chừa ít nhất 45% chiều cao màn hình cho ngăn chỉnh sửa)
function positionMobileSheet() {
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

function handleShellChange(id, value) {
    updateEvent(id, 'shell', value);
    renderEventList();
    renderInspector();
}

function changeBurst(id, delta) {
    const event = state.events.find(e => e.id === id);
    if (!event) return;
    updateEvent(id, 'burst', (Number(event.burst) || 1) + delta);
    renderEventList();
    renderInspector();
}

// Bật/tắt một màu có sẵn: "Ngẫu nhiên" là lựa chọn riêng, các màu khác cộng dồn
function toggleEventColor(id, color) {
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

function addCustomColor(id) {
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
function syncXYPad(id) {
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

// Chữ có dấu -> chữ thường không dấu, nối bằng gạch dưới ("Chúc mừng Đạt" -> "chuc_mung_dat")
function toSlug(text) {
    return String(text || '')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd').replace(/Đ/g, 'D')
        .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
        .slice(0, 40);
}

// Thư mục trên máy chủ chứa ảnh/nhạc tải lên: theo tên file kịch bản. Chưa đặt tên thì lấy theo tiêu đề
// (không bắt người dùng điền tên trước, rồi bỏ mất file vừa chọn).
function getUploadFolder() {
    const filename = document.getElementById('filename').value.trim();
    if (/^[a-zA-Z0-9_-]+$/.test(filename)) return filename;
    return toSlug(document.getElementById('title').value) || 'chua_dat_ten';
}

async function handleImageUpload(id, input) {
    const file = input.files[0];
    if (!file) return;

    const scenarioName = getUploadFolder();

    showLoading('Đang xử lý hình ảnh...');

    if (isStaticEnv) {
        // Trên GitHub Pages hoặc môi trường tĩnh, dùng FileReader để lấy DataURL
        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target.result;
            updateEvent(id, 'imageUrl', dataUrl);
            renderInspector();
            hideLoading();
            notify('Đã tải ảnh lên (Lưu cục bộ dưới dạng DataURL)!', 'success');
        };
        reader.onerror = () => {
            hideLoading();
            notify('Lỗi khi đọc file ảnh.', 'error');
        };
        reader.readAsDataURL(file);
        return;
    }

    const formData = new FormData();
    formData.append('image', file);
    formData.append('filename', scenarioName);

    try {
        const response = await fetch('api/upload_image.php', {
            method: 'POST',
            body: formData
        });
        const data = await response.json();

        hideLoading();
        if (data.success) {
            updateEvent(id, 'imageUrl', data.url);
            renderInspector();
            notify('Tải ảnh lên thành công!', 'success');
        } else {
            notify('Lỗi: ' + data.message, 'error');
        }
    } catch (e) {
        hideLoading();
        notify('Lỗi kết nối khi tải ảnh.', 'error');
    }
}

window.handleImageUpload = handleImageUpload;

// ---------------------------------------------------------------------------
// NHẠC NỀN
// ---------------------------------------------------------------------------

function getMusicAudio() {
    return document.getElementById('music-audio');
}

// Đồng bộ mục "Nhạc nền" và "Âm lượng tiếng pháo" theo state
function renderMusic() {
    scheduleSettingsSummaries();
    const music = state.music;
    const audio = getMusicAudio();
    if (!audio) return;
    document.getElementById('music-empty').classList.toggle('hide', !!music);
    document.getElementById('music-card').classList.toggle('hide', !music);
    if (music) {
        document.getElementById('music-name').textContent = music.name || decodeURIComponent(music.url.split('/').pop().split('?')[0]) || 'Nhạc nền';
        const src = normalizeAssetPath(music.url);
        if (audio.dataset.src !== src) {
            audio.dataset.src = src;
            audio.src = src;
        }
        const volume = Math.round((music.volume ?? 0.8) * 100);
        document.getElementById('music-start').value = music.start || 0;
        document.getElementById('music-volume').value = volume;
        document.getElementById('out-music-volume').textContent = volume + '%';
        audio.volume = volume / 100;
        document.getElementById('music-sync').checked = !!music.sync;
        document.getElementById('music-sync-hint').textContent = music.sync
            ? `Pháo nổ đúng lúc đã đặt, bám theo bài nhạc${music.bpm ? ` · nhịp ${formatNumber(music.bpm)} BPM` : ''}`
            : 'Pháo nổ đúng lúc đã đặt, bám theo bài nhạc';
    } else if (audio.dataset.src) {
        stopPreviewMusic();
        delete audio.dataset.src;
        audio.removeAttribute('src');
        audio.load();
    }
    const effects = Math.round(state.effectsVolume * 100);
    document.getElementById('effects-volume').value = effects;
    document.getElementById('out-effects-volume').textContent = effects + '%';
    updateMusicPreviewButton();
}

function setMusic(music) {
    state.music = { volume: state.music?.volume ?? 0.8, start: 0, ...music };
    renderMusic();
}

// ---------------------------------------------------------------------------
// Kho nhạc, kho ảnh có sẵn: library/music/index.json, library/images/index.json (thêm bài, ảnh: xem library/README.md)
// ---------------------------------------------------------------------------
const LIBRARY_KINDS = {
    music: { title: '<i class="fas fa-compact-disc"></i> Kho nhạc', note: 'Nhạc trong kho thuộc phạm vi công cộng, dùng tự do. Bấm ▶ để nghe thử.' },
    images: { title: '<i class="fas fa-images"></i> Kho ảnh', note: 'Bấm vào ảnh để dùng cho pháo ảnh này. Muốn dùng ảnh riêng thì bấm "Chọn ảnh từ thiết bị".' }
};
const library = { kind: 'music', eventId: null, tag: '', items: {}, audio: null, playingId: null };

async function loadLibrary(kind) {
    if (!library.items[kind]) {
        const res = await fetch(`library/${kind}/index.json`, { cache: 'no-cache' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        library.items[kind] = await res.json();
    }
    return library.items[kind];
}

async function openLibrary(kind, eventId) {
    Object.assign(library, { kind, eventId: eventId ?? null, tag: '' });
    document.getElementById('library-title').innerHTML = LIBRARY_KINDS[kind].title;
    document.getElementById('library-note').textContent = LIBRARY_KINDS[kind].note;
    document.getElementById('library-tags').innerHTML = '';
    const list = document.getElementById('library-list');
    list.className = `library-list is-${kind}`;
    list.innerHTML = '<div class="spinner"></div>';
    showModal('library-modal');
    try {
        await loadLibrary(kind);
        renderLibrary();
    } catch (e) {
        list.innerHTML = `<p class="library-empty">Không tải được ${kind === 'music' ? 'kho nhạc' : 'kho ảnh'}. Thử lại sau.</p>`;
    }
}

function closeLibrary() {
    stopLibraryPreview();
    hideModal('library-modal');
}

function setLibraryTag(tag) {
    library.tag = tag;
    renderLibrary();
}

function libraryUrl(item) {
    return `./library/${library.kind}/${item.file}`;
}

function renderLibrary() {
    const items = library.items[library.kind] || [];
    const tags = [...new Set(items.flatMap(item => item.tags || []))];
    document.getElementById('library-tags').innerHTML = ['', ...tags].map(tag => `
        <button type="button" class="template-chip${library.tag === tag ? ' active' : ''}" onclick="setLibraryTag('${escapeHtml(tag)}')">
            ${tag ? escapeHtml(tag) : 'Tất cả'}</button>`).join('');
    const shown = items.filter(item => !library.tag || (item.tags || []).includes(library.tag));
    const list = document.getElementById('library-list');
    if (library.kind === 'music') {
        const current = state.music && normalizeAssetPath(state.music.url);
        list.innerHTML = shown.map(item => {
            const inUse = current === normalizeAssetPath(libraryUrl(item));
            const minutes = Math.floor((item.duration || 0) / 60);
            const seconds = String(Math.round((item.duration || 0) % 60)).padStart(2, '0');
            return `
            <div class="library-track${inUse ? ' in-use' : ''}">
                <button type="button" class="library-play" onclick="toggleLibraryPreview('${escapeHtml(item.id)}')"
                    title="Nghe thử" aria-label="Nghe thử ${escapeHtml(item.name)}"><i class="fas fa-${library.playingId === item.id ? 'pause' : 'play'}"></i></button>
                <div class="library-track-info">
                    <strong>${escapeHtml(item.name)}</strong>
                    <span>${escapeHtml(item.artist || '')}${item.duration ? ` · ${minutes}:${seconds}` : ''}</span>
                    <span class="library-track-tags">${(item.tags || []).map(t => `<em>${escapeHtml(t)}</em>`).join('')}</span>
                </div>
                <button type="button" class="btn ${inUse ? 'secondary' : 'primary'} small" onclick="chooseLibraryItem('${escapeHtml(item.id)}')">
                    ${inUse ? '<i class="fas fa-check"></i> Đang dùng' : 'Dùng'}</button>
            </div>`;
        }).join('') || '<p class="library-empty">Chưa có bài nào.</p>';
    } else {
        const event = state.events.find(e => e.id === library.eventId);
        const current = event && event.imageUrl && normalizeAssetPath(event.imageUrl);
        list.innerHTML = shown.map(item => `
            <button type="button" class="library-image${current === normalizeAssetPath(libraryUrl(item)) ? ' in-use' : ''}"
                onclick="chooseLibraryItem('${escapeHtml(item.id)}')" title="${escapeHtml(item.name)}">
                <img src="${escapeHtml(libraryUrl(item))}" alt="" loading="lazy">
                <span>${escapeHtml(item.name)}</span>
            </button>`).join('') || '<p class="library-empty">Chưa có ảnh nào.</p>';
    }
}

function toggleLibraryPreview(id) {
    const item = (library.items.music || []).find(i => i.id === id);
    if (!item) return;
    const wasPlaying = library.playingId === id;
    stopLibraryPreview();
    if (!wasPlaying) {
        stopPreviewMusic();
        library.audio = new Audio(libraryUrl(item));
        library.audio.addEventListener('ended', stopLibraryPreview);
        library.audio.play().catch(() => notify('Không phát được bài này.', 'error'));
        library.playingId = id;
    }
    renderLibrary();
}

function stopLibraryPreview() {
    if (library.audio) {
        library.audio.pause();
        library.audio = null;
    }
    if (library.playingId) {
        library.playingId = null;
        if (!document.getElementById('library-modal').classList.contains('hide')) renderLibrary();
    }
}

function chooseLibraryItem(id) {
    const item = (library.items[library.kind] || []).find(i => i.id === id);
    if (!item) return;
    if (library.kind === 'music') {
        setMusic({ url: libraryUrl(item), name: `${item.name} – ${item.artist}` });
        refreshMiniPreview();
        notify(`Đã chọn nhạc nền "${item.name}".`, 'success');
    } else if (state.events.some(e => e.id === library.eventId)) {
        updateEvent(library.eventId, 'imageUrl', libraryUrl(item));
        renderInspector();
        notify(`Đã dùng ảnh "${item.name}".`, 'success');
    }
    closeLibrary();
}

function removeMusic() {
    state.music = null;
    previewMusicOn = false;
    renderMusic();
}

// Điểm bắt đầu = chỗ đang nghe trên thanh phát nhạc
function useCurrentMusicTime() {
    if (!state.music) return;
    state.music.start = Math.round(getMusicAudio().currentTime * 10) / 10;
    renderMusic();
    notify(`Nhạc sẽ phát từ giây ${state.music.start.toLocaleString('vi-VN')}.`, 'success');
    afterMusicStartChange();
}

async function handleMusicUpload(input) {
    const file = input.files[0];
    input.value = '';
    if (!file) return;

    if (isStaticEnv) {
        notify('Trang tĩnh (GitHub Pages) không lưu được file nhạc. Hãy dán link trực tiếp tới file nhạc.', 'warning');
        return;
    }
    if (file.size > 20 * 1024 * 1024) {
        notify('File nhạc quá lớn (tối đa 20MB).', 'error');
        return;
    }
    const scenarioName = getUploadFolder();

    showLoading('Đang tải nhạc lên...');
    const formData = new FormData();
    formData.append('audio', file);
    formData.append('filename', scenarioName);
    try {
        const response = await fetch('api/upload_audio.php', { method: 'POST', body: formData });
        const data = await response.json();
        hideLoading();
        if (data.success) {
            setMusic({ url: data.url, name: data.name || file.name });
            notify('Đã thêm nhạc nền!', 'success');
        } else {
            notify('Lỗi: ' + data.message, 'error');
        }
    } catch (e) {
        hideLoading();
        notify('Lỗi kết nối khi tải nhạc.', 'error');
    }
}

// Dùng link nhạc có sẵn: thử tải trước để báo lỗi ngay (link trang YouTube, link hỏng...)
function setMusicFromUrl() {
    const input = document.getElementById('music-url');
    const url = input.value.trim();
    if (!url) return;
    if (!/^(https?:\/\/|\.?\/)/i.test(url)) {
        notify('Link nhạc phải bắt đầu bằng https:// hoặc ./', 'warning');
        return;
    }

    showLoading('Đang kiểm tra link nhạc...');
    const probe = new Audio();
    let settled = false;
    const finish = (ok) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        probe.removeAttribute('src');
        hideLoading();
        if (ok) {
            setMusic({ url, name: decodeURIComponent(url.split('/').pop().split('?')[0]) || 'Nhạc nền' });
            input.value = '';
            notify('Đã thêm nhạc nền!', 'success');
        } else {
            notify('Không phát được link này. Hãy dùng link trực tiếp tới file .mp3 (link trang YouTube, Zing... không dùng được).', 'error');
        }
    };
    const timer = setTimeout(() => finish(false), 15000);
    probe.preload = 'metadata';
    probe.addEventListener('loadedmetadata', () => finish(true), { once: true });
    probe.addEventListener('error', () => finish(false), { once: true });
    probe.src = normalizeAssetPath(url);
}

// Nghe nhạc cùng khung xem nhanh: nhạc bắt đầu đúng lúc trình phát bắn đợt 1 (giống màn trình diễn thật)
let previewMusicOn = false;
let previewMusicPlaying = false;
let previewMusicStopTimer = null;
let previewClockTimer = null;

// Kịch bản khớp nhịp: báo cho khung xem nhanh vị trí nhạc đang phát để pháo bám theo
function sendPreviewClock() {
    const audio = getMusicAudio();
    const frame = getPreviewFrame();
    if (!state.music?.sync || !audio || audio.paused || audio.seeking || audio.readyState < 3 || !frame?.contentWindow) return;
    frame.contentWindow.postMessage({
        type: 'firework-preview-clock',
        position: (audio.currentTime - (state.music.start || 0)) * 1000
    }, window.location.origin);
}

function updateMusicPreviewButton() {
    const btn = document.getElementById('btn-music-mini');
    if (!btn) return;
    btn.classList.toggle('hide', !state.music);
    btn.classList.toggle('active', previewMusicOn);
    btn.title = previewMusicOn ? 'Tắt nhạc khi xem nhanh' : 'Nghe nhạc nền khi xem nhanh (chạy lại kịch bản từ đầu)';
}

function togglePreviewMusic() {
    if (!state.music) return;
    previewMusicOn = !previewMusicOn;
    updateMusicPreviewButton();
    if (!previewMusicOn) {
        stopPreviewMusic();
        return;
    }
    // Safari chỉ cho phát nhạc về sau nếu đã play() ngay trong lúc người dùng bấm
    const audio = getMusicAudio();
    if (audio.paused) {
        audio.muted = true;
        audio.play()
            .then(() => { if (!previewMusicPlaying) audio.pause(); })
            .catch(() => {})
            .finally(() => { audio.muted = false; });
    }
    // Chạy cả kịch bản từ đầu để nhạc khớp nhịp
    if (state.activeEventId) closeInspector();
    if (previewMode === 'idle') previewMode = 'once';
    updateMiniInfo();
    sendPreview(true);
}

function startPreviewMusic() {
    const audio = getMusicAudio();
    if (!state.music || !audio) return;
    clearTimeout(previewMusicStopTimer);
    previewMusicPlaying = true;
    audio.muted = false;
    audio.volume = state.music.volume ?? 0.8;
    try {
        audio.currentTime = state.music.start || 0;
    } catch (e) {
        // Chưa tải xong thông tin bài nhạc: phát từ đầu
    }
    audio.play().catch(() => notify('Trình duyệt chặn phát nhạc, hãy bấm nút nhạc ở khung xem nhanh lần nữa.', 'warning'));
    clearInterval(previewClockTimer);
    previewClockTimer = setInterval(sendPreviewClock, 250);
}

function stopPreviewMusic() {
    previewMusicPlaying = false;
    clearInterval(previewClockTimer);
    getMusicAudio()?.pause();
}


function getFinalConfig() {
    return {
        title: document.getElementById('title').value || "Kịch bản mới",
        subtitle: document.getElementById('subtitle').value || "",
        seoTitle: document.getElementById('seo-title').value.trim() || undefined,
        seoDescription: document.getElementById('seo-description').value.trim() || undefined,
        ...getSeoImageConfig(),
        author: document.getElementById('author').value.trim(),
        startFrame: state.startFrame || undefined,
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
        water: state.water || undefined,
        decor: state.decor || undefined,
        background: state.background,
        music: state.music ? { ...state.music } : undefined,
        effectsVolume: state.effectsVolume < 1 ? state.effectsVolume : undefined,
        status: state.status || "public",
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
            return data.map(s => s.id);
        } catch (e) {
            return [];
        }
    }
}

async function getUniqueFilename(requestedName, currentFilename) {
    const existingIds = (await getAvailableScripts()).map(id => id.toLowerCase());
    const reqLower = requestedName.toLowerCase();
    const currentLower = currentFilename ? currentFilename.toLowerCase() : '';

    // Nếu tên trùng với tên hiện tại đang sửa (không phân biệt hoa thường) thì cho phép ghi đè
    if (reqLower === currentLower) {
        return requestedName;
    }

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

async function saveConfig(isPreview = false) {
    // If called from event listener, isPreview will be the event object (truthy)
    if (typeof isPreview !== 'boolean') isPreview = false;

    if (!isPreview && !validateConfig()) {
        return;
    }

    let filename = document.getElementById('filename').value.trim();

    if (isPreview) {
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
        filename = await getUniqueFilename(filename, state.currentFilename);
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
        body: JSON.stringify({ filename, config, shareImage })
    })
        .then(response => response.json())
        .then(data => {
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

const DRAFT_KEY = 'firework_builder_draft';
const HISTORY_LIMIT = 100;
const editHistory = { entries: [], index: -1 };
// Bản chụp ứng với lần lưu/mở gần nhất: trùng với nó thì không cần nháp
let savedSnapshot = null;
let checkpointTimer = null;
let restoringSnapshot = false;
let draftSavedAt = null;
let draftWarningShown = false;

// Ảnh/nhạc dạng DataURL (bản tĩnh) nặng vài MB: trong lịch sử mỗi nội dung chỉ giữ một bản, các bản chụp trỏ tới nó
const dataUrlIds = new Map();
const dataUrlsById = new Map();

function compactSnapshot(value) {
    return JSON.stringify(value, (key, v) => {
        if (typeof v !== 'string' || v.length < 2000 || !v.startsWith('data:')) return v;
        let id = dataUrlIds.get(v);
        if (!id) {
            id = `@@data:${dataUrlIds.size + 1}`;
            dataUrlIds.set(v, id);
            dataUrlsById.set(id, v);
        }
        return id;
    });
}

function expandSnapshot(text) {
    return JSON.parse(text, (key, v) => (typeof v === 'string' && v.startsWith('@@data:') ? dataUrlsById.get(v) ?? v : v));
}

function currentSnapshot() {
    return compactSnapshot({
        config: getFinalConfig(),
        filename: document.getElementById('filename').value.trim(),
        // Tiêu đề đúng như trong ô (getFinalConfig điền "Kịch bản mới" khi để trống)
        title: document.getElementById('title').value
    });
}

// Kịch bản trống (chưa có tiêu đề, tên file, tối đa 1 phát bắn) thì không cần giữ nháp
// Chưa đặt tên, chưa có tiêu đề, tối đa một phát bắn và chưa chọn nhạc: không cần lưu nháp
function isBlankSnapshot(data) {
    return !data.filename && !(data.title ?? data.config.title).trim() && data.config.events.length <= 1 && !data.config.music;
}

function saveDraft(snapshot) {
    const data = expandSnapshot(snapshot);
    if (isBlankSnapshot(data)) {
        clearDraft();
        return;
    }
    try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...data, currentFilename: state.currentFilename || null, savedAt: Date.now() }));
        draftSavedAt = new Date();
    } catch (e) {
        // Thường do vượt giới hạn bộ nhớ của trình duyệt (ảnh lớn dạng DataURL)
        if (!draftWarningShown) {
            draftWarningShown = true;
            notify('Bản nháp quá lớn để tự lưu trong trình duyệt (thường do ảnh lớn). Nhớ bấm Lưu thường xuyên.', 'warning');
        }
    }
    updateScriptNameLabel();
}

function clearDraft() {
    try {
        localStorage.removeItem(DRAFT_KEY);
    } catch (e) {
        // localStorage bị chặn: không có gì để xóa
    }
    draftSavedAt = null;
    updateScriptNameLabel();
}

// Chụp kịch bản hiện tại; khác lần trước thì ghi vào lịch sử và lưu nháp
function checkpoint() {
    clearTimeout(checkpointTimer);
    if (restoringSnapshot || editHistory.index < 0) return;
    const snapshot = currentSnapshot();
    if (snapshot === editHistory.entries[editHistory.index]) return;
    editHistory.entries = editHistory.entries.slice(0, editHistory.index + 1);
    editHistory.entries.push(snapshot);
    if (editHistory.entries.length > HISTORY_LIMIT) editHistory.entries.shift();
    editHistory.index = editHistory.entries.length - 1;
    updateUndoButtons();
    if (snapshot === savedSnapshot) clearDraft();
    else saveDraft(snapshot);
}

function scheduleCheckpoint() {
    clearTimeout(checkpointTimer);
    checkpointTimer = setTimeout(checkpoint, 400);
}

// Vừa lưu xong hoặc vừa mở một kịch bản đã lưu: trạng thái này không cần nháp
function markSaved() {
    savedSnapshot = currentSnapshot();
    checkpoint();
    clearDraft();
}

function applySnapshot(data) {
    restoringSnapshot = true;
    const activeIndex = state.events.findIndex(e => e.id === state.activeEventId);
    const currentFilename = state.currentFilename;
    loadConfigIntoState(data.config, data.filename || '');
    if (typeof data.title === 'string') document.getElementById('title').value = data.title;
    // Hoàn tác không đổi kịch bản đang sửa trên máy chủ (quyền ghi đè khi lưu)
    state.currentFilename = currentFilename;
    updateScriptNameLabel();
    updateTemplateStrip();
    if (activeIndex >= 0 && state.events[activeIndex]) selectEvent(state.events[activeIndex].id);
    restoringSnapshot = false;
}

function moveInHistory(step) {
    const target = editHistory.index + step;
    if (target < 0 || target >= editHistory.entries.length) return;
    clearTimeout(checkpointTimer);
    editHistory.index = target;
    applySnapshot(expandSnapshot(editHistory.entries[target]));
    // Dựng lại có thể chuẩn hóa vài giá trị: lấy đúng bản chụp sau khi dựng để không sinh bước thừa
    editHistory.entries[target] = currentSnapshot();
    updateUndoButtons();
    if (editHistory.entries[target] === savedSnapshot) clearDraft();
    else saveDraft(editHistory.entries[target]);
}

function undo() {
    moveInHistory(-1);
}

function redo() {
    moveInHistory(1);
}

function updateUndoButtons() {
    const undoBtn = document.getElementById('btn-undo');
    const redoBtn = document.getElementById('btn-redo');
    if (undoBtn) undoBtn.disabled = editHistory.index <= 0;
    if (redoBtn) redoBtn.disabled = editHistory.index >= editHistory.entries.length - 1;
}

function formatDraftTime(date) {
    const time = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    return date.toDateString() === new Date().toDateString()
        ? `${time} hôm nay`
        : `${time} ngày ${date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}`;
}

// Mở builder: có bản nháp chưa lưu từ lần trước thì hỏi khôi phục (không chặn thao tác khác)
function offerDraftRestore() {
    let draft = null;
    try {
        draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
    } catch (e) {
        draft = null;
    }
    if (!draft || !draft.config || !Array.isArray(draft.config.events)) return;

    const bar = document.getElementById('draft-bar');
    const title = draft.config.title && draft.config.title !== 'Kịch bản mới' ? ` "${draft.config.title}"` : '';
    document.getElementById('draft-info').textContent =
        `Có bản nháp chưa lưu${title} (${draft.config.events.length} phát bắn) từ ${formatDraftTime(new Date(draft.savedAt))}.`;
    bar.classList.remove('hide');

    document.getElementById('btn-draft-restore').onclick = () => {
        bar.classList.add('hide');
        applySnapshot(draft);
        state.currentFilename = draft.currentFilename || null;
        updateTemplateStrip();
        checkpoint();
        notify('Đã khôi phục bản nháp.', 'success');
    };
    document.getElementById('btn-draft-discard').onclick = () => {
        bar.classList.add('hide');
        // Chỉ xóa nếu trong máy vẫn là bản nháp cũ (chưa bị thay bằng nháp của lần soạn này)
        try {
            const stored = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
            if (stored && stored.savedAt === draft.savedAt) clearDraft();
        } catch (e) {
            // Không đọc được: bỏ qua
        }
    };
}

function initEditHistory() {
    offerDraftRestore();
    savedSnapshot = currentSnapshot();
    editHistory.entries = [savedSnapshot];
    editHistory.index = 0;
    updateUndoButtons();

    // Mọi thao tác của người dùng đều có thể đổi kịch bản: chụp lại sau khi thao tác lắng xuống
    ['input', 'change', 'click', 'pointerup', 'keyup'].forEach(type => document.addEventListener(type, scheduleCheckpoint, true));
    // Thay đổi đến sau (tải ảnh/nhạc lên xong...)
    setInterval(checkpoint, 3000);

    document.addEventListener('keydown', (e) => {
        if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
        // Trong ô nhập, Ctrl+Z hoàn tác chữ đang gõ như bình thường
        if (e.target.closest('input, textarea, select, [contenteditable="true"]')) return;
        const key = e.key.toLowerCase();
        if (key === 'z' && !e.shiftKey) {
            e.preventDefault();
            undo();
        } else if (key === 'y' || (key === 'z' && e.shiftKey)) {
            e.preventDefault();
            redo();
        }
    });
}

// Lưới chọn khung bắt đầu trong nhóm "Màn mở quà & màn kết"
function renderStartFrames() {
    const grid = document.getElementById('start-frame-grid');
    if (!grid) return;
    grid.innerHTML = START_FRAMES.map(f => `
        <button type="button" class="shell-option${state.startFrame === f.value ? ' selected' : ''}" onclick="setStartFrame('${f.value}')">
            <span class="emoji">${f.icon}</span>${f.name}
        </button>`).join('');
    const current = START_FRAMES.find(f => f.value === state.startFrame) || START_FRAMES[0];
    document.getElementById('start-frame-hint').textContent = `${current.hint} Bấm "Xem thử" để trải nghiệm.`;
}

function setStartFrame(value) {
    state.startFrame = value;
    renderStartFrames();
}

// ---------------------------------------------------------------------------
// "Cấu hình chung" chia nhóm gấp/mở: nhớ nhóm đang mở, tóm tắt nhóm đang gấp
// ---------------------------------------------------------------------------
const SETTINGS_GROUPS_KEY = 'firework_builder_groups';

function initSettingsGroups() {
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
function scheduleSettingsSummaries() {
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
    const scene = [
        state.showBackground && 'Ảnh nền',
        state.smoke === 'light' ? 'Khói nhẹ' : state.smoke === 'heavy' ? 'Khói dày' : '',
        state.water === 'third' ? 'Mặt nước 1/3' : state.water === 'half' ? 'Mặt nước nửa' : '',
        { lanterns: 'Đèn trời', balloons: 'Khinh khí cầu', both: 'Đèn trời, khinh khí cầu' }[state.decor] || '',
        state.reduceFlashing && 'Giảm chớp sáng',
        checked('loop') ? 'Lặp lại' : 'Chạy một lượt'
    ].filter(Boolean);
    const filename = value('filename');
    return {
        basics: value('title') || 'Chưa có tiêu đề',
        gift: [frame.name, recipient && `Gửi ${recipient}`, state.openAt && 'Hẹn giờ'].filter(Boolean).join(' · '),
        sound: music ? musicName + (music.sync ? ' · khớp nhịp' : '') : 'Chưa có nhạc',
        scene: scene.join(' · '),
        share: state.seo.mode === 'custom' ? 'Ảnh của bạn' : 'Thiệp tự động',
        file: filename ? filename + '.json' : 'Đặt khi lưu'
    };
}

function renderSettingsSummaries() {
    const summaries = settingsSummaries();
    document.querySelectorAll('[data-summary]').forEach(el => {
        el.textContent = summaries[el.dataset.summary] || '';
    });
    const card = document.getElementById('settings-card-summary');
    if (card) card.textContent = [summaries.gift, summaries.sound, summaries.scene].join(' · ');
}

// Đưa người soạn tới một ô trong "Cấu hình chung": mở ngăn (tablet/điện thoại), mở nhóm chứa ô, cuộn tới và đặt con trỏ
function revealSetting(id) {
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
function renderSchedule() {
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

function setOpenMode(mode) {
    state.openMode = mode;
    renderSchedule();
}

// Khói pháo (Tắt / Nhẹ / Dày) trong Cấu hình chung
function setSmoke(level) {
    state.smoke = level;
    renderSmoke();
    refreshMiniPreview();
}

// Mặt nước, trang trí bầu trời (nhóm "Khung cảnh & hiệu ứng")
function setWater(level) {
    state.water = level;
    renderScene();
    refreshMiniPreview();
}

function setDecor(kind) {
    state.decor = kind;
    renderScene();
    refreshMiniPreview();
}

function renderScene() {
    document.querySelectorAll('.scene-water [data-water]').forEach(btn => {
        const on = btn.dataset.water === (state.water || '');
        btn.classList.toggle('active', on);
        btn.setAttribute('aria-pressed', String(on));
    });
    document.querySelectorAll('.scene-decor [data-decor]').forEach(btn => {
        const on = btn.dataset.decor === (state.decor || '');
        btn.classList.toggle('active', on);
        btn.setAttribute('aria-pressed', String(on));
    });
    // Thước dọc của khung xem nhanh: độ cao 0 là mặt nước
    const level = { third: 2 / 3, half: 0.5 }[state.water] || 1;
    const rulerY = document.getElementById('mini-ruler-y');
    if (rulerY) rulerY.style.height = level < 1 ? `calc(${level * 100}% + 10px)` : '';
    scheduleSettingsSummaries();
}

function renderSmoke() {
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

let selectedOccasion = OCCASIONS[0].id;

function renderTemplateChips() {
    const chips = document.getElementById('template-chips');
    if (!chips) return;
    chips.innerHTML = OCCASIONS.map(o => `
        <button type="button" class="template-chip" onclick="openTemplatesModal('${o.id}')">
            <span class="emoji">${o.icon}</span>${escapeHtml(o.name)}
        </button>`).join('');
}

// Kịch bản còn trống (chưa đặt tiêu đề, chưa mở kịch bản nào, tối đa 1 phát bắn): gợi ý tạo nhanh từ mẫu
function updateTemplateStrip() {
    const strip = document.getElementById('template-strip');
    if (!strip) return;
    const isBlank = !state.currentFilename && state.events.length <= 1 && !document.getElementById('title').value.trim();
    strip.classList.toggle('hide', !isBlank);
}

function renderTemplateGrid() {
    document.getElementById('template-grid').innerHTML = OCCASIONS.map(o => `
        <button type="button" class="shell-option${o.id === selectedOccasion ? ' selected' : ''}" onclick="selectOccasion('${o.id}')">
            <span class="emoji">${o.icon}</span>${escapeHtml(o.name)}
        </button>`).join('');
}

function selectOccasion(id) {
    selectedOccasion = id;
    renderTemplateGrid();
}

function openTemplatesModal(occasionId) {
    if (occasionId) selectedOccasion = occasionId;
    closeMoreMenu();
    renderTemplateGrid();
    showModal('templates-modal');
    document.getElementById('tpl-recipient').focus();
}

function startBlankScript() {
    hideModal('templates-modal');
    createNewScript();
}

function createFromTemplate() {
    const occasion = OCCASIONS.find(o => o.id === selectedOccasion) || OCCASIONS[0];
    const recipient = document.getElementById('tpl-recipient').value.trim();
    const sender = document.getElementById('tpl-sender').value.trim();
    const config = buildTemplate(occasion.id, { recipient, sender });

    loadConfigIntoState(config, toSlug(`${occasion.id} ${recipient}`).slice(0, 50));
    // Kịch bản mới: lưu lần đầu không ghi đè kịch bản trùng tên (tự thêm số)
    state.currentFilename = null;
    document.getElementById('share-bar').classList.add('hide');
    updateScriptNameLabel();
    updateTemplateStrip();
    hideModal('templates-modal');
    playMiniPreviewOnce();
    notify(`Đã tạo màn trình diễn "${occasion.name}". Xem thử ở khung xem nhanh, chỉnh tiếp rồi bấm Lưu.`, 'success');
}

// ---------------------------------------------------------------------------
// XẾP PHÁO THEO NHỊP NHẠC (beat-sync.js): nghe bài nhạc, tìm nhịp rồi tự đặt pháo
// ---------------------------------------------------------------------------

// Kết quả phân tích theo link nhạc (phân tích một lần, mở lại hộp thoại là có ngay)
const beatAnalyses = new Map();
// Kết quả đã xong (dòng thời gian theo giây vẽ sóng nhạc ngay) và các link không đọc được
const beatResults = new Map();
const beatFailures = new Set();
const MAX_BEAT_SECONDS = 480;

function analyzeMusicCached(url, onProgress) {
    if (!beatAnalyses.has(url)) {
        const job = analyzeMusic(url, onProgress);
        beatAnalyses.set(url, job);
        job.then(analysis => {
            beatResults.set(url, analysis);
            beatFailures.delete(url);
            if (timelineView === 'track') renderEventList();
        }, () => {
            beatAnalyses.delete(url);
            beatFailures.add(url);
            if (timelineView === 'track') renderTrackTools();
        });
    }
    return beatAnalyses.get(url);
}
let beatAnalysis = null;
let beatDensity = 'medium';

async function openBeatModal() {
    if (!state.music) return;
    const url = normalizeAssetPath(state.music.url);
    beatAnalysis = null;
    setBeatDensity(beatDensity);
    renderBeatStatus('loading', 0);
    showModal('beat-modal');
    beatFailures.delete(url);
    try {
        const analysis = await analyzeMusicCached(url, p => {
            if (!beatAnalysis) renderBeatStatus('loading', p);
        });
        // Trong lúc chờ đã đổi bài nhạc khác
        if (!state.music || normalizeAssetPath(state.music.url) !== url) return;
        beatAnalysis = analysis;
        renderBeatResult();
    } catch (e) {
        console.warn('[Builder] Không phân tích được bài nhạc:', e);
        renderBeatStatus('error', e.code);
    }
}

function renderBeatStatus(status, detail) {
    const box = document.getElementById('beat-status');
    document.getElementById('beat-result').classList.toggle('hide', status !== 'ready');
    document.getElementById('btn-beat-apply').disabled = status !== 'ready';
    box.classList.toggle('hide', status === 'ready');
    box.classList.toggle('error', status === 'error');
    if (status === 'loading') {
        const percent = Math.round((detail || 0) * 100);
        box.innerHTML = `<i class="fas fa-circle-notch fa-spin"></i><span>Đang nghe bài nhạc... ${percent}%</span>
            <div class="beat-progress"><span style="width: ${percent}%"></span></div>`;
    } else if (status === 'error') {
        const messages = {
            fetch: 'Không tải được bài nhạc từ link này (máy chủ nhạc không cho đọc). Hãy chọn file nhạc từ máy rồi thử lại.',
            decode: 'Trình duyệt không đọc được định dạng bài nhạc này. Hãy thử file MP3.',
            'no-beat': 'Không tìm thấy nhịp rõ ràng trong bài nhạc này (bài quá ngắn hoặc không có tiết tấu).'
        };
        box.innerHTML = `<i class="fas fa-triangle-exclamation"></i><span>${messages[detail]
            || 'Không đọc được bài nhạc. Hãy thử lại hoặc chọn file nhạc từ máy.'}</span>`;
    }
}

function getKeepEvents() {
    return state.events.filter(e => KEEP_SHELLS.includes(e.shell));
}

function renderBeatResult() {
    const analysis = beatAnalysis;
    const start = Number(state.music.start) || 0;
    const available = Math.max(0, analysis.duration - start);
    const select = document.getElementById('beat-length');
    // Kịch bản tối đa 200 đợt (~10 phút): bài quá dài thì bắn tối đa 8 phút
    const options = [30, 60, 120, 180, 300].filter(s => s < Math.min(available, MAX_BEAT_SECONDS) - 10)
        .map(s => `<option value="${s}">${formatDuration(s * 1000)}</option>`);
    const clock = Math.floor(available / 60) + ':' + String(Math.floor(available % 60)).padStart(2, '0');
    select.innerHTML = options.join('') + (available <= MAX_BEAT_SECONDS
        ? `<option value="all">Hết bài (${clock})</option>`
        : `<option value="${MAX_BEAT_SECONDS}">${formatDuration(MAX_BEAT_SECONDS * 1000)}</option>`);
    select.value = select.options[select.options.length - 1].value;
    const keep = getKeepEvents();
    const texts = keep.filter(e => e.shell !== 'Lời nhắn').length;
    const captions = keep.length - texts;
    document.getElementById('beat-keep-row').classList.toggle('hide', !keep.length);
    document.getElementById('beat-keep-hint').textContent = [texts && `${texts} chữ/ảnh trên trời`, captions && `${captions} lời nhắn`]
        .filter(Boolean).join(', ') + ' · đặt vào các phách mạnh, giữ thứ tự cũ';
    const drops = analysis.drops.filter(i => analysis.beats[i].time >= start).length;
    document.getElementById('beat-summary').innerHTML = `Nhịp khoảng <strong>${formatNumber(analysis.bpm)} BPM</strong>`
        + ` · bài dài ${formatDuration(analysis.duration * 1000)}`
        + (drops ? ` · <strong>${drops}</strong> chỗ nhạc bùng lên` : '');
    renderBeatStatus('ready');
    drawBeatChart();
}

function setBeatDensity(density) {
    beatDensity = density;
    document.querySelectorAll('.beat-density button').forEach(btn => btn.classList.toggle('active', btn.dataset.density === density));
}

function getBeatLength() {
    const value = document.getElementById('beat-length').value;
    return value === 'all' ? Infinity : Number(value);
}

// Độ sôi động từng ô nhịp; phần sẽ bắn sáng màu, chỗ nhạc bùng lên đánh dấu vàng
function drawBeatChart() {
    const canvas = document.getElementById('beat-chart');
    if (!canvas || !beatAnalysis) return;
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth || 560;
    const height = canvas.clientHeight || 88;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const { beats, drops, duration } = beatAnalysis;
    const start = Number(state.music?.start) || 0;
    const end = start + getBeatLength();
    const bars = [];
    beats.forEach(beat => {
        if (!bars.length || beat.downbeat) bars.push({ time: beat.time, sum: 0, n: 0 });
        const bar = bars[bars.length - 1];
        bar.sum += beat.level;
        bar.n++;
    });
    const x = time => (time / duration) * width;
    bars.forEach((bar, i) => {
        const next = bars[i + 1] ? bars[i + 1].time : duration;
        const level = bar.sum / bar.n;
        const h = Math.max(2, level * (height - 14));
        const inRange = bar.time >= start - 0.05 && bar.time < end;
        ctx.fillStyle = inRange ? `hsl(${265 - level * 225}, 90%, ${55 + level * 10}%)` : 'rgba(255, 255, 255, 0.12)';
        ctx.fillRect(x(bar.time), height - h, Math.max(1, x(next) - x(bar.time) - 1), h);
    });
    ctx.fillStyle = '#ffbf36';
    drops.forEach(i => {
        const px = x(beats[i].time);
        ctx.beginPath();
        ctx.moveTo(px - 4, 0);
        ctx.lineTo(px + 4, 0);
        ctx.lineTo(px, 7);
        ctx.fill();
    });
}

function applyBeatShow() {
    if (!beatAnalysis || !state.music) return;
    const keep = document.getElementById('beat-keep').checked
        ? getKeepEvents().map(({ id, expanded, ...event }) => event)
        : [];
    let show;
    try {
        show = buildBeatShow(beatAnalysis, {
            start: Number(state.music.start) || 0, length: getBeatLength(), density: beatDensity, keep
        });
    } catch (e) {
        notify('Đoạn nhạc từ giây bắt đầu tới hết quá ngắn để xếp pháo.', 'error');
        return;
    }
    state.events = [];
    state.activeEventId = null;
    show.events.forEach(event => addEvent(event));
    state.music.sync = true;
    state.music.bpm = beatAnalysis.bpm;
    // Màn trình diễn theo bài nhạc: chạy một lượt rồi hiện màn kết
    document.getElementById('loop').checked = false;
    hideModal('beat-modal');
    renderMusic();
    renderEventList();
    renderInspector();
    syncLoopState();
    scheduleCheckpoint();
    // Nghe thử ngay (đang trong lúc bấm nên trình duyệt cho phát nhạc)
    if (state.miniPreviewEnabled) {
        if (!previewMusicOn) togglePreviewMusic();
        else playMiniPreviewOnce();
    }
    notify(`Đã xếp ${show.shots} phát pháo theo nhịp ${formatNumber(beatAnalysis.bpm)} BPM. `
        + (state.miniPreviewEnabled ? 'Đang phát thử ở khung xem nhanh.' : 'Bấm Xem thử để nghe cùng nhạc.'), 'success');
}

// Đổi giây bắt đầu của kịch bản khớp nhịp: các phát vẫn tính từ lúc nhạc bắt đầu nên sẽ lệch nhịp
function afterMusicStartChange() {
    if (isSyncMode() && state.events.length) {
        notify('Đã đổi giây bắt đầu: bấm "Xếp pháo theo nhịp nhạc" để xếp lại cho khớp nhịp.', 'warning');
    }
    renderEventList();
}

// ---------------------------------------------------------------------------
// BÁO MỞ QUÀ (gift-tracking.js, api/opens.php): mã theo dõi của kịch bản mới được giữ trong trình duyệt này;
// hộp Chia sẻ và danh sách kịch bản hiện trạng thái; đang mở builder thì hỏi định kỳ, có người vừa mở quà thì báo.
// ---------------------------------------------------------------------------

const OPEN_SEEN_KEY = 'firework_open_seen';
// Trạng thái gần nhất của các món quà của mình: tên kịch bản -> trạng thái
const giftStatuses = new Map();
let giftCheckAt = 0;
// Lượt hỏi đang chạy: gọi thêm thì dùng chung, không chạy song song (tránh báo một lượt mở hai lần)
let giftCheck = null;

function renderNotifyOpen() {
    const toggle = document.getElementById('notify-open');
    if (!toggle) return;
    toggle.checked = state.notifyOpen;
    toggle.disabled = isStaticEnv;
    document.getElementById('notify-open-hint').textContent = isStaticEnv
        ? 'Cần bản có máy chủ PHP (bản tĩnh như GitHub Pages không báo được)'
        : state.notifyOpen ? 'Xem trong hộp Chia sẻ sau khi lưu' : 'Đang tắt: người nhận mở quà sẽ không được ghi lại';
}

function ownedItems(ids) {
    const keys = getOwnerKeys();
    return (ids || Object.keys(keys)).filter(id => keys[id]).slice(0, 100).map(id => ({ id, key: keys[id] }));
}

async function renderShareTracking() {
    const box = document.getElementById('share-track');
    const key = getOwnerKeys()[share.id];
    const show = !isStaticEnv && state.notifyOpen;
    box.classList.toggle('hide', !show);
    if (!show) return;
    const status = document.getElementById('share-track-status');
    document.getElementById('share-track-link').classList.toggle('hide', !key);
    document.getElementById('share-track-hint').classList.toggle('hide', !key);
    document.getElementById('btn-track-notify').classList.toggle('hide', !key || !('Notification' in window) || Notification.permission !== 'default');
    if (!key) {
        status.textContent = 'Chỉ xem được trên trình duyệt đã lưu kịch bản này lần đầu (hoặc bằng link theo dõi riêng).';
        return;
    }
    document.getElementById('share-track-input').value = trackingUrl(share.id, key);
    status.textContent = 'Đang kiểm tra...';
    try {
        const [item] = await fetchOpenStatus([{ id: share.id, key }]);
        if (item && item.ok) giftStatuses.set(item.id, item);
        const { opened, text } = describeOpenStatus(item);
        status.textContent = text;
        document.getElementById('share-track-icon').textContent = opened ? '🎉' : '🔔';
        box.classList.toggle('is-opened', opened);
    } catch (e) {
        status.textContent = 'Không kết nối được máy chủ để xem trạng thái.';
    }
}

async function copyTrackingLink() {
    const input = document.getElementById('share-track-input');
    if (await copyText(input.value)) notify('Đã sao chép link theo dõi riêng. Đừng gửi link này cho người nhận!', 'success');
    else input.select();
}

async function enableOpenNotifications() {
    if (!('Notification' in window)) return;
    const permission = await Notification.requestPermission();
    document.getElementById('btn-track-notify').classList.add('hide');
    notify(permission === 'granted'
        ? 'Đã bật: khi người nhận mở quà, máy này sẽ báo (lúc đang mở trình soạn).'
        : 'Trình duyệt chưa cho phép thông báo. Bạn vẫn xem được trạng thái trong hộp Chia sẻ.', permission === 'granted' ? 'success' : 'warning');
}

// Danh sách "Kịch bản của tôi": nhãn đã mở / chưa mở cho các món quà của mình
async function showGiftBadges() {
    if (isStaticEnv) return;
    const ids = [...document.querySelectorAll('#scripts-list .script-item')].map(el => el.dataset.id);
    const items = ownedItems(ids);
    if (!items.length) return;
    try {
        (await fetchOpenStatus(items)).forEach(item => {
            if (!item.ok) return;
            giftStatuses.set(item.id, item);
            const el = document.querySelector(`#scripts-list .script-item[data-id="${CSS.escape(item.id)}"] .script-badges`);
            if (!el || el.querySelector('.gift-badge')) return;
            const { opened, text } = describeOpenStatus(item);
            el.insertAdjacentHTML('beforeend', `<span class="gift-badge${opened ? ' is-opened' : ''}" title="${escapeHtml(text)}">`
                + `${opened ? '🎉 Đã mở' : item.counts.view ? '🔗 Đã xem link' : 'Chưa mở'}</span>`);
        });
    } catch (e) {
        // Không có máy chủ: bỏ qua nhãn
    }
}

// Hỏi trạng thái mọi món quà của mình; món nào có lượt mở quà mới (kể cả khi builder đang đóng) thì báo một lần
function checkGiftOpens() {
    if (isStaticEnv) return Promise.resolve();
    if (!giftCheck) giftCheck = runGiftCheck().finally(() => { giftCheck = null; });
    return giftCheck;
}

async function runGiftCheck() {
    giftCheckAt = Date.now();
    const items = ownedItems();
    if (!items.length) return;
    let statuses;
    try {
        statuses = await fetchOpenStatus(items);
    } catch (e) {
        return;
    }
    let seen = {};
    try {
        seen = JSON.parse(localStorage.getItem(OPEN_SEEN_KEY) || '{}');
    } catch (e) {
        // Chưa có
    }
    for (const status of statuses) {
        if (!status.ok) continue;
        giftStatuses.set(status.id, status);
        const opens = status.counts.open || 0;
        if (opens > (seen[status.id] || 0)) await announceGiftOpen(status);
        seen[status.id] = opens;
    }
    try {
        localStorage.setItem(OPEN_SEEN_KEY, JSON.stringify(seen));
    } catch (e) {
        // Lần sau có thể báo lại
    }
}

async function announceGiftOpen(status) {
    let config = {};
    try {
        config = await (await fetch(`configs/${encodeURIComponent(status.id)}.json`, { cache: 'no-store' })).json();
    } catch (e) {
        // Dùng tên kịch bản
    }
    const open = lastEvent(status, 'open');
    const who = config.recipient || 'Người nhận';
    const text = `${who} đã mở quà "${config.title || status.id}"${open ? ` lúc ${formatWhen(open.t)}` : ''}`;
    notify(`🎉 ${text}`, 'success');
    if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
        new Notification('Món quà đã được mở 🎉', { body: text, icon: document.querySelector('link[rel="icon"]')?.href });
    }
}

function startGiftWatch() {
    if (isStaticEnv) return;
    setTimeout(checkGiftOpens, 3000);
    setInterval(checkGiftOpens, 60000);
    // Quay lại tab: hỏi ngay (không quá 10 giây một lần)
    window.addEventListener('focus', () => {
        if (Date.now() - giftCheckAt > 10000) checkGiftOpens();
    });
}

// ---------------------------------------------------------------------------
// DÒNG THỜI GIAN THEO GIÂY (timeline-track.js): thước giây, sóng nhạc, kéo thả phát bắn
// ---------------------------------------------------------------------------

const TIMELINE_VIEW_KEY = 'firework_builder_timeline_view';
let timelineView = (() => {
    try {
        return localStorage.getItem(TIMELINE_VIEW_KEY) === 'track' ? 'track' : 'list';
    } catch (e) {
        return 'list';
    }
})();
let track = null;

function setTimelineView(view) {
    timelineView = view === 'track' ? 'track' : 'list';
    try {
        localStorage.setItem(TIMELINE_VIEW_KEY, timelineView);
    } catch (e) {
        // Không nhớ được lựa chọn: lần sau mở lại danh sách
    }
    renderEventList();
}

function zoomTrack(dir) {
    if (track) track.zoom(dir);
}

// Màu đánh dấu của phát bắn: màu đầu tiên đã chọn
function markerColor(event) {
    const first = Array.isArray(event.color) ? event.color[0] : event.color;
    if (!first || first === 'Ngẫu nhiên' || first === 'random') return '#b46cff';
    return COLOR[first] || first;
}

// Kết quả phân tích nhạc (sóng nhạc, phách) của bài đang dùng, có rồi mới vẽ
function currentMusicAnalysis() {
    return state.music ? beatResults.get(normalizeAssetPath(state.music.url)) || null : null;
}

function renderTrackTools() {
    const note = document.getElementById('track-note');
    const snapRow = document.getElementById('track-snap-row');
    if (!state.music) {
        note.textContent = '';
        snapRow.classList.add('hide');
        return;
    }
    const url = normalizeAssetPath(state.music.url);
    const analysis = beatResults.get(url);
    snapRow.classList.toggle('hide', !analysis);
    if (analysis) {
        note.textContent = `♪ ${formatNumber(analysis.bpm)} BPM`;
    } else if (beatFailures.has(url)) {
        note.textContent = 'Không đọc được sóng nhạc từ link này';
    } else {
        note.textContent = 'Đang đọc sóng nhạc...';
        analyzeMusicCached(url).catch(() => {});
    }
}

function getTrack() {
    if (track) return track;
    track = createTimelineTrack(document.getElementById('track-view'), {
        getEvents: () => state.events,
        activeId: () => state.activeEventId,
        icon: event => SHELL_ICONS[event.shell] || '🎆',
        color: markerColor,
        title: (event, time) => `#${state.events.indexOf(event) + 1} ${event.shell} · ${formatMusicTime(time)}`
            + (isSyncMode() ? ' (nổ)' : ''),
        escape: escapeHtml,
        isSync: isSyncMode,
        musicStart: () => Number(state.music?.start) || 0,
        analysis: currentMusicAnalysis,
        snapToBeats: () => document.getElementById('track-snap').checked,
        formatTime: formatMusicTime,
        // Vạch chạy theo nhạc builder đang phát cùng khung xem nhanh
        musicPosition: () => {
            const audio = getMusicAudio();
            return previewMusicPlaying && audio && !audio.paused ? (audio.currentTime - (Number(state.music?.start) || 0)) * 1000 : null;
        },
        onSelect: id => selectEvent(id),
        onMove: (id, time) => moveEventToTime(id, time),
        onAdd: time => addEventAtTime(time)
    });
    return track;
}

// Đặt phát bắn vào thời điểm `time` (ms; lúc phóng, hoặc lúc nổ khi khớp nhịp nhạc). Các phát khác giữ nguyên
// thời điểm: các đợt được xếp lại, "Tạm dừng" được tạo lại cho vừa (timeline.js).
function moveEventToTime(id, time) {
    const { items, end } = eventTimes(state.events);
    const item = items.find(i => i.event.id === id);
    if (!item) return;
    const tail = end - Math.max(...items.map(i => i.time));
    item.time = Math.max(0, Math.round(time));
    const { placed, pauses } = layoutBursts(items, tail);
    placed.forEach(({ event, burst, delay }) => {
        event.burst = burst;
        event.delay = delay;
    });
    if (state.events.some(e => e.id === state.activeEventId && isPauseEvent(e))) state.activeEventId = null;
    state.events = state.events.filter(e => !isPauseEvent(e));
    pauses.forEach(p => addEvent({ burst: p.burst, shell: 'Tạm dừng', duration: p.duration }, { render: false }));
    // Trong mỗi đợt: theo thời điểm, Tạm dừng ở cuối
    state.events.sort((a, b) => (a.burst - b.burst)
        || (isPauseEvent(a) - isPauseEvent(b))
        || ((Number(a.delay) || 0) - (Number(b.delay) || 0)));
    renderEventList();
    renderInspector();
    scheduleCheckpoint();
}

// Nhấn đúp chỗ trống: thêm phát bắn mới ở thời điểm đó rồi mở bảng chỉnh sửa
function addEventAtTime(time) {
    addEvent({ burst: 1 }, { render: false });
    const added = state.events[state.events.length - 1];
    moveEventToTime(added.id, time);
    selectEvent(added.id);
}

// ---------------------------------------------------------------------------
// XUẤT VIDEO: khung quay (index.html?record=1) chạy chính trình phát ở cỡ video đã chọn, quay lại màn trình diễn
// kèm tiếng pháo và nhạc nền (xem recorder.js), rồi gửi file về đây để xem lại, tải về hoặc chia sẻ
// ---------------------------------------------------------------------------

// frame: cỡ khung (px) như màn hình thật để pháo bố trí đúng kiểu; size: cỡ video theo chất lượng
const VIDEO_FORMATS = [
    { value: 'portrait', icon: '📱', name: 'Dọc 9:16', hint: 'TikTok, Story, Reels', frame: [405, 720], size: { fhd: [1080, 1920], hd: [720, 1280] } },
    { value: 'landscape', icon: '🖥️', name: 'Ngang 16:9', hint: 'YouTube, Facebook', frame: [1280, 720], size: { fhd: [1920, 1080], hd: [1280, 720] } },
    { value: 'square', icon: '⬛', name: 'Vuông 1:1', hint: 'Bài đăng Facebook, Instagram', frame: [720, 720], size: { fhd: [1080, 1080], hd: [720, 720] } }
];
const VIDEO_BITRATES = { fhd: 8e6, hd: 4e6 };
// Sau đợt cuối: chờ pháo tàn (4,5 giây) rồi thiệp lời chúc (4 giây)
const VIDEO_TAIL_SECONDS = 8.5;

const video = {
    format: 'portrait',
    quality: 'fhd',
    // 'setup' | 'preparing' | 'ready' | 'recording' | 'saving' | 'done'
    step: 'setup',
    frame: null,
    url: '',
    blob: null,
    length: 0,
    previousPreviewMode: null
};

function canRecordVideoHere() {
    const canvas = document.createElement('canvas');
    return !!(window.MediaRecorder && canvas.captureStream);
}

// Thời lượng video dự kiến (giây): các đợt như trình phát, cộng lúc chờ đầu và cuối
function estimateVideoLength() {
    let total = 0;
    for (let b = 1; b <= getMaxBurst(); b++) total += getBurstDuration(getBurstEvents(b));
    // Kịch bản khớp nhịp phóng pháo đầu tiên sớm hơn nhạc khoảng 2,5 giây
    // 1,5 giây trời đêm đầu video (chờ bộ mã hóa video khởi động) + 0,8 giây tới phát đầu tiên
    return total / 1000 + 1.5 + 0.8 + (isSyncMode() ? 2.5 : 0) + VIDEO_TAIL_SECONDS;
}

function formatClock(seconds) {
    const s = Math.max(0, Math.round(seconds));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// Nhạc dán link từ trang khác: trình duyệt không cho ghi vào video
function isExternalMusic() {
    if (!state.music) return false;
    const url = normalizeAssetPath(state.music.url);
    if (/^(data:|blob:)/i.test(url)) return false;
    try {
        return new URL(url, window.location.href).origin !== window.location.origin;
    } catch (e) {
        return false;
    }
}

function openVideoModal() {
    if (!state.events.some(isFireworkShot)) {
        notify('Kịch bản chưa có phát pháo nào để quay.', 'warning');
        return;
    }
    closeMoreMenu();
    video.step = 'setup';
    renderVideoModal();
    showModal('video-modal');
}

function setVideoFormat(value) {
    video.format = value;
    renderVideoModal();
}

function setVideoQuality(value) {
    video.quality = value;
    renderVideoModal();
}

function renderVideoModal() {
    const step = video.step;
    document.getElementById('video-setup').classList.toggle('hide', step !== 'setup');
    document.getElementById('video-stage').classList.toggle('hide', !['preparing', 'ready', 'recording', 'saving'].includes(step));
    document.getElementById('video-result').classList.toggle('hide', step !== 'done');
    const actions = document.getElementById('video-actions');

    if (step === 'setup') {
        document.getElementById('video-formats').innerHTML = VIDEO_FORMATS.map(f => `
            <button type="button" class="shell-option${video.format === f.value ? ' selected' : ''}" onclick="setVideoFormat('${f.value}')">
                <span class="emoji">${f.icon}</span>${f.name}<small>${f.hint}</small>
            </button>`).join('');
        document.querySelectorAll('.video-qualities button').forEach(btn => btn.classList.toggle('active', btn.dataset.quality === video.quality));
        const format = VIDEO_FORMATS.find(f => f.value === video.format);
        const [width, height] = format.size[video.quality];
        video.length = estimateVideoLength();
        const megabytes = Math.max(1, Math.round((VIDEO_BITRATES[video.quality] + 160000) * video.length / 8 / 1e6));
        const notes = [
            `Video ${width}×${height}, dài khoảng <strong>${formatClock(video.length)}</strong>, nặng tối đa khoảng ${megabytes} MB; có tiêu đề, lời nhắn và thiệp lời chúc ở cuối.`,
            'Quay theo thời gian thật nên mất đúng chừng ấy thời gian. Giữ tab này mở trong lúc quay (chuyển tab thì video tạm dừng).'
        ];
        if (isExternalMusic()) notes.push('<span class="warn">Nhạc dán từ link trang khác không ghi được vào video. Muốn có nhạc, hãy chọn file nhạc từ máy ở mục Nhạc nền.</span>');
        if (!canRecordVideoHere()) notes.push('<span class="warn">Trình duyệt này chưa quay được video. Hãy dùng Chrome, Edge, Firefox hoặc Safari bản mới.</span>');
        document.getElementById('video-notes').innerHTML = notes.map(n => `<li>${n}</li>`).join('');
        actions.innerHTML = `
            <button class="btn secondary" onclick="closeVideoModal()">Hủy</button>
            <button id="btn-video-prepare" class="btn primary" onclick="prepareVideo()" ${canRecordVideoHere() ? '' : 'disabled'}>
                <i class="fas fa-video"></i> Chuẩn bị quay</button>`;
    } else if (step === 'done') {
        const canShare = navigator.canShare && navigator.canShare({ files: [videoFile()] });
        actions.innerHTML = `
            <button class="btn secondary" onclick="restartVideo()"><i class="fas fa-rotate-left"></i> Quay lại</button>
            ${canShare ? '<button class="btn secondary" onclick="shareVideo()"><i class="fas fa-share-nodes"></i> Chia sẻ</button>' : ''}
            <button id="btn-video-download" class="btn primary" onclick="downloadVideo()"><i class="fas fa-download"></i> Tải video</button>`;
    } else {
        actions.innerHTML = step === 'recording'
            ? `<button class="btn secondary" onclick="closeVideoModal()">Hủy</button>
               <button class="btn primary" onclick="stopVideo()"><i class="fas fa-stop"></i> Dừng và lưu</button>`
            : '<button class="btn secondary" onclick="closeVideoModal()">Hủy</button>';
    }
}

function setVideoStatus(text, progress) {
    document.getElementById('video-status').innerHTML = text;
    if (progress !== undefined) document.getElementById('video-progress-bar').style.width = `${Math.min(100, progress * 100)}%`;
}

// Dựng khung quay ở cỡ màn hình thật rồi thu nhỏ cho vừa hộp thoại
function prepareVideo() {
    const format = VIDEO_FORMATS.find(f => f.value === video.format);
    const [frameW, frameH] = format.frame;
    const [width, height] = format.size[video.quality];
    video.step = 'preparing';
    renderVideoModal();
    setVideoStatus('Đang chuẩn bị âm thanh, hình ảnh và nhạc nền...', 0);

    // Khung xem nhanh nghỉ trong lúc quay cho đỡ nặng máy
    if (previewMusicPlaying) stopPreviewMusic();
    // Quay lại lần nữa: giữ trạng thái khung xem nhanh từ trước lần quay đầu
    if (video.previousPreviewMode === null) video.previousPreviewMode = previewMode;
    previewMode = 'idle';
    sendPreview(true);

    const box = document.getElementById('video-frame-box');
    const maxW = Math.min(box.parentElement.clientWidth || 520, 560);
    const maxH = Math.min(window.innerHeight * 0.52, 520);
    const scale = Math.min(maxW / frameW, maxH / frameH);
    box.style.width = `${Math.round(frameW * scale)}px`;
    box.style.height = `${Math.round(frameH * scale)}px`;
    const frame = document.createElement('iframe');
    frame.title = 'Khung quay video';
    frame.allow = 'autoplay';
    frame.style.width = `${frameW}px`;
    frame.style.height = `${frameH}px`;
    frame.style.transform = `scale(${scale})`;
    frame.src = `index.html?record=1&scale=${width / frameW}`;
    box.replaceChildren(frame);
    video.frame = frame;
    video.size = [width, height];
}

window.addEventListener('message', (e) => {
    const msg = e.data;
    if (e.origin !== window.location.origin || !msg || !video.frame || e.source !== video.frame.contentWindow) return;
    if (msg.type === 'firework-record-frame-ready') {
        const config = getFinalConfig();
        video.frame.contentWindow.postMessage({
            type: 'firework-record-load',
            config,
            options: { width: video.size[0], height: video.size[1], fps: 30, bitrate: VIDEO_BITRATES[video.quality] }
        }, window.location.origin);
    } else if (msg.type === 'firework-record-prepared') {
        if (!msg.supported) {
            setVideoStatus('<span class="warn">Trình duyệt này chưa quay được video. Hãy dùng Chrome, Edge, Firefox hoặc Safari bản mới.</span>');
            return;
        }
        video.step = 'ready';
        renderVideoModal();
        setVideoStatus('Sẵn sàng! Bấm <strong>Bắt đầu quay</strong> trong khung phía trên.'
            + (msg.musicCaptured ? '' : ' <span class="warn">Video sẽ không có nhạc nền (nhạc từ link trang khác).</span>'), 0);
    } else if (msg.type === 'firework-record-started') {
        video.step = 'recording';
        renderVideoModal();
        setVideoStatus(`Đang quay 0:00 / ${formatClock(video.length)}`, 0);
    } else if (msg.type === 'firework-record-progress' && video.step === 'recording') {
        setVideoStatus(`<span class="record-live"></span>Đang quay ${formatClock(msg.elapsed)} / ${formatClock(video.length)}`
            + ' · giữ tab này mở', msg.elapsed / video.length);
    } else if (msg.type === 'firework-record-done') {
        showRecordedVideo(msg.blob, msg.elapsed);
    }
});

function stopVideo() {
    if (video.step !== 'recording' || !video.frame) return;
    video.step = 'saving';
    renderVideoModal();
    setVideoStatus('Đang lưu video...');
    video.frame.contentWindow.postMessage({ type: 'firework-record-stop' }, window.location.origin);
}

function videoExtension() {
    return video.blob && /mp4/.test(video.blob.type) ? 'mp4' : 'webm';
}

function videoFile() {
    const name = document.getElementById('filename').value.trim() || toSlug(document.getElementById('title').value) || 'phao-hoa';
    return new File([video.blob || new Blob()], `${name}.${videoExtension()}`, { type: video.blob ? video.blob.type : 'video/mp4' });
}

function showRecordedVideo(blob, elapsed) {
    removeVideoFrame();
    if (!blob || !blob.size) {
        video.step = 'setup';
        renderVideoModal();
        notify('Không quay được video. Hãy thử lại hoặc dùng trình duyệt khác.', 'error');
        return;
    }
    video.blob = blob;
    if (video.url) URL.revokeObjectURL(video.url);
    video.url = URL.createObjectURL(blob);
    const player = document.getElementById('video-output');
    player.src = video.url;
    const ext = videoExtension();
    document.getElementById('video-info').innerHTML = `${ext.toUpperCase()} · ${video.size[0]}×${video.size[1]} · ${formatClock(elapsed)}`
        + ` · ${(blob.size / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} MB`
        + (ext === 'webm' ? '<br><span class="warn">Trình duyệt này chỉ quay được WebM; một số ứng dụng (Zalo, Instagram) cần MP4, hãy dùng Chrome bản mới hoặc Safari để quay ra MP4.</span>' : '');
    video.step = 'done';
    renderVideoModal();
}

function downloadVideo() {
    if (!video.url) return;
    const link = document.createElement('a');
    link.href = video.url;
    link.download = videoFile().name;
    document.body.appendChild(link);
    link.click();
    link.remove();
}

async function shareVideo() {
    try {
        await navigator.share({ files: [videoFile()], title: document.getElementById('title').value || 'Màn pháo hoa' });
    } catch (e) {
        // Người dùng đóng bảng chia sẻ
    }
}

function restartVideo() {
    document.getElementById('video-output').removeAttribute('src');
    video.step = 'setup';
    renderVideoModal();
}

function removeVideoFrame() {
    if (video.frame) video.frame.remove();
    video.frame = null;
}

function closeVideoModal() {
    removeVideoFrame();
    const player = document.getElementById('video-output');
    player.pause();
    player.removeAttribute('src');
    if (video.url) URL.revokeObjectURL(video.url);
    video.url = '';
    video.blob = null;
    video.step = 'setup';
    hideModal('video-modal');
    // Khung xem nhanh chạy lại như trước
    if (video.previousPreviewMode !== null) {
        previewMode = video.previousPreviewMode;
        video.previousPreviewMode = null;
        updateMiniInfo();
        sendPreview(true);
    }
}

// ---------------------------------------------------------------------------
// CHIA SẺ & SEO: tiêu đề, mô tả, ảnh hiện ra khi gửi link
// ---------------------------------------------------------------------------

// Mô tả khi chia sẻ: người dùng tự nhập, hoặc ghép từ dòng phụ và người thực hiện (giống trang chia sẻ)
function getShareDescription(config) {
    return config.seoDescription || [config.subtitle, config.author].filter(Boolean).join(' – ');
}

function getSeoImageConfig() {
    const seo = state.seo;
    if (seo.mode !== 'custom' || !seo.image) return {};
    return {
        seoImage: seo.image,
        seoImageText: seo.imageText ? undefined : false,
        seoImagePosition: seo.imagePosition !== 50 ? seo.imagePosition : undefined
    };
}

let seoPreviewTimer = null;
let seoPreviewVersion = 0;

function scheduleSeoPreview() {
    clearTimeout(seoPreviewTimer);
    seoPreviewTimer = setTimeout(renderSeoPreview, 350);
}

// Thẻ xem trước giống khung Facebook/Zalo hiện ra khi gửi link
async function renderSeoPreview() {
    const canvas = document.getElementById('seo-preview-canvas');
    if (!canvas) return;
    const config = getFinalConfig();
    document.getElementById('seo-preview-domain').textContent = window.location.hostname || 'localhost';
    document.getElementById('seo-preview-title').textContent = config.seoTitle || config.title;
    document.getElementById('seo-preview-desc').textContent = getShareDescription(config);
    [['seo-title', 90], ['seo-description', 200]].forEach(([id, max]) => {
        document.getElementById(`count-${id}`).textContent = `${document.getElementById(id).value.length}/${max}`;
    });
    const version = ++seoPreviewVersion;
    try {
        const card = await renderShareImage(config);
        if (version === seoPreviewVersion) canvas.getContext('2d').drawImage(card, 0, 0);
    } catch (e) {
        // Không vẽ được thì giữ ảnh cũ
    }
}

function renderSeoControls() {
    const seo = state.seo;
    const custom = seo.mode === 'custom' && !!seo.image;
    document.getElementById('seo-mode-auto')?.classList.toggle('active', !custom);
    document.getElementById('seo-mode-custom')?.classList.toggle('active', custom);
    document.getElementById('seo-image-options')?.classList.toggle('hide', !custom);
    const text = document.getElementById('seo-image-text');
    if (text) text.checked = seo.imageText;
    const position = document.getElementById('seo-image-position');
    if (position) position.value = seo.imagePosition;
    const label = document.getElementById('out-seo-image-position');
    if (label) {
        const [start, end] = seo.axis === 'x' ? ['sang trái', 'sang phải'] : ['lên trên', 'xuống dưới'];
        label.textContent = seo.imagePosition === 50 ? 'Giữa' : `Lệch ${seo.imagePosition < 50 ? start : end}`;
    }
}

function setSeoImageMode(mode) {
    if (mode === 'custom' && !state.seo.image) {
        // Chưa có ảnh: chọn ảnh xong mới chuyển sang "Ảnh của bạn"
        document.getElementById('seo-image-file').click();
        return;
    }
    state.seo.mode = mode;
    renderSeoControls();
    scheduleSeoPreview();
}

// Ảnh rộng hơn khung 1200×630 thì cắt bớt hai bên, hẹp hơn thì cắt trên dưới
function detectSeoImageAxis() {
    if (!state.seo.image) return;
    const img = new Image();
    img.onload = () => {
        state.seo.axis = img.naturalWidth / img.naturalHeight > 1200 / 630 ? 'x' : 'y';
        renderSeoControls();
    };
    img.src = state.seo.image;
}

// Thu nhỏ ảnh (cạnh dài tối đa maxSide) thành JPEG dạng DataURL để lưu trong trình duyệt
function shrinkImageToDataUrl(file, maxSide) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            const k = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(img.naturalWidth * k);
            canvas.height = Math.round(img.naturalHeight * k);
            canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
            URL.revokeObjectURL(url);
            resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Không đọc được ảnh'));
        };
        img.src = url;
    });
}

async function handleSeoImageUpload(input) {
    const file = input.files[0];
    input.value = '';
    if (!file) return;

    let imageUrl;
    if (isStaticEnv) {
        // Trang tĩnh lưu kịch bản trong trình duyệt (chỉ vài MB): thu nhỏ ảnh trước khi lưu
        try {
            imageUrl = await shrinkImageToDataUrl(file, 1600);
        } catch (e) {
            notify('Không đọc được file ảnh này.', 'error');
            return;
        }
    } else {
        const scenarioName = getUploadFolder();
        showLoading('Đang tải ảnh lên...');
        const formData = new FormData();
        formData.append('image', file);
        formData.append('filename', scenarioName);
        try {
            const response = await fetch('api/upload_image.php', { method: 'POST', body: formData });
            const data = await response.json();
            hideLoading();
            if (!data.success) {
                notify('Lỗi: ' + data.message, 'error');
                return;
            }
            imageUrl = data.url;
        } catch (e) {
            hideLoading();
            notify('Lỗi kết nối khi tải ảnh.', 'error');
            return;
        }
    }

    Object.assign(state.seo, { mode: 'custom', image: imageUrl, imagePosition: 50 });
    detectSeoImageAxis();
    renderSeoControls();
    scheduleSeoPreview();
    notify('Đã đặt ảnh khi chia sẻ!', 'success');
}

// ---------------------------------------------------------------------------
// CHIA SẺ: link có ảnh + tiêu đề xem trước, nhiều nền tảng, mã QR, ảnh thiệp
// ---------------------------------------------------------------------------

// Trang chia sẻ s/<tên>.html chứa sẵn ảnh, tiêu đề, mô tả cho mạng xã hội rồi tự mở màn trình diễn
function getShareUrl(filename) {
    return new URL(`s/${encodeURIComponent(filename)}.html`, window.location.href).href;
}

// Thông tin của lần chia sẻ hiện tại
const share = { id: '', url: '', published: true, title: '', description: '', imageCanvas: null };

// Trên GitHub Pages kịch bản chỉ lưu trong trình duyệt, nên chỉ kịch bản đã đưa vào configs/ mới có trang chia sẻ
async function resolveShareUrl(filename) {
    const pageUrl = getShareUrl(filename);
    if (!isStaticEnv) return { url: pageUrl, published: true };
    try {
        const response = await fetch(pageUrl, { method: 'HEAD', cache: 'no-store' });
        if (response.ok) return { url: pageUrl, published: true };
    } catch (e) {
        // Không kiểm tra được (vd mở file trực tiếp): coi như chưa đăng
    }
    return { url: getShowUrl(filename), published: false };
}

function refreshShareText() {
    const config = getFinalConfig();
    share.title = config.seoTitle || config.title;
    share.description = getShareDescription(config);
}

function updateShareBar(filename) {
    const shareBar = document.getElementById('share-bar');
    const shareUrlEl = document.getElementById('share-url');
    share.id = filename;
    share.url = getShareUrl(filename);
    shareUrlEl.innerText = share.url;
    shareBar.classList.remove('hide');
    resolveShareUrl(filename).then(({ url, published }) => {
        if (share.id !== filename) return;
        Object.assign(share, { url, published });
        shareUrlEl.innerText = url;
    });

    // Add highlight effect
    shareBar.classList.add('highlight-save');
    setTimeout(() => {
        shareBar.classList.remove('highlight-save');
    }, 2000);
}

// Sao chép; có cách dự phòng khi trang không chạy https (vd mở qua IP mạng LAN trên điện thoại)
async function copyText(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (e) {
        const input = document.createElement('textarea');
        input.value = text;
        input.style.cssText = 'position:fixed;opacity:0';
        document.body.appendChild(input);
        input.select();
        const ok = document.execCommand('copy');
        input.remove();
        return ok;
    }
}

async function copyShareLink() {
    if (!share.id) {
        notify('Vui lòng lưu kịch bản trước khi sao chép link!', 'warning');
        return;
    }
    if (await copyText(share.url)) {
        notify('Đã sao chép link chia sẻ!', 'success');
    } else {
        notify('Không thể sao chép tự động, hãy chọn link và sao chép thủ công.', 'error');
    }
}

// Điện thoại/máy tính bảng: theo User-Agent, iPad đời mới (báo là Mac) và thiết bị cảm ứng màn hình nhỏ
const isMobileDevice = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent))
    || (navigator.maxTouchPoints > 0 && window.matchMedia('(pointer: coarse)').matches && window.innerWidth < 1024);

function openShareWindow(href) {
    const win = window.open(href, '_blank');
    if (win) {
        win.opener = null;
    } else {
        notify('Trình duyệt đã chặn cửa sổ mới, hãy cho phép popup để chia sẻ.', 'warning');
    }
}

const SHARE_PLATFORMS = [
    { id: 'native', name: 'Ứng dụng khác', icon: '<i class="fas fa-share-nodes"></i>', bg: '#7c6cff', available: () => !!navigator.share },
    { id: 'facebook', name: 'Facebook', icon: '<i class="fab fa-facebook-f"></i>', bg: '#1877f2' },
    { id: 'messenger', name: 'Messenger', icon: '<i class="fab fa-facebook-messenger"></i>', bg: 'linear-gradient(45deg, #0695ff, #a334fa, #ff6968)' },
    { id: 'zalo', name: 'Zalo', icon: 'zalo', bg: '#0068ff' },
    { id: 'telegram', name: 'Telegram', icon: '<i class="fab fa-telegram"></i>', bg: '#229ed9' },
    { id: 'whatsapp', name: 'WhatsApp', icon: '<i class="fab fa-whatsapp"></i>', bg: '#25d366' },
    { id: 'x', name: 'X (Twitter)', icon: '<i class="fab fa-x-twitter"></i>', bg: '#000000' },
    { id: 'threads', name: 'Threads', icon: '<i class="fab fa-threads"></i>', bg: '#000000' },
    { id: 'linkedin', name: 'LinkedIn', icon: '<i class="fab fa-linkedin-in"></i>', bg: '#0a66c2' },
    { id: 'instagram', name: 'Instagram', icon: '<i class="fab fa-instagram"></i>', bg: 'linear-gradient(45deg, #f9ce34, #ee2a7b, #6228d7)' },
    { id: 'tiktok', name: 'TikTok', icon: '<i class="fab fa-tiktok"></i>', bg: '#000000' },
    { id: 'email', name: 'Email', icon: '<i class="fas fa-envelope"></i>', bg: '#ea4335' },
    { id: 'sms', name: 'Tin nhắn', icon: '<i class="fas fa-comment-sms"></i>', bg: '#34c759', available: isMobileDevice }
];

async function shareTo(platform) {
    if (!share.id) {
        notify('Vui lòng lưu kịch bản trước khi chia sẻ!', 'warning');
        return;
    }
    refreshShareText();
    const url = share.url;
    const text = `🎆 ${share.title}${share.description ? ` – ${share.description}` : ''}`;
    const enc = encodeURIComponent;
    const useNativeShare = isMobileDevice() && !!navigator.share;

    switch (platform) {
        case 'native':
            try {
                await navigator.share({ title: share.title, text, url });
            } catch (e) {
                // Người dùng đóng bảng chia sẻ
            }
            return;
        case 'facebook':
            return openShareWindow(`https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`);
        case 'messenger':
            // Điện thoại: bảng chia sẻ của hệ thống có sẵn Messenger; máy tính: Messenger không có link chia sẻ công khai
            if (useNativeShare) return shareTo('native');
            if (isMobileDevice()) {
                window.location.href = `fb-messenger://share/?link=${enc(url)}`;
                return;
            }
            await copyText(url);
            notify('Đã sao chép link, hãy dán (Ctrl+V) vào cuộc trò chuyện Messenger.', 'success');
            return openShareWindow('https://www.messenger.com/');
        case 'zalo':
            // Zalo không có link chia sẻ công khai: điện thoại dùng bảng chia sẻ hệ thống, máy tính mở Zalo Web
            if (useNativeShare) return shareTo('native');
            await copyText(url);
            notify('Đã sao chép link, hãy dán (Ctrl+V) vào cuộc trò chuyện Zalo.', 'success');
            return openShareWindow('https://chat.zalo.me/');
        case 'telegram':
            return openShareWindow(`https://t.me/share/url?url=${enc(url)}&text=${enc(text)}`);
        case 'whatsapp':
            return openShareWindow(`https://wa.me/?text=${enc(`${text}\n${url}`)}`);
        case 'x':
            return openShareWindow(`https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(url)}`);
        case 'threads':
            return openShareWindow(`https://www.threads.net/intent/post?text=${enc(`${text}\n${url}`)}`);
        case 'linkedin':
            return openShareWindow(`https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`);
        case 'email':
            window.location.href = `mailto:?subject=${enc(share.title)}&body=${enc(`${text}\n\nMở xem màn pháo hoa: ${url}`)}`;
            return;
        case 'sms':
            window.location.href = `sms:?&body=${enc(`${text} ${url}`)}`;
            return;
        case 'instagram':
        case 'tiktok': {
            // Hai nền tảng này không nhận link từ web: tải ảnh thiệp để đăng và sao chép link để dán vào phần mô tả/bio
            await copyText(url);
            await downloadShareImage();
            const name = platform === 'instagram' ? 'Instagram' : 'TikTok';
            notify(`${name} không cho chia sẻ link từ web: đã tải ảnh thiệp và sao chép link để bạn đăng kèm.`, 'info');
            return;
        }
    }
}

function renderShareGrid() {
    const zaloIcon = document.querySelector('.share-actions .btn-social.zalo svg')?.outerHTML || 'Zalo';
    document.getElementById('share-grid').innerHTML = SHARE_PLATFORMS
        .filter(p => !p.available || p.available())
        .map(p => `
            <button type="button" class="share-item" onclick="shareTo('${p.id}')" title="Chia sẻ qua ${p.name}">
                <span class="share-icon${p.id === 'zalo' ? ' is-zalo' : ''}" style="background: ${p.bg}">${p.icon === 'zalo' ? zaloIcon : p.icon}</span>
                <span class="share-name">${p.name}</span>
            </button>`).join('');
}

// Vẽ mã QR lên canvas (nền trắng, chừa lề 2 ô theo chuẩn để camera dễ nhận)
function drawQr(canvas, text, size) {
    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    const count = qr.getModuleCount();
    const cell = size / (count + 4);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#0b0d14';
    for (let row = 0; row < count; row++) {
        for (let col = 0; col < count; col++) {
            if (qr.isDark(row, col)) {
                ctx.fillRect(Math.floor((col + 2) * cell), Math.floor((row + 2) * cell), Math.ceil(cell), Math.ceil(cell));
            }
        }
    }
}

function downloadDataUrl(dataUrl, name) {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
}

// Mã QR dạng thẻ để in: tiêu đề + QR + lời nhắn quét mã
function downloadShareQr() {
    if (!share.id) return;
    refreshShareText();
    const W = 720, H = 900, qrSize = 520;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#1d1033';
    ctx.font = '700 40px Outfit, Inter, sans-serif';
    let titleSize = 40;
    while (titleSize > 24 && ctx.measureText(share.title).width > W - 80) {
        titleSize -= 2;
        ctx.font = `700 ${titleSize}px Outfit, Inter, sans-serif`;
    }
    ctx.fillText(share.title, W / 2, 92);

    const qrCanvas = document.createElement('canvas');
    qrCanvas.width = qrCanvas.height = qrSize;
    drawQr(qrCanvas, share.url, qrSize);
    ctx.drawImage(qrCanvas, (W - qrSize) / 2, 140);

    ctx.fillStyle = '#6b21a8';
    ctx.font = '600 28px Inter, sans-serif';
    ctx.fillText('Quét mã để xem màn pháo hoa 🎆', W / 2, 720);
    ctx.fillStyle = '#64748b';
    ctx.font = '400 22px Inter, sans-serif';
    ctx.fillText(new URL(share.url).hostname, W / 2, 762);

    downloadDataUrl(canvas.toDataURL('image/png'), `qr-${share.id}.png`);
}

async function downloadShareImage() {
    if (!share.id) return;
    const canvas = share.imageCanvas || await renderShareImage(getFinalConfig());
    downloadDataUrl(canvas.toDataURL('image/jpeg', 0.92), `${share.id}.jpg`);
}

async function openShareModal() {
    if (!share.id) {
        notify('Vui lòng lưu kịch bản trước khi chia sẻ!', 'warning');
        return;
    }
    refreshShareText();
    showModal('share-modal');
    renderShareGrid();

    const { url, published } = await resolveShareUrl(share.id);
    Object.assign(share, { url, published });
    document.getElementById('share-link-input').value = url;
    document.getElementById('share-preview-domain').textContent = new URL(url).hostname;
    document.getElementById('share-preview-title').textContent = share.title;
    document.getElementById('share-preview-desc').textContent = share.description;

    // Cảnh báo trên GitHub Pages: kịch bản lưu trong trình duyệt không tới được người nhận
    const warning = document.getElementById('share-warning');
    warning.classList.toggle('hide', !isStaticEnv);
    if (isStaticEnv) {
        warning.innerHTML = published
            ? '<i class="fas fa-circle-info"></i><span>Người nhận sẽ thấy <strong>bản đã đăng</strong> của kịch bản này. Những thay đổi bạn vừa lưu (kể cả tiêu đề, mô tả, ảnh khi chia sẻ) chỉ nằm trong trình duyệt của bạn. Để cập nhật: bấm <strong>Xuất</strong> và <strong>Tải ảnh thiệp</strong> bên dưới, chép file <code>.json</code> và <code>.jpg</code> vào <code>src/static/configs/</code> rồi đăng lại trang.</span>'
            : '<i class="fas fa-triangle-exclamation"></i><span>Kịch bản này mới chỉ lưu trong trình duyệt của bạn nên <strong>người khác mở link sẽ không xem được</strong>. Để gửi tặng: bấm <strong>Xuất</strong> và <strong>Tải ảnh thiệp</strong> bên dưới, đưa file <code>.json</code> và <code>.jpg</code> vào thư mục <code>src/static/configs/</code> của dự án rồi đăng lại trang (hoặc chạy trên máy chủ có PHP).</span>';
    }

    const qrCanvas = document.getElementById('share-qr');
    qrCanvas.width = qrCanvas.height = 320;
    drawQr(qrCanvas, url, 320);

    renderShareTracking();
    share.imageCanvas = await renderShareImage(getFinalConfig());
    document.getElementById('share-preview-img').src = share.imageCanvas.toDataURL('image/jpeg', 0.88);
}

function closeShareModal() {
    hideModal('share-modal');
}

async function copyScriptLink(filename) {
    const { url } = await resolveShareUrl(filename);
    if (await copyText(url)) {
        notify('Đã sao chép link kịch bản!', 'success');
    } else {
        notify('Không thể sao chép link, hãy thử lại.', 'error');
    }
}

// My Scripts Management
function openScriptsModal() {
    showModal('scripts-modal');
    loadScriptsList();
}

function loadScriptsList() {
    const list = document.getElementById('scripts-list');
    list.innerHTML = '<div class="spinner"></div>';

    const fetchPromise = isStaticEnv
        ? fetch('configs/configs_index.json').then(r => r.json())
        : fetch('api/manage_configs.php?action=list').then(r => r.json());

    fetchPromise
        .then(data => {
            // Bỏ file chỉ mục và file tạm tạo ra mỗi lần bấm "Xem thử"
            data = data.filter(s => s.id !== 'configs_index' && s.id !== 'preview_temp');
            list.innerHTML = '';

            // Add local scripts if in static env
            if (isStaticEnv) {
                const localScripts = JSON.parse(localStorage.getItem('my_firework_scripts') || '{}');
                Object.keys(localScripts).filter(id => id !== 'preview_temp').forEach(id => {
                    const s = localScripts[id];
                    // Avoid duplicates if already in static list
                    if (!data.find(item => item.id === id)) {
                        data.push({
                            id: id,
                            title: s.title || id,
                            author: s.author || 'Tôi',
                            eventCount: s.events ? s.events.length : 0,
                            status: 'local'
                        });
                    }
                });
            }

            if (data.length === 0) {
                list.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted);">Bạn chưa có kịch bản nào.</p>';
                return;
            }

            data.forEach(script => {
                const item = document.createElement('div');
                item.className = 'script-item';
                item.dataset.id = script.id;
                const isPrivate = script.status === 'private';
                const isLocal = script.status === 'local';

                item.onclick = (e) => {
                    if (e.target.closest('.btn')) return;
                    copyScriptLink(script.id);
                };

                // Nút có chữ (điện thoại không có chú thích khi rê chuột); nhãn trạng thái ghi rõ bằng chữ
                item.innerHTML = `
                <h4 title="${escapeHtml(script.title)}">${escapeHtml(script.title)}</h4>
                <div class="meta">
                    <span><i class="fas fa-user"></i> ${escapeHtml(script.author)}</span>
                    <span><i class="fas fa-fireworks"></i> ${escapeHtml(script.eventCount)} phát bắn</span>
                    <span class="script-badges">${isPrivate ? '<span class="gift-badge" title="Kịch bản riêng tư: không xóa được từ đây"><i class="fas fa-lock"></i>Riêng tư</span>' : ''}${isLocal ? '<span class="gift-badge" title="Chỉ lưu trên trình duyệt này"><i class="fas fa-laptop"></i>Trên máy này</span>' : ''}</span>
                </div>
                <div class="script-actions">
                    <button class="btn primary small" onclick="editScript('${script.id}')"><i class="fas fa-edit"></i> Sửa</button>
                    <button class="btn secondary small" onclick="duplicateScript('${script.id}')"><i class="fas fa-copy"></i> Nhân bản</button>
                    <button class="btn secondary small" onclick="previewScript('${script.id}')"><i class="fas fa-play"></i> Xem</button>
                    ${(!isPrivate || isLocal) ? `<button class="btn danger small is-icon" onclick="deleteScript('${script.id}')" title="Xóa" aria-label="Xóa kịch bản"><i class="fas fa-trash"></i></button>` : ''}
                </div>
            `;
                list.appendChild(item);
            });
            showGiftBadges();
        })
        .catch(err => {
            list.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--error);">Không thể tải danh sách: ${escapeHtml(err.message)}</p>`;
        });
}


async function duplicateScript(filename) {
    showLoading('Đang nhân bản kịch bản...');

    const handleConfig = async (config) => {
        const newName = await getUniqueFilename(filename + '_copy', '');
        loadConfigIntoState(config, newName);
        hideModal('scripts-modal');
        document.getElementById('share-bar').classList.add('hide');
        hideLoading();
        notify(`Đã nhân bản kịch bản thành: ${newName}`, 'success');
    };

    if (isStaticEnv) {
        const localScripts = JSON.parse(localStorage.getItem('my_firework_scripts') || '{}');
        if (localScripts[filename]) {
            handleConfig(localScripts[filename]);
            return;
        }
    }

    fetch(`configs/${filename}.json?t=${Date.now()}`)
        .then(response => {
            if (!response.ok) throw new Error('Không thể tải file kịch bản');
            return response.json();
        })
        .then(handleConfig)
        .catch(err => {
            hideLoading();
            notify('Không thể nhân bản kịch bản: ' + err.message, 'error');
        });
}

function previewScript(filename) {
    window.open(getShowUrl(filename), '_blank');
}

function editScript(filename) {
    showLoading('Đang tải kịch bản...');

    if (isStaticEnv) {
        const localScripts = JSON.parse(localStorage.getItem('my_firework_scripts') || '{}');
        if (localScripts[filename]) {
            loadConfigIntoState(localScripts[filename], filename);
            hideModal('scripts-modal');
            updateShareBar(filename);
            markSaved();
            hideLoading();
            notify('Đã tải kịch bản thành công!', 'success');
            return;
        }
    }

    fetch(`configs/${filename}.json?t=${Date.now()}`)
        .then(response => {
            if (!response.ok) throw new Error('Không thể tải file kịch bản');
            return response.json();
        })
        .then(config => {
            loadConfigIntoState(config, filename);
            hideModal('scripts-modal');
            updateShareBar(filename);
            markSaved();
            hideLoading();
            notify('Đã tải kịch bản thành công!', 'success');
        })
        .catch(err => {
            hideLoading();
            notify('Không thể tải kịch bản: ' + err.message, 'error');
        });
}


function deleteScript(filename) {
    confirmAction(`Bạn có chắc chắn muốn xóa kịch bản "${filename}"?`, () => {
        showLoading('Đang xóa kịch bản...');

        if (isStaticEnv) {
            const localScripts = JSON.parse(localStorage.getItem('my_firework_scripts') || '{}');
            if (localScripts[filename]) {
                delete localScripts[filename];
                localStorage.setItem('my_firework_scripts', JSON.stringify(localScripts));
                loadScriptsList();
                if (state.currentFilename === filename) {
                    document.getElementById('share-bar').classList.add('hide');
                }
                hideLoading();
                notify('Đã xóa kịch bản thành công!', 'success');
                return;
            }
        }

        fetch('api/manage_configs.php?action=delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename })
        })
            .then(response => {
                if (!response.ok) throw new Error('Mạng không ổn định hoặc lỗi server');
                return response.json();
            })
            .then(data => {
                hideLoading();
                if (data.success) {
                    removeOwnerKey(filename);
                    loadScriptsList();
                    if (state.currentFilename === filename) {
                        document.getElementById('share-bar').classList.add('hide');
                    }
                    notify('Đã xóa kịch bản thành công!', 'success');
                } else {
                    notify('Lỗi: ' + data.message, 'error');
                }
            })
            .catch(err => {
                hideLoading();
                notify('Lỗi khi xóa: ' + err.message, 'error');
            });
    });
}


// Import / Export
function exportConfig() {
    const config = getFinalConfig();
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(config, null, 2));
    const downloadAnchorNode = document.createElement('a');
    const filename = (document.getElementById('filename').value || 'firework_config') + '.json';

    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", filename);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}

function importConfig(e) {
    const file = e.target.files[0];
    if (!file) return;

    confirmAction('Việc nhập kịch bản mới sẽ ghi đè lên kịch bản hiện tại. Bạn có chắc chắn muốn tiếp tục?', () => {
        showLoading('Đang nhập kịch bản...');
        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const config = JSON.parse(e.target.result);
                loadConfigIntoState(config, file.name.replace('.json', ''));
                hideLoading();
                notify('Đã nhập kịch bản thành công!', 'success');
            } catch (err) {
                hideLoading();
                notify('Lỗi: File JSON không đúng định dạng.', 'error');
            }
        };
        reader.readAsText(file);
    });
    // Reset input
    e.target.value = '';
}

function loadConfigIntoState(config, filename) {
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
    syncLoopState();
    document.getElementById('filename').value = filename;

    state.events = [];
    state.nextId = 1;
    state.activeEventId = null;
    state.currentFilename = filename;
    state.status = config.status || 'public';
    state.showBackground = !!config.showBackground;
    state.smoke = ['light', 'heavy'].includes(config.smoke) ? config.smoke : '';
    renderSmoke();
    state.water = ['third', 'half'].includes(config.water) ? config.water : '';
    state.decor = ['lanterns', 'balloons', 'both'].includes(config.decor) ? config.decor : '';
    renderScene();
    state.background = config.background || null;
    state.music = config.music && typeof config.music.url === 'string' ? { ...config.music } : null;
    const effectsVolume = Number(config.effectsVolume);
    state.effectsVolume = config.effectsVolume !== undefined && Number.isFinite(effectsVolume) ? Math.max(0, Math.min(1, effectsVolume)) : 1;
    previewMusicOn = false;
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
        // Kịch bản lưu bởi builder phiên bản cũ dùng tọa độ 0-1: đổi sang 0-100 (phát nào có cả x, y trong khoảng 0-1)
        config.events.forEach(ev => {
            if (typeof ev.x === 'number' && typeof ev.y === 'number' && ev.x <= 1 && ev.y <= 1) {
                // Làm tròn 1 chữ số thập phân (0.3 * 100 = 30.000000000000004)
                ev.x = Math.round(ev.x * 1000) / 10;
                ev.y = Math.round(ev.y * 1000) / 10;
            }
        });
        config.events.forEach(ev => addEvent(ev));
    } else {
        addEvent();
    }
    renderInspector();
    updateMiniInfo();
    updateScriptNameLabel();
}

function previewConfig() {
    // Mở tab ngay lúc bấm nút: nếu đợi lưu xong mới mở, trình duyệt (nhất là Safari/iPhone) sẽ chặn popup
    const previewWindow = window.open('', '_blank');
    saveConfig(true).then(filename => {
        if (filename) {
            if (previewWindow) previewWindow.location.href = getShowUrl(filename);
            else window.open(getShowUrl(filename), '_blank');
        } else if (previewWindow) {
            previewWindow.close();
        }
    }).catch(err => {
        // Lỗi đã được hiển thị trong saveConfig
        if (previewWindow) previewWindow.close();
    });
}

// Utils
function showModal(id) {
    document.getElementById(id).classList.remove('hide');
}

function hideModal(id) {
    document.getElementById(id).classList.add('hide');
}

let lastToggleTime = 0;
// Mở/đóng ngăn "Cấu hình chung" (dạng ngăn trượt trên tablet/điện thoại; trên máy tính là cột cố định)
function toggleSidebar(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }

    // Ngăn chặn double click/tap quá nhanh gây bật-tắt tức thì
    const now = Date.now();
    if (now - lastToggleTime < 300) return;
    lastToggleTime = now;

    closeMoreMenu();
    const panel = document.getElementById('settings-panel');
    const overlay = document.getElementById('sidebar-overlay');
    const open = !panel.classList.contains('open');
    panel.classList.toggle('open', open);
    overlay.classList.toggle('show', open);
}

function toggleMoreMenu() {
    document.getElementById('more-menu').classList.toggle('hide');
}

function closeMoreMenu() {
    document.getElementById('more-menu')?.classList.add('hide');
}

/**
 * XEM NHANH
 * Chạy chính trình phát thật (index.html?preview=1) trong iframe, builder gửi kịch bản sang qua postMessage.
 * Nhờ vậy những gì thấy khi soạn giống hệt khi trình diễn: vật lý, hình dạng, ảnh, nền, cách xử lý riêng cho điện thoại.
 */

// Kích thước màn hình được giả lập. Trình phát xử lý điện thoại khác máy tính (thu hẹp vùng bắn, pháo nhỏ hơn).
const PREVIEW_DEVICES = {
    // Mở builder trên máy tính thì giả lập đúng màn hình đang dùng, mở trên máy nhỏ thì giả lập 1366x768
    desktop: () => window.innerWidth >= 1024
        ? { width: window.innerWidth, height: Math.max(600, window.innerHeight) }
        : { width: 1366, height: 768 },
    mobile: () => ({ width: 390, height: 844 })
};
let previewDevice = 'desktop';
let previewReady = false;
// 'loop': lặp cả kịch bản, 'once': đang chạy một lượt, 'idle': không lặp và chưa bấm chạy
let previewMode = 'loop';
let previewRefreshTimer = null;

function getPreviewFrame() {
    return document.getElementById('mini-preview-frame');
}

// Gửi kịch bản hiện tại sang trình phát. restart = true: chạy lại ngay từ đợt đầu.
function sendPreview(restart) {
    clearTimeout(previewRefreshTimer);
    const frame = getPreviewFrame();
    if (!state.miniPreviewEnabled || !previewReady || !frame || !frame.contentWindow) return;

    const config = getFinalConfig();
    const index = state.activeEventId ? state.events.findIndex(e => e.id === state.activeEventId) : -1;
    if (index !== -1) {
        // Đang chọn một phát bắn: chỉ bắn lặp lại phát đó (nhạc không còn khớp nhịp nên dừng)
        config.loop = true;
        config.events = [{ ...config.events[index], burst: 1, delay: 0 }];
        config.music = undefined;
        if (previewMusicPlaying) stopPreviewMusic();
    } else if (previewMode === 'idle') {
        config.events = [];
    } else {
        config.loop = previewMode === 'loop';
    }
    frame.contentWindow.postMessage({ type: 'firework-preview', config, restart }, window.location.origin);
}

// Gom các thay đổi liên tiếp rồi mới gửi một lần. Đang xem riêng một phát bắn thì bắn lại ngay để thấy thay đổi,
// còn khi xem cả kịch bản thì chỉ cập nhật cho các đợt tiếp theo.
function refreshMiniPreview() {
    clearTimeout(previewRefreshTimer);
    previewRefreshTimer = setTimeout(() => sendPreview(!!state.activeEventId), 300);
}

function updateMiniInfo() {
    const info = document.getElementById('mini-preview-info');
    if (!info) return;
    const index = state.activeEventId ? state.events.findIndex(e => e.id === state.activeEventId) : -1;
    if (index !== -1) info.innerText = 'Đang hiển thị phát bắn #' + (index + 1);
    else if (previewMode === 'once') info.innerText = 'Đang chạy kịch bản...';
    else if (previewMode === 'idle') info.innerText = 'Bấm ▶ để chạy kịch bản';
    else info.innerText = 'Đang hiển thị toàn bộ';
}

window.addEventListener('message', (e) => {
    if (e.origin !== window.location.origin || !e.data) return;
    if (e.data.type === 'firework-preview-ready' && e.source === getPreviewFrame()?.contentWindow) {
        previewReady = true;
        sendPreview(true);
    } else if (e.data.type === 'firework-preview-started' && previewMusicOn && !state.activeEventId) {
        startPreviewMusic();
    } else if (e.data.type === 'firework-preview-ended' && previewMode === 'once' && !state.activeEventId) {
        previewMode = 'idle';
        const info = document.getElementById('mini-preview-info');
        if (info) info.innerText = 'Đã chạy xong';
        if (previewMusicPlaying) previewMusicStopTimer = setTimeout(stopPreviewMusic, 3000);
    }
});

function loadPreviewFrame() {
    previewReady = false;
    resizeMiniStages();
    getPreviewFrame().src = 'index.html?preview=1';
}

// Đặt iframe ở kích thước màn hình giả lập rồi thu nhỏ cho vừa khung xem nhanh (giữ đúng tỉ lệ)
function resizeMiniStages() {
    const card = document.getElementById('mini-preview');
    const container = document.querySelector('.mini-preview-canvas-container');
    const stage = document.getElementById('mini-preview-stage');
    const frame = getPreviewFrame();
    if (!card || !container || !stage || !frame || card.classList.contains('collapsed')) return;
    const { width, height } = PREVIEW_DEVICES[previewDevice]();

    if (!card.classList.contains('fullscreen')) {
        // Chiều cao khung theo tỉ lệ màn hình giả lập, chừa chỗ cho bảng chỉnh sửa/danh sách bên dưới
        const maxHeight = window.innerHeight * (window.innerWidth < 768 ? 0.34 : 0.42);
        container.style.height = Math.round(Math.min(container.clientWidth * height / width, maxHeight)) + 'px';
    }

    const scale = Math.min(container.clientWidth / width, container.clientHeight / height) || 0.01;
    frame.style.width = width + 'px';
    frame.style.height = height + 'px';
    frame.style.transform = `scale(${scale})`;
    stage.style.width = width * scale + 'px';
    stage.style.height = height * scale + 'px';
    // Khung hẹp (xem kiểu điện thoại trên màn hình nhỏ): thước ngang chỉ ghi 0 và 100 cho khỏi dính chữ
    stage.classList.toggle('narrow', width * scale < 160);
    positionMobileSheet();
}

function updateMiniRulers() {
    const rulerX = document.getElementById('mini-ruler-x');
    const rulerY = document.getElementById('mini-ruler-y');
    if (!rulerX || !rulerY) return;

    rulerX.innerHTML = '';
    rulerY.innerHTML = '';

    const steps = [0, 20, 40, 60, 80, 100];

    steps.forEach(s => {
        const spanX = document.createElement('span');
        spanX.innerText = s;
        rulerX.appendChild(spanX);

        const spanY = document.createElement('span');
        // Y ruler: 100 is top, 0 is bottom
        spanY.innerText = 100 - s;
        rulerY.appendChild(spanY);
    });
}

// Ẩn/hiện khung xem nhanh. Khi ẩn thì dừng hẳn trình phát bên trong để không tốn CPU.
function toggleMiniPreview(force) {
    state.miniPreviewEnabled = force !== undefined ? force : !state.miniPreviewEnabled;
    const card = document.getElementById('mini-preview');
    const btn = document.getElementById('btn-toggle-mini-preview');
    card.classList.toggle('collapsed', !state.miniPreviewEnabled);
    if (btn) btn.title = state.miniPreviewEnabled ? 'Thu gọn xem nhanh' : 'Mở xem nhanh';

    if (state.miniPreviewEnabled) {
        previewMode = document.getElementById('loop').checked ? 'loop' : 'idle';
        updateMiniRulers();
        updateMiniInfo();
        loadPreviewFrame();
    } else {
        previewReady = false;
        getPreviewFrame().src = 'about:blank';
    }
    positionMobileSheet();
}

function setPreviewDevice(device) {
    previewDevice = device;
    const isMobile = device === 'mobile';
    const btn = document.getElementById('btn-device-mini');
    if (btn) {
        btn.innerHTML = `<i class="fas fa-${isMobile ? 'mobile-screen' : 'desktop'}"></i>`;
        btn.title = isMobile
            ? 'Đang xem như trên điện thoại - bấm để xem như trên máy tính'
            : 'Đang xem như trên máy tính - bấm để xem như trên điện thoại';
    }
}

function togglePreviewDevice() {
    setPreviewDevice(previewDevice === 'desktop' ? 'mobile' : 'desktop');
    // Khung chọn vị trí đổi theo tỉ lệ màn hình mới
    renderInspector();
    // Trình phát xác định máy tính/điện thoại lúc tải trang nên phải tải lại
    if (state.miniPreviewEnabled) loadPreviewFrame();
}

// Chạy lại từ đầu (không lặp thì chạy một lượt)
function restartMiniPreview() {
    if (previewMode === 'idle') playMiniPreviewOnce();
    else sendPreview(true);
}

function toggleFullscreenMiniPreview() {
    const el = document.getElementById('mini-preview');
    // iPhone không hỗ trợ toàn màn hình cho phần tử thường: báo thay vì ném lỗi
    if (!fscreen.fullscreenEnabled) {
        notify('Trình duyệt này không hỗ trợ chế độ toàn màn hình.', 'warning');
        return;
    }
    if (!fscreen.fullscreenElement) {
        fscreen.requestFullscreen(el);
    } else {
        fscreen.exitFullscreen();
    }
}

// Handle fullscreen changes to resize canvas
fscreen.onfullscreenchange = () => {
    const el = document.getElementById('mini-preview');
    if (fscreen.fullscreenElement) {
        el.classList.add('fullscreen');
        notify('Đã vào chế độ toàn màn hình', 'info');
    } else {
        el.classList.remove('fullscreen');
    }
    // Small delay to ensure DOM is updated
    setTimeout(resizeMiniStages, 100);
};

function playMiniPreviewOnce() {
    if (state.events.length === 0) return;
    previewMode = 'once';
    updateMiniInfo();
    sendPreview(true);
}

// Các hàm được gọi từ thuộc tính onclick/onchange trong HTML
Object.assign(window, {
    toggleMiniPreview, togglePreviewDevice, toggleFullscreenMiniPreview, playMiniPreviewOnce, restartMiniPreview,
    createNewScript, selectEvent, closeInspector, addEventFromUI, addBurst, removeEvent, duplicateEvent, updateEvent,
    handleShellChange, toggleEmojiPicker, showEmojiGroup, pickTextEmoji, changeBurst, toggleEventColor, addColorToEvent, addCustomColor, removeColorFromEvent,
    rememberSection, editScript, duplicateScript, deleteScript, previewScript, copyShareLink, copyScriptLink,
    openScriptsModal, exportConfig, previewConfig, saveConfig, toggleSidebar, toggleMoreMenu, showModal,
    resizeMiniStages, notify, confirmAction, openShareModal, closeShareModal, shareTo, downloadShareQr,
    downloadShareImage, renderShareImage, renderInspector, setMusicFromUrl, removeMusic, useCurrentMusicTime,
    togglePreviewMusic, setSeoImageMode, openTemplatesModal, selectOccasion, startBlankScript, createFromTemplate,
    hideModal, setStartFrame, undo, redo, setOpenMode, setSmoke, setWater, setDecor, openLibrary, closeLibrary, setLibraryTag,
    toggleLibraryPreview, chooseLibraryItem, openBeatModal, setBeatDensity, applyBeatShow, drawBeatChart,
    openVideoModal, closeVideoModal, setVideoFormat, setVideoQuality, prepareVideo, stopVideo, downloadVideo, shareVideo,
    restartVideo, setTimelineView, zoomTrack, copyTrackingLink, enableOpenNotifications, checkGiftOpens
});
window.addEventListener('resize', resizeMiniStages);

