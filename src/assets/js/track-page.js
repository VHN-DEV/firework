/*!
 * Trình diễn Pháo hoa – trang theo dõi mở quà
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// theo-doi.html?id=<tên kịch bản>&key=<mã theo dõi>: người gửi xem người nhận đã mở link, mở quà, xem hết chưa.
// Tự cập nhật mỗi 30 giây; có thể bật thông báo của trình duyệt khi người nhận vừa mở quà (trang phải đang mở).

import { saveOwnerKey, fetchOpenStatus, formatWhen, EVENT_NAMES, DEVICE_NAMES, describeOpenStatus } from './gift-tracking.js';
import { printCopyrightNotice } from './copyright.js';

printCopyrightNotice('Trình diễn Pháo hoa – Theo dõi món quà');

const params = new URLSearchParams(window.location.search);
const id = (params.get('id') || '').toLowerCase();
const key = params.get('key') || '';
const $ = selector => document.querySelector(selector);
let lastOpens = null;
let titleLoaded = false;

function showError(message) {
    $('#gift-error').textContent = message;
    $('#gift-error').classList.remove('hide');
    $('#gift-status').classList.add('hide');
    // Dòng nhỏ phía trên đã ghi "Theo dõi món quà": tiêu đề nói rõ là không xem được
    if (!titleLoaded) $('#gift-title').textContent = 'Không xem được món quà';
}

async function loadTitle() {
    if (titleLoaded) return;
    try {
        const config = await (await fetch(`configs/${encodeURIComponent(id)}.json`, { cache: 'no-store' })).json();
        $('#gift-title').textContent = config.title || id;
        $('#gift-recipient').textContent = config.recipient ? `Gửi ${config.recipient}` : '';
        document.title = `Theo dõi: ${config.title || id}`;
        titleLoaded = true;
    } catch (e) {
        $('#gift-title').textContent = id;
    }
}

function render(status) {
    const { counts = {}, first = {} } = status;
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
        ? history.map(item => `<li><span>${formatWhen(item.t)}</span>${EVENT_NAMES[item.e] || item.e} trên ${DEVICE_NAMES[item.d] || 'máy'}</li>`).join('')
        : '<li class="empty">Chưa có lượt mở nào.</li>';
    $('#gift-status').classList.remove('hide');
    $('#gift-error').classList.add('hide');
}

async function refresh() {
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
}

$('#gift-show').href = `./index.html?config=${encodeURIComponent(id)}`;
const notifyButton = $('#gift-notify');
notifyButton.classList.toggle('hide', !('Notification' in window) || Notification.permission !== 'default');
notifyButton.addEventListener('click', async () => {
    const permission = await Notification.requestPermission();
    notifyButton.classList.add('hide');
    // Chỉ là lời nhắn: không dùng showError (ẩn cả bảng trạng thái tới lần cập nhật sau)
    if (permission !== 'granted') {
        const note = document.createElement('p');
        note.className = 'track-note';
        note.textContent = 'Trình duyệt chưa cho phép thông báo. Trang vẫn tự cập nhật mỗi 30 giây.';
        notifyButton.closest('.track-actions').after(note);
    }
});

refresh();
setInterval(refresh, 30000);
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refresh();
});
