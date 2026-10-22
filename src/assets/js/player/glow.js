/*!
 * Trình diễn Pháo hoa – trình phát: quầng sáng quanh pháo
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Quầng sáng (như mắt và máy quay thấy pháo thật): hạt sáng tỏa quầng, chỗ pháo dày đặc rực cả một vùng trời.
// Thu nhỏ lớp vệt sáng nhiều bậc, mỗi bậc một nửa (đúng trung bình 2×2 điểm ảnh nên không sót nét mảnh), rồi từ bậc nhỏ
// nhất phóng ngược lên cộng dồn vào bậc trên (bậc càng nhỏ quầng càng rộng, phóng hai lần nên mịn), cuối cùng cộng sáng
// bậc lớn nhất lên lớp pháo. Các bậc chẵn lẻ nằm trên hai canvas xen kẽ (không vẽ canvas vào chính nó), mỗi canvas xếp
// các bậc cạnh nhau: canvas quá nhỏ trình duyệt không vẽ bằng card đồ họa, đọc ngược ảnh mỗi khung rất chậm.

import { makeCanvas } from './utils.js';

// Khoảng trống giữa các bậc trên cùng canvas: lấy mẫu ở mép không lem sang bậc bên cạnh
const GAP = 2;

const sheets = [makeCanvas(1, 1), makeCanvas(1, 1)];
let levels = [];
let layoutKey = '';

// Bậc i (1: một nửa, 2: một phần tư...) nằm trên canvas i % 2, cạnh các bậc cùng canvas
function layout(width, height, depth) {
    const key = `${width}x${height}x${depth}`;
    if (key === layoutKey) return;
    layoutKey = key;
    levels = [];
    const size = [{ w: 0, h: 0 }, { w: 0, h: 0 }];
    for (let i = 1; i <= depth; i++) {
        const sheet = i % 2;
        const w = Math.max(1, Math.ceil(width / 2 ** i));
        const h = Math.max(1, Math.ceil(height / 2 ** i));
        levels[i] = { sheet, x: size[sheet].w, w, h };
        size[sheet].w += w + GAP;
        size[sheet].h = Math.max(size[sheet].h, h);
    }
    sheets.forEach(([canvas], i) => {
        canvas.width = Math.max(1, size[i].w);
        canvas.height = Math.max(1, size[i].h);
    });
}

function copy(from, to, mode, alpha) {
    const [src] = sheets[from.sheet];
    const ctx = sheets[to.sheet][1];
    ctx.globalCompositeOperation = mode;
    ctx.globalAlpha = alpha;
    ctx.drawImage(src, from.x, 0, from.w, from.h, to.x, 0, to.w, to.h);
}

export const Glow = {
    /**
     * Cộng quầng sáng của `source` (lớp vệt sáng) lên `ctx` (lớp pháo, đã cắt theo mép nước), phủ khung (0, 0, width,
     * height) theo phép biến đổi đang có của ctx.
     * scale: điểm ảnh canvas trên mỗi đơn vị vẽ (mật độ điểm ảnh × thu phóng), để quầng rộng như nhau trên mọi màn hình.
     * spread: số bậc quầng (2: vừa, 3: rộng); strength: độ sáng của quầng.
     */
    render(ctx, source, width, height, { scale, spread, strength }) {
        if (!source.width || !source.height) return;
        // Bậc đầu của quầng ~ 1/4 điểm ảnh CSS: màn hình mật độ cao thu nhỏ thêm bậc
        const first = 2 + Math.max(0, Math.round(Math.log2(Math.max(1, scale))));
        const last = first + spread;
        layout(source.width, source.height, last);
        sheets.forEach(([canvas, sheetCtx]) => {
            sheetCtx.globalCompositeOperation = 'source-over';
            sheetCtx.globalAlpha = 1;
            sheetCtx.clearRect(0, 0, canvas.width, canvas.height);
        });

        const top = levels[1];
        sheets[top.sheet][1].drawImage(source, 0, 0, source.width, source.height, top.x, 0, top.w, top.h);
        for (let i = 2; i <= last; i++) copy(levels[i - 1], levels[i], 'source-over', 1);
        // Bậc nhỏ (quầng rộng) cộng vào bậc lớn hơn, nhạt dần theo độ rộng
        for (let i = last - 1; i >= first; i--) copy(levels[i + 1], levels[i], 'lighter', 0.85);

        const base = levels[first];
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = strength;
        ctx.drawImage(sheets[base.sheet][0], base.x, 0, base.w, base.h, 0, 0, width, height);
        ctx.restore();
    }
};
