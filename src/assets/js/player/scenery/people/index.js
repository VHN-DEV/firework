/*!
 * Trình diễn Pháo hoa – trình phát: cảnh vật (người ngắm pháo)
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Người ngắm pháo bên bờ (kịch bản `people`: 'man' | 'woman' | 'couple', chỉ khi có mặt nước): nhân vật anime đứng
// trên bờ bên này ở đáy khung, quay lưng về phía người xem, nhìn ra mặt nước. Vẽ trên lớp riêng phía trên các lớp pháo
// (ghép bình thường, không "lighten") nên che được ánh pháo, bóng pháo dưới nước. Phần dựng hình nhân vật (three.js,
// mô hình, biên đạo) tải riêng khi kịch bản có người (stage3d.js); trong lúc tải chỉ có bờ đất.
// Ngoài nhân vật: bóng đổ về phía người xem trên mặt đất (pháo ở trước mặt họ), trời mưa đất ướt in bóng người; hạt mưa
// gần rơi trước người, hạt mưa đập lên tán ô bắn tung, nước nhỏ giọt từ đầu nan; mùa đông, tuyết: hơi thở trắng.

import { horizon, isLowQuality, season as sceneSeason, weather as sceneWeather } from '../../state.js';
import { INVISIBLE } from '../../env.js';
import { Star } from '../../particles.js';
import { makeCanvas } from '../../utils.js';
import { Weather } from '../weather.js';
import { drawGround, groundKind } from './ground.js';

// Góc nhìn hơi từ trên xuống: điểm xa hơn lên cao chừng này phần
const TILT = 0.26;
// Mép nước cách chỗ người đứng (mét)
const EDGE = 0.62;
// Chiều cao chàng trai (mét): theo đó tính cỡ trên màn hình
const MAN_HEIGHT = 1.8;

// Gió (cùng nhịp với mưa, tuyết trong weather.js): thổi từ trái sang phải từng đợt
const windAt = time => 0.6 + 0.4 * Math.sin(time * 0.00021) + 0.3 * Math.sin(time * 0.00063 + 1);

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

let flake = null;

function flakeSprite() {
    if (!flake) {
        const [c, g] = makeCanvas(24, 24);
        const grad = g.createRadialGradient(12, 12, 0, 12, 12, 12);
        grad.addColorStop(0, 'rgba(240, 245, 255, 1)');
        grad.addColorStop(0.4, 'rgba(230, 238, 252, 0.8)');
        grad.addColorStop(1, 'rgba(220, 230, 250, 0)');
        g.fillStyle = grad;
        g.fillRect(0, 0, 24, 24);
        flake = c;
    }
    return flake;
}

// Canvas tạm dùng lại giữa các khung: cấp dư theo bội 64 điểm ảnh, chỉ vẽ trong góc (0, 0, w, h)
function fit(c, w, h) {
    const W = Math.ceil(w / 64) * 64;
    const H = Math.ceil(h / 64) * 64;
    if (c.width < w || c.height < h || c.width > W * 2 || c.height > H * 2) {
        c.width = W;
        c.height = H;
    }
    return c;
}

export const People = {
    key: '',
    mod: null,
    stage: null,
    stagePromise: null,
    show: null,
    actors: [],
    layout: null,
    time: 0,
    drawn: false,
    focus: { x: 0, y: 0, ready: false },
    stars: 0,
    burst: false,
    drips: [],
    splashes: [],
    puffs: [],
    mask: null,
    small: null,
    failed: false,

    // Chạy lại từ đầu (bản xem nhanh bấm chạy lại): người lại từ hai mép đi vào
    restart() {
        this.key = '';
    },

    // Tải sẵn phần dựng hình và nhân vật (dựng video chờ xong mới bắt đầu ghi)
    prepare(kind) {
        if (!kind || this.failed) return Promise.resolve();
        return this.load().then(mod => mod && Promise.all(this.castOf(kind).map(mod.loadCastFor))).catch(() => {});
    },

    castOf(kind) {
        return kind === 'couple' ? ['m', 'f'] : [kind === 'man' ? 'm' : 'f'];
    },

    load() {
        if (!this.stagePromise) {
            this.stagePromise = import('./stage3d.js').then(mod => {
                this.mod = mod;
                this.stage = new mod.Stage3D();
                return mod;
            }).catch(e => {
                // Máy không có WebGL hoặc mất mạng: bỏ người, cảnh vẫn chạy bình thường
                this.failed = true;
                console.warn('People: không dựng được nhân vật', e);
                return null;
            });
        }
        return this.stagePromise;
    },

    // kind: '' | 'man' | 'woman' | 'couple'. Đổi người, mùa hoặc mưa/tạnh thì dựng lại (đi vào từ đầu)
    sync(kind, cssW, cssH) {
        const level = horizon();
        if (level >= 1 || !kind || !cssW || !cssH || this.failed) {
            this.show = null;
            this.actors = [];
            this.key = '';
            this.layout = null;
            return;
        }
        const umbrella = ['rain', 'snow'].includes(sceneWeather());
        this.layoutFor(cssW, cssH, level);
        const key = `${kind}_${sceneSeason()}_${umbrella}`;
        if (key === this.key) return;
        this.key = key;
        this.show = null;
        this.actors = [];
        this.drips = [];
        this.splashes = [];
        this.puffs = [];
        const token = this.token = {};
        this.load().then(mod => {
            if (!mod || this.token !== token) return null;
            return this.stage.cast(this.castOf(kind)).then(actors => {
                if (this.token !== token) return;
                const halfW = this.layout.halfW;
                if (umbrella) {
                    actors.forEach(a => {
                        this.stage.umbrellaFor(a, a.sex);
                        a.umbrellaHand = a.sex === 'm' ? 'right' : 'left';
                        a.umbrellaGrip = 0;
                    });
                }
                this.actors = actors;
                this.time = 0;
                this.show = kind === 'couple' ? new mod.Duo(actors[0], actors[1], { halfW, umbrella }) : new mod.Solo(actors[0], { halfW, umbrella });
            });
        }).catch(e => {
            this.failed = true;
            console.warn('People: không tải được nhân vật', e);
        });
    },

    // Cỡ người theo khung: chừng 1/5 chiều cao màn hình, đứng trên dải bờ ở đáy, đầu (kể cả ô giơ cao) không vượt quá
    // chân trời
    layoutFor(cssW, cssH, level) {
        const horizonY = level * cssH;
        let Hp = Math.min(cssH * 0.22, cssW * 0.55);
        for (let i = 0; i < 2; i++) {
            const ppm = Hp / MAN_HEIGHT;
            const band = (EDGE * TILT + 0.3) * ppm;
            const gy = cssH - band + EDGE * TILT * ppm;
            Hp = Math.min(Hp, (gy - horizonY - 4) / 1.3);
        }
        Hp = Math.max(40, Hp);
        const ppm = Hp / MAN_HEIGHT;
        const edge = EDGE * TILT * ppm;
        const band = edge + 0.3 * ppm;
        this.layout = { cssW, cssH, ppm, top: cssH - band, gy: cssH - band + edge, cx: cssW / 2, halfW: cssW / 2 / ppm, horizonY };
    },

    // Chỗ pháo đang nổ: trung bình vị trí các hạt đang cháy (tọa độ pháo nhân hệ số thu phóng ra điểm ảnh CSS)
    trackFocus(dt, scale) {
        let n = 0;
        let sx = 0;
        let sy = 0;
        Object.keys(Star.active).forEach(color => {
            if (color === INVISIBLE || color === '_pool') return;
            const list = Star.active[color];
            for (let i = 0; i < list.length; i++) {
                sx += list[i].x;
                sy += list[i].y;
            }
            n += list.length;
        });
        const L = this.layout;
        const target = n > 6 ? { x: sx / n * scale, y: sy / n * scale } : { x: L.cssW * 0.5, y: L.horizonY * 0.5 };
        if (!this.focus.ready) {
            this.focus = { ...target, ready: true };
        } else {
            const k = 1 - Math.exp(-dt / (n > 6 ? 0.5 : 2.5));
            this.focus.x += (target.x - this.focus.x) * k;
            this.focus.y += (target.y - this.focus.y) * k;
        }
        this.burst = n > this.stars + 60;
        this.stars = n;
    },

    // dt: ms (đã nhân tốc độ mô phỏng); time: đồng hồ màn trình diễn (ms); scale: hệ số thu phóng
    update(dtMs, { time, scale = 1 }) {
        if (!this.show || !this.layout) return;
        const dt = Math.min(0.05, dtMs / 1000);
        if (!(dt > 0)) return;
        this.time += dt;
        this.trackFocus(dt, scale);
        const L = this.layout;
        const wind = (windAt(time) - 0.6) * 0.7 + 0.25;
        const focus = {
            x: (this.focus.x - L.cx) / L.ppm,
            pitch: 0.25 + 0.45 * clamp((L.horizonY - this.focus.y) / Math.max(1, L.horizonY), 0, 1)
        };
        const env = { wind, focus, time: this.time, burst: this.burst };
        this.show.update(dt, env);
        this.actors.forEach(a => {
            a.update(dt);
            this.placeUmbrella(a, dt);
        });
        this.effects(dt, env);
    },

    // Ô theo tay cầm: tay cầm chữ J ở lòng bàn tay (ô đã gập cầm ở thân ô), cán theo hướng choreo.js đặt
    placeUmbrella(a, dt) {
        const u = a.umbrella;
        if (!u) return;
        const side = a.umbrellaHand || 'right';
        const hand = a.worldOf(`${side}Hand`);
        const grip = a.bone(`${side}MiddleProximal`) ? hand.clone().lerp(a.worldOf(`${side}MiddleProximal`), 0.75) : hand;
        const dir = (a.umbrellaDir || hand.clone().set(0, 1, 0)).clone().normalize();
        if (a.umbrellaGrip) grip.addScaledVector(dir, -a.umbrellaGrip);
        u.group.visible = a.root.visible;
        u.place(grip, dir, dt);
    },

    // Nước nhỏ giọt từ ô, hạt mưa bắn trên tán ô và mặt đất, hơi thở trắng
    effects(dt, env) {
        const stage = this.stage;
        if (!stage || !stage.view) return;
        const weather = sceneWeather();
        const cold = sceneSeason() === 'winter' || weather === 'snow';
        const L = this.layout;
        this.actors.forEach((a, idx) => {
            const u = a.umbrella;
            if (u && a.root.visible && weather === 'rain' && u.open > 0.6) {
                // Hạt mưa đập lên tán ô bắn lên
                if (Math.random() < dt * 34) {
                    const tips = u.ribTips();
                    const p = stage.toScreen(u.apex().lerp(tips[(Math.random() * tips.length) | 0], Math.random() * 0.85));
                    this.splashes.push({ x: p[0], y: p[1], t: 0, life: 0.16 + Math.random() * 0.1, vy: -(20 + Math.random() * 30), vx: (Math.random() - 0.4) * 24 });
                }
                // Nước nhỏ giọt từ đầu nan
                if (Math.random() < dt * 4.5) {
                    const top = u.apex().y;
                    const tips = u.ribTips().filter(t => t.y < top - 0.04);
                    if (tips.length) {
                        const p = stage.toScreen(tips[(Math.random() * tips.length) | 0]);
                        this.drips.push({ x: p[0], y: p[1], vy: 10, floor: L.gy + (Math.random() - 0.3) * 0.08 * L.ppm });
                    }
                }
            }
            // Hơi thở trắng trong giá lạnh (thở dài thì hơi to hơn)
            a.breathT = (a.breathT ?? idx * 1.7) + dt;
            if (cold && a.root.visible && (a.breathT > 3.4 || a.sigh)) {
                const big = a.sigh ? 1.8 : 1;
                a.breathT = 0;
                a.sigh = 0;
                const head = a.worldOf('head');
                const fx = Math.sin(a.yaw + a.look.yaw);
                const fz = Math.cos(a.yaw + a.look.yaw);
                head.x += fx * 0.11;
                head.y -= 0.06;
                head.z -= fz * 0.11;
                this.puffs.push({ p: head, v: { x: fx * 0.12 + env.wind * 0.05, y: 0.06, z: -fz * 0.12 }, t: 0, life: 1.9 * big, big });
            }
        });
        // Mưa rơi xuống mặt đất quanh chỗ người đứng
        if (weather === 'rain' && Math.random() < dt * 26) {
            const x = L.cx + (Math.random() - 0.5) * Math.min(L.cssW, 4 * L.ppm);
            const y = L.top + 2 + Math.random() * (L.cssH - L.top - 3);
            this.splashes.push({ x, y, t: 0, life: 0.14, vy: -14, vx: 0, ground: true });
        }
        this.drips = this.drips.filter(d => {
            d.vy += 9.8 * L.ppm * dt;
            d.y += d.vy * dt;
            if (d.y >= d.floor) {
                this.splashes.push({ x: d.x, y: d.floor, t: 0, life: 0.14, vy: -12, vx: 0, ground: true });
                return false;
            }
            return true;
        });
        this.splashes = this.splashes.filter(s => (s.t += dt) < s.life);
        this.puffs = this.puffs.filter(p => {
            p.t += dt;
            p.p.x += p.v.x * dt;
            p.p.y += p.v.y * dt;
            p.p.z += p.v.z * dt;
            return p.t < p.life;
        });
    },

    // Khung bao (điểm ảnh CSS) của các nhân vật trên màn hình
    bounds() {
        const stage = this.stage;
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        this.actors.forEach(a => {
            if (!a.root.visible) return;
            const pts = ['head', 'leftHand', 'rightHand', 'leftFoot', 'rightFoot', 'hips', 'leftShoulder', 'rightShoulder'].map(b => a.worldOf(b));
            if (a.umbrella) pts.push(a.umbrella.apex(), ...a.umbrella.ribTips());
            pts.forEach(p => {
                const q = stage.toScreen(p);
                x0 = Math.min(x0, q[0]);
                y0 = Math.min(y0, q[1]);
                x1 = Math.max(x1, q[0]);
                y1 = Math.max(y1, q[1]);
            });
        });
        if (x0 === Infinity) return null;
        const m = 0.35 * this.layout.ppm;
        return [x0 - m, y0 - m, x1 + m, y1 + m * 0.4];
    },

    // sky: màu trời theo ánh pháo; bank: kiểu bờ bên kia (bờ bên này hợp theo); calm: giảm chớp sáng
    render(ctx, { sky, time, calm, bank }) {
        const { width: W, height: H } = ctx.canvas;
        const L = this.layout;
        if (!L) {
            if (this.drawn) {
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                ctx.clearRect(0, 0, W, H);
                this.drawn = false;
            }
            return;
        }
        this.drawn = true;
        const k = W / L.cssW;
        const wet = sceneWeather() === 'rain';
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.clearRect(0, 0, W, H);
        drawGround(ctx, { W, top: L.top, k, kind: groundKind(bank || ''), season: sceneSeason(), wet, sky, time, calm });
        const stage = this.stage;
        if (!this.show || !stage) return;
        // Chất lượng 480p trở xuống: dựng nhân vật thưa hơn cho máy yếu đỡ nặng
        stage.setView({ cssW: L.cssW, cssH: L.cssH, k: isLowQuality ? Math.min(k, 1) : k, cx: L.cx, gy: L.gy, ppm: L.ppm, tilt: TILT });
        stage.setLight(sky, (this.focus.x - L.cx) / L.ppm);
        stage.render();
        const box = this.bounds();
        if (!box) return;
        const I = clamp(Math.max(sky.r, sky.g, sky.b) / 30, 0, 1);
        const x0 = Math.max(0, Math.floor(box[0] * k));
        const y0 = Math.max(0, Math.floor(box[1] * k));
        const w = Math.min(W, Math.ceil(box[2] * k)) - x0;
        const h = Math.min(H, Math.ceil(box[3] * k)) - y0;
        if (w > 2 && h > 2) this.shadows(ctx, stage.canvas, x0, y0, w, h, k, I, wet);
        this.breath(ctx, k);
        ctx.drawImage(stage.canvas, 0, 0, W, H);
        this.front(ctx, k, sky, time, box);
    },

    // Bóng đổ trên mặt đất về phía người xem (thu nhỏ rồi phóng to cho nhòe), bóng tiếp đất dưới chân, đất ướt in bóng
    shadows(ctx, src, x0, y0, w, h, k, I, wet) {
        const L = this.layout;
        const top = Math.round(L.top * k);
        const gyk = L.gy * k;
        if (!this.mask) this.mask = document.createElement('canvas');
        if (!this.small) this.small = document.createElement('canvas');
        const m = fit(this.mask, w, h);
        const mg = m.getContext('2d');
        mg.setTransform(1, 0, 0, 1, 0, 0);
        mg.globalCompositeOperation = 'source-over';
        mg.clearRect(0, 0, m.width, m.height);
        mg.drawImage(src, x0, y0, w, h, 0, 0, w, h);
        mg.globalCompositeOperation = 'source-in';
        mg.fillStyle = '#000';
        mg.fillRect(0, 0, w, h);
        const sw = Math.max(2, Math.round(w / 5));
        const sh = Math.max(2, Math.round(h / 5));
        const sm = fit(this.small, sw, sh);
        const sg = sm.getContext('2d');
        sg.clearRect(0, 0, sm.width, sm.height);
        sg.drawImage(m, 0, 0, w, h, 0, 0, sw, sh);
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, top, ctx.canvas.width, ctx.canvas.height - top);
        ctx.clip();
        this.actors.forEach(a => {
            if (!a.root.visible) return;
            const p = this.stage.toScreen(a.worldOf('hips').setY(0));
            const rx = 0.32 * L.ppm * k;
            const ry = 0.07 * L.ppm * k;
            const cg = ctx.createRadialGradient(p[0] * k, p[1] * k, 0, p[0] * k, p[1] * k, rx);
            cg.addColorStop(0, 'rgba(0, 0, 0, 0.5)');
            cg.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.setTransform(1, 0, 0, ry / rx, 0, p[1] * k * (1 - ry / rx));
            ctx.fillStyle = cg;
            ctx.fillRect(p[0] * k - rx, p[1] * k - rx, rx * 2, rx * 2);
        });
        const q = 0.34;
        const skew = clamp((this.focus.x - (x0 + w / 2) / k) / (L.cssW * 0.5), -1, 1) * -0.5;
        ctx.setTransform(1, 0, -skew * q, -q, skew * q * gyk, gyk * (1 + q));
        ctx.globalAlpha = 0.16 + 0.34 * I;
        ctx.drawImage(sm, 0, 0, sw, sh, x0, y0, w, h);
        if (wet) {
            // Đất ướt: bóng người in ngược xuống mặt đất loáng nước
            ctx.setTransform(1, 0, 0, -1, 0, 2 * gyk);
            ctx.globalAlpha = 0.22;
            ctx.drawImage(src, x0, y0, w, h, x0, y0, w, h);
        }
        ctx.restore();
    },

    // Hơi thở trắng (vẽ trước lớp người: phần sau đầu bị che)
    breath(ctx, k) {
        if (!this.puffs.length) return;
        const L = this.layout;
        ctx.save();
        ctx.setTransform(k, 0, 0, k, 0, 0);
        this.puffs.forEach(p => {
            const u = p.t / p.life;
            const q = this.stage.toScreen(p.p);
            const r = (0.03 + u * 0.1 * p.big) * L.ppm;
            const grad = ctx.createRadialGradient(q[0], q[1], 0, q[0], q[1], r);
            const a = 0.22 * Math.sin(Math.PI * Math.min(1, u * 1.4)) * (1 - u) * p.big;
            grad.addColorStop(0, `rgba(225, 232, 245, ${a})`);
            grad.addColorStop(1, 'rgba(225, 232, 245, 0)');
            ctx.fillStyle = grad;
            ctx.fillRect(q[0] - r, q[1] - r, r * 2, r * 2);
        });
        ctx.restore();
    },

    // Mưa, tuyết rơi phía trước người (hạt gần trong lớp thời tiết vẽ lại đè lên người), hạt nước bắn, nước nhỏ giọt
    front(ctx, k, sky, time, box) {
        const L = this.layout;
        ctx.save();
        ctx.setTransform(k, 0, 0, k, 0, 0);
        const inside = (x, y) => x > box[0] - 30 && x < box[2] + 30 && y > box[1] - 40 && y < L.cssH;
        if (Weather.drops.length) {
            const wind = windAt(time);
            const slant = 0.1 + 0.09 * wind;
            const lift = Math.min(1, (sky.r + sky.g + sky.b) / 300);
            ctx.strokeStyle = `rgb(${Math.min(255, 165 + sky.r) | 0}, ${Math.min(255, 180 + sky.g) | 0}, ${Math.min(255, 210 + sky.b) | 0})`;
            ctx.lineCap = 'butt';
            [[0.55, 0.85, 0.85, 0.21], [0.85, 1.01, 1.25, 0.28]].forEach(([z0, z1, width, alpha]) => {
                ctx.beginPath();
                Weather.drops.forEach(d => {
                    if (d.z < z0 || d.z >= z1 || !inside(d.x, d.y)) return;
                    const len = 12 + d.z * 34;
                    ctx.moveTo(d.x, d.y);
                    ctx.lineTo(d.x - slant * len, d.y - len);
                });
                ctx.lineWidth = width;
                ctx.globalAlpha = alpha * (1 + lift);
                ctx.stroke();
            });
        }
        if (Weather.flakes.length) {
            const sprite = flakeSprite();
            Weather.flakes.forEach(f => {
                if (f.z < 0.6 || !inside(f.x, f.y)) return;
                const size = 0.8 + f.z * f.z * 4.6;
                ctx.globalAlpha = (0.35 + 0.6 * f.z) * f.fade;
                ctx.drawImage(sprite, f.x - size, f.y - size, size * 2, size * 2);
            });
        }
        ctx.globalAlpha = 1;
        if (this.drips.length) {
            ctx.strokeStyle = 'rgba(200, 215, 235, 0.65)';
            ctx.lineWidth = 0.9;
            ctx.beginPath();
            this.drips.forEach(d => {
                ctx.moveTo(d.x, d.y);
                ctx.lineTo(d.x, d.y - Math.min(5, 1 + d.vy * 0.012));
            });
            ctx.stroke();
        }
        this.splashes.forEach(s => {
            const u = s.t / s.life;
            ctx.globalAlpha = 0.55 * (1 - u);
            ctx.fillStyle = 'rgb(210, 222, 240)';
            const x = s.x + s.vx * s.t;
            const y = s.y + s.vy * s.t + 200 * s.t * s.t;
            if (s.ground) {
                ctx.fillRect(x - 1.2 - u * 1.5, s.y - u * 2, 0.8, 0.8);
                ctx.fillRect(x + 0.4 + u * 1.5, s.y - u * 2, 0.8, 0.8);
            } else {
                ctx.fillRect(x - 0.4, y - 0.4, 0.8, 0.8);
            }
        });
        ctx.globalAlpha = 1;
        ctx.restore();
    }
};
