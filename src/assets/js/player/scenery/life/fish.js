/*!
 * Hanabi – trình phát: cảnh vật (cá)
 * Phần bổ sung và chỉnh sửa © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Cá nhảy khỏi mặt nước (cá mè, chép, trắm, đàn cá con), con to con nhỏ; bóng in xuống nước; cá đớp mồi làm sóng lăn tăn.

import { drawMirrorSlices } from '../water-fx.js';
import { FISH_LOOKS, FISH_TYPES, drawFishBody } from '../creatures.js';
import { rand } from '../util.js';

// Tia nước lúc cá lao lên, lao xuống (cỡ vừa; con to thì to theo)
const SPLASH = { minnow: 0.4, silver: 0.8, carp: 1.1, grass: 1.1 };

export const FishLife = {
    // Hàm riêng của loại này, gộp vào WaterLife (dùng chung this: vòng sóng, tia nước, cỡ theo độ xa...)
    methods: {
        // Cá đang nhảy: tâm thân đi theo đường cong từ dưới mặt nước lên rồi xuống lại dưới mặt nước
        fishState(fish, topCss, depthCss) {
            const p = Math.min(1, Math.max(0, fish.t / fish.life));
            const L = FISH_TYPES[fish.type].size * fish.grow * this.scale(fish.d);
            const H = fish.h + L * 0.45;
            const surf = this.surfaceY(fish.d, topCss, depthCss);
            return { p, L, surf, x: fish.x + fish.dx * p, y: surf - 4 * H * p * (1 - p) + L * 0.45, vx: fish.dx, vy: -4 * H * (1 - 2 * p) };
        },

        // Cá đang nhảy: đầu theo hướng bay, thân uốn cong (nhiều nhất ở đỉnh), quẫy mạnh lúc vừa rời nước và lúc sắp chạm
        // nước, vây xòe, có con há miệng; mình xoay nên hông lóe sáng. Phần còn dưới mặt nước bị nước che nên như trồi lên,
        // lặn xuống thật. simple: bóng in nước (bỏ chi tiết)
        paintFish(ctx, fish, f, k, simple = false) {
            const amp = 0.35 + 0.65 * Math.pow(Math.max(0, 1 - f.p / 0.35), 1.5) + 0.3 * Math.max(0, (f.p - 0.75) / 0.25);
            ctx.save();
            ctx.beginPath();
            ctx.rect(f.x - f.L * 1.5, f.y - f.L * 1.5, f.L * 3, Math.max(0, f.surf - (f.y - f.L * 1.5)));
            ctx.clip();
            ctx.translate(f.x, f.y);
            if (f.vx < 0) ctx.scale(-1, 1);
            ctx.rotate(Math.atan2(f.vy, Math.abs(f.vx)));
            drawFishBody(ctx, FISH_LOOKS[fish.type], f.L, {
                bend: 0.25 + 0.55 * Math.sin(Math.PI * f.p), phase: fish.beat, amp,
                roll: 1 - fish.twist * (0.5 - 0.5 * Math.cos(f.p * Math.PI * 2 + fish.seed * 6)),
                flare: Math.sin(Math.PI * f.p), gape: fish.gape * Math.sin(Math.PI * f.p), seed: fish.seed
            }, k, simple);
            ctx.restore();
        }
    },

    update(dt, { river, cssW, topCss, depthCss, rocks, flags, slow }) {
        // Cá nhảy: vọt lên khỏi mặt nước theo đường cong rồi lao xuống; cá con nhảy cả đàn, con này nối con kia
        this.next.fish -= dt;
        if (this.next.fish <= 0 && flags.fish) {
            this.next.fish = (river ? rand(3000, 7000) : rand(5000, 10000)) * slow;
            const r = Math.random();
            // Biển: cá thân bạc, đàn cá con (không có cá chép, cá trắm nước ngọt)
            const type = flags.sea ? (r < 0.5 ? 'silver' : 'minnow') : r < 0.35 ? 'silver' : r < 0.6 ? 'carp' : r < 0.75 ? 'grass' : 'minnow';
            const kind = FISH_TYPES[type];
            // Cỡ con này (đàn cá con thì cùng lứa, xêm xêm nhau): nhiều con vừa, ít con nhỏ, hiếm con to
            const grow = kind.grow[0] + (kind.grow[1] - kind.grow[0]) * Math.pow(Math.random(), 1.4);
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
                // Con to nhảy cao, xa, bay lâu hơn (nặng hơn nên không cao, xa gấp bội); twist: mình xoay nhiều ít; gape: há miệng
                const g = type === 'minnow' ? grow * rand(0.88, 1.12) : grow;
                this.fish.push({
                    type, d, grow: g, x: x + dir * i * rand(5, 9) * s * g, t: -i * rand(90, 160), started: false, seed: Math.random(),
                    beat: rand(0, 6), twist: rand(0.15, 0.6), gape: Math.random() < 0.5 ? rand(0.3, 1) : 0,
                    life: rand(...kind.life) * Math.pow(g, 0.35), h: rand(...kind.lift) * s * Math.pow(g, 0.75), dx: dir * rand(...kind.reach) * s * Math.pow(g, 0.75)
                });
            }
        }
        this.fish.forEach(fish => {
            fish.t += dt;
            fish.x += this.flow(fish.d, river) * dt;
            // Nhịp quẫy: vừa rời nước quẫy nhanh, bay giữa trời chậm lại, sắp chạm nước quẫy nhanh lên
            const p = Math.max(0, fish.t / fish.life);
            fish.beat += dt * (0.012 + 0.032 * Math.max(0, 1 - p / 0.35) + 0.012 * Math.max(0, (p - 0.75) / 0.25));
            const size = SPLASH[fish.type] * fish.grow;
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
                    this.drops.push({ x: f.x - Math.sign(f.vx) * f.L * 0.3, y: f.y, base: f.surf, vx: rand(-0.015, 0.015), vy: rand(-0.02, 0.01), size: rand(0.8, 1.4) * s * Math.sqrt(fish.grow) });
                }
            }
            if (fish.t >= fish.life && !fish.done) {
                fish.done = true;
                this.splash(fish.x + fish.dx, fish.d, topCss, depthCss, size, 'fish');
            }
        });
        this.fish = this.fish.filter(fish => !fish.done);


        // Cá đớp mồi: vòng sóng nhỏ lan ra đây đó trên mặt nước (cá to đớp thì vòng sóng to)
        this.next.rise -= dt;
        if (this.next.rise <= 0 && flags.fish) {
            this.next.rise = rand(1200, 3200) * slow;
            const d = rand(0.15, 0.95);
            const x = rand(0.05, 0.95) * cssW;
            const big = 0.6 + 1.2 * Math.pow(Math.random(), 2);
            this.ring(x, d, 0.6 * big, 1800);
            this.ring(x, d, 0.4 * big, 1800, 260);
            this.sound('plip', x, d);
        }
    },

    under(ctx, { k, topCss, depthCss, time, reach }) {
        // Bóng cá đang nhảy in xuống nước, gợn theo sóng; cá càng lên cao bóng càng nhạt (cá con ở xa bóng quá nhỏ: bỏ)
        this.fish.forEach(fish => {
            if (fish.t < 0) return;
            const f = this.fishState(fish, topCss, depthCss);
            const lift = f.surf - f.y + f.L * 0.6;
            if (lift <= 0 || f.surf - f.y > reach || f.L * k < 30) return;
            drawMirrorSlices(ctx, f.surf, lift, f.x, f.L * 0.9, 0.24 * (1 - Math.max(0, f.surf - f.y) / reach), time, fish.seed, this.scale(fish.d), 1)(alpha => {
                ctx.globalAlpha = alpha;
                this.paintFish(ctx, fish, f, k, true);
            });
        });
    },

    over(ctx, { k, topCss, depthCss }) {
        this.fish.forEach(fish => {
            if (fish.t < 0) return;
            ctx.globalAlpha = 0.97;
            this.paintFish(ctx, fish, this.fishState(fish, topCss, depthCss), k);
        });
    }
};
