/*!
 * Trình diễn Pháo hoa – trình soạn kịch bản (builder)
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Điểm vào của builder: khởi động giao diện, nối các nút (onclick trong builder.html gọi hàm qua window). Mỗi phần chức
// năng một module trong builder/: state (kịch bản đang soạn), constants, util, events (phát bắn), timeline (dòng thời
// gian), inspector (bảng chỉnh), help (giải thích), images (ảnh, cắt ảnh), music (nhạc, kho nhạc ảnh), preview (xem nhanh),
// config (lưu, nạp kịch bản), history (hoàn tác, bản nháp), settings (khung bắt đầu, giao diện, nhóm cài đặt, hẹn giờ),
// scene (bầu trời, mặt nước, mùa), nature-ui (âm thanh thiên nhiên), templates-ui (mẫu theo dịp), beat-ui (xếp theo nhịp), gift-watch (báo mở quà), video-ui,
// share (chia sẻ, ảnh xem trước), scripts (danh sách kịch bản), layout (thanh bên, menu).

import '../scss/builder.scss';
import fscreen from './fscreen@1.0.1.js';
import { renderShareImage } from './share-image.js';
import { QUALITY_LEVELS } from './player/quality.js';
import { polyfillCountryFlagEmojis } from 'country-flag-emoji-polyfill';
import flagFontUrl from 'country-flag-emoji-polyfill/dist/TwemojiCountryFlags.woff2?url';
import { printCopyrightNotice } from './copyright.js';
import { isStaticEnv, state } from './builder/state.js';
import { confirmAction, hideModal, notify, showModal, syncLoopState } from './builder/util.js';
import { helpTooltip } from './builder/help.js';
import { addColorToEvent, addEvent, createNewScript, duplicateEvent, pickTextEmoji, removeColorFromEvent, removeEvent, showEmojiGroup, toggleEmojiPicker, updateEvent } from './builder/events.js';
import { addBurst, addEventFromUI, renderEventList, selectEvent, setTimelineView, updateScriptNameLabel, zoomTrack } from './builder/timeline.js';
import { addCustomColor, changeBurst, closeInspector, handleShellChange, rememberSection, renderInspector, toggleEventColor } from './builder/inspector.js';
import { closeCropper, initCropper, openCropper, resetCropper, saveCropper, zoomCropper } from './builder/images.js';
import { chooseLibraryItem, closeLibrary, getMusicAudio, handleMusicUpload, openLibrary, removeMusic, renderMusic, setLibraryTag, setMusicFromUrl, toggleLibraryPreview, useCurrentMusicTime } from './builder/music.js';
import { playMiniPreviewOnce, previewAsRecipient, previewConfig, refreshMiniPreview, resizeMiniStages, restartMiniPreview, setPreviewDevice, toggleFullscreenMiniPreview, toggleMiniPreview, togglePreviewDevice, togglePreviewSound } from './builder/preview.js';
import { saveConfig } from './builder/config.js';
import { initEditHistory, redo, undo } from './builder/history.js';
import { setupNatureSound } from './builder/nature-ui.js';
import { initScreenThemeControls, initSettingsGroups, previewScreen, renderSchedule, renderStartFrames, resetScreenTheme, setOpenMode, setScreenThemeField, setScreenThemePreset, setStartFrame } from './builder/settings.js';
import { renderScene, renderSky, renderSmoke, renderViewer, setBank, setPeople, setClouds, setFloating, setMeteors, setMilkyWay, setMoonMode, setMoonPhase, setSeason, setSmoke, setStars, setViewerOption, setWater, setWaterStyle, setWeather, toggleDecor } from './builder/scene.js';
import { createFromTemplate, openTemplatesModal, renderTemplateChips, selectOccasion, startBlankScript, updateTemplateStrip } from './builder/templates-ui.js';
import { afterMusicStartChange, applyBeatShow, drawBeatChart, openBeatModal, setBeatDensity } from './builder/beat-ui.js';
import { checkGiftOpens, copyTrackingLink, enableOpenNotifications, renderNotifyOpen, startGiftWatch } from './builder/gift-watch.js';
import { closeVideoModal, createVideo, downloadVideo, openVideoModal, restartVideo, setVideoFormat, setVideoQuality, shareVideo } from './builder/video-ui.js';
import { closeShareModal, copyShareLink, downloadShareImage, downloadShareQr, handleSeoImageUpload, openShareModal, renderSeoControls, scheduleSeoPreview, setSeoImageMode, shareTo, storeImageFile } from './builder/share.js';
import { copyScriptLink, deleteScript, duplicateScript, editScript, exportConfig, importConfig, openScriptsModal, previewScript } from './builder/scripts.js';
import { closeMoreMenu, toggleMoreMenu, toggleSidebar } from './builder/layout.js';

// Assign to window for global access
window.fscreen = fscreen;

printCopyrightNotice('Trình diễn Pháo hoa – Builder');

// Windows không có cờ trong font emoji: khai báo font cờ riêng (đã đặt đầu font-family của trang)
polyfillCountryFlagEmojis('Twemoji Country Flags', flagFontUrl);

/**
 * Firework Script Builder Logic - Enhanced
 */

// Initialize UI
document.addEventListener('DOMContentLoaded', () => {
    // Buttons
    // Bọc trong arrow function: nếu truyền thẳng hàm, đối tượng MouseEvent sẽ bị coi là tham số
    document.getElementById('btn-add-event')?.addEventListener('click', () => addEventFromUI());
    document.getElementById('btn-fab-add')?.addEventListener('click', () => addEventFromUI());
    document.getElementById('btn-save')?.addEventListener('click', saveConfig);
    document.getElementById('btn-preview')?.addEventListener('click', previewConfig);
    document.getElementById('btn-copy-link')?.addEventListener('click', copyShareLink);
    document.getElementById('btn-toggle-mini-preview')?.addEventListener('click', () => toggleMiniPreview());
    document.getElementById('btn-help')?.addEventListener('click', () => showModal('help-modal'));
    document.getElementById('sidebar-overlay')?.addEventListener('click', toggleSidebar);

    // Tên kịch bản trên thanh trên cùng
    document.getElementById('title')?.addEventListener('input', updateScriptNameLabel);
    document.getElementById('filename')?.addEventListener('input', updateScriptNameLabel);

    renderStartFrames();
    initScreenThemeControls();

    // Hẹn giờ mở quà
    document.getElementById('schedule-toggle')?.addEventListener('change', (e) => {
        if (e.target.checked) {
            // Mặc định: 0 giờ ngày mai
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(0, 0, 0, 0);
            state.openAt = tomorrow.toISOString();
        } else {
            state.openAt = '';
        }
        renderSchedule();
    });
    document.getElementById('open-at')?.addEventListener('change', (e) => {
        const time = Date.parse(e.target.value);
        if (Number.isFinite(time)) state.openAt = new Date(time).toISOString();
        renderSchedule();
    });
    renderSchedule();
    renderSmoke();
    renderScene();
    renderSky();
    // Các mức chất lượng như trang xem phim (player/quality.js), dựng trước khi renderViewer đặt giá trị
    const qualitySelect = document.getElementById('viewer-quality');
    qualitySelect?.insertAdjacentHTML('beforeend', QUALITY_LEVELS.map(level => `<option value="${level.value}">${level.label}</option>`).join(''));
    qualitySelect?.addEventListener('change', (e) => setViewerOption('quality', e.target.value));
    renderViewer();
    document.getElementById('viewer-scale')?.addEventListener('change', (e) => setViewerOption('scaleFactor', e.target.value ? Number(e.target.value) : ''));
    document.getElementById('viewer-fullscreen')?.addEventListener('change', (e) => setViewerOption('fullscreen', e.target.checked || ''));
    document.getElementById('viewer-controls')?.addEventListener('change', (e) => setViewerOption('hideControls', e.target.checked ? false : ''));
    document.getElementById('tap-to-launch')?.addEventListener('change', (e) => {
        state.tapToLaunch = e.target.checked;
        renderViewer();
    });
    document.getElementById('receiver-share')?.addEventListener('change', (e) => {
        state.receiverShare = e.target.checked;
        renderViewer();
    });
    document.querySelectorAll('[data-water-thing]').forEach(input => input.addEventListener('change', () => {
        state[input.dataset.waterThing] = input.checked;
        refreshMiniPreview();
    }));
    // Vị trí trăng: kéo thanh trượt thì xem nhanh cập nhật
    ['x', 'y'].forEach(axis => document.getElementById('moon-' + axis)?.addEventListener('input', (e) => {
        if (!state.moon) return;
        state.moon = { ...state.moon, [axis]: Number(e.target.value) };
        document.getElementById('out-moon-' + axis).textContent = e.target.value;
        refreshMiniPreview();
    }));

    // Dải mẫu theo dịp ẩn khi bắt đầu tự soạn
    document.getElementById('title')?.addEventListener('input', updateTemplateStrip);
    renderTemplateChips();

    // Chia sẻ & SEO: thẻ xem trước cập nhật theo nội dung
    ['title', 'subtitle', 'author', 'seo-title', 'seo-description'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', scheduleSeoPreview);
    });
    document.getElementById('seo-image-file')?.addEventListener('change', (e) => handleSeoImageUpload(e.target));
    document.getElementById('seo-image-text')?.addEventListener('change', (e) => {
        state.seo.imageText = e.target.checked;
        scheduleSeoPreview();
    });
    document.getElementById('seo-image-position')?.addEventListener('input', (e) => {
        state.seo.imagePosition = Number(e.target.value);
        renderSeoControls();
        scheduleSeoPreview();
    });

    // Background logic
    const bgToggle = document.getElementById('show-background');
    const bgContainer = document.getElementById('background-upload-container');
    const bgFile = document.getElementById('background-file');
    const bgPreview = document.getElementById('background-preview');

    bgToggle?.addEventListener('change', (e) => {
        state.showBackground = e.target.checked;
        bgContainer?.classList.toggle('hide', !state.showBackground);
        refreshMiniPreview();
    });

    bgFile?.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        // Chọn lại đúng file đó lần sau vẫn nhận
        e.target.value = '';
        if (!file) return;
        const url = await storeImageFile(file, 2560);
        if (!url) return;
        state.background = url;
        if (bgPreview) bgPreview.src = url;
        refreshMiniPreview();
    });

    document.getElementById('loop')?.addEventListener('change', syncLoopState);

    // Nhạc nền
    document.getElementById('music-file')?.addEventListener('change', (e) => handleMusicUpload(e.target));
    document.getElementById('music-url')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') setMusicFromUrl();
    });
    document.getElementById('music-start')?.addEventListener('change', (e) => {
        if (!state.music) return;
        state.music.start = Math.max(0, Math.round((Number(e.target.value) || 0) * 10) / 10);
        e.target.value = state.music.start;
        afterMusicStartChange();
    });
    document.getElementById('music-sync')?.addEventListener('change', (e) => {
        if (!state.music) return;
        state.music.sync = e.target.checked || undefined;
        renderMusic();
        renderEventList();
        if (state.activeEventId) renderInspector();
    });
    document.getElementById('music-volume')?.addEventListener('input', (e) => {
        if (!state.music) return;
        state.music.volume = Number(e.target.value) / 100;
        document.getElementById('out-music-volume').textContent = e.target.value + '%';
        getMusicAudio().volume = state.music.volume;
    });
    const musicAudio = getMusicAudio();
    musicAudio?.addEventListener('play', () => document.getElementById('music-card').classList.add('playing'));
    musicAudio?.addEventListener('pause', () => document.getElementById('music-card').classList.remove('playing'));
    document.getElementById('effects-volume')?.addEventListener('input', (e) => {
        state.effectsVolume = Number(e.target.value) / 100;
        document.getElementById('out-effects-volume').textContent = e.target.value + '%';
        refreshMiniPreview();
    });
    setupNatureSound();
    if (isStaticEnv) {
        document.getElementById('music-hint').textContent = 'Trang tĩnh (GitHub Pages) không tải file lên được: hãy dán link trực tiếp tới file nhạc, '
            + 'hoặc chép file vào src/static/uploads/music/ rồi dán đường dẫn ./uploads/music/ten-file.mp3.';
    }
    renderMusic();
    if (isStaticEnv) {
        document.getElementById('seo-image-hint').innerHTML = 'Trang tĩnh (GitHub Pages) không tự đăng được ảnh này. Để link gửi đi hiện ảnh mới: '
            + 'bấm <strong>Lưu</strong>, trong hộp Chia sẻ bấm <strong>Tải ảnh thiệp</strong>, rồi chép file <code>.jpg</code> đó '
            + '(cùng file <code>.json</code> bấm <strong>Xuất</strong>) vào <code>src/static/configs/</code> và đăng lại trang.';
    }
    renderSeoControls();
    scheduleSeoPreview();

    // File Import
    document.getElementById('import-file')?.addEventListener('change', importConfig);

    document.getElementById('more-menu')?.addEventListener('click', (e) => {
        if (e.target.closest('button, a')) closeMoreMenu();
    });

    // Đóng menu "⋯" khi bấm ra ngoài
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.more-menu')) closeMoreMenu();
    });

    // Esc: đóng menu, ngăn cấu hình, bảng chỉnh sửa (trên điện thoại)
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape' || document.querySelector('.modal:not(.hide)')) return;
        if (!document.getElementById('more-menu').classList.contains('hide')) return closeMoreMenu();
        if (document.getElementById('settings-panel').classList.contains('open')) return toggleSidebar();
        if (state.activeEventId) closeInspector();
    });

    initCropper();

    // Initial event if empty
    if (state.events.length === 0) {
        addEvent();
    }
    renderInspector();
    updateScriptNameLabel();

    // Điện thoại mặc định xem như trên điện thoại
    if (window.innerWidth < 768) setPreviewDevice('mobile');
    toggleMiniPreview(true);

    // Lưu nháp tự động, hoàn tác/làm lại
    initEditHistory();

    // Nút "?" giải thích từng mục
    helpTooltip.init();
    initSettingsGroups();

    // Báo mở quà: công tắc, hỏi trạng thái các món quà của mình
    document.getElementById('notify-open')?.addEventListener('change', (e) => {
        state.notifyOpen = e.target.checked;
        renderNotifyOpen();
    });
    document.getElementById('reduce-flashing')?.addEventListener('change', (e) => {
        state.reduceFlashing = e.target.checked;
        refreshMiniPreview();
    });
    renderNotifyOpen();
    startGiftWatch();
});

// Các hàm được gọi từ thuộc tính onclick/onchange trong HTML
Object.assign(window, {
    toggleMiniPreview, togglePreviewDevice, toggleFullscreenMiniPreview, playMiniPreviewOnce, restartMiniPreview,
    createNewScript, selectEvent, closeInspector, addEventFromUI, addBurst, removeEvent, duplicateEvent, updateEvent,
    handleShellChange, toggleEmojiPicker, showEmojiGroup, pickTextEmoji, changeBurst, toggleEventColor, addColorToEvent, addCustomColor, removeColorFromEvent,
    rememberSection, editScript, duplicateScript, deleteScript, previewScript, copyShareLink, copyScriptLink,
    openScriptsModal, exportConfig, previewConfig, saveConfig, toggleSidebar, toggleMoreMenu, showModal,
    resizeMiniStages, notify, confirmAction, openShareModal, closeShareModal, shareTo, downloadShareQr,
    downloadShareImage, renderShareImage, renderInspector, setMusicFromUrl, removeMusic, useCurrentMusicTime,
    togglePreviewSound, previewAsRecipient, setSeoImageMode, openTemplatesModal, selectOccasion, startBlankScript, createFromTemplate,
    hideModal, setBank, setPeople, setSeason, setWeather, setStartFrame, setScreenThemePreset, setScreenThemeField, resetScreenTheme, previewScreen, undo, redo, setOpenMode, setSmoke, setViewerOption, setWater, setWaterStyle, setFloating, setStars, setMilkyWay, setMeteors, setClouds, setMoonMode, setMoonPhase, toggleDecor, openLibrary, closeLibrary, setLibraryTag,
    toggleLibraryPreview, chooseLibraryItem, openBeatModal, setBeatDensity, applyBeatShow, drawBeatChart,
    openVideoModal, closeVideoModal, setVideoFormat, setVideoQuality, createVideo, downloadVideo, shareVideo,
    restartVideo, setTimelineView, zoomTrack, copyTrackingLink, enableOpenNotifications, checkGiftOpens,
    openCropper, closeCropper, zoomCropper, resetCropper, saveCropper
});

window.addEventListener('resize', resizeMiniStages);
