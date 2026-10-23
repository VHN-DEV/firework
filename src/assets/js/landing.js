/*!
 * Trình diễn Pháo hoa – trang chủ
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Trang chủ giới thiệu dịch vụ: banner ảnh chụp thật, xem thử trình phát, tính năng, kịch bản mẫu (nổi bật trước),
// dịp tặng, quy trình, hỏi đáp, phiếu đặt làm riêng. Thông tin liên hệ, video giới thiệu: landing/content.js.
// Không import module của trình phát (player/...): Vite sẽ tách module đó thành gói dùng chung, đổi cách chia gói của
// demo.html. Từng gặp: tách player/bank-styles.js ra gói riêng thì cảnh tắt bờ bên này không còn người lên cầu.
import '../scss/landing.scss';
import { printCopyrightNotice } from './copyright.js';
import { OCCASIONS } from './templates.js';
import { initScroll } from './landing/scroll.js';
import { initHero } from './landing/hero.js';
import { initSky } from './landing/sky.js';
import { initShowcase } from './landing/showcase.js';
import { initOrder } from './landing/order.js';

printCopyrightNotice('Trình diễn Pháo hoa');

// Hình pháo chạy ở hàng thứ hai của mục Dịp tặng
const SHAPES = [
    ['❤️', 'Trái tim'], ['⭐', 'Ngôi sao'], ['🦋', 'Con bướm'], ['🪷', 'Bông sen'], ['💎', 'Kim cương'], ['🪐', 'Hành tinh'],
    ['❄️', 'Bông tuyết'], ['🐱', 'Mặt mèo'], ['😊', 'Mặt cười'], ['🍀', 'Cỏ 4 lá'], ['🌴', 'Cây cọ'], ['🌀', 'Xoắn ốc'],
    ['🎡', 'Xoay vòng'], ['🎇', 'Liễu rủ'], ['🔤', 'Chữ của bạn'], ['🖼️', 'Ảnh của bạn']
];

function initMarquee(order) {
    const [occasionRow, shapeRow] = document.querySelectorAll('.marquee__row');
    const occasions = OCCASIONS.map(o => `<a class="occasion" href="#lien-he" data-occasion="${o.name}"><span aria-hidden="true">${o.icon}</span>${o.name}</a>`).join('');
    const shapes = SHAPES.map(([icon, name]) => `<span class="occasion"><span aria-hidden="true">${icon}</span>${name}</span>`).join('');
    // Lặp hai lần để chạy vòng không thấy chỗ nối; bản lặp ẩn với trình đọc màn hình
    occasionRow.innerHTML = `<div class="marquee__group">${occasions}</div><div class="marquee__group" aria-hidden="true">${occasions}</div>`;
    shapeRow.innerHTML = `<div class="marquee__group">${shapes}</div><div class="marquee__group" aria-hidden="true">${shapes}</div>`;
    occasionRow.querySelectorAll('.marquee__group[aria-hidden] a').forEach(a => a.setAttribute('tabindex', '-1'));
    occasionRow.addEventListener('click', e => {
        const a = e.target.closest('[data-occasion]');
        if (a) order.pickOccasion(a.dataset.occasion);
    });
}

const order = initOrder();
initScroll({ counts: { occasions: OCCASIONS.length } });
initHero();
initSky();
initMarquee(order);
initShowcase({ onOrder: id => order.pick(id), onItems: items => order.setSamples(items) });
