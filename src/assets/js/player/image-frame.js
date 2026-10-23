/*!
 * Hanabi – trình phát: khung và vùng cắt của pháo ảnh
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Không phụ thuộc gì khác của trình phát, để builder dùng chung khi cho chọn phần ảnh hiển thị.

const PI_2 = Math.PI * 2;

// Khung ảnh: đa giác chuẩn hóa vừa khít hình vuông [-1, 1]. Dùng chung để cắt ảnh, vẽ viền sáng
// và bắn hạt theo viền, nên ảnh, viền và pháo luôn khớp nhau.
const framePolygonCache = new Map();

export function getFramePolygon(frame) {
    if (framePolygonCache.has(frame)) return framePolygonCache.get(frame);
    let points = [];
    if (frame === 'circle') {
        for (let i = 0; i < 120; i++) {
            const t = i / 120 * PI_2;
            points.push({ x: Math.cos(t), y: Math.sin(t) });
        }
    } else if (frame === 'square') {
        points = [{ x: -1, y: -1 }, { x: 1, y: -1 }, { x: 1, y: 1 }, { x: -1, y: 1 }];
    } else if (frame === 'rounded') {
        // Vuông bo góc: bốn cung tròn ở bốn góc, đi theo chiều kim đồng hồ
        const r = 0.3;
        [[1, 1, 0], [-1, 1, 0.5], [-1, -1, 1], [1, -1, 1.5]].forEach(([sx, sy, start]) => {
            for (let i = 0; i <= 10; i++) {
                const t = (start + i / 20) * Math.PI;
                points.push({ x: sx * (1 - r) + Math.cos(t) * r, y: sy * (1 - r) + Math.sin(t) * r });
            }
        });
    } else if (frame === 'triangle') {
        points = [{ x: 0, y: -1 }, { x: 1, y: 1 }, { x: -1, y: 1 }];
    } else if (frame === 'heart') {
        for (let i = 0; i < 160; i++) {
            const t = i / 160 * PI_2;
            points.push({
                x: 16 * Math.pow(Math.sin(t), 3),
                y: -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))
            });
        }
    } else if (frame === 'star') {
        // Ngôi sao 5 cánh, cánh trên cùng hướng lên
        for (let i = 0; i < 10; i++) {
            const t = -Math.PI / 2 + i * Math.PI / 5;
            const r = i % 2 === 0 ? 1 : 0.5;
            points.push({ x: Math.cos(t) * r, y: Math.sin(t) * r });
        }
    } else {
        return null;
    }
    // Căn giữa và phóng cho vừa khít hình vuông [-1, 1]
    const xs = points.map(p => p.x);
    const ys = points.map(p => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const scale = 2 / Math.max(maxX - minX, maxY - minY);
    points = points.map(p => ({ x: (p.x - (minX + maxX) / 2) * scale, y: (p.y - (minY + maxY) / 2) * scale }));
    framePolygonCache.set(frame, points);
    return points;
}

// Vẽ đường viền khung (không khung = hình chữ nhật của ảnh) quanh tâm (cx, cy)
export function traceFramePath(ctx, frame, cx, cy, halfW, halfH = halfW) {
    const points = getFramePolygon(frame || 'square');
    ctx.beginPath();
    points.forEach((p, i) => {
        if (i === 0) ctx.moveTo(cx + p.x * halfW, cy + p.y * halfH);
        else ctx.lineTo(cx + p.x * halfW, cy + p.y * halfH);
    });
    ctx.closePath();
}

// Phần ảnh được dùng (tọa độ pixel của ảnh gốc). crop = { x, y, zoom }: tâm vùng cắt theo tỉ lệ
// chiều rộng/cao của ảnh (0..1) và độ phóng (≥ 1). Có khung: vùng vuông; không khung: giữ tỉ lệ ảnh.
// Zoom 1 là vùng lớn nhất vừa trong ảnh; vùng luôn nằm trọn trong ảnh nên không bao giờ có chỗ trống.
export function cropRect(iw, ih, frame, crop) {
    const zoom = Math.max(1, Number(crop?.zoom) || 1);
    const baseW = frame ? Math.min(iw, ih) : iw;
    const baseH = frame ? Math.min(iw, ih) : ih;
    const w = baseW / zoom;
    const h = baseH / zoom;
    const cx = Number.isFinite(crop?.x) ? crop.x * iw : iw / 2;
    const cy = Number.isFinite(crop?.y) ? crop.y * ih : ih / 2;
    return {
        x: Math.min(Math.max(cx - w / 2, 0), iw - w),
        y: Math.min(Math.max(cy - h / 2, 0), ih - h),
        w,
        h
    };
}

// Khóa bộ nhớ đệm ảnh đã xử lý: cùng ảnh nhưng khác khung hoặc khác vùng cắt là ảnh khác
export function imageCacheKey(url, frame, crop) {
    const key = `${url}_${frame || ''}`;
    return crop ? `${key}_${crop.x}_${crop.y}_${crop.zoom}` : key;
}
