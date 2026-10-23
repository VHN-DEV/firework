/*!
 * Hanabi – thời điểm các phát bắn
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Kịch bản chia theo đợt: mỗi đợt dài (2500 ms + "Tạm dừng" dài nhất) × 1,25, đợt trống chỉ 1000 ms × 1,25,
// mỗi phát bắn lúc "đầu đợt + trễ" (giống startSequence() của trình phát). Dòng thời gian theo giây làm việc
// với thời điểm tuyệt đối: eventTimes() đổi đợt + trễ ra thời điểm, layoutBursts() xếp lại các đợt từ thời điểm.

export const BURST_MS = 2500 * 1.25;

export const isPauseEvent = event => event.shell === 'Tạm dừng';

export function burstWindow(events) {
    if (!events.length) return 1000 * 1.25;
    const pauses = events.filter(isPauseEvent).map(e => Number(e.duration) || 2000);
    return (2500 + Math.max(0, ...pauses)) * 1.25;
}

// { starts: [lúc bắt đầu mỗi đợt (ms), chỉ số là số đợt], items: [{ event, time }] (không gồm Tạm dừng), end }
export function eventTimes(events) {
    const maxBurst = events.reduce((max, e) => Math.max(max, Number(e.burst) || 1), 0);
    const starts = [];
    const items = [];
    let start = 0;
    for (let burst = 1; burst <= maxBurst; burst++) {
        const list = events.filter(e => (Number(e.burst) || 1) === burst);
        starts[burst] = start;
        list.forEach(e => {
            if (!isPauseEvent(e)) items.push({ event: e, time: start + (Number(e.delay) || 0) });
        });
        start += burstWindow(list);
    }
    return { starts, items, end: start };
}

// Xếp lại các đợt mà mọi phát giữ đúng thời điểm: đợt mới bắt đầu ngay ở phát đầu tiên không còn nằm trong đợt
// trước, đợt trước được kéo dài bằng "Tạm dừng" cho vừa khít (không có đợt trống làm lệch các đợt sau).
// tail: khoảng từ phát cuối tới lúc hết màn trình diễn.
// Trả về placed: [{ event, burst, delay }] và pauses: [{ burst, duration }] (các phát Tạm dừng mới).
export function layoutBursts(items, tail = BURST_MS) {
    const sorted = [...items].sort((a, b) => a.time - b.time);
    const placed = [];
    const pauses = [];
    let burst = 1;
    let start = 0;
    // Kéo dài đợt đang xếp cho tới `end`, trả về lúc bắt đầu đợt kế tiếp
    const extendTo = end => {
        const pause = Math.round((end - start) / 1.25 - 2500);
        if (pause > 0) pauses.push({ burst, duration: pause });
        return start + (2500 + Math.max(0, pause)) * 1.25;
    };
    sorted.forEach(({ event, time }) => {
        const t = Math.max(0, time);
        if (t >= start + BURST_MS) {
            start = extendTo(t);
            burst++;
        }
        placed.push({ event, burst, delay: Math.max(0, Math.round(t - start)) });
    });
    const last = sorted.length ? Math.max(0, sorted[sorted.length - 1].time) : 0;
    if (last + tail > start + BURST_MS) extendTo(last + tail);
    return { placed, pauses };
}
