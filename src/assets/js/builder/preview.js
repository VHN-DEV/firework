/*!
 * Trình diễn Pháo hoa – builder (xem nhanh)
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Khung xem nhanh: gửi kịch bản sang trình phát, âm thanh, nhạc, thiết bị giả lập, toàn màn hình.

import fscreen from '../fscreen@1.0.1.js';
import { state } from './state.js';
import { getShowUrl, notify } from './util.js';
import { showActiveEvent } from './timeline.js';
import { closeInspector, positionMobileSheet, renderInspector } from './inspector.js';
import { getMusicAudio } from './music.js';
import { getFinalConfig, saveConfig } from './config.js';

// Nghe nhạc cùng khung xem nhanh: nhạc bắt đầu đúng lúc trình phát bắn đợt 1 (giống màn trình diễn thật)
export let previewSoundOn = false;

export let previewMusicPlaying = false;

let previewMusicStopTimer = null;

let previewClockTimer = null;

// Kịch bản khớp nhịp: báo cho khung xem nhanh vị trí nhạc đang phát để pháo bám theo
function sendPreviewClock() {
    const audio = getMusicAudio();
    const frame = getPreviewFrame();
    if (!state.music?.sync || !audio || audio.paused || audio.seeking || audio.readyState < 3 || !frame?.contentWindow) return;
    frame.contentWindow.postMessage({
        type: 'firework-preview-clock',
        position: (audio.currentTime - (state.music.start || 0)) * 1000
    }, window.location.origin);
}

// Nút Âm thanh của khung xem nhanh: tiếng pháo (trong khung) và nhạc nền (builder phát, khớp với kịch bản)
export function updateSoundPreviewButton() {
    const btn = document.getElementById('btn-sound-mini');
    if (!btn) return;
    btn.classList.toggle('active', previewSoundOn);
    btn.querySelector('i').className = `fas fa-${previewSoundOn ? 'volume-high' : 'volume-xmark'}`;
    btn.title = previewSoundOn
        ? 'Tắt âm thanh khi xem nhanh'
        : `Bật âm thanh khi xem nhanh (tiếng pháo${state.music ? ' và nhạc nền, chạy lại từ đầu cho khớp nhạc' : ''})`;
}

// Safari chỉ cho phát nhạc về sau nếu đã play() ngay trong lúc người dùng bấm
function unlockPreviewMusic() {
    const audio = getMusicAudio();
    if (!state.music || !audio || !audio.paused) return;
    audio.muted = true;
    audio.play()
        .then(() => { if (!previewMusicPlaying) audio.pause(); })
        .catch(() => {})
        .finally(() => { audio.muted = false; });
}

export function togglePreviewSound() {
    previewSoundOn = !previewSoundOn;
    updateSoundPreviewButton();
    if (!previewSoundOn) {
        stopPreviewMusic();
        sendPreview(false);
        return;
    }
    // Không có nhạc nền: chỉ bật tiếng pháo, không cần chạy lại
    if (!state.music) {
        sendPreview(false);
        return;
    }
    unlockPreviewMusic();
    // Chạy cả kịch bản từ đầu để nhạc khớp nhịp
    if (state.activeEventId) closeInspector();
    if (previewMode === 'idle') setPreviewMode('once');
    updateMiniInfo();
    sendPreview(true, { intro: true });
}

// Xem như người nhận: màn mở quà (thiệp chào / hộp quà), chạm mở thì chạy từ đầu kèm tiêu đề, âm thanh, rồi màn kết
export function previewAsRecipient() {
    if (state.events.length === 0) return;
    if (state.activeEventId) {
        state.activeEventId = null;
        showActiveEvent(null);
        renderInspector();
    }
    stopPreviewMusic();
    if (!previewSoundOn) {
        previewSoundOn = true;
        updateSoundPreviewButton();
    }
    unlockPreviewMusic();
    setPreviewMode('once');
    const info = document.getElementById('mini-preview-info');
    if (info) info.innerText = 'Chạm vào khung xem nhanh để mở quà như người nhận';
    sendPreview(true, { startFrame: true });
}

function startPreviewMusic() {
    const audio = getMusicAudio();
    if (!state.music || !audio) return;
    clearTimeout(previewMusicStopTimer);
    previewMusicPlaying = true;
    audio.muted = false;
    audio.volume = state.music.volume ?? 0.8;
    try {
        audio.currentTime = state.music.start || 0;
    } catch (e) {
        // Chưa tải xong thông tin bài nhạc: phát từ đầu
    }
    audio.play().catch(() => notify('Trình duyệt chặn phát nhạc, hãy bấm nút âm thanh ở khung xem nhanh lần nữa.', 'warning'));
    clearInterval(previewClockTimer);
    previewClockTimer = setInterval(sendPreviewClock, 250);
}

export function stopPreviewMusic() {
    previewMusicPlaying = false;
    clearInterval(previewClockTimer);
    getMusicAudio()?.pause();
}

export function previewConfig() {
    // Mở tab ngay lúc bấm nút: nếu đợi lưu xong mới mở, trình duyệt (nhất là Safari/iPhone) sẽ chặn popup
    const previewWindow = window.open('', '_blank');
    saveConfig(true).then(filename => {
        if (filename) {
            if (previewWindow) previewWindow.location.href = getShowUrl(filename);
            else window.open(getShowUrl(filename), '_blank');
        } else if (previewWindow) {
            previewWindow.close();
        }
    }).catch(err => {
        // Lỗi đã được hiển thị trong saveConfig
        if (previewWindow) previewWindow.close();
    });
}

// Kích thước màn hình được giả lập. Trình phát xử lý điện thoại khác máy tính (thu hẹp vùng bắn, pháo nhỏ hơn).
const PREVIEW_DEVICES = {
    // Mở builder trên máy tính thì giả lập đúng màn hình đang dùng, mở trên máy nhỏ thì giả lập 1366x768
    desktop: () => window.innerWidth >= 1024
        ? { width: window.innerWidth, height: Math.max(600, window.innerHeight) }
        : { width: 1366, height: 768 },
    mobile: () => ({ width: 390, height: 844 })
};

export let previewDevice = 'desktop';

export let previewReady = false;

// 'loop': lặp cả kịch bản, 'once': đang chạy một lượt, 'idle': không lặp và chưa bấm chạy
export let previewMode = 'loop';

// Đặt chế độ khung xem nhanh ('loop' chạy lặp, 'once' chạy một lượt, 'idle' dừng) từ phần khác của builder
export function setPreviewMode(mode) {
    previewMode = mode;
}

let previewRefreshTimer = null;

export function getPreviewFrame() {
    return document.getElementById('mini-preview-frame');
}

// Gửi kịch bản hiện tại sang trình phát. restart = true: chạy lại ngay từ đợt đầu.
// extra.intro: chạy từ đầu kèm tiêu đề mở đầu; extra.startFrame: hiện màn mở quà, chờ chạm mở như người nhận
export function sendPreview(restart, extra = {}) {
    clearTimeout(previewRefreshTimer);
    const frame = getPreviewFrame();
    if (!state.miniPreviewEnabled || !previewReady || !frame || !frame.contentWindow) return;

    const config = getFinalConfig();
    const index = state.activeEventId ? state.events.findIndex(e => e.id === state.activeEventId) : -1;
    if (index !== -1) {
        // Đang chọn một phát bắn: chỉ bắn lặp lại phát đó (nhạc không còn khớp nhịp nên dừng)
        config.loop = true;
        config.events = [{ ...config.events[index], burst: 1, delay: 0 }];
        config.music = undefined;
        if (previewMusicPlaying) stopPreviewMusic();
    } else if (previewMode === 'idle') {
        config.events = [];
    } else {
        config.loop = previewMode === 'loop';
    }
    const wholeScript = index === -1 && previewMode !== 'idle';
    frame.contentWindow.postMessage({
        type: 'firework-preview', config, restart, sound: previewSoundOn,
        intro: !!extra.intro && wholeScript, startFrame: !!extra.startFrame && wholeScript, endScreen: !!extra.endScreen
    }, window.location.origin);
}

// Tạm dừng / chạy tiếp khung xem nhanh (lúc đang tạo video)
export function pauseMiniPreview(paused) {
    const frame = getPreviewFrame();
    if (previewReady && frame && frame.contentWindow) frame.contentWindow.postMessage({ type: 'firework-preview-pause', paused }, window.location.origin);
}

// Gom các thay đổi liên tiếp rồi mới gửi một lần. Đang xem riêng một phát bắn thì bắn lại ngay để thấy thay đổi,
// còn khi xem cả kịch bản thì chỉ cập nhật cho các đợt tiếp theo.
export function refreshMiniPreview() {
    clearTimeout(previewRefreshTimer);
    previewRefreshTimer = setTimeout(() => sendPreview(!!state.activeEventId), 300);
}

export function updateMiniInfo() {
    const info = document.getElementById('mini-preview-info');
    if (!info) return;
    const index = state.activeEventId ? state.events.findIndex(e => e.id === state.activeEventId) : -1;
    if (index !== -1) info.innerText = 'Đang hiển thị phát bắn #' + (index + 1);
    else if (previewMode === 'once') info.innerText = 'Đang chạy kịch bản...';
    else if (previewMode === 'idle') info.innerText = 'Bấm ▶ để chạy kịch bản';
    else info.innerText = 'Đang hiển thị toàn bộ';
}

window.addEventListener('message', (e) => {
    if (e.origin !== window.location.origin || !e.data) return;
    if (e.data.type === 'firework-preview-ready' && e.source === getPreviewFrame()?.contentWindow) {
        previewReady = true;
        sendPreview(true);
    } else if (e.data.type === 'firework-preview-started' && previewSoundOn && !state.activeEventId) {
        startPreviewMusic();
        if (previewMode === 'once') updateMiniInfo();
    } else if (e.data.type === 'firework-preview-replay') {
        playMiniPreviewOnce();
    } else if (e.data.type === 'firework-preview-interactive') {
        // Màn mở quà / màn kết đang hiện trong khung: cho chạm (mở quà, Xem lại)
        document.getElementById('mini-preview-stage')?.classList.toggle('is-interactive', !!e.data.on);
    } else if (e.data.type === 'firework-preview-ended' && previewMode === 'once' && !state.activeEventId) {
        setPreviewMode('idle');
        const info = document.getElementById('mini-preview-info');
        if (info) info.innerText = 'Đã chạy xong';
        if (previewMusicPlaying) previewMusicStopTimer = setTimeout(stopPreviewMusic, 3000);
    }
});

function loadPreviewFrame() {
    previewReady = false;
    resizeMiniStages();
    getPreviewFrame().src = 'index.html?preview=1';
}

// Đặt iframe ở kích thước màn hình giả lập rồi thu nhỏ cho vừa khung xem nhanh (giữ đúng tỉ lệ)
export function resizeMiniStages() {
    const card = document.getElementById('mini-preview');
    const container = document.querySelector('.mini-preview-canvas-container');
    const stage = document.getElementById('mini-preview-stage');
    const frame = getPreviewFrame();
    if (!card || !container || !stage || !frame || card.classList.contains('collapsed')) return;
    const { width, height } = PREVIEW_DEVICES[previewDevice]();

    if (!card.classList.contains('fullscreen')) {
        // Chiều cao khung theo tỉ lệ màn hình giả lập, chừa chỗ cho bảng chỉnh sửa/danh sách bên dưới
        const maxHeight = window.innerHeight * (window.innerWidth < 768 ? 0.34 : 0.42);
        container.style.height = Math.round(Math.min(container.clientWidth * height / width, maxHeight)) + 'px';
    }

    const scale = Math.min(container.clientWidth / width, container.clientHeight / height) || 0.01;
    frame.style.width = width + 'px';
    frame.style.height = height + 'px';
    frame.style.transform = `scale(${scale})`;
    stage.style.width = width * scale + 'px';
    stage.style.height = height * scale + 'px';
    // Khung hẹp (xem kiểu điện thoại trên màn hình nhỏ): thước ngang chỉ ghi 0 và 100 cho khỏi dính chữ
    stage.classList.toggle('narrow', width * scale < 160);
    positionMobileSheet();
}

function updateMiniRulers() {
    const rulerX = document.getElementById('mini-ruler-x');
    const rulerY = document.getElementById('mini-ruler-y');
    if (!rulerX || !rulerY) return;

    rulerX.innerHTML = '';
    rulerY.innerHTML = '';

    const steps = [0, 20, 40, 60, 80, 100];

    steps.forEach(s => {
        const spanX = document.createElement('span');
        spanX.innerText = s;
        rulerX.appendChild(spanX);

        const spanY = document.createElement('span');
        // Y ruler: 100 is top, 0 is bottom
        spanY.innerText = 100 - s;
        rulerY.appendChild(spanY);
    });
}

// Ẩn/hiện khung xem nhanh. Khi ẩn thì dừng hẳn trình phát bên trong để không tốn CPU.
export function toggleMiniPreview(force) {
    state.miniPreviewEnabled = force !== undefined ? force : !state.miniPreviewEnabled;
    const card = document.getElementById('mini-preview');
    const btn = document.getElementById('btn-toggle-mini-preview');
    card.classList.toggle('collapsed', !state.miniPreviewEnabled);
    if (btn) btn.title = state.miniPreviewEnabled ? 'Thu gọn xem nhanh' : 'Mở xem nhanh';

    if (state.miniPreviewEnabled) {
        setPreviewMode(document.getElementById('loop').checked ? 'loop' : 'idle');
        updateMiniRulers();
        updateMiniInfo();
        loadPreviewFrame();
    } else {
        previewReady = false;
        stopPreviewMusic();
        getPreviewFrame().src = 'about:blank';
    }
    positionMobileSheet();
}

export function setPreviewDevice(device) {
    previewDevice = device;
    const isMobile = device === 'mobile';
    const btn = document.getElementById('btn-device-mini');
    if (btn) {
        btn.innerHTML = `<i class="fas fa-${isMobile ? 'mobile-screen' : 'desktop'}"></i>`;
        btn.title = isMobile
            ? 'Đang xem như trên điện thoại - bấm để xem như trên máy tính'
            : 'Đang xem như trên máy tính - bấm để xem như trên điện thoại';
    }
}

export function togglePreviewDevice() {
    setPreviewDevice(previewDevice === 'desktop' ? 'mobile' : 'desktop');
    // Khung chọn vị trí đổi theo tỉ lệ màn hình mới
    renderInspector();
    // Trình phát xác định máy tính/điện thoại lúc tải trang nên phải tải lại
    if (state.miniPreviewEnabled) loadPreviewFrame();
}

// Chạy lại từ đầu (không lặp thì chạy một lượt)
export function restartMiniPreview() {
    if (previewMode === 'idle') playMiniPreviewOnce();
    else sendPreview(true, { intro: true });
}

export function toggleFullscreenMiniPreview() {
    const el = document.getElementById('mini-preview');
    // iPhone không hỗ trợ toàn màn hình cho phần tử thường: báo thay vì ném lỗi
    if (!fscreen.fullscreenEnabled) {
        notify('Trình duyệt này không hỗ trợ chế độ toàn màn hình.', 'warning');
        return;
    }
    if (!fscreen.fullscreenElement) {
        fscreen.requestFullscreen(el);
    } else {
        fscreen.exitFullscreen();
    }
}

// Handle fullscreen changes to resize canvas
fscreen.onfullscreenchange = () => {
    const el = document.getElementById('mini-preview');
    if (fscreen.fullscreenElement) {
        el.classList.add('fullscreen');
        notify('Đã vào chế độ toàn màn hình', 'info');
    } else {
        el.classList.remove('fullscreen');
    }
    // Small delay to ensure DOM is updated
    setTimeout(resizeMiniStages, 100);
};

export function playMiniPreviewOnce() {
    if (state.events.length === 0) return;
    setPreviewMode('once');
    updateMiniInfo();
    sendPreview(true, { intro: true });
}
