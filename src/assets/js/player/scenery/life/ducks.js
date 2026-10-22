/*!
 * Trình diễn Pháo hoa – trình phát: cảnh vật (vịt trời)
 * Phần bổ sung và chỉnh sửa © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Vịt trời: cả đàn bay tới, đáp xuống bơi, chổng đuôi kiếm ăn, rồi cất cánh bay đi; bóng in xuống nước.

import { drawMirrorSlices, drawWakeTrail, steerAround } from '../water-fx.js';
import { duckSprite } from '../creatures.js';
import { rand } from '../util.js';

export const DuckLife = {
    // Hàm riêng của loại này, gộp vào WaterLife (dùng chung this: vòng sóng, tia nước, cỡ theo độ xa...)
    methods: {
        // Vịt: đang bơi thì vệt sóng tách ra phía sau, bóng in xuống nước gợn theo sóng
        drawDuck(ctx, duck, pose, s, k, time = 0) {
            if (pose === 'swim' || pose === 'dabble') {
                if (pose === 'swim' && Math.abs(duck.vx) > 0.004) {
                    drawWakeTrail(ctx, duck.x - Math.sign(duck.vx) * 4 * s, duck.y, 5 * s, s, k, time, duck.seed, -Math.sign(duck.vx), 0.45);
                }
                drawMirrorSlices(ctx, duck.y, 24 * s * 20 / 40, duck.x, 13 * s, 0.46, time, duck.seed, s, 0.8)(
                    alpha => this.paintDuck(ctx, duck, pose, s, alpha));
            }
            this.paintDuck(ctx, duck, pose, s, 0.95);
        },

        paintDuck(ctx, duck, pose, s, alpha) {
            const sprite = duckSprite(duck.kind, pose);
            const w = 24 * s;
            const h = w * 28 / 40;
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.translate(duck.x, duck.y);
            if (duck.dir < 0) ctx.scale(-1, 1);
            ctx.drawImage(sprite, -w / 2, -h * (pose === 'swim' || pose === 'dabble' ? 20 / 28 : 0.5), w, h);
            ctx.restore();
        }
    },

    update(dt, { river, cssW, topCss, depthCss, rocks, flags, slow }) {
        // Vịt trời: cả đàn bay tới, đáp xuống trượt trên nước, bơi quạt chân để lại vệt sóng, thỉnh thoảng chổng đuôi
        // kiếm ăn, rồi chạy trên mặt nước cất cánh bay đi
        this.next.duck -= dt;
        if (this.next.duck <= 0 && flags.ducks) {
            this.next.duck = (river ? rand(16000, 26000) : rand(12000, 20000)) * slow;
            if (!this.ducks.length) {
                const dir = Math.random() < 0.5 ? 1 : -1;
                const n = 2 + ((Math.random() * 3) | 0);
                const d = rand(0.3, 0.8);
                const tx = rand(0.25, 0.75) * cssW;
                const y0 = topCss * rand(0.2, 0.5);
                for (let i = 0; i < n; i++) {
                    this.ducks.push({
                        kind: i === 0 || Math.random() < 0.5 ? 'male' : 'female',
                        state: 'fly', dir, x: (dir > 0 ? -30 : cssW + 30) - dir * i * rand(14, 22), y: y0 + rand(-8, 8),
                        d: Math.min(0.95, d + rand(-0.06, 0.06)), tx: tx + (i - n / 2) * rand(14, 24), vx: 0, vy: 0,
                        flap: rand(0, 200), seed: Math.random(), stay: rand(14000, 26000), feed: rand(2000, 6000), dive: 0, paddle: rand(0, 900),
                        turn: rand(4000, 9000)
                    });
                }
            }
        }
        this.ducks.forEach(duck => {
            duck.flap += dt;
            const s = this.scale(duck.d);
            const sy = this.surfaceY(duck.d, topCss, depthCss);
            if (duck.state === 'fly') {
                duck.tx += this.flow(duck.d, river) * 0.5 * dt;
                const dx = duck.tx - duck.x;
                const dy = sy - duck.y;
                const dist = Math.hypot(dx, dy);
                duck.dir = dx >= 0 ? 1 : -1;
                const step = Math.min(dist, 0.14 * dt);
                if (dist <= step + 0.5) {
                    duck.state = 'swim';
                    duck.y = sy;
                    duck.vx = duck.dir * 0.05;
                    this.splash(duck.x, duck.d, topCss, depthCss, 0.6);
                } else {
                    duck.x += dx / dist * step;
                    duck.y += dy / dist * step;
                }
            } else if (duck.state === 'swim' || duck.state === 'dabble') {
                duck.stay -= dt;
                duck.turn -= dt;
                if (duck.turn <= 0 || (duck.x < 30 && duck.dir < 0) || (duck.x > cssW - 30 && duck.dir > 0)) {
                    duck.dir = duck.x < 30 ? 1 : duck.x > cssW - 30 ? -1 : -duck.dir;
                    duck.turn = rand(4000, 9000);
                }
                // Lúc đáp trượt nhanh rồi chậm dần về tốc độ bơi; đang chúc đầu kiếm ăn thì đứng yên
                const target = duck.state === 'dabble' ? 0 : duck.dir * 0.011;
                duck.vx += (target - duck.vx) * Math.min(1, dt * 0.0015);
                duck.x += (duck.vx + this.flow(duck.d, river) * 0.5) * dt;
                steerAround(duck, duck.x, 12 * s, rocks, dt, depthCss, Math.sign(duck.vx + this.flow(duck.d, river) * 0.5));
                duck.y = this.surfaceY(duck.d, topCss, depthCss) + Math.sin(duck.flap * 0.004) * 0.3 * s;
                if (duck.state === 'swim') {
                    duck.paddle -= dt;
                    if (duck.paddle <= 0) {
                        duck.paddle = rand(700, 1200);
                        this.ring(duck.x - duck.dir * 5 * s, duck.d, 0.5, 1200);
                    }
                    duck.feed -= dt;
                    if (duck.feed <= 0) {
                        duck.state = 'dabble';
                        duck.dive = rand(900, 1700);
                        this.ring(duck.x, duck.d, 0.7, 1300);
                    }
                } else {
                    duck.dive -= dt;
                    if (duck.dive <= 0) {
                        duck.state = 'swim';
                        duck.feed = rand(3000, 7000);
                        this.ring(duck.x, duck.d, 0.6, 1300);
                    }
                }
                if (duck.stay <= 0 && duck.state === 'swim') {
                    duck.state = 'leave';
                    duck.vx = duck.dir * 0.11;
                    duck.vy = -0.04;
                    this.splash(duck.x, duck.d, topCss, depthCss, 0.6);
                }
            } else {
                duck.x += duck.vx * dt;
                duck.y += duck.vy * dt;
                duck.vy = Math.max(-0.1, duck.vy - 0.00005 * dt);
            }
        });
        this.ducks = this.ducks.filter(duck => !(duck.state === 'leave' && (duck.y < -40 || duck.x < -40 || duck.x > cssW + 40)));
    },

    under(ctx, { topCss, depthCss, time, reach }) {
        this.ducks.forEach(duck => {
            if (duck.state !== 'fly' && duck.state !== 'leave') return;
            const s = this.scale(duck.d);
            const surf = this.surfaceY(duck.d, topCss, depthCss);
            if (surf - duck.y < 0 || surf - duck.y > reach) return;
            const pose = Math.floor(duck.flap / 85) % 2 ? 'up' : 'down';
            drawMirrorSlices(ctx, surf, surf - duck.y + 12 * s, duck.x, 14 * s, 0.26 * (1 - (surf - duck.y) / reach), time, duck.seed, s, 1)(
                alpha => this.paintDuck(ctx, duck, pose, s, alpha));
        });
    },

    things(ctx, { k, time }) {
        return this.ducks.filter(duck => duck.state === 'swim' || duck.state === 'dabble').map(duck => ({
            d: duck.d, draw: () => this.drawDuck(ctx, duck, duck.state, this.scale(duck.d), k, time)
        }));
    },

    over(ctx, { k }) {
        this.ducks.forEach(duck => {
            if (duck.state !== 'fly' && duck.state !== 'leave') return;
            this.drawDuck(ctx, duck, Math.floor(duck.flap / 85) % 2 ? 'up' : 'down', this.scale(duck.d), k);
        });
    }
};
