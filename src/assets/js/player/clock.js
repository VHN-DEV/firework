/*!
 * Hanabi – trình phát: đồng hồ của màn trình diễn
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Bình thường là đồng hồ thật (performance.now, setTimeout). Lúc dựng video thì chuyển sang đồng hồ giả lập: thời gian
// chỉ trôi khi trình dựng bước sang khung hình kế tiếp (advanceClock), nên video ra đều đặn dù máy vẽ nhanh hay chậm.
// Mọi hẹn giờ trong lúc chạy màn trình diễn (tiêu đề mờ dần, lời nhắn, màn kết, pháo nổ chùm...) đi qua đây.

let simulated = null;
let timers = [];
let nextId = 0;

export const now = () => (simulated === null ? performance.now() : simulated);

export const isSimulated = () => simulated !== null;

// Như setTimeout; trả về mã để hủy bằng cancel()
export function after(ms, fn) {
    if (simulated === null) return setTimeout(fn, ms);
    const id = `sim-${++nextId}`;
    timers.push({ id, at: simulated + Math.max(0, Number(ms) || 0), fn });
    return id;
}

// Như setInterval; hủy bằng cancel()
export function every(ms, fn) {
    if (simulated === null) return setInterval(fn, ms);
    const id = `sim-${++nextId}`;
    const tick = () => {
        timers.push({ id, at: simulated + ms, fn: () => { tick(); fn(); } });
    };
    tick();
    return id;
}

export function cancel(id) {
    if (typeof id === 'string') timers = timers.filter(t => t.id !== id);
    else clearTimeout(id);
}

// Bắt đầu đồng hồ giả lập ở mốc 0 (bỏ các hẹn giờ thật còn chờ là việc của nơi gọi)
export function useSimulatedClock() {
    simulated = 0;
    timers = [];
}

// Cho đồng hồ giả lập trôi thêm `ms`, chạy các hẹn giờ tới hạn đúng thứ tự thời điểm
export function advanceClock(ms) {
    const end = simulated + ms;
    for (;;) {
        let due = null;
        timers.forEach(t => {
            if (t.at <= end && (!due || t.at < due.at)) due = t;
        });
        if (!due) break;
        timers = timers.filter(t => t !== due);
        simulated = Math.max(simulated, due.at);
        due.fn();
    }
    simulated = end;
}
