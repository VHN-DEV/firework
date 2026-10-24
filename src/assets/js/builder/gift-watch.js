/*!
 * Hanabi – builder (báo mở quà)
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Báo khi người nhận mở quà: trạng thái, bật thông báo, kiểm tra định kỳ.

import { copyText } from '../share-targets.js';
import { describeOpenStatus, fetchOpenStatus, formatWhen, getOwnerKeys, lastEvent, replyAuthor, trackingUrl } from '../gift-tracking.js';
import { isStaticEnv, state } from './state.js';
import { escapeHtml, notify } from './util.js';
import { share } from './share.js';

const OPEN_SEEN_KEY = 'firework_open_seen';
// Lời cảm ơn đã báo: tên kịch bản -> thời điểm lời mới nhất đã báo
const REPLY_SEEN_KEY = 'firework_reply_seen';

// Trạng thái gần nhất của các món quà của mình: tên kịch bản -> trạng thái
const giftStatuses = new Map();

let giftCheckAt = 0;

// Lượt hỏi đang chạy: gọi thêm thì dùng chung, không chạy song song (tránh báo một lượt mở hai lần)
let giftCheck = null;

export function renderNotifyOpen() {
    const toggle = document.getElementById('notify-open');
    if (!toggle) return;
    toggle.checked = state.notifyOpen;
    toggle.disabled = isStaticEnv;
    document.getElementById('notify-open-hint').textContent = isStaticEnv
        ? 'Cần bản có máy chủ PHP (bản tĩnh như GitHub Pages không báo được)'
        : state.notifyOpen ? 'Xem trong hộp Chia sẻ sau khi lưu' : 'Đang tắt: người nhận mở quà sẽ không được ghi lại';
}

export function renderAllowReply() {
    const toggle = document.getElementById('allow-reply');
    if (!toggle) return;
    toggle.checked = state.allowReply;
    toggle.disabled = isStaticEnv;
    document.getElementById('allow-reply-hint').textContent = isStaticEnv
        ? 'Cần bản có máy chủ (bản tĩnh như GitHub Pages không nhận được)'
        : state.allowReply ? 'Người nhận bấm ♥ để gửi, bạn đọc trong hộp Chia sẻ' : 'Đang tắt: người nhận không thấy nút gửi lời cảm ơn';
}

// Lời cảm ơn của người nhận, mới nhất trước
function renderReplies(status) {
    const box = document.getElementById('share-track-replies');
    const replies = (status && status.ok && status.replies) || [];
    box.classList.toggle('hide', !replies.length);
    box.querySelector('strong').textContent = `💌 Lời cảm ơn (${replies.length})`;
    box.querySelector('ul').innerHTML = [...replies].reverse().map(reply => `<li><p>${escapeHtml(reply.message)}</p>`
        + `<small>${escapeHtml(replyAuthor(reply))} · ${escapeHtml(formatWhen(reply.t))}</small></li>`).join('');
}

function ownedItems(ids) {
    const keys = getOwnerKeys();
    return (ids || Object.keys(keys)).filter(id => keys[id]).slice(0, 100).map(id => ({ id, key: keys[id] }));
}

export async function renderShareTracking() {
    const box = document.getElementById('share-track');
    const key = getOwnerKeys()[share.id];
    const show = !isStaticEnv && (state.notifyOpen || state.allowReply);
    box.classList.toggle('hide', !show);
    renderReplies(null);
    if (!show) return;
    const status = document.getElementById('share-track-status');
    document.getElementById('share-track-link').classList.toggle('hide', !key);
    document.getElementById('share-track-hint').classList.toggle('hide', !key);
    document.getElementById('btn-track-notify').classList.toggle('hide', !key || !('Notification' in window) || Notification.permission !== 'default');
    if (!key) {
        status.textContent = 'Chỉ xem được trên trình duyệt đã lưu kịch bản này lần đầu (hoặc bằng link theo dõi riêng).';
        return;
    }
    document.getElementById('share-track-input').value = trackingUrl(share.id, key);
    status.textContent = 'Đang kiểm tra...';
    try {
        const [item] = await fetchOpenStatus([{ id: share.id, key }]);
        if (item && item.ok) giftStatuses.set(item.id, item);
        const { opened, text } = describeOpenStatus(item);
        status.textContent = state.notifyOpen || !item || !item.ok ? text : 'Không theo dõi lúc người nhận mở quà (đang tắt).';
        renderReplies(item);
        document.getElementById('share-track-icon').textContent = opened ? '🎉' : '🔔';
        box.classList.toggle('is-opened', opened);
    } catch (e) {
        status.textContent = 'Không kết nối được máy chủ để xem trạng thái.';
    }
}

export async function copyTrackingLink() {
    const input = document.getElementById('share-track-input');
    if (await copyText(input.value)) notify('Đã sao chép link theo dõi riêng. Đừng gửi link này cho người nhận!', 'success');
    else input.select();
}

export async function enableOpenNotifications() {
    if (!('Notification' in window)) return;
    const permission = await Notification.requestPermission();
    document.getElementById('btn-track-notify').classList.add('hide');
    notify(permission === 'granted'
        ? 'Đã bật: khi người nhận mở quà, máy này sẽ báo (lúc đang mở trình soạn).'
        : 'Trình duyệt chưa cho phép thông báo. Bạn vẫn xem được trạng thái trong hộp Chia sẻ.', permission === 'granted' ? 'success' : 'warning');
}

// Danh sách "Kịch bản của tôi": nhãn đã mở / chưa mở cho các món quà của mình
export async function showGiftBadges() {
    if (isStaticEnv) return;
    const ids = [...document.querySelectorAll('#scripts-list .script-item')].map(el => el.dataset.id);
    const items = ownedItems(ids);
    if (!items.length) return;
    try {
        (await fetchOpenStatus(items)).forEach(item => {
            if (!item.ok) return;
            giftStatuses.set(item.id, item);
            const el = document.querySelector(`#scripts-list .script-item[data-id="${CSS.escape(item.id)}"] .script-badges`);
            if (!el || el.querySelector('.gift-badge')) return;
            const { opened, text } = describeOpenStatus(item);
            el.insertAdjacentHTML('beforeend', `<span class="gift-badge${opened ? ' is-opened' : ''}" title="${escapeHtml(text)}">`
                + `${opened ? '🎉 Đã mở' : item.counts.view ? '🔗 Đã xem link' : 'Chưa mở'}</span>`);
            if (item.replies && item.replies.length) {
                el.insertAdjacentHTML('beforeend', `<span class="gift-badge is-opened" title="Lời cảm ơn của người nhận">💌 ${item.replies.length}</span>`);
            }
        });
    } catch (e) {
        // Không có máy chủ: bỏ qua nhãn
    }
}

// Hỏi trạng thái mọi món quà của mình; món nào có lượt mở quà mới (kể cả khi builder đang đóng) thì báo một lần
export function checkGiftOpens() {
    if (isStaticEnv) return Promise.resolve();
    if (!giftCheck) giftCheck = runGiftCheck().finally(() => { giftCheck = null; });
    return giftCheck;
}

async function runGiftCheck() {
    giftCheckAt = Date.now();
    const items = ownedItems();
    if (!items.length) return;
    let statuses;
    try {
        statuses = await fetchOpenStatus(items);
    } catch (e) {
        return;
    }
    const load = key => {
        try {
            return JSON.parse(localStorage.getItem(key) || '{}') || {};
        } catch (e) {
            return {};
        }
    };
    const seen = load(OPEN_SEEN_KEY);
    const seenReplies = load(REPLY_SEEN_KEY);
    for (const status of statuses) {
        if (!status.ok) continue;
        giftStatuses.set(status.id, status);
        const opens = status.counts.open || 0;
        if (opens > (seen[status.id] || 0)) await announceGiftOpen(status);
        seen[status.id] = opens;
        const replies = (status.replies || []).filter(reply => reply.t > (seenReplies[status.id] || ''));
        if (replies.length) {
            announceReplies(replies);
            seenReplies[status.id] = replies[replies.length - 1].t;
        }
    }
    try {
        localStorage.setItem(OPEN_SEEN_KEY, JSON.stringify(seen));
        localStorage.setItem(REPLY_SEEN_KEY, JSON.stringify(seenReplies));
    } catch (e) {
        // Lần sau có thể báo lại
    }
}

// Lời cảm ơn mới: báo lời mới nhất (kèm số lời nếu nhiều)
function announceReplies(replies) {
    const last = replies[replies.length - 1];
    const quote = [...last.message].length > 90 ? `${[...last.message].slice(0, 90).join('')}…` : last.message;
    const text = `${replyAuthor(last)} gửi lời cảm ơn: "${quote}"${replies.length > 1 ? ` (và ${replies.length - 1} lời khác)` : ''}`;
    notify(`💌 ${text}`, 'success');
    if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
        new Notification('Bạn có lời cảm ơn 💌', { body: text, icon: document.querySelector('link[rel="icon"]')?.href });
    }
}

async function announceGiftOpen(status) {
    let config = {};
    try {
        config = await (await fetch(`configs/${encodeURIComponent(status.id)}.json`, { cache: 'no-store' })).json();
    } catch (e) {
        // Dùng tên kịch bản
    }
    const open = lastEvent(status, 'open');
    const who = config.recipient || 'Người nhận';
    const text = `${who} đã mở quà "${config.title || status.id}"${open ? ` lúc ${formatWhen(open.t)}` : ''}`;
    notify(`🎉 ${text}`, 'success');
    if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
        new Notification('Món quà đã được mở 🎉', { body: text, icon: document.querySelector('link[rel="icon"]')?.href });
    }
}

export function startGiftWatch() {
    if (isStaticEnv) return;
    setTimeout(checkGiftOpens, 3000);
    setInterval(checkGiftOpens, 60000);
    // Quay lại tab: hỏi ngay (không quá 10 giây một lần)
    window.addEventListener('focus', () => {
        if (Date.now() - giftCheckAt > 10000) checkGiftOpens();
    });
}

// ---------------------------------------------------------------------------
// DÒNG THỜI GIAN THEO GIÂY (timeline-track.js): thước giây, sóng nhạc, kéo thả phát bắn
// ---------------------------------------------------------------------------
