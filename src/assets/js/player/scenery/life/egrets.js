/*!
 * Trình diễn Pháo hoa – trình phát: cảnh vật (cò)
 * Phần bổ sung và chỉnh sửa © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Cò: bay tới đậu trên khúc gỗ, đá, gò đất hoặc lội chỗ nước nông; ngó nghiêng, rỉa lông, rình rồi mổ cá,
// bay đi; bóng in xuống nước.

import { EGRET_POSE, drawEgret } from '../creatures.js';
import { drawMirrorSlices } from '../water-fx.js';
import { logSprite, moundSprite, rockSprite } from '../water-sprites.js';
import { rand } from '../util.js';

export const EgretLife = {
    // Hàm riêng của loại này, gộp vào WaterLife (dùng chung this: vòng sóng, tia nước, cỡ theo độ xa...)
    methods: {
        makeEgret(cssW, topCss, rocks) {
            const dir = Math.random() < 0.5 ? 1 : -1;
            const bird = {
                state: 'fly', dir, x: dir > 0 ? -30 : cssW + 30, y: topCss * rand(0.2, 0.55), ph: Math.random() * 6, t: 0, seed: Math.random(),
                rest: rand(9000, 18000), act: null, legs: 'fly', d: 0.5, u: 1, size: rand(0.85, 1.15), pose: { ...EGRET_POSE, legs: 'fly' }
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
            return { x: perch.x, y: surf + 3 * 0.9 * bird.size * this.scale(perch.d), d: perch.d, surf, wade: true };
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
            const u = 0.9 * bird.size * this.scale(feet.d);
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
                if (near && !bird.braked) {
                    // Sắp đáp: vỗ cánh hãm lại
                    bird.braked = true;
                    this.sound('egretWings', bird.x, feet.d, { seed: bird.seed });
                }
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
                    if (feet.wade) this.splash(feet.x, feet.d, topCss, depthCss, 0.5, 'birds');
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
                            this.splash(feet.x + bird.dir * (feet.wade ? 20 : 17) * u, feet.d + (feet.wade ? 0 : 0.02), topCss, depthCss, 0.45, 'birds');
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
                    if (feet.wade) this.splash(feet.x, feet.d, topCss, depthCss, 0.6, 'birds');
                    // Cất cánh: vỗ cánh mạnh, nhiều khi kêu khàn một tiếng
                    this.sound('egretWings', feet.x, feet.d, { seed: bird.seed });
                    if (Math.random() < 0.55) this.sound('egret', feet.x, feet.d, { seed: Math.random() });
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
        }
    },

    update(dt, { river, cssW, topCss, depthCss, rocks, flags, slow }) {
        // Cò: bay tới đậu trên khúc gỗ, đá, gò đất hoặc lội chỗ nước nông sát bờ; đứng thì ngó nghiêng, rỉa lông, lội thì
        // rình rồi mổ cá; hết giờ thì nhún chân cất cánh bay đi
        this.next.bird -= dt;
        if (this.next.bird <= 0 && flags.birds) {
            this.next.bird = (river ? rand(7000, 13000) : rand(9000, 16000)) * slow;
            if (this.birds.length < 2) this.birds.push(this.makeEgret(cssW, topCss, rocks));
        }
        this.birds.forEach(bird => this.updateEgret(bird, dt, cssW, topCss, depthCss, rocks));
        this.birds = this.birds.filter(bird => !(bird.state === 'leave' && (bird.y < -60 || bird.x < -60 || bird.x > cssW + 60)));
    },

    under(ctx, { k, topCss, depthCss, time, reach }) {
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
    },

    things(ctx, { k, topCss, depthCss }) {
        return this.birds.filter(b => b.state === 'land' || b.state === 'stand' || b.state === 'takeoff').map(bird => ({
            d: bird.d + 0.0001, draw: () => this.drawStandingEgret(ctx, bird, k, topCss, depthCss)
        }));
    },

    over(ctx, { k }) {
        this.birds.forEach(bird => {
            if (bird.state === 'fly' || bird.state === 'leave') this.drawFlyingEgret(ctx, bird, k);
        });
    }
};
