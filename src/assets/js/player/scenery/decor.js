/*!
 * Trình diễn Pháo hoa – trình phát: cảnh vật (bầu trời)
 * Phần bổ sung và chỉnh sửa © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Bầu trời đêm: sao, Dải Ngân Hà, sao băng (night-sky.js), trăng, mây, đèn trời, khinh khí cầu, máy bay; phần nhô lên của bờ.

import MyMath from '../../MyMath.js';
import { IS_MOBILE } from '../env.js';
import { horizon, isLowQuality, reduceFlashing, season as sceneSeason } from '../state.js';
import { moonIllumination } from '../moon.js';
import { sprites } from './util.js';
import { bankBandCss } from './bank.js';
import { drawBankSkyline, drawButterflies } from './bank-life.js';
import { BALLOON_SCHEMES, balloonSprite, burnerGlow, drawPlane, lanternSprite } from './decor-sprites.js';
import { moonSprite } from './moon-sprite.js';
import { buildCloud } from './clouds.js';
import { NightSky } from './night-sky.js';

export const Decor = {
    scene: null,
    items: [],
    // Bầu trời sao (NightSky) hoặc null
    sky: null,
    moon: null,
    clouds: [],
    wind: 0,
    // Ánh trăng đang chiếu (0-1): theo độ tròn của trăng, giảm khi mây che, đổi dần; cover: mây đang che trăng bao nhiêu
    moonLight: 0,
    cover: 0,
    width: 0,
    height: 0,
    clock: 0,
    drawn: false,
    frame: 0,

    // scene: { decor: ['lanterns', 'balloons', 'planes'], stars: '' | 'few' | 'many', moon: { fraction, x, y } | null,
    // clouds: '' | 'few' | 'many', background } hoặc null; cssW, cssH: kích thước khung. Đổi cảnh hoặc cỡ khung thì rải lại.
    sync(scene, cssW, cssH) {
        if (scene === this.scene && Math.abs(cssW - this.width) < 2 && Math.abs(cssH - this.height) < 2) return;
        // Chỉ đổi cỡ khung hoặc chỉnh mục khác thì giữ nguyên đám mây đang trôi (không dựng lại, không hiện lại từ đầu)
        const keep = scene && scene.clouds && this.scene && scene.clouds === this.scene.clouds && this.width > 0 ? this.clouds : null;
        const oldW = this.width;
        this.scene = scene;
        this.width = cssW;
        this.height = cssH;
        this.items = [];
        this.moon = null;
        this.clouds = [];
        if (!scene || !cssW || !cssH) {
            this.sky = null;
            return;
        }
        const decor = scene.decor || [];
        if (decor.includes('lanterns')) {
            const count = IS_MOBILE ? 9 : 16;
            for (let i = 0; i < count; i++) this.items.push(this.lantern(true));
        }
        if (decor.includes('balloons')) {
            const count = IS_MOBILE ? 2 : 3;
            for (let i = 0; i < count; i++) this.items.push(this.balloon(i, count, true));
        }
        if (decor.includes('planes')) this.items.push(this.plane(MyMath.random(1000, 4000)));
        // Sao, Dải Ngân Hà (scene.milkyWay: '' | 'faint' | 'bright'), sao băng (scene.meteors: '' | 'few' | 'shower'). Có ảnh
        // nền thành phố: chỉ ở phần trời phía trên. Cùng bầu trời như trước thì giữ nguyên (không rải lại)
        this.sky = scene.stars || scene.milkyWay || scene.meteors
            ? NightSky.reuse(this.sky, { width: cssW, height: this.groundY() * (scene.background ? 0.45 : 1), stars: scene.stars, milkyWay: scene.milkyWay, meteors: scene.meteors })
            : null;
        if (scene.moon) {
            const ground = this.groundY();
            this.moon = {
                fraction: scene.moon.fraction,
                x: scene.moon.x / 100 * cssW,
                // Độ cao tính từ đường chân trời (0) tới đỉnh khung (100)
                y: ground * (1 - scene.moon.y / 100),
                radius: MyMath.clamp(Math.min(cssW, ground) * 0.05, 14, 34),
                // Trăng sát chân trời: ánh trăng xuyên qua lớp không khí dày nên ngả vàng cam
                warm: Math.pow(MyMath.clamp((30 - scene.moon.y) / 30, 0, 1), 1.3)
            };
            this.moonLight = moonIllumination(scene.moon.fraction);
        }
        if (keep) {
            keep.forEach(cloud => {
                cloud.x *= cssW / oldW;
                cloud.y = this.cloudY(cloud.alt);
            });
            this.clouds = keep;
        } else if (scene.clouds) {
            const count = { few: IS_MOBILE ? 3 : 4, many: IS_MOBILE ? 5 : 8 }[scene.clouds] || 0;
            this.wind = (Math.random() < 0.5 ? -1 : 1) * MyMath.random(0.004, 0.009);
            // Bầu trời luôn có vài đám mây tích, mây từng mảng làm nền; xen thêm mây vụn, dải mây, sợi mây ti. Rải xáo trộn
            // ngang trời.
            const pick = list => list[(Math.random() * list.length) | 0];
            const bag = (scene.clouds === 'many'
                ? ['cumulus', 'cumulus', 'patch', pick(['cumulus', 'patch']), 'fractus', 'layer', pick(['fractus', 'wisp']), pick(['patch', 'layer'])]
                : ['cumulus', 'patch', pick(['fractus', 'layer']), pick(['cumulus', 'wisp', 'fractus'])]).slice(0, count);
            for (let i = bag.length - 1; i > 0; i--) {
                const j = (Math.random() * (i + 1)) | 0;
                [bag[i], bag[j]] = [bag[j], bag[i]];
            }
            bag.forEach((kind, i) => this.clouds.push(this.cloud(((i + Math.random() * 0.7) / count) * cssW, kind)));
            // Xa (gần chân trời) vẽ trước
            this.clouds.sort((a, b) => a.alt - b.alt);
            this.buildClouds();
        }
    },

    // Mây có sẵn trên trời ngay từ khung hình đầu: dựng ngay dạng đầu của từng mây (dạng sau dựng dần lúc máy rảnh rồi
    // mới hòa vào). Máy chậm không kịp dựng hết thì mây chưa dựng xếp ngoài mép đầu gió, trôi dần vào khung.
    buildClouds() {
        const until = performance.now() + 250;
        this.clouds.forEach(cloud => {
            cloud.job = buildCloud(cloud.w, cloud.h, cloud.seed, cloud.kind);
            while (!cloud.sprites && performance.now() < until) this.stepCloud(cloud);
        });
        let edge = 0;
        this.clouds.forEach(cloud => {
            if (cloud.sprites) return;
            edge += MyMath.random(40, 160);
            cloud.x = this.wind > 0 ? -cloud.w / 2 - edge : this.width + cloud.w / 2 + edge;
            edge += cloud.w * 0.7;
        });
        this.warmClouds();
    },

    stepCloud(cloud) {
        const result = cloud.job.next();
        if (result.value && !cloud.sprites) cloud.sprites = result.value;
        if (result.done) {
            cloud.job = null;
            cloud.full = this.clock;
        }
    },

    // Dựng nốt ảnh mây lúc máy rảnh, chia nhỏ từng đoạn vài mili giây để không khựng khung hình: mây chưa có ảnh trước
    // (đang chờ ngoài mép), rồi tới dạng sau của từng mây
    warmClouds() {
        const list = this.clouds;
        const step = deadline => {
            if (this.clouds !== list) return;
            const until = performance.now() + 5;
            while (performance.now() < until || (deadline && deadline.timeRemaining && deadline.timeRemaining() > 3)) {
                const cloud = list.find(item => item.job && !item.sprites) || list.find(item => item.job);
                if (!cloud) return;
                const ready = !!cloud.sprites;
                this.stepCloud(cloud);
                // Lỡ dựng xong khi đang ở trong khung (khung vừa nới rộng) thì hiện dần
                const seen = cloud.x + cloud.w / 2 > 0 && cloud.x - cloud.w / 2 < this.width;
                if (!ready && cloud.sprites && seen) cloud.born = this.clock;
            }
            schedule();
        };
        const schedule = () => (window.requestIdleCallback ? window.requestIdleCallback(step, { timeout: 200 }) : setTimeout(step, 16));
        schedule();
    },

    // Mây gần chân trời ở xa: nhỏ, dẹt, trôi chậm; mây trên cao gần hơn: to, dày, trôi nhanh hơn. Mỗi loại ở một tầng
    // cao riêng: dải mây mỏng, mây vụn sát chân trời; mây từng mảng, mây tích lưng chừng tới trên cao; sợi mây ti cao
    // nhất (dáng từng loại: cloudShape)
    cloud(x, kind) {
        const [lo, hi] = { layer: [0, 0.35], fractus: [0, 0.6], patch: [0.2, 0.85], cumulus: [0.3, 1], wisp: [0.7, 1] }[kind];
        const alt = MyMath.random(lo, hi);
        const [w0, w1, a0, a1] = {
            layer: [260, 460, 0.2, 0.28], cumulus: [190, 340, 0.45, 0.66], patch: [240, 420, 0.26, 0.38],
            fractus: [150, 280, 0.28, 0.42], wisp: [280, 500, 0.2, 0.32]
        }[kind];
        const size = (0.55 + 0.6 * alt) * (IS_MOBILE ? 0.75 : 1);
        const w = MyMath.random(w0, w1) * size;
        const h = w * MyMath.random(a0, a1) * (0.85 + 0.3 * alt);
        return {
            x, alt, w, h, kind, y: this.cloudY(alt),
            vx: this.wind * (0.5 + alt), density: MyMath.random(0.65, 0.95), seed: 1 + ((Math.random() * 2147483000) | 0),
            morph: MyMath.random(1 / 70000, 1 / 40000) * Math.PI * 2, phase: Math.random() * Math.PI * 2, sprites: null,
            job: null, born: -Infinity, full: 0
        };
    },

    cloudY(alt) {
        return this.groundY() * (0.06 + 0.55 * (1 - alt));
    },

    // Hai dạng của mây đang hòa vào nhau bao nhiêu (0 dạng đầu - 1 dạng sau); dạng sau vừa dựng xong thì hòa vào từ từ
    cloudMix(cloud) {
        if (!cloud.sprites || cloud.sprites.maps.length < 2) return 0;
        return Math.min(1, (this.clock - cloud.full) / 4000) * (0.5 + 0.5 * Math.sin(this.clock * cloud.morph + cloud.phase));
    },

    // Mây che trăng bao nhiêu (0 trăng tỏ - 1 bị che hẳn)
    moonCover(mx, my) {
        let clear = 1;
        this.clouds.forEach(cloud => {
            if (!cloud.sprites) return;
            const { maps, tw, th } = cloud.sprites;
            const tx = Math.floor((mx - (cloud.x - cloud.w / 2)) / cloud.w * tw);
            const ty = Math.floor((my - (cloud.y - cloud.h / 2)) / cloud.h * th);
            if (tx < 0 || ty < 0 || tx >= tw || ty >= th) return;
            const mix = this.cloudMix(cloud);
            const a = (maps[0].alpha[ty * tw + tx] * (1 - mix) + (mix ? maps[1].alpha[ty * tw + tx] * mix : 0)) / 255;
            clear *= 1 - a * cloud.density * this.cloudFade(cloud);
        });
        return 1 - clear;
    },

    // Trăng cho mặt nước vẽ đường trăng: chỗ đang đứng (điểm ảnh CSS), độ sáng lúc này (mây che thì tối), độ ngả vàng
    moonGlow() {
        if (!this.moon) return null;
        const drift = this.skyDrift();
        return { x: this.moon.x + drift.x, y: this.moon.y + drift.y, radius: this.moon.radius, light: this.moonLight, warm: this.moon.warm };
    },

    cloudFade(cloud) {
        return cloud.sprites ? Math.min(1, (this.clock - cloud.born) / 1500) : 0;
    },

    active() {
        return this.items.length > 0 || !!this.sky || !!this.moon || this.clouds.length > 0 || horizon() < 1;
    },

    groundY() {
        return this.height * horizon();
    },

    lantern(initial) {
        // Xa thì nhỏ và bay chậm
        const near = Math.random();
        const ground = this.groundY();
        return {
            type: 'lantern',
            x: MyMath.random(0.04, 0.96) * this.width,
            y: initial ? MyMath.random(0.12, 0.95) * ground : ground + MyMath.random(0, 12),
            size: 5 + near * 7,
            rise: 0.006 + near * 0.012,
            sway: MyMath.random(4, 12),
            phase: Math.random() * Math.PI * 2,
            flicker: Math.random() * Math.PI * 2,
            age: initial ? 5000 : 0
        };
    },

    balloon(index, count, initial) {
        const ground = this.groundY();
        const dir = Math.random() < 0.5 ? -1 : 1;
        const size = (IS_MOBILE ? 34 : 46) + Math.random() * (IS_MOBILE ? 22 : 34);
        return {
            type: 'balloon',
            scheme: (index + Math.floor(Math.random() * 4)) % BALLOON_SCHEMES.length,
            x: initial ? (index + 0.5) / count * this.width + MyMath.random(-40, 40) : (dir > 0 ? -size : this.width + size),
            y: MyMath.random(0.18, 0.5) * ground,
            size,
            vx: dir * MyMath.random(0.008, 0.016),
            bob: Math.random() * Math.PI * 2,
            burn: MyMath.random(1500, 6000),
            burning: 0
        };
    },

    // Máy bay bay ngang trên cao, đợi một lúc (wait, ms) mới xuất hiện
    plane(wait) {
        const dir = Math.random() < 0.5 ? -1 : 1;
        return {
            type: 'plane',
            wait,
            x: dir > 0 ? -20 : this.width + 20,
            y: MyMath.random(0.06, 0.3) * this.groundY(),
            vx: dir * MyMath.random(0.02, 0.035),
            scale: MyMath.random(0.8, 1.25),
            t: Math.random() * 1500
        };
    },

    update(timeStep) {
        if (!this.active()) return;
        this.clock += timeStep;
        if (this.sky) this.sky.update(timeStep);
        const ground = this.groundY();
        this.clouds.forEach(cloud => {
            cloud.x += cloud.vx * timeStep;
            if (cloud.vx > 0 && cloud.x - cloud.w / 2 > this.width) cloud.x = -cloud.w / 2 - MyMath.random(0, 80);
            if (cloud.vx < 0 && cloud.x + cloud.w / 2 < 0) cloud.x = this.width + cloud.w / 2 + MyMath.random(0, 80);
        });
        if (this.moon) {
            // Mây trôi qua che trăng thì trời tối dần, mây qua rồi sáng lại
            const drift = this.skyDrift();
            this.cover = this.moonCover(this.moon.x + drift.x, this.moon.y + drift.y);
            const target = moonIllumination(this.moon.fraction) * (1 - 0.85 * this.cover);
            this.moonLight += (target - this.moonLight) * (1 - Math.exp(-timeStep / 500));
        }
        this.items.forEach((item, i) => {
            if (item.type === 'lantern') {
                item.age += timeStep;
                item.y -= item.rise * timeStep;
                item.phase += timeStep * 0.0011;
                item.flicker += timeStep * 0.012;
                if (item.y < -20) this.items[i] = this.lantern(false);
            } else if (item.type === 'plane') {
                if (item.wait > 0) {
                    item.wait -= timeStep;
                    return;
                }
                item.t += timeStep;
                item.x += item.vx * timeStep;
                if (item.x < -30 || item.x > this.width + 30) this.items[i] = this.plane(MyMath.random(8000, 22000));
            } else {
                item.x += item.vx * timeStep;
                item.bob += timeStep * 0.0009;
                item.burn -= timeStep;
                if (item.burn <= 0) {
                    item.burning = 1200;
                    item.burn = MyMath.random(3500, 8000);
                }
                item.burning = Math.max(0, item.burning - timeStep);
                if (item.x < -item.size * 2 || item.x > this.width + item.size * 2) {
                    this.items[i] = this.balloon(i, 1, false);
                    this.items[i].y = MyMath.random(0.18, 0.5) * ground;
                }
            }
        });
    },

    // Bầu trời quay rất chậm: trăng trôi theo một cung, sao trôi theo (ít hơn)
    skyDrift() {
        const angle = this.clock / 240000 * Math.PI * 2;
        return { x: Math.sin(angle) * this.width * 0.035, y: (1 - Math.cos(angle)) * this.groundY() * 0.03 };
    },

    // glow: màu trời đang ửng theo pháo ({ r, g, b }), rọi sáng mây
    render(ctx, glow) {
        const { width: W, height: H } = ctx.canvas;
        if (!this.active()) {
            if (this.drawn) ctx.clearRect(0, 0, W, H);
            this.drawn = false;
            return;
        }
        // Chất lượng 480p trở xuống: sao, trăng, đèn trời trôi rất chậm nên vẽ lại cách một khung hình
        if (isLowQuality && this.drawn && (++this.frame & 1)) return;
        this.drawn = true;
        const k = W / this.width;
        const calm = reduceFlashing();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, W, H);
        ctx.setTransform(k, 0, 0, k, 0, 0);
        const ground = this.groundY();
        const drift = this.skyDrift();
        const light = this.moon ? this.moonLight : 0;

        // Ngân Hà, sao mờ: vẽ trước ánh trăng (trăng sáng làm chúng chìm đi như ngoài đời)
        if (this.sky) this.sky.drawBackdrop(ctx, k, drift);

        // Ánh trăng: cả bầu trời sáng xanh lên (trăng càng tròn càng sáng, mây che thì tối lại), sáng nhất quanh trăng,
        // sát chân trời sáng hơn một chút. Mặt nước phản chiếu lớp này nên cũng sáng theo.
        if (light > 0.01) {
            const mx = this.moon.x + drift.x;
            const my = this.moon.y + drift.y;
            const sky = ctx.createLinearGradient(0, 0, 0, ground);
            sky.addColorStop(0, `rgba(22, 32, 58, ${0.7 * light})`);
            sky.addColorStop(1, `rgba(38, 52, 84, ${0.85 * light})`);
            ctx.globalAlpha = 1;
            ctx.fillStyle = sky;
            ctx.fillRect(0, 0, this.width, ground);
            const halo = ctx.createRadialGradient(mx, my, this.moon.radius, mx, my, Math.max(this.width, ground) * 0.55);
            halo.addColorStop(0, `rgba(125, 145, 190, ${0.32 * light})`);
            halo.addColorStop(1, 'rgba(125, 145, 190, 0)');
            ctx.fillStyle = halo;
            ctx.fillRect(0, 0, this.width, ground);
        }

        // Sao sáng, vệ tinh, sao băng: trăng càng sáng càng mờ, gần trăng bị ánh trăng lấn mất
        if (this.sky) {
            const moon = this.moon && { x: this.moon.x + drift.x, y: this.moon.y + drift.y, glare: this.moon.radius * 9 };
            this.sky.draw(ctx, k, { drift, light, moon, calm });
        }

        if (this.moon) {
            const { fraction, radius, warm } = this.moon;
            const sprite = moonSprite(fraction, radius, k, warm);
            const size = sprite.width / k;
            ctx.globalAlpha = 1;
            ctx.drawImage(sprite, this.moon.x + drift.x - size / 2, this.moon.y + drift.y - size / 2, size, size);
        }

        // Mây: che sao, trăng phía sau; thân mây sáng theo ánh trăng; viền trên ánh bạc khi trăng tỏ (gần trăng càng sáng);
        // pháo nổ rọi sáng mây
        const flash = glow ? Math.min(1, (glow.r + glow.g + glow.b) / 300) : 0;
        this.clouds.forEach(cloud => {
            // Mây chưa có ảnh (máy chậm, đang chờ ngoài mép khung) thì chưa vẽ
            if (!cloud.sprites) return;
            const { maps } = cloud.sprites;
            const x = cloud.x - cloud.w / 2;
            const y = cloud.y - cloud.h / 2;
            const fade = this.cloudFade(cloud);
            const mix = this.cloudMix(cloud);
            // Hai dạng hòa vào nhau (hơi bù độ dày lúc giữa chừng)
            const parts = mix ? [[maps[0], Math.pow(1 - mix, 0.6)], [maps[1], Math.pow(mix, 0.6)]] : [[maps[0], 1]];
            let near = 0;
            if (this.moon) {
                const dx = cloud.x - (this.moon.x + drift.x);
                const dy = cloud.y - (this.moon.y + drift.y);
                near = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) / (this.width * 0.5));
            }
            const rim = light * (0.25 + 0.75 * near) + flash * 0.5;
            parts.forEach(([map, weight]) => {
                if (weight < 0.01) return;
                ctx.globalCompositeOperation = 'source-over';
                ctx.globalAlpha = cloud.density * (0.5 + 0.5 * light) * weight * fade;
                ctx.drawImage(map.body, x, y, cloud.w, cloud.h);
                ctx.globalCompositeOperation = 'lighter';
                if (rim > 0.02) {
                    ctx.globalAlpha = Math.min(1, rim) * weight * fade;
                    ctx.drawImage(map.rim, x, y, cloud.w, cloud.h);
                }
                if (flash > 0.02) {
                    ctx.globalAlpha = flash * 0.35 * cloud.density * weight * fade;
                    ctx.drawImage(map.body, x, y, cloud.w, cloud.h);
                }
            });
        });
        // Trăng sau lớp mây mỏng: quầng sáng nhòe quanh trăng
        if (this.moon && this.cover > 0.05) {
            const mx = this.moon.x + drift.x;
            const my = this.moon.y + drift.y;
            const r = this.moon.radius * 3.2;
            const corona = ctx.createRadialGradient(mx, my, this.moon.radius * 0.4, mx, my, r);
            const strength = moonIllumination(this.moon.fraction) * Math.min(1, this.cover * 2) * (1 - this.cover * 0.55);
            corona.addColorStop(0, `rgba(225, 230, 245, ${0.42 * strength})`);
            corona.addColorStop(1, 'rgba(200, 210, 235, 0)');
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = 1;
            ctx.fillStyle = corona;
            ctx.fillRect(mx - r, my - r, r * 2, r * 2);
        }
        ctx.globalCompositeOperation = 'source-over';

        const lantern = lanternSprite();
        this.items.forEach(item => {
            if (item.type === 'lantern') {
                const x = item.x + Math.sin(item.phase) * item.sway;
                // Hiện dần khi vừa thả, mờ dần khi lên cao
                const fadeIn = Math.min(1, item.age / 1500);
                const fadeTop = Math.min(1, Math.max(0, item.y / (ground * 0.25)));
                const glow = calm ? 0.9 : 0.82 + Math.sin(item.flicker) * 0.1 + Math.sin(item.flicker * 2.7) * 0.05;
                ctx.globalAlpha = Math.max(0, fadeIn * fadeTop * glow);
                const w = item.size * 2.2;
                ctx.drawImage(lantern, x - w / 2, item.y - w * 0.7, w, w * 64 / 48);
            } else if (item.type === 'plane') {
                if (item.wait <= 0) drawPlane(ctx, item, calm);
            } else {
                const y = item.y + Math.sin(item.bob) * 4;
                const w = item.size;
                const h = w * 160 / 120;
                ctx.globalAlpha = 0.9;
                ctx.drawImage(balloonSprite(item.scheme), item.x - w / 2, y - h / 2, w, h);
                // Lửa đốt bừng lên rọi sáng khinh khí cầu
                const burn = calm ? 0.25 : 0.2 + (item.burning > 0 ? Math.sin(item.burning / 1200 * Math.PI) * 0.8 : 0);
                ctx.globalAlpha = burn;
                ctx.drawImage(burnerGlow(), item.x - w / 2, y - h / 2 + h * 0.1, w, w);
            }
        });
        // Có mặt nước: cỏ, lau sậy, bụi cây trên bờ đất nhô lên nền trời, đom đóm
        if (horizon() < 1) drawBankSkyline(ctx, this.width, ground, this.clock, calm, glow, bankBandCss(this.height));
        if (horizon() < 1 && sceneSeason() === 'spring') drawButterflies(ctx, this.width, ground, this.clock, calm);
        ctx.globalAlpha = 1;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
};
