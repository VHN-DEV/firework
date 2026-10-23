/*!
 * Hanabi – báo mở quà
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Báo mở quà (bản có máy chủ PHP, api/opens.php): mã theo dõi của các kịch bản do trình duyệt này tạo,
// tra trạng thái người nhận đã mở link / mở quà / xem hết. Dùng chung cho builder, trình phát và trang theo dõi.

// { tên kịch bản: mã theo dõi } của các món quà người dùng trình duyệt này đã tạo (hoặc đã mở trang theo dõi)
export const OWNER_KEYS = 'firework_owner_keys';
export const EVENT_NAMES = { view: 'Mở link', open: 'Mở quà', finish: 'Xem hết' };
export const DEVICE_NAMES = { mobile: 'điện thoại', tablet: 'máy tính bảng', desktop: 'máy tính' };

export function getOwnerKeys() {
    try {
        const keys = JSON.parse(localStorage.getItem(OWNER_KEYS) || '{}');
        return keys && typeof keys === 'object' ? keys : {};
    } catch (e) {
        return {};
    }
}

export function saveOwnerKey(id, key) {
    try {
        const keys = getOwnerKeys();
        keys[id] = key;
        localStorage.setItem(OWNER_KEYS, JSON.stringify(keys));
    } catch (e) {
        // localStorage bị chặn: vẫn dùng được link theo dõi riêng
    }
}

export function removeOwnerKey(id) {
    try {
        const keys = getOwnerKeys();
        delete keys[id];
        localStorage.setItem(OWNER_KEYS, JSON.stringify(keys));
    } catch (e) {
        // Không có gì để xóa
    }
}

// items: [{ id, key }] -> [{ id, ok, counts: { view, open, finish }, first: { view?, open?, finish? }, events: [{ t, e, d }] }]
export async function fetchOpenStatus(items) {
    if (!items.length) return [];
    const response = await fetch('api/opens.php?action=status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items })
    });
    const data = await response.json();
    return data && data.success ? data.items : [];
}

export function trackingUrl(id, key) {
    return new URL(`theo-doi?id=${encodeURIComponent(id)}&key=${encodeURIComponent(key)}`, window.location.href).href;
}

// "20:15 hôm nay", "08:02 hôm qua", "20:15 21/10/2026"
export function formatWhen(iso) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    const time = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const day = d => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const diff = Math.round((day(new Date()) - day(date)) / 86400000);
    if (diff === 0) return `${time} hôm nay`;
    if (diff === 1) return `${time} hôm qua`;
    return `${time} ${date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
}

// Sự kiện mới nhất loại `type`
export function lastEvent(status, type) {
    return [...(status.events || [])].reverse().find(e => e.e === type) || null;
}

// Một câu tóm tắt trạng thái món quà
export function describeOpenStatus(status) {
    if (!status || !status.ok) return { opened: false, text: 'Không xem được trạng thái (mã theo dõi không đúng hoặc kịch bản đã bị xóa).' };
    const { counts = {}, first = {} } = status;
    if (counts.open) {
        const open = lastEvent(status, 'open');
        const where = open ? ` trên ${DEVICE_NAMES[open.d] || 'máy'}` : '';
        return {
            opened: true,
            text: `Đã mở quà lúc ${formatWhen(first.open)}${where}`
                + (counts.open > 1 ? ` · mở ${counts.open} lần` : '')
                + (counts.finish ? ' · đã xem hết' : '')
        };
    }
    if (counts.view) return { opened: false, text: `Đã mở link lúc ${formatWhen(first.view)}, chưa bấm mở quà.` };
    return { opened: false, text: 'Người nhận chưa mở link.' };
}
