/*!
 * Hanabi – trang theo dõi mở quà
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// theo-doi?id=<tên kịch bản>&key=<mã theo dõi>: người gửi xem người nhận đã mở link, mở quà, xem hết chưa, lời cảm ơn
// người nhận gửi. Tự cập nhật mỗi 30 giây; có thể bật thông báo của trình duyệt khi người nhận vừa mở quà, gửi lời cảm ơn
// (trang phải đang mở).

import { saveOwnerKey, fetchOpenStatus, formatWhen, EVENT_NAMES, DEVICE_NAMES, describeOpenStatus, replyAuthor, lastEvent } from './gift-tracking.js';
import { printCopyrightNotice } from './copyright.js';

printCopyrightNotice('Hanabi – Theo dõi món quà');

const params = new URLSearchParams(window.location.search);
const id = (params.get('id') || '').toLowerCase();
const key = params.get('key') || '';
const $ = selector => document.querySelector(selector);
let lastOpens = null;
let lastReplies = null;
let titleLoaded = false;
// Tên người nhận (nếu người tạo có điền) để câu trạng thái tự nhiên hơn: "Mẹ đã mở quà"
let recipient = '';

const STATES = {
    none: { badge: 'Chưa mở', headline: who => `${who} chưa mở link` },
    view: { badge: 'Đã mở link', headline: who => `${who} đã mở link, chưa mở quà` },
    open: { badge: 'Đã mở quà', headline: who => `${who} đã mở quà` },
    finish: { badge: 'Đã xem hết', headline: who => `${who} đã xem hết màn trình diễn` }
};

function showError(message) {
    $('#gift-error-text').textContent = message;
    $('#gift-error').classList.remove('hide');
    $('#gift-status').classList.add('hide');
    // Dòng nhỏ phía trên đã ghi "Theo dõi món quà": tiêu đề nói rõ là không xem được
    if (!titleLoaded) $('#gift-title').textContent = 'Không xem được món quà';
}

async function loadTitle() {
    if (titleLoaded) return;
    try {
        const config = await (await fetch(`configs/${encodeURIComponent(id)}.json`, { cache: 'no-store' })).json();
        recipient = (config.recipient || '').trim();
        // Để trống tiêu đề thì builder ghi "Kịch bản mới": đặt tên theo người nhận thay vì hiện tên mặc định
        const named = config.title && config.title !== 'Kịch bản mới';
        const title = named ? config.title : recipient ? `Món quà gửi ${recipient}` : 'Món quà của bạn';
        $('#gift-title').textContent = title;
        $('#gift-recipient').textContent = named && recipient ? `Gửi tặng ${recipient}` : '';
        $('#gift-recipient').classList.toggle('hide', !(named && recipient));
        document.title = `Theo dõi: ${title} | Hanabi`;
        titleLoaded = true;
    } catch (e) {
        $('#gift-title').textContent = 'Món quà của bạn';
    }
}

function render(status) {
    const { counts = {}, first = {} } = status;
    const state = counts.finish ? 'finish' : counts.open ? 'open' : counts.view ? 'view' : 'none';
    const latest = state === 'none' ? null : lastEvent(status, state);
    const where = latest ? ` trên ${DEVICE_NAMES[latest.d] || 'máy'}` : '';
    $('#gift-summary').dataset.state = state;
    $('#gift-badge').textContent = STATES[state].badge;
    $('#gift-headline').textContent = STATES[state].headline(recipient || 'Người nhận');
    $('#gift-detail').textContent = state === 'none'
        ? 'Trang sẽ báo ngay khi người nhận mở link bạn gửi.'
        : `Lúc ${formatWhen(first[state])}${where}`
            + (counts.open > 1 ? ` · mở quà ${counts.open} lần` : '');
    $('#gift-updated').textContent = `Cập nhật ${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;

    document.querySelectorAll('.track-steps li').forEach(li => {
        const step = li.dataset.step;
        const done = (counts[step] || 0) > 0;
        li.classList.toggle('done', done);
        li.querySelector('.track-step-time').textContent = done
            ? `${formatWhen(first[step])}${counts[step] > 1 ? ` · ${counts[step]} lần` : ''}`
            : 'Chưa';
    });
    const history = [...(status.events || [])].reverse();
    $('#gift-history').innerHTML = history.length
        ? history.map(item => `<li data-event="${escapeHtml(item.e)}"><span>${escapeHtml(EVENT_NAMES[item.e] || item.e)}`
            + `<small> trên ${DEVICE_NAMES[item.d] || 'máy'}</small></span><time>${formatWhen(item.t)}</time></li>`).join('')
        : '<li class="empty">Chưa có lượt mở nào.</li>';
    const replies = [...(status.replies || [])].reverse();
    $('#gift-replies-box').classList.toggle('hide', !replies.length);
    $('#gift-replies').innerHTML = replies.map(reply => `<li><p>${escapeHtml(reply.message)}</p>`
        + `<span>${escapeHtml(replyAuthor(reply))} · ${formatWhen(reply.t)}</span></li>`).join('');
    $('#gift-status').classList.remove('hide');
    $('#gift-error').classList.add('hide');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}

async function loadStatus() {
    if (!id || !key) {
        showError('Link theo dõi thiếu mã. Hãy mở lại link trong hộp Chia sẻ của trình soạn.');
        return;
    }
    await loadTitle();
    let status;
    try {
        [status] = await fetchOpenStatus([{ id, key }]);
    } catch (e) {
        showError('Không kết nối được máy chủ. Theo dõi mở quà cần bản có máy chủ PHP.');
        return;
    }
    if (!status || !status.ok) {
        showError('Link theo dõi không đúng hoặc kịch bản đã bị xóa.');
        return;
    }
    // Máy này là của người gửi: tự xem màn trình diễn thì không tính là người nhận mở
    saveOwnerKey(id, key);
    render(status);
    const opens = status.counts.open || 0;
    if (lastOpens !== null && opens > lastOpens && 'Notification' in window && Notification.permission === 'granted') {
        new Notification('Món quà đã được mở 🎉', {
            body: describeOpenStatus(status).text,
            icon: $('link[rel="icon"]').href
        });
    }
    lastOpens = opens;
    const replies = (status.replies || []).length;
    if (lastReplies !== null && replies > lastReplies && 'Notification' in window && Notification.permission === 'granted') {
        const reply = status.replies[status.replies.length - 1];
        new Notification('Bạn có lời cảm ơn 💌', { body: `${replyAuthor(reply)}: ${reply.message}`, icon: $('link[rel="icon"]').href });
    }
    lastReplies = replies;
}

// Cập nhật 30 giây một lần và mỗi lần quay lại tab: không chạy chồng, kẻo hai lượt cùng so với số lần mở cũ rồi báo hai lần
// "Món quà đã được mở"
let refreshing = null;

function refresh() {
    if (!refreshing) refreshing = loadStatus().finally(() => { refreshing = null; });
    return refreshing;
}

$('#gift-show').href = `./demo?config=${encodeURIComponent(id)}`;
const notifyButton = $('#gift-notify');
const notifyNote = $('#gift-notify-note');

function showNotifyNote(text) {
    notifyNote.textContent = text;
    notifyNote.classList.remove('hide');
}

if ('Notification' in window && Notification.permission === 'granted') {
    showNotifyNote('Đã bật thông báo: giữ trang này mở để được báo khi người nhận mở quà.');
}
notifyButton.classList.toggle('hide', !('Notification' in window) || Notification.permission !== 'default');
notifyButton.addEventListener('click', async () => {
    // Trình duyệt có thể giữ hộp hỏi khá lâu: không cho bấm chồng (trước đây mỗi lần bấm thêm một dòng báo)
    notifyButton.disabled = true;
    const permission = await Notification.requestPermission();
    notifyButton.disabled = false;
    notifyButton.classList.toggle('hide', permission !== 'default');
    // Chỉ là lời nhắn: không dùng showError (ẩn cả bảng trạng thái tới lần cập nhật sau)
    showNotifyNote(permission === 'granted'
        ? 'Đã bật thông báo: giữ trang này mở để được báo khi người nhận mở quà.'
        : 'Trình duyệt chưa cho phép thông báo. Trang vẫn tự cập nhật mỗi 30 giây.');
});

refresh();
setInterval(refresh, 30000);
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refresh();
});
