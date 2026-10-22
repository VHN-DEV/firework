/*!
 * Trình diễn Pháo hoa – trình phát: pháo ảnh
 * Phần bổ sung và chỉnh sửa © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Pháo "Hình ảnh": ảnh lớn dần và rõ dần trong khung (tròn, trái tim, ngôi sao...), viền khung nổ thành tia lửa.

import MyMath from '../MyMath.js';
import { INVISIBLE, COLOR } from './env.js';
import { stageW, stageH, isLowQuality, quality, horizon } from './state.js';
import { Star, Spark } from './particles.js';
import { soundManager } from './audio.js';
import { getFramePolygon, traceFramePath, cropRect } from './image-frame.js';

export const imageParticleCache = new Map();

// `count` điểm cách đều nhau dọc theo viền khung (cùng đơn vị với getFramePolygon)
const frameOutlineCache = new Map();
function sampleFrameOutline(frame, count) {
    const key = `${frame || 'square'}_${count}`;
    if (frameOutlineCache.has(key)) return frameOutlineCache.get(key);
    const points = getFramePolygon(frame || 'square');
    const segments = [];
    let total = 0;
    points.forEach((a, i) => {
        const b = points[(i + 1) % points.length];
        const length = Math.hypot(b.x - a.x, b.y - a.y);
        segments.push({ a, b, length, start: total });
        total += length;
    });
    const result = [];
    let s = 0;
    for (let i = 0; i < count; i++) {
        const d = i / count * total;
        while (s < segments.length - 1 && segments[s].start + segments[s].length < d) s++;
        const seg = segments[s];
        const t = seg.length ? (d - seg.start) / seg.length : 0;
        result.push({ x: seg.a.x + (seg.b.x - seg.a.x) * t, y: seg.a.y + (seg.b.y - seg.a.y) * t });
    }
    frameOutlineCache.set(key, result);
    return result;
}

// Chuẩn bị ảnh cho pháo: lấy phần ảnh người dùng chọn (crop, xem cropRect). Có khung: vùng vuông
// (ảnh dọc/ngang không bị kéo méo) rồi cắt theo khung. Không khung: giữ nguyên tỉ lệ ảnh.
// Kèm một bản rất nhỏ, phóng to lên sẽ thành ảnh nhòe lúc mới hiện.
// Cỡ ảnh theo cỡ lớn nhất ảnh có thể hiện (86% cạnh ngắn của khung, xem ImageBurst) tính bằng điểm ảnh thật của màn hình,
// để không bị phóng to (nhòe): cố định 512 thì trên điện thoại ảnh hiện ra ~930 điểm ảnh, kéo giãn gần gấp đôi. Khung
// dựng video đã đặt devicePixelRatio theo cỡ video.
export function getProcessedImage(img, frame = '', crop = null) {
    const shown = 0.86 * Math.min(window.innerWidth, window.innerHeight) * (window.devicePixelRatio || 1);
    const maxSide = Math.round(MyMath.clamp(shown, 512, 2048));
    const iw = img.naturalWidth || img.width || maxSide;
    const ih = img.naturalHeight || img.height || maxSide;
    const canvas = document.createElement('canvas');
    if (frame) {
        canvas.width = canvas.height = maxSide;
    } else {
        const k = maxSide / Math.max(iw, ih);
        canvas.width = Math.max(1, Math.round(iw * k));
        canvas.height = Math.max(1, Math.round(ih * k));
    }
    const w = canvas.width;
    const h = canvas.height;
    const ctx = canvas.getContext('2d');
    if (frame) {
        traceFramePath(ctx, frame, w / 2, h / 2, w / 2);
        ctx.clip();
    }
    const area = cropRect(iw, ih, frame, crop);
    ctx.drawImage(img, area.x, area.y, area.w, area.h, 0, 0, w, h);

    const soft = document.createElement('canvas');
    soft.width = Math.max(1, Math.round(w / 20));
    soft.height = Math.max(1, Math.round(h / 20));
    soft.getContext('2d').drawImage(canvas, 0, 0, soft.width, soft.height);
    canvas.soft = soft;
    return canvas;
}

// Pháo ảnh: viền hạt bung ra theo hình khung, ảnh lớn dần và rõ dần, giữ lại một lúc với viền lấp lánh,
// cuối cùng viền vỡ thành tia lửa và ảnh mờ đi.
export class ImageBurst {
    constructor(x, y, img, { size = 1, frame = '', color = null, duration = 4500 } = {}) {
        this.img = img;
        this.frame = frame || '';
        this.color = color && color !== INVISIBLE ? color : null;
        this.accent = this.color || COLOR.Gold;
        // "Không khung" thì không vẽ viền, chỉ có hạt và tia lửa quanh ảnh
        this.stroke = !!(this.frame && this.color);
        // Cỡ 1 ≈ 500px nhưng không vượt quá 86% cạnh ngắn của màn hình (điện thoại)
        // Ảnh nằm gọn trong phần trời (phía trên mặt nước nếu có)
        const skyH = stageH * horizon();
        const box = Math.max(60, Math.min(size * 500, Math.min(stageW, skyH) * 0.86));
        const aspect = img.width / img.height;
        this.w = aspect >= 1 ? box : box * aspect;
        this.h = aspect >= 1 ? box / aspect : box;
        // Giữ trọn ảnh trong màn hình
        const margin = 12;
        const fit = (v, half, max) => half * 2 + margin * 2 >= max ? max / 2 : MyMath.clamp(v, half + margin, max - half - margin);
        this.x = fit(x, this.w / 2, stageW);
        this.y = fit(y, this.h / 2, skyH);
        this.totalLife = Math.max(1500, Number(duration) || 4500);
        this.life = this.totalLife;
        this.appearTime = Math.min(1800, this.totalLife * 0.4);
        this.fadeTime = Math.min(1200, this.totalLife * 0.25);
        this.outline = sampleFrameOutline(this.frame, 96);
        this.sparkleTimer = 0;
        this.dissolved = false;
    }

    static active = [];

    static spawn(x, y, img, options) {
        const burst = new ImageBurst(x, y, img, options);
        this.active.push(burst);
        burst.burstOutline();
        return burst;
    }

    // Hạt bung từ tâm ra đúng hình khung, nở cùng nhịp với ảnh
    burstOutline() {
        sampleFrameOutline(this.frame, isLowQuality ? 40 : 64).forEach(p => {
            const dx = p.x * this.w / 2 * 1.07;
            const dy = p.y * this.h / 2 * 1.07;
            const star = Star.add(this.x, this.y, this.accent, 0, 0, this.appearTime * 1.1 + Math.random() * 400);
            star.orbit = {
                cx: this.x, cy: this.y, radius: 0, targetRadius: Math.hypot(dx, dy), expand: 0.05,
                angle: Math.atan2(dy, dx), angularSpeed: 0, spinDrag: 0,
                squash: 1, tiltCos: 1, tiltSin: 0, fallSpeed: 0, fallAcc: 0
            };
            star.sparkFreq = 160 / quality;
            star.sparkSpeed = 0.35;
            star.sparkLife = 500;
            star.sparkLifeVariation = 1.5;
            star.sparkColor = COLOR.Gold;
            star.sparkTimer = Math.random() * star.sparkFreq;
            star.transitionTime = 450;
            star.twinkle = true;
        });
    }

    // Viền vỡ thành tia lửa bay ra ngoài
    dissolve() {
        sampleFrameOutline(this.frame, isLowQuality ? 36 : 60).forEach(p => {
            const angle = Math.atan2(p.y * this.h, p.x * this.w) + (Math.random() - 0.5) * 0.6;
            const star = Star.add(
                this.x + p.x * this.w / 2,
                this.y + p.y * this.h / 2,
                Math.random() < 0.5 ? this.accent : COLOR.Gold,
                angle,
                0.6 + Math.random() * 1.2,
                900 + Math.random() * 700
            );
            star.sparkFreq = 120 / quality;
            star.sparkSpeed = 0.3;
            star.sparkLife = 400;
            star.sparkLifeVariation = 2;
            star.sparkColor = COLOR.Gold;
            star.sparkTimer = Math.random() * star.sparkFreq;
        });
        soundManager.playSound('crackleSmall');
    }

    static updateAll(timeStep) {
        for (let i = this.active.length - 1; i >= 0; i--) {
            const b = this.active[i];
            b.life -= timeStep;
            const elapsed = b.totalLife - b.life;
            // Đang hiện rõ: tia lửa nhỏ rơi lấm tấm từ viền khung
            if (elapsed > b.appearTime * 0.8 && b.life > b.fadeTime) {
                b.sparkleTimer -= timeStep;
                while (b.sparkleTimer < 0) {
                    b.sparkleTimer += 45 / quality;
                    const p = b.outline[(Math.random() * b.outline.length) | 0];
                    Spark.add(
                        b.x + p.x * b.w / 2,
                        b.y + p.y * b.h / 2,
                        Math.random() < 0.6 ? COLOR.Gold : b.accent,
                        Math.atan2(p.y * b.h, p.x * b.w) + (Math.random() - 0.5),
                        Math.random() * 0.9,
                        400 + Math.random() * 400
                    );
                }
            }
            if (!b.dissolved && b.life <= b.fadeTime) {
                b.dissolved = true;
                b.dissolve();
            }
            if (b.life <= 0) this.active.splice(i, 1);
        }
    }

    static drawAll(ctx) {
        this.active.forEach(b => {
            const t = b.totalLife - b.life;
            const holdEnd = b.totalLife - b.fadeTime;
            let scale, alpha, sharp;
            if (t < b.appearTime) {
                // Lớn dần (chậm dần về cuối) và rõ dần từ ảnh nhòe
                const p = t / b.appearTime;
                scale = 0.2 + 0.8 * (1 - Math.pow(1 - p, 3));
                alpha = Math.min(1, p * 1.6);
                sharp = MyMath.clamp((p - 0.15) / 0.85, 0, 1);
            } else if (t < holdEnd) {
                // "Thở" nhẹ khi đang giữ
                const p = (t - b.appearTime) / Math.max(1, holdEnd - b.appearTime);
                scale = 1 + Math.sin(p * Math.PI) * 0.025;
                alpha = 1;
                sharp = 1;
            } else {
                const p = MyMath.clamp((t - holdEnd) / b.fadeTime, 0, 1);
                scale = 1 + p * 0.08;
                alpha = 1 - p * p;
                sharp = 1;
            }
            const w = b.w * scale;
            const h = b.h * scale;
            const left = b.x - w / 2;
            const top = b.y - h / 2;

            ctx.save();
            ctx.lineJoin = 'round';
            if (b.stroke) {
                // Quầng sáng của viền, phía sau ảnh
                traceFramePath(ctx, b.frame, b.x, b.y, w / 2, h / 2);
                ctx.strokeStyle = b.color;
                ctx.globalAlpha = alpha * 0.16;
                ctx.lineWidth = Math.max(10, w * 0.06);
                ctx.stroke();
                ctx.globalAlpha = alpha * 0.32;
                ctx.lineWidth = Math.max(5, w * 0.03);
                ctx.stroke();
            }
            // Thu, phóng ảnh mịn (mặc định 'low' làm ảnh rỗ khi vẽ nhỏ hơn cỡ ảnh)
            ctx.imageSmoothingQuality = 'high';
            if (sharp < 1 && b.img.soft) {
                ctx.globalAlpha = alpha * (1 - sharp * sharp);
                ctx.drawImage(b.img.soft, left, top, w, h);
            }
            if (sharp > 0) {
                ctx.globalAlpha = alpha * sharp;
                ctx.drawImage(b.img, left, top, w, h);
            }
            if (b.stroke) {
                // Viền sắc nét phía trên
                traceFramePath(ctx, b.frame, b.x, b.y, w / 2, h / 2);
                ctx.globalAlpha = alpha;
                ctx.lineWidth = Math.max(2.5, w * 0.012);
                ctx.stroke();
            }
            ctx.restore();
        });
    }
}
