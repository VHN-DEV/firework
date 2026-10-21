/*!
 * Trình diễn Pháo hoa – xuất video
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Dùng chung cho builder và người nhận (Tạo video): khung ẩn (index.html?record=1) chạy chính trình phát ở cỡ video đã
// chọn, dựng màn trình diễn thành file MP4 nhanh hết mức máy cho phép (không phải chờ theo thời gian thật), kèm tiếng
// pháo và nhạc nền, rồi gửi file về trang (xem recorder.js).
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

export const VIDEO_UNSUPPORTED = 'Trình duyệt này chưa tạo được video. Hãy dùng Chrome, Edge hoặc Safari bản mới.';

// Trình duyệt mã hóa được video (WebCodecs) và trộn được tiếng; cấu hình cụ thể còn được khung dựng kiểm tra lại
export function canRecordVideoHere() {
    return typeof VideoEncoder !== 'undefined' && typeof VideoFrame !== 'undefined' && typeof OfflineAudioContext !== 'undefined';
}

// Thời lượng video dự kiến (giây): các đợt như trình phát, cộng lúc chờ đầu và cuối
export function estimateVideoLength(events, sync) {
    // 0,8 giây tới phát đầu tiên; kịch bản khớp nhịp phóng pháo đầu tiên sớm hơn nhạc khoảng 2,5 giây
    return eventTimes(events).end / 1000 + 0.8 + (sync ? 2.5 : 0) + VIDEO_TAIL_SECONDS;
}

// Dung lượng tối đa dự kiến (MB)
export function estimateVideoMegabytes(quality, seconds) {
    return Math.max(1, Math.round((VIDEO_BITRATES[quality] + 160000) * seconds / 8 / 1e6));
}

export function formatClock(seconds) {
    const s = Math.max(0, Math.round(seconds));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * Dựng video `config` trong một khung ẩn, báo tiến độ onProgress(0-1, phase: 'frames' | 'audio'), xong thì
 * onDone(blob, seconds, { musicCaptured, hasAudio }), lỗi thì onError(thông báo cho người dùng).
 * length: thời lượng dự kiến (giây) để tính tiến độ. Trả về { size, cancel() }.
 */
export function createVideoJob({ format, quality, config, length, onProgress, onDone, onError }) {
    const [frameW, frameH] = format.frame;
    const [width, height] = format.size[quality];
    // Khung có cỡ như màn hình thật để chữ, pháo bố trí đúng; nằm ngoài tầm nhìn, không nhận chạm
    const host = document.createElement('div');
    host.setAttribute('aria-hidden', 'true');
    host.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;z-index:-1';
    const frame = document.createElement('iframe');
    frame.title = 'Khung dựng video';
    frame.tabIndex = -1;
    frame.style.cssText = `width:${frameW}px;height:${frameH}px;border:0`;
    frame.src = `index.html?record=1&scale=${width / frameW}`;
    host.appendChild(frame);
    document.body.appendChild(host);

    const onMessage = (e) => {
        const msg = e.data;
        if (e.origin !== window.location.origin || !msg || e.source !== frame.contentWindow) return;
        if (msg.type === 'firework-record-frame-ready') {
            frame.contentWindow.postMessage({
                type: 'firework-record-load',
                config,
                options: { width, height, bitrate: VIDEO_BITRATES[quality], length }
            }, window.location.origin);
        } else if (msg.type === 'firework-record-progress') {
            onProgress(msg.progress, msg.phase);
        } else if (msg.type === 'firework-record-done') {
            cancel();
            onDone(msg.blob, msg.elapsed, { musicCaptured: msg.musicCaptured, hasAudio: msg.hasAudio });
        } else if (msg.type === 'firework-record-error') {
            cancel();
            onError(msg.message === 'unsupported' ? VIDEO_UNSUPPORTED : 'Không tạo được video. Hãy thử lại hoặc dùng trình duyệt khác.');
        }
    };
    window.addEventListener('message', onMessage);

    function cancel() {
        window.removeEventListener('message', onMessage);
        host.remove();
    }

    return { size: [width, height], cancel };
}
