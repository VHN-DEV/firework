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
    activeAdvancedId: null,
    miniPreviewEnabled: false,
    previewLoopId: null,
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

const SHELL_TYPES = [
    "Hoa cúc", "Nổ nhiều lần", "Văn bản", "Hình ảnh", "Liễu", "Trái tim", "Ngôi sao",
    "Kim cương", "Bông tuyết", "Bông sen", "Hành tinh",
    "Mặt cười", "Mặt mèo", "Vòng nhẫn", "Nổ chéo",
    "Cây cọ", "Ma", "Đuôi ngựa", "Nhấp nháy", "Nổ lách tách", "Tạm dừng"
];

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
    // Bọc trong arrow function: nếu truyền thẳng addEvent, đối tượng MouseEvent sẽ bị coi là cấu hình phát bắn
    document.getElementById('btn-add-event')?.addEventListener('click', () => addEvent());
    document.getElementById('btn-save')?.addEventListener('click', saveConfig);
    document.getElementById('btn-preview')?.addEventListener('click', previewConfig);
    document.getElementById('btn-export')?.addEventListener('click', exportConfig);
    document.getElementById('btn-import')?.addEventListener('click', () => document.getElementById('import-file')?.click());
    document.getElementById('btn-my-scripts')?.addEventListener('click', openScriptsModal);
    document.getElementById('btn-copy-link')?.addEventListener('click', copyShareLink);
    document.getElementById('btn-toggle-mini-preview')?.addEventListener('click', () => toggleMiniPreview());
    document.getElementById('btn-help')?.addEventListener('click', () => showModal('help-modal'));

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

    // Mobile specific
    const btnToggleSettings = document.getElementById('btn-toggle-settings');
    const btnToggleSettingsHeader = document.getElementById('btn-toggle-settings-header');
    const btnFabAdd = document.getElementById('btn-fab-add');
    const overlay = document.getElementById('sidebar-overlay');

    if (btnToggleSettings) btnToggleSettings.addEventListener('click', toggleSidebar);
    if (btnToggleSettingsHeader) btnToggleSettingsHeader.addEventListener('click', toggleSidebar);
    if (btnFabAdd) btnFabAdd.addEventListener('click', () => addEvent());
    if (overlay) overlay.addEventListener('click', toggleSidebar);

    // Initial event if empty
    if (state.events.length === 0) {
        addEvent();
    }
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
}

function renderColorTags(event) {
    const colors = Array.isArray(event.color) ? event.color : [event.color];
    return colors.map((c, index) => `
        <div class="color-tag" style="--tag-color: ${escapeHtml(COLOR[c] || c)}">
            <span class="dot"></span>
            <span class="label">${escapeHtml(c)}</span>
            <i class="fas fa-times" onclick="removeColorFromEvent(${event.id}, ${index})"></i>
        </div>
    `).join('');
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

        notify('Đã tạo kịch bản mới!', 'success');
    });
}

function removeEvent(id) {
    state.events = state.events.filter(e => e.id !== id);
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

    renderEventList();
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

        // Hiện lại giá trị mặc định trong ô vừa bị xóa trống
        if (needsRender) renderEventList();

        // Cập nhật bản xem nhanh theo thay đổi
        refreshMiniPreview();
    }
}

function renderEventList() {
    const container = document.getElementById('event-list');

    if (state.events.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-sparkles"></i>
                <p>Chưa có phát bắn nào. Hãy nhấn "Thêm phát bắn" để bắt đầu.</p>
            </div>
        `;
        refreshMiniPreview();
        return;
    }

    container.innerHTML = '';
    state.events.forEach((event, index) => {
        const card = createEventCard(event, index);
        container.appendChild(card);
    });
    // Danh sách thay đổi (thêm/xóa/nhân bản/đổi màu/loại pháo...) thì cập nhật bản xem nhanh
    refreshMiniPreview();
}

function createEventCard(event, index) {
    const div = document.createElement('div');
    div.className = 'event-card' + (state.activeEventId === event.id ? ' active' : '');
    div.dataset.id = event.id;
    div.onclick = (e) => {
        // Tránh kích hoạt khi nhấn vào các input/button bên trong
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'BUTTON' || e.target.closest('button') || e.target.closest('.color-tag') || e.target.closest('.advanced-toggle')) {
            return;
        }
        selectEvent(event.id);
    };

    const shellOptions = SHELL_TYPES.map(type =>
        `<option value="${type}" ${event.shell === type ? 'selected' : ''}>${type}</option>`
    ).join('');

    const colorOptions = COLORS.map(color =>
        `<option value="${color.value}" ${event.color === color.value ? 'selected' : ''}>${color.name}</option>`
    ).join('');

    div.innerHTML = `
        <div class="event-card-header">
            <span class="event-id">#${index + 1}</span>
            <div class="event-controls">
                <button class="btn text small btn-advanced" onclick="toggleAdvanced(${event.id})" title="Tùy chỉnh nâng cao">
                    <i class="fas fa-magic"></i>
                </button>
                <button class="btn text small btn-duplicate" onclick="duplicateEvent(${event.id})" title="Nhân bản phát bắn">
                    <i class="fas fa-copy"></i>
                </button>
                <button class="btn text small btn-remove" onclick="removeEvent(${event.id})" title="Xóa phát bắn">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>

        <div class="event-grid-3">
            <div class="form-group">
                <label>Đợt (Burst)</label>
                <input type="number" value="${event.burst}" onchange="updateEvent(${event.id}, 'burst', this.value)">
            </div>
            <div class="form-group">
                <label>Loại pháo (Shell)</label>
                <select onchange="handleShellChange(${event.id}, this)">
                    ${shellOptions}
                </select>
            </div>
            <div id="shell-specific-${event.id}">
                ${event.shell === 'Văn bản' ? `
                    <div class="form-group">
                        <label>Nội dung chữ (Text)</label>
                        <input type="text" value="${escapeHtml(event.text)}" onchange="updateEvent(${event.id}, 'text', this.value)">
                    </div>
                ` : ''}
                ${event.shell === 'Hình ảnh' ? `
                    <div class="form-group">
                        <label>Khung hình (Frame)</label>
                        <select onchange="updateEvent(${event.id}, 'frame', this.value)">
                            ${FRAME_TYPES.map(f => `<option value="${f.value}" ${event.frame === f.value ? 'selected' : ''}>${f.name}</option>`).join('')}
                        </select>
                    </div>
                ` : ''}
                ${event.shell === 'Tạm dừng' ? `
                    <div class="form-group">
                        <label>Thời gian nghỉ (ms)</label>
                        <input type="number" value="${event.duration || 2000}" onchange="updateEvent(${event.id}, 'duration', this.value)">
                    </div>
                ` : ''}
            </div>
        </div>

        <div class="event-grid-4">
            <div class="form-group">
                <label>X (0-100)</label>
                <input type="number" step="0.1" min="0" max="100" value="${event.x}" onchange="updateEvent(${event.id}, 'x', this.value)">
            </div>
            <div class="form-group">
                <label>Y (0-100)</label>
                <input type="number" step="0.1" min="0" max="100" value="${event.y}" onchange="updateEvent(${event.id}, 'y', this.value)">
            </div>
            <div class="form-group">
                <label>Size</label>
                <input type="number" step="0.1" min="0" max="10" value="${event.size}" onchange="updateEvent(${event.id}, 'size', this.value)">
            </div>
            <div class="form-group">
                <label>Trễ (ms)</label>
                <input type="number" step="100" min="0" max="60000" value="${event.delay}" onchange="updateEvent(${event.id}, 'delay', this.value)">
            </div>
        </div>

        <div class="event-grid-physics">
            <div class="form-group">
                <label title="Góc bắn tính bằng độ. 90 = thẳng đứng, 0 = nằm ngang trái, 180 = nằm ngang phải">Góc bắn (0-180°)</label>
                <input type="number" step="1" min="0" max="180" value="${event.launchAngle ?? 90}" onchange="updateEvent(${event.id}, 'launchAngle', this.value)">
            </div>
            <div class="form-group">
                <label title="Tốc độ bay lên. 1 = bình thường, >1 = nhanh hơn">Tốc độ bay (x)</label>
                <input type="number" step="0.1" min="0.1" max="5" value="${event.ascentSpeed || 1}" onchange="updateEvent(${event.id}, 'ascentSpeed', this.value)">
            </div>
            <div class="form-group">
                <label title="Góc xoay hình nổ tính bằng độ (dành cho pháo có hình dạng)">Xoay hình (°)</label>
                <input type="number" step="15" min="-180" max="180" value="${event.rotation !== undefined ? event.rotation : ''}" placeholder="Ngẫu nhiên" onchange="updateEvent(${event.id}, 'rotation', this.value === '' ? undefined : this.value)">
            </div>
        </div>

        <div class="event-grid-physics">
            <div class="form-group">
                <label>Âm thanh phóng</label>
                <select onchange="updateEvent(${event.id}, 'liftSound', this.value)">
                    <option value="" ${!event.liftSound ? 'selected' : ''}>Mặc định</option>
                    <option value="liftWick" ${event.liftSound === 'liftWick' ? 'selected' : ''}>Phóng – Ngòi pháo thật</option>
                    <option value="liftDeep" ${event.liftSound === 'liftDeep' ? 'selected' : ''}>Phóng – Trầm</option>
                    <option value="liftSharp" ${event.liftSound === 'liftSharp' ? 'selected' : ''}>Phóng – Sắc</option>
                    <option value="liftSoft" ${event.liftSound === 'liftSoft' ? 'selected' : ''}>Phóng – Mềm</option>
                    <option value="burstSmall" ${event.liftSound === 'burstSmall' ? 'selected' : ''}>Phóng – Nhỏ</option>
                    <option value="crackleSmall" ${event.liftSound === 'crackleSmall' ? 'selected' : ''}>Phóng – Lách tách</option>
                    <option value="liftWhoosh" ${event.liftSound === 'liftWhoosh' ? 'selected' : ''}>Phóng – Vút mạnh (Mới)</option>
                    <option value="none" ${event.liftSound === 'none' ? 'selected' : ''}>Im lặng</option>
                </select>
            </div>
            <div class="form-group">
                <label>Âm thanh bay</label>
                <select onchange="updateEvent(${event.id}, 'whistleSound', this.value)">
                    <option value="" ${!event.whistleSound ? 'selected' : ''}>Không có</option>
                    <option value="whistle" ${event.whistleSound === 'whistle' ? 'selected' : ''}>🚀 Bay – Víuuuu classic</option>
                    <option value="whistleHigh" ${event.whistleSound === 'whistleHigh' ? 'selected' : ''}>🚀 Bay – Víuuuu cao</option>
                    <option value="whistleSwish" ${event.whistleSound === 'whistleSwish' ? 'selected' : ''}>🚀 Bay – Víuuuu rơi</option>
                    <option value="whistleRocket" ${event.whistleSound === 'whistleRocket' ? 'selected' : ''}>🚀 Bay – Tên lửa vút (Mới)</option>
                </select>
            </div>
            <div class="form-group">
                <label>Âm thanh nổ</label>
                <select onchange="updateEvent(${event.id}, 'burstSound', this.value)">
                    <option value="" ${!event.burstSound ? 'selected' : ''}>Mặc định (Mạnh)</option>
                    <option value="burstDeep" ${event.burstSound === 'burstDeep' ? 'selected' : ''}>Nổ – Trầm vũ</option>
                    <option value="burstSoft" ${event.burstSound === 'burstSoft' ? 'selected' : ''}>Nổ – Nhẹ nhàng</option>
                    <option value="burstSmall" ${event.burstSound === 'burstSmall' ? 'selected' : ''}>Nổ – Nhỏ</option>
                    <option value="burstWhoosh" ${event.burstSound === 'burstWhoosh' ? 'selected' : ''}>Nổ – Vút</option>
                    <option value="crackleBang" ${event.burstSound === 'crackleBang' ? 'selected' : ''}>Nổ – Tiếng bụp thật</option>
                    <option value="crackle" ${event.burstSound === 'crackle' ? 'selected' : ''}>Lách tách – To</option>
                    <option value="crackleHeavy" ${event.burstSound === 'crackleHeavy' ? 'selected' : ''}>Lách tách – Dồn dập</option>
                    <option value="crackleFirecracker" ${event.burstSound === 'crackleFirecracker' ? 'selected' : ''}>Lách tách – Pháo thật</option>
                    <option value="crackleSmall" ${event.burstSound === 'crackleSmall' ? 'selected' : ''}>Lách tách – Nhỏ</option>
                    <option value="burstOut" ${event.burstSound === 'burstOut' ? 'selected' : ''}>Nổ – Tỏa rộng (Mới)</option>
                    <option value="none" ${event.burstSound === 'none' ? 'selected' : ''}>Im lặng</option>
                </select>
            </div>
        </div>


        ${event.shell === 'Hình ảnh' ? `
            <div class="image-upload-section">
                <label>Ảnh nổ pháo hoa</label>
                <div class="image-upload-btn-large" onclick="document.getElementById('image-file-${event.id}').click()">
                    ${event.imageUrl ? `<img src="${escapeHtml(normalizeAssetPath(event.imageUrl))}" class="full-thumb">` : '<i class="fas fa-cloud-upload-alt"></i>'}
                    <span>${event.imageUrl ? 'Thay đổi hình ảnh' : 'Chọn hình ảnh từ thiết bị'}</span>
                </div>
                <input type="file" id="image-file-${event.id}" class="hide" accept="image/*" onchange="handleImageUpload(${event.id}, this)">
            </div>
        ` : `
            <div class="form-group color-group">
                <label>Màu sắc (Colors)</label>
                <div class="color-tags" id="color-tags-${event.id}">
                    ${renderColorTags(event)}
                </div>
                <div class="color-input-group compact">
                    <select id="preset-color-${event.id}" onchange="if(this.value) { addColorToEvent(${event.id}, this.value); this.value=''; }">
                        ${colorOptions}
                    </select>
                    <input type="color" id="picker-color-${event.id}" onchange="addColorToEvent(${event.id}, this.value)">
                    <div class="input-with-btn">
                        <input type="text" id="custom-color-${event.id}" placeholder="Hex/Tên" onkeydown="if(event.key==='Enter') { addColorToEvent(${event.id}, this.value); this.value=''; }">
                        <button class="btn secondary small" onclick="const input=document.getElementById('custom-color-${event.id}'); addColorToEvent(${event.id}, input.value); input.value='';">Thêm</button>
                    </div>
                </div>
            </div>
        `}
    `;

    return div;
}

function handleShellChange(id, select) {
    const value = select.value;
    updateEvent(id, 'shell', value);
    renderEventList(); // Re-render to show/hide specific fields
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
            renderEventList();
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
            renderEventList();
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

function toggleAdvanced(id) {
    if (state.activeAdvancedId === id) {
        closeAdvancedDrawer();
    } else {
        state.activeEventId = id; // Also select the event when opening advanced
        openAdvancedDrawer(id);
        renderEventList();
    }
}

function openAdvancedDrawer(id) {
    const event = state.events.find(e => e.id === id);
    if (!event) return;

    state.activeAdvancedId = id;

    // Render content
    renderAdvancedSettings(id);

    // Show drawer
    const drawer = document.getElementById('advanced-drawer');
    drawer.classList.add('open');
    drawer.classList.remove('hide');

    // Shrink list
    document.querySelector('.event-list-container').classList.add('has-drawer-open');

    // Highlight card
    document.querySelectorAll('.event-card').forEach(c => c.classList.remove('active'));
    const card = document.querySelector(`.event-card[data-id="${id}"]`);
    if (card) card.classList.add('active');
}

function closeAdvancedDrawer() {
    state.activeAdvancedId = null;
    state.activeEventId = null;
    const drawer = document.getElementById('advanced-drawer');
    drawer.classList.remove('open');
    document.querySelector('.event-list-container').classList.remove('has-drawer-open');
    document.querySelectorAll('.event-card').forEach(c => c.classList.remove('active'));
    // Bỏ chọn phát bắn: xem nhanh quay lại chạy cả kịch bản
    updateMiniInfo();
    sendPreview(true);

    setTimeout(() => {
        if (state.activeAdvancedId === null) {
            drawer.classList.add('hide');
        }
    }, 400);
}

// Giá trị cho <input type="color">: chỉ nhận dạng #rrggbb, tên màu (Gold...) được đổi sang mã tương ứng
function colorInputValue(color) {
    const hex = COLOR[color] || color;
    return typeof hex === 'string' && /^#[0-9a-f]{6}$/i.test(hex) ? hex : '#ffffff';
}

function renderAdvancedSettings(id) {
    const event = state.events.find(e => e.id === id);
    if (!event) return;

    const container = document.getElementById('drawer-content');
    container.innerHTML = `
        <div class="advanced-settings">
            <!-- Hạt và Tuổi thọ -->
            <div class="form-group">
                <label>Mật độ hạt</label>
                <input type="number" step="0.1" value="${event.starDensity || ''}" placeholder="Mặc định: 1" onchange="updateEvent(${event.id}, 'starDensity', this.value)">
            </div>
            <div class="form-group">
                <label>Số lượng hạt (starCount)</label>
                <input type="number" value="${event.starCount || ''}" placeholder="Tự động" onchange="updateEvent(${event.id}, 'starCount', this.value)">
            </div>
            <div class="form-group">
                <label>Tuổi thọ sao (ms)</label>
                <input type="number" step="100" value="${event.starLife || ''}" placeholder="VD: 2500" onchange="updateEvent(${event.id}, 'starLife', this.value)">
            </div>
            <div class="form-group">
                <label>Biến thiên tuổi thọ (0-1)</label>
                <input type="number" step="0.05" min="0" max="1" value="${event.starLifeVariation || ''}" placeholder="Mặc định: 0.125" onchange="updateEvent(${event.id}, 'starLifeVariation', this.value)">
            </div>

            <!-- Màu sắc nâng cao -->
            <div class="form-group">
                <label>Màu nhấp nháy (Strobe)</label>
                <div class="color-input-group tiny">
                    <input type="color" value="${colorInputValue(event.strobeColor)}" onchange="updateEvent(${event.id}, 'strobeColor', this.value)">
                    <input type="text" value="${escapeHtml(event.strobeColor)}" placeholder="Hex/Tên" onchange="updateEvent(${event.id}, 'strobeColor', this.value)">
                </div>
            </div>
            <div class="form-group">
                <label>Màu nhụy (Pistil)</label>
                <div class="color-input-group tiny">
                    <input type="color" value="${colorInputValue(event.pistilColor)}" onchange="updateEvent(${event.id}, 'pistilColor', this.value)">
                    <input type="text" value="${escapeHtml(event.pistilColor)}" placeholder="Hex/Tên" onchange="updateEvent(${event.id}, 'pistilColor', this.value)">
                </div>
            </div>
            <div class="form-group">
                <label>Màu lấp lánh (Glitter)</label>
                <div class="color-input-group tiny">
                    <input type="color" value="${colorInputValue(event.glitterColor)}" onchange="updateEvent(${event.id}, 'glitterColor', this.value)">
                    <input type="text" value="${escapeHtml(event.glitterColor)}" placeholder="Hex/Tên" onchange="updateEvent(${event.id}, 'glitterColor', this.value)">
                </div>
            </div>
            <div class="form-group">
                <label>Loại lấp lánh</label>
                <select onchange="updateEvent(${event.id}, 'glitter', this.value)">
                    ${GLITTER_TYPES.map(g => `<option value="${g.value}" ${event.glitter === g.value ? 'selected' : ''}>${g.name}</option>`).join('')}
                </select>
            </div>

            <!-- Chuyển đổi màu -->
            <div class="form-group">
                <label>Màu chuyển đổi (2nd)</label>
                <div class="color-input-group tiny">
                    <input type="color" value="${colorInputValue(event.secondColor)}" onchange="updateEvent(${event.id}, 'secondColor', this.value)">
                    <input type="text" value="${escapeHtml(event.secondColor)}" placeholder="Hex/Tên" onchange="updateEvent(${event.id}, 'secondColor', this.value)">
                </div>
            </div>
            <div class="form-group">
                <label>Thời điểm chuyển (ms)</label>
                <input type="number" step="100" value="${event.transitionTime || ''}" placeholder="Tự động" onchange="updateEvent(${event.id}, 'transitionTime', this.value)">
            </div>
            <div class="form-group">
                <label>Kích thước nổ (spread)</label>
                <input type="number" step="10" value="${event.spreadSize || ''}" placeholder="Mặc định: 350" onchange="updateEvent(${event.id}, 'spreadSize', this.value)">
            </div>
            <div class="form-group">
                <label>Tốc độ nháy (ms)</label>
                <input type="number" step="10" value="${event.strobeFreq || ''}" placeholder="Mặc định: 50" onchange="updateEvent(${event.id}, 'strobeFreq', this.value)">
            </div>
            <div></div> <!-- Spacer -->
        </div>

        <!-- Hiệu ứng Toggle -->
        <div class="advanced-checkbox-grid">
            <div class="form-group checkbox">
                <input type="checkbox" id="strobe-${event.id}" ${event.strobe ? 'checked' : ''} onchange="updateEvent(${event.id}, 'strobe', this.checked)">
                <label for="strobe-${event.id}">Nhấp nháy</label>
            </div>
            <div class="form-group checkbox">
                <input type="checkbox" id="crackle-${event.id}" ${event.crackle ? 'checked' : ''} onchange="updateEvent(${event.id}, 'crackle', this.checked)">
                <label for="crackle-${event.id}">Nổ lách tách</label>
            </div>
            <div class="form-group checkbox">
                <input type="checkbox" id="pistil-${event.id}" ${event.pistil ? 'checked' : ''} onchange="updateEvent(${event.id}, 'pistil', this.checked)">
                <label for="pistil-${event.id}">Nhụy ở giữa</label>
            </div>
            <div class="form-group checkbox">
                <input type="checkbox" id="streamers-${event.id}" ${event.streamers ? 'checked' : ''} onchange="updateEvent(${event.id}, 'streamers', this.checked)">
                <label for="streamers-${event.id}">Dải sáng</label>
            </div>
            <div class="form-group checkbox">
                <input type="checkbox" id="crossette-${event.id}" ${event.crossette ? 'checked' : ''} onchange="updateEvent(${event.id}, 'crossette', this.checked)">
                <label for="crossette-${event.id}">Nổ chéo</label>
            </div>
            <div class="form-group checkbox">
                <input type="checkbox" id="horsetail-${event.id}" ${event.horsetail ? 'checked' : ''} onchange="updateEvent(${event.id}, 'horsetail', this.checked)">
                <label for="horsetail-${event.id}">Đuôi ngựa</label>
            </div>
            <div class="form-group checkbox">
                <input type="checkbox" id="comet-${event.id}" ${event.comet ? 'checked' : ''} onchange="updateEvent(${event.id}, 'comet', this.checked)">
                <label for="comet-${event.id}">Đuôi phóng</label>
            </div>
            <div class="form-group checkbox">
                <input type="checkbox" id="floral-${event.id}" ${event.floral ? 'checked' : ''} onchange="updateEvent(${event.id}, 'floral', this.checked)">
                <label for="floral-${event.id}">Hoa nở (Floral)</label>
            </div>
            <div class="form-group checkbox">
                <input type="checkbox" id="ring-${event.id}" ${event.ring ? 'checked' : ''} onchange="updateEvent(${event.id}, 'ring', this.checked)">
                <label for="ring-${event.id}">Vòng nhẫn (Ring)</label>
            </div>
        </div>
    `;
}

window.closeAdvancedDrawer = closeAdvancedDrawer;

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
            const { id, ...cleanEvent } = e;
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
function toggleSidebar(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }

    // Ngăn chặn double click/tap quá nhanh gây bật-tắt tức thì
    const now = Date.now();
    if (now - lastToggleTime < 300) return;
    lastToggleTime = now;

    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    if (sidebar.classList.contains('open')) {
        sidebar.classList.remove('open');
        overlay.classList.remove('show');
    } else {
        sidebar.classList.add('open');
        overlay.classList.add('show');
    }
}


// Global exposure for onclick handlers
window.removeEvent = removeEvent;
window.duplicateEvent = duplicateEvent;
window.updateEvent = updateEvent;
window.handleShellChange = handleShellChange;
window.toggleAdvanced = toggleAdvanced;
window.editScript = editScript;
window.duplicateScript = duplicateScript;
window.deleteScript = deleteScript;
window.addColorToEvent = addColorToEvent;
window.removeColorFromEvent = removeColorFromEvent;
window.copyScriptLink = copyScriptLink;
window.previewScript = previewScript;
window.toggleFullscreenMiniPreview = toggleFullscreenMiniPreview;

/**
 * XEM NHANH
 * Chạy chính trình phát thật (index.html?preview=1) trong iframe, builder gửi kịch bản sang qua postMessage.
 * Nhờ vậy những gì thấy khi soạn giống hệt khi trình diễn: vật lý, hình dạng, ảnh, nền, cách xử lý riêng cho điện thoại.
 */

// Kích thước màn hình được giả lập. Trình phát xử lý điện thoại khác máy tính (thu hẹp vùng bắn, pháo nhỏ hơn).
const PREVIEW_DEVICES = {
    desktop: () => ({ width: Math.max(1024, window.innerWidth), height: Math.max(600, window.innerHeight) }),
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
    const container = document.querySelector('.mini-preview-canvas-container');
    const stage = document.getElementById('mini-preview-stage');
    const frame = getPreviewFrame();
    if (!container || !stage || !frame) return;
    const { width, height } = PREVIEW_DEVICES[previewDevice]();
    const scale = Math.min(container.clientWidth / width, container.clientHeight / height) || 0.01;
    frame.style.width = width + 'px';
    frame.style.height = height + 'px';
    frame.style.transform = `scale(${scale})`;
    stage.style.width = width * scale + 'px';
    stage.style.height = height * scale + 'px';
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

function getNonCanvasHeight() {
    const el = document.getElementById('mini-preview');
    if (!el) return 0;
    const header = el.querySelector('.mini-preview-header');
    const info = el.querySelector('.mini-preview-info');
    return (header ? header.offsetHeight : 0) + (info ? info.offsetHeight : 0);
}

// Đặt kích thước khung xem nhanh theo tỉ lệ màn hình đang giả lập (không cao quá 80% cửa sổ)
function fitMiniPreviewToDevice() {
    const el = document.getElementById('mini-preview');
    if (!el) return;
    const { width, height } = PREVIEW_DEVICES[previewDevice]();
    const nonCanvasH = getNonCanvasHeight();
    let w = el.offsetWidth;
    let canvasH = w * height / width;
    const maxCanvasH = window.innerHeight * 0.8 - nonCanvasH;
    if (canvasH > maxCanvasH) {
        canvasH = maxCanvasH;
        w = canvasH * width / height;
    }
    el.style.width = w + 'px';
    el.style.height = canvasH + nonCanvasH + 'px';
    resizeMiniStages();
}

function toggleMiniPreview(force) {
    state.miniPreviewEnabled = force !== undefined ? force : !state.miniPreviewEnabled;
    const el = document.getElementById('mini-preview');
    const btn = document.getElementById('btn-toggle-mini-preview');
    if (state.miniPreviewEnabled) {
        el.classList.remove('hide');
        btn.classList.add('primary');
        btn.classList.remove('secondary');

        previewMode = document.getElementById('loop').checked ? 'loop' : 'idle';
        fitMiniPreviewToDevice();
        updateMiniRulers();
        updateMiniInfo();
        loadPreviewFrame();
    } else {
        el.classList.add('hide');
        btn.classList.remove('primary');
        btn.classList.add('secondary');
        // Dừng hẳn trình phát để không tốn CPU khi đóng xem nhanh
        previewReady = false;
        getPreviewFrame().src = 'about:blank';
    }
}

function togglePreviewDevice() {
    previewDevice = previewDevice === 'desktop' ? 'mobile' : 'desktop';
    const isMobile = previewDevice === 'mobile';
    const btn = document.getElementById('btn-device-mini');
    if (btn) {
        btn.innerHTML = `<i class="fas fa-${isMobile ? 'mobile-alt' : 'desktop'}"></i>`;
        btn.title = isMobile
            ? 'Đang xem như trên điện thoại - bấm để xem như trên máy tính'
            : 'Đang xem như trên máy tính - bấm để xem như trên điện thoại';
    }
    // Bỏ chiều rộng đã kéo để khung co giãn lại theo tỉ lệ mới
    const el = document.getElementById('mini-preview');
    if (el) el.style.width = '';
    fitMiniPreviewToDevice();
    // Trình phát xác định máy tính/điện thoại lúc tải trang nên phải tải lại
    if (state.miniPreviewEnabled) loadPreviewFrame();
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

function resetMiniPreviewSize() {
    fitMiniPreviewToDevice();
    notify('Đã khôi phục tỉ lệ màn hình', 'info');
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

/**
 * RESIZE LOGIC FOR MINI PREVIEW
 */
let isResizingMini = false;
let resizeType = 'both'; // 'v', 'h', 'both'
let startX, startY, startW, startH;

function initMiniResize() {
    const handleV = document.getElementById('mini-preview-resize-v');
    const handleH = document.getElementById('mini-preview-resize-h');
    const handleBoth = document.getElementById('mini-preview-resize-both');
    const container = document.getElementById('mini-preview');

    const onDown = (e, type) => {
        isResizingMini = true;
        resizeType = type;
        startX = e.clientX;
        startY = e.clientY;
        startW = container.offsetWidth;
        startH = container.offsetHeight;

        if (e.target.setPointerCapture) {
            e.target.setPointerCapture(e.pointerId);
        }

        e.preventDefault();
        e.stopPropagation();
    };

    handleV.onpointerdown = (e) => onDown(e, 'v');
    handleH.onpointerdown = (e) => onDown(e, 'h');
    handleBoth.onpointerdown = (e) => onDown(e, 'both');

    const onMove = (e) => {
        if (!isResizingMini) return;

        const nonCanvasH = getNonCanvasHeight();
        const deviceRatio = window.innerWidth / window.innerHeight;
        let newW = startW;
        let newH = startH;

        const dx = startX - e.clientX;
        const dy = startY - e.clientY;

        if (resizeType === 'v') {
            newH = Math.max(150, startH + dy);
        } else if (resizeType === 'h') {
            newW = Math.max(200, startW + dx);
        } else {
            // Corner resize: maintain CURRENT aspect ratio
            const scaleW = (startX - e.clientX + startW) / startW;
            const scaleH = (startY - e.clientY + startH) / startH;
            const scale = Math.max(scaleW, scaleH);

            newW = Math.max(200, startW * scale);
            newH = Math.max(150, startH * scale);
        }

        // Check against viewport limits
        if (newW > window.innerWidth * 0.95) {
            newW = window.innerWidth * 0.95;
            if (resizeType === 'both') newH = (newW * startH) / startW;
        }
        if (newH > window.innerHeight * 0.8) {
            newH = window.innerHeight * 0.8;
            if (resizeType === 'both') newW = (newH * startW) / startH;
        }

        container.style.width = newW + 'px';
        container.style.height = newH + 'px';
        resizeMiniStages();
    };

    const onUp = (e) => {
        if (!isResizingMini) return;
        isResizingMini = false;
        if (e.target.releasePointerCapture) {
            e.target.releasePointerCapture(e.pointerId);
        }
    };

    [handleV, handleH, handleBoth].forEach(h => {
        h.onpointermove = onMove;
        h.onpointerup = onUp;
    });
}

/**
 * MOVE LOGIC FOR MINI PREVIEW
 */
let isMovingMini = false;
let moveStartX, moveStartY, moveStartBottom, moveStartRight;

function initMiniMove() {
    const header = document.querySelector('.mini-preview-header');
    const container = document.getElementById('mini-preview');

    header.onpointerdown = (e) => {
        if (e.target.closest('button')) return;
        isMovingMini = true;
        moveStartX = e.clientX;
        moveStartY = e.clientY;

        const style = window.getComputedStyle(container);
        moveStartBottom = parseInt(style.bottom) || 0;
        moveStartRight = parseInt(style.right) || 0;

        header.setPointerCapture(e.pointerId);
        e.preventDefault();
    };

    header.onpointermove = (e) => {
        if (!isMovingMini) return;

        const dx = moveStartX - e.clientX;
        const dy = moveStartY - e.clientY;

        let nextRight = moveStartRight + dx;
        let nextBottom = moveStartBottom + dy;

        // Keep inside viewport
        const rect = container.getBoundingClientRect();
        if (nextRight < 0) nextRight = 0;
        if (nextBottom < 0) nextBottom = 0;
        if (nextRight + rect.width > window.innerWidth) nextRight = window.innerWidth - rect.width;
        if (nextBottom + rect.height > window.innerHeight) nextBottom = window.innerHeight - rect.height;

        container.style.right = nextRight + 'px';
        container.style.bottom = nextBottom + 'px';
    };

    header.onpointerup = (e) => {
        isMovingMini = false;
        if (header.releasePointerCapture) {
            header.releasePointerCapture(e.pointerId);
        }
    };
}

document.addEventListener('DOMContentLoaded', () => {
    initMiniResize();
    initMiniMove();
});

function selectEvent(id) {
    state.activeEventId = state.activeEventId === id ? null : id;
    renderEventList();
    updateMiniInfo();
    // Bắn ngay phát vừa chọn, hoặc chạy lại cả kịch bản khi bỏ chọn
    sendPreview(true);
}

window.toggleMiniPreview = toggleMiniPreview;
window.togglePreviewDevice = togglePreviewDevice;
window.toggleFullscreenMiniPreview = toggleFullscreenMiniPreview;
window.resetMiniPreviewSize = resetMiniPreviewSize;
window.playMiniPreviewOnce = playMiniPreviewOnce;
window.createNewScript = createNewScript;
window.selectEvent = selectEvent;
window.removeEvent = removeEvent;
window.updateEvent = updateEvent;
window.handleShellChange = handleShellChange;
window.toggleAdvanced = toggleAdvanced;
window.editScript = editScript;
window.duplicateScript = duplicateScript;
window.deleteScript = deleteScript;
window.addColorToEvent = addColorToEvent;
window.removeColorFromEvent = removeColorFromEvent;
window.copyShareLink = copyShareLink;
window.copyScriptLink = copyScriptLink;
window.openScriptsModal = openScriptsModal;
window.exportConfig = exportConfig;
window.previewConfig = previewConfig;
window.saveConfig = saveConfig;
window.toggleSidebar = toggleSidebar;
window.resizeMiniStages = resizeMiniStages;
window.notify = notify;
window.confirmAction = confirmAction;
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

