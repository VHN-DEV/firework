/*!
 * Trình diễn Pháo hoa – trình phát: cảnh vật (hàm dùng chung)
 * Phần bổ sung và chỉnh sửa © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Hàm dùng chung của cảnh vật: nhiễu, ảnh vẽ sẵn (nét gấp SPRITE_HD), quầng sáng, tô màu ảnh, tuyết đọng lên mặt trên
// vật, đốm sáng đom đóm. Số ngẫu nhiên theo hạt giống, tạo canvas: player/utils.js.

import { makeCanvas, seededRandom } from '../utils.js';

// Số giả ngẫu nhiên cố định theo chỉ số (mỗi dải sóng giữ nhịp riêng giữa các khung hình)
export const hash = n => {
    const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return v - Math.floor(v);
};

// Ảnh nhỏ vẽ sẵn (hoa đăng, đèn trời, khinh khí cầu) dựng nét gấp SPRITE_HD so với cỡ thiết kế: đủ cho màn hình nét gấp 3
// và mức vẽ dư, vẽ ra không bị phóng to (nhòe)
const SPRITE_HD = 4;

// Ảnh vẽ sẵn nằm ở bộ nhớ thường (không phải card đồ họa): vẽ thu nhỏ mịn (imageSmoothingQuality 'medium', cần mipmap) từ
// canvas trên card đồ họa thì mỗi lần vẽ Chrome phải chép cả ảnh ra một bản có mipmap (vài chục lần mỗi khung với đèn trời,
// khinh khí cầu, ~1 ms mỗi lần trên card tích hợp); ảnh ở bộ nhớ thường được tải lên một lần, dựng mipmap một lần rồi dùng lại
export const SPRITE_OPTS = { willReadFrequently: true };

export const hdSprite = (w, h) => {
    const [c, g] = makeCanvas(w * SPRITE_HD, h * SPRITE_HD, SPRITE_OPTS);
    g.scale(SPRITE_HD, SPRITE_HD);
    return [c, g];
};

export const rand = (min, max) => min + Math.random() * (max - min);

let bankNoiseFn = null;

export const bankNoise = () => bankNoiseFn || (bankNoiseFn = makeNoise(57));

// Đốm sáng mềm của đom đóm (vẽ cộng sáng, phóng to thu nhỏ theo cỡ)
export function fireflyGlow() {
    if (sprites.firefly) return sprites.firefly;
    const [c, g] = makeCanvas(32, 32);
    const glow = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    glow.addColorStop(0, 'rgba(235, 255, 170, 1)');
    glow.addColorStop(0.18, 'rgba(200, 245, 120, 0.75)');
    glow.addColorStop(0.5, 'rgba(150, 220, 80, 0.18)');
    glow.addColorStop(1, 'rgba(120, 200, 60, 0)');
    g.fillStyle = glow;
    g.fillRect(0, 0, 32, 32);
    sprites.firefly = c;
    return c;
}

// ---------------------------------------------------------------------------
// Các kiểu bờ khác (bank-styles.js): kè gạch có lan can và đèn đường, kè đá liễu rủ, bãi cát hàng dừa, phố cổ đèn lồng,
// cầu vòm đá, thành phố về đêm, biển khơi. Thân bờ (dưới chân trời) vẽ từng điểm ảnh ở lớp mặt nước (BANK_BODIES qua
// bankSprite); phần nhô lên trời vẽ ở lớp bầu trời (BANK_SKYLINES) để mặt nước soi được bóng. Phần đứng yên vẽ sẵn một
// lần theo cỡ khung; liễu, dừa đung đưa theo gió (dựng sẵn nhiều mức ngả), đèn lồng đung đưa, dải đèn đổi màu vẽ mỗi khung.
// ---------------------------------------------------------------------------

// Quầng sáng tròn mềm (đèn, cửa sổ sáng): rgb dạng 'r, g, b'
export function radialGlow(g, x, y, r, rgb, a) {
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(${rgb}, ${a})`);
    grad.addColorStop(0.15, `rgba(${rgb}, ${a * 0.6})`);
    grad.addColorStop(0.4, `rgba(${rgb}, ${a * 0.2})`);
    grad.addColorStop(0.7, `rgba(${rgb}, ${a * 0.05})`);
    grad.addColorStop(1, `rgba(${rgb}, 0)`);
    g.fillStyle = grad;
    g.fillRect(x - r, y - r, r * 2, r * 2);
}

// Tuyết đọng: đắp một lớp tuyết lên mặt trên của mọi thứ đã vẽ trong vùng (x, y, w, h: điểm ảnh thật) của canvas: điểm có
// hình mà ngay phía trên trống (mặt trên cành cây, lan can, mái nhà, mặt cầu, đá) thì phủ tuyết dày vài điểm ảnh, dày mỏng
// lốm đốm, mép tuyết nhô lên khỏi mặt vật; vật mảnh (cành nhỏ) chỉ phủ nửa trên; cạnh dốc đứng (thân cây, cột) đọng ít.
// k: mật độ điểm ảnh (độ dày tính theo điểm ảnh CSS)
export function snowCap(canvas, x, y, w, h, k, depth = 1.4) {
    x = Math.max(0, Math.floor(x));
    y = Math.max(0, Math.floor(y));
    w = Math.min(canvas.width - x, Math.ceil(w));
    h = Math.min(canvas.height - y, Math.ceil(h));
    if (w <= 0 || h <= 1) return;
    const g = canvas.getContext('2d');
    const img = g.getImageData(x, y, w, h);
    const d = img.data;
    const alpha = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) alpha[i] = d[i * 4 + 3];
    const noise = bankNoise();
    const deep = Math.max(1, depth * k);
    for (let px = 0; px < w; px++) {
        for (let py = 1; py < h; py++) {
            const i = py * w + px;
            if (alpha[i] < 140 || alpha[i - w] > 60) continue;
            // Độ dày của vật ở cột này (vật mảnh chỉ phủ nửa trên)
            let run = 0;
            while (py + run < h && alpha[i + run * w] >= 100 && run < deep * 3) run++;
            const left = px > 0 ? alpha[i - w - 1] : 0;
            const right = px < w - 1 ? alpha[i - w + 1] : 0;
            const steep = (left > 140 ? 1 : 0) + (right > 140 ? 1 : 0);
            const X = (x + px) / k;
            const thick = Math.min(run * 0.6, deep * (0.55 + 0.7 * noise(X / 3.2, (y + py) / k / 7)) * (steep ? 0.4 : 1));
            for (let t = 0; t < thick; t++) {
                const o = (i + t * w) * 4;
                const a = Math.min(1, thick - t) * 0.94;
                const shade = 1 - 0.18 * t / Math.max(1, thick);
                d[o] = d[o] * (1 - a) + 196 * shade * a;
                d[o + 1] = d[o + 1] * (1 - a) + 204 * shade * a;
                d[o + 2] = d[o + 2] * (1 - a) + 222 * shade * a;
            }
            const o = (i - w) * 4;
            const up = Math.min(230, 190 * Math.min(1, thick / 2.2));
            if (up > d[o + 3]) {
                d[o] = 200;
                d[o + 1] = 208;
                d[o + 2] = 226;
                d[o + 3] = up;
            }
        }
    }
    g.putImageData(img, x, y);
}

// Tô màu một ảnh (giữ hình, thay màu) vào canvas tạm dùng chung
let tintCache = null;

export function tintCanvas(src, color) {
    if (!tintCache) tintCache = document.createElement('canvas');
    if (tintCache.width < src.width || tintCache.height < src.height) {
        tintCache.width = Math.max(tintCache.width, src.width);
        tintCache.height = Math.max(tintCache.height, src.height);
    }
    const g = tintCache.getContext('2d');
    g.globalCompositeOperation = 'copy';
    g.drawImage(src, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = color;
    g.fillRect(0, 0, src.width, src.height);
    g.globalCompositeOperation = 'source-over';
    return tintCache;
}

// Ánh pháo rọi lên cảnh vật bên kia mặt nước (cầu, nhà, kè, bờ đất, cây, cỏ và bóng của chúng dưới nước): vật sáng thêm
// theo chính màu của nó nhân màu ánh pháo như ngoài đời (mặt đá sáng nhiều; mạch vữa, khe tối, lá cây sẫm sáng ít), mọi
// vật cùng chỗ sáng lên như nhau. sky: màu trời đang ửng theo pháo ({ r, g, b }), hoặc hàm (u, out) cho màu trời trên mép
// nước tại u (0: mép trái, 1: mép phải khung; sky-light.js horizonLight) để chỗ ngay dưới quả nổ sáng hơn chỗ xa; trả màu
// ánh pháo (chuỗi màu, hoặc các mốc màu [u, màu] theo bề ngang), null khi trời chưa sáng tới mức thấy được
const FIRE_LIGHT = 5.5;
const LIGHT_STOPS = 16;

const lightColor = sky => `rgb(${Math.min(255, sky.r * FIRE_LIGHT) | 0}, ${Math.min(255, sky.g * FIRE_LIGHT) | 0}, ${Math.min(255, sky.b * FIRE_LIGHT) | 0})`;

export function fireLight(sky) {
    if (!sky) return null;
    if (typeof sky !== 'function') return sky.r + sky.g + sky.b < 4 ? null : lightColor(sky);
    const stops = [];
    const at = { r: 0, g: 0, b: 0 };
    let lit = false;
    for (let i = 0; i <= LIGHT_STOPS; i++) {
        sky(i / LIGHT_STOPS, at);
        if (at.r + at.g + at.b >= 4) lit = true;
        stops.push([i / LIGHT_STOPS, lightColor(at)]);
    }
    return lit ? stops : null;
}

// Màu tô ánh pháo trên canvas g rộng w điểm ảnh (ảnh trải hết bề ngang khung): một màu, hoặc dải màu ngang
function lightFill(g, light, w) {
    if (typeof light === 'string') return light;
    const gradient = g.createLinearGradient(0, 0, w, 0);
    light.forEach(([u, color]) => gradient.addColorStop(u, color));
    return gradient;
}

// Phần ánh pháo light (fireLight) hắt lên ảnh src (vùng sx, sy, sw, sh, điểm ảnh thật; vùng trải hết bề ngang khung) vào
// canvas tạm dùng chung, để cộng sáng ngay lên chỗ đã vẽ ảnh. Lót đen trước khi nhân màu: mép mờ của vật (lá cây, ngọn cỏ) không hóa viền sáng màu pháo
let litCache = null;

export function litCanvas(src, light, sx = 0, sy = 0, sw = src.width, sh = src.height) {
    if (!litCache) litCache = document.createElement('canvas');
    if (litCache.width < sw || litCache.height < sh) {
        litCache.width = Math.max(litCache.width, sw);
        litCache.height = Math.max(litCache.height, sh);
    }
    const g = litCache.getContext('2d');
    g.globalCompositeOperation = 'copy';
    g.fillStyle = '#000';
    g.fillRect(0, 0, sw, sh);
    g.globalCompositeOperation = 'source-over';
    g.drawImage(src, sx, sy, sw, sh, 0, 0, sw, sh);
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = lightFill(g, light, sw);
    g.fillRect(0, 0, sw, sh);
    g.globalCompositeOperation = 'destination-in';
    g.drawImage(src, sx, sy, sw, sh, 0, 0, sw, sh);
    g.globalCompositeOperation = 'source-over';
    return litCache;
}

// Vẽ các vật paint(g) vẽ (cây, cầu, nhà, cỏ đung đưa) lên ctx và rọi ánh pháo light (fireLight) lên chúng. Có ánh pháo
// thì vẽ một lần vào canvas tạm cùng hệ tọa độ (dải từ top, cao height điểm ảnh CSS: phải chứa trọn các vật), chép lên
// ctx rồi cộng phần ánh pháo hắt lên tính từ chính canvas đó: vẽ thẳng lên ctx rồi vẽ lại lần nữa để tính ánh pháo thì tốn
// gấp đôi (vài trăm khóm cỏ, cây mỗi khung)
let paintCache = null;

export function fireLit(ctx, light, top, height, paint) {
    const k = ctx.getTransform().a || 1;
    const W = ctx.canvas.width;
    const y = Math.round(top * k);
    const H = Math.ceil(height * k);
    if (!light || !W || H <= 0) {
        paint(ctx);
        return;
    }
    if (!paintCache) paintCache = document.createElement('canvas');
    if (paintCache.width < W || paintCache.height < H) {
        paintCache.width = Math.max(paintCache.width, W);
        paintCache.height = Math.max(paintCache.height, H);
    }
    const g = paintCache.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    g.clearRect(0, 0, W, H);
    g.setTransform(k, 0, 0, k, 0, -y);
    paint(g);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.drawImage(paintCache, 0, 0, W, H, 0, y, W, H);
    const lit = litCanvas(paintCache, light, 0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(lit, 0, 0, W, H, 0, y, W, H);
    ctx.restore();
}

// Ảnh vẽ từng điểm ảnh (khúc gỗ, đá, gò đất) tốn vài chục mili giây mỗi ảnh nên dựng thành từng đoạn: cần ngay thì
// dựng một mạch, còn lại dựng dần lúc máy rảnh (warmWaterSprites) để vật mới trôi vào không làm khựng khung hình
export function built(key, make) {
    if (!sprites[key]) {
        const job = make();
        let step = job.next();
        while (!step.done) step = job.next();
        sprites[key] = step.value;
    }
    return sprites[key];
}

// ---------------------------------------------------------------------------
// Trang trí bầu trời: đèn trời, khinh khí cầu
// ---------------------------------------------------------------------------
export const sprites = {};

// Nhiễu mượt (value noise) theo hạt giống: dựng hình mây tự nhiên, mép xơ, dày mỏng không đều
export function makeNoise(seed) {
    const rnd = seededRandom(seed);
    const p = Array.from({ length: 256 }, (_, i) => i);
    for (let i = 255; i > 0; i--) {
        const j = (rnd() * (i + 1)) | 0;
        [p[i], p[j]] = [p[j], p[i]];
    }
    const perm = new Uint8Array(512);
    for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
    const val = (x, y) => perm[perm[x & 255] + (y & 255)] / 255;
    return (x, y) => {
        const ix = Math.floor(x);
        const iy = Math.floor(y);
        const fx = x - ix;
        const fy = y - iy;
        const u = fx * fx * (3 - 2 * fx);
        const v = fy * fy * (3 - 2 * fy);
        const a = val(ix, iy);
        const b = val(ix + 1, iy);
        const c = val(ix, iy + 1);
        const d = val(ix + 1, iy + 1);
        return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    };
}

// Nhiễu nhiều lớp (to tới nhỏ): khối mây lớn có gợn nhỏ, mép xơ
export function fbm(noise, x, y, octaves = 5) {
    let sum = 0;
    let amp = 0.5;
    let f = 1;
    let total = 0;
    for (let o = 0; o < octaves; o++) {
        sum += amp * noise(x * f, y * f);
        total += amp;
        amp *= 0.5;
        f *= 2.03;
    }
    return sum / total;
}

export const smooth01 = (a, b, x) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
};
