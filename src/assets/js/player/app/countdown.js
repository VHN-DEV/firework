/*!
 * Trình diễn Pháo hoa – trình phát (hẹn giờ mở quà)
 * Phần bổ sung và chỉnh sửa © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Màn đếm ngược tới giờ hẹn mở quà (openAt).

import { isLowQuality } from '../state.js';
import { getRequiredSoundTypes, musicPlayer, soundManager } from '../audio.js';
import { frameText } from '../start-frames.js';
import { appNodes, beginShow, configRequest, mountStartFrame, reportGiftEvent, screenTheme, startAmbient, themeScreens } from '../../script.js';

export let countdownActive = false;

export function isLockedUntilLater(config) {
    const target = config && config.openAt ? Date.parse(config.openAt) : NaN;
    return Number.isFinite(target) && target - Date.now() > 1000;
}

export function startCountdown(config) {
    countdownActive = true;
    reportGiftEvent('view', config);
    const target = Date.parse(config.openAt);
    const auto = config.openMode === 'countdown';
    const screen = appNodes.startScreen;
    const stage = screen.querySelector('.countdown-stage');
    const recipient = frameText(config.recipient);
    stage.querySelector('.countdown-stage__eyebrow').textContent = recipient ? `Gửi ${recipient}` : 'Bạn có một món quà';
    stage.querySelector('.countdown-stage__title').textContent = auto ? 'Pháo hoa sẽ bắn sau' : 'Món quà sẽ mở sau';
    stage.querySelector('.countdown-stage__date').textContent = 'vào lúc ' + new Date(target).toLocaleString('vi-VN', {
        hour: '2-digit', minute: '2-digit', weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric'
    });
    stage.querySelector('.countdown-stage__message').textContent = frameText(config.introMessage);
    const readyBtn = stage.querySelector('.countdown-stage__ready');
    const hint = stage.querySelector('.countdown-stage__hint');
    readyBtn.hidden = !auto;
    hint.textContent = auto
        ? 'Bấm "Tôi đã sẵn sàng" và giữ trang này mở, pháo hoa sẽ tự bắn khi đếm ngược kết thúc.'
        : 'Hãy quay lại đúng giờ để mở quà nhé!';
    themeScreens(config).then(() => screen.classList.add('is-ready'));
    screen.classList.add('frame-countdown');
    startAmbient.start(screenTheme, { lowQuality: isLowQuality });
    const title = frameText(config.seoTitle) || frameText(config.title);
    if (title) document.title = title;

    let armed = false;
    readyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        armed = true;
        // Mở khóa âm thanh ngay trong lúc bấm và tải sẵn để tới giờ là bắn ngay
        soundManager.resumeAll();
        musicPlayer.unlock();
        configRequest.then(cfg => soundManager.preload(getRequiredSoundTypes(cfg)));
        readyBtn.textContent = '✓ Đã sẵn sàng';
        readyBtn.disabled = true;
        hint.textContent = 'Giữ trang này mở và bật loa nhé, pháo hoa sẽ tự bắn khi đếm ngược kết thúc.';
    }, { once: true });

    const units = {};
    stage.querySelectorAll('[data-unit]').forEach(el => { units[el.dataset.unit] = el; });
    const finalEl = stage.querySelector('.countdown-stage__final');
    const pad = n => String(n).padStart(2, '0');
    let lastFinal = null;
    let timer = null;

    const finish = () => {
        clearInterval(timer);
        countdownActive = false;
        screen.classList.remove('frame-countdown', 'is-final');
        if (auto && armed) {
            // Đúng giờ: vào thẳng màn trình diễn, phát pháo đầu tiên bắn ngay
            beginShow(() => Promise.resolve(), 300);
        } else {
            // Thiệp chào chung đã dựng lúc mạng chậm (có khi đã bấm rồi): dựng lại theo kịch bản
            mountStartFrame(config, { remount: true });
        }
    };

    const tick = () => {
        const left = target - Date.now();
        if (left <= 0) {
            finish();
            return;
        }
        const seconds = Math.ceil(left / 1000);
        units.days.textContent = Math.floor(seconds / 86400);
        units.hours.textContent = pad(Math.floor(seconds / 3600) % 24);
        units.minutes.textContent = pad(Math.floor(seconds / 60) % 60);
        units.seconds.textContent = pad(seconds % 60);
        screen.classList.toggle('has-days', seconds >= 86400);
        // 10 giây cuối: số đếm lớn, mỗi giây một nhịp
        if (seconds <= 10) {
            screen.classList.add('is-final');
            if (seconds !== lastFinal) {
                lastFinal = seconds;
                finalEl.textContent = seconds;
                finalEl.classList.remove('is-beat');
                void finalEl.offsetWidth;
                finalEl.classList.add('is-beat');
            }
        }
        // Gần tới giờ: hẹn đúng thời điểm thay vì chờ nhịp đồng hồ kế tiếp
        if (left < 300) {
            clearInterval(timer);
            setTimeout(finish, left);
        }
    };
    timer = setInterval(tick, 200);
    tick();
}
