/*!
 * Trình diễn Pháo hoa – xuất video
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Dùng chung cho builder (Xuất video) và người nhận (Tạo video): khung quay (index.html?record=1) chạy chính trình phát
// ở cỡ video đã chọn, quay lại màn trình diễn kèm tiếng pháo và nhạc nền (xem recorder.js) rồi gửi file video về trang.
import { eventTimes } from './timeline.js';

// frame: cỡ khung (px) như màn hình thật để pháo bố trí đúng kiểu; size: cỡ video theo chất lượng
export const VIDEO_FORMATS = [
    { value: 'portrait', icon: '📱', name: 'Dọc 9:16', hint: 'TikTok, Reels, Shorts, Story', frame: [405, 720], size: { fhd: [1080, 1920], hd: [720, 1280] } },
    { value: 'landscape', icon: '🖥️', name: 'Ngang 16:9', hint: 'YouTube, Facebook', frame: [1280, 720], size: { fhd: [1920, 1080], hd: [1280, 720] } },
    { value: 'square', icon: '⬛', name: 'Vuông 1:1', hint: 'Bài đăng Facebook, Instagram', frame: [720, 720], size: { fhd: [1080, 1080], hd: [720, 720] } }
];
export const VIDEO_BITRATES = { fhd: 8e6, hd: 4e6 };
// Sau đợt cuối: chờ pháo tàn (4,5 giây) rồi thiệp lời chúc (4 giây)
const VIDEO_TAIL_SECONDS = 8.5;

export function canRecordVideoHere() {
    const canvas = document.createElement('canvas');
    return !!(window.MediaRecorder && canvas.captureStream);
}

// Thời lượng video dự kiến (giây): các đợt như trình phát, cộng lúc chờ đầu và cuối
export function estimateVideoLength(events, sync) {
    // 1,5 giây trời đêm đầu video (chờ bộ mã hóa video khởi động) + 0,8 giây tới phát đầu tiên;
    // kịch bản khớp nhịp phóng pháo đầu tiên sớm hơn nhạc khoảng 2,5 giây
    return eventTimes(events).end / 1000 + 1.5 + 0.8 + (sync ? 2.5 : 0) + VIDEO_TAIL_SECONDS;
}

// Dung lượng tối đa dự kiến (MB)
export function estimateVideoMegabytes(quality, seconds) {
    return Math.max(1, Math.round((VIDEO_BITRATES[quality] + 160000) * seconds / 8 / 1e6));
}

export function formatClock(seconds) {
    const s = Math.max(0, Math.round(seconds));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function videoExtension(blob) {
    return blob && /mp4/.test(blob.type) ? 'mp4' : 'webm';
}

/**
 * Dựng khung quay trong `box` ở cỡ màn hình thật rồi thu nhỏ cho vừa maxW × maxH, gửi `config` sang và báo từng bước:
 * onPrepared({ supported, musicCaptured }), onStarted(), onProgress(elapsed), onDone(blob, elapsed).
 * Người dùng bấm "Bắt đầu quay" ngay trong khung (trình duyệt chỉ cho phát tiếng sau một lần bấm).
 */
export function createRecordFrame({ box, format, quality, config, maxW, maxH, onPrepared, onStarted, onProgress, onDone }) {
    const [frameW, frameH] = format.frame;
    const [width, height] = format.size[quality];
    const scale = Math.min(maxW / frameW, maxH / frameH);
    box.style.width = `${Math.round(frameW * scale)}px`;
    box.style.height = `${Math.round(frameH * scale)}px`;
    const frame = document.createElement('iframe');
    frame.title = 'Khung quay video';
    frame.allow = 'autoplay';
    frame.style.width = `${frameW}px`;
    frame.style.height = `${frameH}px`;
    frame.style.transform = `scale(${scale})`;
    frame.src = `index.html?record=1&scale=${width / frameW}`;
    box.replaceChildren(frame);

    const onMessage = (e) => {
        const msg = e.data;
        if (e.origin !== window.location.origin || !msg || e.source !== frame.contentWindow) return;
        if (msg.type === 'firework-record-frame-ready') {
            frame.contentWindow.postMessage({
                type: 'firework-record-load',
                config,
                options: { width, height, fps: 30, bitrate: VIDEO_BITRATES[quality] }
            }, window.location.origin);
        } else if (msg.type === 'firework-record-prepared') {
            onPrepared(msg);
        } else if (msg.type === 'firework-record-started') {
            onStarted();
        } else if (msg.type === 'firework-record-progress') {
            onProgress(msg.elapsed);
        } else if (msg.type === 'firework-record-done') {
            remove();
            onDone(msg.blob, msg.elapsed);
        }
    };
    window.addEventListener('message', onMessage);

    function remove() {
        window.removeEventListener('message', onMessage);
        frame.remove();
    }

    return {
        size: [width, height],
        // Dừng giữa chừng: khung gửi về phần đã quay
        stop() {
            frame.contentWindow.postMessage({ type: 'firework-record-stop' }, window.location.origin);
        },
        remove
    };
}
