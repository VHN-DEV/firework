/*!
 * Trình diễn Pháo hoa – dòng thời gian theo giây
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Dòng thời gian theo giây trong builder: thước giây, dải các đợt, hình sóng nhạc và vạch phách (vẽ trên một canvas
// đúng bằng phần đang nhìn, vẽ lại khi cuộn) và các phát bắn đặt đúng thời điểm (kéo ngang để đổi thời điểm,
// bấm để chỉnh, nhấn đúp chỗ trống để thêm phát, phím mũi tên để nhích). Thời điểm của phát là lúc phóng,
// hoặc lúc nổ khi kịch bản khớp nhịp nhạc.

import { eventTimes } from './timeline.js';

const RULER = 24;
// Dải sóng nhạc (không có nhạc thì chỉ chừa một khoảng nhỏ)
const WAVE = 58;
const NO_WAVE = 10;
const LANE = 34;
const MARKER = 28;
const PAD = 16;
const MIN_LANES = 3;
const MIN_PPS = 4;
const MAX_PPS = 480;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * api: getEvents(), activeId(), icon(event), color(event), title(event, time), escape(text), isSync(),
 * musicStart() (giây), analysis() ({ beats, envelope, envelopeRate } hoặc null), snapToBeats(),
 * formatTime(ms), musicPosition() (ms hoặc null), onSelect(id), onMove(id, ms), onAdd(ms)
 */
export function createTimelineTrack(root, api) {
    root.innerHTML = `
        <div class="track-scroll">
            <div class="track-content"><canvas class="track-canvas"></canvas></div>
        </div>
        <div class="track-drag-label hide"></div>`;
    const scroller = root.querySelector('.track-scroll');
    const content = root.querySelector('.track-content');
    const canvas = root.querySelector('.track-canvas');
    const label = root.querySelector('.track-drag-label');
    let pps = 0;
    let fitted = true;
    let model = { starts: [], items: [], end: 0 };
    let wave = NO_WAVE;
    let height = RULER + wave + MIN_LANES * LANE + 12;
    let drag = null;
    let frame = null;
    let playhead = null;

    const timeToX = ms => PAD + ms / 1000 * pps;
    const xToTime = x => (x - PAD) / pps * 1000;

    function fitZoom() {
        const width = scroller.clientWidth || 600;
        const seconds = Math.max(6, (model.end + 1000) / 1000);
        pps = clamp((width - PAD * 2) / seconds, MIN_PPS, MAX_PPS);
    }

    function render() {
        model = eventTimes(api.getEvents());
        wave = api.analysis() ? WAVE : NO_WAVE;
        if (fitted || !pps) fitZoom();
        const items = [...model.items].sort((a, b) => a.time - b.time);
        // Mỗi phát một nút; nút chạm nhau thì xuống hàng dưới
        const laneEnds = [];
        const activeId = api.activeId();
        const markers = items.map(({ event, time }) => {
            const x = timeToX(time);
            const isCaption = event.shell === 'Lời nhắn';
            const width = isCaption ? Math.max(MARKER, (Number(event.duration) || 4000) / 1000 * pps) : MARKER;
            const left = isCaption ? x : x - MARKER / 2;
            let lane = laneEnds.findIndex(end => end <= left - 3);
            if (lane === -1) {
                lane = laneEnds.length;
                laneEnds.push(0);
            }
            laneEnds[lane] = left + width;
            const top = RULER + wave + 6 + lane * LANE;
            return `<button type="button" class="track-marker${isCaption ? ' is-caption' : ''}${event.id === activeId ? ' active' : ''}"
                data-id="${event.id}" data-time="${time}" data-anchor="${isCaption ? 0 : MARKER / 2}"
                style="left:${left}px;top:${top}px;width:${width}px;--c:${api.color(event)}"
                title="${api.escape(api.title(event, time))}">${api.icon(event)}${isCaption ? `<span>${api.escape(event.text || '')}</span>` : ''}</button>`;
        });
        height = RULER + wave + Math.max(MIN_LANES, laneEnds.length) * LANE + 12 + (wave === NO_WAVE ? 12 : 0);
        const width = Math.max(timeToX(model.end + 1500) + PAD, scroller.clientWidth);
        content.style.width = `${width}px`;
        content.style.height = `${height}px`;
        [...content.querySelectorAll('.track-marker, .track-playhead')].forEach(el => el.remove());
        content.insertAdjacentHTML('beforeend', markers.join('') + '<span class="track-playhead hide"></span>');
        playhead = content.querySelector('.track-playhead');
        drawBackground();
        if (!frame) frame = requestAnimationFrame(tick);
    }

    // Bước của thước: nhãn cách nhau ít nhất ~70px
    function rulerSteps() {
        const major = [0.5, 1, 2, 5, 10, 15, 30, 60, 120].find(s => s * pps >= 70) || 120;
        return { major, minor: major / (major >= 5 ? 5 : 4) };
    }

    function drawBackground() {
        const width = scroller.clientWidth || 600;
        const dpr = window.devicePixelRatio || 1;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        const ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const left = scroller.scrollLeft;
        const style = getComputedStyle(root);
        const muted = style.getPropertyValue('--track-muted').trim() || '#8f98ad';
        const accent = style.getPropertyValue('--track-accent').trim() || '#7c6cff';
        ctx.font = '10px Inter, system-ui, sans-serif';
        ctx.textBaseline = 'middle';

        // Dải các đợt, đánh số ở góc
        for (let burst = 1; burst < model.starts.length; burst++) {
            const x0 = timeToX(model.starts[burst]) - left;
            const x1 = timeToX(burst + 1 < model.starts.length ? model.starts[burst + 1] : model.end) - left;
            if (x1 < 0 || x0 > width) continue;
            ctx.fillStyle = burst % 2 ? 'rgba(255, 255, 255, 0.035)' : 'rgba(255, 255, 255, 0.012)';
            ctx.fillRect(x0, RULER, x1 - x0, height - RULER);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.09)';
            ctx.fillRect(x0, RULER, 1, height - RULER);
            if (x1 - x0 > 38) {
                ctx.fillStyle = muted;
                ctx.fillText(`Đợt ${burst}`, x0 + 5, RULER + wave + 1);
            }
        }
        // Hết màn trình diễn
        const endX = timeToX(model.end) - left;
        if (endX >= 0 && endX <= width) {
            ctx.fillStyle = 'rgba(245, 180, 67, 0.6)';
            ctx.fillRect(endX, RULER, 1.5, height - RULER);
        }

        // Sóng nhạc và vạch phách (thời điểm trong bài = giây bắt đầu phát + thời điểm trên dòng thời gian)
        const analysis = api.analysis();
        const songStart = api.musicStart();
        if (analysis && analysis.envelope) {
            const { envelope, envelopeRate } = analysis;
            const mid = RULER + wave / 2;
            ctx.fillStyle = accent;
            ctx.globalAlpha = 0.55;
            for (let px = 0; px < width; px += 2) {
                const a = (xToTime(left + px) / 1000 + songStart) * envelopeRate;
                const b = (xToTime(left + px + 2) / 1000 + songStart) * envelopeRate;
                if (b < 0 || a >= envelope.length) continue;
                let peak = 0;
                for (let i = Math.max(0, Math.floor(a)); i <= Math.min(envelope.length - 1, Math.ceil(b)); i++) peak = Math.max(peak, envelope[i]);
                const h = Math.max(1, peak * (wave - 10));
                ctx.fillRect(px, mid - h / 2, 1.5, h);
            }
            ctx.globalAlpha = 1;
            const beats = analysis.beats || [];
            if (beats.length > 1 && (beats[1].time - beats[0].time) * pps >= 6) {
                beats.forEach(beat => {
                    const x = timeToX((beat.time - songStart) * 1000) - left;
                    if (x < 0 || x > width) return;
                    ctx.fillStyle = beat.downbeat ? 'rgba(255, 255, 255, 0.28)' : 'rgba(255, 255, 255, 0.1)';
                    ctx.fillRect(x, RULER, 1, wave);
                });
            }
        }

        // Thước giây
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.fillRect(0, 0, width, RULER);
        const { major, minor } = rulerSteps();
        const first = Math.max(0, Math.floor(xToTime(left) / 1000 / minor) * minor);
        for (let s = first; s * 1000 <= xToTime(left + width); s = Math.round((s + minor) * 1000) / 1000) {
            const x = timeToX(s * 1000) - left;
            const isMajor = Math.abs(s / major - Math.round(s / major)) < 1e-6;
            if (!isMajor && minor * pps < 6) continue;
            ctx.fillStyle = isMajor ? muted : 'rgba(255, 255, 255, 0.18)';
            ctx.fillRect(x, isMajor ? RULER - 9 : RULER - 5, 1, isMajor ? 9 : 5);
            // Giây chẵn thì bỏ phần lẻ: 0:10 thay vì 0:10,0
            if (isMajor) ctx.fillText(api.formatTime(s * 1000).replace(/,0$/, ''), x + 4, RULER / 2 - 1);
        }
    }

    // Vạch chạy theo nhạc khi đang nghe nhạc cùng khung xem nhanh
    function tick() {
        frame = requestAnimationFrame(tick);
        if (!playhead || !root.isConnected || root.offsetParent === null) return;
        const position = api.musicPosition();
        playhead.classList.toggle('hide', position === null);
        if (position !== null) playhead.style.left = `${timeToX(position)}px`;
    }

    // Bám phách (nhạc đã phân tích), không thì theo bước 0,1 giây; giữ Alt để thả tự do
    function snap(time, free) {
        if (free) return Math.round(time);
        const analysis = api.snapToBeats() && api.analysis();
        if (analysis && analysis.beats && analysis.beats.length) {
            const songStart = api.musicStart() * 1000;
            let best = null;
            analysis.beats.forEach(beat => {
                const t = beat.time * 1000 - songStart;
                if (best === null || Math.abs(t - time) < Math.abs(best - time)) best = t;
            });
            if (best !== null && best >= 0 && Math.abs(best - time) <= 150) return Math.round(best);
        }
        return Math.round(time / 100) * 100;
    }

    function showLabel(el, time) {
        label.textContent = `${api.formatTime(time)} · ${api.isSync() ? 'nổ' : 'phóng'}`;
        label.classList.remove('hide');
        const box = root.getBoundingClientRect();
        const r = el.getBoundingClientRect();
        label.style.left = `${clamp(r.left - box.left + r.width / 2, 40, box.width - 40)}px`;
        label.style.top = `${r.top - box.top - 6}px`;
    }

    content.addEventListener('pointerdown', (e) => {
        const marker = e.target.closest('.track-marker');
        if (!marker || e.button > 0) return;
        drag = {
            id: Number(marker.dataset.id), el: marker, x: e.clientX, time0: Number(marker.dataset.time),
            anchor: Number(marker.dataset.anchor), time: Number(marker.dataset.time), moved: false
        };
        marker.setPointerCapture(e.pointerId);
    });
    content.addEventListener('pointermove', (e) => {
        if (!drag) return;
        const dx = e.clientX - drag.x;
        if (!drag.moved && Math.abs(dx) < 4) return;
        drag.moved = true;
        drag.time = snap(Math.max(0, drag.time0 + dx / pps * 1000), e.altKey);
        drag.el.style.left = `${timeToX(drag.time) - drag.anchor}px`;
        drag.el.classList.add('dragging');
        showLabel(drag.el, drag.time);
    });
    const endDrag = (e) => {
        if (!drag) return;
        const { id, moved, time } = drag;
        drag = null;
        label.classList.add('hide');
        if (e.type === 'pointercancel') render();
        else if (moved) api.onMove(id, time);
        else api.onSelect(id);
    };
    content.addEventListener('pointerup', endDrag);
    content.addEventListener('pointercancel', endDrag);
    // Bàn phím: Enter để chỉnh, mũi tên để nhích 0,1 giây (Shift: 1 giây)
    content.addEventListener('click', (e) => {
        const marker = e.target.closest('.track-marker');
        if (marker && e.detail === 0) api.onSelect(Number(marker.dataset.id));
    });
    content.addEventListener('keydown', (e) => {
        const marker = e.target.closest('.track-marker');
        if (!marker || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
        e.preventDefault();
        const step = (e.shiftKey ? 1000 : 100) * (e.key === 'ArrowLeft' ? -1 : 1);
        const id = marker.dataset.id;
        api.onMove(Number(id), Math.max(0, Number(marker.dataset.time) + step));
        content.querySelector(`.track-marker[data-id="${id}"]`)?.focus();
    });
    content.addEventListener('dblclick', (e) => {
        if (e.target.closest('.track-marker')) return;
        const x = e.clientX - content.getBoundingClientRect().left;
        api.onAdd(snap(Math.max(0, xToTime(x)), e.altKey));
    });
    scroller.addEventListener('scroll', drawBackground, { passive: true });
    new ResizeObserver(() => {
        if (!root.offsetParent) return;
        if (fitted) render();
        else drawBackground();
    }).observe(scroller);

    return {
        render,

        // dir > 0 phóng to, < 0 thu nhỏ, 0 vừa khung; giữ nguyên thời điểm ở giữa phần đang nhìn
        zoom(dir) {
            const width = scroller.clientWidth;
            const center = xToTime(scroller.scrollLeft + width / 2);
            fitted = dir === 0;
            if (!fitted) pps = clamp(pps * (dir > 0 ? 1.6 : 1 / 1.6), MIN_PPS, MAX_PPS);
            render();
            if (!fitted) scroller.scrollLeft = timeToX(center) - width / 2;
            drawBackground();
        },

        // Cuộn tới phát bắn (vừa chọn ở danh sách hoặc vừa thêm)
        reveal(id) {
            const marker = content.querySelector(`.track-marker[data-id="${id}"]`);
            if (!marker) return;
            const x = parseFloat(marker.style.left);
            if (x < scroller.scrollLeft + 20 || x > scroller.scrollLeft + scroller.clientWidth - 40) {
                scroller.scrollLeft = x - scroller.clientWidth / 2;
            }
        }
    };
}
