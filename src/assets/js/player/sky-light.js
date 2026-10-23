/*!
 * Trình diễn Pháo hoa – trình phát: ánh pháo trên trời theo chỗ nổ
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Ánh pháo trên trời như ngoài đời: hạt pháo, tia lửa đang cháy rọi sáng hơi nước, bụi khói quanh nó nên trời sáng nhất
// quanh chỗ pháo nổ, nhạt dần ra xa (phần sáng đều cả trời do ánh sáng tán trong không khí: sky-color.js). Gom ánh sáng của
// các hạt vào một lưới thô, làm nhòe hình chuông, mượt dần theo thời gian như màu trời, rồi vẽ ra một canvas độ phân giải
// thấp để trình duyệt phóng mịn lên cả khung (ánh trời vốn rất mịn nên không cần vẽ nét). Có mặt nước thì chỉ vẽ phần
// trời; mặt nước soi bóng canvas này như soi các lớp khác (water.js). Cảnh vật ven bờ, mây đọc ánh sáng tại chỗ qua
// skyLightAt, horizonLight.
// Tọa độ x, y: điểm ảnh sân khấu (cùng hệ với hạt pháo); u, v: 0-1 theo bề ngang, bề dọc khung.

import { IS_MOBILE } from './env.js';

// Bề rộng vầng sáng quanh chỗ nổ (độ lệch chuẩn của hình chuông, điểm ảnh sân khấu), cỡ một quả pháo
const SIGMA = IS_MOBILE ? 180 : 270;
// Ô lưới: 1/5 bề rộng vầng sáng; nhân nhòe dài 3 lần bề rộng mỗi bên
const CELL = SIGMA / 5;
const TAPS = 15;
const KERNEL = Array.from({ length: TAPS * 2 + 1 }, (_, i) => Math.exp(-((i - TAPS) ** 2) / 50));
// Số hạt (đã tính độ gần) để vầng sáng sáng hết mức; độ sáng vầng sáng so với độ sáng tối đa của màu trời
const FULL = 200;
const LOCAL = 0.9;
// Màu chớp lúc nổ (trắng ấm), như màu trời chợt lóe trong sky-color.js
const FLASH = [1, 0.86, 0.66];
// Canvas vẽ ra: mỗi điểm ảnh 4 điểm ảnh sân khấu (máy yếu 8), rộng tối đa 512, trình duyệt phóng mịn lên cả khung. Cộng
// nhiễu nhỏ hơn một bậc màu trước khi làm tròn (hòa nhiễu): trời tối chuyển màu rất chậm, làm tròn thẳng thì các bậc màu
// 8 bit thành vệt sọc, viền đa giác thấy rõ. Nhiễu ngẫu nhiên đều dựng sẵn một lần (nhiễu có quy luật thì chỗ trời gần
// tối thành hoa văn chấm, vòng tròn)
const PIXEL = 4;
const MAX_OUT = 512;
const DITHER = (() => {
    let seed = 7;
    return Float32Array.from({ length: 64 * 64 }, () => {
        seed = (seed * 1103515245 + 12345) % 2147483648;
        return seed / 2147483648 - 0.5;
    });
})();

let gw = 0;
let gh = 0;
// acc: ánh sáng gom trong khung (mỗi ô 4 kênh: sức sáng, đỏ, lục, lam); tmp: lượt nhòe ngang; cur: vầng sáng đang hiện
// (đỏ, lục, lam, đơn vị màu trời), mượt dần theo thời gian
let acc = null;
let tmp = null;
let cur = null;
let stageW = 1;
let stageH = 1;
let horizonY = 1;
const base = { r: 0, g: 0, b: 0 };
let drawn = false;
let image = null;
// Trọng số nội suy giữa các ô cho từng cột, hàng của canvas vẽ ra (dựng lại khi đổi cỡ); số hàng trời đã vẽ (trên mép nước)
let layout = { key: '' };
let skyRows = 0;

// Ánh sáng tại (x, y) (nội suy giữa các ô), cộng vào out ({ r, g, b }) với hệ số k
function sample(x, y, k, out) {
    const fx = Math.max(0, Math.min(gw - 1, x / CELL - 0.5));
    const fy = Math.max(0, Math.min(gh - 1, y / CELL - 0.5));
    const x0 = fx | 0;
    const y0 = fy | 0;
    const x1 = Math.min(gw - 1, x0 + 1);
    const y1 = Math.min(gh - 1, y0 + 1);
    const tx = fx - x0;
    const ty = fy - y0;
    const w00 = (1 - tx) * (1 - ty) * k, w10 = tx * (1 - ty) * k, w01 = (1 - tx) * ty * k, w11 = tx * ty * k;
    const i00 = (y0 * gw + x0) * 3, i10 = (y0 * gw + x1) * 3, i01 = (y1 * gw + x0) * 3, i11 = (y1 * gw + x1) * 3;
    out.r += cur[i00] * w00 + cur[i10] * w10 + cur[i01] * w01 + cur[i11] * w11;
    out.g += cur[i00 + 1] * w00 + cur[i10 + 1] * w10 + cur[i01 + 1] * w01 + cur[i11 + 1] * w11;
    out.b += cur[i00 + 2] * w00 + cur[i10 + 2] * w10 + cur[i01 + 2] * w01 + cur[i11 + 2] * w11;
    return out;
}

// Nhòe một chiều 4 kênh từ src sang dst (dọc theo hàng: step 4, dọc theo cột: step gw * 4)
function blur(src, dst, horizontal) {
    const len = horizontal ? gw : gh;
    const lines = horizontal ? gh : gw;
    for (let line = 0; line < lines; line++) {
        for (let p = 0; p < len; p++) {
            let w = 0, r = 0, g = 0, b = 0;
            const from = Math.max(0, p - TAPS);
            const to = Math.min(len - 1, p + TAPS);
            for (let q = from; q <= to; q++) {
                const i = (horizontal ? line * gw + q : q * gw + line) * 4;
                if (!src[i]) continue;
                const k = KERNEL[q - p + TAPS];
                w += src[i] * k;
                r += src[i + 1] * k;
                g += src[i + 2] * k;
                b += src[i + 3] * k;
            }
            const o = (horizontal ? line * gw + p : p * gw + line) * 4;
            dst[o] = w;
            dst[o + 1] = r;
            dst[o + 2] = g;
            dst[o + 3] = b;
        }
    }
}

export const SkyLight = {
    // Bắt đầu gom ánh sáng của khung: cỡ sân khấu (w, h), mép nước horizon (0-1, 1: không có mặt nước)
    begin(w, h, horizon) {
        const nw = Math.max(2, Math.ceil(w / CELL));
        const nh = Math.max(2, Math.ceil(h / CELL));
        if (nw !== gw || nh !== gh) {
            gw = nw;
            gh = nh;
            acc = new Float32Array(gw * gh * 4);
            tmp = new Float32Array(gw * gh * 4);
            cur = new Float32Array(gw * gh * 3);
        } else {
            acc.fill(0);
        }
        stageW = w;
        stageH = h;
        horizonY = h * horizon;
    },

    // Một nguồn sáng tại (x, y), màu (r, g, b) 0-255, sức sáng w (1: một hạt pháo đang cháy sáng)
    add(x, y, r, g, b, w) {
        const cx = (x / CELL) | 0;
        const cy = (y / CELL) | 0;
        if (cx < 0 || cy < 0 || cx >= gw || cy >= gh) return;
        const i = (cy * gw + cx) * 4;
        acc[i] += w;
        acc[i + 1] += r * w;
        acc[i + 2] += g * w;
        acc[i + 3] += b * w;
    },

    // Làm nhòe ánh sáng vừa gom, mượt theo thời gian (speed: số khung 60Hz đã trôi), cộng chớp lúc nổ rồi vẽ lên canvas.
    // maxSat: độ sáng tối đa của màu trời; flashes: chớp lúc nổ [{ x, y, lift }] (lift: đơn vị màu trời); ambient: phần
    // sáng đều cả trời ({ r, g, b }, nền khung đã có màu này); coarse: máy yếu (vẽ thưa hơn)
    finish(speed, maxSat, flashes, ambient, canvas, coarse) {
        blur(acc, tmp, true);
        blur(tmp, acc, false);
        const smooth = Math.min(1, speed / 10);
        const cap = maxSat * 1.6;
        let any = false;
        for (let c = 0, n = gw * gh; c < n; c++) {
            const i = c * 4;
            const j = c * 3;
            const w = acc[i];
            let r = 0, g = 0, b = 0;
            if (w > 0.01) {
                // Màu pha theo các hạt quanh đó, kéo màu sáng nhất lên mức tối đa (như màu trời), độ sáng theo số hạt gần
                const k = maxSat * LOCAL * Math.sqrt(Math.min(1, w / FULL)) / Math.max(1, acc[i + 1], acc[i + 2], acc[i + 3]);
                r = acc[i + 1] * k;
                g = acc[i + 2] * k;
                b = acc[i + 3] * k;
            }
            cur[j] += (r - cur[j]) * smooth;
            cur[j + 1] += (g - cur[j + 1]) * smooth;
            cur[j + 2] += (b - cur[j + 2]) * smooth;
            if (flashes.length) {
                const x = (c % gw + 0.5) * CELL;
                const y = ((c / gw | 0) + 0.5) * CELL;
                let lift = 0;
                flashes.forEach(f => { lift += f.lift * Math.exp(-((x - f.x) ** 2 + (y - f.y) ** 2) / (2 * SIGMA * SIGMA)); });
                if (lift > 0.01) {
                    cur[j] = Math.min(cap, Math.max(cur[j], r) + lift * FLASH[0]);
                    cur[j + 1] = Math.min(cap, Math.max(cur[j + 1], g) + lift * FLASH[1]);
                    cur[j + 2] = Math.min(cap, Math.max(cur[j + 2], b) + lift * FLASH[2]);
                }
            }
            if (cur[j] + cur[j + 1] + cur[j + 2] > 0.3) any = true;
        }
        base.r = ambient.r;
        base.g = ambient.g;
        base.b = ambient.b;
        if (any || drawn) this.draw(canvas, coarse);
        drawn = any;
    },

    // Vẽ vầng sáng lên canvas (trình duyệt phóng lên cả khung): phần trời trên mép nước (thêm phần sáng đều), hòa nhiễu;
    // dưới mép nước để đen, mặt nước tự soi bóng. coarse: máy yếu, điểm ảnh thưa gấp đôi
    draw(canvas, coarse) {
        const ow = Math.max(2, Math.min(MAX_OUT, Math.round(stageW / (coarse ? PIXEL * 2 : PIXEL))));
        const oh = Math.max(2, Math.round(ow * stageH / stageW));
        const key = `${ow}x${oh}_${gw}x${gh}_${stageW}x${stageH}`;
        if (layout.key !== key || canvas.width !== ow || canvas.height !== oh) {
            canvas.width = ow;
            canvas.height = oh;
            image = canvas.getContext('2d').createImageData(ow, oh);
            for (let o = 3; o < image.data.length; o += 4) image.data[o] = 255;
            // Ô trái/phải (trên/dưới) và tỉ lệ nội suy của từng cột, hàng
            const axis = (n, size, cells) => {
                const i0 = new Uint16Array(n), i1 = new Uint16Array(n), t = new Float32Array(n);
                for (let p = 0; p < n; p++) {
                    const f = Math.max(0, Math.min(cells - 1, (p + 0.5) / n * size / CELL - 0.5));
                    i0[p] = f | 0;
                    i1[p] = Math.min(cells - 1, i0[p] + 1);
                    t[p] = f - i0[p];
                }
                return { i0, i1, t };
            };
            // Nội suy ngang của từng hàng ô cho mọi cột (mỗi hàng ô dùng chung cho chừng chục hàng điểm ảnh)
            layout = { key, cols: axis(ow, stageW, gw), rows: axis(oh, stageH, gh), lerp: new Float64Array(gh * ow * 3) };
            skyRows = 0;
        }
        const d = image.data;
        const { cols, rows, lerp } = layout;
        // Hàng có tâm trên mép nước là trời; mép nước dâng lên thì xóa phần hàng trời cũ giờ đã thành nước
        const sky = Math.min(oh, Math.max(0, Math.round(horizonY / stageH * oh)));
        if (sky < skyRows) {
            d.fill(0, sky * ow * 4, skyRows * ow * 4);
            for (let o = sky * ow * 4 + 3; o < skyRows * ow * 4; o += 4) d[o] = 255;
        }
        skyRows = sky;
        if (!sky) {
            canvas.getContext('2d').putImageData(image, 0, 0);
            return;
        }
        const lastRow = rows.i1[sky - 1];
        for (let j = 0; j <= lastRow; j++) {
            const r = j * gw;
            for (let qx = 0, q = j * ow * 3; qx < ow; qx++, q += 3) {
                const tx = cols.t[qx];
                const a = (r + cols.i0[qx]) * 3, b = (r + cols.i1[qx]) * 3;
                lerp[q] = cur[a] + (cur[b] - cur[a]) * tx;
                lerp[q + 1] = cur[a + 1] + (cur[b + 1] - cur[a + 1]) * tx;
                lerp[q + 2] = cur[a + 2] + (cur[b + 2] - cur[a + 2]) * tx;
            }
        }
        const br = base.r, bg = base.g, bb = base.b;
        for (let py = 0; py < sky; py++) {
            let q0 = rows.i0[py] * ow * 3;
            let q1 = rows.i1[py] * ow * 3;
            const ty = rows.t[py];
            const noise = (py & 63) << 6;
            for (let qx = 0, o = py * ow * 4; qx < ow; qx++, o += 4, q0 += 3, q1 += 3) {
                // Nhiễu ±0,5 bậc màu, mảng điểm ảnh tự làm tròn khi gán: trung bình đúng bằng giá trị gốc. Chỗ gần như
                // tối hẳn (dưới một bậc) thì bớt nhiễu, không lấm tấm chấm sáng trên nền đen
                const n = DITHER[noise + (qx & 63)];
                const vr = br + lerp[q0] + (lerp[q1] - lerp[q0]) * ty;
                const vg = bg + lerp[q0 + 1] + (lerp[q1 + 1] - lerp[q0 + 1]) * ty;
                const vb = bb + lerp[q0 + 2] + (lerp[q1 + 2] - lerp[q0 + 2]) * ty;
                d[o] = vr + n * Math.min(1, Math.max(0, vr - 0.5) * 2);
                d[o + 1] = vg + n * Math.min(1, Math.max(0, vg - 0.5) * 2);
                d[o + 2] = vb + n * Math.min(1, Math.max(0, vb - 0.5) * 2);
            }
        }
        canvas.getContext('2d').putImageData(image, 0, 0);
    },

    // Tắt ánh sáng trời (người xem tắt "Ánh sáng bầu trời", giảm chớp sáng)
    clear(canvas) {
        if (cur) cur.fill(0);
        base.r = base.g = base.b = 0;
        if (drawn) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
        drawn = false;
    }
};

// Màu trời (đơn vị như màu trời của sky-color.js: phần sáng đều cộng vầng sáng) tại (u, v)
export function skyLightAt(u, v, out = { r: 0, g: 0, b: 0 }) {
    out.r = base.r;
    out.g = base.g;
    out.b = base.b;
    return cur ? sample(u * stageW, v * stageH, 1, out) : out;
}

// Màu trời ngay trên mép nước tại u: ánh pháo rọi xuống cảnh vật ven bờ (cầu, nhà, kè, cây) chỗ đó
export function horizonLight(u, out) {
    return skyLightAt(u, Math.max(0, horizonY - CELL * 0.5) / stageH, out);
}

// Phần sáng đều cả trời (mặt nước sát chân trời ửng đều theo màu này; vầng sáng thì mặt nước soi bóng)
export const skyAmbient = base;
