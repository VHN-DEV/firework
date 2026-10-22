/*!
 * Trình diễn Pháo hoa – trình phát: cảnh vật (khúc gỗ trôi)
 * Phần bổ sung và chỉnh sửa © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Khúc gỗ trôi trên sông: trôi vào từ thượng nguồn, nghiêng theo sóng, dạt qua đá; chỗ cò đậu.

import { LOG_KINDS, logSprite } from '../water-sprites.js';
import { drawFlowMarks, drawReflection, drawSubmerged, steerAround } from '../water-fx.js';
import { rand } from '../util.js';

export const LogLife = {
    // Hàm riêng của loại này, gộp vào WaterLife (dùng chung this: vòng sóng, tia nước, cỡ theo độ xa...)
    methods: {
        makeLog(x, d) {
            return { x, d, variant: (Math.random() * LOG_KINDS) | 0, len: rand(95, 135), phase: Math.random() * 6, seed: Math.random(), bird: null };
        },

        // Khúc gỗ nghiêng theo sóng, bị dòng nước đẩy dạt qua đá thì nghiêng thêm
        logTilt(log) {
            return Math.sin(log.phase * 0.7) * 0.015 + Math.max(-0.05, Math.min(0.05, (log.vd || 0) * 600));
        },

        // Mặt trên thân gỗ cao hơn mặt nước bao nhiêu (chỗ cò đậu)
        logPerch(log, s) {
            const sprite = logSprite(log.variant);
            return log.len * s * (sprite.wl - sprite.top) / sprite.width;
        },

        // Khúc gỗ nổi: phần nổi thẳng, phần chìm từng lát lệch theo sóng (nước khúc xạ); bóng phần nổi in xuống nước gợn theo
        // sóng; vệt ướt lấp lánh dọc mép nước; bị dòng nước đẩy dạt qua đá thì nghiêng mình theo
        drawLog(ctx, log, k, topCss, depthCss, time, river) {
            const s = this.scale(log.d);
            const sprite = logSprite(log.variant);
            const w = log.len * s;
            const h = w * sprite.height / sprite.width;
            const wlOff = h * sprite.wl / sprite.height;
            const y = this.surfaceY(log.d, topCss, depthCss) + Math.sin(log.phase) * 0.5 * s;
            const left = log.x - w;
            drawReflection(ctx, sprite, left, y, w, wlOff, 0.24, time, log.seed, s);
            drawFlowMarks(ctx, left + w / 2, y, w * 0.5, s, k, time, log.seed, river, 0.35);
            ctx.save();
            ctx.translate(left + w / 2, y);
            ctx.rotate(this.logTilt(log));
            ctx.globalAlpha = 0.97;
            ctx.drawImage(sprite, 0, 0, sprite.width, sprite.wl, -w / 2, -wlOff, w, wlOff);
            drawSubmerged(ctx, sprite, -w / 2, 0, w, h - wlOff, time, log.seed, s);
            ctx.restore();
            ctx.fillStyle = 'rgb(205, 222, 255)';
            for (let i = 0; i < 6; i++) {
                const fx = left + w * (0.1 + i * 0.15) + Math.sin(time * 0.0017 + i * 1.7 + log.phase) * 2 * s;
                ctx.globalAlpha = 0.18 + 0.2 * (0.5 + 0.5 * Math.sin(time * 0.003 + i * 2.1));
                ctx.fillRect(fx, y - 0.4 * s, (3 + (i % 3) * 2) * s, Math.max(1 / k, 0.7 * s));
            }
        }
    },

    update(dt, { river, cssW, depthCss, rocks, flags, slow }) {
        // Khúc gỗ: trôi vào từ thượng nguồn (bên trái), ra khỏi khung thì bỏ
        this.next.log -= dt;
        if (this.next.log <= 0 && flags.logs) {
            this.next.log = rand(10000, 20000) * slow;
            if (this.logs.length < 2) {
                const d = rand(0.3, 0.85);
                const log = this.makeLog(0, d);
                log.x = -log.len * this.scale(d);
                this.logs.push(log);
            }
        }
        this.logs.forEach(log => {
            log.x += this.flow(log.d, river) * 0.9 * dt;
            log.phase += dt * 0.0015;
            const half = log.len * this.scale(log.d) / 2;
            steerAround(log, log.x - half, half, rocks, dt, depthCss, 1);
        });
        this.logs = this.logs.filter(log => log.x - log.len * this.scale(log.d) < cssW + 30);
    },

    things(ctx, { k, topCss, depthCss, time, river }) {
        return this.logs.map(log => ({ d: log.d, draw: () => this.drawLog(ctx, log, k, topCss, depthCss, time, river) }));
    }
};
