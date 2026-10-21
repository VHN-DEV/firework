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
import { horizon, reduceFlashing, isLowQuality } from './state.js';
import { moonIllumination } from './moon.js';

// Độ phân giải lớp mặt nước so với điểm ảnh CSS khi chất lượng 480p trở xuống (cho nhẹ máy); mức cao hơn thì vẽ nét
// theo mật độ điểm ảnh màn hình như trăng, sao
export const WATER_RESOLUTION = IS_MOBILE ? 0.35 : 0.5;

// ---------------------------------------------------------------------------
// Mặt nước
// ---------------------------------------------------------------------------
const backgroundImages = new Map();

// Ảnh nền đang hiện (CSS background-image) để phản chiếu, cùng vị trí trong khung
// Đọc lại kiểu CSS của ảnh nền tối đa 4 lần mỗi giây (không phải mỗi khung hình)
let backgroundCache = { el: null, at: 0, value: null };
function backgroundOf(el) {
    if (!el) return null;
    const now = performance.now();
    if (backgroundCache.el === el && now - backgroundCache.at < 250 && (!backgroundCache.value || backgroundCache.value.image.complete)) {
        return backgroundCache.value;
    }
    backgroundCache = { el, at: now, value: readBackground(el) };
    return backgroundCache.value;
}

function readBackground(el) {
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
    if (!image.complete || !image.naturalWidth) return null;
    const box = el.getBoundingClientRect();
    return { image, opacity, width: box.width, height: box.height };
}

let mirror = null;

// Số giả ngẫu nhiên cố định theo chỉ số (mỗi dải sóng giữ nhịp riêng giữa các khung hình)
const hash = n => {
    const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return v - Math.floor(v);
};

// Hoa đăng: đế hoa sen giấy, nến cháy ở giữa
function floatLanternSprite() {
    if (sprites.floatLantern) return sprites.floatLantern;
    const c = document.createElement('canvas');
    c.width = 48;
    c.height = 40;
    const g = c.getContext('2d');
    const glow = g.createRadialGradient(24, 18, 1, 24, 18, 20);
    glow.addColorStop(0, 'rgba(255, 210, 120, 0.85)');
    glow.addColorStop(1, 'rgba(255, 150, 60, 0)');
    g.fillStyle = glow;
    g.fillRect(0, 0, 48, 40);
    // Cánh sen: ba lớp từ ngoài vào
    [[-15, 0.8, '#ff7fa8'], [-9, 0.95, '#ff9fbf'], [-3, 1, '#ffc6d9']].forEach(([spread, h, color], layer) => {
        g.fillStyle = color;
        [-1, 1].forEach(side => {
            g.beginPath();
            g.moveTo(24, 32);
            g.quadraticCurveTo(24 + side * (spread - 6) * -1, 30 - 10 * h, 24 + side * -spread * 0.6, 22 - layer * 2);
            g.quadraticCurveTo(24 + side * 4, 28, 24, 32);
            g.fill();
        });
    });
    g.fillStyle = '#ffb3cb';
    g.beginPath();
    g.ellipse(24, 32, 14, 4, 0, 0, Math.PI * 2);
    g.fill();
    // Ngọn nến
    g.fillStyle = '#fff3c4';
    g.beginPath();
    g.ellipse(24, 20, 2.2, 4, 0, 0, Math.PI * 2);
    g.fill();
    sprites.floatLantern = c;
    return c;
}

// ---------------------------------------------------------------------------
// Cuộc sống trên mặt nước: khúc gỗ trôi (sông), cò trắng bay xuống đậu lên khúc gỗ hoặc đáp xuống nước, cá nhảy.
// Tọa độ theo điểm ảnh CSS; vật trên nước dùng x và d (0 mép nước xa, 1 sát người xem): xa thì nhỏ và trôi chậm.
// ---------------------------------------------------------------------------
function logSprite() {
    if (sprites.log) return sprites.log;
    const c = document.createElement('canvas');
    c.width = 180;
    c.height = 40;
    const g = c.getContext('2d');
    const body = (x, y, w, h, r) => {
        g.beginPath();
        g.moveTo(x + r, y);
        g.lineTo(x + w - r, y);
        g.quadraticCurveTo(x + w, y, x + w, y + r);
        g.lineTo(x + w, y + h - r);
        g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        g.lineTo(x + r, y + h);
        g.quadraticCurveTo(x, y + h, x, y + h - r);
        g.lineTo(x, y + r);
        g.quadraticCurveTo(x, y, x + r, y);
        g.fill();
    };
    // Cành gãy chĩa lên
    g.fillStyle = '#3f2a1b';
    g.beginPath();
    g.moveTo(58, 12);
    g.lineTo(44, 1);
    g.lineTo(49, 0);
    g.lineTo(66, 11);
    g.fill();
    g.fillStyle = '#4a3020';
    body(4, 9, 164, 24, 11);
    g.fillStyle = '#6b4a2e';
    body(6, 10, 160, 9, 5);
    // Vỏ cây
    g.strokeStyle = 'rgba(28, 17, 9, 0.55)';
    g.lineWidth = 2;
    [[18, 15, 40], [70, 14, 34], [118, 16, 30], [30, 24, 46], [96, 25, 40], [140, 22, 18]].forEach(([x, y, w]) => {
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + w, y);
        g.stroke();
    });
    // Mặt cắt ở đầu khúc gỗ: vân gỗ
    g.fillStyle = '#b58a57';
    g.beginPath();
    g.ellipse(164, 21, 7, 12, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#7d5532';
    g.lineWidth = 1.2;
    [8, 4.5].forEach(r => {
        g.beginPath();
        g.ellipse(164, 21, r * 0.55, r, 0, 0, Math.PI * 2);
        g.stroke();
    });
    // Nửa dưới chìm trong nước: mờ dần
    g.globalCompositeOperation = 'destination-in';
    const sink = g.createLinearGradient(0, 0, 0, 40);
    sink.addColorStop(0, 'rgba(0, 0, 0, 1)');
    sink.addColorStop(0.55, 'rgba(0, 0, 0, 1)');
    sink.addColorStop(0.8, 'rgba(0, 0, 0, 0.25)');
    sink.addColorStop(1, 'rgba(0, 0, 0, 0)');
    g.fillStyle = sink;
    g.fillRect(0, 0, 180, 40);
    sprites.log = c;
    return c;
}

// Cò trắng (nhìn nghiêng, quay sang phải): cánh giơ lên, cụp xuống, liệng, đứng, bơi
function egretSprite(pose) {
    const key = 'egret_' + pose;
    if (sprites[key]) return sprites[key];
    const c = document.createElement('canvas');
    c.width = 48;
    c.height = 40;
    const g = c.getContext('2d');
    const white = '#e9ece6';
    const shade = '#b9bfb6';
    const beak = (x1, y1, x2, y2) => {
        g.strokeStyle = '#e0b030';
        g.lineWidth = 1.6;
        g.beginPath();
        g.moveTo(x1, y1);
        g.lineTo(x2, y2);
        g.stroke();
    };
    const blob = (x, y, rx, ry, color, rot = 0) => {
        g.fillStyle = color;
        g.beginPath();
        g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
        g.fill();
    };
    const poly = (points, color) => {
        g.fillStyle = color;
        g.beginPath();
        points.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
        g.closePath();
        g.fill();
    };
    if (pose === 'up' || pose === 'down' || pose === 'glide') {
        // Chân duỗi về sau, cổ co lại khi bay
        g.strokeStyle = '#2b2b2b';
        g.lineWidth = 1.4;
        g.beginPath();
        g.moveTo(16, 23);
        g.lineTo(5, 25);
        g.stroke();
        if (pose === 'up') poly([[18, 21], [28, 21], [17, 3], [12, 5]], shade);
        blob(23, 22, 9, 4, white);
        blob(32, 19, 3.4, 3, white);
        beak(35, 19, 43, 21);
        if (pose === 'down') poly([[18, 22], [28, 22], [19, 37], [14, 35]], white);
        if (pose === 'glide') poly([[13, 19], [32, 19], [26, 23], [16, 23]], white);
    } else if (pose === 'stand') {
        g.strokeStyle = '#2b2b2b';
        g.lineWidth = 1.4;
        g.beginPath();
        g.moveTo(21, 27);
        g.lineTo(20, 38);
        g.moveTo(24, 27);
        g.lineTo(25, 38);
        g.stroke();
        blob(22, 23, 8, 5, white, -0.3);
        blob(20, 25, 6, 3, shade, -0.3);
        // Cổ cong chữ S
        g.strokeStyle = white;
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(27, 19);
        g.quadraticCurveTo(31, 14, 28, 10);
        g.quadraticCurveTo(26, 7, 29, 6);
        g.stroke();
        blob(30, 6, 2.6, 2.3, white);
        beak(32, 6, 39, 7);
    } else {
        // Bơi: thân nổi trên mặt nước, cổ vươn lên
        blob(23, 27, 10, 5, white);
        blob(21, 29, 8, 3, shade);
        g.strokeStyle = white;
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(30, 25);
        g.quadraticCurveTo(34, 20, 32, 15);
        g.stroke();
        blob(33, 14, 2.6, 2.3, white);
        beak(35, 14, 42, 15);
        g.globalCompositeOperation = 'destination-in';
        const sink = g.createLinearGradient(0, 0, 0, 40);
        sink.addColorStop(0, 'rgba(0, 0, 0, 1)');
        sink.addColorStop(0.72, 'rgba(0, 0, 0, 1)');
        sink.addColorStop(0.82, 'rgba(0, 0, 0, 0)');
        g.fillStyle = sink;
        g.fillRect(0, 0, 48, 40);
    }
    sprites[key] = c;
    return c;
}

function fishSprite() {
    if (sprites.fish) return sprites.fish;
    const c = document.createElement('canvas');
    c.width = 34;
    c.height = 16;
    const g = c.getContext('2d');
    const silver = g.createLinearGradient(0, 2, 0, 14);
    silver.addColorStop(0, '#7f93a6');
    silver.addColorStop(0.45, '#e4ecf3');
    silver.addColorStop(1, '#a9b8c6');
    g.fillStyle = silver;
    g.beginPath();
    g.moveTo(9, 8);
    g.lineTo(1, 2);
    g.lineTo(3, 8);
    g.lineTo(1, 14);
    g.closePath();
    g.fill();
    g.beginPath();
    g.ellipse(19, 8, 12, 4.6, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#1d242c';
    g.beginPath();
    g.arc(26, 7, 1.2, 0, Math.PI * 2);
    g.fill();
    sprites.fish = c;
    return c;
}

const rand = (min, max) => min + Math.random() * (max - min);

const WaterLife = {
    key: '',
    logs: [],
    birds: [],
    fish: [],
    ripples: [],
    drops: [],
    next: { log: 0, bird: 0, fish: 0 },

    // Trôi theo dòng (điểm ảnh CSS / ms), khớp với các vệt sáng của mặt nước
    flow(d, river) {
        return river ? 0.03 * (0.4 + 1.2 * d) : 0;
    },

    scale(d) {
        return (0.6 + d * 1.1) * (IS_MOBILE ? 0.85 : 1);
    },

    reset(river, cssW) {
        this.logs = [];
        this.birds = [];
        this.fish = [];
        this.ripples = [];
        this.drops = [];
        const slow = IS_MOBILE ? 1.3 : 1;
        // Mở màn đã có sẵn một khúc gỗ đang trôi và một con cò sắp bay tới
        if (river) this.logs.push(this.makeLog(rand(0.18, 0.42) * cssW, rand(0.45, 0.8)));
        this.next = river
            ? { log: rand(9000, 16000) * slow, bird: rand(1500, 3000), fish: rand(2500, 4500) }
            : { log: Infinity, bird: rand(3000, 6000), fish: rand(3500, 6000) };
    },

    makeLog(x, d) {
        return { x, d, len: rand(95, 135), phase: Math.random() * 6, bird: null };
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

    update(dt, river, cssW, topCss, depthCss) {
        const slow = IS_MOBILE ? 1.3 : 1;
        // Khúc gỗ: trôi vào từ thượng nguồn (bên trái), ra khỏi khung thì bỏ
        this.next.log -= dt;
        if (this.next.log <= 0) {
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
        });
        this.logs = this.logs.filter(log => log.x - log.len * this.scale(log.d) < cssW + 30);

        // Cò: bay tới khúc gỗ đang trong khung (nếu còn chỗ) hoặc một điểm trên mặt nước
        this.next.bird -= dt;
        if (this.next.bird <= 0) {
            this.next.bird = (river ? rand(7000, 13000) : rand(9000, 16000)) * slow;
            if (this.birds.length < 2) {
                const dir = Math.random() < 0.5 ? 1 : -1;
                const free = this.logs.filter(log => !log.bird && log.x > cssW * 0.12 && log.x < cssW * 0.62);
                const bird = {
                    state: 'fly', dir, x: dir > 0 ? -24 : cssW + 24, y: topCss * rand(0.25, 0.6),
                    flap: Math.random() * 300, rest: rand(5000, 10000)
                };
                if (free.length && Math.random() < 0.7) {
                    bird.log = free[0];
                    free[0].bird = bird;
                    bird.ox = rand(0.35, 0.65) * free[0].len * this.scale(free[0].d);
                } else {
                    bird.d = rand(0.3, 0.8);
                    bird.tx = rand(0.2, 0.8) * cssW;
                }
                this.birds.push(bird);
            }
        }
        this.birds.forEach(bird => {
            bird.flap += dt;
            if (bird.state === 'fly') {
                const d = bird.log ? bird.log.d : bird.d;
                const s = this.scale(d);
                const tx = bird.log ? bird.log.x - bird.log.len * s + bird.ox : bird.tx;
                const ty = this.surfaceY(d, topCss, depthCss) - (bird.log ? 9 * s : 0);
                if (!bird.log) bird.tx += this.flow(d, river) * 0.6 * dt;
                const dx = tx - bird.x;
                const dy = ty - bird.y;
                const dist = Math.hypot(dx, dy);
                bird.dir = dx >= 0 ? 1 : -1;
                bird.near = dist < 70;
                const step = Math.min(dist, (bird.near ? 0.07 : 0.12) * dt);
                if (dist <= step + 0.5) {
                    bird.state = bird.log ? 'perch' : 'swim';
                    bird.x = tx;
                    bird.y = ty;
                    if (!bird.log) this.splash(bird.x, d, topCss, depthCss, 1);
                } else {
                    bird.x += dx / dist * step;
                    bird.y += dy / dist * step;
                }
            } else if (bird.state === 'perch' || bird.state === 'swim') {
                bird.rest -= dt;
                if (bird.log) {
                    const s = this.scale(bird.log.d);
                    bird.x = bird.log.x - bird.log.len * s + bird.ox;
                    bird.y = this.surfaceY(bird.log.d, topCss, depthCss) - 9 * s + Math.sin(bird.log.phase) * 0.6 * s;
                } else {
                    bird.x += (this.flow(bird.d, river) * 0.6 + bird.dir * 0.004) * dt;
                    bird.y = this.surfaceY(bird.d, topCss, depthCss) + Math.sin(bird.flap * 0.002) * 0.5;
                }
                // Hết giờ nghỉ, hoặc khúc gỗ sắp trôi ra khỏi khung: bay đi
                if (bird.rest <= 0 || bird.x > cssW - 15 || bird.x < 15) {
                    if (!bird.log) this.splash(bird.x, bird.d, topCss, depthCss, 0.7);
                    if (bird.log) bird.log.bird = null;
                    bird.state = 'leave';
                    bird.vx = bird.dir * 0.1;
                    bird.vy = -0.075;
                }
            } else {
                bird.x += bird.vx * dt;
                bird.y += bird.vy * dt;
                bird.vy = Math.max(-0.12, bird.vy - 0.00004 * dt);
            }
        });
        this.birds = this.birds.filter(bird => !(bird.state === 'leave' && (bird.y < -40 || bird.x < -40 || bird.x > cssW + 40)));

        // Cá nhảy: vọt lên khỏi mặt nước theo đường cong rồi lao xuống
        this.next.fish -= dt;
        if (this.next.fish <= 0) {
            this.next.fish = (river ? rand(3000, 7000) : rand(5000, 10000)) * slow;
            const d = rand(0.25, 0.9);
            const s = this.scale(d);
            const fish = { x: rand(0.1, 0.9) * cssW, d, t: 0, life: rand(650, 900), h: rand(16, 28) * s, dx: (Math.random() < 0.5 ? -1 : 1) * rand(16, 28) * s };
            this.fish.push(fish);
            this.splash(fish.x, d, topCss, depthCss, 0.8);
        }
        this.fish.forEach(fish => {
            fish.t += dt;
            fish.x += this.flow(fish.d, river) * dt;
            if (fish.t >= fish.life && !fish.done) {
                fish.done = true;
                this.splash(fish.x + fish.dx, fish.d, topCss, depthCss, 1);
            }
        });
        this.fish = this.fish.filter(fish => !fish.done);

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

    draw(ctx, k, topCss, depthCss, time) {
        ctx.setTransform(k, 0, 0, k, 0, 0);
        ctx.globalCompositeOperation = 'source-over';
        // Vòng sóng
        ctx.lineWidth = 1 / k;
        this.ripples.forEach(r => {
            if (r.age < 0) return;
            const p = r.age / r.life;
            const s = this.scale(r.d);
            const rx = r.r0 + p * 30 * s;
            ctx.globalAlpha = (1 - p) * 0.5;
            ctx.strokeStyle = 'rgb(205, 222, 255)';
            ctx.beginPath();
            ctx.ellipse(r.x, this.surfaceY(r.d, topCss, depthCss), rx, rx * 0.28, 0, 0, Math.PI * 2);
            ctx.stroke();
        });
        // Vật trên mặt nước, xa vẽ trước
        const things = [
            ...this.logs.map(log => ({ d: log.d, log })),
            ...this.birds.filter(b => b.state === 'perch' || b.state === 'swim').map(bird => ({ d: bird.log ? bird.log.d + 0.0001 : bird.d, bird }))
        ].sort((a, b) => a.d - b.d);
        things.forEach(({ log, bird }) => {
            if (log) {
                const s = this.scale(log.d);
                const w = log.len * s;
                const h = w * 40 / 180;
                const y = this.surfaceY(log.d, topCss, depthCss) + Math.sin(log.phase) * 0.6 * s;
                const sprite = logSprite();
                // Bóng in xuống nước
                ctx.save();
                ctx.globalAlpha = 0.22;
                ctx.translate(log.x - w, y + h * 0.25);
                ctx.scale(1, -0.6);
                ctx.drawImage(sprite, 0, -h, w, h);
                ctx.restore();
                ctx.save();
                ctx.globalAlpha = 0.95;
                ctx.translate(log.x - w / 2, y);
                ctx.rotate(Math.sin(log.phase * 0.7) * 0.02);
                ctx.drawImage(sprite, -w / 2, -h * 0.62, w, h);
                ctx.restore();
            } else {
                this.drawBird(ctx, bird, bird.log ? 'stand' : 'swim', this.scale(bird.log ? bird.log.d : bird.d));
            }
        });
        // Cá đang nhảy
        const fishImg = fishSprite();
        this.fish.forEach(fish => {
            const p = Math.min(1, fish.t / fish.life);
            const lift = 4 * fish.h * p * (1 - p);
            const x = fish.x + fish.dx * p;
            const y = this.surfaceY(fish.d, topCss, depthCss) - lift;
            const angle = Math.atan2(-4 * fish.h * (1 - 2 * p), fish.dx);
            const s = this.scale(fish.d);
            ctx.save();
            ctx.globalAlpha = 0.95;
            ctx.translate(x, y);
            ctx.rotate(angle);
            ctx.drawImage(fishImg, -13 * s, -6.1 * s, 26 * s, 12.2 * s);
            ctx.restore();
        });
        // Tia nước
        ctx.fillStyle = 'rgb(225, 236, 255)';
        this.drops.forEach(p => {
            ctx.globalAlpha = 0.8;
            ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        });
        // Cò đang bay (trên trời và lúc sà xuống)
        this.birds.forEach(bird => {
            if (bird.state !== 'fly' && bird.state !== 'leave') return;
            const pose = bird.state === 'fly' && bird.near ? 'glide' : Math.floor(bird.flap / 130) % 2 ? 'up' : 'down';
            const d = bird.log ? bird.log.d : bird.d ?? 0.5;
            this.drawBird(ctx, bird, pose, this.scale(d) * 1.05);
        });
        ctx.globalAlpha = 1;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
    },

    drawBird(ctx, bird, pose, s) {
        const sprite = egretSprite(pose);
        const w = 42 * s;
        const h = w * 40 / 48;
        ctx.save();
        ctx.globalAlpha = 0.95;
        ctx.translate(bird.x, bird.y);
        if (bird.dir < 0) ctx.scale(-1, 1);
        // Gốc vẽ: chân (đứng), mặt nước (bơi), thân (bay)
        const anchorY = pose === 'stand' ? 0.95 : pose === 'swim' ? 0.72 : 0.55;
        ctx.drawImage(sprite, -w / 2, -h * anchorY, w, h);
        // Đang bơi: bóng in mờ xuống nước
        if (pose === 'swim') {
            ctx.globalAlpha = 0.22;
            ctx.scale(1, -0.7);
            ctx.drawImage(sprite, -w / 2, -h * anchorY, w, h);
        }
        ctx.restore();
    }
};

export const Water = {
    drawn: false,
    frame: 0,
    last: 0,
    flow: 0,
    dashes: [],
    swells: [],
    dashKey: '',
    floats: [],
    floatKey: '',

    // sources: các canvas cùng kích thước khung (vẽ theo điểm ảnh CSS cssW x cssH); background: phần tử ảnh nền;
    // style: 'lake' hồ tĩnh lặng | 'river' sông chảy; floating: '' | 'lanterns' hoa đăng | 'petals' cánh hoa;
    // life: khúc gỗ trôi, cò, cá nhảy
    render(ctx, { sources, background, sky, cssW, cssH, time, style, floating, calm, life }) {
        const level = horizon();
        const { width: W, height: H } = ctx.canvas;
        if (level >= 1 || !W || !H) {
            if (this.drawn) ctx.clearRect(0, 0, W, H);
            this.drawn = false;
            return;
        }
        // Chất lượng 480p trở xuống: vẽ lại cách một khung hình
        if (isLowQuality && this.drawn && (++this.frame & 1)) return;
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
            const scale = Math.max(bg.width / bg.image.naturalWidth, bg.height / bg.image.naturalHeight);
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

        // 2. Nền nước: xanh đêm, sát chân trời sáng hơn (ánh trời đêm in xuống nước), sáng thêm theo màu pháo
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1;
        ctx.clearRect(0, 0, W, H);
        const tint = `${16 + sky.r * 0.5 | 0}, ${26 + sky.g * 0.5 | 0}, ${46 + sky.b * 0.5 | 0}`;
        const base = ctx.createLinearGradient(0, top, 0, H);
        base.addColorStop(0, `rgb(${tint})`);
        base.addColorStop(0.35, 'rgb(9, 15, 30)');
        base.addColorStop(1, 'rgb(3, 6, 13)');
        ctx.fillStyle = base;
        ctx.fillRect(0, top, W, depth);

        // 3. Bóng phản chiếu kiểu tranh điểm ảnh: mặt nước chia thành từng dải ngang, mỗi dải lệch một nấc theo nhịp
        //    sóng riêng. Sát bờ dải mỏng, lệch ít (gần như gương); càng xa bờ dải càng dày, lệch nhiều, mờ hơn.
        //    Sông thì sóng mạnh hơn và các vệt sáng trôi ngang theo dòng.
        const river = style === 'river';
        const dt = Math.min(50, this.last ? time - this.last : 16);
        this.last = time;
        this.flow += dt * (river ? 0.03 : 0.004);
        // Dải cao khoảng 2-3 điểm ảnh CSS dù lớp vẽ nét hay thưa (cùng dáng sóng, cùng số lần vẽ)
        const strip = Math.max(1, Math.round((IS_MOBILE ? 6 : 4) * k));
        // Ghép kiểu lighten như các lớp trên trang: phần đen (lớp vệt pháo được phủ đen dần) không làm tối mặt nước
        ctx.globalCompositeOperation = 'lighten';
        for (let y = 0, i = 0; y < depth; i++) {
            const d = y / depth;
            const band = Math.max(strip, Math.round((strip + d * (river ? 9 : 5) * k * 2) / strip) * strip);
            const phase = hash(i) * Math.PI * 2;
            const speed = 0.0008 + hash(i + 50) * 0.0016;
            const amp = (river ? 0.6 + d * 9 : 0.2 + d * 3) * k;
            const dx = Math.round((Math.sin(time * speed + phase) + 0.5 * Math.sin(time * speed * 1.7 + phase * 2)) * amp);
            // Khe tối ngang, càng xa bờ càng nhiều: bóng trăng, bóng pháo vỡ thành từng lát
            const gap = hash(i + 99) < 0.1 + d * 0.3 ? 0.35 : 1;
            ctx.globalAlpha = (river ? 0.6 * (1 - d * 0.6) : 0.78 * (1 - d * 0.5)) * gap;
            ctx.drawImage(mirror, 0, y, W, band, dx, top + y, W, band);
            y += band;
        }

        // 4. Ánh sáng in thành vệt dọc xuống nước (trăng, pháo sáng kéo dài như ngoài đời)
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, top, W, depth);
        ctx.clip();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.16;
        ctx.drawImage(mirror, 0, top + Math.round(3 * k));
        ctx.globalAlpha = 0.08;
        ctx.drawImage(mirror, 0, top + Math.round(7 * k));

        // 5. Dải sóng dài mờ trôi chậm (kết cấu mặt nước), rồi vệt sóng ngắn lấp lánh; vệt nào nằm chỗ có ánh pháo thì
        //    sáng rực lên. Gần chân trời vệt nhỏ, dày; gần người xem vệt dài, thưa (phối cảnh).
        this.syncDashes(river, cssW);
        const thin = Math.max(1, Math.round(k));
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = 'rgb(120, 150, 210)';
        this.swells.forEach(swell => {
            const x = (((swell.u * (cssW + 160) + this.flow * (river ? 0.25 + swell.d * 0.8 : 0.12)) % (cssW + 160)) - 80) * k;
            const row = top + Math.round(swell.d * (depth - 1) + Math.sin(time * swell.speed + swell.phase) * 2 * k);
            const len = swell.len * (0.4 + swell.d) * k;
            ctx.globalAlpha = (calm ? 0.07 : 0.04 + 0.05 * (0.5 + 0.5 * Math.sin(time * swell.speed * 1.3 + swell.phase))) * (1 - swell.d * 0.4);
            ctx.fillRect(x, row, len, thin);
        });
        this.dashes.forEach(dash => {
            const x = (((dash.u * (cssW + 40) + this.flow * (river ? 0.4 + dash.d * 1.2 : 0.3)) % (cssW + 40)) - 20) * k;
            const row = top + Math.round(dash.d * (depth - 1));
            const len = Math.max(1, dash.len * (0.5 + dash.d) * k);
            const twinkle = calm ? 0.6 : 0.2 + 0.8 * Math.pow(0.5 + 0.5 * Math.sin(time * dash.speed + dash.phase), 2);
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = twinkle * 0.42 * (1 - dash.d * 0.35);
            ctx.fillStyle = dash.color;
            ctx.fillRect(x, row, len, thin);
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = twinkle;
            ctx.drawImage(mirror, Math.max(0, x), row - top, len, 1, x, row, len, thin);
        });
        ctx.restore();

        // 6. Vật trôi trên nước: hoa đăng (tự phát sáng, in bóng), cánh hoa; xa bờ thì to và trôi nhanh hơn (gần người xem)
        this.syncFloats(floating, river);
        this.floats.forEach(item => {
            item.u += (river ? item.speed * (0.3 + item.d) : item.speed * 0.08) * dt / cssW;
            if (item.u > 1.05) item.u = -0.05;
            if (item.u < -0.05) item.u = 1.05;
            item.bob += dt * 0.0015;
            const x = item.u * cssW * k;
            const y = top + item.d * depth + Math.sin(item.bob) * k;
            const s = (0.35 + item.d * 0.9) * k * (IS_MOBILE ? 0.85 : 1);
            if (item.kind === 'lantern') {
                // Bóng ánh nến kéo dài xuống nước
                const glow = ctx.createRadialGradient(x, y + 6 * s, 0, x, y + 6 * s, 16 * s);
                glow.addColorStop(0, `rgba(255, 180, 90, ${calm ? 0.3 : 0.25 + Math.sin(item.bob * 3) * 0.05})`);
                glow.addColorStop(1, 'rgba(255, 150, 60, 0)');
                ctx.globalAlpha = 1;
                ctx.fillStyle = glow;
                ctx.save();
                ctx.translate(x, y + 6 * s);
                ctx.scale(1, 1.8);
                ctx.translate(-x, -(y + 6 * s));
                ctx.fillRect(x - 16 * s, y + 6 * s - 16 * s, 32 * s, 32 * s);
                ctx.restore();
                const sprite = floatLanternSprite();
                ctx.drawImage(sprite, x - 12 * s, y - 14 * s, 24 * s, 20 * s);
            } else {
                item.rot += dt * item.spin;
                ctx.save();
                ctx.translate(x, y);
                ctx.rotate(item.rot);
                ctx.globalAlpha = 0.85;
                ctx.fillStyle = item.color;
                ctx.beginPath();
                ctx.ellipse(0, 0, 2.6 * s, 1.5 * s, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
        });

        // 7. Khúc gỗ trôi, cò đậu, cá nhảy
        if (life) {
            const key = `${river}_${Math.round(cssW)}_${Math.round(cssH)}_${level}`;
            if (key !== WaterLife.key) {
                WaterLife.key = key;
                WaterLife.reset(river, cssW);
            }
            WaterLife.update(dt, river, cssW, horizonCss, depthCss);
            WaterLife.draw(ctx, k, horizonCss, depthCss, time);
        } else if (WaterLife.key) {
            WaterLife.key = '';
        }

        // 8. Mép nước sáng mảnh
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
        const line = ctx.createLinearGradient(0, 0, W, 0);
        line.addColorStop(0, 'rgba(150, 180, 230, 0)');
        line.addColorStop(0.5, 'rgba(150, 180, 230, 0.28)');
        line.addColorStop(1, 'rgba(150, 180, 230, 0)');
        ctx.fillStyle = line;
        ctx.fillRect(0, top, W, Math.max(1, k));
    },

    // Rải lại các vệt sáng khi đổi kiểu nước hoặc cỡ khung
    syncDashes(river, cssW) {
        const key = `${river}_${Math.round(cssW)}`;
        if (key === this.dashKey) return;
        this.dashKey = key;
        const count = Math.round((river ? 230 : 150) * (IS_MOBILE ? 0.6 : 1));
        // Ánh trăng, sao in xuống: phần lớn xanh bạc, thỉnh thoảng một vệt trắng ấm
        const colors = ['rgb(185, 205, 255)', 'rgb(205, 222, 255)', 'rgb(160, 190, 245)', 'rgb(255, 240, 215)'];
        this.dashes = Array.from({ length: count }, () => ({
            u: Math.random(),
            d: Math.pow(Math.random(), 1.2),
            len: MyMath.random(2, 12),
            phase: Math.random() * Math.PI * 2,
            speed: MyMath.random(0.0015, 0.005),
            color: colors[Math.random() < 0.12 ? 3 : (Math.random() * 3) | 0]
        }));
        this.swells = Array.from({ length: Math.round((river ? 70 : 50) * (IS_MOBILE ? 0.6 : 1)) }, () => ({
            u: Math.random(),
            d: Math.pow(Math.random(), 1.1),
            len: MyMath.random(30, 120),
            phase: Math.random() * Math.PI * 2,
            speed: MyMath.random(0.0004, 0.0012)
        }));
    },

    syncFloats(kind, river) {
        const key = `${kind}_${river}`;
        if (key === this.floatKey) return;
        this.floatKey = key;
        this.floats = [];
        if (kind === 'lanterns') {
            const count = IS_MOBILE ? 6 : 10;
            for (let i = 0; i < count; i++) {
                this.floats.push({ kind: 'lantern', u: Math.random(), d: MyMath.random(0.12, 0.9), speed: MyMath.random(0.012, 0.022), bob: Math.random() * 6 });
            }
        } else if (kind === 'petals') {
            const count = IS_MOBILE ? 22 : 38;
            const colors = ['#ff9ec4', '#ffc2d8', '#ffffff', '#ffb3c7'];
            for (let i = 0; i < count; i++) {
                this.floats.push({
                    kind: 'petal', u: Math.random(), d: MyMath.random(0.05, 0.95), speed: MyMath.random(0.015, 0.03),
                    bob: Math.random() * 6, rot: Math.random() * Math.PI, spin: MyMath.random(-0.0006, 0.0006),
                    color: colors[(Math.random() * colors.length) | 0]
                });
            }
        }
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
    frame: 0,

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
                    fill: `rgb(${STAR_COLORS[(Math.random() * STAR_COLORS.length) | 0]})`,
                    alpha: MyMath.random(0.45, 1),
                    twinkle: Math.random() * Math.PI * 2,
                    speed: MyMath.random(0.0015, 0.004)
                });
            }
            this.stars.sort((a, b) => (a.fill < b.fill ? -1 : a.fill > b.fill ? 1 : 0));
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

        // Sao: lấp lánh nhẹ, mờ dần sát chân trời. Xếp theo màu nên ít khi phải đổi màu vẽ.
        let fill = '';
        this.stars.forEach(star => {
            const x = (star.x + drift.x * 0.6 + this.width) % this.width;
            const y = star.y + drift.y * 0.6;
            const near = Math.min(1, Math.max(0, (ground - y) / (ground * 0.15)));
            const twinkle = calm ? 0.85 : 0.65 + 0.35 * Math.sin(star.twinkle + this.clock * star.speed);
            ctx.globalAlpha = star.alpha * twinkle * near;
            if (star.fill !== fill) {
                fill = star.fill;
                ctx.fillStyle = fill;
            }
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
