/*!
 * Hanabi – trang quản trị
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Trang quản trị (/admin) của chủ trang, chỉ có trên bản Cloudflare (worker/admin.js): đăng nhập Google bằng email có
// trong ADMIN_EMAILS. Các mục: Tổng quan; Kịch bản (tìm, xem chi tiết, xóa); Người dùng (khóa, mở khóa, xóa, xem kịch bản
// của họ); Kho nhạc, Kho ảnh (thêm, sửa, ẩn, xóa); Lời cảm ơn (xóa lời không phù hợp). Mục đang xem ghi trên địa chỉ
// (#scripts...) để tải lại trang vẫn đúng chỗ.

import { printCopyrightNotice } from './copyright.js';
import { formatWhen } from './gift-tracking.js';
import { forgetGoogleChoice, renderGoogleButton } from './google-signin.js';

printCopyrightNotice('Hanabi – Quản trị');

const $ = selector => document.querySelector(selector);
const panel = $('#panel');
const dialog = $('#script-dialog');
const TABS = ['overview', 'scripts', 'users', 'music', 'images', 'replies'];
const view = {
    tab: 'overview',
    scripts: { q: '', user: '', userLabel: '', page: 1 },
    users: { q: '', page: 1 },
    replies: { page: 1 },
    library: {}
};
let player = null;

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = String(text ?? '');
    return div.innerHTML;
}

// Thời điểm lưu theo giây (D1) -> "20:15 hôm nay"...
const when = seconds => (seconds ? formatWhen(new Date(seconds * 1000).toISOString()) : 'chưa có');
const fileSize = bytes => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);
const minutes = seconds => `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}`;
const empty = text => `<p class="admin-empty">${text}</p>`;

let toastTimer = null;
function toast(message, error = false) {
    const box = $('#toast');
    box.textContent = message;
    box.classList.toggle('is-error', error);
    box.classList.remove('hide');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => box.classList.add('hide'), 4000);
}

async function post(url, body, isForm = false) {
    const response = await fetch(url, isForm
        ? { method: 'POST', body }
        : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await response.json().catch(() => ({ success: false, message: `Máy chủ trả lỗi ${response.status}.` }));
    if (!data.success) throw Object.assign(new Error(data.message || 'Có lỗi, hãy thử lại.'), { code: data.code });
    return data;
}

const api = (action, body = {}) => post(`api/admin.php?action=${action}`, body);

// ---------------------------------------------------------------------------
// Đăng nhập
// ---------------------------------------------------------------------------

function gate(message, { clientId = '', logout = false } = {}) {
    $('#app').classList.add('hide');
    $('#gate').classList.remove('hide');
    $('#gate-message').textContent = message;
    const google = $('#gate-google');
    google.innerHTML = '';
    if (clientId) renderGoogleButton(google, clientId, login);
    $('#gate-logout').classList.toggle('hide', !logout);
}

async function login(credential) {
    try {
        await post('api/account.php?action=login', { credential, keys: {} });
        start();
    } catch (e) {
        toast(e.message, true);
    }
}

async function logout() {
    try {
        await post('api/account.php?action=logout', {});
    } catch (e) {
        // Phiên đã hết: vẫn tải lại
    }
    forgetGoogleChoice();
    window.location.reload();
}

async function start() {
    let me;
    try {
        me = await post('api/account.php?action=me', {});
    } catch (e) {
        gate('Không kết nối được máy chủ. Trang quản trị chỉ có trên bản chạy Cloudflare Workers.');
        return;
    }
    if (!me.enabled) {
        gate('Trang quản trị cần đăng nhập Google trên bản chạy Cloudflare Workers (đặt GOOGLE_CLIENT_ID trong wrangler.jsonc).');
        return;
    }
    if (!me.user) {
        gate('Đăng nhập bằng tài khoản Google của quản trị viên.', { clientId: me.clientId });
        return;
    }
    $('#admin-email').textContent = me.user.email;
    $('#admin-me').classList.remove('hide');
    $('#gate').classList.add('hide');
    $('#app').classList.remove('hide');
    showTab(tabFromHash());
}

// ---------------------------------------------------------------------------
// Các mục
// ---------------------------------------------------------------------------

const tabFromHash = () => (TABS.includes(window.location.hash.slice(1)) ? window.location.hash.slice(1) : 'overview');

async function showTab(tab) {
    view.tab = tab;
    if (window.location.hash.slice(1) !== tab) history.replaceState(null, '', `#${tab}`);
    document.querySelectorAll('.admin-tabs [data-tab]').forEach(button => button.setAttribute('aria-selected', String(button.dataset.tab === tab)));
    // Điện thoại: thanh mục cuộn ngang, đưa mục đang chọn vào giữa
    document.querySelector(`.admin-tabs [data-tab="${tab}"]`).scrollIntoView({ block: 'nearest', inline: 'center' });
    stopPlayer();
    panel.innerHTML = '<div class="spinner"></div>';
    await run(() => ({ overview: renderOverview, scripts: renderScripts, users: renderUsers, music: () => renderLibrary('music'),
        images: () => renderLibrary('images'), replies: renderReplies })[tab]());
}

// Chạy một thao tác: hết phiên, mất quyền thì về màn đăng nhập; lỗi khác thì báo
async function run(task) {
    try {
        await task();
    } catch (e) {
        if (e.code === 'login' || e.code === 'forbidden') {
            const me = await post('api/account.php?action=me', {}).catch(() => ({}));
            gate(e.message, { clientId: e.code === 'login' ? me.clientId : '', logout: e.code === 'forbidden' });
        } else {
            toast(e.message, true);
            if (panel.querySelector('.spinner')) panel.innerHTML = empty(escapeHtml(e.message));
        }
    }
}

const refresh = () => showTab(view.tab);

function pager({ page, total, pageSize }) {
    const pages = Math.max(1, Math.ceil(total / pageSize));
    if (pages <= 1) return '';
    return `<div class="admin-pager">
        <button type="button" class="admin-btn small" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}><i class="fas fa-chevron-left"></i> Trước</button>
        <span>Trang ${page}/${pages}</span>
        <button type="button" class="admin-btn small" data-page="${page + 1}" ${page >= pages ? 'disabled' : ''}>Sau <i class="fas fa-chevron-right"></i></button>
    </div>`;
}

function search(name, value, placeholder) {
    return `<form class="admin-search" data-search="${name}" role="search">
        <i class="fas fa-magnifying-glass" aria-hidden="true"></i>
        <input type="search" name="q" value="${escapeHtml(value)}" placeholder="${placeholder}" aria-label="${placeholder}">
    </form>`;
}

// ---- Tổng quan ----

function stat(icon, value, label, note, tab) {
    return `<button type="button" class="admin-stat" ${tab ? `data-go="${tab}"` : 'disabled'}>
        <i class="fas ${icon}" aria-hidden="true"></i><strong>${value}</strong><span>${label}</span>${note ? `<small>${note}</small>` : ''}
    </button>`;
}

async function renderOverview() {
    const data = await api('overview');
    const c = data.counts;
    panel.innerHTML = `
        <div class="admin-stats">
            ${stat('fa-wand-magic-sparkles', c.scripts, 'Kịch bản', `${c.scriptsWeek} lưu trong 7 ngày`, 'scripts')}
            ${stat('fa-users', c.users, 'Người dùng', `${c.usersWeek} mới trong 7 ngày${c.locked ? ` · ${c.locked} bị khóa` : ''}`, 'users')}
            ${stat('fa-heart', c.replies, 'Lời cảm ơn', '', 'replies')}
            ${stat('fa-right-to-bracket', c.sessions, 'Phiên đăng nhập', 'còn hạn')}
            ${stat('fa-eye', c.previews, 'Bản Xem thử tạm', 'tự xóa sau 1 ngày')}
        </div>
        <div class="admin-columns">
            <section>
                <h2>Kịch bản mới lưu</h2>
                <div class="admin-list">${data.scripts.map(scriptRow).join('') || empty('Chưa có kịch bản nào.')}</div>
            </section>
            <section>
                <h2>Người dùng mới</h2>
                <div class="admin-list">${data.users.map(userRow).join('') || empty('Chưa có ai đăng nhập.')}</div>
            </section>
        </div>`;
}

// ---- Kịch bản ----

function scriptRow(s) {
    const badges = [
        s.opens ? `<span class="admin-badge ok" title="Người nhận đã mở quà">🎁 ${s.opens}</span>` : s.views ? `<span class="admin-badge" title="Đã mở link">🔗 ${s.views}</span>` : '',
        s.replies ? `<span class="admin-badge" title="Lời cảm ơn">💌 ${s.replies}</span>` : ''
    ].join('');
    return `<article class="admin-row" data-id="${escapeHtml(s.id)}" data-title="${escapeHtml(s.title)}">
        <span class="admin-thumb">${s.image ? `<img src="configs/${encodeURIComponent(s.id)}.jpg?v=${s.updated}" alt="" loading="lazy">` : '<i class="fas fa-wand-magic-sparkles"></i>'}</span>
        <div class="admin-row__main">
            <strong>${escapeHtml(s.title)}</strong>
            <small>${escapeHtml(s.id)}${s.author ? ` · ${escapeHtml(s.author)}` : ''} · ${s.events} phát · ${fileSize(s.size)}</small>
            <small>Lưu ${when(s.updated)}${s.owners ? ` · <i class="fas fa-user"></i> ${escapeHtml(s.owners)}` : ''}</small>
        </div>
        <div class="admin-row__meta">${badges}</div>
        <div class="admin-row__actions">
            <a class="admin-btn icon" href="s/${encodeURIComponent(s.id)}" target="_blank" rel="noopener" title="Xem màn trình diễn"><i class="fas fa-play"></i></a>
            <button type="button" class="admin-btn icon" data-action="detail" title="Chi tiết"><i class="fas fa-circle-info"></i></button>
            <button type="button" class="admin-btn icon danger" data-action="delete-script" title="Xóa kịch bản"><i class="fas fa-trash"></i></button>
        </div>
    </article>`;
}

async function renderScripts() {
    const v = view.scripts;
    const data = await api('scripts', { q: v.q, user: v.user, page: v.page });
    panel.innerHTML = `
        <div class="admin-toolbar">
            ${search('scripts', v.q, 'Tìm theo tên, tiêu đề, người tạo')}
            ${v.user ? `<span class="admin-chip">Của ${escapeHtml(v.userLabel)} <button type="button" data-action="clear-user" aria-label="Bỏ lọc"><i class="fas fa-xmark"></i></button></span>` : ''}
            <span class="admin-count">${data.total} kịch bản</span>
        </div>
        <div class="admin-list">${data.items.map(scriptRow).join('') || empty('Không có kịch bản nào.')}</div>
        ${pager(data)}`;
}

async function openScript(id) {
    const d = await api('script', { id });
    const c = d.config;
    const o = d.opens;
    const text = ['subtitle', 'introMessage', 'outroMessage'].map(key => c[key]).filter(value => typeof value === 'string' && value.trim());
    $('#script-dialog-title').textContent = c.title || id;
    $('#script-dialog-body').innerHTML = `
        <dl class="admin-facts">
            <dt>Tên</dt><dd>${escapeHtml(id)}</dd>
            <dt>Người tạo</dt><dd>${escapeHtml(c.author || '—')}</dd>
            <dt>Người nhận</dt><dd>${escapeHtml(c.recipient || '—')}</dd>
            <dt>Phát bắn</dt><dd>${(c.events || []).length}</dd>
            <dt>Lưu lúc</dt><dd>${when(d.updated)}</dd>
            <dt>Tài khoản</dt><dd>${d.owners.length ? d.owners.map(u => escapeHtml(u.email)).join(', ') : 'Không đăng nhập'}</dd>
            <dt>Mở quà</dt><dd>${o ? `Mở link ${o.counts.view || 0} · mở quà ${o.counts.open || 0} · xem hết ${o.counts.finish || 0}` : 'Chưa có lượt nào'}${c.notifyOpen === false ? ' (người tạo tắt báo mở quà)' : ''}</dd>
        </dl>
        ${text.length ? `<h3>Lời chúc</h3><div class="admin-quote">${text.map(escapeHtml).join('<br>')}</div>` : ''}
        <h3>Lời cảm ơn (${d.replies.length})</h3>
        <div class="admin-list">${d.replies.map(r => replyRow({ ...r, id })).join('') || empty('Chưa có.')}</div>
        <div class="admin-dialog__actions" data-id="${escapeHtml(id)}" data-title="${escapeHtml(c.title || id)}">
            <a class="admin-btn" href="s/${encodeURIComponent(id)}" target="_blank" rel="noopener"><i class="fas fa-play"></i> Xem màn trình diễn</a>
            <button type="button" class="admin-btn danger" data-action="delete-script"><i class="fas fa-trash"></i> Xóa kịch bản</button>
        </div>`;
    if (!dialog.open) dialog.showModal();
}

async function deleteScript(id, title) {
    if (!confirm(`Xóa kịch bản "${title}" (${id})?\nẢnh, nhạc chỉ kịch bản này dùng, lượt mở, lời cảm ơn cũng bị xóa. Không hoàn tác được.`)) return;
    await api('deleteScript', { id });
    if (dialog.open) dialog.close();
    toast(`Đã xóa kịch bản ${id}.`);
    refresh();
}

// ---- Người dùng ----

function userRow(u) {
    const initial = escapeHtml((u.name || u.email || '?').trim().charAt(0).toUpperCase());
    const actions = u.admin ? '' : `
        <button type="button" class="admin-btn small" data-action="lock-user">${u.locked ? '<i class="fas fa-lock-open"></i> Mở khóa' : '<i class="fas fa-lock"></i> Khóa'}</button>
        <button type="button" class="admin-btn icon danger" data-action="delete-user" title="Xóa tài khoản"><i class="fas fa-trash"></i></button>`;
    return `<article class="admin-row${u.locked ? ' is-locked' : ''}" data-id="${escapeHtml(u.id)}" data-email="${escapeHtml(u.email)}"
        data-scripts="${u.scripts}" data-locked="${u.locked ? 1 : 0}">
        <span class="admin-avatar">${u.picture ? `<img src="${escapeHtml(u.picture)}" alt="" referrerpolicy="no-referrer">` : initial}</span>
        <div class="admin-row__main">
            <strong>${escapeHtml(u.name || u.email)}${u.admin ? ' <span class="admin-badge ok">Quản trị</span>' : ''}${u.locked ? ' <span class="admin-badge danger">Đã khóa</span>' : ''}</strong>
            <small>${escapeHtml(u.email)}</small>
            <small>Tạo ${when(u.created)} · đăng nhập ${when(u.seen)}</small>
        </div>
        <div class="admin-row__meta"><button type="button" class="admin-link" data-action="user-scripts">${u.scripts} kịch bản</button></div>
        <div class="admin-row__actions">${actions}</div>
    </article>`;
}

async function renderUsers() {
    const v = view.users;
    const data = await api('users', { q: v.q, page: v.page });
    panel.innerHTML = `
        <div class="admin-toolbar">
            ${search('users', v.q, 'Tìm theo email, tên')}
            <span class="admin-count">${data.total} người dùng</span>
        </div>
        <div class="admin-list">${data.items.map(userRow).join('') || empty('Chưa có ai đăng nhập.')}</div>
        ${pager(data)}`;
}

async function lockUser(row) {
    const locked = row.dataset.locked !== '1';
    if (locked && !confirm(`Khóa tài khoản ${row.dataset.email}?\nNgười này bị đăng xuất trên mọi máy và không đăng nhập lại được. Kịch bản của họ vẫn còn.`)) return;
    await api('lockUser', { id: row.dataset.id, locked });
    toast(locked ? `Đã khóa ${row.dataset.email}.` : `Đã mở khóa ${row.dataset.email}.`);
    refresh();
}

async function deleteUser(row) {
    const { id, email } = row.dataset;
    const count = Number(row.dataset.scripts);
    if (!confirm(`Xóa tài khoản ${email}?\nTên, email và danh sách kịch bản tài khoản giữ hộ bị xóa. Không hoàn tác được.`)) return;
    const scripts = count > 0 && confirm(`Xóa luôn ${count} kịch bản của tài khoản này?\nBấm Hủy để giữ kịch bản (vẫn xem được bằng link).`);
    // Nhiều kịch bản: máy chủ xóa từng đợt, gọi tiếp tới khi xong
    for (let round = 0; round < 200; round++) {
        const result = await api('deleteUser', { id, scripts });
        if (!result.remaining) break;
        toast('Đang xóa kịch bản...');
    }
    toast(`Đã xóa tài khoản ${email}.`);
    refresh();
}

// ---- Kho nhạc, kho ảnh ----

function libraryRow(kind, item) {
    const url = `library/${kind}/${encodeURIComponent(item.file)}`;
    const preview = kind === 'music'
        ? `<button type="button" class="admin-btn icon admin-play" data-action="play" data-url="${url}" title="Nghe thử"><i class="fas fa-play"></i></button>`
        : `<span class="admin-thumb"><img src="${url}" alt="" loading="lazy"></span>`;
    const details = [item.artist, item.duration ? minutes(item.duration) : '', (item.tags || []).join(', ')].filter(Boolean).map(escapeHtml).join(' · ');
    const used = item.used ? `${item.used} kịch bản đang dùng` : 'chưa kịch bản nào dùng';
    return `<article class="admin-row${item.hidden ? ' is-hidden' : ''}" data-id="${escapeHtml(item.id)}" data-kind="${kind}">
        ${preview}
        <div class="admin-row__main">
            <strong>${escapeHtml(item.name || item.id)}</strong>
            ${details ? `<small>${details}</small>` : ''}
            <small>${item.uploaded ? 'Tự thêm' : 'Có sẵn'}${item.hidden ? ' · <b>Đang ẩn</b>' : ''} · ${used}</small>
        </div>
        <div class="admin-row__actions">
            <button type="button" class="admin-btn small" data-action="edit-item"><i class="fas fa-pen"></i> Sửa</button>
            <button type="button" class="admin-btn small" data-action="toggle-item">${item.hidden ? '<i class="fas fa-eye"></i> Hiện' : '<i class="fas fa-eye-slash"></i> Ẩn'}</button>
            ${item.uploaded ? `<button type="button" class="admin-btn icon danger" data-action="delete-item" ${item.used ? 'disabled title="Đang có kịch bản dùng: hãy ẩn"' : 'title="Xóa"'}><i class="fas fa-trash"></i></button>` : ''}
        </div>
    </article>`;
}

// Ô nhập của một mục kho (thêm mới hoặc sửa)
function libraryFields(kind, item = {}) {
    const field = (name, label, attrs = '', wide = false) =>
        `<label${wide ? ' class="wide"' : ''}>${label}<input name="${name}" value="${escapeHtml(item[name] ?? '')}" ${attrs}></label>`;
    return kind === 'music'
        ? field('name', 'Tên bài', 'maxlength="80" required') + field('artist', 'Nghệ sĩ, nguồn thu', 'maxlength="80"')
            + `<label>Nhãn (cách nhau dấu phẩy)<input name="tags" value="${escapeHtml((item.tags || []).join(', '))}" placeholder="Sinh nhật, Vui tươi"></label>`
            + field('license', 'Giấy phép', 'maxlength="80"') + field('source', 'Link nguồn', 'type="url" maxlength="300" placeholder="https://..."', true)
        : field('name', 'Tên ảnh', 'maxlength="80" required')
            + `<label>Nhãn (cách nhau dấu phẩy)<input name="tags" value="${escapeHtml((item.tags || []).join(', '))}" placeholder="Sinh nhật, Tình yêu"></label>`;
}

async function renderLibrary(kind) {
    const music = kind === 'music';
    const data = await api('library', { kind });
    view.library[kind] = data.items;
    panel.innerHTML = `
        <form class="admin-card admin-upload" data-upload="${kind}">
            <h2><i class="fas fa-plus"></i> Thêm ${music ? 'bài nhạc' : 'ảnh'}</h2>
            <div class="admin-fields">
                <label class="wide">${music ? 'File nhạc (MP3, M4A, OGG, WAV; tối đa 20MB)' : 'File ảnh (JPG, PNG, WEBP, GIF; tối đa 10MB)'}
                    <input type="file" name="file" accept="${music ? 'audio/*' : 'image/*'}" required></label>
                ${libraryFields(kind, music ? { license: 'Phạm vi công cộng' } : {})}
            </div>
            <div class="admin-form-actions">
                <button type="submit" class="admin-btn primary"><i class="fas fa-upload"></i> Thêm vào kho</button>
                <small>${music ? 'Chỉ thêm nhạc được dùng tự do (phạm vi công cộng, giấy phép mở) hoặc nhạc bạn có quyền.' : 'Chỉ thêm ảnh bạn có quyền dùng.'}</small>
            </div>
        </form>
        <div class="admin-toolbar">
            <span class="admin-count">${data.items.length} mục · ${data.items.filter(item => item.hidden).length} đang ẩn</span>
        </div>
        <div class="admin-list">${data.items.map(item => libraryRow(kind, item)).join('') || empty('Kho trống.')}</div>`;
}

// Độ dài bài nhạc (giây), đọc ngay trên máy trước khi tải lên
function audioDuration(file) {
    return new Promise(resolve => {
        const audio = new Audio();
        const url = URL.createObjectURL(file);
        const done = value => {
            URL.revokeObjectURL(url);
            resolve(value);
        };
        audio.preload = 'metadata';
        audio.onloadedmetadata = () => done(Number.isFinite(audio.duration) ? Math.round(audio.duration) : 0);
        audio.onerror = () => done(0);
        audio.src = url;
    });
}

async function addLibraryItem(form) {
    const kind = form.dataset.upload;
    const data = new FormData(form);
    const file = data.get('file');
    if (!file || !file.size) {
        toast('Chưa chọn file.', true);
        return;
    }
    data.append('kind', kind);
    if (kind === 'music') data.append('duration', String(await audioDuration(file)));
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    try {
        await post('api/admin.php?action=libraryAdd', data, true);
        toast(`Đã thêm "${data.get('name')}" vào kho.`);
        refresh();
    } finally {
        button.disabled = false;
    }
}

function editLibraryItem(row) {
    const { kind, id } = row.dataset;
    if (row.querySelector('.admin-edit')) {
        row.querySelector('.admin-edit').remove();
        return;
    }
    const item = view.library[kind].find(entry => entry.id === id);
    row.insertAdjacentHTML('beforeend', `<form class="admin-edit" data-edit="${kind}">
        <div class="admin-fields">${libraryFields(kind, item)}</div>
        <div class="admin-form-actions">
            <button type="submit" class="admin-btn primary small">Lưu</button>
            <button type="button" class="admin-btn small" data-action="edit-item">Hủy</button>
        </div>
    </form>`);
    row.querySelector('.admin-edit input').focus();
}

function togglePlay(button) {
    const url = button.dataset.url;
    const same = player && player.src.endsWith(url) && !player.paused;
    stopPlayer();
    if (same) return;
    player = new Audio(url);
    player.play().catch(() => toast('Không phát được bài này.', true));
    button.querySelector('i').className = 'fas fa-pause';
    player.onended = stopPlayer;
}

function stopPlayer() {
    if (player) player.pause();
    player = null;
    document.querySelectorAll('.admin-play i').forEach(icon => { icon.className = 'fas fa-play'; });
}

// ---- Lời cảm ơn ----

function replyRow(r) {
    return `<article class="admin-row" data-n="${r.n}" data-id="${escapeHtml(r.id)}">
        <div class="admin-row__main">
            <p class="admin-quote">${escapeHtml(r.message)}</p>
            <small>${escapeHtml(r.name || 'Người nhận')} · ${formatWhen(r.t)}${r.title !== undefined
                ? ` · <button type="button" class="admin-link" data-action="detail">${escapeHtml(r.title || r.id)}</button>` : ''}</small>
        </div>
        <div class="admin-row__actions">
            <button type="button" class="admin-btn icon danger" data-action="delete-reply" title="Xóa lời cảm ơn"><i class="fas fa-trash"></i></button>
        </div>
    </article>`;
}

async function renderReplies() {
    const data = await api('replies', { page: view.replies.page });
    panel.innerHTML = `
        <div class="admin-toolbar"><span class="admin-count">${data.total} lời cảm ơn</span></div>
        <div class="admin-list">${data.items.map(replyRow).join('') || empty('Chưa có lời cảm ơn nào.')}</div>
        ${pager(data)}`;
}

async function deleteReply(row) {
    if (!confirm('Xóa lời cảm ơn này? Người tặng sẽ không còn thấy.')) return;
    await api('deleteReply', { n: Number(row.dataset.n) });
    toast('Đã xóa lời cảm ơn.');
    if (dialog.open) {
        row.remove();
        return;
    }
    refresh();
}

// ---------------------------------------------------------------------------
// Bấm, gửi form
// ---------------------------------------------------------------------------

document.addEventListener('click', e => {
    const tab = e.target.closest('[data-tab], [data-go]');
    if (tab) {
        showTab(tab.dataset.tab || tab.dataset.go);
        return;
    }
    const page = e.target.closest('[data-page]');
    if (page) {
        const state = view[view.tab];
        state.page = Number(page.dataset.page);
        refresh();
        return;
    }
    if (e.target.closest('[data-close]')) {
        dialog.close();
        return;
    }
    const button = e.target.closest('[data-action]');
    if (!button) return;
    const row = button.closest('[data-id], [data-n]');
    const action = button.dataset.action;
    run(async () => {
        if (action === 'detail') await openScript(row.dataset.id);
        else if (action === 'delete-script') await deleteScript(row.dataset.id, row.dataset.title || row.dataset.id);
        else if (action === 'lock-user') await lockUser(row);
        else if (action === 'delete-user') await deleteUser(row);
        else if (action === 'user-scripts') {
            Object.assign(view.scripts, { user: row.dataset.id, userLabel: row.dataset.email, q: '', page: 1 });
            await showTab('scripts');
        } else if (action === 'clear-user') {
            Object.assign(view.scripts, { user: '', userLabel: '', page: 1 });
            await refresh();
        } else if (action === 'play') togglePlay(button);
        else if (action === 'edit-item') editLibraryItem(row);
        else if (action === 'toggle-item') {
            const item = view.library[row.dataset.kind].find(entry => entry.id === row.dataset.id);
            await api('libraryUpdate', { kind: row.dataset.kind, id: item.id, hidden: !item.hidden });
            toast(item.hidden ? `Đã hiện "${item.name}" trong kho.` : `Đã ẩn "${item.name}": builder không còn hiện, kịch bản đang dùng vẫn phát được.`);
            await refresh();
        } else if (action === 'delete-item') {
            const item = view.library[row.dataset.kind].find(entry => entry.id === row.dataset.id);
            if (!confirm(`Xóa hẳn "${item.name}" khỏi kho? Không hoàn tác được.`)) return;
            await api('libraryDelete', { kind: row.dataset.kind, id: item.id });
            toast(`Đã xóa "${item.name}".`);
            await refresh();
        } else if (action === 'delete-reply') await deleteReply(row);
    });
});

document.addEventListener('submit', e => {
    const form = e.target;
    e.preventDefault();
    run(async () => {
        if (form.dataset.search) {
            Object.assign(view[form.dataset.search], { q: form.q.value.trim(), page: 1 });
            await refresh();
        } else if (form.dataset.upload) {
            await addLibraryItem(form);
        } else if (form.dataset.edit) {
            const row = form.closest('[data-id]');
            const fields = Object.fromEntries(new FormData(form).entries());
            await api('libraryUpdate', { kind: form.dataset.edit, id: row.dataset.id, ...fields });
            toast('Đã lưu.');
            await refresh();
        }
    });
});

// Xóa hết chữ trong ô tìm kiếm (nút × của ô search): tìm lại ngay
document.addEventListener('search', e => {
    const form = e.target.form;
    if (form && form.dataset.search && !e.target.value) form.requestSubmit();
}, true);

dialog.addEventListener('click', e => {
    if (e.target === dialog) dialog.close();
});
$('#btn-logout').addEventListener('click', logout);
$('#gate-logout').addEventListener('click', logout);
window.addEventListener('hashchange', () => {
    if (!$('#app').classList.contains('hide') && tabFromHash() !== view.tab) showTab(tabFromHash());
});

start();
