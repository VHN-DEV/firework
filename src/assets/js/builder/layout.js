/*!
 * Hanabi – builder (bố cục)
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Thanh bên, menu thêm.

let lastToggleTime = 0;

// Mở/đóng ngăn "Cấu hình chung" (dạng ngăn trượt trên tablet/điện thoại; trên máy tính là cột cố định)
export function toggleSidebar(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }

    // Ngăn chặn double click/tap quá nhanh gây bật-tắt tức thì
    const now = Date.now();
    if (now - lastToggleTime < 300) return;
    lastToggleTime = now;

    closeMoreMenu();
    const panel = document.getElementById('settings-panel');
    const overlay = document.getElementById('sidebar-overlay');
    const open = !panel.classList.contains('open');
    panel.classList.toggle('open', open);
    overlay.classList.toggle('show', open);
}

// Thu gọn Cấu hình chung (máy tính): dải biểu tượng các nhóm, dòng thời gian rộng thêm. Nhớ cho lần mở builder sau
const SETTINGS_COLLAPSED_KEY = 'firework_builder_settings_collapsed';

export function toggleSettingsCollapsed(collapsed) {
    const workspace = document.querySelector('.workspace');
    const on = typeof collapsed === 'boolean' ? collapsed : !workspace.classList.contains('settings-collapsed');
    workspace.classList.toggle('settings-collapsed', on);
    const btn = document.querySelector('.collapse-panel');
    const label = on ? 'Mở rộng Cấu hình chung' : 'Thu gọn Cấu hình chung';
    btn.title = label;
    btn.setAttribute('aria-label', label);
    btn.setAttribute('aria-expanded', String(!on));
    btn.querySelector('i').className = `fas fa-angles-${on ? 'right' : 'left'}`;
    try {
        localStorage.setItem(SETTINGS_COLLAPSED_KEY, on ? '1' : '');
    } catch (e) {
        // Không lưu được (chế độ ẩn danh): lần sau mở rộng như mặc định
    }
    // Khung xem nhanh, dòng thời gian tính lại cỡ sau khi cột đổi bề ngang xong
    setTimeout(() => window.dispatchEvent(new Event('resize')), 320);
}

// Bấm biểu tượng một nhóm khi đang thu gọn: mở rộng, mở nhóm đó, cuộn tới
export function openSettingsGroup(name) {
    toggleSettingsCollapsed(false);
    const group = document.querySelector(`.settings-group[data-group="${name}"]`);
    if (!group) return;
    group.open = true;
    setTimeout(() => group.scrollIntoView({ block: 'start', behavior: 'smooth' }), 320);
}

export function initSettingsRail() {
    const rail = document.querySelector('.settings-rail');
    if (!rail) return;
    rail.innerHTML = [...document.querySelectorAll('.settings-group')].map(group => {
        const icon = group.querySelector('summary > i').className;
        const title = group.querySelector('.summary-title').textContent;
        return `<button type="button" onclick="openSettingsGroup('${group.dataset.group}')" title="${title}" aria-label="${title}"><i class="${icon}"></i></button>`;
    }).join('');
    let saved = false;
    try {
        saved = localStorage.getItem(SETTINGS_COLLAPSED_KEY) === '1';
    } catch (e) {
        // Không đọc được: mở rộng như mặc định
    }
    if (saved) toggleSettingsCollapsed(true);
}

export function toggleMoreMenu() {
    document.getElementById('more-menu').classList.toggle('hide');
}

export function closeMoreMenu() {
    document.getElementById('more-menu')?.classList.add('hide');
}

/**
 * XEM NHANH
 * Chạy chính trình phát thật (demo.html?preview=1) trong iframe, builder gửi kịch bản sang qua postMessage.
 * Nhờ vậy những gì thấy khi soạn giống hệt khi trình diễn: vật lý, hình dạng, ảnh, nền, cách xử lý riêng cho điện thoại.
 */
