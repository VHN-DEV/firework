/*!
 * Hanabi – trình phát: cảnh vật (thuyền)
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Thuyền neo sát bờ bên kia sông thành phố giăng đèn (flags.boats; biển khơi không có thuyền). Thuyền dập dềnh, nghiêng
// nhẹ theo sóng; dưới mỗi ngọn đèn là vệt sáng lấp lánh in dài xuống nước. Thuyền nằm trên mặt nước nên vẽ chung với bèo,
// đá theo tầm xa (things); vệt sáng vẽ dưới mọi vật (under).

import { rand } from '../util.js';
import { drawGlow } from '../sky-life/light.js';
import { drawLightStreak } from '../water-fx.js';

const WARM = '255, 206, 130';

// Đèn của thuyền (tọa độ theo chiều dài L, gốc ở giữa mép nước, lên trên âm; x theo hướng mũi thuyền):
// [x, y, màu, cỡ quầng (phần L), độ sáng, độ dài vệt sáng dưới nước (điểm ảnh CSS khi ở gần)]
function lightsOf(rgb) {
    const list = [];
    for (let i = 0; i < 7; i++) list.push([-0.42 + 0.84 * i / 6, -0.26 - 0.08 * Math.sin(Math.PI * i / 6), rgb, 0.04, 0.8, 30]);
    list.push([0, -0.12, WARM, 0.05, 0.7, 30]);
    return list;
}

export const BoatLife = {
    methods: {
        // Thuyền mới đặt sẵn trong khung: độ xa (d), chiều dài (điểm ảnh CSS khi ở gần)
        makeBoat(cssW) {
            const rgb = ['255, 214, 150', '255, 120, 180', '120, 200, 255'][(Math.random() * 3) | 0];
            return {
                d: rand(0.01, 0.06), len: rand(34, 46), dir: Math.random() < 0.5 ? -1 : 1, seed: Math.random(), bob: rand(0, 7),
                x: rand(0.08, 0.92) * cssW, lights: lightsOf(rgb)
            };
        },

        drawBoat(ctx, boat, view) {
            const s = this.scale(boat.d);
            const L = boat.len * s;
            const wl = this.surfaceY(boat.d, view.topCss, view.depthCss) + Math.sin(boat.bob) * 0.6 * s;
            const roll = Math.sin(boat.bob * 0.8 + 1) * 0.015;
            // Thân thuyền trong hệ tọa độ thuyền (gốc giữa mép nước, x theo hướng mũi, đơn vị L)
            ctx.save();
            ctx.translate(boat.x, wl);
            ctx.rotate(roll);
            ctx.scale(boat.dir, 1);
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = 1;
            ctx.fillStyle = '#11151d';
            ctx.beginPath();
            [[-0.48, -0.12], [0.5, -0.13], [0.42, 0], [-0.45, 0]].forEach(([px, py], i) => (i ? ctx.lineTo(px * L, py * L) : ctx.moveTo(px * L, py * L)));
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#161c27';
            ctx.fillRect(-0.25 * L, -0.24 * L, 0.42 * L, 0.12 * L);
            ctx.restore();
            // Đèn (vẽ không lật theo hướng để quầng tròn)
            ctx.globalCompositeOperation = 'lighter';
            const cos = Math.cos(roll);
            const sin = Math.sin(roll);
            boat.lights.forEach(([lx, ly, rgb, size, a]) => {
                const px = lx * boat.dir * L;
                const py = ly * L;
                drawGlow(ctx, rgb, boat.x + px * cos - py * sin, wl + px * sin + py * cos, Math.max(1.4, size * L * 3), a);
            });
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = 1;
        }
    },

    update(dt, { cssW, flags }) {
        if (!flags.boats) {
            this.boats = [];
            this.boatW = 0;
            return;
        }
        if (this.boatW !== Math.round(cssW)) {
            this.boatW = Math.round(cssW);
            this.boats = [0, 1, 2].map(() => this.makeBoat(cssW));
        }
        this.boats.forEach(boat => (boat.bob += dt * 0.0012));
    },

    // Dưới mọi vật: vệt sáng của đèn in dài xuống nước
    under(ctx, { topCss, depthCss, time }) {
        ctx.globalCompositeOperation = 'lighter';
        this.boats.forEach(boat => {
            const s = this.scale(boat.d);
            const L = boat.len * s;
            const wl = this.surfaceY(boat.d, topCss, depthCss);
            boat.lights.forEach(([lx, , rgb, size, a, refl], j) => {
                drawLightStreak(ctx, boat.x + lx * boat.dir * L, wl + 1, refl * s, 1.2 + size * L * 0.9, rgb, a * 0.5, time, boat.seed + j * 0.37, s);
            });
        });
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
    },

    things(ctx, view) {
        return this.boats.map(boat => ({ d: boat.d, draw: () => this.drawBoat(ctx, boat, view) }));
    }
};
