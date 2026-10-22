/*!
 * Trình diễn Pháo hoa – builder (xuất video)
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Hộp xuất video: khổ, chất lượng, tạo, tải về, chia sẻ.

import { VIDEO_FORMATS, VIDEO_UNSUPPORTED, canRecordVideoHere, createVideoJob, estimateVideoLength, estimateVideoMegabytes, formatClock } from '../video-export.js';
import { state } from './state.js';
import { hideModal, normalizeAssetPath, notify, showModal } from './util.js';
import { isFireworkShot, isSyncMode } from './timeline.js';
import { toSlug } from './images.js';
import { pauseMiniPreview, previewMode, previewMusicPlaying, sendPreview, setPreviewMode, stopPreviewMusic, updateMiniInfo } from './preview.js';
import { getFinalConfig } from './config.js';
import { closeMoreMenu } from './layout.js';

const video = {
    format: 'portrait',
    quality: 'fhd',
    // 'setup' | 'rendering' | 'done'
    step: 'setup',
    job: null,
    url: '',
    blob: null,
    length: 0,
    size: [0, 0],
    previousPreviewMode: null
};

// Nhạc dán link từ trang khác: trình duyệt không cho đọc để đưa vào video
function isExternalMusic() {
    if (!state.music) return false;
    const url = normalizeAssetPath(state.music.url);
    if (/^(data:|blob:)/i.test(url)) return false;
    try {
        return new URL(url, window.location.href).origin !== window.location.origin;
    } catch (e) {
        return false;
    }
}

export function openVideoModal() {
    if (!state.events.some(isFireworkShot)) {
        notify('Kịch bản chưa có phát pháo nào để tạo video.', 'warning');
        return;
    }
    closeMoreMenu();
    video.step = 'setup';
    renderVideoModal();
    showModal('video-modal');
}

export function setVideoFormat(value) {
    video.format = value;
    renderVideoModal();
}

export function setVideoQuality(value) {
    video.quality = value;
    renderVideoModal();
}

function renderVideoModal() {
    const step = video.step;
    document.getElementById('video-setup').classList.toggle('hide', step !== 'setup');
    document.getElementById('video-stage').classList.toggle('hide', step !== 'rendering');
    document.getElementById('video-result').classList.toggle('hide', step !== 'done');
    const actions = document.getElementById('video-actions');

    if (step === 'setup') {
        document.getElementById('video-formats').innerHTML = VIDEO_FORMATS.map(f => `
            <button type="button" class="shell-option${video.format === f.value ? ' selected' : ''}" onclick="setVideoFormat('${f.value}')">
                <span class="emoji">${f.icon}</span>${f.name}<small>${f.hint}</small>
            </button>`).join('');
        document.querySelectorAll('.video-qualities button').forEach(btn => btn.classList.toggle('active', btn.dataset.quality === video.quality));
        const format = VIDEO_FORMATS.find(f => f.value === video.format);
        const [width, height] = format.size[video.quality];
        video.length = estimateVideoLength(state.events, isSyncMode());
        const megabytes = estimateVideoMegabytes(video.quality, video.length);
        const notes = [
            `Video MP4 ${width}×${height}, dài khoảng <strong>${formatClock(video.length)}</strong>, nặng tối đa khoảng ${megabytes} MB; có tiêu đề, lời nhắn, nhạc nền và thiệp lời chúc ở cuối.`,
            'Không cần ngồi xem hết: video được dựng ngay trên máy bạn, nhanh hết mức máy cho phép. Giữ trang này mở tới khi xong.'
        ];
        if (isExternalMusic()) notes.push('<span class="warn">Nhạc dán từ link trang khác không đưa được vào video. Muốn có nhạc, hãy chọn file nhạc từ máy ở mục Nhạc nền.</span>');
        if (!canRecordVideoHere()) notes.push(`<span class="warn">${VIDEO_UNSUPPORTED}</span>`);
        document.getElementById('video-notes').innerHTML = notes.map(n => `<li>${n}</li>`).join('');
        actions.innerHTML = `
            <button class="btn secondary" onclick="closeVideoModal()">Hủy</button>
            <button id="btn-video-create" class="btn primary" onclick="createVideo()" ${canRecordVideoHere() ? '' : 'disabled'}>
                <i class="fas fa-wand-magic-sparkles"></i> Tạo video</button>`;
    } else if (step === 'done') {
        const canShare = navigator.canShare && navigator.canShare({ files: [videoFile()] });
        actions.innerHTML = `
            <button class="btn secondary" onclick="restartVideo()"><i class="fas fa-rotate-left"></i> Tạo lại</button>
            ${canShare ? '<button class="btn secondary" onclick="shareVideo()"><i class="fas fa-share-nodes"></i> Chia sẻ</button>' : ''}
            <button id="btn-video-download" class="btn primary" onclick="downloadVideo()"><i class="fas fa-download"></i> Tải video</button>`;
    } else {
        actions.innerHTML = '<button class="btn secondary" onclick="closeVideoModal()">Hủy</button>';
    }
}

function setVideoStatus(text, progress) {
    document.getElementById('video-status').innerHTML = text;
    if (progress !== undefined) document.getElementById('video-progress-bar').style.width = `${Math.min(100, progress * 100)}%`;
}

export function createVideo() {
    video.step = 'rendering';
    renderVideoModal();
    setVideoStatus('Đang chuẩn bị âm thanh, hình ảnh và nhạc nền...', 0);

    // Khung xem nhanh nghỉ trong lúc dựng cho đỡ nặng máy
    if (previewMusicPlaying) stopPreviewMusic();
    // Tạo lại lần nữa: giữ trạng thái khung xem nhanh từ trước lần đầu
    if (video.previousPreviewMode === null) video.previousPreviewMode = previewMode;
    setPreviewMode('idle');
    sendPreview(true);
    // Dừng hẳn khung xem nhanh (người ngắm pháo dựng bằng WebGL: hai khung cùng dựng thì card đồ họa quá tải)
    pauseMiniPreview(true);

    video.job = createVideoJob({
        format: VIDEO_FORMATS.find(f => f.value === video.format),
        quality: video.quality,
        config: getFinalConfig(),
        length: video.length,
        onProgress(progress, phase) {
            if (video.step !== 'rendering') return;
            setVideoStatus(phase === 'audio'
                ? 'Đang ghép tiếng pháo và nhạc nền...'
                : `Đang tạo video <strong>${Math.round(progress * 100)}%</strong> · giữ trang này mở`, progress);
        },
        onDone: showRecordedVideo,
        onError(message) {
            video.job = null;
            video.step = 'setup';
            renderVideoModal();
            notify(message, 'error');
        }
    });
    video.size = video.job.size;
}

function videoFile() {
    const name = document.getElementById('filename').value.trim() || toSlug(document.getElementById('title').value) || 'phao-hoa';
    return new File([video.blob || new Blob()], `${name}.mp4`, { type: 'video/mp4' });
}

function showRecordedVideo(blob, elapsed, { musicCaptured, hasAudio }) {
    video.job = null;
    video.blob = blob;
    if (video.url) URL.revokeObjectURL(video.url);
    video.url = URL.createObjectURL(blob);
    const player = document.getElementById('video-output');
    player.src = video.url;
    // Video mở đầu bằng trời tối: khung xem trước dừng ở lúc đã có pháo
    player.addEventListener('loadedmetadata', () => { player.currentTime = Math.min(4, player.duration / 3 || 0); }, { once: true });
    document.getElementById('video-info').innerHTML = `MP4 · ${video.size[0]}×${video.size[1]} · ${formatClock(elapsed)}`
        + ` · ${(blob.size / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} MB`
        + (!hasAudio ? '<br><span class="warn">Trình duyệt này chưa ghi được tiếng vào video; dùng Chrome hoặc Edge để có tiếng pháo và nhạc nền.</span>'
            : musicCaptured ? '' : '<br><span class="warn">Video không có nhạc nền (nhạc từ link trang khác).</span>');
    video.step = 'done';
    renderVideoModal();
}

export function downloadVideo() {
    if (!video.url) return;
    const link = document.createElement('a');
    link.href = video.url;
    link.download = videoFile().name;
    document.body.appendChild(link);
    link.click();
    link.remove();
}

export async function shareVideo() {
    try {
        await navigator.share({ files: [videoFile()], title: document.getElementById('title').value || 'Màn pháo hoa' });
    } catch (e) {
        // Người dùng đóng bảng chia sẻ
    }
}

export function restartVideo() {
    document.getElementById('video-output').removeAttribute('src');
    video.step = 'setup';
    renderVideoModal();
}

function cancelVideoJob() {
    if (video.job) video.job.cancel();
    video.job = null;
}

export function closeVideoModal() {
    cancelVideoJob();
    const player = document.getElementById('video-output');
    player.pause();
    player.removeAttribute('src');
    if (video.url) URL.revokeObjectURL(video.url);
    video.url = '';
    video.blob = null;
    video.step = 'setup';
    hideModal('video-modal');
    // Khung xem nhanh chạy lại như trước
    pauseMiniPreview(false);
    if (video.previousPreviewMode !== null) {
        setPreviewMode(video.previousPreviewMode);
        video.previousPreviewMode = null;
        updateMiniInfo();
        sendPreview(true);
    }
}

// ---------------------------------------------------------------------------
// CHIA SẺ & SEO: tiêu đề, mô tả, ảnh hiện ra khi gửi link
// ---------------------------------------------------------------------------
