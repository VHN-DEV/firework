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
// Màu sắc, kiểu chữ, hiệu ứng nền theo giao diện của dịp (screenTheme, xem screen-themes.js); khung chỉ quyết định vật thể
// và cách mở, nên kiểu nào cũng hợp với giao diện nào.
// Thêm khung mới: thêm một mục vào START_FRAMES (khung có vật thể chính: heroFrame và phần HTML trong HEROES), phần CSS
// của khung (style.scss), và một dòng trong START_FRAMES của builder.
// ---------------------------------------------------------------------------

import { replacePlaceholders } from './utils.js';
import { playGiftOpenSound } from './audio.js';
import { isLowQuality, reduceFlashing } from './state.js';
import { PI_2 } from './env.js';
import { themeConfettiColors } from './screen-themes.js';

export const frameText = (value) => String(replacePlaceholders(value || '')).trim();

// Vật thể chính của từng khung (vẽ bằng CSS, xem style.scss). data-burst: chỗ hạt bung ra khi mở
const HEROES = {
    gift: `<button type="button" class="gift-box" data-burst>
        <span class="gift-box__glow"></span>
        <span class="gift-box__body"><span class="gift-box__shine"></span></span>
        <span class="gift-box__lid">
            <span class="gift-box__bow gift-box__bow--left"></span>
            <span class="gift-box__bow gift-box__bow--right"></span>
            <span class="gift-box__knot"></span>
        </span>
    </button>`,
    lixi: `<button type="button" class="hero hero--lixi">
        <span class="hero__glow"></span>
        <span class="lixi">
            <span class="lixi__card" data-burst></span>
            <span class="lixi__body"></span>
            <span class="lixi__emblem">Lộc</span>
            <span class="lixi__flap"><i class="lixi__flap-edge"></i><i class="lixi__flap-face"></i></span>
        </span>
        <span class="lixi__coin lixi__coin--a"></span>
        <span class="lixi__coin lixi__coin--b"></span>
    </button>`
};

// Khung có vật thể chính (hộp quà, bao lì xì...): dùng chung tiêu đề, lời nhắn, người gửi, nút mở và luồng mở; mỗi kiểu
// chỉ khác vật thể (HEROES), chữ trên nút và loại hạt bung ra. Vật thể hiện ra trước, rồi tới tiêu đề, lời nhắn, nút
// (style.scss); chạm vật thể, nút hay bất kỳ đâu trên thiệp thì chạy hiệu ứng mở: lớp gift-opening (lấy đà), sau prep ms
// thêm gift-open (bung ra, hạt bay), chờ hold ms rồi vào màn trình diễn.
// burst: loại hạt (xem PARTICLE_SETS); label: tên đọc cho trình đọc màn hình
function heroFrame({ id, label, cta, burst, prep = 520, hold = 900, firstLaunchDelay = 700 }) {
    return {
        mount(screen, config) {
            const recipient = frameText(config && config.recipient);
            screen.classList.add('frame-gift', `frame-${id}`);
            screen.querySelector('.gift-stage__title').textContent = recipient ? `Gửi ${recipient}` : 'Bạn có một món quà!';
            screen.querySelector('.gift-stage__message').textContent = frameText(config && config.introMessage) || 'Một màn pháo hoa được làm riêng để dành tặng bạn.';
            screen.querySelector('.gift-stage__from').textContent = frameText(config && config.author);
            screen.querySelector('.gift-stage__cta').textContent = cta;
            screen.querySelector('.gift-stage__hint').textContent = config && config.music && config.music.url ? '🔊 Bật loa để nghe nhạc nhé' : '';
            const slot = screen.querySelector('.gift-stage__hero');
            slot.innerHTML = HEROES[id];
            const hero = slot.firstElementChild;
            hero.setAttribute('aria-label', label);
            // Pháo giấy, hạt sáng còn đang bay khi màn trình diễn bắt đầu: phát pháo đầu tiên bắn sớm cho liền mạch
            return { trigger: screen.querySelector('.gift-stage'), open: () => openHero(screen, hero, burst, prep, hold), firstLaunchDelay };
        }
    };
}

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
    // Hộp quà: phóng nhẹ vào giữa, vệt sáng vàng quét qua, rung rinh; mở thì rung mạnh, bung nắp, nổ ruy băng, pháo giấy
    gift: heroFrame({ id: 'gift', label: 'Mở hộp quà', cta: 'Mở quà', burst: 'confetti' }),
    // Bao lì xì: rơi xuống nảy nhẹ, viền vàng lóe sáng, đồng xu trang trí; mở thì nắp lật lên, thiệp lộc nhô ra, xu vàng bung
    lixi: heroFrame({ id: 'lixi', label: 'Mở bao lì xì', cta: 'Mở lì xì', burst: 'coins', prep: 380, hold: 1000 })
};

// Lấy đà -> bung ra, hạt bay, tiếng mở quà -> vào màn trình diễn. Giảm chớp sáng: bớt hạt, không lóe sáng
function openHero(screen, hero, burst, prep, hold) {
    return new Promise(resolve => {
        const calm = reduceFlashing();
        screen.classList.toggle('gift-calm', calm);
        screen.classList.add('gift-opening');
        setTimeout(() => {
            // Màn mở quà vừa được dựng lại (bản xem nhanh chạy lại giữa chừng): không bung, hạt, tiếng của lần cũ
            if (!screen.classList.contains('gift-opening')) return;
            screen.classList.add('gift-open');
            const spot = (hero.querySelector('[data-burst]') || hero).getBoundingClientRect();
            launchParticles(burst, spot.left + spot.width / 2, spot.top + spot.height * 0.4, calm);
            playGiftOpenSound();
            setTimeout(resolve, hold);
        }, prep);
    });
}

// ---------------------------------------------------------------------------
// Hạt bung ra khi mở quà: vẽ trên một lớp phủ riêng nên vẫn bay tiếp khi màn trình diễn bắt đầu
// ---------------------------------------------------------------------------
// paper: giấy màu lật qua lật lại; ribbon: dải ruy băng uốn lượn; coin: đồng xu vàng có lỗ vuông, lật tròn; petal, heart:
// cánh hoa, trái tim chao nhẹ rồi rơi chậm; spark: tia sáng bốn cánh bay lên, lấp lánh rồi tắt
const PARTICLE_SETS = {
    confetti: [['paper', 150, 'up'], ['ribbon', 14, 'up']],
    sides: [['paper', 160, 'sides'], ['ribbon', 10, 'sides']],
    coins: [['coin', 16, 'up'], ['spark', 36, 'rise']],
    petals: [['petal', 64, 'round']],
    hearts: [['petal', 40, 'round'], ['heart', 18, 'round']],
    sparkles: [['spark', 90, 'rise']]
};

function launchParticles(kind, x, y, calm) {
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
    // Màn hình nhỏ bắn chậm hơn để hạt không bay vọt ra ngoài
    const power = Math.min(1, Math.max(0.6, W / 900));
    const less = (isLowQuality ? 0.6 : 1) * (calm ? 0.5 : 1);
    // Hướng bắn: 'up' tung lên từ vật thể; 'sides' từ hai góc dưới chéo vào giữa; 'round' tỏa đều; 'rise' bay lên chậm
    const launch = (from, min, max) => {
        if (from === 'sides') {
            const left = Math.random() < 0.5;
            const angle = (left ? -Math.PI / 3 : -Math.PI * 2 / 3) + (Math.random() - 0.5) * 0.5;
            const speed = (min + 4 + Math.random() * (max - min)) * power;
            return { x: left ? 0 : W, y: H * 0.88, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed };
        }
        if (from === 'round') {
            const angle = Math.random() * PI_2;
            const speed = (2 + Math.random() * 6) * power;
            return { x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 2 };
        }
        if (from === 'rise') return { x: x + (Math.random() - 0.5) * 60, y: y + (Math.random() - 0.5) * 30, vx: (Math.random() - 0.5) * 5 * power, vy: -(2 + Math.random() * 6) * power };
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.1;
        const speed = (min + Math.random() * (max - min)) * power;
        return { x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed };
    };
    const make = {
        paper: from => ({ ...launch(from, 6, 18), w: 6 + Math.random() * 6, h: 10 + Math.random() * 8, color: pick(), rot: Math.random() * PI_2, spin: (Math.random() - 0.5) * 0.3, flip: Math.random() * PI_2, flipSpeed: 0.1 + Math.random() * 0.2 }),
        ribbon: from => ({ ...launch(from, 9, 19), color: pick(), width: 4 + Math.random() * 3, wave: Math.random() * PI_2, trail: [] }),
        coin: from => ({ ...launch(from, 7, 14), r: 7 + Math.random() * 5, flip: Math.random() * PI_2, flipSpeed: 0.12 + Math.random() * 0.12, rot: (Math.random() - 0.5) * 0.6 }),
        petal: from => ({ ...launch(from, 2, 8), size: 6 + Math.random() * 6, color: pick(), rot: Math.random() * PI_2, spin: (Math.random() - 0.5) * 0.08, flip: Math.random() * PI_2, flipSpeed: 0.05 + Math.random() * 0.08, sway: Math.random() * PI_2 }),
        heart: from => ({ ...launch(from, 2, 8), size: 7 + Math.random() * 6, color: pick(), rot: (Math.random() - 0.5) * 0.6, spin: (Math.random() - 0.5) * 0.04, flip: 0, flipSpeed: 0, sway: Math.random() * PI_2 }),
        spark: from => ({ ...launch(from, 2, 7), size: 2 + Math.random() * 4, life: 0.5 + Math.random() * 0.5, twinkle: Math.random() * PI_2, color: Math.random() < 0.7 ? '#fff3c4' : pick() })
    };
    const particles = [];
    PARTICLE_SETS[kind || 'confetti'].forEach(([type, count, from]) => {
        for (let i = 0; i < Math.round(count * less); i++) particles.push({ type, ...make[type](from) });
    });

    // Rơi: lực cản, trọng lực, tốc độ rơi tối đa riêng từng loại (tia sáng bay ngược lên)
    const FALL = { paper: [0.97, 0.35, 4.5], ribbon: [0.975, 0.28, 3.5], coin: [0.985, 0.34, 7], petal: [0.96, 0.07, 1.6], heart: [0.96, 0.06, 1.4], spark: [0.965, -0.03, 2] };
    const duration = 3800;
    const start = performance.now();
    let last = start;
    const frame = (now) => {
        const dt = Math.min(2.5, (now - last) / 16.67);
        last = now;
        const t = now - start;
        ctx.clearRect(0, 0, W, H);
        const fade = t > duration - 900 ? Math.max(0, (duration - t) / 900) : 1;
        particles.forEach(p => {
            const [drag, gravity, terminal] = FALL[p.type];
            p.vx *= Math.pow(drag, dt);
            p.vy = Math.min(p.vy * Math.pow(drag, dt) + gravity * dt, terminal);
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            ctx.globalAlpha = fade;
            DRAW_PARTICLE[p.type](ctx, p, dt, t, calm);
        });
        ctx.globalAlpha = 1;
        if (t < duration) requestAnimationFrame(frame);
        else canvas.remove();
    };
    requestAnimationFrame(frame);
}

const DRAW_PARTICLE = {
    // Giấy rơi chậm, lật qua lật lại
    paper(ctx, p, dt) {
        p.x += Math.sin(p.flip) * 0.8;
        p.rot += p.spin * dt;
        p.flip += p.flipSpeed * dt;
        const visibleH = p.h * Math.abs(Math.cos(p.flip));
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -visibleH / 2, p.w, visibleH);
        ctx.restore();
    },
    // Dải ruy băng là vệt đuôi uốn lượn theo đường bay
    ribbon(ctx, p, dt) {
        p.wave += 0.25 * dt;
        p.trail.unshift({ x: p.x + Math.sin(p.wave) * 6, y: p.y });
        if (p.trail.length > 26) p.trail.pop();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.width;
        ctx.beginPath();
        p.trail.forEach((pt, i) => (i ? ctx.lineTo(pt.x, pt.y) : ctx.moveTo(pt.x, pt.y)));
        ctx.stroke();
    },
    // Đồng xu vàng lật tròn: mặt xu sáng có lỗ vuông, cạnh xu sẫm khi nghiêng
    coin(ctx, p, dt) {
        p.flip += p.flipSpeed * dt;
        const face = Math.cos(p.flip);
        const w = Math.max(0.12, Math.abs(face)) * p.r;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        const grad = ctx.createLinearGradient(-w, -p.r, w, p.r);
        grad.addColorStop(0, '#fff2b0');
        grad.addColorStop(0.5, face > 0 ? '#f2c033' : '#d9a21e');
        grad.addColorStop(1, '#a8740e');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(0, 0, w, p.r, 0, 0, PI_2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(122, 80, 8, 0.8)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        if (Math.abs(face) > 0.35) {
            const hole = p.r * 0.32;
            ctx.fillStyle = 'rgba(110, 66, 6, 0.85)';
            ctx.fillRect(-hole * Math.abs(face) / 2, -hole / 2, hole * Math.abs(face), hole);
        }
        ctx.restore();
    },
    // Cánh hoa: chao qua lại, lật nghiêng
    petal(ctx, p, dt) {
        p.sway += 0.05 * dt;
        p.x += Math.sin(p.sway) * 0.6;
        p.rot += p.spin * dt;
        p.flip += p.flipSpeed * dt;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.scale(Math.max(0.25, Math.abs(Math.cos(p.flip))), 1);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.moveTo(0, p.size * 0.6);
        ctx.bezierCurveTo(-p.size * 0.65, p.size * 0.2, -p.size * 0.5, -p.size * 0.6, 0, -p.size * 0.45);
        ctx.bezierCurveTo(p.size * 0.5, -p.size * 0.6, p.size * 0.65, p.size * 0.2, 0, p.size * 0.6);
        ctx.fill();
        ctx.restore();
    },
    heart(ctx, p, dt) {
        p.sway += 0.04 * dt;
        p.x += Math.sin(p.sway) * 0.5;
        p.rot += p.spin * dt;
        const s = p.size / 2;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.moveTo(0, s * 0.9);
        ctx.bezierCurveTo(-s * 1.3, 0, -s * 0.9, -s * 1.1, 0, -s * 0.45);
        ctx.bezierCurveTo(s * 0.9, -s * 1.1, s * 1.3, 0, 0, s * 0.9);
        ctx.fill();
        ctx.restore();
    },
    // Tia sáng bốn cánh: lấp lánh, nhỏ dần rồi tắt (cộng sáng; giảm chớp sáng thì vẽ thường, không nhấp nháy)
    spark(ctx, p, dt, t, calm) {
        p.twinkle += 0.3 * dt;
        const age = t / (2600 * p.life);
        if (age >= 1) return;
        const s = p.size * (1 - age * 0.6) * (calm ? 1 : 0.75 + 0.25 * Math.sin(p.twinkle));
        ctx.save();
        if (!calm) ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha *= 1 - age;
        ctx.translate(p.x, p.y);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.moveTo(0, -s * 2);
        ctx.quadraticCurveTo(0, 0, s * 2, 0);
        ctx.quadraticCurveTo(0, 0, 0, s * 2);
        ctx.quadraticCurveTo(0, 0, -s * 2, 0);
        ctx.quadraticCurveTo(0, 0, 0, -s * 2);
        ctx.fill();
        ctx.restore();
    }
};
