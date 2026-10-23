/*!
 * Trình diễn Pháo hoa – trình phát: cảnh vật (thuyền)
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Thuyền trên mặt nước, theo kiểu bờ (flags.boats):
// - 'sea' biển khơi: sát chân trời là thuyền câu mực thắp dãy đèn cao áp xanh trắng sáng rực (đứng yên, quầng sáng loang
//   cả một vùng, vệt sáng in dài xuống biển), tàu khách nhiều tầng đèn chạy rất chậm; gần hơn là ghe nhỏ có người đội nón
//   lá chèo, đèn dầu treo đầu sào chập chờn;
// - 'city' sông thành phố: vài thuyền neo sát bờ bên kia giăng đèn.
// Thuyền dập dềnh, nghiêng theo sóng; dưới mỗi ngọn đèn là vệt sáng lấp lánh in dài xuống nước. Thuyền nằm trên mặt nước
// nên vẽ chung với bèo, đá theo tầm xa (things); vệt sáng, sóng rẽ vẽ dưới mọi vật (under).

import { rand } from '../util.js';
import { drawGlow } from '../sky-life/light.js';
import { drawLightStreak, drawWakeTrail } from '../water-fx.js';

const SQUID = '205, 255, 225';
const WARM = '255, 206, 130';
const WHITE = '245, 248, 255';
const RED = '255, 70, 60';

// Mỗi loại thuyền: độ xa (d), chiều dài (điểm ảnh CSS khi ở gần), tốc độ (px/ms)
const KINDS = {
    squid: { d: [0, 0.08], len: [30, 42], speed: 0 },
    liner: { d: [0, 0.025], len: [130, 170], speed: 0.0025 },
    skiff: { d: [0.42, 0.68], len: [22, 28], speed: 0.004 },
    moored: { d: [0.01, 0.06], len: [34, 46], speed: 0 }
};

// Đèn của mỗi loại thuyền (tọa độ theo chiều dài L, gốc ở giữa mép nước, lên trên âm; x theo hướng mũi thuyền):
// [x, y, màu, cỡ quầng (phần L), độ sáng, độ dài vệt sáng dưới nước (điểm ảnh CSS khi ở gần)]
function lightsOf(boat) {
    const list = [];
    if (boat.kind === 'squid') {
        for (let i = 0; i < boat.lamps; i++) list.push([-0.42 + 0.84 * i / (boat.lamps - 1), -0.34, SQUID, 0.06, 1, 110]);
    } else if (boat.kind === 'liner') {
        for (let row = 0; row < 4; row++) {
            for (let i = 0; i < 26; i++) if ((i * 7 + row * 3) % 5) list.push([-0.4 + 0.8 * i / 25, -0.06 - row * 0.035, row ? WARM : WHITE, 0.01, 0.6, 22]);
        }
        list.push([0.32, -0.27, WHITE, 0.02, 0.95, 40], [-0.44, -0.08, RED, 0.015, 0.8, 26]);
    } else if (boat.kind === 'skiff') {
        list.push([0.34, -0.62, WARM, 0.2, 0.95, 70]);
    } else if (boat.kind === 'moored') {
        for (let i = 0; i < 7; i++) list.push([-0.42 + 0.84 * i / 6, -0.26 - 0.08 * Math.sin(Math.PI * i / 6), boat.rgb, 0.04, 0.8, 30]);
        list.push([0, -0.12, WARM, 0.05, 0.7, 30]);
    }
    return list;
}

export const BoatLife = {
    methods: {
        // Thuyền mới theo loại; side: chạy vào từ mép nào (không có thì đặt sẵn trong khung)
        makeBoat(kind, cssW, side) {
            const spec = KINDS[kind];
            const dir = side || (Math.random() < 0.5 ? -1 : 1);
            const d = rand(...spec.d);
            const len = rand(...spec.len);
            const boat = {
                kind, d, len, dir, seed: Math.random(), bob: rand(0, 7), row: rand(0, 7),
                x: side ? (side > 0 ? -len : cssW + len) : rand(0.08, 0.92) * cssW,
                vx: spec.speed * dir * rand(0.75, 1.25),
                lamps: 7 + ((Math.random() * 6) | 0),
                rgb: ['255, 214, 150', '255, 120, 180', '120, 200, 255'][(Math.random() * 3) | 0]
            };
            boat.lights = lightsOf(boat);
            return boat;
        },

        populateBoats(mode, cssW) {
            const list = [];
            if (mode === 'sea') {
                const squid = 3 + ((Math.random() * 3) | 0);
                for (let i = 0; i < squid; i++) list.push(this.makeBoat('squid', cssW));
                if (Math.random() < 0.75) list.push(this.makeBoat('liner', cssW));
                list.push(this.makeBoat('skiff', cssW));
            } else {
                for (let i = 0; i < 3; i++) list.push(this.makeBoat('moored', cssW));
            }
            return list;
        },

        // Vẽ thân thuyền trong hệ tọa độ thuyền (gốc giữa mép nước, x theo hướng mũi, đơn vị L)
        paintBoat(ctx, boat, L) {
            const poly = (pts, color) => {
                ctx.fillStyle = color;
                ctx.beginPath();
                pts.forEach(([px, py], i) => (i ? ctx.lineTo(px * L, py * L) : ctx.moveTo(px * L, py * L)));
                ctx.closePath();
                ctx.fill();
            };
            const rect = (x0, y0, w, h, color) => {
                ctx.fillStyle = color;
                ctx.fillRect(x0 * L, y0 * L, w * L, h * L);
            };
            if (boat.kind === 'squid') {
                poly([[-0.48, -0.1], [0.5, -0.14], [0.42, 0], [-0.44, 0]], '#0b0f17');
                rect(-0.3, -0.24, 0.2, 0.14, '#121823');
                rect(-0.3, -0.21, 0.2, 0.035, 'rgba(255, 220, 160, 0.35)');
                ctx.strokeStyle = 'rgba(55, 65, 75, 0.9)';
                ctx.lineWidth = Math.max(0.3, 0.012 * L);
                ctx.beginPath();
                ctx.moveTo(-0.44 * L, -0.35 * L);
                ctx.lineTo(0.44 * L, -0.35 * L);
                ctx.moveTo(-0.44 * L, -0.1 * L);
                ctx.lineTo(-0.44 * L, -0.36 * L);
                ctx.moveTo(0.44 * L, -0.12 * L);
                ctx.lineTo(0.44 * L, -0.36 * L);
                ctx.stroke();
            } else if (boat.kind === 'liner') {
                poly([[-0.48, -0.06], [0.5, -0.07], [0.45, 0], [-0.46, 0]], '#141a24');
                rect(-0.42, -0.19, 0.78, 0.13, '#202838');
                rect(-0.3, -0.23, 0.52, 0.04, '#252d3e');
                rect(0.06, -0.3, 0.06, 0.07, '#1b2230');
            } else if (boat.kind === 'skiff') {
                // Ghe nan cong hai đầu, người đội nón lá chèo ở đuôi, sào treo đèn ở mũi
                ctx.fillStyle = '#0e1117';
                ctx.beginPath();
                ctx.moveTo(-0.5 * L, -0.2 * L);
                ctx.quadraticCurveTo(0, 0.12 * L, 0.5 * L, -0.22 * L);
                ctx.lineTo(0.4 * L, 0);
                ctx.lineTo(-0.4 * L, 0);
                ctx.closePath();
                ctx.fill();
                const sway = Math.sin(boat.row) * 0.06;
                rect(-0.33, -0.42, 0.1, 0.28, '#151820');
                poly([[-0.42, -0.42], [-0.28, -0.53], [-0.14, -0.42]], '#2a2a22');
                ctx.strokeStyle = '#151820';
                ctx.lineWidth = Math.max(0.4, 0.03 * L);
                ctx.beginPath();
                ctx.moveTo(-0.26 * L, -0.32 * L);
                ctx.lineTo((-0.52 + sway) * L, 0.06 * L);
                ctx.moveTo(0.3 * L, -0.1 * L);
                ctx.lineTo(0.34 * L, -0.62 * L);
                ctx.stroke();
            } else if (boat.kind === 'moored') {
                poly([[-0.48, -0.12], [0.5, -0.13], [0.42, 0], [-0.45, 0]], '#11151d');
                rect(-0.25, -0.24, 0.42, 0.12, '#161c27');
            }
        },

        drawBoat(ctx, boat, view) {
            const s = this.scale(boat.d);
            const L = boat.len * s;
            const wl = this.surfaceY(boat.d, view.topCss, view.depthCss) + Math.sin(boat.bob) * 0.6 * s;
            const t = view.time;
            // Dập dềnh: thuyền nhỏ nghiêng nhiều, tàu lớn gần như không
            const roll = Math.sin(boat.bob * 0.8 + 1) * (boat.kind === 'skiff' ? 0.05 : boat.kind === 'liner' ? 0.003 : 0.015);
            ctx.save();
            ctx.translate(boat.x, wl);
            ctx.rotate(roll);
            ctx.scale(boat.dir, 1);
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = 1;
            this.paintBoat(ctx, boat, L);
            ctx.restore();
            // Đèn (vẽ không lật theo hướng để quầng tròn), thuyền câu mực có quầng sáng loang cả một vùng
            ctx.globalCompositeOperation = 'lighter';
            if (boat.kind === 'squid') {
                drawGlow(ctx, SQUID, boat.x, wl - 0.3 * L, L * 2.6, 0.22);
                drawGlow(ctx, SQUID, boat.x, wl - 0.32 * L, L * 0.9, 0.2);
            }
            const cos = Math.cos(roll);
            const sin = Math.sin(roll);
            boat.lights.forEach(([lx, ly, rgb, size, a], i) => {
                // Đèn dầu chập chờn; đèn cao áp thuyền câu mực rung nhẹ theo máy phát điện
                const flicker = boat.kind === 'skiff' ? 0.82 + 0.1 * Math.sin(t * 0.017 + i + boat.seed * 9) + 0.08 * Math.sin(t * 0.043 + boat.seed * 5)
                    : boat.kind === 'squid' ? 0.93 + 0.07 * Math.sin(t * 0.031 + boat.seed * 11) : 1;
                const px = lx * boat.dir * L;
                const py = ly * L;
                drawGlow(ctx, rgb, boat.x + px * cos - py * sin, wl + px * sin + py * cos, Math.max(1.4, size * L * 3), a * flicker);
            });
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = 1;
        }
    },

    update(dt, { cssW, flags }) {
        const mode = flags.boats;
        if (!mode) {
            this.boats = [];
            this.boatMode = '';
            return;
        }
        if (this.boatMode !== mode || this.boatW !== Math.round(cssW)) {
            this.boatMode = mode;
            this.boatW = Math.round(cssW);
            this.boats = this.populateBoats(mode, cssW);
        }
        this.boats.forEach((boat, i) => {
            boat.x += boat.vx * (0.4 + boat.d) * dt;
            boat.bob += dt * (boat.kind === 'skiff' ? 0.0022 : 0.0012);
            boat.row += dt * 0.0025;
            // Chạy khỏi khung thì một chiếc cùng loại vào từ phía bên kia
            if (boat.x < -boat.len * 2 || boat.x > cssW + boat.len * 2) this.boats[i] = this.makeBoat(boat.kind, cssW, boat.dir);
        });
    },

    // Dưới mọi vật: sóng rẽ sau thuyền đang chạy (cùng kiểu vệt sóng sau vịt), bọt ở mũi; vệt sáng của đèn in dài xuống
    // nước
    under(ctx, { k, topCss, depthCss, time }) {
        this.boats.forEach(boat => {
            const s = this.scale(boat.d);
            const L = boat.len * s;
            const wl = this.surfaceY(boat.d, topCss, depthCss);
            if (boat.vx) {
                ctx.globalCompositeOperation = 'source-over';
                drawWakeTrail(ctx, boat.x - boat.dir * 0.42 * L, wl, 0.12 * L, s, k, time, boat.seed, -boat.dir, boat.kind === 'skiff' ? 0.35 : 0.9);
                ctx.globalCompositeOperation = 'lighter';
                ctx.fillStyle = 'rgb(200, 215, 240)';
                ctx.globalAlpha = 0.28;
                ctx.fillRect(boat.x + boat.dir * 0.4 * L - 0.08 * L, wl - 0.3 * s, 0.16 * L, Math.max(0.6, 0.8 * s));
            }
            ctx.globalCompositeOperation = 'lighter';
            boat.lights.forEach(([lx, , rgb, size, a, refl], j) => {
                drawLightStreak(ctx, boat.x + lx * boat.dir * L, wl + 1, refl * s, 1.2 + size * L * 0.9, rgb, a * 0.5, time, boat.seed + j * 0.37, s);
            });
        });
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
    },

    things(ctx, view) {
        return this.boats.map(boat => ({ d: boat.d, draw: () => this.drawBoat(ctx, boat, view) }));
    }
};
