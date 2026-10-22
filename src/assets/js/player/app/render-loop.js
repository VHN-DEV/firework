/*!
 * Trình diễn Pháo hoa – trình phát (vòng vẽ)
 * Phần bổ sung và chỉnh sửa © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Cập nhật hạt pháo và vẽ mỗi khung hình (pháo, tia lửa, khói, cảnh vật, mặt nước, thời tiết).

import { now } from '../clock.js';
import { COLOR, GRAVITY, INVISIBLE, PI_2, SKY_LIGHT_NONE } from '../env.js';
import { isLowQuality, simSpeed, stageH, stageW } from '../state.js';
import { BurstFlash, Spark, Star } from '../particles.js';
import { ImageBurst } from '../image-burst.js';
import { Smoke } from '../smoke.js';
import { Decor, Water, Weather } from '../scenery/index.js';
import { recording } from './recording.js';
import { autoTuner, superSampler } from './quality-tuning.js';
import { colorSky, currentSkyColor } from './sky-color.js';
import { SMOKE_LEVELS, appNodes, burstConfig, currentFrame, decoCanvas, decoCtx, frameH, frameW, horizonSelector, isRunning, mainStage, reduceFlashingSelector, scaleFactorSelector, sceneSelector, skyLightingSelector, smokeCanvas, smokeCtx, speedBarOpacity, store, syncShow, trailsStage, updateGlobals, waterCtx, waterLifeFlags } from '../../script.js';

// Bỏ phần tử thứ i: đưa phần tử cuối vào chỗ của nó thay vì splice (splice dồn cả mảng, hàng nghìn tia lửa tắt mỗi
// khung thành hàng triệu thao tác). Vòng cập nhật chạy ngược nên phần tử cuối đã được cập nhật trong khung này.
function removeAt(list, i) {
    const last = list.pop();
    if (i < list.length) list[i] = last;
}

export function update(frameTime, lag) {
    // Đang dựng video: chỉ vòng dựng (renderVideo) cho mô phỏng bước tiếp, theo đúng nhịp khung hình của video
    if (recording.active && !recording.stepping) return;
    if (!isRunning()) return;
    autoTuner.frame(performance.now());
    superSampler.frame(performance.now());
    // Kịch bản khớp nhịp: chờ nhạc kêu rồi pháo mới bay tiếp
    if (syncShow.holds(frameTime)) return;

    const width = stageW;
    const height = stageH;
    const timeStep = frameTime * simSpeed;
    const speed = simSpeed * lag;
    const reduceFlashing = reduceFlashingSelector();

    updateGlobals(timeStep, lag);
    ImageBurst.updateAll(timeStep);
    const smokeOn = Smoke.active();
    Decor.sync(sceneSelector(), frameW, frameH);
    Decor.update(timeStep);
    Smoke.update(timeStep, !burstConfig || !SMOKE_LEVELS[burstConfig.smoke]);

    const starDrag = 1 - (1 - Star.airDrag) * speed;
    const starDragHeavy = 1 - (1 - Star.airDragHeavy) * speed;
    const sparkDrag = 1 - (1 - Spark.airDrag) * speed;
    const gAcc = timeStep / 1000 * GRAVITY;

    // Cập nhật Ngôi sao (Stars)
    Object.keys(Star.active).forEach(color => {
        const stars = Star.active[color];
        for (let i = stars.length - 1; i >= 0; i = i - 1) {
            const star = stars[i];
            if (star.updateFrame === currentFrame) {
                continue;
            }
            star.updateFrame = currentFrame;

            star.life -= timeStep;
            if (star.targetY !== undefined && (star.y <= star.targetY || star.speedY >= 0)) {
                star.life = 0; // Buộc nổ khi đạt tới độ cao mục tiêu hoặc bắt đầu rơi xuống
            }
            if (star.life <= 0) {
                removeAt(stars, i);
                Star.returnInstance(star);
            } else {
                const burnRate = Math.pow(star.life / star.fullLife, 0.5);
                const burnRateInverse = 1 - burnRate;

                star.prevX = star.x;
                star.prevY = star.y;
                if (star.orbit) {
                    // Hạt quay quanh tâm vụ nổ: bán kính nở dần tới đích, vòng quay chậm dần, cả vòng rơi nhẹ
                    const o = star.orbit;
                    o.radius += (o.targetRadius - o.radius) * Math.min(1, o.expand * speed);
                    o.angle += o.angularSpeed * speed;
                    o.angularSpeed *= 1 - o.spinDrag * speed;
                    o.fallSpeed += o.fallAcc * speed;
                    o.cy += o.fallSpeed * speed;
                    const lx = Math.cos(o.angle) * o.radius;
                    const ly = Math.sin(o.angle) * o.radius * o.squash;
                    const nx = o.cx + lx * o.tiltCos - ly * o.tiltSin;
                    const ny = o.cy + lx * o.tiltSin + ly * o.tiltCos;
                    // Vận tốc = quãng vừa đi, để vệt sáng đầu hạt và tia lửa đi đúng hướng quay
                    star.speedX = speed ? (nx - star.x) / speed : 0;
                    star.speedY = speed ? (ny - star.y) / speed : 0;
                    star.x = nx;
                    star.y = ny;
                } else {
                    star.x += star.speedX * speed;
                    star.y += star.speedY * speed;
                    if (!star.heavy) {
                        star.speedX *= starDrag;
                        star.speedY *= starDrag;
                    }
                    else {
                        star.speedX *= starDragHeavy;
                        star.speedY *= starDragHeavy;
                    }
                    star.speedY += gAcc * star.gravityScale;

                    if (star.spinRadius) {
                        star.spinAngle += star.spinSpeed * speed;
                        star.x += Math.sin(star.spinAngle) * star.spinRadius * speed;
                        star.y += Math.cos(star.spinAngle) * star.spinRadius * speed;
                    }
                }

                // Hành vi riêng của kiểu bắn (xoắn, lượn, nổ dọc đường, đẩy lên tầng trên...)
                if (star.onUpdate) star.onUpdate(star, timeStep, speed);
                if (star.smokeTrail && smokeOn) Smoke.trail(star, timeStep);

                if (star.sparkFreq) {
                    star.sparkTimer -= timeStep;
                    while (star.sparkTimer < 0) {
                        star.sparkTimer += star.sparkFreq * 0.75 + star.sparkFreq * burnRateInverse * 4;
                        Spark.add(
                            star.x,
                            star.y,
                            star.sparkColor,
                            Math.random() * PI_2,
                            Math.random() * star.sparkSpeed * burnRate,
                            star.sparkLife * 0.8 + Math.random() * star.sparkLifeVariation * star.sparkLife
                        );
                    }
                }

                if (star.life < star.transitionTime) {
                    if (star.secondColor && !star.colorChanged) {
                        star.colorChanged = true;
                        star.color = star.secondColor;
                        removeAt(stars, i);
                        if (!Star.active[star.secondColor]) Star.active[star.secondColor] = [];
                        Star.active[star.secondColor].push(star);
                        if (star.secondColor === INVISIBLE) {
                            star.sparkFreq = 0;
                        }
                    }

                    if (reduceFlashing) {
                        // Giảm chớp sáng: hạt nhấp nháy, lấp lánh giữ sáng đều
                    } else if (star.strobe) {
                        star.visible = Math.floor(star.life / star.strobeFreq) % 3 === 0;
                    } else if (star.twinkle) {
                        // Lấp lánh ngẫu nhiên lúc sắp tàn
                        star.visible = Math.random() < 0.55;
                    }
                }
            }
        }
    });

    // Cập nhật Tia lửa (Sparks)
    Object.keys(Spark.active).forEach(color => {
        const sparks = Spark.active[color];
        for (let i = sparks.length - 1; i >= 0; i = i - 1) {
            const spark = sparks[i];
            spark.life -= timeStep;
            if (spark.life <= 0) {
                removeAt(sparks, i);
                Spark.returnInstance(spark);
            } else {
                spark.prevX = spark.x;
                spark.prevY = spark.y;
                spark.x += spark.speedX * speed;
                spark.y += spark.speedY * speed;
                spark.speedX *= sparkDrag;
                spark.speedY *= sparkDrag;
                spark.speedY += gAcc;
            }
        }
    });

    render(speed);
}

// Lượng làm mờ vệt sáng đang tích lũy (đơn vị: số khung 60Hz)
let trailFadeAmount = 0;

function render(speed) {
    const { dpr } = mainStage;
    const width = stageW;
    const height = stageH;
    const trailsCtx = trailsStage.ctx;
    const mainCtx = mainStage.ctx;

    if (reduceFlashingSelector()) {
        // Giảm chớp sáng: bầu trời giữ màu đen, không lóe sáng theo pháo
        if (currentSkyColor.r || currentSkyColor.g || currentSkyColor.b) {
            currentSkyColor.r = currentSkyColor.g = currentSkyColor.b = 0;
            appNodes.stageContainer.style.backgroundColor = '#000';
        }
    } else if (skyLightingSelector() !== SKY_LIGHT_NONE) {
        colorSky(speed);
    } else if (currentSkyColor.r || currentSkyColor.g || currentSkyColor.b) {
        // Vừa tắt ánh sáng bầu trời: mặt nước, khói đang đọc màu trời này
        currentSkyColor.r = currentSkyColor.g = currentSkyColor.b = 0;
    }

    // Tính đến màn hình có độ phân giải cao và hệ số tỷ lệ tùy chỉnh.
    const scaleFactor = scaleFactorSelector();
    trailsCtx.scale(dpr * scaleFactor, dpr * scaleFactor);
    mainCtx.scale(dpr * scaleFactor, dpr * scaleFactor);

    trailsCtx.globalCompositeOperation = 'source-over';
    if (store.state.config.longExposure) {
        trailsCtx.fillStyle = 'rgba(0, 0, 0, 0.0025)';
        trailsCtx.fillRect(0, 0, width, height);
    } else {
        // Làm mờ vệt sáng theo nhịp ~60 lần/giây. Màn hình 120/144Hz mà phủ mỗi khung một lớp đen quá mỏng thì
        // điểm ảnh tối bị làm tròn giữ nguyên, để lại bóng mờ của pháo cũ trên trời.
        trailFadeAmount += speed;
        if (trailFadeAmount >= 1) {
            trailsCtx.fillStyle = `rgba(0, 0, 0, ${Math.min(1, 0.175 * trailFadeAmount)})`;
            trailsCtx.fillRect(0, 0, width, height);
            trailFadeAmount = 0;
        }
    }

    mainCtx.clearRect(0, 0, width, height);

    // Khói pháo: vẽ cả khi vừa tắt để xóa lớp khói còn lại
    Smoke.render(smokeCtx, smokeCanvas.width / (stageW || 1), currentSkyColor, reduceFlashingSelector());
    Decor.render(decoCtx, currentSkyColor);

    // Có mặt nước: pháo, tia lửa chỉ vẽ phía trên mép nước (rơi tới mặt nước thì tắt)
    const waterline = height * horizonSelector();
    const clipped = waterline < height;
    if (clipped) {
        [trailsCtx, mainCtx].forEach(ctx => {
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, 0, width, waterline);
            ctx.clip();
        });
    }

    // Vẽ các đèn flash xếp hàng đợi
    // Chúng cũng phải được vẽ bằng cách sử dụng nguồn qua Safari. Có vẻ như việc hiển thị độ dốc bằng cách sử dụng ánh sáng sẽ vẽ các hộp đen lớn thay thế.
    // Rất may, những tia chớp này trông khá giống nhau.
    while (BurstFlash.active.length) {
        const bf = BurstFlash.active.pop();

        // Kiểm tra an toàn để tránh lỗi non-finite
        if (!Number.isFinite(bf.x) || !Number.isFinite(bf.y) || !Number.isFinite(bf.radius) || bf.radius <= 0) {
            BurstFlash.returnInstance(bf);
            continue;
        }

        const burstGradient = trailsCtx.createRadialGradient(bf.x, bf.y, 0, bf.x, bf.y, bf.radius);
        burstGradient.addColorStop(0.024, 'rgba(255, 255, 255, 1)');
        burstGradient.addColorStop(0.125, 'rgba(255, 160, 20, 0.2)');
        burstGradient.addColorStop(0.32, 'rgba(255, 140, 20, 0.11)');
        burstGradient.addColorStop(1, 'rgba(255, 120, 20, 0)');
        trailsCtx.fillStyle = burstGradient;
        trailsCtx.fillRect(bf.x - bf.radius, bf.y - bf.radius, bf.radius * 2, bf.radius * 2);

        BurstFlash.returnInstance(bf);
    }

    // Bản vẽ còn lại trên canvas đường nhỏ sẽ sử dụng chế độ hòa trộn 'làm sáng'
    trailsCtx.globalCompositeOperation = 'lighten';

    // Vẽ ngôi sao
    trailsCtx.lineWidth = Star.drawWidth;
    trailsCtx.lineCap = isLowQuality ? 'square' : 'round';
    mainCtx.strokeStyle = '#fff';
    mainCtx.lineWidth = 1;
    mainCtx.beginPath();
    Object.keys(Star.active).forEach(color => {
        if (color === INVISIBLE || color === '_pool') return;
        const stars = Star.active[color];
        if (stars.length === 0) return;
        
        trailsCtx.strokeStyle = color;
        trailsCtx.beginPath();
        for (let i = 0; i < stars.length; i++) {
            const star = stars[i];
            if (star.visible) {
                trailsCtx.moveTo(star.x, star.y);
                trailsCtx.lineTo(star.prevX, star.prevY);
                mainCtx.moveTo(star.x, star.y);
                mainCtx.lineTo(star.x - star.speedX * 1.6, star.y - star.speedY * 1.6);
            }
        }
        trailsCtx.stroke();
    });
    mainCtx.stroke();

    // Vẽ tia lửa
    trailsCtx.lineWidth = Spark.drawWidth;
    trailsCtx.lineCap = 'butt';
    Object.keys(Spark.active).forEach(color => {
        if (color === INVISIBLE || color === '_pool') return;
        const sparks = Spark.active[color];
        if (sparks.length === 0) return;

        trailsCtx.strokeStyle = color;
        trailsCtx.beginPath();
        for (let i = 0; i < sparks.length; i++) {
            const spark = sparks[i];
            trailsCtx.moveTo(spark.x, spark.y);
            trailsCtx.lineTo(spark.prevX, spark.prevY);
        }
        trailsCtx.stroke();
    });


    // Vẽ hình ảnh phóng to
    ImageBurst.drawAll(mainCtx);


    if (clipped) {
        trailsCtx.restore();
        mainCtx.restore();
    }

    // Hiển thị thanh tốc độ nếu hiển thị
    if (speedBarOpacity) {
        const speedBarHeight = 6;
        mainCtx.globalAlpha = speedBarOpacity;
        mainCtx.fillStyle = COLOR.Blue;
        mainCtx.fillRect(0, height - speedBarHeight, width * simSpeed, speedBarHeight);
        mainCtx.globalAlpha = 1;
    }


    trailsCtx.setTransform(1, 0, 0, 1, 0, 0);
    mainCtx.setTransform(1, 0, 0, 1, 0, 0);

    // Mặt nước phản chiếu mọi thứ phía trên (vẽ sau cùng để bắt kịp khung hình này)
    const waterState = Water.render(waterCtx, {
        // Lớp đang trống (không trang trí, không khói) thì bỏ qua cho nhẹ máy
        sources: [Decor.active() && decoCanvas, Smoke.count() && smokeCanvas, trailsStage.canvas, mainStage.canvas],
        background: store.state.config.showBackground ? appNodes.backgroundImage : null,
        sky: currentSkyColor,
        cssW: frameW,
        cssH: frameH,
        time: now(),
        style: burstConfig && burstConfig.waterStyle === 'river' ? 'river' : 'lake',
        floating: burstConfig && ['lanterns', 'petals'].includes(burstConfig.floating) ? burstConfig.floating : '',
        calm: reduceFlashingSelector(),
        life: waterLifeFlags(),
        plants: !burstConfig || burstConfig.waterPlants !== false,
        rocks: !burstConfig || burstConfig.waterRocks !== false,
        bank: burstConfig && burstConfig.bank
    });
    // Mưa, tuyết rơi trên cùng (cùng lớp mặt nước: không in bóng xuống nước)
    Weather.render(waterCtx, { cssW: frameW, cssH: frameH, time: now(), sky: currentSkyColor, state: waterState });
}
