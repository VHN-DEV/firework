/*!
 * Trình diễn Pháo hoa – trình phát: cảnh vật (ếch)
 * Phần bổ sung và chỉnh sửa © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Ếch: ló đầu khỏi mặt nước, nhảy lên lá bèo, đá, gò đất ngồi phập phồng túi kêu, đớp đom đóm, nhảy tõm
// xuống nước. Con to con nhỏ: nhái bé tí kêu the thé, ếch to nhảy xa, tõm to, kêu trầm.

import { IS_MOBILE } from '../../env.js';
import { drawFrog } from '../creatures.js';
import { fireflyGlow, rand } from '../util.js';
import { moundSprite, rockSprite } from '../water-sprites.js';

export const FrogLife = {
    // Hàm riêng của loại này, gộp vào WaterLife (dùng chung this: vòng sóng, tia nước, cỡ theo độ xa...)
    methods: {
        // Ếch mới: ló đầu ở chỗ nước gần đá, gò đất, lá bèo hoặc sát bờ; size: cỡ so với con vừa (nhiều con vừa, ít con
        // nhỏ, hiếm con to)
        makeFrog(cssW, rocks, pads) {
            return { state: 'peek', ...this.frogWaterSpot(cssW, rocks, pads), dir: Math.random() < 0.5 ? 1 : -1, t: 0, dur: rand(3000, 6500), seed: Math.random(), sacIn: rand(900, 2600), sac: 0, blinkIn: rand(1500, 4000), blink: 0, perch: null, size: 0.6 + Math.pow(Math.random(), 1.4) };
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
            const reach = 70 * s * Math.sqrt(frog.size);
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
            if (!frog.perch) this.splash(frog.x, frog.d, topCss, depthCss, 0.35 * frog.size, 'frogs');
            else if (frog.perch.pad) this.ring(from.x, frog.d, 0.5 * frog.size, 900);
            const end = this.frogPerchPoint(to, cssW, topCss, depthCss);
            frog.dir = end.x >= from.x ? 1 : -1;
            frog.hop = { from, to, t: 0, dur: rand(420, 600) * Math.pow(frog.size, 0.3), h: rand(14, 22) * this.scale(frog.d) * Math.pow(frog.size, 0.7) + Math.abs(end.x - from.x) * 0.18 };
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
                // Đom đóm đang lượn quanh chỗ ngồi cũ bay mất theo
                frog.bug = null;
                frog.state = 'under';
                frog.t = 0;
                frog.dur = rand(1500, 3000);
                this.splash(frog.x, frog.d, topCss, depthCss, 0.35 * frog.size, 'frogs');
                return;
            }
            if (frog.state === 'peek') {
                // Ló đầu: dập dềnh theo sóng, trôi theo dòng; hết lúc thì nhảy lên chỗ gần đó hoặc lặn mất
                if (frog.t < dt + 1) this.ring(frog.x, frog.d, 0.45 * frog.size, 1400);
                frog.x += this.flow(frog.d, river) * dt;
                if (frog.t >= frog.dur) {
                    const to = Math.random() < 0.7 ? this.frogTarget(frog, cssW, rocks, pads) : null;
                    if (to) this.frogHop(frog, to, cssW, topCss, depthCss);
                    else {
                        frog.state = Math.random() < 0.4 ? 'under' : 'gone';
                        frog.t = 0;
                        frog.dur = rand(1500, 3500);
                        this.ring(frog.x, frog.d, 0.5 * frog.size, 1300);
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
                        this.splash(end.x, end.d, topCss, depthCss, 0.45 * frog.size, 'frogs');
                        this.bubbleUp(end.x, end.d, 2);
                        Object.assign(frog, { state: Math.random() < 0.55 ? 'under' : 'gone', x: end.x, d: end.d, t: 0, dur: rand(1800, 4000) });
                    } else {
                        frog.perch = hop.to;
                        frog.state = 'sit';
                        frog.t = 0;
                        frog.dur = rand(4000, 9000);
                        if (hop.to.pad) this.ring(end.x, end.d, 0.55 * frog.size, 1000);
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
                    // Phồng túi kêu thì kêu "ộp" (có lần chỉ phồng không kêu), to nhất đúng lúc túi căng nhất; mỗi con một giọng,
                    // con to kêu trầm, con nhỏ the thé
                    if (Math.random() < 0.8) this.sound('frog', frog.x, frog.d, { seed: frog.seed, delay: 120, pitch: 1 / Math.sqrt(frog.size) });
                }
                frog.sac = Math.max(0, frog.sac - dt);
                frog.tongue = Math.max(0, (frog.tongue || 0) - dt);
                if (frog.state === 'aim') {
                    // Đom đóm bay lại gần, ếch rình rồi nhảy vọt lên đớp
                    const bug = frog.bug;
                    bug.t += dt;
                    const come = Math.max(0, 1 - bug.t / 1400);
                    const fs = s * frog.size;
                    bug.x = frog.x + frog.dir * (6 + 30 * come) * fs + Math.sin(bug.t * 0.006) * 4 * s;
                    bug.y = frog.y - (16 + 10 * come) * fs + Math.sin(bug.t * 0.009 + 1) * 3 * s;
                    if (bug.t >= bug.wait) {
                        frog.state = 'leap';
                        frog.hop = { t: 0, dur: 480 * Math.pow(frog.size, 0.3), h: 18 * fs };
                    }
                } else if (frog.t >= frog.dur) {
                    const r = Math.random();
                    if (r < 0.4) {
                        frog.state = 'aim';
                        frog.bug = { t: 0, wait: rand(1500, 2600), x: frog.x, y: frog.y };
                    } else {
                        const to = r < 0.72 ? this.frogTarget(frog, cssW, rocks, pads) : null;
                        // Không có chỗ nào gần: nhảy tõm xuống nước ngay cạnh
                        this.frogHop(frog, to || { x: frog.x + frog.dir * rand(14, 26) * s * frog.size, d: Math.min(0.97, frog.d + rand(0.005, 0.03)) }, cssW, topCss, depthCss);
                    }
                }
            }
        },

        drawFrogNow(ctx, frog, topCss, depthCss) {
            const u = 1.3 * this.scale(frog.d) * frog.size;
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
        }
    },

    update(dt, { river, cssW, topCss, depthCss, rocks, flags, pads, slow }) {
        // Ếch: ló đầu khỏi mặt nước gần đá, gò đất, lá bèo hoặc sát bờ; nhảy lên ngồi, đớp đom đóm, nhảy sang chỗ khác
        // hoặc nhảy tõm xuống nước
        this.next.frog -= dt;
        if (this.next.frog <= 0 && flags.frogs) {
            this.next.frog = rand(6000, 12000) * slow;
            if (this.frogs.length < (IS_MOBILE ? 1 : 2)) this.frogs.push(this.makeFrog(cssW, rocks, pads));
        }
        this.frogs.forEach(frog => this.updateFrog(frog, dt, river, cssW, topCss, depthCss, rocks, pads));
        this.frogs = this.frogs.filter(frog => frog.state !== 'gone');
    },

    things(ctx, { topCss, depthCss }) {
        return this.frogs.filter(frog => frog.state === 'peek' || frog.state === 'sit' || frog.state === 'aim').map(frog => ({
            d: frog.d + 0.0003, draw: () => this.drawFrogNow(ctx, frog, topCss, depthCss)
        }));
    },

    over(ctx, { topCss, depthCss, time }) {
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
    }
};
