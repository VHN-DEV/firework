/*!
 * Hanabi – trình phát: âm thanh thiên nhiên (hàng đợi dựng tiếng)
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Dựng tiếng ở worker (render-worker.js); trình duyệt không tạo được worker (mở file trực tiếp, trình duyệt cũ) thì dựng
// ngay trên luồng chính, mỗi tiếng một lượt để giữa các lượt trình duyệt vẫn vẽ khung hình.

let worker;
const jobs = new Map();
let nextJob = 1;
let queue = Promise.resolve();

function inline(request) {
    const job = queue.then(() => import('./sounds/index.js')).then(m => new Promise((resolve, reject) => {
        setTimeout(() => {
            try {
                resolve(m.renderSound(request));
            } catch (e) {
                reject(e);
            }
        }, 0);
    }));
    // Một tiếng dựng lỗi không được chặn các tiếng sau: hàng đợi là chuỗi promise, một lần reject thì mọi lượt sau cũng hỏng
    queue = job.catch(() => {});
    return job;
}

function useInline() {
    worker = null;
    const pending = [...jobs.values()];
    jobs.clear();
    pending.forEach(({ request, resolve, reject }) => inline(request).then(resolve, reject));
}

function getWorker() {
    if (worker !== undefined) return worker;
    try {
        worker = new Worker(new URL('./render-worker.js', import.meta.url), { type: 'module' });
        worker.onmessage = e => {
            const job = jobs.get(e.data.job);
            if (!job) return;
            jobs.delete(e.data.job);
            if (e.data.error) job.reject(new Error(e.data.error));
            else job.resolve(e.data.data);
        };
        worker.onerror = useInline;
    } catch (e) {
        worker = null;
    }
    return worker;
}

// Dựng một tiếng { id, params, part } -> Promise<Float32Array>
export function renderInBackground(request) {
    const w = getWorker();
    if (!w) return inline(request);
    return new Promise((resolve, reject) => {
        const job = nextJob++;
        jobs.set(job, { request, resolve, reject });
        w.postMessage({ job, ...request });
    });
}
