/*!
 * Hanabi – trình phát: cảnh vật (bong bóng nước)
 * Phần bổ sung và chỉnh sửa © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Bong bóng nổi lên mặt nước, trôi theo dòng, rung rinh rồi vỡ.

import { drawBubble } from '../creatures.js';
import { rand } from '../util.js';

export const BubbleLife = {
    // Hàm riêng của loại này, gộp vào WaterLife (dùng chung this: vòng sóng, tia nước, cỡ theo độ xa...)
    methods: {
        // Vài bong bóng nổi lên quanh một chỗ (x: điểm ảnh CSS, d: độ xa), cái sau nổi muộn hơn cái trước một chút
        bubbleUp(x, d, n) {
            const s = this.scale(d);
            for (let i = 0; i < n; i++) {
                this.bubbles.push({ x: x + rand(-5, 5) * s, d: Math.max(0.02, Math.min(0.98, d + rand(-0.01, 0.01))), r: rand(0.8, 2.2), t: -i * rand(150, 550), life: rand(1200, 3400) });
            }
        }
    },

    update(dt, { river, cssW, topCss, depthCss, flags, slow }) {
        // Bong bóng: vài bong bóng nổi lên mặt nước, trôi theo dòng, rung rinh rồi vỡ (vòng sóng nhỏ, tia nước li ti)
        this.next.bubble -= dt;
        if (this.next.bubble <= 0 && flags.bubbles) {
            this.next.bubble = rand(1800, 5200) * slow;
            this.bubbleUp(rand(0.05, 0.95) * cssW, rand(0.08, 0.92), 1 + ((Math.random() * 3) | 0));
        }
        this.bubbles.forEach(b => {
            b.t += dt;
            b.x += this.flow(b.d, river) * dt;
            if (b.t >= b.life) {
                const s = this.scale(b.d);
                this.ring(b.x, b.d, 0.25 + b.r * 0.1, 700);
                this.sound('bubble', b.x, b.d);
                const y = this.surfaceY(b.d, topCss, depthCss);
                for (let i = 0; i < 2; i++) this.drops.push({ x: b.x, y, base: y, vx: rand(-0.03, 0.03) * s, vy: -rand(0.03, 0.06) * s, size: rand(0.6, 1) * s });
            }
        });
        this.bubbles = this.bubbles.filter(b => b.t < b.life);
    },

    under(ctx, { k, topCss, depthCss }) {
        this.bubbles.forEach(b => {
            if (b.t < 0) return;
            const s = this.scale(b.d);
            const grow = Math.min(1, b.t / 260);
            const wobble = b.life - b.t < 220 ? Math.sin(b.t * 0.08) : 0;
            ctx.globalAlpha = 1;
            drawBubble(ctx, b.x, this.surfaceY(b.d, topCss, depthCss), b.r * s * grow, k, wobble);
        });
    }
};
