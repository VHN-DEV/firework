/*!
 * Trình diễn Pháo hoa – trang chủ: hiệu ứng theo cuộn, thanh chuyển mục
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

export const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Phần tử .reveal hiện dần lên khi cuộn tới (một lần). Gọi lại cho phần tử thêm sau (thẻ kịch bản)
const revealObserver = 'IntersectionObserver' in window
    ? new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('is-visible');
            revealObserver.unobserve(entry.target);
        });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 })
    : null;

export function observeReveal(root = document) {
    root.querySelectorAll('.reveal:not(.is-visible)').forEach(el => {
        if (revealObserver) revealObserver.observe(el);
        else el.classList.add('is-visible');
    });
}

// Thanh chuyển nhanh dọc bên phải: một chấm cho mỗi section có data-nav, chấm của mục đang xem dài ra
function buildSectionNav(sections) {
    const nav = document.querySelector('.section-nav');
    const links = sections.map(section => {
        const a = document.createElement('a');
        a.href = `#${section.id}`;
        a.setAttribute('aria-label', section.dataset.nav);
        a.innerHTML = '<span class="section-nav__label"></span><span class="section-nav__dot"></span>';
        a.querySelector('.section-nav__label').textContent = section.dataset.nav;
        nav.appendChild(a);
        return a;
    });
    return { nav, links };
}

function initMenu() {
    const toggle = document.querySelector('.menu-toggle');
    const menu = document.getElementById('topnav');
    const setOpen = open => {
        toggle.setAttribute('aria-expanded', String(open));
        toggle.setAttribute('aria-label', open ? 'Đóng menu' : 'Mở menu');
        menu.classList.toggle('is-open', open);
        document.body.classList.toggle('menu-open', open);
    };
    toggle.addEventListener('click', () => setOpen(!menu.classList.contains('is-open')));
    menu.addEventListener('click', e => {
        if (e.target.closest('a')) setOpen(false);
    });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && menu.classList.contains('is-open')) setOpen(false);
    });
}

// Số đếm dần lên khi khối số liệu hiện ra
function countUp(el) {
    const target = Number(el.dataset.count);
    if (!Number.isFinite(target) || reducedMotion || target < 2) {
        el.textContent = String(target);
        return;
    }
    const start = performance.now();
    const duration = 1400;
    const step = now => {
        const t = Math.min(1, (now - start) / duration);
        el.textContent = String(Math.round(target * (1 - Math.pow(1 - t, 3))));
        if (t < 1) requestAnimationFrame(step);
    };
    el.textContent = '0';
    requestAnimationFrame(step);
}

// Quầng sáng theo con trỏ trên thẻ tính năng, thẻ kịch bản nghiêng nhẹ theo con trỏ (chỉ chuột, không cảm ứng)
function initPointerEffects() {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    document.addEventListener('pointermove', e => {
        const glow = e.target.closest('.bento__card');
        if (glow) {
            const r = glow.getBoundingClientRect();
            glow.style.setProperty('--mx', `${e.clientX - r.left}px`);
            glow.style.setProperty('--my', `${e.clientY - r.top}px`);
        }
        if (reducedMotion) return;
        const card = e.target.closest('.card');
        if (card) {
            const r = card.getBoundingClientRect();
            const x = (e.clientX - r.left) / r.width - 0.5;
            const y = (e.clientY - r.top) / r.height - 0.5;
            card.style.transform = `perspective(900px) rotateX(${(-y * 5).toFixed(2)}deg) rotateY(${(x * 6).toFixed(2)}deg) translateY(-4px)`;
        }
    }, { passive: true });
    document.addEventListener('pointerout', e => {
        const card = e.target.closest('.card');
        if (card && !card.contains(e.relatedTarget)) card.style.transform = '';
    });
}

export function initScroll({ counts = {} } = {}) {
    document.documentElement.classList.add('reveal-ready');
    observeReveal();
    initMenu();
    initPointerEffects();

    const header = document.querySelector('.topbar');
    const hero = document.querySelector('.hero');
    const heroCopy = document.querySelector('.hero__copy');
    const progress = document.querySelector('.scroll-progress');
    const toTop = document.querySelector('.to-top');
    const steps = document.querySelector('.steps');
    const sections = [...document.querySelectorAll('main section[data-nav]')];
    const { nav, links } = buildSectionNav(sections);
    const topLinks = [...document.querySelectorAll('.topnav a[href^="#"]')];

    // Mục đang xem: section cắt ngang giữa màn hình
    const setActive = id => {
        links.forEach(a => {
            const on = a.hash === `#${id}`;
            a.classList.toggle('is-active', on);
            if (on) a.setAttribute('aria-current', 'true');
            else a.removeAttribute('aria-current');
        });
        topLinks.forEach(a => a.classList.toggle('is-active', a.hash === `#${id}`));
        nav.classList.toggle('is-hinting', id === sections[0].id);
    };
    if ('IntersectionObserver' in window) {
        const sectionObserver = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) setActive(entry.target.id);
            });
        }, { rootMargin: '-45% 0px -50% 0px' });
        sections.forEach(s => sectionObserver.observe(s));

        const countObserver = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                countObserver.unobserve(entry.target);
                countUp(entry.target);
            });
        }, { threshold: 0.6 });
        document.querySelectorAll('[data-count]').forEach(el => {
            const from = counts[el.dataset.countFrom];
            if (from) el.dataset.count = String(from);
            el.textContent = el.dataset.count;
            countObserver.observe(el);
        });
    }
    setActive(sections[0].id);

    // Màn hình hẹp (thanh chuyển mục nằm đè lên nội dung): chỉ hiện khi đang cuộn, đứng yên một lúc thì ẩn
    const narrow = window.matchMedia('(max-width: 1100px)');
    let sleepTimer = 0;
    const wake = () => {
        if (!narrow.matches) return;
        nav.classList.add('is-awake');
        clearTimeout(sleepTimer);
        sleepTimer = setTimeout(() => {
            if (!nav.matches(':hover, :focus-within')) nav.classList.remove('is-awake');
        }, 1600);
    };
    nav.addEventListener('pointerdown', wake);
    nav.addEventListener('focusin', wake);

    let ticking = false;
    const update = () => {
        ticking = false;
        wake();
        const y = window.scrollY;
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const ratio = max > 0 ? Math.min(1, y / max) : 0;
        header.classList.toggle('is-scrolled', y > 20);
        progress.style.setProperty('--progress', ratio.toFixed(4));
        nav.style.setProperty('--progress', ratio.toFixed(4));
        toTop.classList.toggle('is-visible', y > window.innerHeight * 0.9);
        if (!reducedMotion) heroCopy.style.setProperty('--hero-out', Math.min(1, y / (hero.offsetHeight * 0.8)).toFixed(3));
        // Đường nối các bước quy trình chạy dần khi cuộn qua
        if (steps) {
            const r = steps.getBoundingClientRect();
            const t = (window.innerHeight * 0.85 - r.top) / (r.height + window.innerHeight * 0.3);
            steps.style.setProperty('--line', Math.max(0, Math.min(1, t)).toFixed(3));
        }
    };
    const onScroll = () => {
        if (!ticking) {
            ticking = true;
            requestAnimationFrame(update);
        }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    update();
}
