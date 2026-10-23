/*!
 * Trình diễn Pháo hoa – trang chủ: tia lửa bay trên banner, pháo hoa nhỏ ở mục liên hệ
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

import { reducedMotion } from './scroll.js';

const COLORS = ['#ffd27a', '#ff6aa8', '#8b7bff', '#5ad4ff', '#ffffff', '#ff8a5c'];
const rand = (a, b) => a + Math.random() * (b - a);

// Canvas vẽ theo độ phân giải màn hình (tối đa x2), chỉ chạy khi đang nằm trong khung nhìn và tab đang mở
function createLayer(canvas, { onFrame }) {
    const g = canvas.getContext('2d');
    let w = 0;
    let h = 0;
    let raf = 0;
    let visible = false;
    let last = 0;
    const resize = () => {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        w = canvas.clientWidth;
        h = canvas.clientHeight;
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const frame = now => {
        raf = 0;
        const dt = Math.min(0.05, (now - (last || now)) / 1000);
        last = now;
        g.clearRect(0, 0, w, h);
        g.globalCompositeOperation = 'lighter';
        onFrame(g, w, h, dt);
        g.globalCompositeOperation = 'source-over';
        if (visible && !document.hidden) raf = requestAnimationFrame(frame);
    };
    const run = () => {
        if (!raf && visible && !document.hidden) {
            last = 0;
            raf = requestAnimationFrame(frame);
        }
    };
    new ResizeObserver(resize).observe(canvas);
    resize();
    new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        run();
    }).observe(canvas);
    document.addEventListener('visibilitychange', run);
    return { size: () => ({ w, h }) };
}

// Banner: tàn lửa nhỏ bay lên chậm, chập chờn
function embers(canvas) {
    const sparks = [];
    const spawn = (w, h, anywhere) => ({
        x: rand(0, w),
        y: anywhere ? rand(0, h) : h + 10,
        r: rand(0.6, 1.8),
        vy: rand(-28, -10),
        vx: rand(-6, 6),
        phase: rand(0, Math.PI * 2),
        color: COLORS[Math.floor(rand(0, 3))]
    });
    let seeded = false;
    createLayer(canvas, {
        onFrame(g, w, h, dt) {
            const target = Math.round(Math.min(70, w / 20));
            if (!seeded) {
                for (let i = 0; i < target; i++) sparks.push(spawn(w, h, true));
                seeded = true;
            }
            while (sparks.length < target) sparks.push(spawn(w, h, false));
            for (let i = sparks.length - 1; i >= 0; i--) {
                const s = sparks[i];
                s.phase += dt * 3;
                s.x += (s.vx + Math.sin(s.phase) * 8) * dt;
                s.y += s.vy * dt;
                if (s.y < -10) {
                    sparks.splice(i, 1);
                    continue;
                }
                // Mờ dần khi lên cao, chập chờn
                const alpha = Math.max(0, Math.min(1, s.y / h)) * (0.55 + 0.45 * Math.sin(s.phase * 2));
                g.globalAlpha = alpha;
                g.fillStyle = s.color;
                g.beginPath();
                g.arc(s.x, s.y, s.r * 2.6, 0, Math.PI * 2);
                g.globalAlpha = alpha * 0.18;
                g.fill();
                g.globalAlpha = alpha;
                g.beginPath();
                g.arc(s.x, s.y, s.r, 0, Math.PI * 2);
                g.fill();
            }
            g.globalAlpha = 1;
        }
    });
}

// Mục liên hệ: thỉnh thoảng một quả pháo bay lên rồi nổ; chạm vào khoảng trống thì bắn ngay chỗ đó
function bursts(canvas, section) {
    const rockets = [];
    const stars = [];
    let wait = 0.6;
    const explode = (x, y) => {
        const color = COLORS[Math.floor(rand(0, COLORS.length))];
        const count = 70;
        const speed = rand(110, 170);
        for (let i = 0; i < count; i++) {
            const a = (i / count) * Math.PI * 2 + rand(-0.04, 0.04);
            const v = speed * rand(0.75, 1);
            stars.push({ x, y, px: x, py: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rand(1.1, 1.6), age: 0, color });
        }
    };
    const launch = (w, h, tx, ty) => {
        const x = tx ?? rand(w * 0.08, w * 0.92);
        const y = ty ?? rand(h * 0.12, h * 0.45);
        rockets.push({ x, y: h + 10, tx: x, ty: y, vy: -Math.sqrt(2 * 260 * (h + 10 - y)) });
    };
    const layer = createLayer(canvas, {
        onFrame(g, w, h, dt) {
            wait -= dt;
            if (wait <= 0) {
                launch(w, h);
                wait = rand(1.4, 2.8);
            }
            for (let i = rockets.length - 1; i >= 0; i--) {
                const r = rockets[i];
                r.vy += 260 * dt;
                r.y += r.vy * dt;
                g.fillStyle = 'rgba(255, 220, 160, 0.9)';
                g.fillRect(r.x - 1, r.y, 2, 6);
                if (r.vy >= 0 || r.y <= r.ty) {
                    rockets.splice(i, 1);
                    explode(r.x, r.y);
                }
            }
            g.lineCap = 'round';
            for (let i = stars.length - 1; i >= 0; i--) {
                const s = stars[i];
                s.age += dt;
                if (s.age >= s.life) {
                    stars.splice(i, 1);
                    continue;
                }
                s.px = s.x;
                s.py = s.y;
                s.vx *= 1 - 1.6 * dt;
                s.vy = s.vy * (1 - 1.6 * dt) + 70 * dt;
                s.x += s.vx * dt;
                s.y += s.vy * dt;
                const t = s.age / s.life;
                g.globalAlpha = (1 - t) * (t > 0.6 ? 0.6 + 0.4 * Math.sin(s.age * 40) : 1);
                g.strokeStyle = s.color;
                g.lineWidth = 2;
                g.beginPath();
                g.moveTo(s.px, s.py);
                g.lineTo(s.x, s.y);
                g.stroke();
            }
            g.globalAlpha = 1;
        }
    });
    section.addEventListener('pointerdown', e => {
        if (e.target.closest('form, a, button, input, select, textarea')) return;
        const box = canvas.getBoundingClientRect();
        const { w, h } = layer.size();
        launch(w, h, e.clientX - box.left, e.clientY - box.top);
    });
}

export function initSky() {
    if (reducedMotion || !('IntersectionObserver' in window) || !('ResizeObserver' in window)) return;
    const heroCanvas = document.querySelector('.hero__sparks');
    if (heroCanvas) embers(heroCanvas);
    const contactCanvas = document.querySelector('.contact__sky');
    if (contactCanvas) bursts(contactCanvas, contactCanvas.closest('section'));
}
