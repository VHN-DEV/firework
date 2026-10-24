/*!
 * Hanabi – trang quản trị
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Trang quản trị (/admin) của chủ trang, chỉ có trên bản Cloudflare (worker/admin.js): đăng nhập Google bằng email có
// trong ADMIN_EMAILS. Các mục: Bảng điều khiển (số liệu, hạn mức Cloudflare hôm nay); Kịch bản (tìm, xem chi tiết, xóa);
// Lời cảm ơn (gom theo kịch bản: ai tặng ai, ai cảm ơn); Người dùng (khóa, mở khóa, xóa, xem kịch bản của họ); Kho nhạc,
// Kho ảnh (thêm, sửa, ẩn, xóa). Mục đang xem ghi trên địa chỉ (#scripts...) để tải lại trang vẫn đúng chỗ.

import { printCopyrightNotice } from './copyright.js';
import { formatWhen } from './gift-tracking.js';
import { forgetGoogleChoice, renderGoogleButton } from './google-signin.js';

printCopyrightNotice('Hanabi – Quản trị');

const $ = selector => document.querySelector(selector);
const panel = $('#panel');
const dialog = $('#modal');

const PAGES = {
    overview: { title: 'Bảng điều khiển', subtitle: 'Tình hình Hanabi và hạn mức Cloudflare hôm nay' },
    scripts: { title: 'Kịch bản', subtitle: 'Mọi màn trình diễn đã lưu trên máy chủ' },
    replies: { title: 'Lời cảm ơn', subtitle: 'Lời người nhận gửi người tặng, theo từng kịch bản' },
    users: { title: 'Người dùng', subtitle: 'Tài khoản đã đăng nhập bằng Google' },
    music: { title: 'Kho nhạc', subtitle: 'Nhạc nền người tạo chọn trong builder' },
    images: { title: 'Kho ảnh', subtitle: 'Ảnh có sẵn cho pháo ảnh trong builder' }
};
const view = {
    tab: 'overview',
    scripts: { q: '', user: '', userLabel: '', page: 1 },
    users: { q: '', page: 1 },
    replies: { page: 1 },
    library: {}
};
let player = null;

// ---------------------------------------------------------------------------
// Tiện ích
// ---------------------------------------------------------------------------

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = String(text ?? '');
    return div.innerHTML;
}

const number = value => Number(value || 0).toLocaleString('vi-VN');
// Thời điểm lưu theo giây (D1) -> "20:15 hôm nay"...
const when = seconds => (seconds ? formatWhen(new Date(seconds * 1000).toISOString()) : '<span class="muted">—</span>');
const bytes = value => (value >= 1073741824 ? `${(value / 1073741824).toFixed(2)} GB`
    : value >= 1048576 ? `${(value / 1048576).toFixed(1)} MB` : `${Math.max(0, Math.round(value / 1024))} KB`);
const minutes = seconds => `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}`;
const initial = person => escapeHtml((person.name || person.email || '?').trim().charAt(0).toUpperCase());
const avatar = (person, size = '') => `<span class="avatar ${size}">${person.picture
    ? `<img src="${escapeHtml(person.picture)}" alt="" referrerpolicy="no-referrer">` : initial(person)}</span>`;
const dash = '<span class="muted">—</span>';
const iconButton = (action, icon, label, extra = '') =>
    `<button type="button" class="btn btn--icon btn--ghost${extra}" data-action="${action}" title="${label}" aria-label="${label}"><i class="fas ${icon}"></i></button>`;

function emptyState(icon, title, text = '') {
    return `<div class="empty"><i class="fas ${icon}"></i><strong>${title}</strong>${text ? `<p>${text}</p>` : ''}</div>`;
}

// Bảng có tiêu đề cột; điện thoại: mỗi dòng thành một thẻ, nhãn cột lấy từ data-label
function table(columns, rows) {
    return `<div class="card table-card"><table class="table">
        <thead><tr>${columns.map(([label, cls = '']) => `<th class="${cls}">${label}</th>`).join('')}</tr></thead>
        <tbody>${rows.join('')}</tbody>
    </table></div>`;
}

function pager({ page, total, pageSize }) {
    const pages = Math.max(1, Math.ceil(total / pageSize));
    if (pages <= 1) return '';
    const from = (page - 1) * pageSize + 1;
    return `<div class="pager">
        <span>${number(from)}–${number(Math.min(total, page * pageSize))} trên ${number(total)}</span>
        <div>
            <button type="button" class="btn btn--sm" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}><i class="fas fa-chevron-left"></i> Trước</button>
            <button type="button" class="btn btn--sm" data-page="${page + 1}" ${page >= pages ? 'disabled' : ''}>Sau <i class="fas fa-chevron-right"></i></button>
        </div>
    </div>`;
}

function searchBox(name, value, placeholder) {
    return `<label class="search"><i class="fas fa-magnifying-glass" aria-hidden="true"></i>
        <input type="search" data-search="${name}" value="${escapeHtml(value)}" placeholder="${placeholder}" aria-label="${placeholder}"></label>`;
}

const skeleton = () => `<div class="card skeleton">${'<span></span>'.repeat(6)}</div>`;

function toast(message, type = 'success') {
    const icons = { success: 'fa-circle-check', error: 'fa-circle-exclamation', info: 'fa-circle-info' };
    const item = document.createElement('div');
    item.className = `toast toast--${type}`;
    item.setAttribute('role', type === 'error' ? 'alert' : 'status');
    item.innerHTML = `<i class="fas ${icons[type]}"></i><span>${escapeHtml(message)}</span>`;
    $('#toasts').append(item);
    setTimeout(() => item.classList.add('is-leaving'), 4200);
    setTimeout(() => item.remove(), 4600);
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
// Hộp thoại dùng chung
// ---------------------------------------------------------------------------

// actions: [{ id, label, kind: 'primary' | 'danger', submit }]. Nút thường đóng hộp, trả về id; nút submit gửi form
// #modal-form cho onSubmit (lỗi thì báo, hộp vẫn mở). Đóng hộp: null
let current = null;

function modal({ title, body, actions = [], size = '', onSubmit = null }) {
    if (current) current.resolve(null);
    $('#modal-title').textContent = title;
    $('#modal-body').innerHTML = body;
    $('#modal-foot').innerHTML = actions.map(a => `<button type="${a.submit ? 'submit' : 'button'}" ${a.submit ? 'form="modal-form"' : `data-modal-action="${a.id}"`}
        class="btn${a.kind ? ` btn--${a.kind}` : ''}">${a.label}</button>`).join('');
    $('#modal-foot').classList.toggle('hide', !actions.length);
    dialog.className = `modal ${size}`;
    if (!dialog.open) dialog.showModal();
    // Con trỏ vào ô nhập đầu tiên, không thì nút đầu ở chân hộp (Hủy khi hỏi lại), không vào nút đóng
    const focus = $('#modal-body').querySelector('input:not([type="file"])') || $('#modal-foot button');
    if (focus) focus.focus();
    return new Promise(resolve => { current = { resolve, onSubmit }; });
}

function closeModal(value = null) {
    const open = current;
    current = null;
    if (dialog.open) dialog.close();
    if (open) open.resolve(value);
}

async function confirmBox({ title, message, confirm = 'Xóa', danger = true, check = '' }) {
    const answer = await modal({
        title,
        size: 'modal--small',
        body: `<p class="modal__text">${message}</p>${check ? `<label class="check"><input type="checkbox" id="modal-check"><span>${check}</span></label>` : ''}`,
        actions: [{ id: 'cancel', label: 'Hủy' }, { id: 'ok', label: confirm, kind: danger ? 'danger' : 'primary' }]
    });
    return answer === 'ok' ? { checked: !!document.getElementById('modal-check')?.checked } : null;
}

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
        toast(e.message, 'error');
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
        gate('Trang quản trị cần đăng nhập Google trên bản chạy Cloudflare Workers (GOOGLE_CLIENT_ID trong wrangler.jsonc).');
        return;
    }
    if (!me.user) {
        gate('Đăng nhập bằng tài khoản Google của quản trị viên.', { clientId: me.clientId });
        return;
    }
    $('#me-avatar').innerHTML = me.user.picture ? `<img src="${escapeHtml(me.user.picture)}" alt="" referrerpolicy="no-referrer">` : initial(me.user);
    $('#me-name').textContent = me.user.name || me.user.email;
    $('#me-email').textContent = me.user.email;
    $('#gate').classList.add('hide');
    $('#app').classList.remove('hide');
    showTab(tabFromHash());
}

// ---------------------------------------------------------------------------
// Điều hướng
// ---------------------------------------------------------------------------

const tabFromHash = () => (PAGES[window.location.hash.slice(1)] ? window.location.hash.slice(1) : 'overview');

function setActions(html = '') {
    $('#page-actions').innerHTML = html;
}

async function showTab(tab) {
    view.tab = tab;
    if (window.location.hash.slice(1) !== tab) history.replaceState(null, '', `#${tab}`);
    document.querySelectorAll('.sidebar [data-tab]').forEach(button => button.setAttribute('aria-current', String(button.dataset.tab === tab)));
    document.body.classList.remove('nav-open');
    $('#page-title').textContent = PAGES[tab].title;
    $('#page-subtitle').textContent = PAGES[tab].subtitle;
    document.title = `${PAGES[tab].title} | Hanabi quản trị`;
    setActions();
    stopPlayer();
    panel.innerHTML = skeleton();
    await run(() => ({ overview: renderOverview, scripts: renderScripts, replies: renderReplies, users: renderUsers,
        music: () => renderLibrary('music'), images: () => renderLibrary('images') })[tab]());
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
            toast(e.message, 'error');
            if (panel.querySelector('.skeleton')) panel.innerHTML = emptyState('fa-triangle-exclamation', 'Không tải được', escapeHtml(e.message));
        }
    }
}

const refresh = () => showTab(view.tab);

function setCount(name, value) {
    const badge = document.querySelector(`.sidebar [data-count="${name}"]`);
    if (badge) badge.textContent = value ? number(value) : '';
}

// ---------------------------------------------------------------------------
// Bảng điều khiển
// ---------------------------------------------------------------------------

function kpi(icon, tone, value, label, note, tab) {
    return `<button type="button" class="card kpi" data-go="${tab}">
        <span class="kpi__icon kpi__icon--${tone}"><i class="fas ${icon}"></i></span>
        <span class="kpi__label">${label}</span>
        <strong class="kpi__value">${number(value)}</strong>
        <span class="kpi__note">${note}</span>
    </button>`;
}

async function renderOverview() {
    setActions(`<button type="button" class="btn" data-action="refresh"><i class="fas fa-rotate"></i><span>Làm mới</span></button>`);
    const data = await api('overview');
    const c = data.counts;
    ['scripts', 'users', 'replies'].forEach(name => setCount(name, c[name]));
    const recentScripts = data.scripts.map(s => `<li data-id="${escapeHtml(s.id)}" data-action="detail" tabindex="0">
        <span class="thumb">${s.image ? `<img src="configs/${encodeURIComponent(s.id)}.jpg?v=${s.updated}" alt="" loading="lazy">` : '<i class="fas fa-wand-magic-sparkles"></i>'}</span>
        <div><strong>${escapeHtml(s.title)}</strong><small>${escapeHtml(s.owners || s.author || 'Khách')}</small></div>
        <time>${when(s.updated)}</time></li>`);
    const recentUsers = data.users.map(u => `<li>${avatar(u, 'avatar--sm')}
        <div><strong>${escapeHtml(u.name || u.email)}</strong><small>${escapeHtml(u.email)}</small></div>
        <time>${when(u.created)}</time></li>`);
    panel.innerHTML = `
        <div class="kpis">
            ${kpi('fa-wand-magic-sparkles', 'violet', c.scripts, 'Kịch bản', `+${number(c.scriptsWeek)} trong 7 ngày`, 'scripts')}
            ${kpi('fa-users', 'blue', c.users, 'Người dùng', `+${number(c.usersWeek)} trong 7 ngày${c.locked ? ` · ${number(c.locked)} bị khóa` : ''}`, 'users')}
            ${kpi('fa-gift', 'green', c.opens, 'Lượt mở quà', `${number(c.views)} lượt mở link`, 'scripts')}
            ${kpi('fa-heart', 'pink', c.replies, 'Lời cảm ơn', `+${number(c.repliesWeek)} trong 7 ngày`, 'replies')}
        </div>
        <section class="card" id="usage">${skeleton()}</section>
        <div class="grid-2">
            <section class="card">
                <header class="card__head"><h2>Kịch bản mới lưu</h2><button type="button" class="btn btn--sm btn--ghost" data-go="scripts">Xem tất cả</button></header>
                ${recentScripts.length ? `<ul class="recent">${recentScripts.join('')}</ul>` : emptyState('fa-wand-magic-sparkles', 'Chưa có kịch bản nào')}
            </section>
            <section class="card">
                <header class="card__head"><h2>Người dùng mới</h2><button type="button" class="btn btn--sm btn--ghost" data-go="users">Xem tất cả</button></header>
                ${recentUsers.length ? `<ul class="recent">${recentUsers.join('')}</ul>` : emptyState('fa-users', 'Chưa có ai đăng nhập')}
            </section>
        </div>
        <p class="footnote">${number(c.sessions)} phiên đăng nhập còn hạn · ${number(c.previews)} bản Xem thử tạm (tự xóa sau 1 ngày)</p>`;
    renderUsage();
}

// Hạn mức Cloudflare hôm nay: đọc riêng (gọi Cloudflare mất vài giây), không bắt cả trang chờ
async function renderUsage() {
    const box = document.getElementById('usage');
    if (!box) return;
    box.innerHTML = skeleton();
    let data;
    try {
        data = await api('usage');
    } catch (e) {
        box.innerHTML = `<header class="card__head"><h2>Hạn mức Cloudflare hôm nay</h2></header>${emptyState('fa-triangle-exclamation', 'Không đọc được số liệu', escapeHtml(e.message))}`;
        return;
    }
    if (!document.body.contains(box)) return;
    if (!data.configured) {
        box.innerHTML = `
            <header class="card__head"><div><h2>Hạn mức Cloudflare hôm nay</h2><p class="muted">Chưa kết nối số liệu Cloudflare</p></div></header>
            <ol class="steps">
                <li>Mở <a href="https://dash.cloudflare.com/" target="_blank" rel="noopener">dash.cloudflare.com</a>, chép <b>Account ID</b>
                    (trang Workers &amp; Pages, cột bên phải; hoặc dãy 32 ký tự trên thanh địa chỉ).</li>
                <li>Vào <b>Manage account → Account API tokens → Create Token → Custom token</b>, quyền
                    <b>Account → Account Analytics → Read</b>, tạo rồi chép token.</li>
                <li>Mở Worker <b>firework → Settings → Variables and Secrets → Add</b>, loại <b>Secret</b>:
                    <code>CF_ACCOUNT_ID</code> = Account ID, <code>CF_API_TOKEN</code> = token. Lưu xong tải lại trang này.</li>
            </ol>`;
        return;
    }
    const reset = Math.max(0, new Date(data.resetAt).getTime() - Date.now());
    const meters = data.items.map(item => {
        const value = item.unit === 'bytes' ? bytes : number;
        if (item.used === null) {
            return `<div class="meter"><div class="meter__top"><span>${item.label}</span><strong class="muted">Không đọc được</strong></div>
                <div class="meter__bar"></div><small title="${escapeHtml(item.error)}">${escapeHtml(item.hint)}</small></div>`;
        }
        const percent = Math.min(100, (item.used / item.limit) * 100);
        const tone = percent >= 85 ? 'bad' : percent >= 60 ? 'warn' : 'ok';
        return `<div class="meter">
            <div class="meter__top"><span>${item.label}</span><strong>${value(item.used)} <small>/ ${value(item.limit)}</small></strong></div>
            <div class="meter__bar" role="progressbar" aria-valuenow="${Math.round(percent)}" aria-valuemin="0" aria-valuemax="100" aria-label="${item.label}">
                <i class="is-${tone}" style="width: ${Math.max(percent, item.used ? 1 : 0)}%"></i></div>
            <small>${escapeHtml(item.hint)} · ${percent < 0.1 && item.used ? '<0,1' : percent.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%</small>
        </div>`;
    });
    box.innerHTML = `
        <header class="card__head">
            <div><h2>Hạn mức Cloudflare hôm nay</h2>
                <p class="muted">Gói miễn phí · đặt lại lúc 7:00 sáng (còn ${Math.floor(reset / 3600000)} giờ ${Math.floor(reset / 60000) % 60} phút) ·
                    số liệu lúc ${new Date(data.at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</p></div>
            <button type="button" class="btn btn--sm btn--ghost" data-action="refresh-usage"><i class="fas fa-rotate"></i><span>Cập nhật</span></button>
        </header>
        <div class="meters">${meters.join('')}</div>
        <p class="footnote">Hanabi không gửi email nên không có hạn mức email. Số liệu Cloudflare thường chậm vài phút.</p>`;
}

// ---------------------------------------------------------------------------
// Kịch bản
// ---------------------------------------------------------------------------

function openState(s) {
    if (s.opens) return `<span class="pill pill--ok"><i class="fas fa-gift"></i> Đã mở quà${s.opens > 1 ? ` · ${number(s.opens)}` : ''}</span>`;
    if (s.views) return `<span class="pill pill--warn"><i class="fas fa-link"></i> Đã mở link</span>`;
    return '<span class="pill">Chưa mở</span>';
}

function scriptRow(s) {
    return `<tr data-id="${escapeHtml(s.id)}" data-title="${escapeHtml(s.title)}">
        <td data-label="Kịch bản"><div class="cell-main">
            <span class="thumb">${s.image ? `<img src="configs/${encodeURIComponent(s.id)}.jpg?v=${s.updated}" alt="" loading="lazy">` : '<i class="fas fa-wand-magic-sparkles"></i>'}</span>
            <div><button type="button" class="link" data-action="detail">${escapeHtml(s.title)}</button><code>${escapeHtml(s.id)}</code></div>
        </div></td>
        <td data-label="Người tạo">${s.author ? escapeHtml(s.author) : dash}</td>
        <td data-label="Tài khoản">${s.owners ? escapeHtml(s.owners) : '<span class="muted">Khách</span>'}</td>
        <td data-label="Trạng thái">${openState(s)}</td>
        <td data-label="Cảm ơn" class="num">${s.replies ? number(s.replies) : dash}</td>
        <td data-label="Cập nhật" class="nowrap">${when(s.updated)}</td>
        <td class="actions">
            <a class="btn btn--icon btn--ghost" href="s/${encodeURIComponent(s.id)}" target="_blank" rel="noopener" title="Xem màn trình diễn" aria-label="Xem màn trình diễn"><i class="fas fa-arrow-up-right-from-square"></i></a>
            ${iconButton('detail', 'fa-circle-info', 'Chi tiết')}
            ${iconButton('delete-script', 'fa-trash-can', 'Xóa kịch bản', ' btn--danger')}
        </td>
    </tr>`;
}

async function renderScripts() {
    const v = view.scripts;
    const data = await api('scripts', { q: v.q, user: v.user, page: v.page });
    if (!v.q && !v.user) setCount('scripts', data.total);
    panel.innerHTML = `
        <div class="toolbar">
            ${searchBox('scripts', v.q, 'Tìm theo tên, tiêu đề, người tạo')}
            ${v.user ? `<span class="chip"><i class="fas fa-user"></i> ${escapeHtml(v.userLabel)}<button type="button" data-action="clear-user" aria-label="Bỏ lọc"><i class="fas fa-xmark"></i></button></span>` : ''}
            <span class="toolbar__count">${number(data.total)} kịch bản</span>
        </div>
        ${data.items.length ? table([['Kịch bản'], ['Người tạo'], ['Tài khoản'], ['Trạng thái'], ['Cảm ơn', 'num'], ['Cập nhật'], ['', 'actions']], data.items.map(scriptRow))
            : emptyState('fa-wand-magic-sparkles', v.q || v.user ? 'Không có kịch bản nào khớp' : 'Chưa có kịch bản nào')}
        ${pager(data)}`;
}

function replyItem(reply, author) {
    return `<li data-n="${reply.n}" data-id="${escapeHtml(reply.id)}">
        ${avatar({ name: reply.name || 'N' }, 'avatar--sm')}
        <div class="reply__body">
            <p class="reply__who"><b>${escapeHtml(reply.name || 'Người nhận')}</b> cảm ơn ${author ? `<b>${escapeHtml(author)}</b>` : 'người tặng'}
                <span class="muted">· ${formatWhen(reply.t)}</span></p>
            <blockquote>${escapeHtml(reply.message)}</blockquote>
        </div>
        ${iconButton('delete-reply', 'fa-trash-can', 'Xóa lời cảm ơn', ' btn--danger')}
    </li>`;
}

async function openScript(id) {
    const d = await api('script', { id });
    const c = d.config;
    const o = d.opens;
    const words = ['subtitle', 'introMessage', 'outroMessage'].map(key => c[key]).filter(value => typeof value === 'string' && value.trim());
    modal({
        title: c.title || id,
        size: 'modal--wide',
        body: `
            <div class="detail" data-id="${escapeHtml(id)}" data-title="${escapeHtml(c.title || id)}">
                <dl class="facts">
                    <div><dt>Tên link</dt><dd><code>${escapeHtml(id)}</code></dd></div>
                    <div><dt>Người tặng</dt><dd>${escapeHtml(c.author || '—')}</dd></div>
                    <div><dt>Người nhận</dt><dd>${escapeHtml(c.recipient || '—')}</dd></div>
                    <div><dt>Tài khoản</dt><dd>${d.owners.length ? d.owners.map(u => escapeHtml(u.email)).join(', ') : 'Khách (không đăng nhập)'}</dd></div>
                    <div><dt>Phát bắn</dt><dd>${number((c.events || []).length)}</dd></div>
                    <div><dt>Lưu lúc</dt><dd>${when(d.updated)}</dd></div>
                    <div><dt>Mở link</dt><dd>${number(o && o.counts.view)} lần</dd></div>
                    <div><dt>Mở quà</dt><dd>${number(o && o.counts.open)} lần${o && o.counts.finish ? ` · xem hết ${number(o.counts.finish)}` : ''}</dd></div>
                </dl>
                ${words.length ? `<h3>Lời chúc</h3><blockquote class="quote">${words.map(escapeHtml).join('<br>')}</blockquote>` : ''}
                <h3>Lời cảm ơn (${d.replies.length})</h3>
                ${d.replies.length ? `<ul class="replies">${d.replies.map(r => replyItem({ ...r, id }, c.author)).join('')}</ul>`
                    : '<p class="muted">Người nhận chưa gửi lời cảm ơn.</p>'}
            </div>`,
        actions: [{ id: 'open', label: '<i class="fas fa-arrow-up-right-from-square"></i> Xem màn trình diễn' },
            { id: 'delete', label: '<i class="fas fa-trash-can"></i> Xóa kịch bản', kind: 'danger' }]
    }).then(answer => {
        if (answer === 'open') window.open(`s/${encodeURIComponent(id)}`, '_blank', 'noopener');
        if (answer === 'delete') run(() => deleteScript(id, c.title || id));
    });
}

async function deleteScript(id, title) {
    const ok = await confirmBox({
        title: 'Xóa kịch bản?',
        message: `<b>${escapeHtml(title)}</b> (<code>${escapeHtml(id)}</code>) sẽ bị xóa cùng ảnh, nhạc chỉ kịch bản này dùng, lượt mở và lời cảm ơn. Không hoàn tác được.`,
        confirm: 'Xóa kịch bản'
    });
    if (!ok) return;
    await api('deleteScript', { id });
    toast(`Đã xóa kịch bản ${id}.`);
    refresh();
}

// ---------------------------------------------------------------------------
// Lời cảm ơn: gom theo kịch bản
// ---------------------------------------------------------------------------

async function renderReplies() {
    const data = await api('replies', { page: view.replies.page });
    const groups = data.items.map(group => `
        <section class="card reply-group" data-id="${escapeHtml(group.id)}" data-title="${escapeHtml(group.title)}">
            <header class="reply-group__head">
                <div>
                    <button type="button" class="link reply-group__title" data-action="detail">${escapeHtml(group.title)}</button>
                    <p class="muted"><i class="fas fa-gift"></i> ${group.author ? `<b>${escapeHtml(group.author)}</b>` : 'Người tặng'} tặng
                        ${group.recipient ? `<b>${escapeHtml(group.recipient)}</b>` : 'người nhận'}${group.owners ? ` · tài khoản ${escapeHtml(group.owners)}` : ' · khách'}
                        · <code>${escapeHtml(group.id)}</code></p>
                </div>
                <span class="pill">${number(group.total)} lời cảm ơn</span>
            </header>
            <ul class="replies">${group.replies.map(reply => replyItem(reply, group.author)).join('')}</ul>
        </section>`);
    panel.innerHTML = `
        <div class="toolbar"><span class="toolbar__count">${number(data.total)} kịch bản có lời cảm ơn, mới nhất trước</span></div>
        ${groups.length ? groups.join('') : emptyState('fa-heart', 'Chưa có lời cảm ơn nào', 'Người nhận bấm ♥ trong màn trình diễn để gửi lời cảm ơn cho người tặng.')}
        ${pager(data)}`;
}

async function deleteReply(item) {
    const ok = await confirmBox({ title: 'Xóa lời cảm ơn?', message: 'Người tặng sẽ không còn thấy lời này.', confirm: 'Xóa' });
    if (!ok) return;
    await api('deleteReply', { n: Number(item.dataset.n) });
    toast('Đã xóa lời cảm ơn.');
    refresh();
}

// ---------------------------------------------------------------------------
// Người dùng
// ---------------------------------------------------------------------------

function userRow(u) {
    const state = u.admin ? '<span class="pill pill--accent"><i class="fas fa-shield-halved"></i> Quản trị</span>'
        : u.locked ? '<span class="pill pill--bad"><i class="fas fa-lock"></i> Đã khóa</span>' : '<span class="pill pill--ok">Hoạt động</span>';
    const actions = u.admin ? '' : `
        <button type="button" class="btn btn--sm" data-action="lock-user">${u.locked ? '<i class="fas fa-lock-open"></i> Mở khóa' : '<i class="fas fa-lock"></i> Khóa'}</button>
        ${iconButton('delete-user', 'fa-trash-can', 'Xóa tài khoản', ' btn--danger')}`;
    return `<tr data-id="${escapeHtml(u.id)}" data-email="${escapeHtml(u.email)}" data-scripts="${u.scripts}" data-locked="${u.locked ? 1 : 0}" class="${u.locked ? 'is-dim' : ''}">
        <td data-label="Người dùng"><div class="cell-main">${avatar(u)}<div><strong>${escapeHtml(u.name || u.email)}</strong><small>${escapeHtml(u.email)}</small></div></div></td>
        <td data-label="Trạng thái">${state}</td>
        <td data-label="Kịch bản" class="num">${u.scripts ? `<button type="button" class="link" data-action="user-scripts">${number(u.scripts)}</button>` : dash}</td>
        <td data-label="Tham gia" class="nowrap">${when(u.created)}</td>
        <td data-label="Đăng nhập gần nhất" class="nowrap">${when(u.seen)}</td>
        <td class="actions">${actions}</td>
    </tr>`;
}

async function renderUsers() {
    const v = view.users;
    const data = await api('users', { q: v.q, page: v.page });
    if (!v.q) setCount('users', data.total);
    panel.innerHTML = `
        <div class="toolbar">
            ${searchBox('users', v.q, 'Tìm theo email, tên')}
            <span class="toolbar__count">${number(data.total)} người dùng</span>
        </div>
        ${data.items.length ? table([['Người dùng'], ['Trạng thái'], ['Kịch bản', 'num'], ['Tham gia'], ['Đăng nhập gần nhất'], ['', 'actions']], data.items.map(userRow))
            : emptyState('fa-users', v.q ? 'Không có ai khớp' : 'Chưa có ai đăng nhập')}
        ${pager(data)}`;
}

async function lockUser(row) {
    const locked = row.dataset.locked !== '1';
    if (locked) {
        const ok = await confirmBox({
            title: 'Khóa tài khoản?',
            message: `<b>${escapeHtml(row.dataset.email)}</b> bị đăng xuất trên mọi máy và không đăng nhập lại được. Kịch bản của họ vẫn còn.`,
            confirm: 'Khóa tài khoản'
        });
        if (!ok) return;
    }
    await api('lockUser', { id: row.dataset.id, locked });
    toast(locked ? `Đã khóa ${row.dataset.email}.` : `Đã mở khóa ${row.dataset.email}.`);
    refresh();
}

async function deleteUser(row) {
    const { id, email } = row.dataset;
    const count = Number(row.dataset.scripts);
    const ok = await confirmBox({
        title: 'Xóa tài khoản?',
        message: `Tên, email của <b>${escapeHtml(email)}</b> và danh sách kịch bản tài khoản giữ hộ bị xóa. Không hoàn tác được.`,
        check: count ? `Xóa luôn ${number(count)} kịch bản của tài khoản này (bỏ chọn thì kịch bản vẫn xem được bằng link)` : '',
        confirm: 'Xóa tài khoản'
    });
    if (!ok) return;
    // Nhiều kịch bản: máy chủ xóa từng đợt, gọi tiếp tới khi xong
    for (let round = 0; round < 200; round++) {
        const result = await api('deleteUser', { id, scripts: ok.checked });
        if (!result.remaining) break;
        toast('Đang xóa kịch bản...', 'info');
    }
    toast(`Đã xóa tài khoản ${email}.`);
    refresh();
}

// ---------------------------------------------------------------------------
// Kho nhạc, kho ảnh
// ---------------------------------------------------------------------------

const toggle = item => `<button type="button" class="switch" role="switch" aria-checked="${!item.hidden}" data-action="toggle-item"
    title="${item.hidden ? 'Đang ẩn khỏi builder: bấm để hiện' : 'Đang hiện trong builder: bấm để ẩn'}"><span></span></button>`;
const sourcePill = item => (item.uploaded ? '<span class="pill pill--accent">Tự thêm</span>' : '<span class="pill">Có sẵn</span>');
const usedText = item => (item.used ? `${number(item.used)} kịch bản` : dash);
const tags = item => ((item.tags || []).length ? `<div class="tags">${item.tags.map(tag => `<span>${escapeHtml(tag)}</span>`).join('')}</div>` : dash);

function itemActions(item) {
    return `${iconButton('edit-item', 'fa-pen', 'Sửa')}
        ${item.uploaded ? `<button type="button" class="btn btn--icon btn--ghost btn--danger" data-action="delete-item" ${item.used
            ? 'disabled title="Đang có kịch bản dùng: hãy ẩn thay vì xóa"' : 'title="Xóa khỏi kho"'} aria-label="Xóa"><i class="fas fa-trash-can"></i></button>` : ''}`;
}

function musicRow(item) {
    return `<tr data-id="${escapeHtml(item.id)}" data-kind="music" class="${item.hidden ? 'is-dim' : ''}">
        <td data-label="Bài nhạc"><div class="cell-main">
            <button type="button" class="play" data-action="play" data-url="library/music/${encodeURIComponent(item.file)}" aria-label="Nghe thử"><i class="fas fa-play"></i></button>
            <div><strong>${escapeHtml(item.name || item.id)}</strong><small>${escapeHtml(item.artist || '')}</small></div>
        </div></td>
        <td data-label="Nhãn">${tags(item)}</td>
        <td data-label="Thời lượng" class="num">${item.duration ? minutes(item.duration) : dash}</td>
        <td data-label="Nguồn">${sourcePill(item)}</td>
        <td data-label="Đang dùng" class="nowrap">${usedText(item)}</td>
        <td data-label="Hiện trong builder">${toggle(item)}</td>
        <td class="actions">${itemActions(item)}</td>
    </tr>`;
}

function imageCard(item) {
    return `<article class="card media-card ${item.hidden ? 'is-dim' : ''}" data-id="${escapeHtml(item.id)}" data-kind="images">
        <img src="library/images/${encodeURIComponent(item.file)}" alt="" loading="lazy">
        <div class="media-card__body">
            <strong>${escapeHtml(item.name || item.id)}</strong>
            ${tags(item)}
            <small>${item.uploaded ? 'Tự thêm' : 'Có sẵn'} · ${item.used ? `${number(item.used)} kịch bản dùng` : 'chưa ai dùng'}</small>
        </div>
        <footer class="media-card__foot">${toggle(item)}<span class="muted">${item.hidden ? 'Đang ẩn' : 'Đang hiện'}</span><span class="spacer"></span>${itemActions(item)}</footer>
    </article>`;
}

async function renderLibrary(kind) {
    const music = kind === 'music';
    setActions(`<button type="button" class="btn btn--primary" data-action="add-item" data-kind="${kind}"><i class="fas fa-plus"></i><span>Thêm ${music ? 'bài nhạc' : 'ảnh'}</span></button>`);
    const data = await api('library', { kind });
    view.library[kind] = data.items;
    const hidden = data.items.filter(item => item.hidden).length;
    const list = !data.items.length ? emptyState(music ? 'fa-music' : 'fa-image', 'Kho trống')
        : music ? table([['Bài nhạc'], ['Nhãn'], ['Thời lượng', 'num'], ['Nguồn'], ['Đang dùng'], ['Hiện'], ['', 'actions']], data.items.map(musicRow))
            : `<div class="media-grid">${data.items.map(imageCard).join('')}</div>`;
    panel.innerHTML = `
        <div class="toolbar"><span class="toolbar__count">${number(data.items.length)} ${music ? 'bài' : 'ảnh'}${hidden ? ` · ${number(hidden)} đang ẩn` : ''}
            · mục ẩn không hiện trong builder, quà đang dùng vẫn phát được</span></div>
        ${list}`;
}

// Ô nhập của một mục kho (thêm mới hoặc sửa)
function itemFields(kind, item = {}) {
    const field = (name, label, attrs = '', wide = false) =>
        `<label class="field${wide ? ' field--wide' : ''}"><span>${label}</span><input name="${name}" value="${escapeHtml(item[name] ?? '')}" ${attrs}></label>`;
    const tagField = `<label class="field"><span>Nhãn <small>cách nhau dấu phẩy</small></span>
        <input name="tags" value="${escapeHtml((item.tags || []).join(', '))}" placeholder="${kind === 'music' ? 'Sinh nhật, Vui tươi' : 'Sinh nhật, Tình yêu'}"></label>`;
    return kind === 'music'
        ? field('name', 'Tên bài', 'maxlength="80" required') + field('artist', 'Nghệ sĩ, nguồn thu', 'maxlength="80"') + tagField
            + field('license', 'Giấy phép', 'maxlength="80"') + field('source', 'Link nguồn', 'type="url" maxlength="300" placeholder="https://..."', true)
        : field('name', 'Tên ảnh', 'maxlength="80" required') + tagField;
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

function addItem(kind) {
    const music = kind === 'music';
    modal({
        title: music ? 'Thêm bài nhạc' : 'Thêm ảnh',
        body: `<form id="modal-form" class="form">
            <label class="dropzone">
                <input type="file" name="file" accept="${music ? 'audio/mpeg,audio/mp4,audio/ogg,audio/wav,.mp3,.m4a,.ogg,.wav' : 'image/jpeg,image/png,image/webp,image/gif'}" required>
                <i class="fas ${music ? 'fa-music' : 'fa-image'}"></i>
                <strong>Chọn file ${music ? 'nhạc' : 'ảnh'}</strong>
                <small>${music ? 'MP3, M4A, OGG, WAV · tối đa 20 MB' : 'JPG, PNG, WEBP, GIF · tối đa 10 MB · nên vuông khoảng 1024×1024'}</small>
            </label>
            <div class="form__grid">${itemFields(kind, music ? { license: 'Phạm vi công cộng' } : {})}</div>
            <p class="muted">${music ? 'Chỉ thêm nhạc được dùng tự do (phạm vi công cộng, giấy phép mở) hoặc nhạc bạn có quyền.' : 'Chỉ thêm ảnh bạn có quyền dùng.'}</p>
        </form>`,
        actions: [{ id: 'cancel', label: 'Hủy' }, { id: 'save', label: '<i class="fas fa-upload"></i> Thêm vào kho', kind: 'primary', submit: true }],
        onSubmit: async form => {
            const data = new FormData(form);
            const file = data.get('file');
            if (!file || !file.size) throw new Error('Chưa chọn file.');
            data.append('kind', kind);
            if (music) data.append('duration', String(await audioDuration(file)));
            await post('api/admin.php?action=libraryAdd', data, true);
            toast(`Đã thêm "${data.get('name')}" vào kho.`);
            refresh();
        }
    });
}

function editItem(kind, id) {
    const item = view.library[kind].find(entry => entry.id === id);
    modal({
        title: `Sửa "${item.name || item.id}"`,
        body: `<form id="modal-form" class="form"><div class="form__grid">${itemFields(kind, item)}</div></form>`,
        actions: [{ id: 'cancel', label: 'Hủy' }, { id: 'save', label: 'Lưu', kind: 'primary', submit: true }],
        onSubmit: async form => {
            await api('libraryUpdate', { kind, id, ...Object.fromEntries(new FormData(form).entries()) });
            toast('Đã lưu.');
            refresh();
        }
    });
}

async function toggleItem(kind, id) {
    const item = view.library[kind].find(entry => entry.id === id);
    await api('libraryUpdate', { kind, id, hidden: !item.hidden });
    toast(item.hidden ? `Đã hiện "${item.name}" trong builder.` : `Đã ẩn "${item.name}" khỏi builder. Quà đang dùng vẫn phát được.`);
    refresh();
}

async function deleteItem(kind, id) {
    const item = view.library[kind].find(entry => entry.id === id);
    const ok = await confirmBox({ title: 'Xóa khỏi kho?', message: `<b>${escapeHtml(item.name)}</b> sẽ bị xóa hẳn cùng file. Không hoàn tác được.`, confirm: 'Xóa' });
    if (!ok) return;
    await api('libraryDelete', { kind, id });
    toast(`Đã xóa "${item.name}".`);
    refresh();
}

function togglePlay(button) {
    const url = button.dataset.url;
    const same = player && player.src.endsWith(url) && !player.paused;
    stopPlayer();
    if (same) return;
    player = new Audio(url);
    player.play().catch(() => toast('Không phát được bài này.', 'error'));
    button.classList.add('is-playing');
    button.querySelector('i').className = 'fas fa-pause';
    player.onended = stopPlayer;
}

function stopPlayer() {
    if (player) player.pause();
    player = null;
    document.querySelectorAll('.play').forEach(button => {
        button.classList.remove('is-playing');
        button.querySelector('i').className = 'fas fa-play';
    });
}

// ---------------------------------------------------------------------------
// Bấm, gõ, gửi form
// ---------------------------------------------------------------------------

const actions = {
    refresh: () => refresh(),
    'refresh-usage': () => renderUsage(),
    detail: row => openScript(row.dataset.id),
    'delete-script': row => deleteScript(row.dataset.id, row.dataset.title || row.dataset.id),
    'delete-reply': row => deleteReply(row),
    'lock-user': row => lockUser(row),
    'delete-user': row => deleteUser(row),
    'user-scripts': row => {
        Object.assign(view.scripts, { user: row.dataset.id, userLabel: row.dataset.email, q: '', page: 1 });
        return showTab('scripts');
    },
    'clear-user': () => {
        Object.assign(view.scripts, { user: '', userLabel: '', page: 1 });
        return refresh();
    },
    play: (row, button) => togglePlay(button),
    'add-item': (row, button) => addItem(button.dataset.kind),
    'edit-item': row => editItem(row.dataset.kind, row.dataset.id),
    'toggle-item': row => toggleItem(row.dataset.kind, row.dataset.id),
    'delete-item': row => deleteItem(row.dataset.kind, row.dataset.id)
};

document.addEventListener('click', e => {
    const target = e.target;
    const go = target.closest('[data-tab], [data-go]');
    if (go) {
        if (dialog.open) closeModal();
        showTab(go.dataset.tab || go.dataset.go);
        return;
    }
    if (target.closest('[data-open-nav]')) {
        document.body.classList.add('nav-open');
        return;
    }
    if (target.closest('[data-close-nav]')) {
        document.body.classList.remove('nav-open');
        return;
    }
    if (target.closest('[data-modal-close]')) {
        closeModal();
        return;
    }
    const answer = target.closest('[data-modal-action]');
    if (answer) {
        closeModal(answer.dataset.modalAction);
        return;
    }
    const page = target.closest('[data-page]');
    if (page) {
        view[view.tab].page = Number(page.dataset.page);
        refresh();
        return;
    }
    const button = target.closest('[data-action]');
    if (!button || button.disabled || !actions[button.dataset.action]) return;
    const row = button.closest('[data-n]') || button.closest('[data-id]');
    run(() => actions[button.dataset.action](row, button));
});

// Hàng gần đây ở Bảng điều khiển: Enter mở chi tiết như bấm chuột
document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.matches('li[data-action]')) e.target.click();
});

// Tìm kiếm: gõ xong (dừng 350 ms) thì tìm
let searchTimer = null;
document.addEventListener('input', e => {
    const name = e.target.dataset.search;
    if (!name) return;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
        Object.assign(view[name], { q: e.target.value.trim(), page: 1 });
        run(async () => {
            await ({ scripts: renderScripts, users: renderUsers })[name]();
            const input = panel.querySelector(`[data-search="${name}"]`);
            input.focus();
            input.setSelectionRange(input.value.length, input.value.length);
        });
    }, 350);
});

document.addEventListener('submit', async e => {
    if (e.target.id !== 'modal-form') return;
    e.preventDefault();
    const open = current;
    if (!open || !open.onSubmit) return;
    const buttons = [...document.querySelectorAll('#modal-foot button')];
    buttons.forEach(button => { button.disabled = true; });
    try {
        await open.onSubmit(e.target);
        closeModal('submit');
    } catch (err) {
        toast(err.message, 'error');
    } finally {
        buttons.forEach(button => { button.disabled = false; });
    }
});

// Chọn file để thêm vào kho: ô chọn ghi tên file
document.addEventListener('change', e => {
    const zone = e.target.closest('.dropzone');
    if (zone && e.target.files && e.target.files[0]) zone.querySelector('strong').textContent = e.target.files[0].name;
});

// Hộp thoại đóng bằng Esc, bấm ra ngoài. Không dựa vào sự kiện close: sự kiện này tới muộn, lúc hộp thoại đã mở lại cho
// bước sau (vd Chi tiết -> Xóa kịch bản -> hỏi lại) sẽ đóng nhầm hộp mới
dialog.addEventListener('cancel', e => {
    e.preventDefault();
    closeModal();
});
dialog.addEventListener('click', e => {
    if (e.target === dialog) closeModal();
});

$('#btn-logout').addEventListener('click', logout);
$('#gate-logout').addEventListener('click', logout);
window.addEventListener('hashchange', () => {
    if (!$('#app').classList.contains('hide') && tabFromHash() !== view.tab) showTab(tabFromHash());
});

start();
