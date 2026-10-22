/*!
 * Trình diễn Pháo hoa – trình phát: cảnh vật (sinh vật trên mặt nước)
 * Phần bổ sung và chỉnh sửa © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Sinh vật, vật trôi trên mặt nước: khúc gỗ, cò, vịt trời, cá, ếch, bong bóng; vòng sóng, tia nước.

import { IS_MOBILE } from '../env.js';
import { rand } from './util.js';
import { depthScale, flowSpeed } from './water-fx.js';
import { LogLife } from './life/logs.js';
import { EgretLife } from './life/egrets.js';
import { DuckLife } from './life/ducks.js';
import { FishLife } from './life/fish.js';
import { FrogLife } from './life/frogs.js';
import { BubbleLife } from './life/bubbles.js';

// Sinh vật trên mặt nước bật/tắt riêng từng loại (builder, mục "Trên mặt nước"); bong bóng nước luôn có
const WATER_ALL = { birds: true, ducks: true, fish: true, logs: true, frogs: true, bubbles: true };

// Mỗi loại sinh vật, vật trôi là một module riêng trong life/ có cùng cách gắn vào: methods (hàm riêng, gộp vào WaterLife
// nên dùng chung this: vòng sóng, tia nước, cỡ theo độ xa...), update(dt, env) mỗi khung, under(ctx, view) vẽ dưới mọi vật
// (bóng in nước, bong bóng), things(ctx, view) các vật nằm trên mặt nước (vẽ chung với bèo, đá theo tầm xa), over(ctx, view)
// vẽ trên mọi vật (đang bay, đang nhảy). Thêm loài mới: thêm một module, đưa vào LIFE.
const LIFE = [LogLife, EgretLife, DuckLife, FishLife, FrogLife, BubbleLife];

export const WaterLife = {
    key: '',
    logs: [],
    birds: [],
    ducks: [],
    fish: [],
    frogs: [],
    bubbles: [],
    ripples: [],
    drops: [],
    next: { log: 0, bird: 0, duck: 0, fish: 0, rise: 0, frog: 0, bubble: 0 },

    flow(d, river) {
        return flowSpeed(d, river);
    },

    scale(d) {
        return depthScale(d);
    },

    reset(river, cssW, flags = WATER_ALL) {
        this.logs = [];
        this.birds = [];
        this.ducks = [];
        this.fish = [];
        this.frogs = [];
        this.bubbles = [];
        this.ripples = [];
        this.drops = [];
        const slow = IS_MOBILE ? 1.3 : 1;
        // Mở màn đã có sẵn một khúc gỗ đang trôi, một con cò và một đàn vịt sắp bay tới, ếch sắp ló đầu
        if (river && flags.logs) this.logs.push(this.makeLog(rand(0.18, 0.42) * cssW, rand(0.45, 0.8)));
        this.next = river
            ? { log: rand(9000, 16000) * slow, bird: rand(1500, 3000), duck: rand(5000, 9000), fish: rand(2500, 4500), rise: rand(800, 2000), frog: rand(1500, 3500), bubble: rand(800, 2500) }
            : { log: Infinity, bird: rand(3000, 6000), duck: rand(2500, 5000), fish: rand(3500, 6000), rise: rand(800, 2000), frog: rand(1200, 3000), bubble: rand(800, 2500) };
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

    // Vòng sóng nhỏ không có tia nước (cá đớp mồi, vịt quạt chân)
    ring(x, d, size, life = 1400, delay = 0) {
        this.ripples.push({ x, d, age: -delay, life, r0: 1.5 * this.scale(d) * size, size });
    },

    // rocks: đá, gò đất giữa dòng (vật trôi, vịt né; ếch nhảy lên); pads: lá bèo (ếch nhảy lên); flags: loại nào đang bật
    // (tắt thì bỏ ngay)
    update(dt, river, cssW, topCss, depthCss, rocks = [], flags = WATER_ALL, pads = []) {
        const slow = IS_MOBILE ? 1.3 : 1;
        if (!flags.logs) this.logs = [];
        if (!flags.ducks) this.ducks = [];
        if (!flags.fish) this.fish = [];
        if (!flags.frogs) this.frogs = [];
        if (!flags.bubbles) this.bubbles = [];
        if (!flags.birds && this.birds.length) {
            this.birds.forEach(bird => this.freeEgretPerch(bird));
            this.birds = [];
        }
        const env = { river, cssW, topCss, depthCss, rocks, flags, pads, slow };
        LIFE.forEach(kind => kind.update && kind.update.call(this, dt, env));

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

    // Vòng sóng; bóng cò, vịt đang bay in xuống nước, bay càng cao bóng càng nhạt (dưới mọi vật). Lớp đã nhân k: tọa độ
    // điểm ảnh CSS.
    drawUnder(ctx, k, topCss, depthCss, time = 0) {
        ctx.globalCompositeOperation = 'source-over';
        const view = { k, topCss, depthCss, time, reach: depthCss * 1.2 };
        LIFE.forEach(kind => kind.under && kind.under.call(this, ctx, view));
        ctx.lineWidth = 1 / k;
        ctx.strokeStyle = 'rgb(205, 222, 255)';
        this.ripples.forEach(r => {
            if (r.age < 0) return;
            const p = r.age / r.life;
            const s = this.scale(r.d);
            const rx = r.r0 + p * 30 * s * (r.size ?? 1);
            ctx.globalAlpha = (1 - p) * 0.5;
            ctx.beginPath();
            ctx.ellipse(r.x, this.surfaceY(r.d, topCss, depthCss), rx, rx * 0.28, 0, 0, Math.PI * 2);
            ctx.stroke();
        });
    },

    // Vật nằm trên mặt nước, để vẽ chung với bèo, đá, hoa đăng... theo tầm xa
    things(ctx, k, topCss, depthCss, time, river) {
        const view = { k, topCss, depthCss, time, river };
        return LIFE.flatMap(kind => (kind.things ? kind.things.call(this, ctx, view) : []));
    },

    // Cá, ếch đang nhảy, tia nước, cò và vịt đang bay (trên mọi vật, theo thứ tự lớp này)
    drawOver(ctx, k, topCss, depthCss, time) {
        const view = { k, topCss, depthCss, time };
        FishLife.over.call(this, ctx, view);
        FrogLife.over.call(this, ctx, view);
        ctx.fillStyle = 'rgb(225, 236, 255)';
        this.drops.forEach(p => {
            ctx.globalAlpha = 0.8;
            ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        });
        EgretLife.over.call(this, ctx, view);
        DuckLife.over.call(this, ctx, view);
        ctx.globalAlpha = 1;
    }
};

LIFE.forEach(kind => Object.assign(WaterLife, kind.methods));
