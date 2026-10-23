/*!
 * Hanabi – trình phát (dựng video, chụp ảnh)
 * Phần bổ sung và chỉnh sửa © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Dựng video theo khung hình (không chờ thời gian thật), ghép các lớp thành ảnh chụp.

import { createFrameComposer } from '../../recorder.js';
import { now } from '../clock.js';
import { normalizeAssetPath } from '../utils.js';
import { soundManager } from '../audio.js';
import { frameText } from '../start-frames.js';
import { appNodes, burstConfig, decoCanvas, frontCanvas, mainStage, skyCanvas, smokeCanvas, trailsStage, waterCanvas } from '../../script.js';

// Chờ trước phát pháo đầu tiên, và thời gian thiệp lời chúc ở cuối video (ms)
export const RECORD_LEAD = 800;

const RECORD_END_CARD = 4000;

export const RECORD_FPS = 30;

// Giới hạn an toàn: kịch bản hỏng không làm video dài mãi
export const RECORD_MAX_MS = 20 * 60 * 1000;

export const recording = {
    // Đang dựng: vòng lặp của Ticker đứng ngoài, chỉ vòng dựng mới cho mô phỏng bước tiếp (xem update())
    active: false,
    stepping: false,
    composer: null,
    // Mốc (đồng hồ giả lập) hết thiệp lời chúc, tức là hết video
    endsAt: null
};

export function postToBuilder(message) {
    window.parent.postMessage(message, window.location.origin);
}

// Nhạc nền để trộn vào video: file cùng tên miền (hoặc link cho phép CORS); link ngoài không đọc được thì bỏ qua
export async function loadMusicForVideo(music) {
    if (!music || !music.url) return null;
    try {
        const response = await fetch(normalizeAssetPath(music.url));
        if (!response.ok) return null;
        const buffer = await soundManager.ctx.decodeAudioData(await response.arrayBuffer());
        const volume = Number(music.volume);
        return {
            buffer,
            offset: Math.max(0, Number(music.start) || 0),
            volume: Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 0.8,
            // Như khi xem thật: kịch bản khớp nhịp hết bài thì thôi, còn lại phát lặp
            loop: !music.sync
        };
    } catch (e) {
        return null;
    }
}

// Hiệu ứng CSS (tiêu đề hiện dần rồi mờ đi, lời nhắn hiện/ẩn, con trỏ gõ chữ) đi theo đồng hồ giả lập: dừng lại và
// tua đúng `ms` mỗi khung; hiệu ứng mới xuất hiện trong khung này bắt đầu từ 0
const steppedAnimations = new WeakSet();

export function stepAnimations(ms) {
    document.getAnimations().forEach(animation => {
        if (!steppedAnimations.has(animation)) {
            steppedAnimations.add(animation);
            animation.pause();
            animation.currentTime = 0;
        } else {
            animation.currentTime = (Number(animation.currentTime) || 0) + ms;
        }
    });
}

// Màn trình diễn đã chạy hết (lúc màn kết hiện ra khi xem thật): kết video bằng thiệp lời chúc
export function finishRecording() {
    if (!recording.composer || recording.endsAt !== null) return;
    const config = burstConfig;
    recording.composer.setEndCard({
        title: config.title,
        message: frameText(config.outroMessage) || config.subtitle,
        from: config.author
    });
    recording.endsAt = now() + RECORD_END_CARD;
}

// Những gì có trên khung hình: ảnh nền, các lớp pháo (dưới lên trên), người ngắm pháo, tiêu đề và lời nhắn (xem
// recorder.js)
export function frameSources() {
    return {
        container: appNodes.stageContainer,
        background: appNodes.backgroundImage,
        layers: [skyCanvas, decoCanvas, smokeCanvas, trailsStage.canvas, mainStage.canvas, waterCanvas],
        front: [frontCanvas],
        texts: () => [...document.querySelectorAll('.config-overlay h1, .config-overlay h2, .config-overlay p, .caption-layer .caption')]
    };
}

// ---------------------------------------------------------------------------
// NGƯỜI NHẬN CHỤP KHOẢNH KHẮC, CHIA SẺ, TẠO VIDEO (xem viewer-share.js)
// ---------------------------------------------------------------------------

// Ảnh chụp đúng độ phân giải canvas pháo; giữ lại bộ ghép để ảnh nền chỉ tải một lần
let snapshotComposer = null;

export async function composeSnapshot() {
    const { width, height } = mainStage.canvas;
    if (!snapshotComposer || snapshotComposer.canvas.width !== width || snapshotComposer.canvas.height !== height) {
        snapshotComposer = createFrameComposer({ width, height, ...frameSources() });
    }
    await snapshotComposer.load();
    snapshotComposer.paint();
    return snapshotComposer.canvas;
}
