/*!
 * Trình diễn Pháo hoa – trình phát: cảnh vật (sinh vật trên mặt nước)
 * Phần bổ sung và chỉnh sửa © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Sinh vật, vật trôi trên mặt nước: khúc gỗ, cò, vịt trời, cá, ếch, bong bóng; vòng sóng, tia nước.

import { IS_MOBILE } from '../env.js';
import { fireflyGlow, rand } from './util.js';
import { EGRET_POSE, FISH_LOOKS, FISH_TYPES, drawBubble, drawEgret, drawFishBody, drawFrog, duckSprite } from './creatures.js';
import { LOG_KINDS, logSprite, moundSprite, rockSprite } from './water-sprites.js';
import { depthScale, drawFlowMarks, drawMirrorSlices, drawReflection, drawSubmerged, drawWakeTrail, flowSpeed, steerAround } from './water-fx.js';

// Sinh vật trên mặt nước bật/tắt riêng từng loại (builder, mục "Trên mặt nước"); bong bóng nước luôn có
const WATER_ALL = { birds: true, ducks: true, fish: true, logs: true, frogs: true, bubbles: true };

export const WaterLife = {
    key: '',
    logs: [],
    birds: [],
    ducks: [],
    fish: [],
    frogs: [],
    bubbles: [],
    ripples: [],
    drops: [],
    next: { log: 0, bird: 0, duck: 0, fish: 0, rise: 0, frog: 0, bubble: 0 },

    flow(d, river) {
        return flowSpeed(d, river);
    },

    scale(d) {
        return depthScale(d);
    },

    reset(river, cssW, flags = WATER_ALL) {
        this.logs = [];
        this.birds = [];
        this.ducks = [];
        this.fish = [];
        this.frogs = [];
        this.bubbles = [];
        this.ripples = [];
        this.drops = [];
        const slow = IS_MOBILE ? 1.3 : 1;
        // Mở màn đã có sẵn một khúc gỗ đang trôi, một con cò và một đàn vịt sắp bay tới, ếch sắp ló đầu
        if (river && flags.logs) this.logs.push(this.makeLog(rand(0.18, 0.42) * cssW, rand(0.45, 0.8)));
        this.next = river
            ? { log: rand(9000, 16000) * slow, bird: rand(1500, 3000), duck: rand(5000, 9000), fish: rand(2500, 4500), rise: rand(800, 2000), frog: rand(1500, 3500), bubble: rand(800, 2500) }
            : { log: Infinity, bird: rand(3000, 6000), duck: rand(2500, 5000), fish: rand(3500, 6000), rise: rand(800, 2000), frog: rand(1200, 3000), bubble: rand(800, 2500) };
    },

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

    surfaceY(d, topCss, depthCss) {
        return topCss + d * depthCss;
    },

    // Vòng sóng lan và tia nước bắn lên tại một điểm trên mặt nước
    splash(x, d, topCss, depthCss, size) {
        const s = this.scale(d);
        const y = this.surfaceY(d, topCss, depthCss);
        this.ripples.push({ x, d, age: 0, life: 1500, r0: 3 * s * size }, { x, d, age: -180, life: 1500, r0: 2 * s * size });
        const count = Math.round(4 + size * 3);
        for (let i = 0; i < count; i++) {
            this.drops.push({ x, y, base: y, vx: rand(-0.04, 0.04) * s, vy: -rand(0.05, 0.11) * s * size, size: rand(1, 1.8) * s });
        }
    },

    // Vòng sóng nhỏ không có tia nước (cá đớp mồi, vịt quạt chân)
    ring(x, d, size, life = 1400, delay = 0) {
        this.ripples.push({ x, d, age: -delay, life, r0: 1.5 * this.scale(d) * size, size });
    },

    // rocks: đá, gò đất giữa dòng (vật trôi, vịt né; ếch nhảy lên); pads: lá bèo (ếch nhảy lên); flags: loại nào đang bật
    // (tắt thì bỏ ngay)
    update(dt, river, cssW, topCss, depthCss, rocks = [], flags = WATER_ALL, pads = []) {
        const slow = IS_MOBILE ? 1.3 : 1;
        if (!flags.logs) this.logs = [];
        if (!flags.ducks) this.ducks = [];
        if (!flags.fish) this.fish = [];
        if (!flags.frogs) this.frogs = [];
        if (!flags.bubbles) this.bubbles = [];
        if (!flags.birds && this.birds.length) {
            this.birds.forEach(bird => this.freeEgretPerch(bird));
            this.birds = [];
        }
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

        // Cò: bay tới đậu trên khúc gỗ, đá, gò đất hoặc lội chỗ nước nông sát bờ; đứng thì ngó nghiêng, rỉa lông, lội thì
        // rình rồi mổ cá; hết giờ thì nhún chân cất cánh bay đi
        this.next.bird -= dt;
        if (this.next.bird <= 0 && flags.birds) {
            this.next.bird = (river ? rand(7000, 13000) : rand(9000, 16000)) * slow;
            if (this.birds.length < 2) this.birds.push(this.makeEgret(cssW, topCss, rocks));
        }
        this.birds.forEach(bird => this.updateEgret(bird, dt, cssW, topCss, depthCss, rocks));
        this.birds = this.birds.filter(bird => !(bird.state === 'leave' && (bird.y < -60 || bird.x < -60 || bird.x > cssW + 60)));

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
                this.splash(fish.x, fish.d, topCss, depthCss, size * 0.9);
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
                this.splash(fish.x + fish.dx, fish.d, topCss, depthCss, size);
            }
        });
        this.fish = this.fish.filter(fish => !fish.done);

        // Ếch: ló đầu khỏi mặt nước gần đá, gò đất, lá bèo hoặc sát bờ; nhảy lên ngồi, đớp đom đóm, nhảy sang chỗ khác
        // hoặc nhảy tõm xuống nước
        this.next.frog -= dt;
        if (this.next.frog <= 0 && flags.frogs) {
            this.next.frog = rand(6000, 12000) * slow;
            if (this.frogs.length < (IS_MOBILE ? 1 : 2)) this.frogs.push(this.makeFrog(cssW, rocks, pads));
        }
        this.frogs.forEach(frog => this.updateFrog(frog, dt, river, cssW, topCss, depthCss, rocks, pads));
        this.frogs = this.frogs.filter(frog => frog.state !== 'gone');

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
                const y = this.surfaceY(b.d, topCss, depthCss);
                for (let i = 0; i < 2; i++) this.drops.push({ x: b.x, y, base: y, vx: rand(-0.03, 0.03) * s, vy: -rand(0.03, 0.06) * s, size: rand(0.6, 1) * s });
            }
        });
        this.bubbles = this.bubbles.filter(b => b.t < b.life);

        // Cá đớp mồi: vòng sóng nhỏ lan ra đây đó trên mặt nước
        this.next.rise -= dt;
        if (this.next.rise <= 0 && flags.fish) {
            this.next.rise = rand(1200, 3200) * slow;
            const d = rand(0.15, 0.95);
            const x = rand(0.05, 0.95) * cssW;
            this.ring(x, d, 0.6, 1800);
            this.ring(x, d, 0.4, 1800, 260);
        }

        this.ripples.forEach(r => {
            r.age += dt;
            r.x += this.flow(r.d, river) * dt;
        });
        this.ripples = this.ripples.filter(r => r.age < r.life);
        this.drops.forEach(p => {
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy += 0.00035 * dt;
        });
        this.drops = this.drops.filter(p => p.y <= p.base || p.vy < 0);
    },

    // Vòng sóng; bóng cò, vịt đang bay in xuống nước, bay càng cao bóng càng nhạt (dưới mọi vật). Lớp đã nhân k: tọa độ
    // điểm ảnh CSS.
    drawUnder(ctx, k, topCss, depthCss, time = 0) {
        ctx.globalCompositeOperation = 'source-over';
        const reach = depthCss * 1.2;
        this.birds.forEach(bird => {
            if (bird.state !== 'fly' && bird.state !== 'leave') return;
            const surf = this.surfaceY(bird.d, topCss, depthCss);
            const y = bird.y + Math.cos(bird.ph) * 0.8 * bird.u;
            const lift = surf - y + 30 * bird.u;
            if (surf - y < 0 || surf - y > reach) return;
            drawMirrorSlices(ctx, surf, lift, bird.x, 45 * bird.u, 0.24 * (1 - (surf - y) / reach), time, bird.seed, bird.u, 1)(alpha => {
                ctx.globalAlpha = alpha;
                drawEgret(ctx, bird.x, y, bird.u, bird.dir, bird.pose, k);
            });
        });
        this.ducks.forEach(duck => {
            if (duck.state !== 'fly' && duck.state !== 'leave') return;
            const s = this.scale(duck.d);
            const surf = this.surfaceY(duck.d, topCss, depthCss);
            if (surf - duck.y < 0 || surf - duck.y > reach) return;
            const pose = Math.floor(duck.flap / 85) % 2 ? 'up' : 'down';
            drawMirrorSlices(ctx, surf, surf - duck.y + 12 * s, duck.x, 14 * s, 0.26 * (1 - (surf - duck.y) / reach), time, duck.seed, s, 1)(
                alpha => this.paintDuck(ctx, duck, pose, s, alpha));
        });
        this.bubbles.forEach(b => {
            if (b.t < 0) return;
            const s = this.scale(b.d);
            const grow = Math.min(1, b.t / 260);
            const wobble = b.life - b.t < 220 ? Math.sin(b.t * 0.08) : 0;
            ctx.globalAlpha = 1;
            drawBubble(ctx, b.x, this.surfaceY(b.d, topCss, depthCss), b.r * s * grow, k, wobble);
        });
        ctx.lineWidth = 1 / k;
        ctx.strokeStyle = 'rgb(205, 222, 255)';
        this.ripples.forEach(r => {
            if (r.age < 0) return;
            const p = r.age / r.life;
            const s = this.scale(r.d);
            const rx = r.r0 + p * 30 * s * (r.size ?? 1);
            ctx.globalAlpha = (1 - p) * 0.5;
            ctx.beginPath();
            ctx.ellipse(r.x, this.surfaceY(r.d, topCss, depthCss), rx, rx * 0.28, 0, 0, Math.PI * 2);
            ctx.stroke();
        });
    },

    // Vật nằm trên mặt nước, để vẽ chung với bèo, đá, hoa đăng... theo tầm xa
    things(ctx, k, topCss, depthCss, time, river) {
        return [
            ...this.logs.map(log => ({ d: log.d, draw: () => this.drawLog(ctx, log, k, topCss, depthCss, time, river) })),
            ...this.birds.filter(b => b.state === 'land' || b.state === 'stand' || b.state === 'takeoff').map(bird => ({
                d: bird.d + 0.0001, draw: () => this.drawStandingEgret(ctx, bird, k, topCss, depthCss)
            })),
            ...this.ducks.filter(duck => duck.state === 'swim' || duck.state === 'dabble').map(duck => ({
                d: duck.d, draw: () => this.drawDuck(ctx, duck, duck.state, this.scale(duck.d), k, time)
            })),
            ...this.frogs.filter(frog => frog.state === 'peek' || frog.state === 'sit' || frog.state === 'aim').map(frog => ({
                d: frog.d + 0.0003, draw: () => this.drawFrogNow(ctx, frog, topCss, depthCss)
            }))
        ];
    },

    // Cá đang nhảy, tia nước, cò và vịt đang bay (trên mọi vật)
    drawOver(ctx, k, topCss, depthCss, time) {
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
        this.frogs.forEach(frog => {
            if (frog.state === 'hop' || frog.state === 'leap') this.drawFrogNow(ctx, frog, topCss, depthCss);
            if (frog.bug) {
                // Đom đóm bay lượn quanh ếch (cộng sáng)
                const glow = fireflyGlow();
                const size = 5 * this.scale(frog.d);
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                ctx.globalAlpha = 0.6 + 0.4 * Math.sin(time * 0.012 + frog.seed * 9);
                ctx.drawImage(glow, frog.bug.x - size / 2, frog.bug.y - size / 2, size, size);
                ctx.restore();
            }
        });
        ctx.fillStyle = 'rgb(225, 236, 255)';
        this.drops.forEach(p => {
            ctx.globalAlpha = 0.8;
            ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        });
        this.birds.forEach(bird => {
            if (bird.state === 'fly' || bird.state === 'leave') this.drawFlyingEgret(ctx, bird, k);
        });
        this.ducks.forEach(duck => {
            if (duck.state !== 'fly' && duck.state !== 'leave') return;
            this.drawDuck(ctx, duck, Math.floor(duck.flap / 85) % 2 ? 'up' : 'down', this.scale(duck.d), k);
        });
        ctx.globalAlpha = 1;
    },

    // Vài bong bóng nổi lên quanh một chỗ (x: điểm ảnh CSS, d: độ xa), cái sau nổi muộn hơn cái trước một chút
    bubbleUp(x, d, n) {
        const s = this.scale(d);
        for (let i = 0; i < n; i++) {
            this.bubbles.push({ x: x + rand(-5, 5) * s, d: Math.max(0.02, Math.min(0.98, d + rand(-0.01, 0.01))), r: rand(0.8, 2.2), t: -i * rand(150, 550), life: rand(1200, 3400) });
        }
    },

    // Ếch mới: ló đầu ở chỗ nước gần đá, gò đất, lá bèo hoặc sát bờ
    makeFrog(cssW, rocks, pads) {
        return { state: 'peek', ...this.frogWaterSpot(cssW, rocks, pads), dir: Math.random() < 0.5 ? 1 : -1, t: 0, dur: rand(3000, 6500), seed: Math.random(), sacIn: rand(900, 2600), sac: 0, blinkIn: rand(1500, 4000), blink: 0, perch: null };
    },

    frogWaterSpot(cssW, rocks, pads, near) {
        const r = Math.random();
        if (near) return { x: near.x + rand(-26, 26) * this.scale(near.d), d: Math.max(0.02, Math.min(0.95, near.d + rand(-0.03, 0.03))) };
        if (rocks.length && r < 0.45) {
            const rock = rocks[(Math.random() * rocks.length) | 0];
            const w = rock.size * this.scale(rock.d);
            return { x: rock.x + (Math.random() < 0.5 ? -1 : 1) * w * rand(0.45, 0.65), d: Math.min(0.95, rock.d + rand(0.005, 0.03)) };
        }
        if (pads.length && r < 0.75) {
            const pad = pads[(Math.random() * pads.length) | 0];
            return { x: pad.u * cssW + (Math.random() < 0.5 ? -1 : 1) * rand(14, 22) * this.scale(pad.d), d: Math.min(0.95, pad.d + rand(0.005, 0.02)) };
        }
        return { x: rand(0.08, 0.92) * cssW, d: rand(0.02, 0.07) };
    },

    // Chỗ ếch ngồi: giữa lá bèo (theo lá trôi, dập dềnh), mặt trên đá, gò đất; hoặc một chỗ trên mặt nước
    frogPerchPoint(perch, cssW, topCss, depthCss) {
        if (perch.pad) {
            const pad = perch.pad;
            const s = this.scale(pad.d);
            return { x: pad.u * cssW + perch.ox * s, y: this.surfaceY(pad.d, topCss, depthCss) + Math.sin(pad.bob) * 0.5 - 0.7 * s, d: pad.d };
        }
        if (perch.rock) {
            const rock = perch.rock;
            const sprite = rock.kind === 'rock' ? rockSprite(rock.variant) : moundSprite(rock.variant);
            const w = rock.size * this.scale(rock.d);
            return { x: rock.x + (sprite.perchX + perch.ox) * w, y: this.surfaceY(rock.d, topCss, depthCss) - w * (sprite.wl - sprite.top) / sprite.width, d: rock.d };
        }
        return { x: perch.x, y: this.surfaceY(perch.d, topCss, depthCss), d: perch.d, water: true };
    },

    // Chỗ nhảy tới gần đó: lá bèo, đá, gò đất chưa có ai (cò, ếch khác); không có thì null
    frogTarget(frog, cssW, rocks, pads) {
        const s = this.scale(frog.d);
        const reach = 70 * s;
        const taken = p => this.frogs.some(f => f !== frog && f.perch && (f.perch.pad === p || f.perch.rock === p));
        const options = [
            ...pads.filter(p => !taken(p) && Math.abs(p.u * cssW - frog.x) < reach && Math.abs(p.d - frog.d) < 0.14).map(pad => ({ pad, ox: rand(-2, 2) })),
            ...rocks.filter(r => !taken(r) && !(r.bird && this.birds.includes(r.bird)) && Math.abs(r.x - frog.x) < reach * 1.3 && Math.abs(r.d - frog.d) < 0.16)
                .map(rock => ({ rock, ox: rand(-0.12, 0.12) }))
        ].filter(p => !(frog.perch && (p.pad ? p.pad === frog.perch.pad : p.rock === frog.perch.rock)));
        return options.length ? options[(Math.random() * options.length) | 0] : null;
    },

    // Nhảy vồng từ chỗ đang ở tới chỗ mới (tới mặt nước thì tõm xuống)
    frogHop(frog, to, cssW, topCss, depthCss) {
        const from = frog.perch ? this.frogPerchPoint(frog.perch, cssW, topCss, depthCss) : { x: frog.x, y: this.surfaceY(frog.d, topCss, depthCss), d: frog.d };
        if (!frog.perch) this.splash(frog.x, frog.d, topCss, depthCss, 0.35);
        else if (frog.perch.pad) this.ring(from.x, frog.d, 0.5, 900);
        const end = this.frogPerchPoint(to, cssW, topCss, depthCss);
        frog.dir = end.x >= from.x ? 1 : -1;
        frog.hop = { from, to, t: 0, dur: rand(420, 600), h: rand(14, 22) * this.scale(frog.d) + Math.abs(end.x - from.x) * 0.18 };
        frog.perch = null;
        frog.state = 'hop';
    },

    updateFrog(frog, dt, river, cssW, topCss, depthCss, rocks, pads) {
        frog.t += dt;
        const s = this.scale(frog.d);
        // Chớp mắt, túi kêu phồng lên xẹp xuống (lúc ngồi)
        frog.blinkIn -= dt;
        if (frog.blinkIn <= 0) {
            frog.blink = 140;
            frog.blinkIn = rand(2500, 6000);
        }
        frog.blink = Math.max(0, frog.blink - dt);
        // Chỗ ngồi không còn (tắt lá bèo, đá): nhảy xuống nước
        if (frog.perch && ((frog.perch.pad && !pads.includes(frog.perch.pad)) || (frog.perch.rock && !rocks.includes(frog.perch.rock)))) {
            frog.perch = null;
            frog.state = 'under';
            frog.t = 0;
            frog.dur = rand(1500, 3000);
            this.splash(frog.x, frog.d, topCss, depthCss, 0.35);
            return;
        }
        if (frog.state === 'peek') {
            // Ló đầu: dập dềnh theo sóng, trôi theo dòng; hết lúc thì nhảy lên chỗ gần đó hoặc lặn mất
            if (frog.t < dt + 1) this.ring(frog.x, frog.d, 0.45, 1400);
            frog.x += this.flow(frog.d, river) * dt;
            if (frog.t >= frog.dur) {
                const to = Math.random() < 0.7 ? this.frogTarget(frog, cssW, rocks, pads) : null;
                if (to) this.frogHop(frog, to, cssW, topCss, depthCss);
                else {
                    frog.state = Math.random() < 0.4 ? 'under' : 'gone';
                    frog.t = 0;
                    frog.dur = rand(1500, 3500);
                    this.ring(frog.x, frog.d, 0.5, 1300);
                    this.bubbleUp(frog.x, frog.d, 2);
                }
            }
        } else if (frog.state === 'under') {
            // Lặn dưới nước một lúc rồi ló đầu chỗ khác gần đó (bong bóng nổi lên chỗ vừa lặn)
            frog.x += this.flow(frog.d, river) * dt;
            if (frog.t >= frog.dur) {
                Object.assign(frog, { state: 'peek', ...this.frogWaterSpot(cssW, rocks, pads, Math.random() < 0.6 ? frog : null), t: 0, dur: rand(2500, 6000) });
            }
        } else if (frog.state === 'hop' || frog.state === 'leap') {
            const hop = frog.hop;
            hop.t += dt;
            const p = Math.min(1, hop.t / hop.dur);
            const end = frog.state === 'leap' ? this.frogPerchPoint(frog.perch, cssW, topCss, depthCss) : this.frogPerchPoint(hop.to, cssW, topCss, depthCss);
            const start = frog.state === 'leap' ? end : hop.from;
            frog.x = start.x + (end.x - start.x) * p;
            frog.y = start.y + (end.y - start.y) * p - hop.h * 4 * p * (1 - p);
            frog.d = start.d + (end.d - start.d) * p;
            frog.angle = frog.state === 'leap' ? -1.2 * (1 - 2 * p) : Math.atan2((end.y - start.y) - hop.h * 4 * (1 - 2 * p), Math.abs(end.x - start.x) + 1e-3);
            // Đớp đom đóm ở đỉnh cú nhảy
            if (frog.state === 'leap' && frog.bug && p > 0.42) {
                frog.tongue = 90;
                frog.tongueAt = [frog.bug.x - frog.x, frog.bug.y - frog.y];
                frog.bug = null;
            }
            if (p >= 1) {
                if (frog.state === 'leap') {
                    frog.state = 'sit';
                    frog.t = 0;
                    frog.dur = rand(2500, 6000);
                } else if (end.water) {
                    // Tõm xuống nước: tia nước, vòng sóng, bong bóng; lặn một lúc rồi có khi ló đầu chỗ khác
                    this.splash(end.x, end.d, topCss, depthCss, 0.45);
                    this.bubbleUp(end.x, end.d, 2);
                    Object.assign(frog, { state: Math.random() < 0.55 ? 'under' : 'gone', x: end.x, d: end.d, t: 0, dur: rand(1800, 4000) });
                } else {
                    frog.perch = hop.to;
                    frog.state = 'sit';
                    frog.t = 0;
                    frog.dur = rand(4000, 9000);
                    if (hop.to.pad) this.ring(end.x, end.d, 0.55, 1000);
                }
            }
        } else if (frog.state === 'sit' || frog.state === 'aim') {
            const at = this.frogPerchPoint(frog.perch, cssW, topCss, depthCss);
            frog.x = at.x;
            frog.y = at.y;
            frog.d = at.d;
            frog.sacIn -= dt;
            if (frog.sacIn <= 0) {
                frog.sac = 700;
                frog.sacIn = rand(1600, 4200);
            }
            frog.sac = Math.max(0, frog.sac - dt);
            frog.tongue = Math.max(0, (frog.tongue || 0) - dt);
            if (frog.state === 'aim') {
                // Đom đóm bay lại gần, ếch rình rồi nhảy vọt lên đớp
                const bug = frog.bug;
                bug.t += dt;
                const come = Math.max(0, 1 - bug.t / 1400);
                bug.x = frog.x + frog.dir * (6 + 30 * come) * s + Math.sin(bug.t * 0.006) * 4 * s;
                bug.y = frog.y - (16 + 10 * come) * s + Math.sin(bug.t * 0.009 + 1) * 3 * s;
                if (bug.t >= bug.wait) {
                    frog.state = 'leap';
                    frog.hop = { t: 0, dur: 480, h: 18 * s };
                }
            } else if (frog.t >= frog.dur) {
                const r = Math.random();
                if (r < 0.4) {
                    frog.state = 'aim';
                    frog.bug = { t: 0, wait: rand(1500, 2600), x: frog.x, y: frog.y };
                } else {
                    const to = r < 0.72 ? this.frogTarget(frog, cssW, rocks, pads) : null;
                    // Không có chỗ nào gần: nhảy tõm xuống nước ngay cạnh
                    this.frogHop(frog, to || { x: frog.x + frog.dir * rand(14, 26) * s, d: Math.min(0.97, frog.d + rand(0.005, 0.03)) }, cssW, topCss, depthCss);
                }
            }
        }
    },

    drawFrogNow(ctx, frog, topCss, depthCss) {
        const u = 1.3 * this.scale(frog.d);
        ctx.globalAlpha = 1;
        if (frog.state === 'peek') {
            drawFrog(ctx, frog.x, this.surfaceY(frog.d, topCss, depthCss) + Math.sin(frog.t * 0.004) * 0.3 * u, u, frog.dir, 'peek', { blink: frog.blink > 0 });
        } else if (frog.state === 'hop' || (frog.state === 'leap' && frog.hop.t / frog.hop.dur > 0.12 && frog.hop.t / frog.hop.dur < 0.88)) {
            drawFrog(ctx, frog.x, frog.y - 2 * u, u, frog.dir, 'jump', { angle: frog.angle });
        } else {
            drawFrog(ctx, frog.x, frog.y, u, frog.dir, 'sit', {
                sac: frog.sac > 0 ? Math.sin(Math.PI * (1 - frog.sac / 700)) : 0, blink: frog.blink > 0,
                tongue: frog.tongue > 0 ? frog.tongueAt : null
            });
        }
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
    },

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
    },

    makeEgret(cssW, topCss, rocks) {
        const dir = Math.random() < 0.5 ? 1 : -1;
        const bird = {
            state: 'fly', dir, x: dir > 0 ? -30 : cssW + 30, y: topCss * rand(0.2, 0.55), ph: Math.random() * 6, t: 0, seed: Math.random(),
            rest: rand(9000, 18000), act: null, legs: 'fly', d: 0.5, u: 1, pose: { ...EGRET_POSE, legs: 'fly' }
        };
        const logs = this.logs.filter(log => !log.bird && logSprite(log.variant).perch && log.x > cssW * 0.15 && log.x < cssW * 0.6);
        // Đá, gò đất chưa có cò nào đang đậu (dấu cũ của cò đã đi khỏi cảnh thì bỏ qua)
        const free = rocks.filter(rock => (!rock.bird || !this.birds.includes(rock.bird)) && !this.frogs.some(frog => frog.perch && frog.perch.rock === rock));
        const roll = Math.random();
        if (logs.length && roll < 0.4) {
            bird.perch = { log: logs[0], ox: rand(0.35, 0.65) };
            logs[0].bird = bird;
        } else if (free.length && roll < 0.78) {
            const rock = free[(Math.random() * free.length) | 0];
            bird.perch = { rock };
            rock.bird = bird;
        } else {
            bird.perch = { wade: true, x: rand(0.15, 0.85) * cssW, d: rand(0.03, 0.12) };
        }
        return bird;
    },

    freeEgretPerch(bird) {
        if (bird.perch.log && bird.perch.log.bird === bird) bird.perch.log.bird = null;
        if (bird.perch.rock && bird.perch.rock.bird === bird) bird.perch.rock.bird = null;
    },

    // Chỗ chân cò chạm: mặt trên khúc gỗ, đá, gò đất; lội thì chân ngập dưới mặt nước. surf: mặt nước chỗ đó.
    egretFeet(bird, topCss, depthCss) {
        const perch = bird.perch;
        if (perch.log) {
            const log = perch.log;
            const s = this.scale(log.d);
            const surf = this.surfaceY(log.d, topCss, depthCss);
            // Chỗ đậu lên xuống, nghiêng theo khúc gỗ
            const w = log.len * s;
            const tilt = w * (perch.ox - 0.5) * this.logTilt(log);
            return { x: log.x - w * (1 - perch.ox), y: surf - this.logPerch(log, s) + Math.sin(log.phase) * 0.5 * s + tilt, d: log.d, surf };
        }
        if (perch.rock) {
            const rock = perch.rock;
            const sprite = rock.kind === 'rock' ? rockSprite(rock.variant) : moundSprite(rock.variant);
            const w = rock.size * this.scale(rock.d);
            const surf = this.surfaceY(rock.d, topCss, depthCss);
            return { x: rock.x + sprite.perchX * w, y: surf - w * (sprite.wl - sprite.top) / sprite.width, d: rock.d, surf };
        }
        const surf = this.surfaceY(perch.d, topCss, depthCss);
        return { x: perch.x, y: surf + 3 * 0.9 * this.scale(perch.d), d: perch.d, surf, wade: true };
    },

    // Việc tiếp theo lúc đứng: ngó nghiêng, rỉa lông, đứng nghỉ; lội thì rình (bước chậm) rồi mổ, có khi được cá
    nextEgretAction(bird) {
        const prev = bird.act && bird.act.type;
        if (prev === 'stalk' || prev === 'watch') return { type: 'strike', t: 0, dur: 520 };
        if (prev === 'strike') return Math.random() < 0.45 ? { type: 'catch', t: 0, dur: 1400 } : { type: 'look', t: 0, dur: rand(900, 1600) };
        const r = Math.random();
        if (bird.perch.wade && r < 0.55) return { type: 'stalk', t: 0, dur: rand(2500, 5000) };
        // Đậu trên gỗ, đá, gò đất: rướn người rình cá dưới nước ngay mép, hoặc cúi xuống mổ tìm mồi chỗ đang đứng
        if (!bird.perch.wade && r < 0.24) return { type: 'watch', t: 0, dur: rand(1800, 3800) };
        if (!bird.perch.wade && r < 0.44) return { type: 'peck', t: 0, dur: rand(1600, 3000) };
        if (r < 0.72) return { type: 'look', t: 0, dur: rand(1600, 3200), turn: Math.random() < 0.4 };
        if (r < 0.88) return { type: 'preen', t: 0, dur: rand(1800, 3200) };
        return { type: 'idle', t: 0, dur: rand(1500, 3000) };
    },

    updateEgret(bird, dt, cssW, topCss, depthCss, rocks) {
        bird.t += dt;
        // Chỗ đậu không còn (khúc gỗ trôi đi, tắt đá/gò đất): đang bay thì chuyển sang lội, đang đứng thì bay đi
        const gone = (bird.perch.log && !this.logs.includes(bird.perch.log)) || (bird.perch.rock && !rocks.includes(bird.perch.rock));
        if (gone) {
            if (bird.state === 'fly') {
                const feet = this.egretFeet(bird, topCss, depthCss);
                bird.perch = { wade: true, x: Math.min(cssW - 30, Math.max(30, feet.x)), d: rand(0.03, 0.12) };
                bird.target = null;
            } else if (bird.state === 'land' || bird.state === 'stand') {
                bird.state = 'takeoff';
                bird.t = 0;
            }
        }
        const feet = this.egretFeet(bird, topCss, depthCss);
        const u = 0.9 * this.scale(feet.d);
        bird.d = feet.d;
        bird.u = u;
        const p = bird.pose;
        const target = { ...EGRET_POSE, wing: p.wing, lag: p.lag };
        let wingTau = 40;
        if (bird.state === 'fly') {
            // Chỗ đậu đang trôi (khúc gỗ theo dòng): bay theo cả đà trôi của nó, không thì đuổi mãi không đáp được
            if (bird.target) {
                bird.x += feet.x - bird.target.x;
                bird.y += feet.y - bird.target.y;
            }
            bird.target = { x: feet.x, y: feet.y };
            const tx = feet.x;
            const ty = feet.y - 11 * u;
            const dx = tx - bird.x;
            const dy = ty - bird.y;
            const dist = Math.hypot(dx, dy);
            bird.dir = dx >= 0 ? 1 : -1;
            const near = dist < 60;
            const step = Math.min(dist, (near ? 0.035 + 0.06 * dist / 60 : 0.11) * dt);
            bird.ph += dt * Math.PI * 2 / (near ? 380 : 780);
            if (near) {
                // Sắp đáp: xòe cánh hãm lại, đưa chân ra trước, ngả thân ra sau
                Object.assign(target, { wing: 1.0 + 0.28 * Math.sin(bird.ph), lag: 0.35, neck: 0.5, tilt: -0.45, legA: Math.PI / 2 - 0.35 });
            } else {
                Object.assign(target, { wing: 0.25 + 0.95 * Math.sin(bird.ph), lag: -0.45 * Math.cos(bird.ph), legA: Math.PI - 0.1 });
            }
            if (dist <= step + 0.5) {
                bird.target = null;
                bird.state = 'land';
                bird.t = 0;
                bird.legs = 'stand';
                if (feet.wade) this.splash(feet.x, feet.d, topCss, depthCss, 0.5);
            } else {
                bird.x += dx / dist * step;
                bird.y += dy / dist * step;
            }
        } else if (bird.state === 'land' || bird.state === 'stand') {
            if (bird.state === 'land') {
                // Chạm chân: cánh còn giơ một chút rồi xếp lại
                Object.assign(target, { fold: bird.t < 220 ? 1 : 0, wing: 0.9, lag: 0.2, neck: 0.8, tilt: -0.35, crouch: bird.t < 200 ? 0.5 : 0 });
                wingTau = 120;
                if (bird.t > 650) {
                    bird.state = 'stand';
                    bird.act = null;
                }
            } else {
                bird.rest -= dt;
                if (!bird.act || bird.act.t >= bird.act.dur) {
                    // Ngó xong có khi quay sang hướng khác
                    if (bird.act && bird.act.type === 'look' && bird.act.turn) bird.dir = -bird.dir;
                    bird.act = this.nextEgretAction(bird);
                }
                const act = bird.act;
                act.t += dt;
                const q = act.t / act.dur;
                // Đậu trên cao: đầu phải hạ thêm bao nhiêu (đơn vị u) để mũi mỏ chạm mặt nước ngay mép chỗ đậu
                const reach = feet.wade ? 0 : Math.min(10, Math.max(0, (this.surfaceY(feet.d + 0.02, topCss, depthCss) - bird.y) / u - 15));
                Object.assign(target, { fold: 0, neck: 0.78, tilt: -0.32, breath: Math.sin(bird.t * 0.003) });
                if (act.type === 'idle') {
                    target.headTilt = Math.sin(bird.t * 0.0013) * 0.08;
                } else if (act.type === 'look') {
                    Object.assign(target, { neck: 1, headTilt: -0.12 + Math.sin(bird.t * 0.0021) * 0.12, turn: q > 0.3 && q < 0.65 ? 1.1 : 0 });
                } else if (act.type === 'preen') {
                    Object.assign(target, { preen: 1, headX: Math.sin(bird.t * 0.018) * 0.7, headY: Math.sin(bird.t * 0.011) * 0.5 });
                } else if (act.type === 'stalk') {
                    // Rướn cổ, khom người, bước thật chậm
                    Object.assign(target, { stalk: 1, crouch: 0.4, walk: 1, tilt: -0.1 });
                    p.step += dt * 0.0045;
                    bird.perch.x = Math.min(cssW - 30, Math.max(30, bird.perch.x + bird.dir * 0.004 * dt));
                } else if (act.type === 'watch') {
                    // Đứng trên chỗ đậu rướn người nhìn xuống nước, đầu hạ dần, im phăng phắc
                    Object.assign(target, { stalk: 1, crouch: 0.35, tilt: 0.05, headY: Math.min(6, reach * 0.35), headTilt: 0.35 });
                } else if (act.type === 'peck') {
                    // Cúi xuống mổ tìm mồi trên gỗ, đá: mổ nhanh vài cái rồi ngẩng lên chút
                    const jab = Math.pow(Math.max(0, Math.sin(act.t * 0.012)), 6);
                    Object.assign(target, { peck: 0.7 + 0.3 * jab, crouch: 0.3, tilt: 0.12, headY: jab * 1.8 });
                } else if (act.type === 'strike') {
                    // Lội thì mổ ngay trước chân; đậu trên cao thì vươn hẳn cổ xuống mặt nước sát mép chỗ đậu
                    Object.assign(target, { stalk: 1, crouch: 0.5, tilt: feet.wade ? -0.05 : 0.15, strike: q < 0.55 ? 1 : 0, headY: q < 0.55 ? reach : 0 });
                    if (q > 0.3 && !act.splashed) {
                        act.splashed = true;
                        this.splash(feet.x + bird.dir * (feet.wade ? 20 : 17) * u, feet.d + (feet.wade ? 0 : 0.02), topCss, depthCss, 0.45);
                    }
                } else if (act.type === 'catch') {
                    // Ngửa cổ nuốt cá
                    Object.assign(target, { neck: 0.95, headTilt: -0.5, prey: q < 0.45 ? 1 : 0 });
                    p.gulp = q > 0.45 && q < 0.95 ? (q - 0.45) / 0.5 : 0;
                }
                const edge = feet.x > cssW - 20 || feet.x < 20;
                if ((bird.rest <= 0 && (act.type === 'idle' || act.type === 'look')) || edge) {
                    bird.state = 'takeoff';
                    bird.t = 0;
                }
            }
            bird.x = feet.x;
            bird.y = feet.y - 11 * u * (1 - 0.25 * p.crouch);
        } else if (bird.state === 'takeoff') {
            // Nhún chân lấy đà rồi bật lên
            Object.assign(target, { fold: 0, crouch: 1, neck: 0.4, tilt: -0.2 });
            bird.x = feet.x;
            bird.y = feet.y - 11 * u * (1 - 0.25 * p.crouch);
            if (bird.t > 240) {
                this.freeEgretPerch(bird);
                if (feet.wade) this.splash(feet.x, feet.d, topCss, depthCss, 0.6);
                bird.state = 'leave';
                bird.t = 0;
                bird.legs = 'fly';
                bird.vx = bird.dir * 0.07;
                bird.vy = -0.08;
                p.fold = 0.6;
                p.legA = Math.PI / 2 + 0.25;
            }
        } else {
            // Cất cánh: vỗ mạnh, chân còn buông thõng rồi duỗi dần về sau
            bird.ph += dt * Math.PI * 2 / (bird.t < 900 ? 440 : 700);
            Object.assign(target, {
                wing: 0.3 + 1.0 * Math.sin(bird.ph), lag: -0.5 * Math.cos(bird.ph),
                legA: bird.t < 500 ? Math.PI / 2 + 0.25 : Math.PI - 0.1, tilt: bird.t < 600 ? -0.25 : 0
            });
            bird.vx += bird.dir * 0.00004 * dt;
            bird.x += bird.vx * dt;
            bird.y += bird.vy * dt;
            bird.vy = Math.max(-0.1, bird.vy - 0.00003 * dt);
        }
        // Tư thế đổi dần (mổ thì nhanh), cánh theo nhịp vỗ
        const ease = tau => 1 - Math.exp(-dt / tau);
        Object.keys(target).forEach(key => {
            if (key === 'gulp' || key === 'step') return;
            const tau = key === 'wing' || key === 'lag' ? wingTau : key === 'strike' ? 45 : key === 'fold' ? 140 : 110;
            p[key] += (target[key] - p[key]) * ease(tau);
        });
        p.legs = bird.legs;
    },

    // Cò đứng: phần chân ngập nước (lúc lội) không thấy; bóng in xuống nước; vòng sóng quanh chân
    drawStandingEgret(ctx, bird, k, topCss, depthCss) {
        const feet = this.egretFeet(bird, topCss, depthCss);
        const u = bird.u;
        const paint = alpha => {
            ctx.save();
            if (feet.wade) {
                ctx.beginPath();
                ctx.rect(bird.x - 40 * u, bird.y - 40 * u, 80 * u, Math.max(0, feet.surf - (bird.y - 40 * u)));
                ctx.clip();
            }
            ctx.globalAlpha = alpha;
            drawEgret(ctx, bird.x, bird.y, u, bird.dir, bird.pose, k);
            ctx.restore();
        };
        drawMirrorSlices(ctx, feet.surf, feet.surf - (bird.y - 30 * u), bird.x, 34 * u, 0.36, bird.t, bird.seed, u)(paint);
        paint(0.97);
        if (feet.wade) {
            ctx.strokeStyle = 'rgb(205, 222, 255)';
            ctx.lineWidth = 1 / k;
            ctx.globalAlpha = 0.25 + 0.1 * Math.sin(bird.t * 0.004);
            ctx.beginPath();
            ctx.ellipse(feet.x + bird.dir * 0.5 * u, feet.surf, 4.5 * u, 1.2 * u, 0, 0, Math.PI * 2);
            ctx.stroke();
        }
    },

    drawFlyingEgret(ctx, bird, k) {
        ctx.globalAlpha = 0.97;
        drawEgret(ctx, bird.x, bird.y + Math.cos(bird.ph) * 0.8 * bird.u, bird.u, bird.dir, bird.pose, k);
    },

    // Cá đang nhảy: tâm thân đi theo đường cong từ dưới mặt nước lên rồi xuống lại dưới mặt nước
    fishState(fish, topCss, depthCss) {
        const p = Math.min(1, Math.max(0, fish.t / fish.life));
        const L = FISH_TYPES[fish.type].size * this.scale(fish.d);
        const H = fish.h + L * 0.45;
        const surf = this.surfaceY(fish.d, topCss, depthCss);
        return { p, L, surf, x: fish.x + fish.dx * p, y: surf - 4 * H * p * (1 - p) + L * 0.45, vx: fish.dx, vy: -4 * H * (1 - 2 * p) };
    }
};

// ---------------------------------------------------------------------------
// Bờ đất ở mép nước và lá bèo
// ---------------------------------------------------------------------------
