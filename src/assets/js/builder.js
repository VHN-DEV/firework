import fscreen from './fscreen@1.0.1.js';
import { Stage, Ticker } from './Stage@0.1.4.js';
import MyMath from './MyMath.js';
import '../scss/builder.scss';
import backgroundImgUrl from '../img/background.png';

// Assign to window for global access
window.fscreen = fscreen;
window.Stage = Stage;
window.Ticker = Ticker;
window.MyMath = MyMath;

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
const INVISIBLE = '_INVISIBLE_';
const PI_2 = Math.PI * 2;
const GRAVITY = 0.9;

const SHELL_TYPES = [
    "Hoa cúc", "Văn bản", "Hình ảnh", "Liễu", "Trái tim", "Ngôi sao",
    "Kim cương", "Bông tuyết", "Bông sen", "Hành tinh",
    "Mặt cười", "Mặt mèo", "Vòng nhẫn", "Nổ chéo",
    "Cây cọ", "Ma", "Đuôi ngựa", "Nhấp nháy", "Nổ lách tách", "Tạm dừng"
];

const FRAME_TYPES = [
    { name: 'Vuông', value: 'square' },
    { name: 'Tròn', value: 'circle' },
    { name: 'Tam giác', value: 'triangle' },
    { name: 'Trái tim', value: 'heart' }
];

const imageParticleCache = new Map();

function normalizeAssetPath(path) {
    if (!path) return path;
    
    // Check if we are in a built environment (no src in path or on static host)
    const isStaticHost = window.location.hostname.includes('github.io') || 
                         window.location.hostname.includes('vercel.app') || 
                         window.location.hostname.includes('netlify.app');
    
    const isDist = isStaticHost || 
                   window.location.pathname.includes('/dist/') || 
                   window.location.pathname.includes('/build/');

    // Xử lý đường dẫn tương đối
    let cleanPath = path.replace(/^\.\//, '');

    if (isDist) {
        // Trong môi trường production/dist, chuyển 'src/assets/' thành 'assets/'
        if (cleanPath.startsWith('src/assets/')) {
            cleanPath = cleanPath.replace('src/assets/', 'assets/');
        }
        // Đảm bảo đường dẫn là tương đối từ gốc site
        return './' + cleanPath.replace(/^dist\//, '');
    } else {
        // Trong môi trường dev, đảm bảo có 'src/assets/'
        if (cleanPath.startsWith('assets/') && !cleanPath.startsWith('src/assets/')) {
            cleanPath = 'src/' + cleanPath;
        }
        return './' + cleanPath;
    }
}

function getProcessedImage(img, frame = '') {
    const size = 500;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (frame) {
        ctx.save();
        ctx.beginPath();
        if (frame === 'circle') {
            ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
        } else if (frame === 'square') {
            ctx.rect(0, 0, size, size);
        } else if (frame === 'triangle') {
            ctx.moveTo(size / 2, 0);
            ctx.lineTo(size, size);
            ctx.lineTo(0, size);
            ctx.closePath();
        } else if (frame === 'heart') {
            ctx.translate(size / 2, size / 2);
            ctx.beginPath();
            for (let t = 0; t <= Math.PI * 2; t += 0.01) {
                const x = 16 * Math.pow(Math.sin(t), 3);
                const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
                const scale = size / 35;
                if (t === 0) ctx.moveTo(x * scale, y * scale);
                else ctx.lineTo(x * scale, y * scale);
            }
            ctx.closePath();
            ctx.translate(-size / 2, -size / 2);
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
        ctx.arc(x, y, r, 0, Math.PI * 2);
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
        for (let t = 0; t <= Math.PI * 2; t += 0.1) {
            const hx = 16 * Math.pow(Math.sin(t), 3);
            const hy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
            const scale = size / 35;
            if (t === 0) ctx.moveTo(hx * scale, hy * scale);
            else ctx.lineTo(hx * scale, hy * scale);
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
        this.maxSize = size * 300;
        this.totalLife = 1500;
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
            const easeProgress = 1 - Math.pow(1 - progress, 3);
            const scale = (0.1 + easeProgress * 0.9) * b.maxSize;
            const opacity = 1 - Math.pow(progress, 2);
            ctx.save();
            ctx.globalAlpha = opacity;
            if (b.color && b.color !== 'invisible') {
                ctx.strokeStyle = b.color;
                ctx.lineWidth = Math.max(2, scale * 0.02);
                drawFramePath(ctx, b.x, b.y, scale, b.frame);
                ctx.stroke();
            }
            ctx.drawImage(b.img, b.x - scale / 2, b.y - scale / 2, scale, scale);
            ctx.restore();
        });
    }
}

window.preloadFireworkImage = (url, frame) => {
    if (!url) return;
    const normalizedUrl = normalizeAssetPath(url);
    const cacheKey = `${normalizedUrl}_${frame || ''}`;
    if (!imageParticleCache.has(cacheKey)) {
        const img = new Image();
        img.onload = () => {
            const processed = getProcessedImage(img, frame);
            imageParticleCache.set(cacheKey, processed);
        };
        img.onerror = (e) => {
            console.error('[Builder] Failed to load image:', normalizedUrl, e);
        };
        img.src = normalizedUrl;
    }
};

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
    document.getElementById('btn-add-event')?.addEventListener('click', addEvent);
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
        updateMiniPreviewBackground();
    });

    bgFile?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            state.background = event.target.result;
            if (bgPreview) bgPreview.src = state.background;
            updateMiniPreviewBackground();
        };
        reader.readAsDataURL(file);
    });

    document.getElementById('loop')?.addEventListener('change', (e) => {
        const isLoop = e.target.checked;
        if (isLoop) {
            startMiniLoop();
        } else {
            stopMiniLoop();
        }
        document.getElementById('btn-play-mini')?.classList.toggle('hide', isLoop);
    });

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
        <span>${message}</span>
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
            x: 0.5,
            y: 0.5,
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
            x: 0.5,
            y: 0.5,
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
            expanded: false
        };
    }

    state.events.push(newEvent);
    renderEventList();
}

function addColorToEvent(id, color) {
    const event = state.events.find(e => e.id === id);
    if (!event || !color) return;

    if (Array.isArray(event.color)) {
        event.color.push(color);
    } else {
        event.color = [event.color, color];
    }
    renderEventList();
}

function removeColorFromEvent(id, index) {
    const event = state.events.find(e => e.id === id);
    if (!event || !Array.isArray(event.color)) {
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
        <div class="color-tag" style="--tag-color: ${c}">
            <span class="dot"></span>
            <span class="label">${c}</span>
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
        document.getElementById('share-bar').classList.add('hide');

        // Reset background
        state.showBackground = false;
        state.background = null;
        document.getElementById('show-background').checked = false;
        document.getElementById('background-upload-container').classList.add('hide');
        document.getElementById('background-preview').src = backgroundImgUrl;
        updateMiniPreviewBackground();

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

function updateEvent(id, field, value) {
    const event = state.events.find(e => e.id === id);
    if (event) {
        if (['burst', 'x', 'y', 'delay', 'size', 'duration', 'starLife', 'starDensity', 'spreadSize', 'starCount', 'starLifeVariation', 'transitionTime', 'strobeFreq'].includes(field)) {
            let num = value === '' ? undefined : Number(value);
            if (num !== undefined) {
                // Clamping logic for security
                if (field === 'x' || field === 'y') num = Math.max(0, Math.min(1, num));
                if (field === 'size') num = Math.max(0, Math.min(10, num)); // Cho phép tối đa 10 cho chuyên gia
                if (field === 'delay') num = Math.max(0, Math.min(60000, num));
                if (field === 'burst') num = Math.max(1, num);
                if (field === 'starLifeVariation') num = Math.max(0, Math.min(1, num));
            }
            event[field] = num;
        } else if (['strobe', 'pistil', 'streamers', 'crossette', 'crackle', 'horsetail', 'comet', 'floral', 'ring'].includes(field)) {
            event[field] = value === true;
        } else {
            event[field] = value;
        }

        // Trigger preview if active
        if (state.miniPreviewEnabled && state.activeEventId === id) {
            launchEvent(event);
        }
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
        return;
    }

    container.innerHTML = '';
    state.events.forEach((event, index) => {
        const card = createEventCard(event, index);
        container.appendChild(card);
    });
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
                        <input type="text" value="${event.text || ''}" onchange="updateEvent(${event.id}, 'text', this.value)">
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
                        <input type="number" value="${event.duration || 1000}" onchange="updateEvent(${event.id}, 'duration', this.value)">
                    </div>
                ` : ''}
            </div>
        </div>

        <div class="event-grid-4">
            <div class="form-group">
                <label>X (0-1)</label>
                <input type="number" step="0.01" min="0" max="1" value="${event.x}" onchange="updateEvent(${event.id}, 'x', this.value)">
            </div>
            <div class="form-group">
                <label>Y (0-1)</label>
                <input type="number" step="0.01" min="0" max="1" value="${event.y}" onchange="updateEvent(${event.id}, 'y', this.value)">
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

        ${event.shell === 'Hình ảnh' ? `
            <div class="image-upload-section">
                <label>Ảnh nổ pháo hoa</label>
                <div class="image-upload-btn-large" onclick="document.getElementById('image-file-${event.id}').click()">
                    ${event.imageUrl ? `<img src="${event.imageUrl}" class="full-thumb">` : '<i class="fas fa-cloud-upload-alt"></i>'}
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
        const response = await fetch('static/api/upload_image.php', {
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

    setTimeout(() => {
        if (state.activeAdvancedId === null) {
            drawer.classList.add('hide');
        }
    }, 400);
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
                    <input type="color" value="${event.strobeColor && event.strobeColor.startsWith('#') ? event.strobeColor : '#ffffff'}" onchange="updateEvent(${event.id}, 'strobeColor', this.value)">
                    <input type="text" value="${event.strobeColor || ''}" placeholder="Hex/Tên" onchange="updateEvent(${event.id}, 'strobeColor', this.value)">
                </div>
            </div>
            <div class="form-group">
                <label>Màu nhụy (Pistil)</label>
                <div class="color-input-group tiny">
                    <input type="color" value="${event.pistilColor && event.pistilColor.startsWith('#') ? event.pistilColor : '#ffffff'}" onchange="updateEvent(${event.id}, 'pistilColor', this.value)">
                    <input type="text" value="${event.pistilColor || ''}" placeholder="Hex/Tên" onchange="updateEvent(${event.id}, 'pistilColor', this.value)">
                </div>
            </div>
            <div class="form-group">
                <label>Màu lấp lánh (Glitter)</label>
                <div class="color-input-group tiny">
                    <input type="color" value="${event.glitterColor && event.glitterColor.startsWith('#') ? event.glitterColor : '#ffffff'}" onchange="updateEvent(${event.id}, 'glitterColor', this.value)">
                    <input type="text" value="${event.glitterColor || ''}" placeholder="Hex/Tên" onchange="updateEvent(${event.id}, 'glitterColor', this.value)">
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
                    <input type="color" value="${event.secondColor && event.secondColor.startsWith('#') ? event.secondColor : '#ffffff'}" onchange="updateEvent(${event.id}, 'secondColor', this.value)">
                    <input type="text" value="${event.secondColor || ''}" placeholder="Hex/Tên" onchange="updateEvent(${event.id}, 'secondColor', this.value)">
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
            const response = await fetch('static/configs/configs_index.json');
            const staticScripts = await response.json();
            const staticIds = staticScripts.map(s => s.id);
            return [...new Set([...localIds, ...staticIds])].filter(id => id !== 'configs_index');
        } catch (e) {
            return localIds;
        }
    } else {
        try {
            const response = await fetch('static/api/manage_configs.php?action=list');
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

    if (!filename) {
        if (isPreview) {
            filename = 'preview_temp';
        } else {
            notify('Vui lòng nhập tên file!', 'warning');
            return;
        }
    }

    // Xử lý tên file duy nhất nếu không phải xem thử
    if (!isPreview) {
        const originalName = filename;
        filename = await getUniqueFilename(filename, state.currentFilename);
        if (filename !== originalName) {
            document.getElementById('filename').value = filename;
            notify(`Tên file đã tồn tại, tự động đổi thành: ${filename}`, 'info');
        }
    }

    const saveBtn = document.querySelector('.btn-save');
    if (saveBtn) saveBtn.disabled = true;

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
                const localScripts = JSON.parse(localStorage.getItem('my_firework_scripts') || '{}');
                localScripts[filename] = config;
                localStorage.setItem('my_firework_scripts', JSON.stringify(localScripts));

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

    return fetch('static/api/save_config.php', {
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
            if (saveBtn) saveBtn.disabled = false;
        });
}


function updateShareBar(filename) {
    const shareBar = document.getElementById('share-bar');
    const shareUrl = document.getElementById('share-url');
    const url = window.location.origin + window.location.pathname.replace('builder.html', 'index.html') + '?config=' + filename;

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
    const url = window.location.origin + window.location.pathname.replace('builder.html', 'index.html') + '?config=' + filename;
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
        ? fetch('static/configs/configs_index.json').then(r => r.json())
        : fetch('static/api/manage_configs.php?action=list').then(r => r.json());

    fetchPromise
        .then(data => {
            data = data.filter(s => s.id !== 'configs_index');
            list.innerHTML = '';

            // Add local scripts if in static env
            if (isStaticEnv) {
                const localScripts = JSON.parse(localStorage.getItem('my_firework_scripts') || '{}');
                Object.keys(localScripts).forEach(id => {
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
                <h4>${isPrivate ? '<i class="fas fa-lock" title="Riêng tư"></i> ' : ''}${isLocal ? '<i class="fas fa-laptop" title="Lưu cục bộ"></i> ' : ''}${script.title}</h4>
                <div class="meta">
                    <span><i class="fas fa-user"></i> ${script.author}</span><br>
                    <span><i class="fas fa-fireworks"></i> ${script.eventCount} phát bắn</span>
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
            list.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--error);">Không thể tải danh sách: ${err.message}</p>`;
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

    fetch(`static/configs/${filename}.json?t=${Date.now()}`)
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
    const url = window.location.origin + window.location.pathname.replace('builder.html', 'index.html') + '?config=' + filename;
    window.open(url, '_blank');
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

    fetch(`static/configs/${filename}.json?t=${Date.now()}`)
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

        fetch('static/api/manage_configs.php?action=delete', {
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
    updateMiniPreviewBackground();

    if (config.events && Array.isArray(config.events)) {
        config.events.forEach(ev => addEvent(ev));
    } else {
        addEvent();
    }
}

function previewConfig() {
    saveConfig(true).then(filename => {
        window.open(`index.html?config=${filename}`, '_blank');
    }).catch(err => {
        console.error('Preview failed:', err);
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
 * MINI PREVIEW ENGINE
 */
const miniTrailsStage = new Stage('mini-trails-canvas');
const miniMainStage = new Stage('mini-main-canvas');

const Star = {
    drawWidth: 3,
    airDrag: 0.98,
    airDragHeavy: 0.992,
    active: {},
    _pool: [],
    _new() { return {}; },
    add(x, y, color, angle, speed, life, speedOffX, speedOffY) {
        const instance = this._pool.pop() || this._new();
        let finalColor = Array.isArray(color) ? color[Math.floor(Math.random() * color.length)] : (color || COLOR.White);
        if (finalColor === 'Ngẫu nhiên') finalColor = Object.values(COLOR)[Math.floor(Math.random() * 6)];
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
        instance.sparkFreq = 0;
        instance.sparkSpeed = 1;
        instance.sparkTimer = 0;
        instance.sparkColor = finalColor;
        instance.sparkLife = 750;
        instance.sparkLifeVariation = 0.25;
        instance.strobe = false;
        if (!this.active[finalColor]) this.active[finalColor] = [];
        this.active[finalColor].push(instance);
        return instance;
    },
    returnInstance(instance) {
        if (instance.onDeath) {
            instance.onDeath(instance);
            instance.onDeath = null;
        }
        instance.secondColor = null;
        instance.transitionTime = 0;
        instance.colorChanged = false;
        instance.visible = true;
        this._pool.push(instance);
    },
    reset() {
        Object.keys(this.active).forEach(c => this.active[c] = []);
    }
};

const Spark = {
    drawWidth: 1,
    airDrag: 0.9,
    active: {},
    _pool: [],
    _new() { return {}; },
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
        if (!this.active[color]) this.active[color] = [];
        this.active[color].push(instance);
        return instance;
    },
    returnInstance(instance) { this._pool.push(instance); },
    reset() {
        Object.keys(this.active).forEach(c => this.active[c] = []);
    }
};

const BurstFlash = {
    active: [],
    _pool: [],
    _new() { return {}; },
    add(x, y, radius) {
        const instance = this._pool.pop() || this._new();
        instance.x = x; instance.y = y; instance.radius = radius;
        this.active.push(instance);
        return instance;
    },
    returnInstance(instance) { this._pool.push(instance); },
    reset() { this.active = []; }
};

function crackleEffect(star) {
    const count = 3 + Math.random() * 4;
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * PI_2;
        const speed = Math.random() * 2;
        Spark.add(star.x, star.y, COLOR.Gold, angle, speed, 300 + Math.random() * 200);
    }
}

function crossetteEffect(star) {
    for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * PI_2;
        const speed = 1.5;
        const s = Star.add(star.x, star.y, star.color, angle, speed, 600);
        s.sparkFreq = 40;
        s.sparkSpeed = 0.4;
        s.sparkLife = 400;
        s.sparkColor = COLOR.Gold;
    }
}

function floralEffect(star) {
    const count = 24;
    for (let i = 0; i < count; i++) {
        const angle = (i / count) * PI_2;
        const speed = Math.random() * 2 + 1;
        const s = Star.add(star.x, star.y, star.color, angle, speed, 800 + Math.random() * 400);
        s.sparkFreq = 80;
        s.sparkSpeed = 0.3;
        s.sparkLife = 500;
        s.sparkColor = COLOR.White;
    }
    BurstFlash.add(star.x, star.y, 40);
}

function createBurst(count, starFactory) {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * PI_2;
        const speedMult = Math.random() * 0.5 + 0.5;
        starFactory(angle, speedMult);
    }
}

function resolveColor(c) {
    if (!c) return '';
    if (c === 'Ngẫu nhiên') return 'Ngẫu nhiên';
    return COLOR[c] || c;
}

class Shell {
    constructor(options) {
        Object.assign(this, options);
        this.starLifeVariation = options.starLifeVariation !== undefined ? options.starLifeVariation : 0.125;
        this.color = options.color || COLOR.White;
        if (!this.starCount) {
            const density = options.starDensity || 1;
            const scaledSize = this.spreadSize / 54;
            this.starCount = Math.max(6, scaledSize * scaledSize * density);
        }
    }
    launch(x, y) {
        const targetX = x * miniMainStage.width;
        const targetY = y * miniMainStage.height;
        const startX = targetX;
        const startY = miniMainStage.height;

        const distance = startY - targetY;
        const launchLife = (this.horsetail ? 100 : 600) + Math.random() * 200;
        const speed = Math.max(distance * (this.horsetail ? 0.05 : 0.035), 3);

        let cometColor = this.color;
        if (Array.isArray(cometColor)) cometColor = cometColor[0];
        if (cometColor === 'Ngẫu nhiên') cometColor = Object.values(COLOR)[Math.floor(Math.random() * 6)];

        const comet = Star.add(startX, startY, cometColor, Math.PI, speed, launchLife);
        comet.heavy = true;
        comet.sparkFreq = 30;
        comet.sparkSpeed = 0.5;
        comet.sparkLife = 500;
        comet.sparkColor = cometColor;
        comet.onDeath = () => {
            this.burst(targetX, targetY);
        };
    }
    burst(x, y) {
        if (this.shell === 'Hình ảnh' && this.imageUrl) {
            const normalizedUrl = normalizeAssetPath(this.imageUrl);
            const cacheKey = `${normalizedUrl}_${this.frame || ''}`;
            const img = imageParticleCache.get(cacheKey);
            if (img) {
                const burstColor = Array.isArray(this.color) ? this.color[0] : (this.color || '#ffffff');
                ImageBurst.active.push(new ImageBurst(x, y, img, this.shellSize || 1, this.frame, burstColor));
                BurstFlash.add(x, y, this.spreadSize / 5);
                return;
            } else {
                window.preloadFireworkImage(this.imageUrl, this.frame);
            }
        }

        const speed = (this.spreadSize / 96) * 0.75;
        let sparkFreq, sparkSpeed, sparkLife;

        let onDeath = null;
        if (this.crackle) onDeath = crackleEffect;
        if (this.crossette) onDeath = crossetteEffect;
        if (this.floral) onDeath = floralEffect;

        if (this.glitter === 'willow') { sparkFreq = 100; sparkSpeed = 0.4; sparkLife = 1200; }
        else if (this.glitter === 'light') { sparkFreq = 400; sparkSpeed = 0.2; sparkLife = 300; }
        else if (this.glitter === 'streamer') { sparkFreq = 32; sparkSpeed = 1.05; sparkLife = 620; }
        else { sparkFreq = 250; sparkSpeed = 0.3; sparkLife = 600; }

        const starFactory = (angle, speedMult) => {
            const star = Star.add(x, y, this.color, angle, speedMult * speed, this.starLife + Math.random() * this.starLife * this.starLifeVariation, 0, 0);
            star.onDeath = onDeath;

            if (this.secondColor) {
                star.transitionTime = this.starLife * (Math.random() * 0.05 + 0.32);
                if (this.transitionTime) star.transitionTime = this.transitionTime;
                star.secondColor = this.secondColor;
            }

            if (this.glitter) {
                star.sparkFreq = sparkFreq;
                star.sparkSpeed = sparkSpeed;
                star.sparkLife = sparkLife;
                star.sparkColor = this.glitterColor || star.color;
                star.sparkTimer = Math.random() * star.sparkFreq;
            }
            if (this.strobe) {
                star.strobe = true;
                star.strobeFreq = this.strobeFreq || (40 + Math.random() * 40);
                if (this.strobeColor) star.secondColor = this.strobeColor;
            }
        };

        if (this.shapePoints) {
            this.shapePoints.forEach(p => {
                const star = Star.add(x, y, this.color, 0, 0, this.starLife + Math.random() * this.starLife * this.starLifeVariation);
                star.speedX = p.x * speed * 1.2;
                star.speedY = p.y * speed * 1.2;
                star.onDeath = onDeath;
                if (this.glitter) {
                    star.sparkFreq = sparkFreq;
                    star.sparkSpeed = sparkSpeed;
                    star.sparkLife = sparkLife;
                    star.sparkColor = this.glitterColor || star.color;
                    star.sparkTimer = Math.random() * star.sparkFreq;
                }
            });
        } else {
            createBurst(this.starCount, starFactory);
        }

        if (this.ring) {
            const ringCount = Math.floor(Math.max(10, this.starCount * 0.5));
            for (let i = 0; i < ringCount; i++) {
                const angle = (i / ringCount) * PI_2;
                starFactory(angle, 1.1);
            }
        }

        if (this.pistil) {
            const innerShell = new Shell({
                spreadSize: this.spreadSize * 0.5,
                starLife: this.starLife * 0.6,
                color: this.pistilColor || COLOR.Gold,
                glitter: 'light'
            });
            innerShell.burst(x, y);
        }

        if (this.streamers) {
            const innerShell = new Shell({
                spreadSize: this.spreadSize * 0.9,
                starLife: this.starLife * 0.8,
                starCount: Math.floor(Math.max(6, this.spreadSize / 45)),
                color: COLOR.White,
                glitter: 'streamer'
            });
            innerShell.burst(x, y);
        }

        BurstFlash.add(x, y, this.spreadSize / 5);
    }
}

function getMiniShellType(event, size) {
    const s = size || 1;
    const type = event.shell;
    const base = {
        shellSize: s,
        spreadSize: 300 + s * 100,
        starLife: 900 + s * 200,
        color: resolveColor(event.color),
        strobe: event.strobe,
        strobeColor: resolveColor(event.strobeColor),
        pistil: event.pistil,
        pistilColor: resolveColor(event.pistilColor),
        streamers: event.streamers,
        crossette: event.crossette,
        crackle: event.crackle,
        horsetail: event.horsetail,
        comet: event.comet,
        starDensity: event.starDensity || 1,
        starCount: event.starCount,
        starLifeVariation: event.starLifeVariation,
        glitter: event.glitter,
        glitterColor: resolveColor(event.glitterColor),
        secondColor: resolveColor(event.secondColor),
        transitionTime: event.transitionTime,
        floral: event.floral,
        ring: event.ring,
        strobeFreq: event.strobeFreq
    };

    if (event.starLife) base.starLife = event.starLife;
    if (event.spreadSize) base.spreadSize = event.spreadSize;

    switch (type) {
        case 'Liễu':
            base.glitter = 'willow';
            base.glitterColor = COLOR.Gold;
            base.starLife = 3000 + s * 500;
            break;
        case 'Trái tim':
            base.shapePoints = getHeartPoints(50);
            break;
        case 'Ngôi sao':
            base.shapePoints = getStarPoints(50);
            break;
        case 'Kim cương':
            base.shapePoints = getDiamondPoints(50);
            break;
        case 'Bông tuyết':
            base.shapePoints = getSnowflakePoints(50);
            break;
        case 'Mặt cười':
            base.shapePoints = getSmileyPoints(50);
            break;
        case 'Hình ảnh':
            base.shell = 'Hình ảnh';
            base.imageUrl = event.imageUrl;
            base.frame = event.frame;
            break;
        case 'Văn bản':
            if (event.text) base.shapePoints = getTextParticles(event.text, 50);
            break;
        default:
            // Hoa cúc hoặc mặc định
            base.glitter = 'light';
            break;
    }
    return base;
}

// Hình dạng đơn giản cho mini preview
function getHeartPoints(count) {
    const pts = [];
    for (let i = 0; i < count; i++) {
        const t = (i / count) * PI_2;
        pts.push({
            x: 16 * Math.pow(Math.sin(t), 3) / 16,
            y: -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 16
        });
    }
    return pts;
}
function getStarPoints(count) {
    const pts = [];
    for (let i = 0; i < count; i++) {
        const t = (i / count) * PI_2;
        const r = (i % 2 === 0) ? 1 : 0.5;
        pts.push({ x: Math.cos(t) * r, y: Math.sin(t) * r });
    }
    return pts;
}
function getDiamondPoints(count) {
    const pts = [];
    for (let i = 0; i < count; i++) {
        const t = (i / count) * PI_2;
        pts.push({ x: Math.pow(Math.cos(t), 3), y: Math.pow(Math.sin(t), 3) });
    }
    return pts;
}
function getSnowflakePoints(count) {
    const pts = [];
    for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * PI_2;
        for (let j = 0; j < 10; j++) {
            const r = j / 10;
            pts.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });
        }
    }
    return pts;
}
function getSmileyPoints(count) {
    const pts = [];
    for (let i = 0; i < count * 0.7; i++) {
        const t = (i / (count * 0.7)) * PI_2;
        pts.push({ x: Math.cos(t), y: Math.sin(t) });
    }
    pts.push({ x: -0.3, y: -0.3 }, { x: 0.3, y: -0.3 });
    for (let i = 0; i < 10; i++) {
        const t = Math.PI * (0.2 + 0.6 * (i / 10));
        pts.push({ x: Math.cos(t) * 0.5, y: Math.sin(t) * 0.5 });
    }
    return pts;
}

let miniPreviewLoop = null;
let miniBurstCounter = 0;

function updateGlobals(timeStep, lag) {
    Object.keys(Star.active).forEach(color => {
        const stars = Star.active[color];
        for (let i = stars.length - 1; i >= 0; i--) {
            const star = stars[i];
            star.life -= timeStep;
            if (star.life <= 0) {
                stars.splice(i, 1);
                Star.returnInstance(star);
            } else {
                star.prevX = star.x; star.prevY = star.y;
                star.x += star.speedX * lag; star.y += star.speedY * lag;
                star.speedX *= Star.airDrag; star.speedY *= Star.airDrag;
                star.speedY += (timeStep / 1000 * GRAVITY);

                // Color transition logic
                if (star.secondColor && !star.colorChanged && star.life < (star.transitionTime || star.fullLife * 0.4)) {
                    star.colorChanged = true;
                    stars.splice(i, 1);
                    const newColor = star.secondColor;
                    star.color = newColor;
                    if (!Star.active[newColor]) Star.active[newColor] = [];
                    Star.active[newColor].push(star);
                }

                if (star.strobe) {
                    star.visible = Math.floor(star.life / (star.strobeFreq || 50)) % 3 === 0;
                }

                if (star.sparkFreq) {
                    star.sparkTimer -= timeStep;
                    while (star.sparkTimer < 0) {
                        star.sparkTimer += star.sparkFreq;
                        Spark.add(star.x, star.y, star.sparkColor, Math.random() * PI_2, Math.random() * star.sparkSpeed, star.sparkLife);
                    }
                }
            }
        }
    });

    Object.keys(Spark.active).forEach(color => {
        const sparks = Spark.active[color];
        for (let i = sparks.length - 1; i >= 0; i--) {
            const spark = sparks[i];
            spark.life -= timeStep;
            if (spark.life <= 0) {
                sparks.splice(i, 1);
                Spark.returnInstance(spark);
            } else {
                spark.prevX = spark.x; spark.prevY = spark.y;
                spark.x += spark.speedX * lag; spark.y += spark.speedY * lag;
                spark.speedX *= Spark.airDrag; spark.speedY *= Spark.airDrag;
                spark.speedY += (timeStep / 1000 * GRAVITY);
            }
        }
    });

    renderMiniPreview();
}

let miniBgImage = null;
function updateMiniPreviewBackground() {
    const container = document.querySelector('.mini-preview-canvas-container');
    if (!container) return;
    if (state.showBackground) {
        const bg = state.background || backgroundImgUrl;
        container.style.backgroundImage = `url(${bg})`;
        container.style.backgroundSize = 'cover';
        container.style.backgroundPosition = 'center';
        
        if (!miniBgImage) miniBgImage = new Image();
        if (miniBgImage.src !== bg) miniBgImage.src = bg;
    } else {
        container.style.backgroundImage = 'none';
        miniBgImage = null;
    }
}

function renderMiniPreview() {
    const { dpr } = miniMainStage;
    const trailsCtx = miniTrailsStage.ctx;
    const mainCtx = miniMainStage.ctx;
    const width = miniMainStage.width;
    const height = miniMainStage.height;

    trailsCtx.scale(dpr, dpr);
    mainCtx.scale(dpr, dpr);

    if (state.showBackground) {
        // When background is enabled, use destination-out to fade trails while keeping the canvas transparent.
        // This allows the div's background-image to be visible through the firework trails.
        trailsCtx.globalCompositeOperation = 'destination-out';
        trailsCtx.fillStyle = 'rgba(0, 0, 0, 0.175)';
        trailsCtx.fillRect(0, 0, width, height);
        trailsCtx.globalCompositeOperation = 'source-over';
    } else {
        // Default: clear with semi-transparent black
        trailsCtx.globalCompositeOperation = 'source-over';
        trailsCtx.fillStyle = 'rgba(0, 0, 0, 0.175)';
        trailsCtx.fillRect(0, 0, width, height);
    }
    
    mainCtx.clearRect(0, 0, width, height);

    trailsCtx.globalCompositeOperation = 'lighten';
    trailsCtx.lineWidth = Star.drawWidth;
    Object.keys(Star.active).forEach(color => {
        const stars = Star.active[color];
        trailsCtx.strokeStyle = color;
        trailsCtx.beginPath();
        stars.forEach(star => {
            if (star.visible) {
                trailsCtx.moveTo(star.x, star.y);
                trailsCtx.lineTo(star.prevX, star.prevY);
            }
        });
        trailsCtx.stroke();
    });

    trailsCtx.lineWidth = Spark.drawWidth;
    Object.keys(Spark.active).forEach(color => {
        const sparks = Spark.active[color];
        trailsCtx.strokeStyle = color;
        trailsCtx.beginPath();
        sparks.forEach(spark => {
            trailsCtx.moveTo(spark.x, spark.y);
            trailsCtx.lineTo(spark.prevX, spark.prevY);
        });
        trailsCtx.stroke();
    });

    ImageBurst.drawAll(miniMainStage.ctx);

    trailsCtx.setTransform(1, 0, 0, 1, 0, 0);
    mainCtx.setTransform(1, 0, 0, 1, 0, 0);
}

function resizeMiniStages() {
    const container = document.querySelector('.mini-preview-canvas-container');
    if (!container) return;
    const w = container.clientWidth || 300;
    const h = container.clientHeight || 200;
    miniTrailsStage.resize(w, h);
    miniMainStage.resize(w, h);
}

let miniTickerAdded = false;

function updateMiniPreview(frameTime, lag) {
    if (!state.miniPreviewEnabled) return;
    const timeStep = frameTime;

    updateGlobals(timeStep, lag);
    ImageBurst.updateAll(timeStep);
}



function getNonCanvasHeight() {
    const el = document.getElementById('mini-preview');
    if (!el) return 0;
    const header = el.querySelector('.mini-preview-header');
    const info = el.querySelector('.mini-preview-info');
    return (header ? header.offsetHeight : 0) + (info ? info.offsetHeight : 0);
}

function toggleMiniPreview(force) {
    state.miniPreviewEnabled = force !== undefined ? force : !state.miniPreviewEnabled;
    const el = document.getElementById('mini-preview');
    const btn = document.getElementById('btn-toggle-mini-preview');
    if (state.miniPreviewEnabled) {
        el.classList.remove('hide');
        btn.classList.add('primary');
        btn.classList.remove('secondary');

        // Cập nhật tỉ lệ theo thiết bị hiện tại (Chỉ tính riêng phần Canvas)
        const deviceRatio = window.innerWidth / window.innerHeight;
        const currentW = el.offsetWidth;
        const nonCanvasH = getNonCanvasHeight();
        el.style.height = (currentW / deviceRatio + nonCanvasH) + 'px';

        resizeMiniStages();
        updateMiniPreviewBackground();
        if (!miniTickerAdded) {
            miniMainStage.addEventListener('ticker', updateMiniPreview);
            miniTickerAdded = true;
        }
        if (document.getElementById('loop').checked) {
            startMiniLoop();
        }
    } else {
        el.classList.add('hide');
        btn.classList.remove('primary');
        btn.classList.add('secondary');
        stopMiniLoop();
    }
}

function toggleFullscreenMiniPreview() {
    const el = document.getElementById('mini-preview');
    if (!fscreen.fullscreenElement) {
        fscreen.requestFullscreen(el);
    } else {
        fscreen.exitFullscreen();
    }
}

function resetMiniPreviewSize() {
    const el = document.getElementById('mini-preview');
    if (!el) return;
    const deviceRatio = window.innerWidth / window.innerHeight;
    const currentW = el.offsetWidth;
    const nonCanvasH = getNonCanvasHeight();
    el.style.height = (currentW / deviceRatio + nonCanvasH) + 'px';
    resizeMiniStages();
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

function startMiniLoop() {
    if (miniPreviewLoop) clearInterval(miniPreviewLoop);
    miniBurstCounter = 0;
    miniPreviewLoop = setInterval(() => {
        if (!state.miniPreviewEnabled) return;
        if (state.activeEventId) {
            const event = state.events.find(e => e.id === state.activeEventId);
            if (event) launchEvent(event);
        } else {
            const maxBurst = state.events.length > 0 ? Math.max(...state.events.map(e => Number(e.burst) || 1)) : 0;
            if (maxBurst === 0) return;
            miniBurstCounter++;
            if (miniBurstCounter > maxBurst) miniBurstCounter = 1;
            const events = state.events.filter(e => Number(e.burst || 1) === miniBurstCounter);
            events.forEach(e => setTimeout(() => launchEvent(e), Number(e.delay) || 0));
        }
    }, 2000);
}

function playMiniPreviewOnce() {
    if (miniPreviewLoop) clearInterval(miniPreviewLoop);
    if (state.events.length === 0) return;
    
    // Đặt lại counter và thông báo trạng thái
    const info = document.getElementById('mini-preview-info');
    if (info) info.innerText = 'Đang chạy kịch bản...';
    
    const maxBurst = Math.max(...state.events.map(e => Number(e.burst) || 1));
    for (let b = 1; b <= maxBurst; b++) {
        setTimeout(() => {
            if (!state.miniPreviewEnabled || document.getElementById('loop').checked) return;
            const events = state.events.filter(e => Number(e.burst || 1) === b);
            events.forEach(e => setTimeout(() => launchEvent(e), Number(e.delay) || 0));
            
            if (b === maxBurst) {
                setTimeout(() => {
                    if (info && !state.activeEventId) info.innerText = 'Đã chạy xong';
                }, 2000);
            }
        }, (b - 1) * 2000);
    }
}

function stopMiniLoop() {
    if (miniPreviewLoop) clearInterval(miniPreviewLoop);
    miniPreviewLoop = null;
    Star.reset();
    Spark.reset();
    BurstFlash.reset();
}

function launchEvent(event) {
    if (event.shell === 'Tạm dừng') return;
    const config = getMiniShellType(event, event.size);
    const shell = new Shell(config);
    // Fix logic: check for undefined to allow 0 value
    const x = event.x !== undefined ? event.x : 0.5;
    const y = event.y !== undefined ? event.y : 0.5;
    shell.launch(x, y);
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

const textCanvas = document.createElement('canvas');
const textCtx = textCanvas.getContext('2d', { willReadFrequently: true });

function getTextParticles(text, fontSize = 80) {
    textCanvas.width = 1000;
    textCanvas.height = 200;
    textCtx.clearRect(0, 0, textCanvas.width, textCanvas.height);
    textCtx.font = `bold ${fontSize}px Outfit, Inter, sans-serif`;
    textCtx.fillStyle = 'white';
    textCtx.textAlign = 'center';
    textCtx.textBaseline = 'middle';
    textCtx.fillText(text, textCanvas.width / 2, textCanvas.height / 2);

    const imgData = textCtx.getImageData(0, 0, textCanvas.width, textCanvas.height).data;
    const points = [];
    const step = 4;

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

    return points.map(p => ({
        x: (p.x - centerX) / maxDist,
        y: (p.y - centerY) / maxDist
    }));
}

function selectEvent(id) {
    if (state.activeEventId === id) {
        state.activeEventId = null;
    } else {
        state.activeEventId = id;
    }
    renderEventList();
    const info = document.getElementById('mini-preview-info');
    if (state.activeEventId) {
        const event = state.events.find(e => e.id === id);
        const idx = state.events.findIndex(e => e.id === id) + 1;
        info.innerText = 'Đang hiển thị phát bắn #' + idx;

        // Bắn ngay lập tức khi chọn (chỉ khi màn hình xem nhanh đang mở)
        if (event && state.miniPreviewEnabled) launchEvent(event);
    } else {
        info.innerText = 'Đang hiển thị toàn bộ';
    }
}

window.toggleMiniPreview = toggleMiniPreview;
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

