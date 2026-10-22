/*!
 * Trình diễn Pháo hoa – trình phát: cảnh vật (bầu trời sao)
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Bầu trời sao như ngoài đời: hàng nghìn sao mờ và Dải Ngân Hà (lõi sáng ấm ở thấp, dải bụi tối chạy giữa, đám sao dày
// đặc) vẽ sẵn một lần, dựng dần lúc máy rảnh rồi hiện dần; vài chục tới hơn trăm sao sáng vẽ mỗi khung, lấp lánh nhanh như
// sao thật (sát chân trời nhấp nháy mạnh, sao sáng còn chớp đổi sắc đỏ xanh). Màu sao theo nhiệt độ (xanh trắng tới cam
// đỏ), sao mờ nhiều hơn hẳn sao sáng; sát chân trời sao mờ đi vì lớp khí quyển dày. Sao băng lẻ tẻ hoặc mưa sao băng tỏa
// ra từ một điểm (gần điểm tỏa thì ngắn, chậm), thỉnh thoảng một thiên thạch lửa vỡ tóe rồi để lại vệt khói sáng mờ;
// thỉnh thoảng một vệ tinh lặng lẽ trôi qua. Tọa độ điểm ảnh CSS, gốc ở đỉnh khung.

import { makeCanvas } from '../utils.js';
import { fbm, makeNoise, rand, smooth01 } from './util.js';

// Màu sao theo nhiệt độ: [r, g, b, tỉ lệ gặp]
const STAR_TINTS = [
    [170, 191, 255, 0.1],
    [214, 224, 255, 0.28],
    [255, 246, 234, 0.3],
    [255, 232, 196, 0.18],
    [255, 207, 160, 0.1],
    [255, 182, 142, 0.04]
];

// Số sao trên khung 1920×1000 (khung khác tính theo diện tích): sao mờ vẽ sẵn, sao sáng vẽ mỗi khung
const DENSITY = {
    few: { faint: 420, bright: 45 },
    many: { faint: 1200, bright: 110 }
};

// Dải Ngân Hà: độ sáng của quầng, số sao trong dải
const MILKY_WAY = {
    faint: { glow: 0.26, stars: 4500 },
    bright: { glow: 0.46, stars: 9000 }
};

// Khoảng cách giữa hai sao băng (ms)
const METEOR_GAP = {
    few: [5000, 14000],
    shower: [450, 2600]
};

// Màu sao băng (đầu sao): trắng, xanh lục (magiê), vàng cam (natri), xanh trắng
const METEOR_TINTS = ['255, 255, 255', '255, 255, 255', '190, 255, 205', '255, 222, 165', '200, 215, 255'];

// Thời gian dựng lớp sao mờ, Ngân Hà mỗi khung (ms) và thời gian hiện dần khi dựng xong
const BUILD_BUDGET = 6;
const FADE_IN = 1500;

const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);

function pickTint() {
    let r = Math.random();
    for (let i = 0; i < STAR_TINTS.length; i++) {
        r -= STAR_TINTS[i][3];
        if (r <= 0) return i;
    }
    return 2;
}

const tintRgb = i => `${STAR_TINTS[i][0]}, ${STAR_TINTS[i][1]}, ${STAR_TINTS[i][2]}`;

// Đốm sao (lõi gần trắng, quầng theo màu sao) vẽ sẵn theo màu và độ nét khung; 24 điểm ảnh CSS
const SPRITE_CSS = 24;
const starSprites = new Map();

function starSprite(rgb, k) {
    const key = `${rgb}|${k}`;
    let sprite = starSprites.get(key);
    if (sprite) return sprite;
    const size = Math.max(8, Math.ceil(SPRITE_CSS * k));
    const [c, g] = makeCanvas(size, size);
    const r = size / 2;
    const [cr, cg, cb] = rgb.split(',').map(Number);
    const core = `${Math.round(cr + (255 - cr) * 0.7)}, ${Math.round(cg + (255 - cg) * 0.7)}, ${Math.round(cb + (255 - cb) * 0.7)}`;
    const grad = g.createRadialGradient(r, r, 0, r, r, r);
    grad.addColorStop(0, `rgba(${core}, 1)`);
    grad.addColorStop(0.05, `rgba(${core}, 0.9)`);
    grad.addColorStop(0.1, `rgba(${rgb}, 0.42)`);
    grad.addColorStop(0.22, `rgba(${rgb}, 0.1)`);
    grad.addColorStop(0.5, `rgba(${rgb}, 0.025)`);
    grad.addColorStop(1, `rgba(${rgb}, 0)`);
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    if (starSprites.size > 40) starSprites.clear();
    starSprites.set(key, c);
    return c;
}

export class NightSky {
    // width, height: phần trời có sao (điểm ảnh CSS, đáy là chân trời); stars: '' | 'few' | 'many'; milkyWay: '' |
    // 'faint' | 'bright'; meteors: '' | 'few' | 'shower'
    static key({ width, height, stars, milkyWay, meteors }) {
        return JSON.stringify([Math.round(width), Math.round(height), stars || '', milkyWay || '', meteors || '']);
    }

    // Cùng bầu trời như trước (đổi mục khác của cảnh) thì giữ nguyên, không rải lại sao, dựng lại Ngân Hà
    static reuse(prev, options) {
        return prev && prev.key === NightSky.key(options) ? prev : new NightSky(options);
    }

    constructor(options) {
        const { width, height, stars, milkyWay, meteors } = options;
        this.key = NightSky.key(options);
        this.width = width;
        this.height = height;
        this.milky = MILKY_WAY[milkyWay] || null;
        this.meteorMode = METEOR_GAP[meteors] ? meteors : '';
        // Ngân Hà luôn có nền sao mờ đi kèm
        const density = DENSITY[stars] || (this.milky ? DENSITY.few : null);
        const area = Math.min(2.2, Math.max(0.2, (width * height) / (1920 * 1000)));
        this.faintCount = density ? Math.round(density.faint * area) : 0;
        this.bright = density ? this.makeBrightStars(Math.round(density.bright * Math.sqrt(area))) : [];
        this.band = this.milky ? this.makeBand() : null;
        // Lớp vẽ sẵn: rộng hơn khung một chút (bầu trời quay chậm, sao trôi theo)
        this.margin = Math.round(width * 0.03);
        this.pad = Math.round(height * 0.04);
        this.layer = null;
        this.layerK = 0;
        this.job = null;
        this.shownAt = 0;
        this.time = 0;
        this.meteors = [];
        this.trains = [];
        this.radiant = { x: rand(0.2, 0.8) * width, y: rand(-0.15, 0.2) * height };
        this.nextMeteor = this.meteorMode ? rand(1200, 5000) : Infinity;
        this.satellite = null;
        this.nextSatellite = density ? rand(12000, 40000) : Infinity;
    }

    makeBrightStars(count) {
        const stars = [];
        for (let i = 0; i < count; i++) {
            const tint = pickTint();
            stars.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                // Sao mờ nhiều, sao rất sáng hiếm
                b: 0.3 + 0.7 * Math.pow(Math.random(), 2.4),
                rgb: tintRgb(tint),
                // Lấp lánh: một nhịp thở chậm, hai nhịp nhanh (không khí xáo động), nhịp đổi sắc
                p: [rand(0, 7), rand(0, 7), rand(0, 7), rand(0, 7)],
                w: [rand(0.3, 0.8), rand(2.5, 5), rand(6, 11), rand(3, 7)].map(hz => hz * Math.PI * 2 / 1000)
            });
        }
        // Vài sao sáng nhất có tia sáng mảnh
        stars.sort((a, b) => b.b - a.b).slice(0, 3).forEach(star => {
            star.b = Math.max(star.b, 0.92);
            star.rays = true;
        });
        return stars;
    }

    // Dải Ngân Hà: một dải chéo hơi cong vắt qua trời, lõi (phần sáng, phình to, ngả vàng) ở thấp gần chân trời
    makeBand() {
        const w = this.width;
        const h = this.height;
        const L = Math.hypot(w, h);
        const lean = Math.random() < 0.5 ? -1 : 1;
        const angle = rand(52, 74) * Math.PI / 180;
        const dir = [Math.cos(angle) * lean, -Math.sin(angle)];
        const seed = (Math.random() * 1e6) | 0;
        return {
            x0: rand(0.3, 0.7) * w, y0: h * 0.95, dir, normal: [-dir[1], dir[0]], L,
            half: Math.max(34, 0.062 * L), bow: rand(-0.12, 0.12), lane: rand(-0.3, 0.3),
            noise: makeNoise(seed % 997 + 3), noise2: makeNoise(seed % 991 + 7),
            // Tinh vân phát xạ hồng nhạt lấm tấm quanh lõi
            nebulae: Array.from({ length: 3 }, () => ({ u: rand(0.04, 0.22), v: rand(-0.5, 0.5), r: rand(6, 14) }))
        };
    }

    // Mật độ Ngân Hà ở (x, y) (0 tới ~1,4) và độ gần lõi (0-1)
    bandAt(x, y) {
        const b = this.band;
        const px = x - b.x0;
        const py = y - b.y0;
        const u = px * b.dir[0] + py * b.dir[1];
        const v = px * b.normal[0] + py * b.normal[1] - b.bow * u * u / b.L;
        const core = Math.exp(-((u / (0.24 * b.L)) ** 2));
        const half = b.half * (1 + 0.55 * core);
        const profile = Math.exp(-2 * (v / half) ** 2);
        if (profile < 0.004) return [0, core];
        // Đám sao lớn (vừa phải, kẻo thành mây bông), hạt mịn, lấm tấm nhỏ
        const clumps = clamp01((fbm(b.noise, x / 110, y / 110, 4) - 0.28) / 0.44);
        const grain = clamp01((fbm(b.noise2, x / 22, y / 22, 3) - 0.28) / 0.44);
        const fine = b.noise(x / 9 + 31, y / 9 + 13);
        let d = profile * (0.5 + 0.9 * core) * (0.55 + 0.45 * clumps) * (0.55 + 0.7 * grain) * (0.8 + 0.4 * fine);
        // Dải bụi tối chạy dọc giữa (từ lõi lên), và những đám bụi tối lốm đốm
        const lane = Math.exp(-(((v - b.lane * half) / (0.16 * half)) ** 2)) * smooth01(-0.05 * b.L, 0.12 * b.L, u)
            * (0.45 + 0.55 * fbm(b.noise, x / 50 + 9, y / 50 + 4, 3));
        const dark = smooth01(0.48, 0.62, fbm(b.noise2, x / 60 + 17, y / 60 + 5, 4));
        d *= (1 - 0.9 * lane) * (1 - 0.6 * dark);
        return [d, core];
    }

    // Sát chân trời sao mờ dần (lớp khí quyển dày)
    extinction(y) {
        return Math.pow(clamp01((this.height - y) / (this.height * 0.13)), 1.3);
    }

    // Dựng lớp vẽ sẵn từng phần (generator): quầng Ngân Hà, sao mờ khắp trời, sao dày đặc trong dải
    *build(k) {
        const { width: w, height: h, margin: m, pad } = this;
        const [canvas, g] = makeCanvas(Math.ceil((w + 2 * m) * k), Math.ceil((h + pad) * k));
        g.setTransform(k, 0, 0, k, m * k, pad * k);
        if (this.band) {
            const cell = 3;
            const gw = Math.ceil((w + 2 * m) / cell);
            const gh = Math.ceil((h + pad) / cell);
            const [gc, gg] = makeCanvas(gw, gh);
            const img = gg.createImageData(gw, gh);
            const glow = this.milky.glow;
            for (let j = 0; j < gh; j++) {
                const y = j * cell - pad + cell / 2;
                const ext = this.extinction(y);
                for (let i = 0; i < gw; i++) {
                    if (ext <= 0) break;
                    const [d, core] = this.bandAt(i * cell - m + cell / 2, y);
                    if (d <= 0) continue;
                    const a = clamp01(d * glow * ext);
                    const warm = core * 0.85;
                    const o = (j * gw + i) * 4;
                    img.data[o] = 172 + (255 - 172) * warm;
                    img.data[o + 1] = 186 + (226 - 186) * warm;
                    img.data[o + 2] = 232 + (186 - 232) * warm;
                    img.data[o + 3] = a * 255;
                }
                if (j % 4 === 3) yield;
            }
            gg.putImageData(img, 0, 0);
            g.imageSmoothingEnabled = true;
            g.imageSmoothingQuality = 'high';
            g.drawImage(gc, -m, -pad, gw * cell, gh * cell);
            // Tinh vân hồng nhạt quanh lõi
            const b = this.band;
            g.globalCompositeOperation = 'lighter';
            b.nebulae.forEach(n => {
                const x = b.x0 + b.dir[0] * n.u * b.L + b.normal[0] * n.v * b.half;
                const y = b.y0 + b.dir[1] * n.u * b.L + b.normal[1] * n.v * b.half;
                const grad = g.createRadialGradient(x, y, 0, x, y, n.r);
                grad.addColorStop(0, `rgba(255, 120, 150, ${0.16 * glow * this.extinction(y)})`);
                grad.addColorStop(1, 'rgba(255, 120, 150, 0)');
                g.fillStyle = grad;
                g.fillRect(x - n.r, y - n.r, n.r * 2, n.r * 2);
            });
            g.globalCompositeOperation = 'source-over';
            yield;
        }
        // Sao mờ: theo màu thành từng nhóm cho ít lần đổi màu vẽ
        const groups = STAR_TINTS.map(() => []);
        for (let i = 0; i < this.faintCount; i++) {
            groups[pickTint()].push([rand(-m, w + m), rand(-pad, h), 0.1 + 0.55 * Math.pow(Math.random(), 1.8), rand(0.45, 1.05)]);
        }
        if (this.band) {
            // Sao trong dải: rải đều rồi giữ lại theo mật độ (dải sáng, lõi nhiều sao, dải bụi tối ít sao)
            let kept = 0;
            for (let tries = 0; kept < this.milky.stars && tries < this.milky.stars * 8; tries++) {
                const x = rand(-m, w + m);
                const y = rand(-pad, h);
                const [d, core] = this.bandAt(x, y);
                if (Math.random() * 1.2 > d) continue;
                kept++;
                const tint = core > 0.5 && Math.random() < 0.5 ? 3 : pickTint();
                groups[tint].push([x, y, 0.06 + 0.5 * Math.pow(Math.random(), 2), rand(0.35, 0.85)]);
                if (kept % 800 === 0) yield;
            }
        }
        let drawn = 0;
        for (let t = 0; t < groups.length; t++) {
            g.fillStyle = `rgb(${tintRgb(t)})`;
            for (const [x, y, a, s] of groups[t]) {
                g.globalAlpha = a * this.extinction(y);
                g.fillRect(x - s / 2, y - s / 2, s, s);
                if (++drawn % 1500 === 0) yield;
            }
        }
        g.globalAlpha = 1;
        this.layer = canvas;
        this.layerK = k;
    }

    // Dựng tiếp lớp vẽ sẵn trong giới hạn thời gian của khung này; độ nét cao hơn lớp đang có thì dựng lại
    pump(k) {
        if (!this.faintCount && !this.band) return;
        if (!this.job && (!this.layer || k > this.layerK + 0.01)) this.job = this.build(k);
        if (!this.job) return;
        const until = performance.now() + BUILD_BUDGET;
        while (performance.now() < until) {
            if (this.job.next().done) {
                this.job = null;
                if (!this.shownAt) this.shownAt = this.time || 1;
                break;
            }
        }
    }

    update(dt) {
        this.time += dt;
        if (this.meteorMode) {
            this.nextMeteor -= dt;
            if (this.nextMeteor <= 0) {
                const [a, b] = METEOR_GAP[this.meteorMode];
                this.nextMeteor = rand(a, b);
                this.spawnMeteor();
                // Mưa sao băng: có lúc hai ba sao vụt qua gần như cùng lúc
                if (this.meteorMode === 'shower' && Math.random() < 0.18) this.nextMeteor = rand(80, 300);
            }
        }
        this.meteors.forEach(m => this.moveMeteor(m, dt));
        this.meteors = this.meteors.filter(m => !m.done);
        this.trains.forEach(t => { t.age += dt; });
        this.trains = this.trains.filter(t => t.age < t.life);
        this.nextSatellite -= dt;
        if (this.nextSatellite <= 0 && !this.satellite) this.spawnSatellite();
        if (this.satellite) {
            const s = this.satellite;
            s.t += dt;
            if (s.t >= s.life) {
                this.satellite = null;
                this.nextSatellite = rand(30000, 80000);
            }
        }
    }

    spawnMeteor() {
        const w = this.width;
        const h = this.height;
        const shower = this.meteorMode === 'shower';
        const fireball = Math.random() < (shower ? 0.05 : 0.1);
        const x = rand(0.05, 0.95) * w;
        const y = rand(0.04, 0.6) * h;
        let dx;
        let dy;
        let speed = rand(0.45, 1);
        if (shower) {
            dx = x - this.radiant.x;
            dy = y - this.radiant.y;
            const dist = Math.hypot(dx, dy) || 1;
            dx /= dist;
            dy /= dist;
            // Gần điểm tỏa: sao băng bay gần như hướng về phía người xem nên trông ngắn và chậm
            speed *= Math.min(1, 0.3 + dist / (0.45 * Math.hypot(w, h)));
        } else {
            const angle = rand(15, 65) * Math.PI / 180;
            const side = Math.random() < 0.5 ? -1 : 1;
            dx = Math.cos(angle) * side;
            dy = Math.sin(angle);
        }
        this.meteors.push({
            x, y, hx: x, hy: y, dx, dy, speed: fireball ? speed * 0.75 : speed, t: 0,
            life: fireball ? rand(1300, 2200) : rand(320, 900),
            tail: fireball ? rand(140, 220) : rand(70, 140),
            width: fireball ? rand(1.8, 2.6) : rand(0.8, 1.5),
            b: fireball ? 1 : 0.4 + 0.6 * Math.pow(Math.random(), 0.7),
            rgb: METEOR_TINTS[(Math.random() * METEOR_TINTS.length) | 0],
            // Lúc bùng sáng (phần thời gian), thiên thạch lửa vỡ tóe
            flare: fireball ? rand(0.55, 0.85) : Math.random() < 0.3 ? rand(0.5, 0.9) : -1,
            fireball, sparks: [], train: fireball ? [] : null, trainIn: 0
        });
    }

    moveMeteor(m, dt) {
        m.t += dt;
        m.hx = m.x + m.dx * m.speed * m.t;
        m.hy = m.y + m.dy * m.speed * m.t;
        const p = m.t / m.life;
        if (m.fireball && p > m.flare && !m.burst) {
            m.burst = true;
            for (let i = 0; i < 8; i++) {
                m.sparks.push({ x: m.hx, y: m.hy, vx: m.dx * m.speed * rand(0.3, 0.8) + rand(-0.06, 0.06), vy: m.dy * m.speed * rand(0.3, 0.8) + rand(-0.06, 0.06), t: 0, life: rand(250, 650) });
            }
        }
        m.sparks.forEach(s => {
            s.t += dt;
            s.x += s.vx * dt;
            s.y += s.vy * dt;
        });
        m.sparks = m.sparks.filter(s => s.t < s.life);
        if (m.train && p < 1) {
            m.trainIn -= dt;
            if (m.trainIn <= 0) {
                m.trainIn = 30;
                m.train.push([m.hx, m.hy]);
            }
        }
        const out = m.hy > this.height || m.hx < -40 || m.hx > this.width + 40 || m.hy < -40;
        if ((p >= 1 || out) && !m.sparks.length) {
            m.done = true;
            if (m.train && m.train.length > 2) this.trains.push({ points: m.train, age: 0, life: rand(2500, 4500), rgb: '190, 230, 215' });
        }
    }

    spawnSatellite() {
        const w = this.width;
        const h = this.height;
        const from = Math.random() < 0.5 ? -1 : 1;
        const x = from < 0 ? rand(-0.05, 0.3) * w : rand(0.7, 1.05) * w;
        const y = rand(0.05, 0.5) * h;
        const life = rand(22000, 38000);
        const dist = rand(0.35, 0.6) * w;
        const angle = rand(-0.35, 0.35);
        this.satellite = {
            x, y, vx: -from * Math.cos(angle) * dist / life, vy: Math.sin(angle) * dist / life, t: 0, life,
            b: rand(0.35, 0.6), flare: Math.random() < 0.15 ? rand(0.3, 0.7) : -1
        };
    }

    // Lớp nền: quầng Ngân Hà, sao mờ (vẽ trước ánh trăng: trăng sáng làm chúng chìm đi như ngoài đời)
    drawBackdrop(ctx, k, drift) {
        this.pump(k);
        if (!this.layer || !this.shownAt) return;
        const fade = clamp01((this.time - this.shownAt) / FADE_IN);
        if (fade <= 0) return;
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = fade;
        // Dán đúng lưới điểm ảnh thật, đúng cỡ lớp đã dựng (độ nét layerK): bầu trời trôi chậm nên vị trí thường lẻ, cỡ khung
        // nhân k cũng lẻ (vd 444 × 2,625); lệch như vậy thì từng sao mờ 1 điểm ảnh loang ra 2×2 điểm, nhạt và nhòe đi
        const x = Math.round((drift.x * 0.6 - this.margin) * k) / k;
        const y = Math.round((drift.y * 0.6 - this.pad) * k) / k;
        ctx.drawImage(this.layer, x, y, this.layer.width / this.layerK, this.layer.height / this.layerK);
        ctx.globalAlpha = 1;
    }

    // Sao sáng, vệ tinh, sao băng. light: ánh trăng (0-1); moon: { x, y, glare } chỗ trăng (sao gần trăng bị lấn mất);
    // calm: giảm chớp sáng (sao không lấp lánh, sao băng không bùng sáng)
    draw(ctx, k, { drift, light = 0, moon = null, calm = false }) {
        const t = this.time;
        const w = this.width;
        const h = this.height;
        const dim = 1 - 0.6 * light;
        ctx.globalCompositeOperation = 'lighter';
        this.bright.forEach(star => {
            const x = (star.x + drift.x * 0.6 + w * 2) % w;
            const y = star.y + drift.y * 0.6;
            const ext = this.extinction(y);
            if (ext <= 0) return;
            const low = clamp01((y / h - 0.5) / 0.5);
            const [p0, p1, p2, p3] = star.p;
            const [w0, w1, w2, w3] = star.w;
            const twinkle = calm ? 1 : 1 + 0.1 * Math.sin(t * w0 + p0)
                + (0.06 + 0.3 * low) * (0.55 * Math.sin(t * w1 + p1) + 0.45 * Math.sin(t * w2 + p2));
            const lost = moon ? light * Math.exp(-((x - moon.x) ** 2 + (y - moon.y) ** 2) / (moon.glare * moon.glare)) : 0;
            const a = star.b * twinkle * ext * dim * (1 - 0.95 * lost);
            if (a <= 0.01) return;
            const size = SPRITE_CSS * (0.45 + 0.65 * star.b);
            ctx.globalAlpha = clamp01(a);
            ctx.drawImage(starSprite(star.rgb, k), x - size / 2, y - size / 2, size, size);
            // Sao sáng sát chân trời: chớp đổi sắc đỏ, xanh
            if (!calm && star.b > 0.7 && low > 0.35) {
                const hue = Math.sin(t * w3 + p3);
                ctx.globalAlpha = clamp01(Math.abs(hue) * low * 0.45 * a);
                ctx.drawImage(starSprite(hue > 0 ? '255, 90, 80' : '90, 140, 255', k), x - size / 2, y - size / 2, size, size);
            }
            if (star.rays) {
                const len = 4 + 5 * star.b;
                ctx.globalAlpha = clamp01(a * 0.22);
                ctx.fillStyle = `rgb(${star.rgb})`;
                ctx.fillRect(x - len, y - 0.25, len * 2, 0.5);
                ctx.fillRect(x - 0.25, y - len, 0.5, len * 2);
            }
        });

        const sat = this.satellite;
        if (sat) {
            const p = sat.t / sat.life;
            let a = sat.b * Math.min(1, p / 0.12, (1 - p) / 0.12) * dim;
            if (sat.flare > 0) a *= 1 + 4 * Math.exp(-(((p - sat.flare) / 0.025) ** 2));
            const x = sat.x + sat.vx * sat.t;
            const y = sat.y + sat.vy * sat.t;
            ctx.globalAlpha = clamp01(a * this.extinction(y));
            ctx.drawImage(starSprite('235, 238, 255', k), x - 6, y - 6, 12, 12);
        }

        // Vệt khói của thiên thạch lửa: mờ dần, loang rộng, trôi nhẹ theo gió trên cao
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        this.trains.forEach(train => {
            const q = train.age / train.life;
            const shift = train.age * 0.004;
            ctx.globalAlpha = 0.16 * (1 - q) * (1 - q) * dim;
            ctx.strokeStyle = `rgb(${train.rgb})`;
            ctx.lineWidth = 1 + 3 * q;
            ctx.beginPath();
            train.points.forEach(([x, y], i) => (i ? ctx.lineTo(x + shift, y) : ctx.moveTo(x + shift, y)));
            ctx.stroke();
        });

        this.meteors.forEach(m => {
            const p = Math.min(1, m.t / m.life);
            let lum = Math.pow(Math.sin(Math.PI * p), 0.6);
            if (m.flare > 0 && !calm) lum *= 1 + 1.6 * Math.exp(-(((p - m.flare) / 0.06) ** 2));
            const a = m.b * lum * (1 - 0.4 * light) * this.extinction(m.hy);
            if (p < 1 && a > 0.01) {
                const len = Math.min(m.tail * (0.4 + 0.6 * m.speed), m.speed * m.t);
                const tx = m.hx - m.dx * len;
                const ty = m.hy - m.dy * len;
                const grad = ctx.createLinearGradient(m.hx, m.hy, tx, ty);
                grad.addColorStop(0, `rgba(${m.rgb}, ${clamp01(a)})`);
                grad.addColorStop(0.25, `rgba(${m.rgb}, ${clamp01(a * 0.45)})`);
                grad.addColorStop(1, `rgba(${m.rgb}, 0)`);
                ctx.strokeStyle = grad;
                ctx.beginPath();
                ctx.moveTo(m.hx, m.hy);
                ctx.lineTo(tx, ty);
                ctx.globalAlpha = 0.3;
                ctx.lineWidth = m.width * 3.5;
                ctx.stroke();
                ctx.globalAlpha = 1;
                ctx.lineWidth = m.width;
                ctx.stroke();
                const size = 8 + 8 * m.width;
                ctx.globalAlpha = clamp01(a);
                ctx.drawImage(starSprite(m.rgb, k), m.hx - size / 2, m.hy - size / 2, size, size);
            }
            m.sparks.forEach(s => {
                const q = s.t / s.life;
                ctx.globalAlpha = clamp01((1 - q) * 0.9 * (1 - 0.4 * light));
                ctx.drawImage(starSprite(m.rgb, k), s.x - 4, s.y - 4, 8, 8);
            });
        });
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
    }
}
