/*!
 * Trình diễn Pháo hoa – trình phát: cảnh vật (đốm sáng trên trời)
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Đốm sáng mềm dùng chung cho vật bay trên trời (đèn máy bay, lửa đèn trời, lò đốt khinh khí cầu): lõi gần trắng, quầng
// theo màu, nhạt dần ra ngoài; vẽ cộng sáng (lighter) như ánh sáng thật chồng lên nhau.

import { makeCanvas } from '../../utils.js';
import { SPRITE_OPTS, sprites } from '../util.js';

export function glowSprite(rgb) {
    const key = 'glow:' + rgb;
    if (sprites[key]) return sprites[key];
    const size = 64;
    const [c, g] = makeCanvas(size, size, SPRITE_OPTS);
    const [r0, g0, b0] = rgb.split(',').map(Number);
    const core = `${Math.round(r0 + (255 - r0) * 0.75)}, ${Math.round(g0 + (255 - g0) * 0.75)}, ${Math.round(b0 + (255 - b0) * 0.75)}`;
    const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, `rgba(${core}, 1)`);
    grad.addColorStop(0.08, `rgba(${core}, 0.9)`);
    grad.addColorStop(0.18, `rgba(${rgb}, 0.4)`);
    grad.addColorStop(0.42, `rgba(${rgb}, 0.09)`);
    grad.addColorStop(1, `rgba(${rgb}, 0)`);
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    sprites[key] = c;
    return c;
}

// Vẽ một đốm sáng tâm (x, y), bán kính quầng radius (điểm ảnh CSS); ctx đang ở chế độ cộng sáng
export function drawGlow(ctx, rgb, x, y, radius, alpha) {
    if (alpha <= 0.005) return;
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.drawImage(glowSprite(rgb), x - radius, y - radius, radius * 2, radius * 2);
}
