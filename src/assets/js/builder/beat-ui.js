/*!
 * Hanabi – builder (xếp theo nhịp)
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Xếp pháo theo nhịp nhạc: phân tích nhạc, mật độ, biểu đồ, áp dụng.

import { KEEP_SHELLS, analyzeMusic, buildBeatShow } from '../beat-sync.js';
import { state } from './state.js';
import { formatDuration, formatNumber, hideModal, normalizeAssetPath, notify, showModal, syncLoopState } from './util.js';
import { addEvent } from './events.js';
import { isSyncMode, renderEventList, renderTrackTools, timelineView } from './timeline.js';
import { renderInspector } from './inspector.js';
import { renderMusic } from './music.js';
import { playMiniPreviewOnce, previewSoundOn, togglePreviewSound } from './preview.js';
import { scheduleCheckpoint } from './history.js';

// Kết quả phân tích theo link nhạc (phân tích một lần, mở lại hộp thoại là có ngay)
const beatAnalyses = new Map();

// Kết quả đã xong (dòng thời gian theo giây vẽ sóng nhạc ngay) và các link không đọc được
export const beatResults = new Map();

export const beatFailures = new Set();

const MAX_BEAT_SECONDS = 480;

export function analyzeMusicCached(url, onProgress) {
    if (!beatAnalyses.has(url)) {
        const job = analyzeMusic(url, onProgress);
        beatAnalyses.set(url, job);
        job.then(analysis => {
            beatResults.set(url, analysis);
            beatFailures.delete(url);
            if (timelineView === 'track') renderEventList();
        }, () => {
            beatAnalyses.delete(url);
            beatFailures.add(url);
            if (timelineView === 'track') renderTrackTools();
        });
    }
    return beatAnalyses.get(url);
}

let beatAnalysis = null;

export let beatDensity = 'medium';

export async function openBeatModal() {
    if (!state.music) return;
    const url = normalizeAssetPath(state.music.url);
    beatAnalysis = null;
    setBeatDensity(beatDensity);
    renderBeatStatus('loading', 0);
    showModal('beat-modal');
    beatFailures.delete(url);
    try {
        const analysis = await analyzeMusicCached(url, p => {
            if (!beatAnalysis) renderBeatStatus('loading', p);
        });
        // Trong lúc chờ đã đổi bài nhạc khác
        if (!state.music || normalizeAssetPath(state.music.url) !== url) return;
        beatAnalysis = analysis;
        renderBeatResult();
    } catch (e) {
        console.warn('[Builder] Không phân tích được bài nhạc:', e);
        renderBeatStatus('error', e.code);
    }
}

function renderBeatStatus(status, detail) {
    const box = document.getElementById('beat-status');
    document.getElementById('beat-result').classList.toggle('hide', status !== 'ready');
    document.getElementById('btn-beat-apply').disabled = status !== 'ready';
    box.classList.toggle('hide', status === 'ready');
    box.classList.toggle('error', status === 'error');
    if (status === 'loading') {
        const percent = Math.round((detail || 0) * 100);
        box.innerHTML = `<i class="fas fa-circle-notch fa-spin"></i><span>Đang nghe bài nhạc... ${percent}%</span>
            <div class="beat-progress"><span style="width: ${percent}%"></span></div>`;
    } else if (status === 'error') {
        const messages = {
            fetch: 'Không tải được bài nhạc từ link này (máy chủ nhạc không cho đọc). Hãy chọn file nhạc từ máy rồi thử lại.',
            decode: 'Trình duyệt không đọc được định dạng bài nhạc này. Hãy thử file MP3.',
            'no-beat': 'Không tìm thấy nhịp rõ ràng trong bài nhạc này (bài quá ngắn hoặc không có tiết tấu).'
        };
        box.innerHTML = `<i class="fas fa-triangle-exclamation"></i><span>${messages[detail]
            || 'Không đọc được bài nhạc. Hãy thử lại hoặc chọn file nhạc từ máy.'}</span>`;
    }
}

function getKeepEvents() {
    return state.events.filter(e => KEEP_SHELLS.includes(e.shell));
}

function renderBeatResult() {
    const analysis = beatAnalysis;
    const start = Number(state.music.start) || 0;
    const available = Math.max(0, analysis.duration - start);
    const select = document.getElementById('beat-length');
    // Kịch bản tối đa 200 đợt (~10 phút): bài quá dài thì bắn tối đa 8 phút
    const options = [30, 60, 120, 180, 300].filter(s => s < Math.min(available, MAX_BEAT_SECONDS) - 10)
        .map(s => `<option value="${s}">${formatDuration(s * 1000)}</option>`);
    const clock = Math.floor(available / 60) + ':' + String(Math.floor(available % 60)).padStart(2, '0');
    select.innerHTML = options.join('') + (available <= MAX_BEAT_SECONDS
        ? `<option value="all">Hết bài (${clock})</option>`
        : `<option value="${MAX_BEAT_SECONDS}">${formatDuration(MAX_BEAT_SECONDS * 1000)}</option>`);
    select.value = select.options[select.options.length - 1].value;
    const keep = getKeepEvents();
    const texts = keep.filter(e => e.shell !== 'Lời nhắn').length;
    const captions = keep.length - texts;
    document.getElementById('beat-keep-row').classList.toggle('hide', !keep.length);
    document.getElementById('beat-keep-hint').textContent = [texts && `${texts} chữ/ảnh trên trời`, captions && `${captions} lời nhắn`]
        .filter(Boolean).join(', ') + ' · đặt vào các phách mạnh, giữ thứ tự cũ';
    const drops = analysis.drops.filter(i => analysis.beats[i].time >= start).length;
    document.getElementById('beat-summary').innerHTML = `Nhịp khoảng <strong>${formatNumber(analysis.bpm)} BPM</strong>`
        + ` · bài dài ${formatDuration(analysis.duration * 1000)}`
        + (drops ? ` · <strong>${drops}</strong> chỗ nhạc bùng lên` : '');
    renderBeatStatus('ready');
    drawBeatChart();
}

export function setBeatDensity(density) {
    beatDensity = density;
    document.querySelectorAll('.beat-density button').forEach(btn => btn.classList.toggle('active', btn.dataset.density === density));
}

function getBeatLength() {
    const value = document.getElementById('beat-length').value;
    return value === 'all' ? Infinity : Number(value);
}

// Độ sôi động từng ô nhịp; phần sẽ bắn sáng màu, chỗ nhạc bùng lên đánh dấu vàng
export function drawBeatChart() {
    const canvas = document.getElementById('beat-chart');
    if (!canvas || !beatAnalysis) return;
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth || 560;
    const height = canvas.clientHeight || 88;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const { beats, drops, duration } = beatAnalysis;
    const start = Number(state.music?.start) || 0;
    const end = start + getBeatLength();
    const bars = [];
    beats.forEach(beat => {
        if (!bars.length || beat.downbeat) bars.push({ time: beat.time, sum: 0, n: 0 });
        const bar = bars[bars.length - 1];
        bar.sum += beat.level;
        bar.n++;
    });
    const x = time => (time / duration) * width;
    bars.forEach((bar, i) => {
        const next = bars[i + 1] ? bars[i + 1].time : duration;
        const level = bar.sum / bar.n;
        const h = Math.max(2, level * (height - 14));
        const inRange = bar.time >= start - 0.05 && bar.time < end;
        ctx.fillStyle = inRange ? `hsl(${265 - level * 225}, 90%, ${55 + level * 10}%)` : 'rgba(255, 255, 255, 0.12)';
        ctx.fillRect(x(bar.time), height - h, Math.max(1, x(next) - x(bar.time) - 1), h);
    });
    ctx.fillStyle = '#ffbf36';
    drops.forEach(i => {
        const px = x(beats[i].time);
        ctx.beginPath();
        ctx.moveTo(px - 4, 0);
        ctx.lineTo(px + 4, 0);
        ctx.lineTo(px, 7);
        ctx.fill();
    });
}

export function applyBeatShow() {
    if (!beatAnalysis || !state.music) return;
    const keep = document.getElementById('beat-keep').checked
        ? getKeepEvents().map(({ id, expanded, ...event }) => event)
        : [];
    let show;
    try {
        show = buildBeatShow(beatAnalysis, {
            start: Number(state.music.start) || 0, length: getBeatLength(), density: beatDensity, keep
        });
    } catch (e) {
        notify('Đoạn nhạc từ giây bắt đầu tới hết quá ngắn để xếp pháo.', 'error');
        return;
    }
    state.events = [];
    state.activeEventId = null;
    show.events.forEach(event => addEvent(event, { render: false }));
    state.music.sync = true;
    state.music.bpm = beatAnalysis.bpm;
    // Màn trình diễn theo bài nhạc: chạy một lượt rồi hiện màn kết
    document.getElementById('loop').checked = false;
    hideModal('beat-modal');
    renderMusic();
    renderEventList();
    renderInspector();
    syncLoopState();
    scheduleCheckpoint();
    // Nghe thử ngay (đang trong lúc bấm nên trình duyệt cho phát nhạc)
    if (state.miniPreviewEnabled) {
        if (!previewSoundOn) togglePreviewSound();
        else playMiniPreviewOnce();
    }
    notify(`Đã xếp ${show.shots} phát pháo theo nhịp ${formatNumber(beatAnalysis.bpm)} BPM. `
        + (state.miniPreviewEnabled ? 'Đang phát thử ở khung xem nhanh.' : 'Bấm Xem thử để nghe cùng nhạc.'), 'success');
}

// Đổi giây bắt đầu của kịch bản khớp nhịp: các phát vẫn tính từ lúc nhạc bắt đầu nên sẽ lệch nhịp
export function afterMusicStartChange() {
    if (isSyncMode() && state.events.length) {
        notify('Đã đổi giây bắt đầu: bấm "Xếp pháo theo nhịp nhạc" để xếp lại cho khớp nhịp.', 'warning');
    }
    renderEventList();
}

// ---------------------------------------------------------------------------
// BÁO MỞ QUÀ (gift-tracking.js, api/opens.php): mã theo dõi của kịch bản mới được giữ trong trình duyệt này;
// hộp Chia sẻ và danh sách kịch bản hiện trạng thái; đang mở builder thì hỏi định kỳ, có người vừa mở quà thì báo.
// ---------------------------------------------------------------------------
