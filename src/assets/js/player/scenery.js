/*!
 * Trình diễn Pháo hoa – trình phát: cảnh vật (mặt nước phản chiếu, đèn trời, khinh khí cầu)
 * Phần bổ sung và chỉnh sửa © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Cảnh vật theo kịch bản:
// - Mặt nước: đường chân trời (điểm phóng pháo) nâng lên 1/3 hoặc nửa màn hình; phần dưới là mặt nước phản chiếu
//   bầu trời (pháo, khói, trang trí, ảnh nền) lật ngược, gợn sóng, mờ dần theo độ sâu.
// - Bầu trời đêm: sao lấp lánh, mặt trăng đúng pha (theo ngày xem hoặc tự chọn) trôi chậm theo một cung.
// - Trang trí: đèn trời bay lên chậm, khinh khí cầu trôi ngang, máy bay (chỉ thấy đèn nhấp nháy); đều tự phát sáng
//   (hợp với cách ghép lớp "lighten").
// Cả hai vẽ trên lớp canvas riêng; nhiều thứ được vẽ sẵn một lần thành ảnh nhỏ để mỗi khung hình chỉ cần chép ảnh.

import MyMath from '../MyMath.js';
import { IS_MOBILE } from './env.js';
import { horizon, reduceFlashing } from './state.js';
import { moonIllumination } from './moon.js';

// Độ phân giải lớp mặt nước so với điểm ảnh CSS (bóng phản chiếu vốn mờ, gợn sóng); điện thoại thấp hơn cho nhẹ máy
export const WATER_RESOLUTION = IS_MOBILE ? 0.35 : 0.5;

// ---------------------------------------------------------------------------
// Mặt nước
// ---------------------------------------------------------------------------
const backgroundImages = new Map();

// Ảnh nền đang hiện (CSS background-image) để phản chiếu, cùng vị trí trong khung
function backgroundOf(el) {
    if (!el) return null;
    const style = getComputedStyle(el);
    const opacity = parseFloat(style.opacity);
    const match = style.backgroundImage.match(/url\(["']?(.*?)["']?\)/);
    if (!match || opacity < 0.01) return null;
    let image = backgroundImages.get(match[1]);
    if (!image) {
        image = new Image();
        image.src = match[1];
        backgroundImages.set(match[1], image);
    }
    return image.complete && image.naturalWidth ? { image, opacity } : null;
}

let mirror = null;

export const Water = {
    drawn: false,
    frame: 0,

    // sources: các canvas cùng kích thước khung (vẽ theo điểm ảnh CSS cssW x cssH); background: phần tử ảnh nền
    render(ctx, { sources, background, sky, cssW, cssH, time }) {
        const level = horizon();
        const { width: W, height: H } = ctx.canvas;
        if (level >= 1 || !W || !H) {
            if (this.drawn) ctx.clearRect(0, 0, W, H);
            this.drawn = false;
            return;
        }
        // Điện thoại: vẽ lại cách một khung hình
        if (IS_MOBILE && this.drawn && (++this.frame & 1)) return;
        this.drawn = true;

        const k = W / cssW;
        const top = Math.round(level * H);
        const depth = H - top;
        const horizonCss = level * cssH;
        const depthCss = depth / k;
        const fromCss = Math.max(0, horizonCss - depthCss);

        // 1. Bầu trời ngay trên mặt nước, lật ngược (dải cao bằng phần nước)
        if (!mirror) mirror = document.createElement('canvas');
        if (mirror.width !== W || mirror.height !== depth) {
            mirror.width = W;
            mirror.height = depth;
        }
        const m = mirror.getContext('2d');
        m.setTransform(1, 0, 0, 1, 0, 0);
        m.clearRect(0, 0, W, depth);
        m.setTransform(k, 0, 0, -k, 0, k * horizonCss);
        const bg = backgroundOf(background);
        if (bg) {
            // Ảnh nền đứng trên mép nước: phủ kín phần trời, canh đáy
            const box = background.getBoundingClientRect();
            const scale = Math.max(box.width / bg.image.naturalWidth, box.height / bg.image.naturalHeight);
            const w = bg.image.naturalWidth * scale;
            const h = bg.image.naturalHeight * scale;
            m.globalAlpha = bg.opacity;
            m.drawImage(bg.image, (cssW - w) / 2, horizonCss - h, w, h);
            m.globalAlpha = 1;
        }
        m.globalCompositeOperation = 'lighten';
        sources.forEach(src => {
            if (!src || !src.width) return;
            const sk = src.width / cssW;
            m.drawImage(src, 0, fromCss * sk, src.width, (horizonCss - fromCss) * sk, 0, fromCss, cssW, horizonCss - fromCss);
        });
        m.globalCompositeOperation = 'source-over';

        // 2. Nền nước: xanh đêm, sáng nhẹ theo màu trời ở gần chân trời
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1;
        ctx.clearRect(0, 0, W, H);
        const tint = `${18 + sky.r * 0.5 | 0}, ${26 + sky.g * 0.5 | 0}, ${44 + sky.b * 0.5 | 0}`;
        const base = ctx.createLinearGradient(0, top, 0, H);
        base.addColorStop(0, `rgb(${tint})`);
        base.addColorStop(1, 'rgb(4, 7, 15)');
        ctx.fillStyle = base;
        ctx.fillRect(0, top, W, depth);

        // 3. Bóng phản chiếu: từng dải ngang lệch theo sóng, càng xa bờ càng lệch nhiều và càng mờ
        const strip = IS_MOBILE ? 3 : 2;
        for (let y = 0; y < depth; y += strip) {
            const d = y / depth;
            const amp = (0.5 + d * 2.2) * k;
            const yc = y / k;
            const dx = Math.sin(yc * 0.32 + time * 0.0021) * amp + Math.sin(yc * 0.097 - time * 0.0013) * amp * 0.6;
            ctx.globalAlpha = 0.62 * (1 - d * 0.65);
            ctx.drawImage(mirror, 0, y, W, strip, dx, top + y, W, strip);
        }

        // 4. Đường chân trời sáng mảnh
        ctx.globalAlpha = 1;
        const line = ctx.createLinearGradient(0, 0, W, 0);
        line.addColorStop(0, 'rgba(150, 180, 230, 0)');
        line.addColorStop(0.5, 'rgba(150, 180, 230, 0.28)');
        line.addColorStop(1, 'rgba(150, 180, 230, 0)');
        ctx.fillStyle = line;
        ctx.fillRect(0, top, W, Math.max(1, k));
    }
};

// ---------------------------------------------------------------------------
// Trang trí bầu trời: đèn trời, khinh khí cầu
// ---------------------------------------------------------------------------
const sprites = {};

function lanternSprite() {
    if (sprites.lantern) return sprites.lantern;
    const c = document.createElement('canvas');
    c.width = 48;
    c.height = 64;
    const g = c.getContext('2d');
    // Quầng sáng
    const halo = g.createRadialGradient(24, 34, 2, 24, 34, 26);
    halo.addColorStop(0, 'rgba(255, 170, 70, 0.55)');
    halo.addColorStop(1, 'rgba(255, 120, 30, 0)');
    g.fillStyle = halo;
    g.fillRect(0, 0, 48, 64);
    // Thân đèn: hình thang bo tròn, sáng ở đáy (ngọn lửa)
    const body = g.createLinearGradient(0, 22, 0, 46);
    body.addColorStop(0, '#ff8a2a');
    body.addColorStop(0.7, '#ffc46b');
    body.addColorStop(1, '#fff1c9');
    g.fillStyle = body;
    g.beginPath();
    g.moveTo(17, 22);
    g.quadraticCurveTo(24, 19, 31, 22);
    g.lineTo(33, 44);
    g.quadraticCurveTo(24, 47, 15, 44);
    g.closePath();
    g.fill();
    sprites.lantern = c;
    return c;
}

const BALLOON_SCHEMES = [
    ['#ff5a5a', '#ffd166'],
    ['#4cc9f0', '#f8f9fa'],
    ['#9d4edd', '#ffb703'],
    ['#06d6a0', '#ef476f']
];

function balloonSprite(scheme) {
    const key = 'balloon' + scheme;
    if (sprites[key]) return sprites[key];
    const [a, b] = BALLOON_SCHEMES[scheme % BALLOON_SCHEMES.length];
    const c = document.createElement('canvas');
    c.width = 120;
    c.height = 160;
    const g = c.getContext('2d');
    const envelope = () => {
        g.beginPath();
        g.moveTo(60, 8);
        g.bezierCurveTo(110, 8, 116, 62, 92, 92);
        g.lineTo(70, 114);
        g.lineTo(50, 114);
        g.lineTo(28, 92);
        g.bezierCurveTo(4, 62, 10, 8, 60, 8);
        g.closePath();
    };
    // Múi vải hai màu
    g.save();
    envelope();
    g.clip();
    for (let i = 0; i < 8; i++) {
        g.fillStyle = i % 2 ? a : b;
        g.beginPath();
        g.ellipse(60, 60, Math.abs(56 - i * 14) + 2, 60, 0, 0, Math.PI * 2);
        g.fill();
    }
    // Ánh lửa từ dưới rọi lên, phía trên tối dần
    const light = g.createLinearGradient(0, 8, 0, 114);
    light.addColorStop(0, 'rgba(0, 0, 0, 0.62)');
    light.addColorStop(0.6, 'rgba(0, 0, 0, 0.25)');
    light.addColorStop(1, 'rgba(255, 200, 120, 0.25)');
    g.fillStyle = light;
    g.fillRect(0, 0, 120, 120);
    g.restore();
    // Dây và giỏ
    g.strokeStyle = 'rgba(255, 210, 160, 0.55)';
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(52, 114);
    g.lineTo(54, 132);
    g.moveTo(68, 114);
    g.lineTo(66, 132);
    g.stroke();
    g.fillStyle = '#c98a4b';
    g.fillRect(52, 132, 16, 11);
    sprites[key] = c;
    return c;
}

function burnerGlow() {
    if (sprites.burner) return sprites.burner;
    const c = document.createElement('canvas');
    c.width = c.height = 120;
    const g = c.getContext('2d');
    const glow = g.createRadialGradient(60, 70, 4, 60, 70, 60);
    glow.addColorStop(0, 'rgba(255, 220, 140, 0.9)');
    glow.addColorStop(0.35, 'rgba(255, 150, 60, 0.35)');
    glow.addColorStop(1, 'rgba(255, 120, 40, 0)');
    g.fillStyle = glow;
    g.fillRect(0, 0, 120, 120);
    sprites.burner = c;
    return c;
}

// Mặt trăng: đĩa sáng đúng pha (bên phải sáng khi trăng tròn dần, bên trái khi khuyết dần, như nhìn từ Việt Nam),
// phần tối mờ nhạt (ánh đất), vài vùng biển tối và quầng sáng. Vẽ sẵn theo pha và cỡ.
function moonLitPath(g, r, fraction) {
    // k = 1 lúc trăng mới, -1 lúc trăng tròn: bề rộng đường ranh sáng tối
    const k = Math.cos(fraction * Math.PI * 2);
    g.beginPath();
    g.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, false);
    if (k >= 0) g.ellipse(0, 0, r * k, r, 0, Math.PI / 2, -Math.PI / 2, true);
    else g.ellipse(0, 0, -r * k, r, 0, Math.PI / 2, Math.PI * 1.5, false);
    g.closePath();
}

function moonSprite(fraction, radius, scale) {
    const key = `moon${fraction.toFixed(3)}_${radius.toFixed(1)}_${scale}`;
    if (sprites[key]) return sprites[key];
    Object.keys(sprites).filter(name => name.startsWith('moon')).forEach(name => delete sprites[name]);
    const r = radius * scale;
    const size = Math.ceil(r * 7);
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    const lit = moonIllumination(fraction);
    g.translate(size / 2, size / 2);
    // Quầng sáng, đậm theo phần trăng được chiếu sáng
    const halo = g.createRadialGradient(0, 0, r * 0.9, 0, 0, r * 3.4);
    halo.addColorStop(0, `rgba(255, 248, 225, ${0.22 * lit})`);
    halo.addColorStop(1, 'rgba(255, 248, 225, 0)');
    g.fillStyle = halo;
    g.fillRect(-size / 2, -size / 2, size, size);
    // Phần tối: ánh đất rất mờ (trăng mới gần như không thấy)
    g.fillStyle = 'rgba(120, 128, 150, 0.07)';
    g.beginPath();
    g.arc(0, 0, r, 0, Math.PI * 2);
    g.fill();
    // Phần sáng: đường dẫn dựng trong hệ lật ngang (trăng khuyết dần) rồi cắt theo nó
    g.save();
    if (fraction > 0.5) g.scale(-1, 1);
    moonLitPath(g, r, fraction);
    g.restore();
    g.save();
    g.clip();
    const face = g.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
    face.addColorStop(0, '#fffdf4');
    face.addColorStop(1, '#e6dfc8');
    g.fillStyle = face;
    g.fillRect(-r, -r, r * 2, r * 2);
    // Vùng biển tối: các mảng loang mềm
    [[-0.28, -0.22, 0.34], [0.18, -0.3, 0.26], [0.02, 0.16, 0.36], [-0.36, 0.3, 0.2], [0.38, 0.08, 0.2], [-0.05, -0.02, 0.22]]
        .forEach(([x, y, rr]) => {
            const blot = g.createRadialGradient(x * r, y * r, 0, x * r, y * r, rr * r);
            blot.addColorStop(0, 'rgba(140, 136, 122, 0.3)');
            blot.addColorStop(0.6, 'rgba(140, 136, 122, 0.16)');
            blot.addColorStop(1, 'rgba(140, 136, 122, 0)');
            g.fillStyle = blot;
            g.fillRect(x * r - rr * r, y * r - rr * r, rr * r * 2, rr * r * 2);
        });
    g.restore();
    sprites[key] = c;
    return c;
}

// Máy bay đêm: chỉ thấy đèn. Đèn đỏ, xanh ở hai đầu cánh, đèn đỏ chớp trên thân, đèn trắng chớp đôi ở đầu cánh
function drawPlane(ctx, item, calm) {
    const s = item.scale;
    const dir = item.vx > 0 ? 1 : -1;
    const light = (dx, color, alpha, size) => {
        const x = item.x + dx * s, y = item.y;
        ctx.globalAlpha = alpha * 0.35;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, size * 3 * s, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(x, y, size * s, 0, Math.PI * 2);
        ctx.fill();
    };
    const t = item.t;
    // Đầu cánh trái màu đỏ, phải màu xanh; bay sang trái thì đổi bên
    light(-7 * dir, '#ff4d4d', 0.85, 0.9);
    light(7 * dir, '#4dff88', 0.85, 0.9);
    light(-1.5 * dir, '#ffffff', 0.35, 0.6);
    if (calm) return;
    const beacon = t % 1100 < 120;
    if (beacon) light(0, '#ff3030', 1, 1.2);
    const strobe = t % 1500;
    if (strobe < 60 || (strobe > 160 && strobe < 220)) {
        light(-7 * dir, '#ffffff', 1, 1.3);
        light(7 * dir, '#ffffff', 1, 1.3);
    }
}

const STAR_COLORS = ['255, 255, 255', '210, 225, 255', '255, 240, 215', '190, 210, 255'];

export const Decor = {
    scene: null,
    items: [],
    stars: [],
    moon: null,
    width: 0,
    height: 0,
    clock: 0,
    drawn: false,

    // scene: { decor: ['lanterns', 'balloons', 'planes'], stars: '' | 'few' | 'many', moon: { fraction, x, y } | null,
    // background } hoặc null; cssW, cssH: kích thước khung. Đổi cảnh hoặc cỡ khung thì rải lại.
    sync(scene, cssW, cssH) {
        if (scene === this.scene && Math.abs(cssW - this.width) < 2 && Math.abs(cssH - this.height) < 2) return;
        this.scene = scene;
        this.width = cssW;
        this.height = cssH;
        this.items = [];
        this.stars = [];
        this.moon = null;
        if (!scene || !cssW || !cssH) return;
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
        if (scene.stars) {
            const count = { few: IS_MOBILE ? 40 : 70, many: IS_MOBILE ? 90 : 170 }[scene.stars] || 0;
            const ground = this.groundY();
            // Có ảnh nền thành phố: sao chỉ ở phần trời phía trên
            const band = scene.background ? 0.45 : 0.92;
            for (let i = 0; i < count; i++) {
                this.stars.push({
                    x: Math.random() * cssW,
                    y: Math.pow(Math.random(), 1.3) * ground * band,
                    size: Math.random() < 0.08 ? MyMath.random(1.5, 2) : MyMath.random(0.6, 1.4),
                    color: STAR_COLORS[(Math.random() * STAR_COLORS.length) | 0],
                    alpha: MyMath.random(0.45, 1),
                    twinkle: Math.random() * Math.PI * 2,
                    speed: MyMath.random(0.0015, 0.004)
                });
            }
        }
        if (scene.moon) {
            const ground = this.groundY();
            this.moon = {
                fraction: scene.moon.fraction,
                x: scene.moon.x / 100 * cssW,
                // Độ cao tính từ đường chân trời (0) tới đỉnh khung (100)
                y: ground * (1 - scene.moon.y / 100),
                radius: MyMath.clamp(Math.min(cssW, ground) * 0.05, 14, 34)
            };
        }
    },

    active() {
        return this.items.length > 0 || this.stars.length > 0 || !!this.moon;
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
        const ground = this.groundY();
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

    render(ctx) {
        const { width: W, height: H } = ctx.canvas;
        if (!this.active()) {
            if (this.drawn) ctx.clearRect(0, 0, W, H);
            this.drawn = false;
            return;
        }
        this.drawn = true;
        const k = W / this.width;
        const calm = reduceFlashing();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, W, H);
        ctx.setTransform(k, 0, 0, k, 0, 0);
        const ground = this.groundY();
        const drift = this.skyDrift();

        // Sao: lấp lánh nhẹ, mờ dần sát chân trời
        this.stars.forEach(star => {
            const x = (star.x + drift.x * 0.6 + this.width) % this.width;
            const y = star.y + drift.y * 0.6;
            const near = Math.min(1, Math.max(0, (ground - y) / (ground * 0.15)));
            const twinkle = calm ? 0.85 : 0.65 + 0.35 * Math.sin(star.twinkle + this.clock * star.speed);
            ctx.globalAlpha = star.alpha * twinkle * near;
            ctx.fillStyle = `rgb(${star.color})`;
            ctx.fillRect(x - star.size / 2, y - star.size / 2, star.size, star.size);
        });

        if (this.moon) {
            const { fraction, radius } = this.moon;
            const sprite = moonSprite(fraction, radius, k);
            const size = sprite.width / k;
            ctx.globalAlpha = 1;
            ctx.drawImage(sprite, this.moon.x + drift.x - size / 2, this.moon.y + drift.y - size / 2, size, size);
        }

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
        ctx.globalAlpha = 1;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
};
