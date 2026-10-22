/*!
 * Trình diễn Pháo hoa – trình phát: khung mở quà
 * Phần bổ sung và chỉnh sửa © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// ---------------------------------------------------------------------------
// KHUNG BẮT ĐẦU: màn hình người xem thấy trước khi màn trình diễn bắt đầu, chọn theo `startFrame` của kịch bản.
// Mỗi khung có mount(screen, config) dựng nội dung và trả về { trigger, open, firstLaunchDelay }:
// trigger là phần tử người xem bấm để bắt đầu, open() chạy hiệu ứng mở (promise) trước khi vào màn trình diễn,
// firstLaunchDelay là thời gian chờ (ms) tới phát pháo đầu tiên.
// Thêm khung mới: thêm một mục vào START_FRAMES, phần HTML/CSS của khung, và một dòng trong START_FRAMES của builder.
// ---------------------------------------------------------------------------

import { replacePlaceholders } from './utils.js';
import { playGiftOpenSound } from './audio.js';
import { isLowQuality } from './state.js';
import { PI_2 } from './env.js';
import { themeConfettiColors } from './screen-themes.js';

export const frameText = (value) => String(replacePlaceholders(value || '')).trim();

export const START_FRAMES = {
    // Thiệp chào: lời chào (trang chủ) hoặc lời mời mở quà (link có kịch bản) cùng một nút bấm
    card: {
        mount(screen, config) {
            if (config) {
                const recipient = frameText(config.recipient);
                screen.classList.add('is-gift');
                screen.querySelector('.start-screen__title').textContent = recipient ? `Gửi ${recipient}` : 'Bạn có một món quà!';
                screen.querySelector('.start-screen__subtitle').textContent = frameText(config.introMessage) || 'Một màn pháo hoa được làm riêng để dành tặng bạn.';
                screen.querySelector('.start-screen__from').textContent = frameText(config.author);
                screen.querySelector('.start-screen__hint').textContent = config.music && config.music.url
                    ? '🔊 Bật loa để nghe nhạc nhé'
                    : '🔊 Bật âm thanh để trọn vẹn hơn';
                screen.querySelector('.btn-start').textContent = 'Mở quà';
            }
            return { trigger: screen.querySelector('.btn-start'), open: () => Promise.resolve(), firstLaunchDelay: 2500 };
        }
    },

    // Hộp quà: hộp rung rinh, chạm vào thì rung mạnh, bung nắp, nổ tung ruy băng và pháo giấy rồi mới bắt đầu
    gift: {
        mount(screen, config) {
            const recipient = frameText(config && config.recipient);
            screen.classList.add('frame-gift');
            screen.querySelector('.gift-stage__title').textContent = recipient ? `Gửi ${recipient}` : 'Bạn có một món quà!';
            screen.querySelector('.gift-stage__message').textContent = frameText(config && config.introMessage) || 'Một màn pháo hoa được làm riêng để dành tặng bạn.';
            screen.querySelector('.gift-stage__from').textContent = frameText(config && config.author);
            screen.querySelector('.gift-stage__hint').textContent = config && config.music && config.music.url
                ? 'Chạm vào hộp quà để mở · 🔊 bật loa nhé'
                : 'Chạm vào hộp quà để mở';
            const box = screen.querySelector('.gift-box');
            // Pháo giấy còn đang rơi khi màn trình diễn bắt đầu: phát pháo đầu tiên bắn sớm cho liền mạch
            return { trigger: box, open: () => openGiftBox(screen, box), firstLaunchDelay: 700 };
        }
    }
};

// Rung mạnh -> bung nắp, lóe sáng, nổ ruy băng và pháo giấy -> vào màn trình diễn
function openGiftBox(screen, box) {
    return new Promise(resolve => {
        screen.classList.add('gift-opening');
        setTimeout(() => {
            // Màn mở quà vừa được dựng lại (bản xem nhanh chạy lại giữa chừng): không bung nắp, pháo giấy, tiếng của lần cũ
            if (!screen.classList.contains('gift-opening')) return;
            screen.classList.add('gift-open');
            const rect = box.getBoundingClientRect();
            launchConfetti(rect.left + rect.width / 2, rect.top + rect.height * 0.4);
            playGiftOpenSound();
            setTimeout(resolve, 900);
        }, 520);
    });
}

// Pháo giấy và ruy băng bung ra từ hộp quà. Vẽ trên một lớp phủ riêng nên vẫn rơi tiếp khi màn trình diễn bắt đầu.
function launchConfetti(x, y) {
    const canvas = document.createElement('canvas');
    canvas.className = 'confetti-layer';
    document.body.appendChild(canvas);
    const W = window.innerWidth;
    const H = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const colors = themeConfettiColors();
    const pick = () => colors[(Math.random() * colors.length) | 0];
    // Màn hình nhỏ bắn chậm hơn để pháo giấy không bay vọt ra ngoài
    const power = Math.min(1, Math.max(0.6, W / 900));
    const fan = (spread, min, max) => {
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * spread;
        const speed = (min + Math.random() * (max - min)) * power;
        return { x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed };
    };
    const pieces = Array.from({ length: isLowQuality ? 90 : 150 }, () => ({
        ...fan(Math.PI * 1.1, 6, 18),
        w: 6 + Math.random() * 6,
        h: 10 + Math.random() * 8,
        color: pick(),
        rot: Math.random() * PI_2,
        spin: (Math.random() - 0.5) * 0.3,
        flip: Math.random() * PI_2,
        flipSpeed: 0.1 + Math.random() * 0.2
    }));
    const ribbons = Array.from({ length: 14 }, () => ({
        ...fan(Math.PI * 0.9, 9, 19),
        color: pick(),
        width: 4 + Math.random() * 3,
        wave: Math.random() * PI_2,
        trail: []
    }));

    const duration = 3800;
    const start = performance.now();
    let last = start;
    const frame = (now) => {
        const dt = Math.min(2.5, (now - last) / 16.67);
        last = now;
        const t = now - start;
        ctx.clearRect(0, 0, W, H);
        ctx.globalAlpha = t > duration - 900 ? Math.max(0, (duration - t) / 900) : 1;

        pieces.forEach(p => {
            p.vx *= Math.pow(0.97, dt);
            // Giấy rơi chậm, lật qua lật lại
            p.vy = Math.min(p.vy * Math.pow(0.97, dt) + 0.35 * dt, 4.5);
            p.x += p.vx * dt + Math.sin(p.flip) * 0.8;
            p.y += p.vy * dt;
            p.rot += p.spin * dt;
            p.flip += p.flipSpeed * dt;
            const visibleH = p.h * Math.abs(Math.cos(p.flip));
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.w / 2, -visibleH / 2, p.w, visibleH);
            ctx.restore();
        });

        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ribbons.forEach(r => {
            r.vx *= Math.pow(0.975, dt);
            r.vy = Math.min(r.vy * Math.pow(0.975, dt) + 0.28 * dt, 3.5);
            r.x += r.vx * dt;
            r.y += r.vy * dt;
            r.wave += 0.25 * dt;
            // Dải ruy băng là vệt đuôi uốn lượn theo đường bay
            r.trail.unshift({ x: r.x + Math.sin(r.wave) * 6, y: r.y });
            if (r.trail.length > 26) r.trail.pop();
            ctx.strokeStyle = r.color;
            ctx.lineWidth = r.width;
            ctx.beginPath();
            r.trail.forEach((pt, i) => (i ? ctx.lineTo(pt.x, pt.y) : ctx.moveTo(pt.x, pt.y)));
            ctx.stroke();
        });

        if (t < duration) requestAnimationFrame(frame);
        else canvas.remove();
    };
    requestAnimationFrame(frame);
}
