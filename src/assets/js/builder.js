import fscreen from './fscreen@1.0.1.js';
import '../scss/builder.scss';
import backgroundImgUrl from '../img/background.png';

// Assign to window for global access
window.fscreen = fscreen;

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
    background: null
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
    "Hoa cúc", "Liễu", "Cây cọ", "Vòng nhẫn", "Nổ chéo", "Nổ lách tách", "Nhấp nháy", "Đuôi ngựa",
    "Ma", "Nổ nhiều lần", "Trái tim", "Ngôi sao", "Kim cương", "Bông tuyết", "Bông sen", "Hành tinh",
    "Con bướm", "Cỏ 3 lá", "Cỏ 4 lá", "Mặt cười", "Mặt mèo", "Văn bản", "Hình ảnh", "Tạm dừng"
];

const SHELL_ICONS = {
    'Hoa cúc': '🌼', 'Liễu': '🌿', 'Cây cọ': '🌴', 'Vòng nhẫn': '⭕', 'Nổ chéo': '✖️', 'Nổ lách tách': '🎇',
    'Nhấp nháy': '✨', 'Đuôi ngựa': '🐎', 'Ma': '👻', 'Nổ nhiều lần': '💥', 'Trái tim': '❤️', 'Ngôi sao': '⭐',
    'Kim cương': '💎', 'Bông tuyết': '❄️', 'Bông sen': '🌸', 'Hành tinh': '🪐', 'Con bướm': '🦋',
    'Cỏ 3 lá': '☘️', 'Cỏ 4 lá': '🍀', 'Mặt cười': '😊', 'Mặt mèo': '🐱', 'Văn bản': '🔤', 'Hình ảnh': '🖼️',
    'Tạm dừng': '⏸️'
};

// Hiệu ứng luôn có sẵn trong loại pháo (trình phát tự bật), hiển thị dạng đã tích và khóa trong mục Nâng cao
const SHELL_BUILTIN_EFFECTS = {
    'Nổ lách tách': ['crackle'],
    'Nổ chéo': ['crossette'],
    'Vòng nhẫn': ['ring'],
    'Nhấp nháy': ['strobe'],
    'Đuôi ngựa': ['horsetail'],
    'Ma': ['streamers']
};

const FRAME_TYPES = [
    // Phát bắn chưa chọn khung (frame trống) thực tế hiển thị không khung, nên cần một lựa chọn tương ứng
    { name: 'Không khung', value: '' },
    { name: 'Vuông', value: 'square' },
    { name: 'Tròn', value: 'circle' },
    { name: 'Tam giác', value: 'triangle' },
    { name: 'Trái tim', value: 'heart' }
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

    if (state.events.length > 200) {
        isValid = false;
        errors.push('Kịch bản quá lớn (tối đa 200 phát bắn)');
    }

    // Check for high burst counts
    const highBurstEvent = state.events.find(e => e.burst > 100);
    if (highBurstEvent) {
        isValid = false;
        errors.push(`Phát bắn #${state.events.indexOf(highBurstEvent) + 1} có số đợt quá lớn (tối đa 100)`);
    }

    if (!isValid) {
        errors.forEach(err => notify(err, 'error'));
        const panel = document.getElementById('settings-panel');
        if (filenameInput.classList.contains('is-invalid') && window.innerWidth < 1200 && !panel.classList.contains('open')) {
            toggleSidebar();
        }
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

function addEvent(config = null) {
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
            starLife: 2500,
            spreadSize: 350,
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
            starLife: 2500,
            starLifeVariation: 0.125,
            spreadSize: 350,
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
    renderEventList();
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
        event.color = "Ngẫu nhiên";
    } else {
        event.color.splice(index, 1);
        if (event.color.length === 1) event.color = event.color[0];
        if (event.color.length === 0) event.color = "Ngẫu nhiên";
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
        document.getElementById('author').value = '';
        document.getElementById('filename').value = '';
        document.getElementById('loop').checked = true;
        syncLoopState();
        document.getElementById('share-bar').classList.add('hide');

        // Reset background
        state.showBackground = false;
        state.background = null;
        document.getElementById('show-background').checked = false;
        document.getElementById('background-upload-container').classList.add('hide');
        document.getElementById('background-preview').src = backgroundImgUrl;
        refreshMiniPreview();

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
        } else if (['strobe', 'pistil', 'streamers', 'crossette', 'crackle', 'horsetail', 'comet', 'floral', 'ring'].includes(field)) {
            event[field] = value === true;
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
    const shots = state.events.filter(e => e.shell !== 'Tạm dừng').length;
    el.textContent = state.events.length
        ? `${maxBurst} đợt · ${shots} phát bắn · khoảng ${formatDuration(total)}`
        : 'Chưa có phát bắn nào';
}

function updateScriptNameLabel() {
    const label = document.getElementById('script-name-label');
    if (!label) return;
    const title = document.getElementById('title').value.trim();
    const filename = document.getElementById('filename').value.trim();
    label.textContent = (title || 'Kịch bản mới') + (filename ? ` · ${filename}.json` : '');
}

// Các chấm màu (hoặc ảnh thu nhỏ) của một phát bắn
function renderColorDots(event) {
    if (event.shell === 'Hình ảnh' && event.imageUrl) {
        return `<img class="thumb" src="${escapeHtml(normalizeAssetPath(event.imageUrl))}" alt="">`;
    }
    const colors = Array.isArray(event.color) ? event.color : [event.color || 'Ngẫu nhiên'];
    return colors.slice(0, 5).map(c => (c === 'Ngẫu nhiên' || c === 'random')
        ? '<span class="dot random" title="Ngẫu nhiên"></span>'
        : `<span class="dot" style="--c: ${escapeHtml(COLOR[c] || c)}" title="${escapeHtml(c)}"></span>`
    ).join('');
}

function renderShotRow(event) {
    const index = state.events.indexOf(event) + 1;
    const isPause = event.shell === 'Tạm dừng';
    const meta = isPause
        ? `<span><i class="fas fa-hourglass-half"></i>Nghỉ ${formatDuration(Number(event.duration) || 2000)}</span>`
        : `<span><i class="fas fa-location-dot"></i>${formatNumber(event.x)}, ${formatNumber(event.y)}</span>
           <span><i class="fas fa-clock"></i>${Number(event.delay) ? `+${formatNumber(event.delay)} ms` : 'Ngay'}</span>
           <span><i class="fas fa-maximize"></i>Cỡ ${formatNumber(event.size ?? 1)}</span>`;

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

function renderBurstGroup(burst, events) {
    const duration = getBurstDuration(events);
    const shots = events.filter(e => e.shell !== 'Tạm dừng').length;
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
                <button class="btn ghost small burst-add" onclick="addEventFromUI(${burst})" title="Thêm phát bắn vào đợt ${burst}">
                    <i class="fas fa-plus"></i><span>Thêm</span>
                </button>
            </header>
            <div class="burst-shots">${events.map(renderShotRow).join('')}</div>
        </section>`;
}

function renderEventList() {
    const container = document.getElementById('event-list');
    updateTimelineSummary();

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
    for (let b = 1; b <= maxBurst; b++) html += renderBurstGroup(b, getBurstEvents(b));
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
// BẢNG CHỈNH SỬA phát bắn đang chọn
// ---------------------------------------------------------------------------

// Mục nào đang mở/thu gọn (giữ nguyên khi chuyển sang phát bắn khác)
const openSections = { type: false, basic: true, position: true, color: true, sound: false, advanced: false };

function rememberSection(el) {
    openSections[el.dataset.section] = el.open;
}

function section(key, icon, title, hint, body) {
    return `
        <details class="insp-section" data-section="${key}" ${openSections[key] ? 'open' : ''} ontoggle="rememberSection(this)">
            <summary><i class="fas fa-${icon}"></i><span class="summary-title">${title}</span><span class="summary-hint" id="hint-${key}">${hint}</span></summary>
            <div class="insp-body">${body}</div>
        </details>`;
}

function numberField(event, field, label, { step = 1, min, max, placeholder = '', value } = {}) {
    const v = value !== undefined ? value : (event[field] ?? '');
    return `
        <div>
            <label for="f-${field}">${label}</label>
            <input type="number" id="f-${field}" step="${step}" ${min !== undefined ? `min="${min}"` : ''} ${max !== undefined ? `max="${max}"` : ''}
                value="${escapeHtml(v)}" placeholder="${placeholder}" onchange="updateEvent(${event.id}, '${field}', this.value)">
        </div>`;
}

// Ô màu đơn (màu chuyển, nhụy, lấp lánh, nhấp nháy): ô chọn màu + ô gõ tên/mã
function colorField(event, field, label) {
    return `
        <div>
            <label>${label}</label>
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
        </div>`);

    let specific = '';
    if (event.shell === 'Văn bản') {
        specific = `
            <div>
                <label for="f-text">Nội dung chữ</label>
                <input type="text" id="f-text" value="${escapeHtml(event.text)}" placeholder="VD: HAPPY BIRTHDAY" maxlength="60"
                    oninput="updateEvent(${event.id}, 'text', this.value)">
                <small class="field-hint">Có thể dùng [YEAR], [LUNAR_YEAR], [SINCE:2000].</small>
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
            </div>
            <div>
                <label for="f-frame">Khung ảnh</label>
                <select id="f-frame" onchange="updateEvent(${event.id}, 'frame', this.value)">
                    ${FRAME_TYPES.map(f => `<option value="${f.value}" ${(event.frame || '') === f.value ? 'selected' : ''}>${f.name}</option>`).join('')}
                </select>
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
                <label for="f-burst">Đợt</label>
                <div class="stepper">
                    <button type="button" onclick="changeBurst(${event.id}, -1)" title="Đợt trước"><i class="fas fa-minus"></i></button>
                    <input type="number" id="f-burst" min="1" step="1" value="${escapeHtml(event.burst)}" onchange="updateEvent(${event.id}, 'burst', this.value)">
                    <button type="button" onclick="changeBurst(${event.id}, 1)" title="Đợt sau"><i class="fas fa-plus"></i></button>
                </div>
            </div>
            ${isPause ? '' : numberField(event, 'delay', 'Trễ (ms)', { step: 100, min: 0, max: 60000 })}
        </div>
        ${specific}`);

    if (isPause) {
        panel.innerHTML = header + basicSection;
        panel.scrollTop = keepScroll;
        return;
    }

    const others = getBurstEvents(Number(event.burst) || 1).filter(e => e !== event && e.shell !== 'Tạm dừng');
    const positionSection = section('position', 'location-crosshairs', 'Vị trí & kích thước', `${formatNumber(event.x)}, ${formatNumber(event.y)}`, `
        <div id="xy-pad" class="xy-pad${previewDevice === 'mobile' ? ' is-mobile' : ''}" title="Bấm hoặc kéo để chọn điểm nổ">
            ${others.map(o => `<span class="xy-other" style="left:${Number(o.x) || 0}%; top:${100 - (Number(o.y) || 0)}%">${state.events.indexOf(o) + 1}</span>`).join('')}
            <span class="xy-trail"></span>
            <span class="xy-dot"></span>
        </div>
        <div class="grid-3">
            ${numberField(event, 'x', 'X (trái → phải)', { step: 1, min: 0, max: 100 })}
            ${numberField(event, 'y', 'Y (đất → trời)', { step: 1, min: 0, max: 100 })}
            ${numberField(event, 'size', 'Cỡ pháo', { step: 0.5, min: 0, max: 10 })}
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
        ${numberField(event, 'rotation', 'Xoay hình (°)', { step: 15, min: -180, max: 180, placeholder: 'Ngẫu nhiên' })}`);

    const colors = Array.isArray(event.color) ? event.color : [event.color || 'Ngẫu nhiên'];
    const presetValues = COLORS.map(c => c.value);
    const customColors = colors.filter(c => !presetValues.includes(c));
    const colorSection = section('color', 'palette', event.shell === 'Hình ảnh' ? 'Màu khung ảnh' : 'Màu sắc', '', `
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
        <small class="note">Chọn nhiều màu để pháo đa sắc. "Ngẫu nhiên" (ô cầu vồng) cho mỗi hạt một màu.</small>`);

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
        <small class="note">Âm thanh chỉ nghe được khi bấm "Xem thử" (khung xem nhanh không phát tiếng).</small>`);

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
        </div>
        <div>
            <label for="f-glitter">Kiểu lấp lánh</label>
            <select id="f-glitter" onchange="updateEvent(${event.id}, 'glitter', this.value)">
                ${GLITTER_TYPES.map(g => `<option value="${g.value}" ${(event.glitter || '') === g.value ? 'selected' : ''}>${g.name}</option>`).join('')}
            </select>
        </div>
        <div class="grid-2">
            ${numberField(event, 'starDensity', 'Mật độ hạt (×)', { step: 0.1, min: 0.1, placeholder: '1' })}
            ${numberField(event, 'starCount', 'Số hạt cố định', { step: 10, min: 1, placeholder: 'Tự động' })}
            ${numberField(event, 'starLife', 'Tuổi thọ hạt (ms)', { step: 100, min: 100, placeholder: '2500' })}
            ${numberField(event, 'starLifeVariation', 'Độ lệch tuổi thọ', { step: 0.05, min: 0, max: 1, placeholder: '0.125' })}
            ${numberField(event, 'spreadSize', 'Độ rộng vụ nổ', { step: 10, min: 50, placeholder: '350' })}
            ${numberField(event, 'strobeFreq', 'Nhịp nháy (ms)', { step: 10, min: 10, placeholder: '50' })}
        </div>
        <div class="grid-2">
            ${colorField(event, 'secondColor', 'Màu chuyển sang')}
            ${numberField(event, 'transitionTime', 'Lúc chuyển màu (ms)', { step: 100, min: 0, placeholder: 'Tự động' })}
            ${colorField(event, 'glitterColor', 'Màu lấp lánh')}
            ${colorField(event, 'pistilColor', 'Màu nhụy')}
            ${colorField(event, 'strobeColor', 'Màu nhấp nháy')}
        </div>`);

    panel.innerHTML = header + typeSection + basicSection + positionSection + colorSection + soundSection + advancedSection;
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
    if (color !== 'Ngẫu nhiên' && current.includes(color)) {
        const rest = current.filter(c => c !== color);
        event.color = rest.length === 0 ? 'Ngẫu nhiên' : (rest.length === 1 ? rest[0] : rest);
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

async function handleImageUpload(id, input) {
    const file = input.files[0];
    if (!file) return;

    let scenarioName = document.getElementById('filename').value.trim();
    if (!scenarioName) {
        notify('Vui lòng nhập tên kịch bản trước khi tải ảnh!', 'warning');
        input.value = '';
        return;
    }

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


function getFinalConfig() {
    return {
        title: document.getElementById('title').value || "Kịch bản mới",
        subtitle: document.getElementById('subtitle').value || "",
        author: document.getElementById('author').value || "Anonymous",
        loop: document.getElementById('loop').checked,
        showBackground: state.showBackground,
        background: state.background,
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
                    localStorage.setItem('my_firework_scripts', JSON.stringify(localScripts));
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

                    // Auto-close modal after success message
                    setTimeout(() => {
                        hideModal('save-modal');
                    }, 1500);
                } else {
                    hideLoading();
                }
                resolve(filename);
            }, 500);
        });
    }

    return fetch('api/save_config.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, config })
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                if (!isPreview) {
                    state.currentFilename = data.filename;
                    document.getElementById('save-status').innerText = 'Đã lưu kịch bản thành công!';
                    document.getElementById('save-spinner').classList.add('hide');
                    document.getElementById('save-actions').classList.remove('hide');
                    updateShareBar(data.filename);

                    // Auto-close modal after success message
                    setTimeout(() => {
                        hideModal('save-modal');
                    }, 1500);
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


function updateShareBar(filename) {
    const shareBar = document.getElementById('share-bar');
    const shareUrl = document.getElementById('share-url');
    const url = getShowUrl(filename);

    shareUrl.innerText = url;
    shareBar.classList.remove('hide');

    // Add highlight effect
    shareBar.classList.add('highlight-save');
    setTimeout(() => {
        shareBar.classList.remove('highlight-save');
    }, 2000);
}


function copyShareLink() {
    const url = document.getElementById('share-url').innerText;
    if (!url) {
        notify('Vui lòng lưu kịch bản trước khi sao chép link!', 'warning');
        return;
    }
    navigator.clipboard.writeText(url).then(() => {
        const btn = document.getElementById('btn-copy-link');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-check"></i> Đã sao chép!';
        notify('Đã sao chép link chia sẻ!', 'success');
        setTimeout(() => btn.innerHTML = originalText, 2000);
    }).catch(err => {
        notify('Không thể sao chép link: ' + err, 'error');
    });
}

function copyScriptLink(filename) {
    const url = getShowUrl(filename);
    navigator.clipboard.writeText(url).then(() => {
        notify('Đã sao chép link kịch bản!', 'success');
    }).catch(err => {
        notify('Không thể sao chép link: ' + err, 'error');
    });
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
                const isPrivate = script.status === 'private';
                const isLocal = script.status === 'local';

                item.onclick = (e) => {
                    if (e.target.closest('.btn')) return;
                    copyScriptLink(script.id);
                };

                item.innerHTML = `
                <h4>${isPrivate ? '<i class="fas fa-lock" title="Riêng tư"></i> ' : ''}${isLocal ? '<i class="fas fa-laptop" title="Lưu cục bộ"></i> ' : ''}${escapeHtml(script.title)}</h4>
                <div class="meta">
                    <span><i class="fas fa-user"></i> ${escapeHtml(script.author)}</span><br>
                    <span><i class="fas fa-fireworks"></i> ${escapeHtml(script.eventCount)} phát bắn</span>
                </div>
                <div class="script-actions">
                    <button class="btn primary small" onclick="editScript('${script.id}')" title="Sửa"><i class="fas fa-edit"></i></button>
                    <button class="btn secondary small" onclick="duplicateScript('${script.id}')" title="Nhân bản"><i class="fas fa-copy"></i></button>
                    <button class="btn secondary small" onclick="previewScript('${script.id}')" title="Xem thử"><i class="fas fa-play"></i></button>
                    ${(!isPrivate || isLocal) ? `<button class="btn danger small" onclick="deleteScript('${script.id}')"><i class="fas fa-trash"></i></button>` : ''}
                </div>
            `;
                list.appendChild(item);
            });
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
    document.getElementById('author').value = config.author || '';
    document.getElementById('loop').checked = config.loop !== false;
    syncLoopState();
    document.getElementById('filename').value = filename;

    state.events = [];
    state.nextId = 1;
    state.activeEventId = null;
    state.currentFilename = filename;
    state.status = config.status || 'public';
    state.showBackground = !!config.showBackground;
    state.background = config.background || null;

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
        // Đang chọn một phát bắn: chỉ bắn lặp lại phát đó
        config.loop = true;
        config.events = [{ ...config.events[index], burst: 1, delay: 0 }];
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
    } else if (e.data.type === 'firework-preview-ended' && previewMode === 'once' && !state.activeEventId) {
        previewMode = 'idle';
        const info = document.getElementById('mini-preview-info');
        if (info) info.innerText = 'Đã chạy xong';
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
    handleShellChange, changeBurst, toggleEventColor, addColorToEvent, addCustomColor, removeColorFromEvent,
    rememberSection, editScript, duplicateScript, deleteScript, previewScript, copyShareLink, copyScriptLink,
    openScriptsModal, exportConfig, previewConfig, saveConfig, toggleSidebar, toggleMoreMenu, showModal,
    resizeMiniStages, notify, confirmAction
});
window.shareSocial = (platform) => {
    const url = document.getElementById('share-url').innerText;
    if (!url) {
        notify('Vui lòng lưu kịch bản trước khi chia sẻ!', 'warning');
        return;
    }
    const text = "Xem kịch bản pháo hoa tuyệt đẹp của tôi!";
    let shareUrl = '';

    const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);

    switch (platform) {
        case 'messenger':
            if (isMobile) {
                shareUrl = `fb-messenger://share/?link=${encodeURIComponent(url)}`;
            } else {
                // Facebook Send Dialog
                shareUrl = `https://www.facebook.com/dialog/send?link=${encodeURIComponent(url)}&app_id=2177090129179921&redirect_uri=${encodeURIComponent(url)}`;
            }
            break;
        case 'zalo':
            // Sử dụng Zalo Share API chính thức hoặc link redirect
            shareUrl = `https://sp.zalo.me/share/base?url=${encodeURIComponent(url)}`;
            break;
        case 'tiktok':
            copyShareLink();
            notify("TikTok chưa hỗ trợ chia sẻ link trực tiếp. Đã sao chép link để bạn dán vào TikTok!", "info");
            return;
    }

    if (shareUrl) {
        const win = window.open(shareUrl, '_blank');
        if (!win) {
            notify('Vui lòng cho phép trình duyệt mở cửa sổ mới để chia sẻ.', 'warning');
        }
    }
};
window.addEventListener('resize', resizeMiniStages);

