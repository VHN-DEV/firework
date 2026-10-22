/*!
 * Trình diễn Pháo hoa – builder (danh sách kịch bản)
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Danh sách kịch bản đã lưu: nhân bản, xem, sửa, xóa, xuất, nhập.

import { copyText } from '../share-targets.js';
import { getOwnerKeys, removeOwnerKey } from '../gift-tracking.js';
import { isStaticEnv, state } from './state.js';
import { confirmAction, escapeHtml, getShowUrl, hideLoading, hideModal, notify, showLoading, showModal } from './util.js';
import { updateScriptNameLabel } from './timeline.js';
import { getFinalConfig, getUniqueFilename, loadConfigIntoState } from './config.js';
import { markSaved } from './history.js';
import { showGiftBadges } from './gift-watch.js';
import { resolveShareUrl, updateShareBar } from './share.js';

export async function copyScriptLink(filename) {
    const { url } = await resolveShareUrl(filename);
    if (await copyText(url)) {
        notify('Đã sao chép link kịch bản!', 'success');
    } else {
        notify('Không thể sao chép link, hãy thử lại.', 'error');
    }
}

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
                // Do máy khác tạo: chỉ xem, nhân bản được; sửa rồi lưu thì thành bản mới
                const isOthers = script.locked && !ownerKeys[script.id];

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
                    <span class="script-badges">${isPrivate ? '<span class="gift-badge" title="Kịch bản riêng tư: không xóa được từ đây"><i class="fas fa-lock"></i>Riêng tư</span>' : ''}${isLocal ? '<span class="gift-badge" title="Chỉ lưu trên trình duyệt này"><i class="fas fa-laptop"></i>Trên máy này</span>' : ''}${isOthers ? '<span class="gift-badge" title="Chỉ máy đã tạo mới lưu đè, xóa được. Bạn vẫn xem, nhân bản được; sửa rồi lưu sẽ thành bản mới."><i class="fas fa-user-lock"></i>Máy khác tạo</span>' : ''}</span>
                </div>
                <div class="script-actions">
                    <button class="btn primary small" onclick="editScript('${script.id}')"><i class="fas fa-edit"></i> Sửa</button>
                    <button class="btn secondary small" onclick="duplicateScript('${script.id}')"><i class="fas fa-copy"></i> Nhân bản</button>
                    <button class="btn secondary small" onclick="previewScript('${script.id}')"><i class="fas fa-play"></i> Xem</button>
                    ${(!isPrivate || isLocal) && !isOthers ? `<button class="btn danger small is-icon" onclick="deleteScript('${script.id}')" title="Xóa" aria-label="Xóa kịch bản"><i class="fas fa-trash"></i></button>` : ''}
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
    window.open(getShowUrl(filename), '_blank');
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
