/*!
 * Trình diễn Pháo hoa – trình phát: khói pháo
 * Phần bổ sung và chỉnh sửa © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Khói pháo (kịch bản chọn "Nhẹ" hoặc "Dày"): đám khói tại chỗ nổ và vệt khói dọc đường bay, nở dần, trôi theo gió
// rồi tan. Khói được quả vừa nổ rọi màu (kể cả đám khói cũ của quả trước) và sáng theo màu trời.
// Vẽ trên lớp canvas riêng nằm dưới lớp pháo, độ phân giải thấp (khói vốn mờ) và có giới hạn số đám để máy yếu không giật.

import MyMath from '../MyMath.js';
import { COLOR_TUPLES } from './colors.js';
import { IS_MOBILE, INVISIBLE } from './env.js';
import { smokeLevel } from './state.js';
import { makeCanvas } from './utils.js';

// Độ phân giải lớp khói so với điểm ảnh CSS (không nhân mật độ điểm ảnh của màn hình)
export const SMOKE_RESOLUTION = 0.5;

const LEVELS = {
    // Nhẹ: thoáng qua, không che bầu trời
    1: { burstPuffs: 9, burstLife: [4000, 6500], burstAlpha: 0.16, trailEvery: 60, trailLife: [1500, 2500], trailAlpha: 0.12, max: 200 },
    // Dày: đám khói đặc, lâu tan như màn pháo thật
    2: { burstPuffs: 15, burstLife: [6500, 10000], burstAlpha: 0.19, trailEvery: 34, trailLife: [2500, 4200], trailAlpha: 0.17, max: 360 }
};

// Ánh sáng quả nổ rọi lên khói: tắt dần trong ~1,1 giây
const LIGHT_LIFE = 1100;
// Màu trời lớn nhất (Ánh sáng bầu trời "Bình thường") để quy ra độ sáng của khói
const SKY_FULL = 30;

const puffs = [];
const lights = [];
// Gió thổi cả màn trình diễn về một phía (điểm ảnh/ms), đổi nhẹ theo thời gian
const windDir = Math.random() < 0.5 ? -1 : 1;
const windBase = MyMath.random(0.006, 0.012);
let clock = 0;
let drawnLastFrame = false;
let frame = 0;

// Vài mẫu đám khói lổn nhổn (nhiều cụm nhỏ chồng lên nhau) để khói không thành những hình tròn trơn
const SPRITE_SIZE = 96;
let sprites = null;
function getSprites() {
    if (sprites) return sprites;
    sprites = [];
    for (let v = 0; v < 4; v++) {
        const [canvas, ctx] = makeCanvas(SPRITE_SIZE, SPRITE_SIZE);
        const c = SPRITE_SIZE / 2;
        for (let k = 0; k < 9; k++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = k === 0 ? 0 : MyMath.random(0.12, 0.32) * SPRITE_SIZE;
            const x = c + Math.cos(angle) * dist;
            const y = c + Math.sin(angle) * dist;
            const r = (k === 0 ? 0.36 : MyMath.random(0.14, 0.24)) * SPRITE_SIZE;
            const g = ctx.createRadialGradient(x, y, 0, x, y, r);
            g.addColorStop(0, `rgba(175, 175, 186, ${k === 0 ? 0.75 : 0.5})`);
            g.addColorStop(0.55, 'rgba(165, 165, 176, 0.22)');
            g.addColorStop(1, 'rgba(160, 160, 170, 0)');
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
        }
        sprites.push(canvas);
    }
    return sprites;
}

// Pha thêm trắng: khói thật trắng xám, chỉ ngả màu chứ không nhuộm đặc
const towardWhite = (value, mix) => value + (255 - value) * mix | 0;

function colorTuple(color) {
    if (Array.isArray(color)) color = color[0];
    if (typeof color !== 'string' || color === INVISIBLE) return { r: 255, g: 200, b: 140 };
    if (COLOR_TUPLES[color]) return COLOR_TUPLES[color];
    const hex = color.match(/^#([0-9a-f]{6})$/i);
    if (hex) {
        const n = parseInt(hex[1], 16);
        return { r: n >> 16, g: (n >> 8) & 255, b: n & 255 };
    }
    const rgb = color.match(/\d+/g);
    if (color.startsWith('rgb') && rgb) return { r: +rgb[0], g: +rgb[1], b: +rgb[2] };
    return { r: 255, g: 220, b: 180 };
}

function settingsFor(level) {
    return LEVELS[level] || null;
}

function cap(set) {
    return IS_MOBILE ? Math.round(set.max * 0.45) : set.max;
}

function addPuff(puff) {
    const set = settingsFor(smokeLevel());
    const limit = cap(set);
    // Quá nhiều: đám cũ nhất tan nhanh (nửa giây) thay vì biến mất đột ngột; vượt hẳn thì bỏ
    if (puffs.length >= limit) {
        const oldest = puffs.find(p => p.life > p.age + 500);
        if (oldest) oldest.life = oldest.age + 500;
        if (puffs.length >= limit * 1.25) return;
    }
    puffs.push(puff);
}

export const Smoke = {
    active() {
        return smokeLevel() > 0;
    },

    // Quả pháo nổ: đám khói quanh tâm nổ + ánh sáng rọi lên khói gần đó
    burst(x, y, spreadSize, color) {
        const set = settingsFor(smokeLevel());
        if (!set || !Number.isFinite(x) || !Number.isFinite(y)) return;
        const size = Math.max(120, Math.min(900, spreadSize || 300));
        const radius = size * 0.42;
        const count = Math.round(set.burstPuffs * MyMath.clamp(size / 400, 0.6, 1.4) * (IS_MOBILE ? 0.7 : 1));
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = radius * Math.sqrt(Math.random());
            addPuff({
                x,
                y,
                // Bung ra theo các hạt rồi chậm dần (quãng đi = v * 450ms)
                vx: Math.cos(angle) * dist / 450,
                vy: Math.sin(angle) * dist / 450,
                r0: size * MyMath.random(0.07, 0.12),
                grow: MyMath.random(1.2, 2),
                sprite: (Math.random() * 4) | 0,
                age: -Math.random() * 250,
                life: MyMath.random(set.burstLife[0], set.burstLife[1]),
                alpha: set.burstAlpha * MyMath.random(0.75, 1.15),
                rise: MyMath.random(0.001, 0.003)
            });
        }
        if (lights.length > 12) lights.shift();
        lights.push({ x, y, radius: size * 1.15, color: colorTuple(color), age: 0 });
    },

    // Vệt khói dọc đường bay của quả pháo đang lên (gọi mỗi khung hình cho từng quả)
    trail(star, timeStep) {
        const set = settingsFor(smokeLevel());
        if (!set || star.color === INVISIBLE) return;
        star.smokeTimer = (star.smokeTimer || 0) - timeStep;
        if (star.smokeTimer > 0) return;
        star.smokeTimer = set.trailEvery * (IS_MOBILE ? 2 : 1);
        addPuff({
            x: star.x,
            y: star.y,
            vx: MyMath.random(-0.01, 0.01),
            vy: MyMath.random(-0.004, 0.006),
            r0: MyMath.random(5, 9) * (IS_MOBILE ? 1.3 : 1),
            grow: MyMath.random(2.5, 4),
            sprite: (Math.random() * 4) | 0,
            age: 0,
            life: MyMath.random(set.trailLife[0], set.trailLife[1]),
            alpha: set.trailAlpha,
            rise: 0.002
        });
    },

    // scriptOff: kịch bản không có khói (vd vừa tắt trong builder) thì bỏ ngay khói đang có. Tắt vì chất lượng 480p trở xuống
    // (tự động hạ giữa chừng) thì không sinh khói mới, khói đang có vẫn tan dần.
    update(timeStep, scriptOff) {
        if (!smokeLevel() && (scriptOff || !puffs.length)) {
            if (puffs.length || lights.length) this.clear();
            return;
        }
        clock += timeStep;
        const wind = windDir * windBase * (1 + 0.35 * Math.sin(clock / 7000));
        const drag = Math.exp(-timeStep / 450);
        for (let i = puffs.length - 1; i >= 0; i--) {
            const p = puffs[i];
            p.age += timeStep;
            if (p.age >= p.life) {
                puffs.splice(i, 1);
                continue;
            }
            p.x += (p.vx + wind) * timeStep;
            p.y += (p.vy - p.rise) * timeStep;
            p.vx *= drag;
            p.vy *= drag;
        }
        for (let i = lights.length - 1; i >= 0; i--) {
            lights[i].age += timeStep;
            if (lights[i].age >= LIGHT_LIFE) lights.splice(i, 1);
        }
    },

    // scale: điểm ảnh canvas trên mỗi đơn vị sân khấu; sky: màu trời hiện tại; reduceFlashing: không rọi chớp lên khói
    render(ctx, scale, sky, reduceFlashing) {
        const { width, height } = ctx.canvas;
        if (!puffs.length) {
            if (drawnLastFrame) ctx.clearRect(0, 0, width, height);
            drawnLastFrame = false;
            return;
        }
        // Điện thoại: khói trôi rất chậm nên vẽ lại cách một khung hình là đủ, đỡ một nửa công vẽ
        if (IS_MOBILE && drawnLastFrame && (++frame & 1)) return;
        drawnLastFrame = true;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, width, height);
        ctx.setTransform(scale, 0, 0, scale, 0, 0);
        ctx.globalCompositeOperation = 'source-over';
        const images = getSprites();
        puffs.forEach(p => {
            if (p.age < 0) return;
            const t = p.age / p.life;
            const fadeIn = Math.min(1, p.age / 500);
            const fadeOut = 1 - Math.pow(t, 1.6);
            const r = p.r0 * (1 + p.grow * Math.sqrt(t));
            ctx.globalAlpha = Math.max(0, p.alpha * fadeIn * fadeOut);
            ctx.drawImage(images[p.sprite], p.x - r, p.y - r, r * 2, r * 2);
        });
        ctx.globalAlpha = 1;

        // Rọi màu: chỉ tô lên chỗ đã có khói (source-atop), giữ nguyên độ đặc của khói
        ctx.globalCompositeOperation = 'source-atop';
        const skyMax = Math.max(sky.r, sky.g, sky.b);
        if (skyMax > 0.5) {
            const r = towardWhite(sky.r / skyMax * 255, 0.45);
            const g = towardWhite(sky.g / skyMax * 255, 0.45);
            const b = towardWhite(sky.b / skyMax * 255, 0.45);
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${Math.min(0.28, skyMax / SKY_FULL * 0.28)})`;
            ctx.fillRect(0, 0, width / scale, height / scale);
        }
        if (!reduceFlashing) {
            lights.forEach(light => {
                const strength = Math.pow(1 - light.age / LIGHT_LIFE, 2);
                const r = towardWhite(light.color.r, 0.25);
                const g = towardWhite(light.color.g, 0.25);
                const b = towardWhite(light.color.b, 0.25);
                const gradient = ctx.createRadialGradient(light.x, light.y, 0, light.x, light.y, light.radius);
                gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${0.65 * strength})`);
                gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
                ctx.fillStyle = gradient;
                ctx.fillRect(light.x - light.radius, light.y - light.radius, light.radius * 2, light.radius * 2);
            });
        }
        ctx.globalCompositeOperation = 'source-over';
        ctx.setTransform(1, 0, 0, 1, 0, 0);
    },

    clear() {
        puffs.length = 0;
        lights.length = 0;
    },

    count() {
        return puffs.length;
    }
};
