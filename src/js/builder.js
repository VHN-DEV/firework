import fscreen from './fscreen@1.0.1.js';
import { Stage, Ticker } from './Stage@0.1.4.js';
import MyMath from './MyMath.js';
import '../scss/builder.scss';

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
    miniPreviewEnabled: false,
    previewLoopId: null
};

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
    "Hoa cúc", "Văn bản", "Liễu", "Trái tim", "Ngôi sao", 
    "Kim cương", "Bông tuyết", "Bông sen", "Hành tinh",
    "Mặt cười", "Mặt mèo", "Vòng nhẫn", "Nổ chéo", 
    "Cây cọ", "Ma", "Đuôi ngựa", "Nhấp nháy", "Nổ lách tách", "Tạm dừng"
];

const COLORS = [
    { name: "Đỏ (Red)", value: "Red" },
    { name: "Xanh lá (Green)", value: "Green" },
    { name: "Xanh dương (Blue)", value: "Blue" },
    { name: "Tím (Purple)", value: "Purple" },
    { name: "Vàng (Gold)", value: "Gold" },
    { name: "Trắng (White)", value: "White" },
    { name: "Ngẫu nhiên", value: "Ngẫu nhiên" }
];

// Initialize UI
document.addEventListener('DOMContentLoaded', () => {
    // Buttons
    document.getElementById('btn-add-event').addEventListener('click', addEvent);
    document.getElementById('btn-save').addEventListener('click', saveConfig);
    document.getElementById('btn-preview').addEventListener('click', previewConfig);
    document.getElementById('btn-export').addEventListener('click', exportConfig);
    document.getElementById('btn-import').addEventListener('click', () => document.getElementById('import-file').click());
    document.getElementById('btn-my-scripts').addEventListener('click', openScriptsModal);
    document.getElementById('btn-copy-link').addEventListener('click', copyShareLink);
    document.getElementById('btn-toggle-mini-preview').addEventListener('click', () => toggleMiniPreview());
    
    // File Import
    document.getElementById('import-file').addEventListener('change', importConfig);

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
            starDensity: 1,
            starLife: 2500,
            spreadSize: 350,
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
            pistil: false,
            streamers: false,
            crossette: false,
            crackle: false,
            horsetail: false,
            comet: false,
            starDensity: 1,
            starLife: 2500,
            spreadSize: 350
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

function removeEvent(id) {
    state.events = state.events.filter(e => e.id !== id);
    renderEventList();
}

function updateEvent(id, field, value) {
    const event = state.events.find(e => e.id === id);
    if (event) {
        if (['burst', 'x', 'y', 'delay', 'size', 'duration', 'starLife', 'starDensity', 'spreadSize'].includes(field)) {
            event[field] = value === '' ? undefined : Number(value);
        } else if (['strobe', 'pistil', 'streamers', 'crossette', 'crackle', 'horsetail', 'comet'].includes(field)) {
            event[field] = value === true;
        } else {
            event[field] = value;
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
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'BUTTON' || e.target.closest('button') || e.target.closest('.color-tag')) {
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
                <button class="btn text small btn-remove" onclick="removeEvent(${event.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>

        <div class="event-grid-3">
            <div class="form-group">
                <label>Đợt (Burst)</label>
                <input type="number" value="${event.burst}" onchange="updateEvent(${event.id}, 'burst', this.value)">
            </div>
            <div class="form-group" style="grid-column: span 2;">
                <label>Loại pháo (Shell)</label>
                <select onchange="handleShellChange(${event.id}, this)">
                    ${shellOptions}
                </select>
            </div>
        </div>

        <div id="shell-specific-${event.id}">
            ${event.shell === 'Văn bản' ? `
                <div class="form-group">
                    <label>Nội dung chữ (Text)</label>
                    <input type="text" value="${event.text || ''}" onchange="updateEvent(${event.id}, 'text', this.value)">
                </div>
            ` : ''}
            ${event.shell === 'Tạm dừng' ? `
                <div class="form-group">
                    <label>Thời gian nghỉ (ms)</label>
                    <input type="number" value="${event.duration || 1000}" onchange="updateEvent(${event.id}, 'duration', this.value)">
                </div>
            ` : ''}
        </div>

        <div class="event-grid-4">
            <div class="form-group">
                <label>X (0-1)</label>
                <input type="number" step="0.1" min="0" max="1" value="${event.x}" onchange="updateEvent(${event.id}, 'x', this.value)">
            </div>
            <div class="form-group">
                <label>Y (0-1)</label>
                <input type="number" step="0.1" min="0" max="1" value="${event.y}" onchange="updateEvent(${event.id}, 'y', this.value)">
            </div>
            <div class="form-group">
                <label>Size</label>
                <input type="number" min="0" max="5" value="${event.size}" onchange="updateEvent(${event.id}, 'size', this.value)">
            </div>
            <div class="form-group">
                <label>Trễ (ms)</label>
                <input type="number" step="100" min="0" value="${event.delay}" onchange="updateEvent(${event.id}, 'delay', this.value)">
            </div>
        </div>

        <div class="form-group">
            <label>Màu sắc</label>
            <div class="color-tags" id="color-tags-${event.id}">
                ${renderColorTags(event)}
            </div>
            <div class="color-input-group compact">
                <select id="preset-color-${event.id}" onchange="if(this.value) { addColorToEvent(${event.id}, this.value); this.value=''; }">
                    <option value="">+ Mẫu...</option>
                    ${colorOptions}
                </select>
                <input type="color" id="picker-color-${event.id}" onchange="addColorToEvent(${event.id}, this.value)">
                <div class="input-with-btn">
                    <input type="text" id="custom-color-${event.id}" placeholder="Hex/Tên" onkeydown="if(event.key==='Enter') { addColorToEvent(${event.id}, this.value); this.value=''; }">
                    <button class="btn secondary small" onclick="const input=document.getElementById('custom-color-${event.id}'); addColorToEvent(${event.id}, input.value); input.value='';">Thêm</button>
                </div>
            </div>
        </div>

        <div class="advanced-toggle" onclick="toggleAdvanced(${event.id})">
            <i class="fas fa-chevron-down"></i> Tùy chỉnh nâng cao
        </div>

        <div id="advanced-${event.id}" class="advanced-settings hide">
            <div class="form-group checkbox">
                <input type="checkbox" id="strobe-${event.id}" ${event.strobe ? 'checked' : ''} onchange="updateEvent(${event.id}, 'strobe', this.checked)">
                <label for="strobe-${event.id}">Lấp lánh (Strobe)</label>
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
                <label for="streamers-${event.id}">Dải sáng (Streamers)</label>
            </div>
            <div class="form-group">
                <label>Mật độ hạt</label>
                <input type="number" step="0.5" value="${event.starDensity || ''}" placeholder="Mặc định: 1" onchange="updateEvent(${event.id}, 'starDensity', this.value)">
            </div>
            <div class="form-group">
                <label>Tuổi thọ sao (ms)</label>
                <input type="number" step="500" value="${event.starLife || ''}" placeholder="VD: 3000" onchange="updateEvent(${event.id}, 'starLife', this.value)">
            </div>
        </div>
    `;

    return div;
}

function handleShellChange(id, select) {
    const value = select.value;
    updateEvent(id, 'shell', value);
    renderEventList(); // Re-render to show/hide specific fields
}

function toggleAdvanced(id) {
    const el = document.getElementById(`advanced-${id}`);
    const toggle = el.previousElementSibling;
    const icon = toggle.querySelector('i');
    
    if (el.classList.contains('hide')) {
        el.classList.remove('hide');
        icon.className = 'fas fa-chevron-up';
    } else {
        el.classList.add('hide');
        icon.className = 'fas fa-chevron-down';
    }
}

function getFinalConfig() {
    return {
        title: document.getElementById('title').value || "Kịch bản mới",
        subtitle: document.getElementById('subtitle').value || "",
        author: document.getElementById('author').value || "Anonymous",
        loop: document.getElementById('loop').checked,
        status: state.status || "public", 
        events: state.events.map(e => {
            const { id, ...cleanEvent } = e;
            return cleanEvent;
        })
    };
}

// Backend Integration
function saveConfig(isPreview = false) {
    let filename = document.getElementById('filename').value;
    
    if (!filename) {
        if (isPreview) {
            filename = 'preview_temp';
        } else {
            notify('Vui lòng nhập tên file!', 'warning');
            return Promise.reject('No filename');
        }
    }

    const config = getFinalConfig();
    
    if (!isPreview) {
        showModal('save-modal');
        document.getElementById('save-status').innerText = 'Đang lưu kịch bản...';
        document.getElementById('save-spinner').classList.remove('hide');
        document.getElementById('save-actions').classList.add('hide');
    } else {
        notify('Đang chuẩn bị xem thử...', 'info');
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
            }
            return data.filename;
        } else {
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
        if (!isPreview) {
            hideModal('save-modal');
            notify('Đã xảy ra lỗi khi lưu kịch bản.', 'error');
        }
        console.error(error);
        throw error;
    });
}

function updateShareBar(filename) {
    const shareBar = document.getElementById('share-bar');
    const shareUrl = document.getElementById('share-url');
    const url = window.location.origin + window.location.pathname.replace('builder.html', 'index.html') + '?config=' + filename;
    
    shareUrl.innerText = url;
    shareBar.classList.remove('hide');
}

function copyShareLink() {
    const url = document.getElementById('share-url').innerText;
    navigator.clipboard.writeText(url).then(() => {
        const btn = document.getElementById('btn-copy-link');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-check"></i> Đã sao chép!';
        setTimeout(() => btn.innerHTML = originalText, 2000);
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

    fetch('api/manage_configs.php?action=list')
    .then(response => response.json())
    .then(data => {
        list.innerHTML = '';
        if (data.length === 0) {
            list.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted);">Bạn chưa có kịch bản nào.</p>';
            return;
        }

        data.forEach(script => {
            const item = document.createElement('div');
            item.className = 'script-item';
            const isPrivate = script.status === 'private';
            item.innerHTML = `
                <h4>${isPrivate ? '<i class="fas fa-lock" title="Riêng tư"></i> ' : ''}${script.title}</h4>
                <div class="meta">
                    <span><i class="fas fa-user"></i> ${script.author}</span><br>
                    <span><i class="fas fa-fireworks"></i> ${script.eventCount} phát bắn</span>
                </div>
                <div class="script-actions">
                    <button class="btn primary small" onclick="editScript('${script.id}')" title="Sửa"><i class="fas fa-edit"></i></button>
                    <button class="btn secondary small" onclick="duplicateScript('${script.id}')" title="Nhân bản"><i class="fas fa-copy"></i></button>
                    <button class="btn secondary small" onclick="copyScriptLink('${script.id}')" title="Sao chép link"><i class="fas fa-link"></i></button>
                    ${!isPrivate ? `<button class="btn danger small" onclick="deleteScript('${script.id}')"><i class="fas fa-trash"></i></button>` : ''}
                </div>
            `;
            list.appendChild(item);
        });
    });
}

function editScript(filename) {
    fetch(`configs/${filename}.json?t=${Date.now()}`)
    .then(response => response.json())
    .then(config => {
        loadConfigIntoState(config, filename);
        hideModal('scripts-modal');
        updateShareBar(filename);
    })
    .catch(err => notify('Không thể tải kịch bản: ' + err, 'error'));
}

function duplicateScript(filename) {
    fetch(`configs/${filename}.json?t=${Date.now()}`)
    .then(response => response.json())
    .then(config => {
        loadConfigIntoState(config, filename + '_copy');
        hideModal('scripts-modal');
        document.getElementById('share-bar').classList.add('hide'); // New copy, no link yet
        notify('Đã nhân bản kịch bản! Bạn có thể chỉnh sửa và lưu thành file mới.', 'success');
    })
    .catch(err => notify('Không thể nhân bản kịch bản: ' + err, 'error'));
}

function deleteScript(filename) {
    confirmAction(`Bạn có chắc chắn muốn xóa kịch bản "${filename}"?`, () => {
        fetch('api/manage_configs.php?action=delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                loadScriptsList();
                if (state.currentFilename === filename) {
                    document.getElementById('share-bar').classList.add('hide');
                }
                notify('Đã xóa kịch bản thành công!', 'success');
            } else {
                notify('Lỗi: ' + data.message, 'error');
            }
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

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const config = JSON.parse(e.target.result);
            loadConfigIntoState(config, file.name.replace('.json', ''));
            notify('Đã nhập kịch bản thành công!', 'success');
        } catch (err) {
            notify('Lỗi: File JSON không đúng định dạng.', 'error');
        }
    };
    reader.readAsText(file);
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

function toggleSidebar() {
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

function copyScriptLink(filename) {
    const url = window.location.origin + window.location.pathname.replace('builder.html', 'index.html') + '?config=' + filename;
    navigator.clipboard.writeText(url).then(() => {
        notify('Đã sao chép link kịch bản!', 'success');
    });
}

// Global exposure for onclick handlers
window.removeEvent = removeEvent;
window.updateEvent = updateEvent;
window.handleShellChange = handleShellChange;
window.toggleAdvanced = toggleAdvanced;
window.editScript = editScript;
window.duplicateScript = duplicateScript;
window.deleteScript = deleteScript;
window.addColorToEvent = addColorToEvent;
window.removeColorFromEvent = removeColorFromEvent;
window.copyScriptLink = copyScriptLink;

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
        instance.onDeath && instance.onDeath(instance);
        instance.onDeath = null;
        instance.secondColor = null;
        instance.transitionTime = 0;
        instance.colorChanged = false;
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

class Shell {
    constructor(options) {
        Object.assign(this, options);
        this.starLifeVariation = options.starLifeVariation || 0.125;
        this.color = options.color || COLOR.White;
        if (!this.starCount) {
            const density = options.starDensity || 1;
            const scaledSize = this.spreadSize / 54;
            this.starCount = Math.max(6, scaledSize * scaledSize * density);
        }
    }
    launch(x, y) {
        this.burst(x * miniMainStage.width, y * miniMainStage.height);
    }
    burst(x, y) {
        const speed = this.spreadSize / 96;
        let sparkFreq, sparkSpeed, sparkLife;
        if (this.glitter === 'light') { sparkFreq = 400; sparkSpeed = 0.3; sparkLife = 300; }
        else if (this.glitter === 'willow') { sparkFreq = 80; sparkSpeed = 0.48; sparkLife = 1500; }
        else { sparkFreq = 200; sparkSpeed = 0.44; sparkLife = 700; }

        const starFactory = (angle, speedMult) => {
            const star = Star.add(x, y, this.color, angle, speedMult * speed, this.starLife + Math.random() * this.starLife * this.starLifeVariation, 0, 0);
            if (this.glitter) {
                star.sparkFreq = sparkFreq; star.sparkSpeed = sparkSpeed; star.sparkLife = sparkLife;
                star.sparkColor = this.glitterColor || star.color;
                star.sparkTimer = Math.random() * star.sparkFreq;
            }
        };

        if (this.shapePoints) {
            this.shapePoints.forEach(p => {
                const star = Star.add(x, y, this.color, 0, 0, this.starLife + Math.random() * this.starLife * this.starLifeVariation);
                star.speedX = p.x * speed; star.speedY = p.y * speed;
            });
        } else {
            const count = this.starCount;
            for (let i = 0; i < count; i++) {
                const angle = Math.random() * PI_2;
                const speedMult = Math.random();
                starFactory(angle, speedMult);
            }
        }
        BurstFlash.add(x, y, this.spreadSize / 4);
    }
}

function getMiniShellType(name, size) {
    const s = size || 1;
    switch(name) {
        case 'Liễu': return { shellSize: s, spreadSize: 300 + s * 100, starDensity: 0.7, starLife: 3000 + s * 300, glitter: 'willow', glitterColor: COLOR.Gold, color: COLOR.Gold };
        case 'Trái tim': return { shellSize: s, spreadSize: 300 + s * 100, starLife: 1000 + s * 200, color: COLOR.Red };
        case 'Ngôi sao': return { shellSize: s, spreadSize: 350 + s * 100, starLife: 1200 + s * 200, color: COLOR.Gold };
        default: return { shellSize: s, spreadSize: 300 + s * 100, starLife: 900 + s * 200, color: COLOR.White };
    }
}

let miniPreviewLoop = null;
let miniBurstCounter = 0;

function updateMiniPreview(frameTime, lag) {
    if (!state.miniPreviewEnabled) return;
    const timeStep = frameTime;
    const speed = lag;

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
                star.x += star.speedX * speed; star.y += star.speedY * speed;
                star.speedX *= Star.airDrag; star.speedY *= Star.airDrag;
                star.speedY += (timeStep / 1000 * GRAVITY);
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
                spark.x += spark.speedX * speed; spark.y += spark.speedY * speed;
                spark.speedX *= Spark.airDrag; spark.speedY *= Spark.airDrag;
                spark.speedY += (timeStep / 1000 * GRAVITY);
            }
        }
    });

    renderMiniPreview();
}

function renderMiniPreview() {
    const trailsCtx = miniTrailsStage.ctx;
    const mainCtx = miniMainStage.ctx;
    const width = miniMainStage.width;
    const height = miniMainStage.height;

    trailsCtx.globalCompositeOperation = 'source-over';
    trailsCtx.fillStyle = 'rgba(0, 0, 0, 0.175)';
    trailsCtx.fillRect(0, 0, width, height);
    mainCtx.clearRect(0, 0, width, height);

    trailsCtx.globalCompositeOperation = 'lighten';
    trailsCtx.lineWidth = Star.drawWidth;
    Object.keys(Star.active).forEach(color => {
        const stars = Star.active[color];
        trailsCtx.strokeStyle = color;
        trailsCtx.beginPath();
        stars.forEach(star => {
            trailsCtx.moveTo(star.x, star.y);
            trailsCtx.lineTo(star.prevX, star.prevY);
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
}

function resizeMiniStages() {
    const container = document.querySelector('.mini-preview-canvas-container');
    const w = container.offsetWidth;
    const h = container.offsetHeight;
    miniTrailsStage.resize(w, h);
    miniMainStage.resize(w, h);
}

let miniTickerAdded = false;

function toggleMiniPreview(force) {
    state.miniPreviewEnabled = force !== undefined ? force : !state.miniPreviewEnabled;
    const el = document.getElementById('mini-preview');
    const btn = document.getElementById('btn-toggle-mini-preview');
    if (state.miniPreviewEnabled) {
        el.classList.remove('hide');
        btn.classList.add('primary');
        btn.classList.remove('secondary');
        resizeMiniStages();
        if (!miniTickerAdded) {
            miniMainStage.addEventListener('ticker', updateMiniPreview);
            miniTickerAdded = true;
        }
        startMiniLoop();
    } else {
        el.classList.add('hide');
        btn.classList.remove('primary');
        btn.classList.add('secondary');
        stopMiniLoop();
    }
}

function startMiniLoop() {
    if (miniPreviewLoop) clearInterval(miniPreviewLoop);
    miniPreviewLoop = setInterval(() => {
        if (!state.miniPreviewEnabled) return;
        if (state.activeEventId) {
            const event = state.events.find(e => e.id === state.activeEventId);
            if (event) launchEvent(event);
        } else {
            const maxBurst = state.events.length > 0 ? Math.max(...state.events.map(e => e.burst)) : 0;
            if (maxBurst === 0) return;
            miniBurstCounter++;
            if (miniBurstCounter > maxBurst) miniBurstCounter = 1;
            const events = state.events.filter(e => e.burst === miniBurstCounter);
            events.forEach(e => setTimeout(() => launchEvent(e), e.delay || 0));
        }
    }, 2000);
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
    const config = getMiniShellType(event.shell, event.size);
    if (event.color) {
        if (Array.isArray(event.color)) config.color = event.color.map(c => COLOR[c] || c);
        else config.color = COLOR[event.color] || event.color;
    }
    const shell = new Shell(config);
    shell.launch(event.x || 0.5, event.y || 0.5);
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
        const idx = state.events.findIndex(e => e.id === id) + 1;
        info.innerText = 'Đang hiển thị phát bắn #' + idx;
        if (!state.miniPreviewEnabled) toggleMiniPreview(true);
    } else {
        info.innerText = 'Đang hiển thị toàn bộ';
    }
}

window.toggleMiniPreview = toggleMiniPreview;
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
window.copyScriptLink = copyScriptLink;
window.openScriptsModal = openScriptsModal;
window.exportConfig = exportConfig;
window.previewConfig = previewConfig;
window.saveConfig = saveConfig;
window.toggleSidebar = toggleSidebar;
window.addEventListener('resize', resizeMiniStages);

