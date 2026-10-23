/*!
 * Trình diễn Pháo hoa – trình phát: quả pháo
 * Phần bổ sung và chỉnh sửa © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Quả pháo (Shell): phóng lên theo kiểu bắn rồi nổ thành hạt theo hình dạng, màu sắc và hiệu ứng đã chọn.

import MyMath from '../MyMath.js';
import { LAUNCH_STYLES } from './launch-styles.js';
import { randomColor } from './colors.js';
import { IS_MOBILE, COLOR, INVISIBLE, PI_2 } from './env.js';
import { stageW, stageH, quality, isHighQuality, isRunning, settings, horizon } from './state.js';
import { Star, BurstFlash } from './particles.js';
import { soundManager } from './audio.js';
import { normalizeAssetPath } from './utils.js';
import { imageParticleCache, ImageBurst } from './image-burst.js';
import { imageCacheKey } from './image-frame.js';
import { Smoke } from './smoke.js';
import { after } from './clock.js';
import {
    crossetteEffect, crackleEffect, floralEffect, fallingLeavesEffect, createParticleArc, createBurst
} from './effects.js';

/**
 * Shell can be constructed with options:
 *
 * spreadSize:      Size of the burst.
 * starCount: Number of stars to create. This is optional, and will be set to a reasonable quantity for size if omitted.
 * starLife:
 * starLifeVariation:
 * color:
 * glitterColor:
 * glitter: One of: 'light', 'medium', 'heavy', 'streamer', 'willow'
 * pistil:
 * pistilColor:
 * streamers:
 * crossette:
 * floral:
 * crackle:
 */
export class Shell {
    constructor(options) {
        Object.assign(this, options);
        // Safety clamp for launch angle
        if (this.launchAngle !== undefined) {
            this.launchAngle = Math.max(0, Math.min(180, this.launchAngle));
        }
        this.starLifeVariation = options.starLifeVariation ?? 0.125;
        // Kiểu bắn; kịch bản cũ dùng "spiralLift: true" cho kiểu xoắn đôi
        this.launchStyle = LAUNCH_STYLES[options.launchStyle] ? options.launchStyle : (options.spiralLift ? 'spiral' : 'straight');
        this.color = options.color || randomColor();
        this.glitterColor = options.glitterColor || this.color;

        // Đặt starCount mặc định trước khi spreadSize bị thu nhỏ để giữ nguyên mật độ hạt cao/chi tiết trên mobile.
        // Kịch bản đặt số hạt không hợp lệ (âm, dưới 1, không phải số) cũng tính theo cỡ pháo
        if (!(this.starCount >= 1)) {
            const density = options.starDensity || 1;
            const scaledSize = this.spreadSize / 54;
            this.starCount = Math.max(6, scaledSize * scaledSize * density);
        }

        if (IS_MOBILE && this.spreadSize) {
            this.spreadSize *= 0.65;
        }
    }

    // Dùng cho các chuỗi bắn ngẫu nhiên: `launchHeight` từ 0 (thấp) đến 1 (cao).
    // Pháo theo kịch bản dùng `launchAt()` để nổ đúng tọa độ đã đặt.
    launch(position, launchHeight) {
        const width = stageW;
        // Có mặt nước thì tính theo phần trời phía trên
        const height = stageH * horizon();
        // Khoảng cách từ các cạnh của màn hình để giữ vỏ.
        const hpad = 60;
        // Khoảng cách từ đỉnh màn hình để giữ cho vỏ nổ.
        const vpad = 50;
        // Chiều cao bùng nổ tối thiểu, tính theo phần trăm chiều cao sân khấu
        const minHeightPercent = 0.45;
        // Chiều cao bùng nổ tối thiểu tính bằng px
        const minHeight = height - height * minHeightPercent;

        const launchX = position * (width - hpad * 2) + hpad;
        const burstY = minHeight - (launchHeight * (minHeight - vpad));

        this.launchAt(launchX, burstY);
    }

    launchAt(x, y) {
        const width = stageW;
        // Phóng từ đường chân trời (đáy màn hình, hoặc mép nước khi kịch bản có mặt nước)
        const height = stageH * horizon();

        const launchX = x;
        const launchY = height;
        const burstX = x;
        const burstY = y;

        // Nếu có launchAngle, ta tính lại điểm nổ (burstX) để đạt được góc bắn mong muốn
        // 90 độ là thẳng đứng, 0 độ là trái, 180 độ là phải
        const angleRad = (this.launchAngle !== undefined ? this.launchAngle - 90 : 0) * (Math.PI / 180);
        const finalBurstX = burstX + Math.sin(angleRad) * (launchY - burstY);
        const finalDx = finalBurstX - launchX;
        const dy = burstY - launchY;

        const launchDistance = Math.sqrt(finalDx * finalDx + dy * dy);
        // Cần sử dụng đường cong công suất tùy chỉnh để ước chừng Vi để đạt được Khoảng cách phóng dưới tác dụng của trọng lực và lực cản của không khí.
        // Những con số kỳ diệu đến từ thử nghiệm.
        const launchVelocity = Math.pow(launchDistance * 0.04, 0.64);
        const computedAngle = Math.atan2(dy, finalDx);

        const comet = this.comet = Star.add(
            launchX,
            launchY,
            typeof this.color === 'string' && this.color !== 'random' ? this.color : COLOR.White,
            computedAngle,
            launchVelocity * (this.horsetail ? 1.2 : 1),
            // Thời gian treo được suy ra tuyến tính từ Vi; con số chính xác đến từ thử nghiệm
            launchVelocity * (this.horsetail ? 100 : 400)
        );
        comet.targetY = burstY; // Ghi nhớ độ cao cần nổ
        comet.smokeTrail = true;

        // làm sao chổi trở nên “nặng” hạn chế lực cản không khí
        comet.heavy = true;
        // vệt tia lửa sao chổi
        comet.spinRadius = MyMath.random(0.32, 0.85);
        comet.sparkFreq = 32 / quality;
        if (isHighQuality) comet.sparkFreq = 8;
        comet.sparkLife = 320;
        comet.sparkLifeVariation = 3;
        if (this.glitter === 'willow' || this.fallingLeaves) {
            comet.sparkFreq = 20 / quality;
            comet.sparkSpeed = 0.5;
            comet.sparkLife = 500;
        }
        if (this.color === INVISIBLE) {
            comet.sparkColor = COLOR.Gold;
        }

        // Kiểu bắn (cách bay lên), mặc định bay thẳng
        const launchStyle = LAUNCH_STYLES[this.launchStyle] || LAUNCH_STYLES.straight;

        // Ngẫu nhiên làm cho sao chổi “cháy” sớm một chút.
        // Tính năng này bị vô hiệu hóa đối với vỏ đuôi ngựa do thời gian phát sóng của chúng rất ngắn.
        // Không áp dụng cho các loại vỏ tàng hình (như lá rơi) hoặc Liễu để tránh làm biến mất vệt sáng phóng lên,
        // và chỉ khi bay thẳng: các kiểu bắn khác cần thấy rõ vệt sáng suốt đường bay.
        if (launchStyle === LAUNCH_STYLES.straight && Math.random() > 0.4 && !this.horsetail && this.color !== INVISIBLE && this.glitter !== 'willow') {
            comet.secondColor = INVISIBLE;
            comet.transitionTime = Math.pow(Math.random(), 1.5) * 700 + 500;
        }

        const styleHooks = (launchStyle.setup && launchStyle.setup(this, comet, {
            x: launchX,
            y: launchY,
            burstX: finalBurstX,
            burstY,
            angle: computedAngle,
            velocity: launchVelocity * (this.horsetail ? 1.2 : 1)
        })) || {};

        comet.onDeath = comet => {
            if (styleHooks.beforeBurst) styleHooks.beforeBurst(comet);
            this.burst(comet.x, comet.y);
        };

        // Âm thanh phóng tùy chỉnh
        if (this.liftSound === 'none') {
            // Im lặng
        } else if (this.liftSound && soundManager.sources[this.liftSound]) {
            soundManager.playSound(this.liftSound);
        } else {
            soundManager.playSound('lift');
        }

        // Âm thanh bay tùy chỉnh (Whistle)
        if (this.whistleSound && this.whistleSound !== 'none' && soundManager.sources[this.whistleSound]) {
            soundManager.playSound(this.whistleSound);
        }
    }

    burst(x, y) {
        // Khói tại chỗ nổ: chỉ quả phóng lên và các quả nổ con, không tính nhụy hoa (nổ cùng chỗ với quả chính)
        if ((this.comet || this.isSubBurst) && Smoke.active()) {
            Smoke.burst(x, y, this.isSubBurst ? this.spreadSize * 0.7 : this.spreadSize, this.color);
        }

        // Nếu là loại hình ảnh, ta tạo ImageBurst thay vì pháo hạt
        if (this.shell === 'Hình ảnh' && this.imageUrl) {
            const normalizedUrl = normalizeAssetPath(this.imageUrl);
            const cacheKey = imageCacheKey(normalizedUrl, this.frame, this.crop);
            const img = imageParticleCache.get(cacheKey);
            if (img) {
                // Lấy màu đầu tiên từ mảng color hoặc chính nó nếu là string
                const firstColor = Array.isArray(this.color) ? this.color[0] : this.color;
                const imageBurst = ImageBurst.spawn(x, y, img, {
                    size: this.shellSize || 1,
                    frame: this.frame,
                    color: firstColor === 'random' ? randomColor() : (firstColor || COLOR.White),
                    duration: this.duration
                });

                // Kết xuất flash hàng đợi
                BurstFlash.add(imageBurst.x, imageBurst.y, this.spreadSize / 3);
                if (this.comet && this.burstSound !== 'none') {
                    soundManager.playSound(soundManager.sources[this.burstSound] ? this.burstSound : 'burst', 1);
                }
                return;
            } else {
                console.warn('[Firework] Image not ready in Main simulation cache:', cacheKey);
                window.preloadFireworkImage && window.preloadFireworkImage(this.imageUrl, this.frame, this.crop);
            }
        }

        // Handle multi-burst logic
        if (this.multiBurst && !this.isSubBurst) {
            const count = 4 + Math.floor(Math.random() * 4);
            for (let i = 0; i < count; i++) {
                const delay = 400 + Math.random() * 1200;
                after(delay, () => {
                    if (!isRunning()) return;
                    const offsetX = (Math.random() - 0.5) * this.spreadSize * 1.8;
                    const offsetY = (Math.random() - 0.5) * this.spreadSize * 1.8;
                    const subShell = new Shell({
                        shellSize: this.shellSize * 0.7,
                        spreadSize: this.spreadSize * 0.6,
                        starLife: this.starLife * 0.8,
                        color: this.color === 'random' ? randomColor() : this.color,
                        glitter: this.glitter,
                        glitterColor: this.glitterColor,
                        isSubBurst: true
                    });
                    subShell.burst(x + offsetX, y + offsetY);
                    // Mỗi quả con nổ cũng kêu "bùm", nhỏ hơn quả chính (quả con không có sao chổi nên burst() không tự phát tiếng)
                    const snd = this.burstSound;
                    if (snd !== 'none') soundManager.playSound(snd && soundManager.sources[snd] ? snd : 'burst', 0.7);
                });
            }
        }

        // Đặt tốc độ chụp liên tục để tổng số lần chụp tăng lên theo kích thước đã đặt. Công thức cụ thể này được rút ra từ thử nghiệm và bị ảnh hưởng bởi lực cản không khí mô phỏng.
        const speed = this.spreadSize / 96;

        let color, onDeath, sparkFreq, sparkSpeed, sparkLife;
        let sparkLifeVariation = 0.25;
        // Một số hiệu ứng chết chóc, chẳng hạn như tiếng crackle, phát ra âm thanh nhưng chỉ nên phát một lần.
        let playedDeathSound = false;

        if (this.crossette) onDeath = (star) => {
            if (!playedDeathSound) {
                soundManager.playSound('crackleSmall');
                playedDeathSound = true;
            }
            crossetteEffect(star);
        }
        if (this.crackle) onDeath = (star) => {
            if (!playedDeathSound) {
                // Âm thanh nổ tùy chỉnh cho crackle
                const snd = this.burstSound !== undefined ? this.burstSound : 'crackle';
                if (snd !== 'none' && snd) soundManager.playSound(snd);
                playedDeathSound = true;
            }
            crackleEffect(star);
        }
        if (this.floral) onDeath = floralEffect;
        if (this.fallingLeaves) onDeath = fallingLeavesEffect;

        if (this.glitter === 'light') {
            sparkFreq = 400;
            sparkSpeed = 0.3;
            sparkLife = 300;
            sparkLifeVariation = 2;
        }
        else if (this.glitter === 'medium') {
            sparkFreq = 200;
            sparkSpeed = 0.44;
            sparkLife = 700;
            sparkLifeVariation = 2;
        }
        else if (this.glitter === 'heavy') {
            sparkFreq = 80;
            sparkSpeed = 0.8;
            sparkLife = 1400;
            sparkLifeVariation = 2;
        }
        else if (this.glitter === 'thick') {
            sparkFreq = 16;
            sparkSpeed = isHighQuality ? 1.65 : 1.5;
            sparkLife = 1400;
            sparkLifeVariation = 3;
        }
        else if (this.glitter === 'streamer') {
            sparkFreq = 32;
            sparkSpeed = 1.05;
            sparkLife = 620;
            sparkLifeVariation = 2;
        }
        else if (this.glitter === 'willow') {
            // Dày tia hơn các kiểu khác: màn tia lửa vàng rủ xuống là cái hồn của pháo liễu
            sparkFreq = 60;
            sparkSpeed = 0.48;
            sparkLife = 1500;
            sparkLifeVariation = 3.8;
        }

        // Áp dụng chất lượng cho số lượng tia lửa
        sparkFreq = sparkFreq / quality;

        // Gắn hiệu ứng của vỏ (chuyển màu, nhấp nháy, cháy lâu, lấp lánh, hiệu ứng lúc tàn) cho một hạt.
        // Dùng chung cho nổ thường, hình dạng, vòng nhẫn và xoay vòng.
        const decorateStar = (star) => {
            if (this.secondColor) {
                star.transitionTime = this.transitionTime || this.starLife * (Math.random() * 0.05 + 0.32);
                star.secondColor = this.secondColor;
            }

            if (this.strobe) {
                star.transitionTime = this.transitionTime || this.starLife * (Math.random() * 0.08 + 0.46);
                star.strobe = true;
                // Có bao nhiêu mili giây giữa lần chuyển đổi trạng thái nhấp nháy "tích tắc". Lưu ý rằng kiểu nhấp nháy
                // đang bật:tắt:tắt, vì vậy đây là khoảng thời gian "bật", trong khi khoảng thời gian "tắt" dài gấp đôi.
                star.strobeFreq = this.strobeFreq || Math.random() * 20 + 40;
                if (this.strobeColor) {
                    star.secondColor = this.strobeColor;
                }
            }

            if (this.hang) {
                // Cháy lâu: lơ lửng, rơi chậm, gần tàn thì lấp lánh
                star.gravityScale = 0.35;
                if (star.orbit) star.orbit.fallAcc *= 0.35;
                star.twinkle = true;
                if (!star.transitionTime) star.transitionTime = this.starLife * 0.3;
            }

            star.onDeath = onDeath;

            if (this.glitter) {
                star.sparkFreq = sparkFreq;
                star.sparkSpeed = sparkSpeed;
                star.sparkLife = sparkLife;
                star.sparkLifeVariation = sparkLifeVariation;
                if (this.glitterColor === 'random') {
                    star.sparkColor = star.color;
                } else if (Array.isArray(this.glitterColor)) {
                    star.sparkColor = this.glitterColor[Math.floor(Math.random() * this.glitterColor.length)];
                } else {
                    star.sparkColor = this.glitterColor;
                }
                star.sparkTimer = Math.random() * star.sparkFreq;
            }
        };

        // Nhà máy sao cho cụm sơ cấp, nhụy hoa và bộ truyền phát.
        const starFactory = (angle, speedMult) => {
            // Đối với đạn pháo không phải đuôi ngựa, hãy tính tốc độ thẳng đứng ban đầu để thêm vào vụ nổ sao.
            // Con số kỳ diệu đến từ việc thử nghiệm những gì trông đẹp nhất. Lý tưởng là tất cả vỏ
            // các vụ nổ xuất hiện ở trung tâm một cách trực quan trong phần lớn thời gian tồn tại của sao (không bao gồm cây liễu, v.v.)
            const standardInitialSpeed = this.spreadSize / 1800;

            const star = Star.add(
                x,
                y,
                color,
                angle,
                // Lệch tốc độ chút ít như thuốc phóng trong quả pháo thật: mép quả nổ tự nhiên, không tròn vành vạnh
                speedMult * speed * (0.95 + Math.random() * 0.1),
                // thêm biến thể nhỏ vào cuộc sống của ngôi sao
                this.starLife + Math.random() * this.starLife * this.starLifeVariation,
                this.horsetail ? this.comet && this.comet.speedX : 0,
                this.horsetail ? this.comet && this.comet.speedY : -standardInitialSpeed
            );
            decorateStar(star);
        };


        if (typeof this.color === 'string' || Array.isArray(this.color)) {
            color = this.color;

            // Các vòng có tính ngẫu nhiên về vị trí nhưng được xoay ngẫu nhiên
            if (this.shapePoints) {
                // Chỉ xoay ngẫu nhiên nếu KHÔNG phải là pháo văn bản để giữ chữ dễ đọc
                const isText = this.shapePoints.isText;
                const rotationRad = (this.rotation || 0) * (Math.PI / 180);
                const shapeStartAngle = isText ? 0 : (this.rotation !== undefined ? rotationRad : (Math.random() - 0.5) * 0.4);
                const cosA = Math.cos(shapeStartAngle);
                const sinA = Math.sin(shapeStartAngle);

                this.shapePoints.forEach(p => {
                    const star = Star.add(
                        x,
                        y,
                        p.color || color,
                        0, // Angle không quan trọng vì ta sẽ ghi đè speedX/Y
                        0, // Speed không quan trọng vì ta sẽ ghi đè speedX/Y
                        this.starLife + Math.random() * this.starLife * this.starLifeVariation
                    );
                    // Vận tốc theo điểm p đã xoay một góc shapeStartAngle, đảm bảo hình đúng hướng tuyệt đối. Chữ: mỗi hạt lệch
                    // tốc độ chút ít như thuốc phóng thật, chữ nở ra không đều tăm tắp mà vẫn đọc rõ
                    const kick = isText ? speed * (0.97 + Math.random() * 0.06) : speed;
                    star.speedX = (p.x * cosA - p.y * sinA) * kick;
                    star.speedY = (p.x * sinA + p.y * cosA) * kick;
                    decorateStar(star);
                });
            } else if (this.ring) {
                const ringStartAngle = Math.random() * Math.PI;
                const ringSquash = Math.pow(Math.random(), 2) * 0.85 + 0.15;

                createParticleArc(0, PI_2, this.starCount, 0, angle => {
                    // Tạo hình vòng, ép ngang
                    const initSpeedX = Math.sin(angle) * speed * ringSquash;
                    const initSpeedY = Math.cos(angle) * speed;
                    // Xoay vòng
                    const newSpeed = MyMath.pointDist(0, 0, initSpeedX, initSpeedY);
                    const newAngle = MyMath.pointAngle(0, 0, initSpeedX, initSpeedY) + ringStartAngle;
                    const star = Star.add(
                        x,
                        y,
                        color,
                        newAngle,
                        newSpeed,
                        // thêm biến thể nhỏ vào cuộc sống của ngôi sao
                        this.starLife + Math.random() * this.starLife * this.starLifeVariation
                    );
                    decorateStar(star);
                });
            } else if (this.spin) {
                // Các nhánh sáng quay quanh tâm vụ nổ. 'wheel': bánh xe nhiều nan quay nhanh, nhìn thẳng.
                // 'galaxy': thiên hà ít nhánh cong, quay chậm hơn, nghiêng như một chiếc đĩa trong không gian.
                const galaxy = this.spin === 'galaxy';
                const arms = galaxy ? 3 + (Math.random() < 0.5 ? 1 : 0) : 6 + ((Math.random() * 3) | 0);
                const perArm = Math.max(4, Math.round(this.starCount / arms * (galaxy ? 1.2 : 0.8)));
                const radius = this.spreadSize * (galaxy ? 0.6 : 0.5);
                const direction = Math.random() < 0.5 ? 1 : -1;
                const curl = galaxy ? 2.4 : 0.35;
                const squash = galaxy ? MyMath.random(0.5, 0.8) : MyMath.random(0.8, 1);
                const tilt = galaxy ? MyMath.random(-0.6, 0.6) : 0;
                const startAngle = Math.random() * PI_2;
                // Bánh xe: nan đều tăm tắp, hạt cách đều, cả bánh quay cứng một tốc độ thì trông như máy. Như chong chóng lửa
                // thật: nan dài ngắn, lệch góc khác nhau, hạt trong nan cách không đều; vòng trong quay nhanh hơn vòng ngoài
                // nên nan cong dần thành vệt xoáy; mỗi hạt văng ra nhanh chậm, rơi nhanh chậm khác nhau một chút
                const wobble = (spread) => (galaxy ? 1 : 1 + (Math.random() - 0.5) * 2 * spread);
                for (let a = 0; a < arms; a++) {
                    // Mỗi nhánh một màu khi chọn nhiều màu hoặc "Ngẫu nhiên"
                    const armColor = Array.isArray(color) ? color[a % color.length] : (color === 'random' ? randomColor() : color);
                    const armAngle = startAngle + (a + (galaxy ? 0 : (Math.random() - 0.5) * 0.35)) * PI_2 / arms;
                    const armLength = wobble(0.12);
                    for (let j = 1; j <= perArm; j++) {
                        const t = galaxy ? j / perArm : Math.max(0.05, (j - Math.random() * 0.8) / perArm);
                        const star = Star.add(x, y, armColor, 0, 0, this.starLife + Math.random() * this.starLife * this.starLifeVariation);
                        star.orbit = {
                            cx: x,
                            cy: y,
                            radius: 0,
                            targetRadius: radius * (galaxy ? Math.pow(t, 0.85) : t * armLength * wobble(0.05)),
                            expand: galaxy ? 0.04 : 0.06 * wobble(0.25),
                            // Nhánh cong ngược chiều quay, như vệt xoáy bị kéo lại phía sau
                            angle: armAngle - direction * curl * t + (galaxy ? 0 : (Math.random() - 0.5) * 0.08),
                            angularSpeed: direction * (galaxy ? 0.045 : 0.09 * (1.15 - 0.3 * t) * wobble(0.06)),
                            spinDrag: galaxy ? 0.004 : 0.006,
                            squash,
                            tiltCos: Math.cos(tilt),
                            tiltSin: Math.sin(tilt),
                            fallSpeed: 0,
                            fallAcc: 0.0025 * wobble(0.2)
                        };
                        decorateStar(star);
                    }
                }
            }
            // Nổ bình thường
            else {
                createBurst(this.starCount, starFactory);
            }
        }
        else {
            throw new Error('Invalid shell color. Expected string or array of strings, but got: ' + this.color);
        }

        if (this.pistil) {
            const innerShell = new Shell({
                spreadSize: this.spreadSize * 0.5,
                starLife: this.starLife * 0.6,
                starLifeVariation: this.starLifeVariation,
                starDensity: 1.4,
                color: this.pistilColor,
                glitter: 'light',
                glitterColor: this.pistilColor === COLOR.Gold ? COLOR.Gold : COLOR.White
            });
            innerShell.burst(x, y);
        }

        if (this.streamers) {
            const innerShell = new Shell({
                spreadSize: this.spreadSize * 0.9,
                starLife: this.starLife * 0.8,
                starLifeVariation: this.starLifeVariation,
                starCount: Math.floor(Math.max(6, this.spreadSize / 45)),
                color: COLOR.White,
                glitter: 'streamer'
            });
            innerShell.burst(x, y);
        }

        // Kết xuất flash hàng đợi
        BurstFlash.add(x, y, this.spreadSize / 4);

        // Phát âm thanh, nhưng chỉ dành cho vỏ "nguyên bản", loại đã được ra mắt.
        // Chúng tôi không muốn có nhiều âm thanh từ nhụy hoa hoặc "vỏ phụ" của bộ truyền phát.
        // Điều này có thể được phát hiện bởi sự hiện diện của sao chổi.
        if (this.comet) {
            // Chia tỷ lệ âm thanh nổ dựa trên kích thước vỏ hiện tại và kích thước vỏ đã chọn (tối đa).
            const maxDiff = 2;
            const sizeDifferenceFromMaxSize = Math.min(maxDiff, +settings().size - this.shellSize);
            const soundScale = (1 - sizeDifferenceFromMaxSize / maxDiff) * 0.3 + 0.7;

            // Âm thanh nổ tùy chỉnh
            const burstSnd = this.burstSound;
            if (burstSnd === 'none') {
                // Im lặng
            } else if (burstSnd && soundManager.sources[burstSnd]) {
                soundManager.playSound(burstSnd, soundScale);
            } else {
                soundManager.playSound('burst', soundScale);
            }
        }
    }
}
