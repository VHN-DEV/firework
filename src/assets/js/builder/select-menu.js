/*!
 * Hanabi – builder (danh sách chọn)
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Danh sách xổ xuống của các ô chọn (<select>) vẽ theo giao diện builder thay cho danh sách gốc của trình duyệt (trên Windows
// là khung trắng xanh, không đổi kiểu được). Ô <select> gốc vẫn là ô hiển thị nên giá trị, sự kiện change, hoàn tác như
// cũ; chỉ phần danh sách khi mở là tự vẽ. Màn hình cảm ứng (điện thoại) giữ bảng chọn của máy, dễ bấm hơn.

import { escapeHtml } from './util.js';

let menu = null;
let current = null;

const touchOnly = () => window.matchMedia('(pointer: coarse)').matches && !window.matchMedia('(any-pointer: fine)').matches;

function close(refocus = false) {
    if (!current) return;
    const select = current;
    current = null;
    menu.classList.add('hide');
    select.classList.remove('is-open');
    select.setAttribute('aria-expanded', 'false');
    if (refocus) select.focus();
}

function choose(value) {
    const select = current;
    close(true);
    if (!select || select.value === value) return;
    select.value = value;
    select.dispatchEvent(new Event('input', { bubbles: true }));
    select.dispatchEvent(new Event('change', { bubbles: true }));
}

const optionHtml = option => `
    <button type="button" role="option" data-value="${escapeHtml(option.value)}" aria-selected="${option.selected}"
        ${option.disabled ? 'disabled' : ''}>${escapeHtml(option.textContent.trim())}<i class="fas fa-check" aria-hidden="true"></i></button>`;

function open(select) {
    if (current === select) return close(true);
    close();
    current = select;
    menu.innerHTML = [...select.children].map(child => (child.tagName === 'OPTGROUP'
        ? `<div class="select-menu__group">${escapeHtml(child.label)}</div>${[...child.children].map(optionHtml).join('')}`
        : optionHtml(child))).join('');
    menu.classList.remove('hide');
    select.classList.add('is-open');
    select.setAttribute('aria-expanded', 'true');
    // Ngay dưới ô chọn, rộng bằng ô; không đủ chỗ thì mở lên trên
    const r = select.getBoundingClientRect();
    menu.style.minWidth = `${r.width}px`;
    menu.style.maxHeight = '';
    const below = innerHeight - r.bottom - 12;
    const above = r.top - 12;
    const up = menu.offsetHeight > below && above > below;
    menu.style.maxHeight = `${Math.max(120, Math.min(320, up ? above : below))}px`;
    menu.style.left = `${Math.max(8, Math.min(r.left, innerWidth - menu.offsetWidth - 8))}px`;
    menu.style.top = `${up ? r.top - menu.offsetHeight - 4 : r.bottom + 4}px`;
    const selected = menu.querySelector('[aria-selected="true"]') || menu.querySelector('[role="option"]:not(:disabled)');
    selected?.scrollIntoView({ block: 'nearest' });
    selected?.focus({ preventScroll: true });
}

// Phím trong danh sách: lên/xuống, Home/End chọn mục, Enter/Space chọn, Esc đóng (không đóng hộp thoại phía sau), Tab đóng
function onMenuKey(e) {
    // Phím bấm khi đang mở danh sách chỉ dành cho danh sách (Delete, Ctrl+D... không đụng tới phát bắn đang chọn)
    e.stopPropagation();
    const items = [...menu.querySelectorAll('[role="option"]:not(:disabled)')];
    const index = items.indexOf(document.activeElement);
    const move = { ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: items.length - 1 }[e.key];
    if (move !== undefined) {
        e.preventDefault();
        items[Math.max(0, Math.min(items.length - 1, move))]?.focus();
    } else if (e.key === 'Escape') {
        e.preventDefault();
        close(true);
    } else if (e.key === 'Tab') {
        close();
    }
}

export function initSelectMenus() {
    menu = document.createElement('div');
    menu.className = 'dropdown select-menu hide';
    menu.setAttribute('role', 'listbox');
    document.body.appendChild(menu);

    menu.addEventListener('click', (e) => {
        const item = e.target.closest('[role="option"]');
        if (item && !item.disabled) choose(item.dataset.value);
    });
    menu.addEventListener('keydown', onMenuKey);
    // Không để ô chọn mất tiêu điểm khi bấm vào danh sách
    menu.addEventListener('mousedown', e => e.preventDefault());

    // Bấm vào ô chọn: mở danh sách tự vẽ thay cho danh sách của trình duyệt
    document.addEventListener('mousedown', (e) => {
        const select = e.target.closest('select');
        if (!select) {
            if (current && !menu.contains(e.target)) close();
            return;
        }
        if (select.disabled || select.multiple || touchOnly() || e.button !== 0) return;
        e.preventDefault();
        select.focus();
        open(select);
    }, true);
    // Phím mở danh sách trên ô chọn (Space, Enter, Alt+mũi tên, F4, mũi tên lên/xuống)
    document.addEventListener('keydown', (e) => {
        const select = e.target.closest?.('select');
        if (!select || select.multiple || touchOnly()) return;
        if ([' ', 'Enter', 'F4', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
            e.preventDefault();
            open(select);
        }
    }, true);
    // Cuộn (trừ trong danh sách), đổi cỡ cửa sổ thì đóng
    document.addEventListener('scroll', (e) => {
        if (current && !menu.contains(e.target)) close();
    }, true);
    window.addEventListener('resize', () => close());
}
