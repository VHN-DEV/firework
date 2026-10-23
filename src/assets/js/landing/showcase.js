/*!
 * Hanabi – trang chủ: kịch bản mẫu, khung xem thử
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

import { observeReveal } from './scroll.js';
import { YOUTUBE } from './content.js';

const escapeHtml = value => String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// Như trình phát: [YEAR], [LUNAR_YEAR], [SINCE:1945] trong tiêu đề, mô tả
function replacePlaceholders(text) {
    const year = new Date().getFullYear();
    const cans = ['Canh', 'Tân', 'Nhâm', 'Quý', 'Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ'];
    const chis = ['Thân', 'Dậu', 'Tuất', 'Hợi', 'Tí', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi'];
    return String(text ?? '')
        .replace(/\[YEAR\]/g, year)
        .replace(/\[LUNAR_YEAR\]/g, `${cans[year % 10]} ${chis[year % 12]}`)
        .replace(/\[SINCE:(\d+)\]/g, (m, p1) => year - parseInt(p1, 10));
}

// Tiêu đề viết hoa toàn bộ (như chữ trên thiệp) thành viết hoa chữ đầu cho dễ đọc trên thẻ
export function niceTitle(text) {
    const t = replacePlaceholders(text).trim();
    if (t !== t.toLocaleUpperCase('vi')) return t;
    const lower = t.toLocaleLowerCase('vi');
    return lower.charAt(0).toLocaleUpperCase('vi') + lower.slice(1);
}

const showUrl = id => `./demo?config=${encodeURIComponent(id)}`;

// Mã video YouTube từ link (watch?v=, youtu.be/, shorts/, embed/) hoặc chính mã
export function youtubeId(value) {
    const text = String(value || '').trim();
    if (/^[\w-]{11}$/.test(text)) return text;
    const m = text.match(/(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/|\/live\/)([\w-]{11})/);
    return m ? m[1] : '';
}

function cardHtml(item) {
    const title = niceTitle(item.title || item.id);
    const tags = (Array.isArray(item.tags) ? item.tags : []).slice(0, 4);
    return `
        <a class="card__media" href="${showUrl(item.id)}" target="_blank" rel="noopener" aria-label="Xem thử: ${escapeHtml(title)}">
            <img src="./configs/${encodeURIComponent(item.id)}.jpg" alt="" loading="lazy" width="1200" height="630">
            ${item.featured ? '<span class="card__badge"><i class="fa-solid fa-star"></i> Nổi bật</span>' : ''}
            <span class="card__play"><i class="fa-solid fa-play"></i> Xem ngay</span>
            ${item.eventCount ? `<span class="card__count"><i class="fa-solid fa-wand-magic-sparkles"></i>${escapeHtml(item.eventCount)} phát bắn</span>` : ''}
        </a>
        <div class="card__body">
            ${item.category ? `<span class="card__category">${escapeHtml(item.category)}</span>` : ''}
            <h3 class="card__title">${escapeHtml(title)}</h3>
            ${item.description ? `<p class="card__desc">${escapeHtml(replacePlaceholders(item.description))}</p>` : ''}
            ${tags.length ? `<ul class="card__tags">${tags.map(t => `<li>${escapeHtml(t)}</li>`).join('')}</ul>` : ''}
            <div class="card__actions">
                <a class="btn btn--ghost" href="${showUrl(item.id)}" target="_blank" rel="noopener"><i class="fa-solid fa-play"></i> Xem thử</a>
                <button type="button" class="btn btn--primary" data-order="${escapeHtml(item.id)}"><i class="fa-solid fa-paper-plane"></i> Đặt mẫu này</button>
            </div>
        </div>`;
}

// Bộ lọc: Tất cả, Nổi bật, rồi từng nhóm (category) theo thứ tự xuất hiện
function renderFilters(box, items, onPick) {
    const groups = [...new Set(items.map(i => i.category).filter(Boolean))];
    const filters = [
        { key: '*', label: 'Tất cả', count: items.length },
        ...(items.some(i => i.featured) ? [{ key: 'featured', label: '<i class="fa-solid fa-star"></i> Nổi bật', count: items.filter(i => i.featured).length }] : []),
        ...groups.map(g => ({ key: `cat:${g}`, label: escapeHtml(g), count: items.filter(i => i.category === g).length }))
    ];
    box.innerHTML = filters.map((f, i) => `<button type="button" class="chip" data-filter="${escapeHtml(f.key)}" aria-pressed="${i === 0}">${f.label} <small>${f.count}</small></button>`).join('');
    box.addEventListener('click', e => {
        const chip = e.target.closest('[data-filter]');
        if (!chip) return;
        box.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', String(c === chip)));
        onPick(chip.dataset.filter);
    });
}

function initShowcaseCards(items, { onOrder }) {
    const featuredBox = document.querySelector('.showcase__featured');
    const grid = document.querySelector('.showcase__grid');
    const cards = items.map(item => {
        const card = document.createElement('article');
        card.className = `card reveal${item.featured ? ' card--featured' : ''}`;
        card.dataset.id = item.id;
        card.innerHTML = cardHtml(item);
        (item.featured ? featuredBox : grid).appendChild(card);
        return { card, item };
    });
    [featuredBox, grid].forEach(box => [...box.children].forEach((c, i) => c.style.setProperty('--i', String(i % 4))));
    observeReveal(document.getElementById('kich-ban'));

    renderFilters(document.querySelector('.filters'), items, key => {
        let n = 0;
        cards.forEach(({ card, item }) => {
            const show = key === '*' || (key === 'featured' && item.featured) || key === `cat:${item.category}`;
            card.classList.toggle('is-hidden', !show);
            card.classList.remove('is-entering');
            if (show) {
                // Hiện lại có hiệu ứng trượt lên, lần lượt
                card.classList.add('is-visible');
                void card.offsetWidth;
                card.style.setProperty('--i', String(n++ % 6));
                card.classList.add('is-entering');
            }
        });
        featuredBox.hidden = !cards.some(({ card, item }) => item.featured && !card.classList.contains('is-hidden'));
        grid.hidden = !cards.some(({ card, item }) => !item.featured && !card.classList.contains('is-hidden'));
    });

    document.getElementById('kich-ban').addEventListener('click', e => {
        const btn = e.target.closest('[data-order]');
        if (btn) onOrder(btn.dataset.order);
    });
}

// Khung xem thử: thẻ chọn (video YouTube nếu có, rồi các kịch bản nổi bật); bấm phát mới nạp trình phát/video, cuộn
// khỏi mục thì gỡ ra cho nhẹ máy và tắt tiếng
function initDemo(items) {
    const section = document.getElementById('xem-thu');
    const tabsBox = section.querySelector('.demo__tabs');
    const screen = section.querySelector('.demo__screen');
    const playBtn = section.querySelector('.demo__play');
    const urlText = section.querySelector('.demo__url');
    const fullLink = section.querySelector('.demo__note a');
    const video = youtubeId(YOUTUBE);
    // Kịch bản "hero" (nút Xem demo) đứng đầu, rồi các kịch bản nổi bật khác
    const picks = [...items.filter(i => i.hero), ...items.filter(i => i.featured && !i.hero)].slice(0, 4);
    const tabs = [
        ...(video ? [{ key: 'yt', label: '<i class="fa-brands fa-youtube"></i> Video giới thiệu', src: `https://www.youtube-nocookie.com/embed/${video}?autoplay=1&rel=0&playsinline=1`, open: `https://www.youtube.com/watch?v=${video}`, url: 'youtube.com' }] : []),
        ...(picks.length ? picks : items.slice(0, 3)).map(i => ({
            key: i.id,
            label: escapeHtml(niceTitle(i.title || i.id)),
            src: showUrl(i.id),
            open: showUrl(i.id),
            url: `trinh-dien-phao-hoa / demo?config=${i.id}`,
            title: niceTitle(i.title || i.id)
        }))
    ];
    if (!tabs.length) return;
    let current = tabs[0];
    let frame = null;

    const select = tab => {
        current = tab;
        tabsBox.querySelectorAll('[role="tab"]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.key === tab.key)));
        urlText.textContent = tab.url;
        fullLink.href = tab.open;
        if (frame) frame.src = tab.src;
    };
    const play = () => {
        if (frame) return;
        frame = document.createElement('iframe');
        frame.title = current.title ? `Màn trình diễn: ${current.title}` : 'Video giới thiệu';
        frame.allow = 'autoplay; fullscreen; encrypted-media; picture-in-picture';
        frame.allowFullscreen = true;
        frame.src = current.src;
        screen.appendChild(frame);
        playBtn.hidden = true;
    };
    const unload = () => {
        if (!frame) return;
        frame.remove();
        frame = null;
        playBtn.hidden = false;
    };

    tabsBox.innerHTML = tabs.map(t => `<button type="button" class="chip" role="tab" data-key="${escapeHtml(t.key)}" aria-selected="false">${t.label}</button>`).join('');
    tabsBox.addEventListener('click', e => {
        const b = e.target.closest('[role="tab"]');
        if (b) select(tabs.find(t => t.key === b.dataset.key));
    });
    playBtn.addEventListener('click', play);
    new IntersectionObserver(([entry]) => {
        if (!entry.isIntersecting) unload();
    }).observe(screen);
    select(current);
}

export async function initShowcase({ onOrder, onItems }) {
    const status = document.querySelector('.showcase__status');
    let items = [];
    try {
        const res = await fetch('./configs/configs_index.json', { cache: 'no-cache' });
        if (!res.ok) throw new Error(res.status);
        items = (await res.json()).filter(i => i && typeof i.id === 'string' && !/^(configs_index|preview_temp|zz_)/.test(i.id));
    } catch (e) {
        status.innerHTML = 'Chưa tải được danh sách kịch bản. <a href="./demo">Mở trang demo</a> để xem trực tiếp.';
    }
    // Nổi bật đứng trước, giữ thứ tự trong file
    items = [...items.filter(i => i.featured), ...items.filter(i => !i.featured)];
    onItems(items);
    // Nút "Xem demo": mở thẳng kịch bản "hero" (có cảnh, nhạc) thay vì pháo ngẫu nhiên trên nền đen
    const hero = items.find(i => i.hero) || items.find(i => i.featured);
    if (hero) document.querySelectorAll('[data-demo-link]').forEach(a => { a.href = showUrl(hero.id); });
    initDemo(items);
    if (items.length) initShowcaseCards(items, { onOrder });
}
