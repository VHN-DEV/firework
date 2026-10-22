/*!
 * Trình diễn Pháo hoa – trình phát (mặc định của người xem)
 * Phần bổ sung và chỉnh sửa © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Cài đặt khi xem do kịch bản đặt sẵn.

import { IS_RECORD } from '../env.js';
import { quality } from '../state.js';
import { QUALITY_AUTO, validQuality } from '../quality.js';
import { configDidUpdate, handleResize, store } from '../../script.js';

// Cách xem kịch bản đặt sẵn (builder, nhóm "Khi người nhận xem"). Chỉ áp cho mục người xem chưa tự chọn trong Cài đặt;
// người xem vẫn đổi được. Kịch bản sau (bản xem nhanh nhận kịch bản mới) bỏ giá trị cũ rồi mới áp giá trị mới.
const VIEWER_DEFAULTS = {
    // Kịch bản cũ ghi Thấp / Vừa / Cao (1-3): đổi sang mức tương ứng
    quality: v => (validQuality(v) !== QUALITY_AUTO ? validQuality(v) : null),
    skyLighting: v => (['0', '1', '2'].includes(String(v)) ? String(v) : null),
    scaleFactor: v => (Number(v) >= 0.5 && Number(v) <= 2 ? Number(Number(v).toFixed(2)) : null),
    hideControls: v => (typeof v === 'boolean' ? v : null)
};

export function applyViewerDefaults(viewer) {
    const prev = store.state.config;
    const next = {};
    store.scriptKeys.forEach(key => { next[key] = store.saved[key]; });
    store.scriptKeys.clear();
    if (viewer && typeof viewer === 'object') {
        Object.entries(VIEWER_DEFAULTS).forEach(([key, read]) => {
            // Khung quay video luôn ở chất lượng Cao
            if (store.chosen.has(key) || viewer[key] === undefined || (IS_RECORD && key === 'quality')) return;
            const value = read(viewer[key]);
            if (value === null) return;
            next[key] = value;
            store.scriptKeys.add(key);
        });
    }
    if (!Object.keys(next).some(key => String(next[key]) !== String(prev[key]))) return;
    store.setState({ config: { ...prev, ...next } });
    configDidUpdate();
    if (String(next.scaleFactor ?? prev.scaleFactor) !== String(prev.scaleFactor)) handleResize();
}
