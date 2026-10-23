/*!
 * Trình diễn Pháo hoa – trình phát: cảnh vật (người ngắm pháo)
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Người ngắm pháo bên bờ (kịch bản `people`: 'man' | 'woman' | 'couple', chỉ khi có mặt nước): nhân vật anime đứng
// trên bờ bên này ở đáy khung, quay lưng về phía người xem, nhìn ra mặt nước. Tắt bờ bên này (`nearBank: false`) thì
// người ở bờ bên kia: nhỏ theo tỉ lệ xa, đi dọc bờ vào giữa; bờ có cầu (cầu vòm, cầu nhiều vòm) thì đi lên giữa cầu theo
// độ vồng của mặt cầu, lan can phía trước che phần dưới người. Biển khơi không có bờ bên kia nên vẫn đứng bờ bên này. Vẽ trên lớp riêng phía trên các lớp pháo
// (ghép bình thường, không "lighten") nên che được ánh pháo, bóng pháo dưới nước. Phần dựng hình nhân vật (three.js,
// mô hình, biên đạo) tải riêng khi kịch bản có người (stage3d.js); trong lúc tải chỉ có bờ đất.
// Ngoài nhân vật: bóng đổ về phía người xem trên mặt đất (pháo ở trước mặt họ), trời mưa đất ướt in bóng người; hạt mưa
// gần rơi trước người, hạt mưa đập lên tán ô bắn tung, nước nhỏ giọt từ đầu nan; mùa đông, tuyết: hơi thở trắng.

import { horizon, isLowQuality, season as sceneSeason, weather as sceneWeather } from '../../state.js';
import { INVISIBLE } from '../../env.js';
import { Star } from '../../particles.js';
import { makeCanvas } from '../../utils.js';
import { Weather } from '../weather.js';
import { bankStyle } from '../bank.js';
import { skylineCache } from '../skylines.js';
import { drawGround, groundKind } from './ground.js';
import { PEOPLE_MIDDLE, peoplePlan } from '../../people-options.js';

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
    // 480p trở xuống: khung này bỏ qua (giữ hình khung trước), thời gian dồn sang khung sau
    skip: false,
    lagMs: 0,
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
    prepare(kind, season, weather) {
        if (!kind || this.failed) return Promise.resolve();
        return this.load().then(mod => mod && this.stage.prepare(this.castOf(kind), season, weather)).catch(() => {});
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

    // kind: '' | 'man' | 'woman' | 'couple'; near: có bờ bên này (tắt thì người ở bờ bên kia); plan: cách đi vào (chỗ bắt
    // đầu, ai đến trước, đợi bao lâu: peoplePlan trong people-options.js). Đổi người, chỗ đứng, cách đi vào, mùa hoặc thời
    // tiết (mưa, tuyết, tạnh) thì dựng lại (đi vào từ đầu)
    sync(kind, cssW, cssH, near = true, plan = peoplePlan()) {
        const level = horizon();
        if (level >= 1 || !kind || !cssW || !cssH || this.failed) {
            this.show = null;
            this.actors = [];
            this.key = '';
            this.layout = null;
            return;
        }
        // Trời mưa thì che ô; tuyết rơi không ướt như mưa, đội mũ len (outfit3d.js), không che ô
        const umbrella = sceneWeather() === 'rain';
        const far = !near && bankStyle !== 'none';
        if (far) this.farLayout(cssW, cssH, level);
        else this.layoutFor(cssW, cssH, level);
        const key = `${kind}_${sceneSeason()}_${sceneWeather()}_${umbrella}_${far ? `far_${bankStyle}` : 'near'}_${plan.start.m}_${plan.start.f}_${plan.first}_${plan.wait}`;
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
            return this.stage.cast(this.castOf(kind), sceneSeason(), sceneWeather()).then(actors => {
                if (this.token !== token) return null;
                if (umbrella) {
                    actors.forEach(a => {
                        this.stage.umbrellaFor(a, a.sex);
                        a.umbrellaHand = a.sex === 'm' ? 'right' : 'left';
                        a.umbrellaGrip = 0;
                    });
                }
                // Dịch sẵn shader rồi mới cho người bước vào
                return this.stage.warm().then(() => actors);
            }).then(actors => {
                if (!actors || this.token !== token || !this.layout) return;
                const halfW = this.layout.halfW;
                this.actors = actors;
                this.time = 0;
                // Chỗ bắt đầu (phần trăm bề ngang) ra mét tính từ giữa: bờ bên này 0, 100 là ngoài hai mép khung; bờ bên kia
                // là hai đầu cầu (hoặc cách giữa bờ ít bước), hiện dần, cùng đến thì tới cùng lúc
                const deck = far ? this.deck() : null;
                const reach = far ? (deck ? Math.min(12, Math.max(4, (deck.to - deck.from) / 2 / this.layout.ppm + 1.2)) : 7) : halfW;
                const at = p => ({
                    x: p === 0 ? -(far ? reach : halfW + 0.9) : p === 100 ? (far ? reach : halfW + 0.9) : (p / PEOPLE_MIDDLE - 1) * reach,
                    edge: p === 0 || p === 100,
                    stand: p === PEOPLE_MIDDLE
                });
                const from = { m: at(plan.start.m), f: at(plan.start.f) };
                this.show = kind === 'couple'
                    ? new mod.Duo(actors[0], actors[1], { halfW, umbrella, from, first: plan.first, wait: plan.wait, together: far })
                    : new mod.Solo(actors[0], { halfW, umbrella, from: from[actors[0].sex] });
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

    // Bờ bên kia: người nhỏ theo tỉ lệ xa (cỡ lan can cầu, cột đèn), chân đứng trên chân trời (mặt bờ)
    farLayout(cssW, cssH, level) {
        const horizonY = level * cssH;
        const sz = Math.max(0.6, Math.min(1.25, Math.min(horizonY / 420, cssW / 700)));
        const ppm = 19 * sz / MAN_HEIGHT;
        this.layout = { far: true, cssW, cssH, ppm, top: cssH, gy: horizonY, cx: cssW / 2, halfW: cssW / 2 / ppm, horizonY };
    },

    // Mặt cầu của kiểu bờ đang vẽ (cầu vòm, cầu nhiều vòm): { at(x): độ cao so với chân trời (âm là lên trên), from, to:
    // đoạn có lan can, rail: lan can cao bao nhiêu } (điểm ảnh CSS), không có cầu thì null
    deck() {
        const c = skylineCache;
        return c && c.style === bankStyle && c.data && c.data.deck ? c.data.deck : null;
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
        // Chất lượng 480p trở xuống: cử động và dựng người cách một khung hình như mặt nước (máy yếu: three.js, vật lý tóc
        // chiếm tới nửa công mỗi khung dù vẽ thưa), bước thời gian gộp cả hai khung
        this.skip = isLowQuality && !this.skip;
        if (this.skip) {
            if (dtMs > 0) this.lagMs += dtMs;
            return;
        }
        dtMs += this.lagMs;
        this.lagMs = 0;
        if (!this.show || !this.layout) return;
        const dt = Math.min(isLowQuality ? 0.1 : 0.05, dtMs / 1000);
        if (!(dt > 0)) return;
        this.time += dt;
        this.trackFocus(dt, scale);
        const L = this.layout;
        const wind = (windAt(time) - 0.6) * 0.7 + 0.25;
        const up = clamp((L.horizonY - this.focus.y) / Math.max(1, L.horizonY), 0, 1);
        const focus = {
            x: (this.focus.x - L.cx) / L.ppm,
            // Ở bờ bên kia pháo nổ ngay trên đầu: ngẩng cao hơn
            pitch: L.far ? 0.55 + 0.3 * up : 0.25 + 0.45 * up
        };
        const env = { wind, focus, time: this.time, burst: this.burst };
        this.show.update(dt, env);
        const deck = L.far ? this.deck() : null;
        this.actors.forEach(a => {
            // Trên cầu: đứng theo độ vồng của mặt cầu
            a.y = deck ? Math.max(0, -deck.at(L.cx + a.x * L.ppm) / L.ppm) : 0;
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
        if (weather === 'rain' && !L.far && Math.random() < dt * 26) {
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
        if (this.skip && this.drawn) return;
        this.drawn = true;
        const k = W / L.cssW;
        const wet = sceneWeather() === 'rain';
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.clearRect(0, 0, W, H);
        if (!L.far) drawGround(ctx, { W, top: L.top, k, kind: groundKind(bank || ''), season: sceneSeason(), wet, sky, time, calm });
        const stage = this.stage;
        if (!this.show || !stage) return;
        // Chất lượng 480p trở xuống: dựng nhân vật thưa hơn cho máy yếu đỡ nặng. Bờ bên kia: nhìn gần như ngang
        stage.setView({ cssW: L.cssW, cssH: L.cssH, k: isLowQuality ? Math.min(k, 1) : k, cx: L.cx, gy: L.gy, ppm: L.ppm, tilt: L.far ? 0.08 : TILT });
        stage.setLight(sky, (this.focus.x - L.cx) / L.ppm);
        const box = this.bounds();
        if (!box) return;
        const I = clamp(Math.max(sky.r, sky.g, sky.b) / 30, 0, 1);
        const x0 = Math.max(0, Math.floor(box[0] * k));
        const y0 = Math.max(0, Math.floor(box[1] * k));
        const w = Math.min(W, Math.ceil(box[2] * k)) - x0;
        const h = Math.min(H, Math.ceil(box[3] * k)) - y0;
        if (w <= 2 || h <= 2) return;
        // Chỉ dựng vùng quanh nhân vật (chất lượng thấp thì lớp dựng hình thưa hơn lớp này), vùng đó nằm ở góc trên trái
        // lớp dựng hình
        const r = stage.size.k / k;
        const sx = Math.floor(x0 * r);
        const sy = Math.floor(y0 * r);
        stage.render(sx, sy, Math.ceil((x0 + w) * r) - sx, Math.ceil((y0 + h) * r) - sy);
        const src = [x0 * r - sx, y0 * r - sy, Math.max(1, w * r), Math.max(1, h * r)];
        if (L.far) {
            this.farFigures(ctx, stage.canvas, src, x0, y0, w, h, k);
            return;
        }
        this.shadows(ctx, stage.canvas, src, x0, y0, w, h, k, I, wet);
        this.breath(ctx, k);
        // Chỉ chép vùng quanh nhân vật
        ctx.drawImage(stage.canvas, ...src, x0, y0, w, h);
        this.front(ctx, k, sky, time, box);
    },

    // Người ở bờ bên kia: hiện dần lúc mới bước vào; trên cầu thì lan can phía trước che phần dưới người (cắt bỏ phần nằm
    // dưới mép trên lan can, để lộ lan can vẽ ở lớp bầu trời)
    farFigures(ctx, canvas, src, x0, y0, w, h, k) {
        const L = this.layout;
        const deck = this.deck();
        ctx.save();
        if (deck) {
            ctx.setTransform(k, 0, 0, k, 0, 0);
            const clip = new Path2D();
            clip.rect(0, 0, L.cssW, L.cssH);
            const line = x => L.horizonY + deck.at(x) - deck.rail;
            clip.moveTo(deck.from, line(deck.from));
            for (let x = deck.from; x <= deck.to; x += 2) clip.lineTo(x, line(x));
            clip.lineTo(deck.to, line(deck.to));
            clip.lineTo(deck.to, L.cssH);
            clip.lineTo(deck.from, L.cssH);
            clip.closePath();
            ctx.clip(clip, 'evenodd');
            ctx.setTransform(1, 0, 0, 1, 0, 0);
        }
        ctx.globalAlpha = clamp(this.time / 1.2, 0, 1);
        ctx.drawImage(canvas, ...src, x0, y0, w, h);
        ctx.restore();
    },

    // Bóng đổ trên mặt đất về phía người xem (thu nhỏ rồi phóng to cho nhòe), bóng tiếp đất dưới chân, đất ướt in bóng
    shadows(ctx, canvas, src, x0, y0, w, h, k, I, wet) {
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
        mg.drawImage(canvas, ...src, 0, 0, w, h);
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
            ctx.drawImage(canvas, ...src, x0, y0, w, h);
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
