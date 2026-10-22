/*!
 * Trình diễn Pháo hoa – trình phát: cảnh vật (thời tiết)
 * Phần bổ sung và chỉnh sửa © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Thời tiết và mùa trên toàn khung: mưa, tuyết rơi, lá vàng, cánh hoa rụng bay theo gió.

import { horizon, isLowQuality, season as sceneSeason, weather as sceneWeather } from '../state.js';
import { LEAF_COLORS, fallingLeafSprite } from './water-sprites.js';
import { bankBandCss } from './bank.js';
import { Water } from './water.js';

// Bông tuyết: chấm tròn mềm
let flakeSprite = null;

function snowflakeSprite() {
    if (!flakeSprite) {
        const c = document.createElement('canvas');
        c.width = c.height = 32;
        const g = c.getContext('2d');
        const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
        grad.addColorStop(0, 'rgba(240, 245, 255, 1)');
        grad.addColorStop(0.35, 'rgba(230, 238, 252, 0.85)');
        grad.addColorStop(0.7, 'rgba(220, 230, 250, 0.25)');
        grad.addColorStop(1, 'rgba(220, 230, 250, 0)');
        g.fillStyle = grad;
        g.fillRect(0, 0, 32, 32);
        flakeSprite = c;
    }
    return flakeSprite;
}

export const Weather = {
    drops: [],
    flakes: [],
    leaves: [],
    ripples: [],
    last: 0,
    key: '',
    drawn: false,

    // Rải lại khi đổi thời tiết, mùa hoặc cỡ khung. Hạt mưa, bông tuyết, lá có độ xa gần z (0 xa, 1 gần): gần thì to, rơi
    // nhanh, chạm mặt nước gần người xem; xa thì nhỏ, chậm, chạm mặt nước sát chân trời
    sync(kind, season, cssW, cssH) {
        const key = `${kind}_${season}_${Math.round(cssW)}_${Math.round(cssH)}_${isLowQuality}_${horizon()}`;
        if (key === this.key) return;
        this.key = key;
        const area = cssW * cssH * (isLowQuality ? 0.6 : 1);
        const count = (per, min, max) => Math.round(Math.max(min, Math.min(max, area / per)));
        this.drops = kind === 'rain' ? Array.from({ length: count(3500, 120, 420) }, () => this.drop(cssW, cssH, true)) : [];
        this.flakes = kind === 'snow' ? Array.from({ length: count(3000, 120, 480) }, () => this.flake(cssW, cssH, true)) : [];
        const leafy = season === 'autumn' || season === 'spring';
        const leafCount = season === 'autumn' ? Math.max(10, Math.min(26, cssW / 60)) : Math.max(14, Math.min(34, cssW / 45));
        this.leaves = leafy ? Array.from({ length: Math.round(leafCount * (isLowQuality ? 0.6 : 1)) }, () => this.leaf(cssW, cssH, season, true)) : [];
        this.ripples = [];
    },

    // Lá, cánh hoa: phần lớn rụng từ hàng cây bên kia bờ (nhỏ, rơi xuống nước sát bờ), số còn lại bay từ ngoài khung vào
    // (gần người xem: to, bay ngang qua cả khung, rơi xuống nước gần)
    leaf(cssW, cssH, season, anywhere) {
        const level = horizon();
        const ground = level * cssH;
        const near = level >= 1 || Math.random() < 0.4;
        const z = near ? 0.6 + Math.random() * 0.4 : 0.22 + Math.random() * 0.33;
        const x = near ? Math.random() * cssW * 1.2 - cssW * 0.4 : Math.random() * cssW * 1.1 - cssW * 0.1;
        let y = near ? -20 - Math.random() * 80 : ground - 20 - Math.random() * 70;
        if (anywhere) y = near ? Math.random() * cssH * 0.9 : ground - Math.random() * 80;
        return {
            x, y, z, season,
            kind: (Math.random() * LEAF_COLORS[season].length) | 0,
            rot: Math.random() * Math.PI * 2,
            spin: (Math.random() - 0.5) * 0.004,
            phase: Math.random() * 6.3,
            flutter: 0.0016 + Math.random() * 0.0016,
            land: Math.random(),
            fade: 1
        };
    },

    drop(cssW, cssH, anywhere) {
        return {
            x: Math.random() * (cssW + 200) - 150,
            y: anywhere ? Math.random() * cssH : -40 - Math.random() * cssH * 0.3,
            z: 0.25 + Math.random() * 0.75,
            land: Math.random()
        };
    },

    flake(cssW, cssH, anywhere) {
        return {
            x: Math.random() * (cssW + 160) - 120,
            y: anywhere ? Math.random() * cssH : -10 - Math.random() * 60,
            z: 0.15 + Math.random() * 0.85,
            phase: Math.random() * 6.3,
            land: Math.random(),
            fade: 1
        };
    },

    // state: Water.render vừa vẽ lại mặt nước ('drawn'), bỏ qua khung này ('skip', chất lượng thấp) hay không có mặt nước
    // ('none': lớp trống, tự xóa phần mưa, tuyết của khung trước). sky: màu trời theo ánh pháo (rọi sáng hạt mưa, tuyết)
    render(ctx, { cssW, cssH, time, sky, state }) {
        const kind = sceneWeather();
        const season = sceneSeason();
        this.sync(kind, season, cssW, cssH);
        const dt = Math.min(50, this.last ? time - this.last : 16);
        this.last = time;
        if (state === 'skip') return;
        const { width: W, height: H } = ctx.canvas;
        if (state === 'none' && this.drawn) ctx.clearRect(0, 0, W, H);
        this.drawn = false;
        if (!this.drops.length && !this.flakes.length && !this.leaves.length && !this.ripples.length) return;
        this.drawn = true;
        const k = W / cssW;
        const level = horizon();
        const water = level < 1;
        const topCss = water ? level * cssH + bankBandCss(cssH) : cssH;
        const frozen = water && season === 'winter';
        // Chỗ chạm: mặt nước ở độ xa d (0 sát chân trời, 1 sát người xem); không có mặt nước thì rơi ra khỏi khung
        const landAt = d => (water ? topCss + d * (cssH - topCss) : cssH + 60);
        // Gió thổi từng đợt (từ trái sang phải)
        const wind = 0.6 + 0.4 * Math.sin(time * 0.00021) + 0.3 * Math.sin(time * 0.00063 + 1);
        ctx.save();
        ctx.setTransform(k, 0, 0, k, 0, 0);
        ctx.globalCompositeOperation = 'source-over';
        if (this.drops.length) this.rain(ctx, dt, time, wind, sky, landAt, water, cssW, cssH, topCss);
        if (this.ripples.length) this.drawRipples(ctx, time, frozen);
        if (this.flakes.length) this.snow(ctx, dt, time, wind, landAt, water && !frozen, cssW, cssH);
        if (this.leaves.length) this.fall(ctx, dt, time, wind, k, landAt, water && !frozen, cssW, cssH);
        ctx.restore();
    },

    // Lá, cánh hoa rụng: lả lướt, chao qua chao lại (rơi chậm lúc chao lên, nhanh lúc chao xuống), xoay, lật mặt; gió đẩy
    // sang ngang. Rơi xuống nước: gợn vòng rồi nằm lại trôi theo dòng; không có nước thì rơi khỏi khung
    fall(ctx, dt, time, wind, k, landAt, water, cssW, cssH) {
        this.leaves.forEach(leaf => {
            const d = Math.max(0.02, Math.min(0.98, (leaf.z - 0.22) * 1.2 + (leaf.land - 0.5) * 0.12));
            const end = landAt(d);
            const swing = Math.sin(time * leaf.flutter + leaf.phase);
            const scale = 0.4 + leaf.z;
            leaf.x += ((0.012 + 0.03 * leaf.z) * wind + swing * 0.03 * scale) * dt;
            leaf.y += (0.008 + 0.022 * leaf.z) * (0.45 + 0.75 * Math.abs(swing)) * dt;
            leaf.rot += (leaf.spin + swing * 0.0012) * dt;
            if (leaf.y >= end) {
                if (water) {
                    if (this.ripples.length < 160) this.ripples.push({ x: leaf.x, y: end, d, t: time });
                    Water.dropLeaf(leaf.x, d, leaf.season, leaf.kind, leaf.rot);
                }
                Object.assign(leaf, this.leaf(cssW, cssH, leaf.season, false));
                return;
            }
            if (leaf.x > cssW + 40) {
                Object.assign(leaf, this.leaf(cssW, cssH, leaf.season, false));
                return;
            }
            const size = (leaf.season === 'autumn' ? 5 + leaf.z * 11 : 4 + leaf.z * 8);
            // Lật mặt: co bề ngang theo nhịp chao
            const flip = Math.cos(time * leaf.flutter * 1.7 + leaf.phase);
            const sx = Math.max(0.18, Math.abs(flip)) * (flip < 0 ? -1 : 1);
            const c = Math.cos(leaf.rot);
            const sn = Math.sin(leaf.rot);
            ctx.setTransform(k * c * sx, k * sn * sx, -k * sn, k * c, k * leaf.x, k * leaf.y);
            ctx.globalAlpha = 0.9;
            ctx.drawImage(fallingLeafSprite(leaf.season, leaf.kind), -size / 2, -size / 2, size, size);
        });
        ctx.setTransform(k, 0, 0, k, 0, 0);
        ctx.globalAlpha = 1;
    },

    // Mưa xiên theo gió: mỗi hạt một vệt dài theo tốc độ rơi (gần dài, đậm), gom ba lượt vẽ theo độ xa
    rain(ctx, dt, time, wind, sky, landAt, water, cssW, cssH, topCss) {
        const paths = [new Path2D(), new Path2D(), new Path2D()];
        const slant = 0.1 + 0.09 * wind;
        this.drops.forEach(drop => {
            const v = 0.9 + drop.z * 1.3;
            const d = Math.min(1, drop.land * 0.35 + (drop.z - 0.25) * 0.9);
            const end = landAt(d);
            drop.y += v * dt;
            drop.x += v * slant * dt;
            if (drop.y >= end) {
                if (water && this.ripples.length < 160) this.ripples.push({ x: drop.x, y: end, d, t: time });
                Object.assign(drop, this.drop(cssW, cssH, false));
                return;
            }
            const len = 12 + drop.z * 34;
            const path = paths[drop.z < 0.5 ? 0 : drop.z < 0.8 ? 1 : 2];
            path.moveTo(drop.x, drop.y);
            path.lineTo(drop.x - slant * len, drop.y - len);
        });
        const lift = Math.min(1, (sky.r + sky.g + sky.b) / 300);
        ctx.strokeStyle = `rgb(${Math.min(255, 165 + sky.r) | 0}, ${Math.min(255, 180 + sky.g) | 0}, ${Math.min(255, 210 + sky.b) | 0})`;
        ctx.lineCap = 'butt';
        [[0.55, 0.15], [0.85, 0.21], [1.25, 0.28]].forEach(([width, alpha], i) => {
            ctx.lineWidth = width;
            ctx.globalAlpha = alpha * (1 + lift);
            ctx.stroke(paths[i]);
        });
        ctx.globalAlpha = 1;
    },

    // Vòng gợn của hạt mưa trên mặt nước: elip dẹt theo phối cảnh, nở rộng rồi tan; mặt băng: chấm sáng nảy lên rồi tắt
    drawRipples(ctx, time, frozen) {
        const fresh = new Path2D();
        const old = new Path2D();
        this.ripples = this.ripples.filter(r => {
            const life = frozen ? 160 : 520 + r.d * 380;
            const age = (time - r.t) / life;
            if (age >= 1) return false;
            const size = 1.6 + r.d * 7;
            const path = age < 0.45 ? fresh : old;
            if (frozen) {
                path.rect(r.x - 0.5, r.y - age * size, 1, 1);
                return true;
            }
            const rx = size * (0.35 + age);
            const ry = rx * (0.16 + r.d * 0.2);
            path.moveTo(r.x + rx, r.y);
            path.ellipse(r.x, r.y, rx, ry, 0, 0, Math.PI * 2);
            return true;
        });
        ctx.strokeStyle = 'rgb(170, 190, 225)';
        ctx.fillStyle = 'rgb(205, 218, 240)';
        ctx.lineWidth = 0.7;
        [[fresh, 0.32], [old, 0.14]].forEach(([path, alpha]) => {
            ctx.globalAlpha = alpha;
            if (frozen) ctx.fill(path);
            else ctx.stroke(path);
        });
        ctx.globalAlpha = 1;
    },

    // Tuyết lả tả: rơi chậm, đung đưa qua lại, gió đẩy ngang; chạm mặt nước thì tan ngay, chạm băng, đất thì đọng lại một lúc
    snow(ctx, dt, time, wind, landAt, melts, cssW, cssH) {
        const sprite = snowflakeSprite();
        this.flakes.forEach(flake => {
            const end = landAt(Math.min(1, flake.land * 0.3 + (flake.z - 0.15) * 0.85));
            if (flake.y < end) {
                flake.y += (0.012 + flake.z * 0.04) * dt;
                flake.x += ((0.008 + 0.022 * flake.z) * wind + Math.sin(time * 0.0011 * (0.6 + flake.z) + flake.phase) * 0.014 * (0.4 + flake.z)) * dt;
            } else {
                flake.y = end;
                flake.fade -= dt / (melts ? 120 : 900);
            }
            if (flake.fade <= 0 || flake.x > cssW + 60) {
                Object.assign(flake, this.flake(cssW, cssH, false));
                return;
            }
            // Gần: bông to, mềm; xa: chấm nhỏ
            const size = 0.8 + flake.z * flake.z * 4.6;
            ctx.globalAlpha = (0.35 + 0.6 * flake.z) * flake.fade;
            ctx.drawImage(sprite, flake.x - size, flake.y - size, size * 2, size * 2);
        });
        ctx.globalAlpha = 1;
    }
};
