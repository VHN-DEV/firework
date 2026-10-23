/*!
 * Hanabi – trang chủ: banner ảnh tự chuyển
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

import { reducedMotion } from './scroll.js';

const SLIDE_MS = 7000;

export function initHero() {
    const hero = document.querySelector('.hero');
    const slides = [...hero.querySelectorAll('.hero__slide')];
    const captionBox = hero.querySelector('.hero__captions');
    const captions = [...captionBox.querySelectorAll('.hero__caption')];
    const dots = [...hero.querySelectorAll('.hero__dots button')];
    const dotsBox = hero.querySelector('.hero__dots');
    const pauseBtn = hero.querySelector('.hero__pause');
    dotsBox.style.setProperty('--slide-ms', `${SLIDE_MS}ms`);

    let index = 0;
    let timer = null;
    let startedAt = 0;
    let remaining = SLIDE_MS;
    // Lý do đang dừng: người xem bấm dừng, banner khuất khỏi màn hình, tab bị ẩn
    const holds = new Set(reducedMotion ? ['user'] : []);

    const syncPauseButton = () => {
        const paused = holds.has('user');
        pauseBtn.setAttribute('aria-pressed', String(paused));
        pauseBtn.setAttribute('aria-label', paused ? 'Tiếp tục tự chuyển ảnh' : 'Tạm dừng tự chuyển ảnh');
        pauseBtn.innerHTML = `<i class="fa-solid fa-${paused ? 'play' : 'pause'}"></i>`;
    };

    const stopTimer = () => {
        if (!timer) return;
        clearTimeout(timer);
        timer = null;
        remaining = Math.max(0, remaining - (performance.now() - startedAt));
    };
    const startTimer = () => {
        if (timer || holds.size) return;
        startedAt = performance.now();
        timer = setTimeout(() => {
            timer = null;
            go(index + 1);
        }, remaining);
    };
    const hold = (reason, on) => {
        if (on) holds.add(reason);
        else holds.delete(reason);
        dotsBox.style.setProperty('--slide-state', holds.size ? 'paused' : 'running');
        if (holds.size) stopTimer();
        else startTimer();
        syncPauseButton();
    };

    // Ảnh sau đã tải xong mới chuyển, để không lóe khung đen
    const ready = img => (img.complete && img.naturalWidth ? Promise.resolve() : img.decode().catch(() => {}));

    // byUser: người xem tự chuyển thì đọc chú thích mới cho trình đọc màn hình; tự chuyển thì im lặng
    async function go(next, byUser = false) {
        captionBox.setAttribute('aria-live', byUser ? 'polite' : 'off');
        next = (next + slides.length) % slides.length;
        if (next === index) return;
        stopTimer();
        const img = slides[next].querySelector('img');
        img.loading = 'eager';
        await ready(img);
        const prev = index;
        index = next;
        slides[prev].classList.remove('is-active');
        slides[prev].classList.add('is-leaving');
        setTimeout(() => slides[prev].classList.remove('is-leaving'), 1500);
        slides[index].classList.add('is-active');
        captions.forEach((c, i) => c.classList.toggle('is-active', i === index));
        dots.forEach((d, i) => {
            d.classList.toggle('is-done', i < index);
            d.classList.remove('is-active');
            if (i === index) {
                // Chạy lại thanh tiến độ từ đầu
                void d.offsetWidth;
                d.classList.add('is-active');
                d.setAttribute('aria-current', 'true');
            } else {
                d.removeAttribute('aria-current');
            }
        });
        slides.forEach((s, i) => s.setAttribute('aria-hidden', String(i !== index)));
        remaining = SLIDE_MS;
        startTimer();
        // Tải trước ảnh kế tiếp
        const after = slides[(index + 1) % slides.length].querySelector('img');
        after.loading = 'eager';
    }

    dots.forEach((dot, i) => dot.addEventListener('click', () => go(i, true)));
    hero.querySelector('.hero__prev').addEventListener('click', () => go(index - 1, true));
    hero.querySelector('.hero__next').addEventListener('click', () => go(index + 1, true));
    pauseBtn.addEventListener('click', () => hold('user', !holds.has('user')));
    hero.querySelector('.hero__controls').addEventListener('keydown', e => {
        if (e.key === 'ArrowLeft') go(index - 1, true);
        if (e.key === 'ArrowRight') go(index + 1, true);
    });

    // Vuốt ngang trên điện thoại
    let touch = null;
    hero.addEventListener('touchstart', e => {
        touch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }, { passive: true });
    hero.addEventListener('touchend', e => {
        if (!touch) return;
        const dx = e.changedTouches[0].clientX - touch.x;
        const dy = e.changedTouches[0].clientY - touch.y;
        touch = null;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(index + (dx < 0 ? 1 : -1), true);
    }, { passive: true });

    if ('IntersectionObserver' in window) {
        new IntersectionObserver(([entry]) => hold('offscreen', !entry.isIntersecting), { threshold: 0.15 }).observe(hero);
    }
    document.addEventListener('visibilitychange', () => hold('hidden', document.hidden));

    slides.forEach((s, i) => s.setAttribute('aria-hidden', String(i !== 0)));
    dots[0].setAttribute('aria-current', 'true');
    syncPauseButton();
    dotsBox.style.setProperty('--slide-state', holds.size ? 'paused' : 'running');
    startTimer();
}
