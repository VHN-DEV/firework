/*!
 * Trình diễn Pháo hoa – trình phát: cảnh vật (cá)
 * Phần bổ sung và chỉnh sửa © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Cá nhảy khỏi mặt nước (cá mè, chép, trắm, đàn cá con) và cá đớp mồi làm sóng lăn tăn.

import { FISH_LOOKS, FISH_TYPES, drawFishBody } from '../creatures.js';
import { rand } from '../util.js';

export const FishLife = {
    // Hàm riêng của loại này, gộp vào WaterLife (dùng chung this: vòng sóng, tia nước, cỡ theo độ xa...)
    methods: {
        // Cá đang nhảy: tâm thân đi theo đường cong từ dưới mặt nước lên rồi xuống lại dưới mặt nước
        fishState(fish, topCss, depthCss) {
            const p = Math.min(1, Math.max(0, fish.t / fish.life));
            const L = FISH_TYPES[fish.type].size * this.scale(fish.d);
            const H = fish.h + L * 0.45;
            const surf = this.surfaceY(fish.d, topCss, depthCss);
            return { p, L, surf, x: fish.x + fish.dx * p, y: surf - 4 * H * p * (1 - p) + L * 0.45, vx: fish.dx, vy: -4 * H * (1 - 2 * p) };
        }
    },

    update(dt, { river, cssW, topCss, depthCss, rocks, flags, slow }) {
        // Cá nhảy: vọt lên khỏi mặt nước theo đường cong rồi lao xuống; cá con nhảy cả đàn, con này nối con kia
        this.next.fish -= dt;
        if (this.next.fish <= 0 && flags.fish) {
            this.next.fish = (river ? rand(3000, 7000) : rand(5000, 10000)) * slow;
            const r = Math.random();
            const type = r < 0.35 ? 'silver' : r < 0.6 ? 'carp' : r < 0.75 ? 'grass' : 'minnow';
            const kind = FISH_TYPES[type];
            const d = rand(0.25, 0.9);
            const s = this.scale(d);
            const dir = Math.random() < 0.5 ? -1 : 1;
            let x = rand(0.1, 0.9) * cssW;
            // Không nhảy ngay chỗ có đá, gò đất
            for (let i = 0; i < 5 && rocks.some(r => Math.abs(r.x - x) < r.size * this.scale(r.d) * 0.7 && Math.abs(r.d - d) < 0.15); i++) {
                x = rand(0.1, 0.9) * cssW;
            }
            const count = type === 'minnow' ? 3 + ((Math.random() * 3) | 0) : 1;
            for (let i = 0; i < count; i++) {
                this.fish.push({
                    type, d, x: x + dir * i * rand(5, 9) * s, t: -i * rand(90, 160), started: false, seed: Math.random(),
                    life: rand(...kind.life), h: rand(...kind.lift) * s, dx: dir * rand(...kind.reach) * s
                });
            }
        }
        this.fish.forEach(fish => {
            fish.t += dt;
            fish.x += this.flow(fish.d, river) * dt;
            const size = fish.type === 'minnow' ? 0.4 : fish.type === 'silver' ? 0.8 : 1.1;
            if (fish.t >= 0 && !fish.started) {
                fish.started = true;
                this.splash(fish.x, fish.d, topCss, depthCss, size * 0.9, 'fish');
            }
            // Nước rỏ xuống từ mình cá lúc đang bay
            if (fish.started && fish.t < fish.life * 0.7) {
                const f = this.fishState(fish, topCss, depthCss);
                fish.shed = (fish.shed ?? 0) - dt;
                if (f.p > 0.05 && f.y < f.surf && fish.shed <= 0) {
                    fish.shed = 45;
                    const s = this.scale(fish.d);
                    this.drops.push({ x: f.x - Math.sign(f.vx) * f.L * 0.3, y: f.y, base: f.surf, vx: rand(-0.015, 0.015), vy: rand(-0.02, 0.01), size: rand(0.8, 1.4) * s });
                }
            }
            if (fish.t >= fish.life && !fish.done) {
                fish.done = true;
                this.splash(fish.x + fish.dx, fish.d, topCss, depthCss, size, 'fish');
            }
        });
        this.fish = this.fish.filter(fish => !fish.done);


        // Cá đớp mồi: vòng sóng nhỏ lan ra đây đó trên mặt nước
        this.next.rise -= dt;
        if (this.next.rise <= 0 && flags.fish) {
            this.next.rise = rand(1200, 3200) * slow;
            const d = rand(0.15, 0.95);
            const x = rand(0.05, 0.95) * cssW;
            this.ring(x, d, 0.6, 1800);
            this.ring(x, d, 0.4, 1800, 260);
            this.sound('plip', x, d);
        }
    },

    over(ctx, { k, topCss, depthCss, time }) {
        // Cá nhảy: đầu theo hướng bay, thân uốn cong (nhiều nhất ở đỉnh), đuôi quẫy nhanh lúc vừa rời nước; phần còn dưới
        // mặt nước bị nước che nên như trồi lên, lặn xuống thật
        this.fish.forEach(fish => {
            if (fish.t < 0) return;
            const f = this.fishState(fish, topCss, depthCss);
            const early = f.p < 0.3;
            const wag = Math.sin(time * (early ? 0.05 : 0.022) + fish.seed * 9) * (early ? 1 : 0.45);
            ctx.save();
            ctx.beginPath();
            ctx.rect(f.x - f.L * 1.5, f.y - f.L * 1.5, f.L * 3, Math.max(0, f.surf - (f.y - f.L * 1.5)));
            ctx.clip();
            ctx.translate(f.x, f.y);
            if (f.vx < 0) ctx.scale(-1, 1);
            ctx.rotate(Math.atan2(f.vy, Math.abs(f.vx)));
            ctx.globalAlpha = 0.97;
            drawFishBody(ctx, FISH_LOOKS[fish.type], f.L, 0.25 + 0.55 * Math.sin(Math.PI * f.p), wag,
                0.7 + 0.3 * Math.cos(f.p * Math.PI * 2 + fish.seed * 6), k);
            ctx.restore();
        });
    }
};
