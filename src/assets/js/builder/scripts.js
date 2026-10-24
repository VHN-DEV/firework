/*!
 * Hanabi – builder (danh sách kịch bản)
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Danh sách kịch bản đã lưu: nhân bản, xem, sửa, xóa, xuất, nhập.

import { getOwnerKeys, removeOwnerKey } from '../gift-tracking.js';
import { isStaticEnv, state } from './state.js';
import { confirmAction, escapeHtml, hideLoading, hideModal, notify, showLoading, showModal, showUrlFor } from './util.js';
import { updateScriptNameLabel } from './timeline.js';
import { getFinalConfig, getUniqueFilename, loadConfigIntoState } from './config.js';
import { markSaved } from './history.js';
import { showGiftBadges } from './gift-watch.js';
import { updateShareBar } from './share.js';

// My Scripts Management
export function openScriptsModal() {
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
            data = data.filter(s => s.id !== 'configs_index' && !s.id.startsWith('preview_temp'));
            const ownerKeys = getOwnerKeys();
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

            // Ba nhóm: mẫu có sẵn (kịch bản "riêng tư" của trang), của tôi (trình duyệt này tạo), do máy khác tạo (máy chủ
            // PHP lưu chung): khách mở "Của tôi" không thấy lẫn mẫu, kịch bản của người khác
            const samples = data.filter(s => s.status === 'private');
            const mine = data.filter(s => s.status !== 'private' && (s.status === 'local' || ownerKeys[s.id] || !s.locked));
            const others = data.filter(s => s.status !== 'private' && s.status !== 'local' && !ownerKeys[s.id] && s.locked);
            renderScriptGroups(list, { mine, samples, others });
            showGiftBadges();
        })
        .catch(err => {
            list.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--error);">Không thể tải danh sách: ${escapeHtml(err.message)}</p>`;
        });
}

// Thẻ một kịch bản. kind: 'sample' (dùng mẫu, xem), 'mine' (nhân bản, xem; xóa ở góc ảnh), 'other' (xem, nhân bản)
function scriptCard(script, kind) {
    const item = document.createElement('div');
    item.className = `script-item script-item--${kind}`;
    item.dataset.id = script.id;
    item.tabIndex = 0;
    item.setAttribute('role', 'button');
    const id = escapeHtml(script.id);
    // Bấm vào thẻ: mở để sửa; mẫu, kịch bản máy khác tạo thì mở bản sao (lưu thành bản mới của mình)
    const open = kind === 'mine' ? 'Mở để sửa' : kind === 'sample' ? 'Dùng mẫu này' : 'Mở bản sao';
    item.setAttribute('aria-label', `${open}: ${script.title}`);
    item.onclick = e => {
        if (e.target.closest('.btn')) return;
        if (kind === 'mine') editScript(script.id);
        else duplicateScript(script.id);
    };
    item.onkeydown = e => {
        if (e.key === 'Enter' && e.target === item) item.click();
    };
    const local = script.status === 'local';
    const actions = {
        sample: `<button class="btn primary small" onclick="duplicateScript('${id}')"><i class="fas fa-wand-magic-sparkles"></i> Dùng mẫu này</button>
            <button class="btn secondary small" onclick="previewScript('${id}')"><i class="fas fa-play"></i> Xem</button>`,
        mine: `<button class="btn secondary small" onclick="duplicateScript('${id}')"><i class="fas fa-copy"></i> Nhân bản</button>
            <button class="btn secondary small" onclick="previewScript('${id}')"><i class="fas fa-play"></i> Xem</button>`,
        other: `<button class="btn secondary small" onclick="previewScript('${id}')"><i class="fas fa-play"></i> Xem</button>
            <button class="btn secondary small" onclick="duplicateScript('${id}')" title="Sửa rồi lưu sẽ thành bản mới của bạn"><i class="fas fa-copy"></i> Nhân bản</button>`
    }[kind];
    const remove = kind === 'mine'
        ? `<button class="btn script-delete" onclick="deleteScript('${id}')" title="Xóa kịch bản" aria-label="Xóa kịch bản"><i class="fas fa-trash"></i></button>`
        : '';
    // Ảnh xem trước khi chia sẻ (configs/<tên>.jpg, có khi lưu trên máy chủ); không có ảnh thì nền chuyển màu. Rê chuột vào
    // thẻ thì ảnh ghi việc sẽ làm khi bấm
    item.innerHTML = `
        <div class="script-thumb" data-open="${open}">${local ? '' : `<img src="configs/${encodeURIComponent(script.id)}.jpg" alt="" loading="lazy" onerror="this.remove()">`}<i class="fas fa-wand-magic-sparkles"></i>${remove}</div>
        <h4 title="${escapeHtml(script.title)}">${escapeHtml(script.title)}</h4>
        <div class="meta">
            ${script.author && script.author !== 'Unknown' ? `<span><i class="fas fa-user"></i> ${escapeHtml(script.author)}</span>` : ''}
            <span><i class="fas fa-fireworks"></i> ${escapeHtml(script.eventCount)} phát bắn</span>
            <span class="script-badges">${local ? '<span class="gift-badge" title="Chỉ lưu trên trình duyệt này"><i class="fas fa-laptop"></i>Trên máy này</span>' : ''}</span>
        </div>
        <div class="script-actions">${actions}</div>`;
    return item;
}

function renderScriptGroups(list, { mine, samples, others }) {
    const grid = (items, kind) => {
        const box = document.createElement('div');
        box.className = 'scripts-grid';
        items.forEach(s => box.appendChild(scriptCard(s, kind)));
        return box;
    };
    list.innerHTML = `
        <div class="scripts-tabs" role="tablist" aria-label="Nhóm kịch bản">
            <button type="button" role="tab" data-tab="mine"><i class="fas fa-user"></i> Của tôi <small>${mine.length}</small></button>
            <button type="button" role="tab" data-tab="samples"><i class="fas fa-star"></i> Mẫu có sẵn <small>${samples.length}</small></button>
        </div>
        <div class="scripts-tab" data-panel="mine"></div>
        <div class="scripts-tab" data-panel="samples"></div>`;
    const minePanel = list.querySelector('[data-panel="mine"]');
    if (mine.length) {
        minePanel.appendChild(grid(mine, 'mine'));
    } else {
        minePanel.innerHTML = `
            <div class="scripts-empty">
                <i class="fas fa-wand-magic-sparkles"></i>
                <strong>Bạn chưa lưu kịch bản nào</strong>
                <p>Bấm <b>Mới</b> để tạo nhanh theo dịp, hoặc chọn một mẫu có sẵn rồi chỉnh lại cho người nhận của bạn.</p>
                <button type="button" class="btn primary small" data-go="samples"><i class="fas fa-star"></i> Xem mẫu có sẵn</button>
            </div>`;
    }
    if (others.length) {
        const more = document.createElement('details');
        more.className = 'scripts-others';
        more.innerHTML = `<summary><i class="fas fa-user-lock"></i> Do máy khác tạo (${others.length}) <small>chỉ máy đã tạo mới sửa, xóa được</small></summary>`;
        more.appendChild(grid(others, 'other'));
        minePanel.appendChild(more);
    }
    list.querySelector('[data-panel="samples"]').appendChild(grid(samples, 'sample'));

    const show = tab => {
        list.querySelectorAll('[role="tab"]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
        list.querySelectorAll('[data-panel]').forEach(p => { p.hidden = p.dataset.panel !== tab; });
    };
    list.querySelector('.scripts-tabs').addEventListener('click', e => {
        const b = e.target.closest('[data-tab]');
        if (b) show(b.dataset.tab);
    });
    list.querySelector('[data-go]')?.addEventListener('click', () => show('samples'));
    // Chưa có kịch bản riêng thì mở thẳng phần mẫu
    show(mine.length || !samples.length ? 'mine' : 'samples');
}

export async function duplicateScript(filename) {
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

export function previewScript(filename) {
    // Mở tab ngay lúc bấm (đợi nén link xong mới mở thì trình duyệt chặn popup)
    const tab = window.open('', '_blank');
    showUrlFor(filename).then(url => {
        if (tab) tab.location.href = url;
        else window.open(url, '_blank');
    });
}

export function editScript(filename) {
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

export function deleteScript(filename) {
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
            body: JSON.stringify({ filename, key: getOwnerKeys()[filename] })
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
export function exportConfig() {
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

export function importConfig(e) {
    const file = e.target.files[0];
    if (!file) return;

    confirmAction('Việc nhập kịch bản mới sẽ ghi đè lên kịch bản hiện tại. Bạn có chắc chắn muốn tiếp tục?', () => {
        showLoading('Đang nhập kịch bản...');
        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const config = JSON.parse(e.target.result);
                loadConfigIntoState(config, file.name.replace('.json', ''));
                // Như kịch bản mới: lưu lần đầu tự thêm số nếu trùng tên kịch bản đã có (không ghi đè)
                state.currentFilename = null;
                updateScriptNameLabel();
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
