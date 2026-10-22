/*!
 * Trình diễn Pháo hoa – trình phát: âm thanh thiên nhiên (luồng dựng tiếng)
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Dựng tiếng trong luồng riêng (mỗi cảnh cần ~1 giây tính toán) để pháo hoa không bị khựng: nhận { job, id, params,
// part }, trả { job, data } (Float32Array, chuyển quyền sở hữu không chép) hoặc { job, error }.

import { renderSound } from './sounds/index.js';

self.onmessage = e => {
    const { job, ...request } = e.data;
    try {
        const data = renderSound(request);
        self.postMessage({ job, data }, [data.buffer]);
    } catch (err) {
        self.postMessage({ job, error: String((err && err.message) || err) });
    }
};
