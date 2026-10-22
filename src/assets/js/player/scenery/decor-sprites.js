/*!
 * Trình diễn Pháo hoa – trình phát: cảnh vật (ảnh trang trí bầu trời)
 * Phần bổ sung và chỉnh sửa © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Ảnh trang trí bầu trời: đèn trời, khinh khí cầu, máy bay.

import { hdSprite, sprites } from './util.js';

export function lanternSprite() {
    if (sprites.lantern) return sprites.lantern;
    const [c, g] = hdSprite(48, 64);
    // Quầng sáng
    const halo = g.createRadialGradient(24, 34, 2, 24, 34, 26);
    halo.addColorStop(0, 'rgba(255, 170, 70, 0.55)');
    halo.addColorStop(1, 'rgba(255, 120, 30, 0)');
    g.fillStyle = halo;
    g.fillRect(0, 0, 48, 64);
    // Thân đèn: hình thang bo tròn, sáng ở đáy (ngọn lửa)
    const body = g.createLinearGradient(0, 22, 0, 46);
    body.addColorStop(0, '#ff8a2a');
    body.addColorStop(0.7, '#ffc46b');
    body.addColorStop(1, '#fff1c9');
    g.fillStyle = body;
    g.beginPath();
    g.moveTo(17, 22);
    g.quadraticCurveTo(24, 19, 31, 22);
    g.lineTo(33, 44);
    g.quadraticCurveTo(24, 47, 15, 44);
    g.closePath();
    g.fill();
    sprites.lantern = c;
    return c;
}

export const BALLOON_SCHEMES = [
    ['#ff5a5a', '#ffd166'],
    ['#4cc9f0', '#f8f9fa'],
    ['#9d4edd', '#ffb703'],
    ['#06d6a0', '#ef476f']
];

export function balloonSprite(scheme) {
    const key = 'balloon' + scheme;
    if (sprites[key]) return sprites[key];
    const [a, b] = BALLOON_SCHEMES[scheme % BALLOON_SCHEMES.length];
    const [c, g] = hdSprite(120, 160);
    const envelope = () => {
        g.beginPath();
        g.moveTo(60, 8);
        g.bezierCurveTo(110, 8, 116, 62, 92, 92);
        g.lineTo(70, 114);
        g.lineTo(50, 114);
        g.lineTo(28, 92);
        g.bezierCurveTo(4, 62, 10, 8, 60, 8);
        g.closePath();
    };
    // Múi vải hai màu
    g.save();
    envelope();
    g.clip();
    for (let i = 0; i < 8; i++) {
        g.fillStyle = i % 2 ? a : b;
        g.beginPath();
        g.ellipse(60, 60, Math.abs(56 - i * 14) + 2, 60, 0, 0, Math.PI * 2);
        g.fill();
    }
    // Ánh lửa từ dưới rọi lên, phía trên tối dần
    const light = g.createLinearGradient(0, 8, 0, 114);
    light.addColorStop(0, 'rgba(0, 0, 0, 0.62)');
    light.addColorStop(0.6, 'rgba(0, 0, 0, 0.25)');
    light.addColorStop(1, 'rgba(255, 200, 120, 0.25)');
    g.fillStyle = light;
    g.fillRect(0, 0, 120, 120);
    g.restore();
    // Dây và giỏ
    g.strokeStyle = 'rgba(255, 210, 160, 0.55)';
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(52, 114);
    g.lineTo(54, 132);
    g.moveTo(68, 114);
    g.lineTo(66, 132);
    g.stroke();
    g.fillStyle = '#c98a4b';
    g.fillRect(52, 132, 16, 11);
    sprites[key] = c;
    return c;
}

export function burnerGlow() {
    if (sprites.burner) return sprites.burner;
    const c = document.createElement('canvas');
    c.width = c.height = 120;
    const g = c.getContext('2d');
    const glow = g.createRadialGradient(60, 70, 4, 60, 70, 60);
    glow.addColorStop(0, 'rgba(255, 220, 140, 0.9)');
    glow.addColorStop(0.35, 'rgba(255, 150, 60, 0.35)');
    glow.addColorStop(1, 'rgba(255, 120, 40, 0)');
    g.fillStyle = glow;
    g.fillRect(0, 0, 120, 120);
    sprites.burner = c;
    return c;
}

// Máy bay đêm: chỉ thấy đèn. Đèn đỏ, xanh ở hai đầu cánh, đèn đỏ chớp trên thân, đèn trắng chớp đôi ở đầu cánh
export function drawPlane(ctx, item, calm) {
    const s = item.scale;
    const dir = item.vx > 0 ? 1 : -1;
    const light = (dx, color, alpha, size) => {
        const x = item.x + dx * s, y = item.y;
        ctx.globalAlpha = alpha * 0.35;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, size * 3 * s, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(x, y, size * s, 0, Math.PI * 2);
        ctx.fill();
    };
    const t = item.t;
    // Đầu cánh trái màu đỏ, phải màu xanh; bay sang trái thì đổi bên
    light(-7 * dir, '#ff4d4d', 0.85, 0.9);
    light(7 * dir, '#4dff88', 0.85, 0.9);
    light(-1.5 * dir, '#ffffff', 0.35, 0.6);
    if (calm) return;
    const beacon = t % 1100 < 120;
    if (beacon) light(0, '#ff3030', 1, 1.2);
    const strobe = t % 1500;
    if (strobe < 60 || (strobe > 160 && strobe < 220)) {
        light(-7 * dir, '#ffffff', 1, 1.3);
        light(7 * dir, '#ffffff', 1, 1.3);
    }
}
