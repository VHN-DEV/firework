/*!
 * Trình diễn Pháo hoa – người nhận chụp khoảnh khắc, chia sẻ, tạo video
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Trên trang xem: nút 📷 (phím C) chụp khung hình đang hiện (ảnh nền, pháo, chữ) thành ảnh JPEG; nút chia sẻ mở bảng
// gửi link lên mạng xã hội, xem lại ảnh đã chụp và tạo video (TikTok, Reels, Shorts...) bằng khung quay của builder.
// Ảnh và video làm ngay trên máy người xem, không tải lên máy chủ. Người tạo tắt được (kịch bản receiverShare: false).
import { availablePlatforms, copyText, platformIcon, shareLink } from './share-targets.js';
import {
    VIDEO_FORMATS, canRecordVideoHere, createRecordFrame, estimateVideoLength, estimateVideoMegabytes, formatClock, videoExtension
} from './video-export.js';

// Biểu tượng mạng xã hội (cùng bản với builder), chỉ tải khi mở bảng chia sẻ
const FONT_AWESOME = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css';
// Giữ tối đa chừng ấy ảnh đã chụp trong phiên xem (ảnh cũ nhất bị bỏ)
const MAX_MOMENTS = 24;

const $ = selector => document.querySelector(selector);
const isMobile = () => window.matchMedia('(pointer: coarse)').matches;

function saveFile(url, name) {
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
}

const canShareFile = file => !!(navigator.canShare && navigator.canShare({ files: [file] }));

async function shareFile(file, title) {
    try {
        await navigator.share({ files: [file], title });
    } catch (e) {
        // Người dùng đóng bảng chia sẻ
    }
}

/**
 * composeFrame(): Promise<canvas> khung hình đang hiện; describe(): { title, description } của màn trình diễn;
 * pauseShow(paused): tạm dừng/chạy tiếp, trả về trạng thái tạm dừng trước đó; configName: tên kịch bản (link quà) hoặc null;
 * preview: bản xem nhanh trong builder (chỉ báo cho người tạo biết nút dùng làm gì); reduceFlashing(): không chớp khi chụp;
 * off: không dùng tới (khung quay video, ảnh đầu trang hồ sơ).
 */
export function setupViewerShare({ composeFrame, describe, pauseShow, configName, preview, reduceFlashing, off }) {
    const bar = $('.moment-bar');
    const endShare = $('.end-screen__share');
    const shareSheet = $('.share-sheet');
    const videoSheet = $('.video-sheet');
    const snapToast = $('.snap-toast');
    const toast = $('.viewer-toast');
    const flashEl = $('.snap-flash');

    const show = { config: null, enabled: !off };
    bar.classList.toggle('remove', !!off);
    const moments = [];
    let shareUrlRequest = null;
    let snapping = false;
    let toastTimer = null;
    let snapToastTimer = null;

    // Các lớp phủ của bảng: chạm/bấm không lọt xuống bầu trời (Stage nghe trên document) làm bắn pháo hay mở menu
    const stop = e => e.stopPropagation();
    [bar, endShare, shareSheet, videoSheet, snapToast].forEach(el => {
        el.addEventListener('mousedown', stop);
        el.addEventListener('touchstart', stop);
    });

    function notify(message) {
        toast.textContent = message;
        toast.classList.remove('hide');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.add('hide'), 3600);
    }

    // ---- Mở/đóng bảng: màn trình diễn tạm dừng trong lúc mở, đóng hết thì chạy tiếp như trước
    const openSheets = new Set();
    let wasPaused = false;

    function openSheet(sheet) {
        if (!openSheets.size) wasPaused = pauseShow(true);
        openSheets.add(sheet);
        sheet.classList.remove('hide');
    }

    function closeSheet(sheet) {
        if (!openSheets.has(sheet)) return;
        openSheets.delete(sheet);
        sheet.classList.add('hide');
        if (!openSheets.size && !wasPaused) pauseShow(false);
    }

    [shareSheet, videoSheet].forEach(sheet => {
        sheet.querySelector('.sheet__close').addEventListener('click', () => (sheet === videoSheet ? closeVideo() : closeSheet(sheet)));
        // Bấm ra ngoài bảng thì đóng (trừ lúc đang quay)
        sheet.addEventListener('click', e => {
            if (e.target !== sheet) return;
            if (sheet === videoSheet) {
                if (!['preparing', 'ready', 'recording', 'saving'].includes(video.step)) closeVideo();
            } else {
                closeSheet(sheet);
            }
        });
    });

    // ---- Link chia sẻ: trang chia sẻ s/<tên>.html (khung xem trước đẹp trên mạng xã hội), chưa có thì link xem trực tiếp
    function shareUrl() {
        if (shareUrlRequest) return shareUrlRequest;
        if (!configName) return (shareUrlRequest = Promise.resolve(new URL('./', window.location.href).href));
        const page = new URL(`s/${encodeURIComponent(configName)}.html`, window.location.href).href;
        const direct = new URL(`index.html?config=${encodeURIComponent(configName)}`, window.location.href).href;
        shareUrlRequest = fetch(page, { method: 'HEAD', cache: 'no-store' })
            .then(r => (r.ok ? page : direct), () => direct);
        return shareUrlRequest;
    }

    function shareText() {
        const { title, description } = describe();
        return { title, text: `🎆 ${title}${description ? ` – ${description}` : ''}` };
    }

    const baseName = () => configName || 'phao-hoa';
    const canMakeVideo = () => !!(show.config && show.config.events.length) && canRecordVideoHere();

    function loadIcons() {
        if (document.querySelector(`link[href="${FONT_AWESOME}"]`)) return;
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = FONT_AWESOME;
        document.head.appendChild(link);
    }

    // ---- Bảng chia sẻ
    const urlInput = shareSheet.querySelector('.share-sheet__url');
    const grid = shareSheet.querySelector('.share-grid');

    async function openShare() {
        if (preview) {
            notify('Bản xem nhanh: người nhận bấm nút này để gửi link, tạo video (TikTok, Reels...) và lưu ảnh đã chụp.');
            return;
        }
        loadIcons();
        grid.innerHTML = availablePlatforms().map(p => `
            <button type="button" class="share-item" data-platform="${p.id}" title="Chia sẻ qua ${p.name}">
                ${platformIcon(p)}<span class="share-name">${p.name}</span>
            </button>`).join('');
        shareSheet.querySelector('.share-sheet__video').classList.toggle('remove', !canMakeVideo());
        renderMoments();
        openSheet(shareSheet);
        urlInput.value = await shareUrl();
    }

    grid.addEventListener('click', async e => {
        const item = e.target.closest('[data-platform]');
        if (!item) return;
        const url = await shareUrl();
        await shareLink(item.dataset.platform, { url, ...shareText() }, { notify, onMedia });
    });

    // Instagram, TikTok không nhận link từ web: đăng video dọc (hoặc ảnh đã chụp), link sao chép sẵn để dán vào mô tả
    async function onMedia(platform) {
        const name = platform === 'instagram' ? 'Instagram' : 'TikTok';
        await copyText(await shareUrl());
        if (!canMakeVideo()) {
            notify(`${name} chỉ nhận ảnh, video: hãy chụp khoảnh khắc (📷) rồi đăng kèm link vừa sao chép.`);
            return;
        }
        openVideo('portrait', `${name} chỉ nhận ảnh, video: tạo video dọc rồi đăng lên ${name}. Link đã được sao chép để bạn dán vào phần mô tả.`);
    }

    shareSheet.querySelector('.share-sheet__copy').addEventListener('click', async () => {
        const ok = await copyText(await shareUrl());
        notify(ok ? 'Đã sao chép link!' : 'Không thể sao chép tự động, hãy chọn link và sao chép thủ công.');
    });
    urlInput.addEventListener('focus', () => urlInput.select());
    shareSheet.querySelector('.share-sheet__video').addEventListener('click', () => openVideo());

    // ---- Chụp khoảnh khắc
    function flash() {
        if (reduceFlashing()) return;
        flashEl.classList.remove('is-on');
        void flashEl.offsetWidth;
        flashEl.classList.add('is-on');
    }

    function timeStamp() {
        const d = new Date();
        return [d.getHours(), d.getMinutes(), d.getSeconds()].map(n => String(n).padStart(2, '0')).join('');
    }

    async function snap() {
        if (!show.enabled || snapping) return;
        snapping = true;
        flash();
        try {
            const canvas = await composeFrame();
            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.92));
            if (!blob) throw new Error('toBlob');
            const moment = { blob, url: URL.createObjectURL(blob), name: `${baseName()}-khoanh-khac-${timeStamp()}.jpg` };
            moments.unshift(moment);
            moments.splice(MAX_MOMENTS).forEach(m => URL.revokeObjectURL(m.url));
            showSnapToast(moment);
            if (!shareSheet.classList.contains('hide')) renderMoments();
        } catch (e) {
            notify('Không chụp được ảnh, hãy thử lại.');
        } finally {
            snapping = false;
        }
    }

    const momentFile = m => new File([m.blob], m.name, { type: 'image/jpeg' });

    function showSnapToast(moment) {
        snapToast.querySelector('img').src = moment.url;
        snapToast.querySelector('.snap-toast__share').classList.toggle('remove', !canShareFile(momentFile(moment)));
        snapToast.moment = moment;
        snapToast.classList.remove('hide');
        clearTimeout(snapToastTimer);
        snapToastTimer = setTimeout(() => snapToast.classList.add('hide'), 5000);
    }

    snapToast.addEventListener('mouseenter', () => clearTimeout(snapToastTimer));
    snapToast.addEventListener('mouseleave', () => {
        snapToastTimer = setTimeout(() => snapToast.classList.add('hide'), 2500);
    });
    snapToast.addEventListener('click', e => {
        const moment = snapToast.moment;
        if (!moment) return;
        if (e.target.closest('.snap-toast__save')) saveFile(moment.url, moment.name);
        else if (e.target.closest('.snap-toast__share')) shareFile(momentFile(moment), shareText().title);
        else if (e.target.closest('.snap-toast__all')) openShare();
        else return;
        snapToast.classList.add('hide');
    });

    // Ảnh đã chụp trong bảng chia sẻ: lưu hoặc gửi từng ảnh
    const momentsBox = shareSheet.querySelector('.share-sheet__moments');

    function renderMoments() {
        momentsBox.classList.toggle('remove', !moments.length);
        momentsBox.querySelector('.share-sheet__count').textContent = moments.length;
        const canShare = moments.length && canShareFile(momentFile(moments[0]));
        momentsBox.querySelector('.moments').innerHTML = moments.map((m, i) => `
            <figure class="moment">
                <img src="${m.url}" alt="Khoảnh khắc ${moments.length - i}">
                <figcaption>
                    <button type="button" data-save="${i}">Lưu</button>
                    ${canShare ? `<button type="button" data-send="${i}">Gửi</button>` : ''}
                </figcaption>
            </figure>`).join('');
    }

    momentsBox.addEventListener('click', e => {
        const save = e.target.closest('[data-save]');
        const send = e.target.closest('[data-send]');
        if (save) {
            const m = moments[save.dataset.save];
            saveFile(m.url, m.name);
        } else if (send) {
            shareFile(momentFile(moments[send.dataset.send]), shareText().title);
        }
    });

    // ---- Tạo video: như builder > Xuất video, chạy trong bảng của trang xem
    const video = {
        format: 'portrait',
        // Điện thoại quay HD cho nhẹ máy, file nhỏ gửi nhanh
        quality: isMobile() ? 'hd' : 'fhd',
        // 'setup' | 'preparing' | 'ready' | 'recording' | 'saving' | 'done'
        step: 'setup',
        frame: null,
        blob: null,
        url: '',
        length: 0,
        size: [0, 0],
        intro: ''
    };
    const v = selector => videoSheet.querySelector(selector);

    function openVideo(format, intro = '') {
        if (!canMakeVideo()) return;
        if (format) video.format = format;
        video.intro = intro;
        video.step = 'setup';
        renderVideo();
        openSheet(videoSheet);
    }

    function renderVideo() {
        const step = video.step;
        v('.video-sheet__setup').classList.toggle('remove', step !== 'setup');
        v('.video-sheet__stage').classList.toggle('remove', !['preparing', 'ready', 'recording', 'saving'].includes(step));
        v('.video-sheet__result').classList.toggle('remove', step !== 'done');
        const actions = v('.sheet__actions');

        if (step === 'setup') {
            v('.video-formats').innerHTML = VIDEO_FORMATS.map(f => `
                <button type="button" class="video-format${video.format === f.value ? ' is-active' : ''}" data-format="${f.value}">
                    <span aria-hidden="true">${f.icon}</span><strong>${f.name}</strong><small>${f.hint}</small>
                </button>`).join('');
            videoSheet.querySelectorAll('[data-quality]').forEach(btn => btn.classList.toggle('is-active', btn.dataset.quality === video.quality));
            const format = VIDEO_FORMATS.find(f => f.value === video.format);
            const [width, height] = format.size[video.quality];
            video.length = estimateVideoLength(show.config.events, !!(show.config.music && show.config.music.sync));
            const notes = [
                `Video ${width}×${height}, dài khoảng <strong>${formatClock(video.length)}</strong>, nặng tối đa khoảng `
                + `${estimateVideoMegabytes(video.quality, video.length)} MB; có tiêu đề, lời nhắn, nhạc nền và thiệp lời chúc ở cuối.`,
                'Quay theo thời gian thật nên mất đúng chừng ấy thời gian. Giữ trang này mở trong lúc quay (chuyển ứng dụng khác thì video tạm dừng).',
                'Video làm ngay trên máy bạn, không tải lên đâu cả.'
            ];
            if (video.intro) notes.unshift(`<span class="ok">${video.intro}</span>`);
            v('.video-notes').innerHTML = notes.map(n => `<li>${n}</li>`).join('');
            actions.innerHTML = `<button type="button" class="sheet__btn" data-act="cancel">Hủy</button>
                <button type="button" class="sheet__btn sheet__btn--primary" data-act="prepare">🎬 Chuẩn bị quay</button>`;
        } else if (step === 'done') {
            const file = videoFile();
            actions.innerHTML = `<button type="button" class="sheet__btn" data-act="again">↻ Quay lại</button>
                ${canShareFile(file) ? '<button type="button" class="sheet__btn" data-act="share">↗ Chia sẻ</button>' : ''}
                <button type="button" class="sheet__btn sheet__btn--primary" data-act="download">⬇ Tải video</button>`;
        } else {
            actions.innerHTML = `<button type="button" class="sheet__btn" data-act="cancel">Hủy</button>`
                + (step === 'recording' ? '<button type="button" class="sheet__btn sheet__btn--primary" data-act="stop">■ Dừng và lưu</button>' : '');
        }
    }

    function setStatus(html, progress) {
        v('.video-status').innerHTML = html;
        if (progress !== undefined) v('.video-progress__bar').style.width = `${Math.min(100, progress * 100)}%`;
    }

    function prepareVideo() {
        video.step = 'preparing';
        renderVideo();
        setStatus('Đang chuẩn bị âm thanh, hình ảnh và nhạc nền...', 0);
        const box = v('.video-frame-box');
        video.frame = createRecordFrame({
            box,
            format: VIDEO_FORMATS.find(f => f.value === video.format),
            quality: video.quality,
            config: show.config,
            maxW: Math.min(box.parentElement.clientWidth || 320, 480),
            maxH: Math.min(window.innerHeight * 0.5, 480),
            onPrepared(msg) {
                if (!msg.supported) {
                    setStatus('<span class="warn">Trình duyệt này chưa quay được video. Hãy dùng Chrome, Edge, Firefox hoặc Safari bản mới.</span>');
                    return;
                }
                video.step = 'ready';
                renderVideo();
                setStatus('Sẵn sàng! Bấm <strong>Bắt đầu quay</strong> trong khung phía trên.'
                    + (msg.musicCaptured ? '' : ' <span class="warn">Video sẽ không có nhạc nền (nhạc từ link trang khác).</span>'), 0);
            },
            onStarted() {
                video.step = 'recording';
                renderVideo();
                setStatus(`Đang quay 0:00 / ${formatClock(video.length)}`, 0);
            },
            onProgress(elapsed) {
                if (video.step !== 'recording') return;
                setStatus(`<span class="record-live"></span>Đang quay ${formatClock(elapsed)} / ${formatClock(video.length)} · giữ trang này mở`,
                    elapsed / video.length);
            },
            onDone: showVideo
        });
        video.size = video.frame.size;
    }

    function videoFile() {
        return new File([video.blob || new Blob()], `${baseName()}.${videoExtension(video.blob)}`, { type: video.blob ? video.blob.type : 'video/mp4' });
    }

    function showVideo(blob, elapsed) {
        video.frame = null;
        if (!blob || !blob.size) {
            video.step = 'setup';
            renderVideo();
            notify('Không quay được video. Hãy thử lại hoặc dùng trình duyệt khác.');
            return;
        }
        video.blob = blob;
        if (video.url) URL.revokeObjectURL(video.url);
        video.url = URL.createObjectURL(blob);
        v('.video-output').src = video.url;
        const ext = videoExtension(blob);
        v('.video-info').innerHTML = `${ext.toUpperCase()} · ${video.size[0]}×${video.size[1]} · ${formatClock(elapsed)}`
            + ` · ${(blob.size / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} MB`
            + (ext === 'webm' ? '<br><span class="warn">Trình duyệt này chỉ quay được WebM; TikTok, Instagram, Zalo cần MP4, hãy dùng Chrome bản mới hoặc Safari để quay ra MP4.</span>' : '');
        v('.video-tip').textContent = video.format === 'portrait'
            ? 'Đăng TikTok: tải video về máy, mở TikTok, bấm dấu + rồi chọn Tải lên. Instagram Reels, YouTube Shorts, Facebook Story làm tương tự.'
            : 'Tải video về máy rồi đăng lên YouTube, Facebook hoặc gửi qua Zalo, Messenger như video thường.';
        video.step = 'done';
        renderVideo();
    }

    function resetVideo() {
        if (video.frame) video.frame.remove();
        video.frame = null;
        const player = v('.video-output');
        player.pause();
        player.removeAttribute('src');
        if (video.url) URL.revokeObjectURL(video.url);
        video.url = '';
        video.blob = null;
        video.step = 'setup';
    }

    function closeVideo() {
        resetVideo();
        closeSheet(videoSheet);
    }

    videoSheet.addEventListener('click', e => {
        const format = e.target.closest('[data-format]');
        const quality = e.target.closest('[data-quality]');
        const act = e.target.closest('[data-act]');
        if (format) {
            video.format = format.dataset.format;
            renderVideo();
        } else if (quality) {
            video.quality = quality.dataset.quality;
            renderVideo();
        } else if (act) {
            const action = act.dataset.act;
            if (action === 'cancel') closeVideo();
            else if (action === 'prepare') prepareVideo();
            else if (action === 'stop' && video.step === 'recording' && video.frame) {
                video.step = 'saving';
                renderVideo();
                setStatus('Đang lưu video...');
                video.frame.stop();
            } else if (action === 'again') {
                resetVideo();
                renderVideo();
            } else if (action === 'share') shareFile(videoFile(), shareText().title);
            else if (action === 'download') saveFile(video.url, videoFile().name);
        }
    });

    // ---- Nút và phím tắt
    bar.querySelector('.moment-bar__snap').addEventListener('click', snap);
    bar.querySelector('.moment-bar__share').addEventListener('click', openShare);
    endShare.addEventListener('click', openShare);

    window.addEventListener('keydown', e => {
        if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName) || e.ctrlKey || e.metaKey || e.altKey) return;
        if (e.key === 'Escape') {
            if (!videoSheet.classList.contains('hide') && !['recording', 'saving'].includes(video.step)) closeVideo();
            else closeSheet(shareSheet);
        } else if ((e.key === 'c' || e.key === 'C') && !openSheets.size && !bar.closest('.remove')) {
            snap();
        }
    });

    return {
        // Kịch bản đang xem (bản gốc, chưa qua trình phát) hoặc null (pháo ngẫu nhiên): người tạo có thể tắt các nút này
        setConfig(config) {
            show.config = config && Array.isArray(config.events) ? JSON.parse(JSON.stringify(config)) : null;
            show.enabled = !off && (!config || config.receiverShare !== false);
            bar.classList.toggle('remove', !show.enabled);
            endShare.classList.toggle('remove', !show.enabled);
        },
        snap
    };
}
