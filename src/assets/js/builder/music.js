/*!
 * Hanabi – builder (nhạc)
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Nhạc nền: tải lên, chọn từ kho nhạc, kho ảnh, đoạn bắt đầu.

import { isStaticEnv, state } from './state.js';
import { escapeHtml, formatNumber, hideLoading, hideModal, normalizeAssetPath, notify, showLoading, showModal } from './util.js';
import { updateEvent } from './events.js';
import { renderInspector } from './inspector.js';
import { getUploadFolder, openCropper } from './images.js';
import { refreshMiniPreview, stopPreviewMusic, updateSoundPreviewButton } from './preview.js';
import { scheduleSettingsSummaries } from './settings.js';
import { afterMusicStartChange } from './beat-ui.js';

export function getMusicAudio() {
    return document.getElementById('music-audio');
}

// Đồng bộ mục "Nhạc nền" và "Âm lượng tiếng pháo" theo state
export function renderMusic() {
    scheduleSettingsSummaries();
    const music = state.music;
    const audio = getMusicAudio();
    if (!audio) return;
    document.getElementById('music-empty').classList.toggle('hide', !!music);
    document.getElementById('music-card').classList.toggle('hide', !music);
    if (music) {
        document.getElementById('music-name').textContent = music.name || decodeURIComponent(music.url.split('/').pop().split('?')[0]) || 'Nhạc nền';
        const src = normalizeAssetPath(music.url);
        if (audio.dataset.src !== src) {
            audio.dataset.src = src;
            audio.src = src;
        }
        const volume = Math.round((music.volume ?? 0.8) * 100);
        document.getElementById('music-start').value = music.start || 0;
        document.getElementById('music-volume').value = volume;
        document.getElementById('out-music-volume').textContent = volume + '%';
        audio.volume = volume / 100;
        document.getElementById('music-sync').checked = !!music.sync;
        document.getElementById('music-sync-hint').textContent = music.sync
            ? `Pháo nổ đúng lúc đã đặt, bám theo bài nhạc${music.bpm ? ` · nhịp ${formatNumber(music.bpm)} BPM` : ''}`
            : 'Pháo nổ đúng lúc đã đặt, bám theo bài nhạc';
    } else if (audio.dataset.src) {
        stopPreviewMusic();
        delete audio.dataset.src;
        audio.removeAttribute('src');
        audio.load();
    }
    const effects = Math.round(state.effectsVolume * 100);
    document.getElementById('effects-volume').value = effects;
    document.getElementById('out-effects-volume').textContent = effects + '%';
    updateSoundPreviewButton();
}

function setMusic(music) {
    state.music = { volume: state.music?.volume ?? 0.8, start: 0, ...music };
    renderMusic();
}

// ---------------------------------------------------------------------------
// Kho nhạc, kho ảnh có sẵn: library/music/index.json, library/images/index.json (thêm bài, ảnh: xem library/README.md)
// ---------------------------------------------------------------------------
const LIBRARY_KINDS = {
    music: { title: '<i class="fas fa-compact-disc"></i> Kho nhạc', note: 'Nhạc trong kho thuộc phạm vi công cộng, dùng tự do. Bấm ▶ để nghe thử.' },
    images: { title: '<i class="fas fa-images"></i> Kho ảnh', note: 'Bấm vào ảnh để dùng cho pháo ảnh này. Muốn dùng ảnh riêng thì bấm "Chọn ảnh từ thiết bị".' }
};

const library = { kind: 'music', eventId: null, tag: '', items: {}, audio: null, playingId: null };

async function loadLibrary(kind) {
    if (!library.items[kind]) {
        const res = await fetch(`library/${kind}/index.json`, { cache: 'no-cache' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        library.items[kind] = await res.json();
    }
    return library.items[kind];
}

export async function openLibrary(kind, eventId) {
    Object.assign(library, { kind, eventId: eventId ?? null, tag: '' });
    document.getElementById('library-title').innerHTML = LIBRARY_KINDS[kind].title;
    document.getElementById('library-note').textContent = LIBRARY_KINDS[kind].note;
    document.getElementById('library-tags').innerHTML = '';
    const list = document.getElementById('library-list');
    list.className = `library-list is-${kind}`;
    list.innerHTML = '<div class="spinner"></div>';
    showModal('library-modal');
    try {
        await loadLibrary(kind);
        renderLibrary();
    } catch (e) {
        list.innerHTML = `<p class="library-empty">Không tải được ${kind === 'music' ? 'kho nhạc' : 'kho ảnh'}. Thử lại sau.</p>`;
    }
}

export function closeLibrary() {
    stopLibraryPreview();
    hideModal('library-modal');
}

export function setLibraryTag(tag) {
    library.tag = tag;
    renderLibrary();
}

function libraryUrl(item) {
    return `./library/${library.kind}/${item.file}`;
}

function renderLibrary() {
    const items = library.items[library.kind] || [];
    const tags = [...new Set(items.flatMap(item => item.tags || []))];
    document.getElementById('library-tags').innerHTML = ['', ...tags].map(tag => `
        <button type="button" class="template-chip${library.tag === tag ? ' active' : ''}" onclick="setLibraryTag('${escapeHtml(tag)}')">
            ${tag ? escapeHtml(tag) : 'Tất cả'}</button>`).join('');
    const shown = items.filter(item => !library.tag || (item.tags || []).includes(library.tag));
    const list = document.getElementById('library-list');
    if (library.kind === 'music') {
        const current = state.music && normalizeAssetPath(state.music.url);
        list.innerHTML = shown.map(item => {
            const inUse = current === normalizeAssetPath(libraryUrl(item));
            const minutes = Math.floor((item.duration || 0) / 60);
            const seconds = String(Math.round((item.duration || 0) % 60)).padStart(2, '0');
            return `
            <div class="library-track${inUse ? ' in-use' : ''}">
                <button type="button" class="library-play" onclick="toggleLibraryPreview('${escapeHtml(item.id)}')"
                    title="Nghe thử" aria-label="Nghe thử ${escapeHtml(item.name)}"><i class="fas fa-${library.playingId === item.id ? 'pause' : 'play'}"></i></button>
                <div class="library-track-info">
                    <strong>${escapeHtml(item.name)}</strong>
                    <span>${escapeHtml(item.artist || '')}${item.duration ? ` · ${minutes}:${seconds}` : ''}</span>
                    <span class="library-track-tags">${(item.tags || []).map(t => `<em>${escapeHtml(t)}</em>`).join('')}</span>
                </div>
                <button type="button" class="btn ${inUse ? 'secondary' : 'primary'} small" onclick="chooseLibraryItem('${escapeHtml(item.id)}')">
                    ${inUse ? '<i class="fas fa-check"></i> Đang dùng' : 'Dùng'}</button>
            </div>`;
        }).join('') || '<p class="library-empty">Chưa có bài nào.</p>';
    } else {
        const event = state.events.find(e => e.id === library.eventId);
        const current = event && event.imageUrl && normalizeAssetPath(event.imageUrl);
        list.innerHTML = shown.map(item => `
            <button type="button" class="library-image${current === normalizeAssetPath(libraryUrl(item)) ? ' in-use' : ''}"
                onclick="chooseLibraryItem('${escapeHtml(item.id)}')" title="${escapeHtml(item.name)}">
                <img src="${escapeHtml(libraryUrl(item))}" alt="" loading="lazy">
                <span>${escapeHtml(item.name)}</span>
            </button>`).join('') || '<p class="library-empty">Chưa có ảnh nào.</p>';
    }
}

export function toggleLibraryPreview(id) {
    const item = (library.items.music || []).find(i => i.id === id);
    if (!item) return;
    const wasPlaying = library.playingId === id;
    stopLibraryPreview();
    if (!wasPlaying) {
        stopPreviewMusic();
        library.audio = new Audio(libraryUrl(item));
        library.audio.addEventListener('ended', stopLibraryPreview);
        library.audio.play().catch(() => notify('Không phát được bài này.', 'error'));
        library.playingId = id;
    }
    renderLibrary();
}

function stopLibraryPreview() {
    if (library.audio) {
        library.audio.pause();
        library.audio = null;
    }
    if (library.playingId) {
        library.playingId = null;
        if (!document.getElementById('library-modal').classList.contains('hide')) renderLibrary();
    }
}

export function chooseLibraryItem(id) {
    const item = (library.items[library.kind] || []).find(i => i.id === id);
    if (!item) return;
    if (library.kind === 'music') {
        setMusic({ url: libraryUrl(item), name: `${item.name} – ${item.artist}` });
        refreshMiniPreview();
        notify(`Đã chọn nhạc nền "${item.name}".`, 'success');
    } else if (state.events.some(e => e.id === library.eventId)) {
        updateEvent(library.eventId, 'imageUrl', libraryUrl(item));
        renderInspector();
        notify(`Đã dùng ảnh "${item.name}".`, 'success');
        closeLibrary();
        openCropper(library.eventId);
        return;
    }
    closeLibrary();
}

export function removeMusic() {
    state.music = null;
    stopPreviewMusic();
    renderMusic();
}

// Điểm bắt đầu = chỗ đang nghe trên thanh phát nhạc
export function useCurrentMusicTime() {
    if (!state.music) return;
    state.music.start = Math.round(getMusicAudio().currentTime * 10) / 10;
    renderMusic();
    notify(`Nhạc sẽ phát từ giây ${state.music.start.toLocaleString('vi-VN')}.`, 'success');
    afterMusicStartChange();
}

export async function handleMusicUpload(input) {
    const file = input.files[0];
    input.value = '';
    if (!file) return;

    if (isStaticEnv) {
        notify('Trang tĩnh (GitHub Pages) không lưu được file nhạc. Hãy dán link trực tiếp tới file nhạc.', 'warning');
        return;
    }
    if (file.size > 20 * 1024 * 1024) {
        notify('File nhạc quá lớn (tối đa 20MB).', 'error');
        return;
    }
    const scenarioName = getUploadFolder();

    showLoading('Đang tải nhạc lên...');
    const formData = new FormData();
    formData.append('audio', file);
    formData.append('filename', scenarioName);
    try {
        const response = await fetch('api/upload_audio.php', { method: 'POST', body: formData });
        const data = await response.json();
        hideLoading();
        if (data.success) {
            setMusic({ url: data.url, name: data.name || file.name });
            notify('Đã thêm nhạc nền!', 'success');
        } else {
            notify('Lỗi: ' + data.message, 'error');
        }
    } catch (e) {
        hideLoading();
        notify('Lỗi kết nối khi tải nhạc.', 'error');
    }
}

// Dùng link nhạc có sẵn: thử tải trước để báo lỗi ngay (link trang YouTube, link hỏng...)
export function setMusicFromUrl() {
    const input = document.getElementById('music-url');
    const url = input.value.trim();
    if (!url) return;
    if (!/^(https?:\/\/|\.?\/)/i.test(url)) {
        notify('Link nhạc phải bắt đầu bằng https:// hoặc ./', 'warning');
        return;
    }

    showLoading('Đang kiểm tra link nhạc...');
    const probe = new Audio();
    let settled = false;
    const finish = (ok) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        probe.removeAttribute('src');
        hideLoading();
        if (ok) {
            setMusic({ url, name: decodeURIComponent(url.split('/').pop().split('?')[0]) || 'Nhạc nền' });
            input.value = '';
            notify('Đã thêm nhạc nền!', 'success');
        } else {
            notify('Không phát được link này. Hãy dùng link trực tiếp tới file .mp3 (link trang YouTube, Zing... không dùng được).', 'error');
        }
    };
    const timer = setTimeout(() => finish(false), 15000);
    probe.preload = 'metadata';
    probe.addEventListener('loadedmetadata', () => finish(true), { once: true });
    probe.addEventListener('error', () => finish(false), { once: true });
    probe.src = normalizeAssetPath(url);
}
