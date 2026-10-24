/*!
 * Hanabi – builder (dòng thời gian)
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Dòng thời gian: danh sách đợt bắn, chọn phát bắn, xem theo giây, kéo thả trên thước nhạc.

import { eventTimes, isPauseEvent, layoutBursts } from '../timeline.js';
import { createTimelineTrack } from '../timeline-track.js';
import { state } from './state.js';
import { COLOR, LAUNCH_STYLES, SHELL_ICONS } from './constants.js';
import { escapeHtml, formatDuration, formatNumber, normalizeAssetPath } from './util.js';
import { addEvent, getBurstDuration, getBurstEvents, getMaxBurst } from './events.js';
import { renderInspector } from './inspector.js';
import { getMusicAudio } from './music.js';
import { previewMusicPlaying, refreshMiniPreview, sendPreview, updateMiniInfo } from './preview.js';
import { draftSavedAt, scheduleCheckpoint } from './history.js';
import { updateTemplateStrip } from './templates-ui.js';
import { analyzeMusicCached, beatFailures, beatResults } from './beat-ui.js';
import { scheduleSeoPreview } from './share.js';
import { autoFilename } from './images.js';

function updateTimelineSummary() {
    const el = document.getElementById('timeline-summary');
    if (!el) return;
    const maxBurst = getMaxBurst();
    let total = 0;
    for (let b = 1; b <= maxBurst; b++) total += getBurstDuration(getBurstEvents(b));
    const shots = state.events.filter(isFireworkShot).length;
    el.textContent = state.events.length
        ? `${maxBurst} đợt · ${shots} phát bắn · khoảng ${formatDuration(total)}`
        : 'Chưa có phát bắn nào';
}

export function updateScriptNameLabel() {
    const label = document.getElementById('script-name-label');
    if (!label) return;
    const title = document.getElementById('title').value.trim();
    const filename = document.getElementById('filename').value.trim();
    label.textContent = (title || 'Kịch bản mới') + (filename ? ` · ${filename}.json` : '')
        + (draftSavedAt ? ` · đã lưu nháp ${draftSavedAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}` : '');
    // Chưa đặt tên file: ô Tên file cho biết tên sẽ tự đặt theo Tiêu đề khi bấm Lưu
    document.getElementById('filename').placeholder = `Tự đặt: ${autoFilename()}`;
}

// Các chấm màu (hoặc ảnh thu nhỏ) của một phát bắn
function renderColorDots(event) {
    if (event.shell === 'Hình ảnh' && event.imageUrl) {
        return `<img class="thumb" src="${escapeHtml(normalizeAssetPath(event.imageUrl))}" alt="">`;
    }
    const colors = [].concat(event.color || []);
    return colors.slice(0, 5).map(c => (c === 'Ngẫu nhiên' || c === 'random')
        ? '<span class="dot random" title="Ngẫu nhiên"></span>'
        : `<span class="dot" style="--c: ${escapeHtml(COLOR[c] || c)}" title="${escapeHtml(c)}"></span>`
    ).join('');
}

// Phát bắn ra pháo (không phải "Tạm dừng" hay "Lời nhắn")
export function isFireworkShot(event) {
    return event.shell !== 'Tạm dừng' && event.shell !== 'Lời nhắn';
}

export const CAPTION_POSITIONS = [['bottom', 'Dưới (như phụ đề)'], ['middle', 'Giữa'], ['top', 'Trên']];

// Kịch bản khớp nhịp nhạc: "trễ" là lúc pháo nổ, dòng thời gian hiện mốc giây trong bài nhạc
export function isSyncMode() {
    return !!(state.music && state.music.sync);
}

// Mốc trong bài nhạc (phút:giây,phần mười) của thời điểm `ms` tính từ lúc nhạc bắt đầu
function formatMusicTime(ms) {
    const total = Math.max(0, (Number(state.music?.start) || 0) + ms / 1000);
    const minutes = Math.floor(total / 60);
    const seconds = (total - minutes * 60).toFixed(1).padStart(4, '0').replace('.', ',');
    return `${minutes}:${seconds}`;
}

// Số thứ tự (#) của từng phát, dựng một lần mỗi lần vẽ danh sách (tìm bằng indexOf cho từng dòng thì chậm)
let shotNumbers = null;

function renderShotRow(event, burstStart = 0) {
    const index = shotNumbers ? shotNumbers.get(event) : state.events.indexOf(event) + 1;
    const isPause = event.shell === 'Tạm dừng';
    const delayText = isSyncMode()
        ? formatMusicTime(burstStart + (Number(event.delay) || 0))
        : Number(event.delay) ? `+${formatNumber(event.delay)} ms` : 'Ngay';
    const meta = isPause
        ? `<span><i class="fas fa-hourglass-half"></i>Nghỉ ${formatDuration(Number(event.duration) || 2000)}</span>`
        : event.shell === 'Lời nhắn'
        ? `<span><i class="fas fa-${isSyncMode() ? 'music' : 'clock'}"></i>${delayText}</span>
           <span><i class="fas fa-hourglass-half"></i>Hiện ${formatDuration(Number(event.duration) || 4000)}</span>
           <span><i class="fas fa-up-down"></i>${(CAPTION_POSITIONS.find(([v]) => v === (event.position || 'bottom')) || [, ''])[1]}</span>`
        : `<span><i class="fas fa-location-dot"></i>${formatNumber(event.x)}, ${formatNumber(event.y)}</span>
           <span><i class="fas fa-${isSyncMode() ? 'music' : 'clock'}"></i>${delayText}</span>
           <span><i class="fas fa-maximize"></i>Cỡ ${formatNumber(event.size ?? 1)}</span>
           ${event.launchStyle ? `<span><i class="fas fa-rocket"></i>${(LAUNCH_STYLES.find(s => s.value === event.launchStyle) || {}).name || ''}</span>` : ''}`;

    return `
        <div class="shot-row${state.activeEventId === event.id ? ' active' : ''}${isPause ? ' is-pause' : ''}"
            data-id="${event.id}" role="button" tabindex="0"
            onclick="selectEvent(${event.id})" onkeydown="if (event.key === 'Enter') selectEvent(${event.id})">
            <span class="shot-icon">${SHELL_ICONS[event.shell] || '🎆'}</span>
            <div class="shot-main">
                <div class="shot-title">
                    <span class="shot-index">#${index}</span>${escapeHtml(event.shell)}
                    ${event.text ? `<span class="shot-text">“${escapeHtml(event.text)}”</span>` : ''}
                </div>
                <div class="shot-meta">${meta}</div>
            </div>
            <div class="shot-colors">${isPause ? '' : renderColorDots(event)}</div>
            <div class="shot-actions">
                <button class="icon-btn" onclick="event.stopPropagation(); duplicateEvent(${event.id})" title="Nhân bản (Ctrl+D)"><i class="fas fa-copy"></i></button>
                <button class="icon-btn danger" onclick="event.stopPropagation(); removeEvent(${event.id})" title="Xóa (Delete)"><i class="fas fa-trash"></i></button>
            </div>
        </div>`;
}

function renderBurstGroup(burst, events, burstStart = 0) {
    const duration = getBurstDuration(events);
    const shots = events.filter(isFireworkShot).length;
    const maxDelay = Math.max(0, ...events.map(e => Number(e.delay) || 0));
    // Phát bắn có thời gian trễ dài hơn cả đợt sẽ nổ chồng sang đợt sau
    const warn = maxDelay > duration
        ? `<span class="warn" title="Thêm phát Tạm dừng để kéo dài đợt này"><i class="fas fa-triangle-exclamation"></i> Có phát trễ quá thời lượng đợt</span>`
        : '';
    const info = !events.length
        ? `Trống · ${formatDuration(duration)}`
        : `${shots ? `${shots} phát` : 'Nghỉ'} · ${formatDuration(duration)} ${warn}`;

    return `
        <section class="burst-group${events.length ? '' : ' is-empty'}">
            <header class="burst-header">
                <span class="burst-badge">Đợt ${burst}</span>
                <span class="burst-info">${info}</span>
                ${isSyncMode() ? `<span class="burst-time" title="Mốc trong bài nhạc">♪ ${formatMusicTime(burstStart)}</span>` : ''}
                <button class="btn ghost small burst-add" onclick="addEventFromUI(${burst})" title="Thêm phát bắn vào đợt ${burst}">
                    <i class="fas fa-plus"></i><span>Thêm</span>
                </button>
            </header>
            <div class="burst-shots">${events.map(e => renderShotRow(e, burstStart)).join('')}</div>
        </section>`;
}

export function renderEventList() {
    const container = document.getElementById('event-list');
    updateTimelineSummary();
    updateTemplateStrip();
    // Thiệp chia sẻ tự động lấy màu theo các phát bắn
    scheduleSeoPreview();

    // Xem theo giây (chỉ khi đã có phát bắn; trống thì vẫn hiện lời mời thêm phát)
    document.querySelectorAll('.timeline-views button').forEach(btn => btn.classList.toggle('active', btn.dataset.view === timelineView));
    document.getElementById('track-tools')?.classList.toggle('hide', timelineView !== 'track');
    const showTrack = timelineView === 'track' && state.events.length > 0;
    container.classList.toggle('hide', showTrack);
    document.getElementById('track-view')?.classList.toggle('hide', !showTrack);
    if (showTrack) {
        renderTrackTools();
        getTrack().render();
        refreshMiniPreview();
        return;
    }

    if (state.events.length === 0) {
        container.innerHTML = `
            <div class="timeline-empty">
                <i class="fas fa-wand-magic-sparkles"></i>
                <p>Chưa có phát bắn nào. Thêm phát đầu tiên để bắt đầu màn trình diễn.</p>
                <button class="btn primary" onclick="addEventFromUI()"><i class="fas fa-plus"></i> Thêm phát bắn</button>
            </div>`;
        refreshMiniPreview();
        return;
    }

    let html = '';
    const maxBurst = getMaxBurst();
    let burstStart = 0;
    shotNumbers = new Map(state.events.map((e, i) => [e, i + 1]));
    for (let b = 1; b <= maxBurst; b++) {
        const events = getBurstEvents(b);
        html += renderBurstGroup(b, events, burstStart);
        burstStart += getBurstDuration(events);
    }
    shotNumbers = null;
    container.innerHTML = html;
    // Danh sách thay đổi (thêm/xóa/nhân bản/đổi màu/loại pháo...) thì cập nhật bản xem nhanh
    refreshMiniPreview();
}

// Phát mới, bản sao: không chép theo pháo chữ, pháo ảnh (nội dung riêng của từng phát) hay Tạm dừng, Lời nhắn
export const isPlainShot = e => !!e && isFireworkShot(e) && e.shell !== 'Văn bản' && e.shell !== 'Hình ảnh';

// Chỗ ngang ưu tiên khi đặt một phát vào đợt: giữa trời rồi đối xứng dần ra hai bên
const SPOTS_X = [50, 30, 70, 20, 80, 40, 60, 15, 85, 10, 90];
// Hai phát cùng đợt gần nhau hơn chừng này (đơn vị vị trí 0-100) thì nổ chồng lên nhau, trông như một phát
const SPOT_GAP = 15;
// Phát mới nổ sau phát cuối của đợt một nhịp ngắn
const NEXT_SHOT_MS = 250;

// Chỗ ngang còn trống trong đợt cho một phát ở độ cao y: thử `prefer` trước rồi tới các chỗ ưu tiên; kín hết thì lấy
// chỗ xa các phát khác nhất
export function freeSpotX(burst, y, prefer) {
    const others = getBurstEvents(burst).filter(isFireworkShot);
    const room = x => Math.min(Infinity, ...others.map(e => Math.hypot((Number(e.x) || 0) - x, (Number(e.y) || 0) - y)));
    const spots = prefer === undefined ? SPOTS_X : [prefer, ...SPOTS_X];
    return spots.find(x => room(x) >= SPOT_GAP) ?? spots.reduce((best, x) => (room(x) > room(best) ? x : best));
}

// Phát mới: giống phát đang chọn (không thì phát cuối của đợt, của cả kịch bản) về loại pháo, màu, cỡ, kiểu bắn, hiệu
// ứng, âm thanh; cùng độ cao, đặt vào chỗ còn trống của đợt; nổ sau phát cuối của đợt một nhịp ngắn (khớp nhạc thì nổ
// cùng nhịp với phát mẫu). Chưa có phát nào để theo: Hoa cúc giữa trời như trước.
function newShotConfig(burst, active) {
    const shots = getBurstEvents(burst);
    const model = [active, ...[...shots].reverse(), ...[...state.events].reverse()].find(isPlainShot);
    if (!model) return { burst };
    const { id, expanded, burst: _, x, y, delay, duration, text, textSize, frame, imageUrl, position, ...look } = JSON.parse(JSON.stringify(model));
    const times = shots.filter(isFireworkShot).map(e => Number(e.delay) || 0);
    const last = Math.max(0, ...times);
    const nextDelay = !times.length ? 0
        : isSyncMode() ? (shots.includes(model) ? Number(model.delay) || 0 : last)
        : Math.min(last + NEXT_SHOT_MS, Math.max(last, getBurstDuration(shots) - 1000));
    const height = Number(model.y) || 50;
    return { ...look, burst, x: freeSpotX(burst, height), y: height, delay: nextDelay };
}

// Thêm phát bắn từ giao diện rồi mở luôn bảng chỉnh sửa.
// Mặc định vào cùng đợt với phát đang chọn (không chọn thì vào đợt cuối).
export function addEventFromUI(burst) {
    const active = state.events.find(e => e.id === state.activeEventId);
    const targetBurst = burst ?? (active ? Number(active.burst) || 1 : Math.max(1, getMaxBurst()));
    addEvent(newShotConfig(targetBurst, active), { render: false });

    // Đặt ngay sau phát cuối cùng của đợt đó để số thứ tự (#) liền mạch
    const added = state.events.pop();
    let insertAt = 0;
    state.events.forEach((e, i) => { if ((Number(e.burst) || 1) <= targetBurst) insertAt = i + 1; });
    state.events.splice(insertAt, 0, added);
    renderEventList();

    selectEvent(added.id);
    document.querySelector(`.shot-row[data-id="${added.id}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

// Thêm một phát bắn ở đợt mới (sau đợt cuối)
export function addBurst() {
    addEventFromUI(getMaxBurst() + 1);
}

// Đổi phát đang chọn. Xem danh sách: chỉ đổi dòng được tô (vẽ lại cả danh sách dài thì khựng); xem theo giây: vẽ lại dải.
export function showActiveEvent(id) {
    const list = document.getElementById('event-list');
    if (timelineView === 'track' || !list.querySelector('.shot-row')) {
        renderEventList();
        return;
    }
    list.querySelectorAll('.shot-row.active').forEach(row => row.classList.remove('active'));
    if (id) list.querySelector(`.shot-row[data-id="${id}"]`)?.classList.add('active');
}

export function selectEvent(id) {
    state.activeEventId = id;
    showActiveEvent(id);
    if (timelineView === 'track' && track) track.reveal(id);
    renderInspector();
    updateMiniInfo();
    // Bắn ngay phát vừa chọn trong khung xem nhanh
    sendPreview(true);
}

const TIMELINE_VIEW_KEY = 'firework_builder_timeline_view';

export let timelineView = (() => {
    try {
        return localStorage.getItem(TIMELINE_VIEW_KEY) === 'track' ? 'track' : 'list';
    } catch (e) {
        return 'list';
    }
})();

let track = null;

export function setTimelineView(view) {
    timelineView = view === 'track' ? 'track' : 'list';
    try {
        localStorage.setItem(TIMELINE_VIEW_KEY, timelineView);
    } catch (e) {
        // Không nhớ được lựa chọn: lần sau mở lại danh sách
    }
    renderEventList();
}

export function zoomTrack(dir) {
    if (track) track.zoom(dir);
}

// Màu đánh dấu của phát bắn: màu đầu tiên đã chọn
function markerColor(event) {
    const first = Array.isArray(event.color) ? event.color[0] : event.color;
    if (!first || first === 'Ngẫu nhiên' || first === 'random') return '#b46cff';
    // Đưa thẳng vào style của nút: chỉ nhận màu CSS hợp lệ (kịch bản nhập vào có thể chứa mã độc)
    const color = COLOR[first] || String(first);
    return CSS.supports('color', color) ? color : '#b46cff';
}

// Kết quả phân tích nhạc (sóng nhạc, phách) của bài đang dùng, có rồi mới vẽ
function currentMusicAnalysis() {
    return state.music ? beatResults.get(normalizeAssetPath(state.music.url)) || null : null;
}

export function renderTrackTools() {
    const note = document.getElementById('track-note');
    const snapRow = document.getElementById('track-snap-row');
    if (!state.music) {
        note.textContent = '';
        snapRow.classList.add('hide');
        return;
    }
    const url = normalizeAssetPath(state.music.url);
    const analysis = beatResults.get(url);
    snapRow.classList.toggle('hide', !analysis);
    if (analysis) {
        note.textContent = `♪ ${formatNumber(analysis.bpm)} BPM`;
    } else if (beatFailures.has(url)) {
        note.textContent = 'Không đọc được sóng nhạc từ link này';
    } else {
        note.textContent = 'Đang đọc sóng nhạc...';
        analyzeMusicCached(url).catch(() => {});
    }
}

function getTrack() {
    if (track) return track;
    track = createTimelineTrack(document.getElementById('track-view'), {
        getEvents: () => state.events,
        activeId: () => state.activeEventId,
        icon: event => SHELL_ICONS[event.shell] || '🎆',
        color: markerColor,
        title: (event, time) => `#${state.events.indexOf(event) + 1} ${event.shell} · ${formatMusicTime(time)}`
            + (isSyncMode() ? ' (nổ)' : ''),
        escape: escapeHtml,
        isSync: isSyncMode,
        musicStart: () => Number(state.music?.start) || 0,
        analysis: currentMusicAnalysis,
        snapToBeats: () => document.getElementById('track-snap').checked,
        formatTime: formatMusicTime,
        // Vạch chạy theo nhạc builder đang phát cùng khung xem nhanh
        musicPosition: () => {
            const audio = getMusicAudio();
            return previewMusicPlaying && audio && !audio.paused ? (audio.currentTime - (Number(state.music?.start) || 0)) * 1000 : null;
        },
        onSelect: id => selectEvent(id),
        onMove: (id, time) => moveEventToTime(id, time),
        onAdd: time => addEventAtTime(time)
    });
    return track;
}

// Đặt phát bắn vào thời điểm `time` (ms; lúc phóng, hoặc lúc nổ khi khớp nhịp nhạc). Các phát khác giữ nguyên
// thời điểm: các đợt được xếp lại, "Tạm dừng" được tạo lại cho vừa (timeline.js).
function moveEventToTime(id, time) {
    const { items, end } = eventTimes(state.events);
    const item = items.find(i => i.event.id === id);
    if (!item) return;
    const tail = end - Math.max(...items.map(i => i.time));
    item.time = Math.max(0, Math.round(time));
    const { placed, pauses } = layoutBursts(items, tail);
    placed.forEach(({ event, burst, delay }) => {
        event.burst = burst;
        event.delay = delay;
    });
    if (state.events.some(e => e.id === state.activeEventId && isPauseEvent(e))) state.activeEventId = null;
    state.events = state.events.filter(e => !isPauseEvent(e));
    pauses.forEach(p => addEvent({ burst: p.burst, shell: 'Tạm dừng', duration: p.duration }, { render: false }));
    // Trong mỗi đợt: theo thời điểm, Tạm dừng ở cuối
    state.events.sort((a, b) => (a.burst - b.burst)
        || (isPauseEvent(a) - isPauseEvent(b))
        || ((Number(a.delay) || 0) - (Number(b.delay) || 0)));
    renderEventList();
    renderInspector();
    scheduleCheckpoint();
}

// Nhấn đúp chỗ trống: thêm phát bắn mới ở thời điểm đó rồi mở bảng chỉnh sửa
function addEventAtTime(time) {
    addEvent({ burst: 1 }, { render: false });
    const added = state.events[state.events.length - 1];
    moveEventToTime(added.id, time);
    selectEvent(added.id);
}

// ---------------------------------------------------------------------------
// TẠO VIDEO: khung ẩn (demo.html?record=1) chạy chính trình phát ở cỡ video đã chọn, dựng màn trình diễn thành file
// MP4 kèm tiếng pháo và nhạc nền, nhanh hết mức máy cho phép (xem video-export.js, recorder.js), rồi gửi file về đây
// để xem lại, tải về hoặc chia sẻ
// ---------------------------------------------------------------------------
