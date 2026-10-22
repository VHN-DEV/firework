/*!
 * Trình diễn Pháo hoa – trình phát (phát bắn theo kịch bản)
 * Phần bổ sung và chỉnh sửa © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Dựng, phóng phát bắn theo kịch bản; khớp nhịp nhạc (chờ nhạc rồi mới bắn tiếp).

import { COLOR, GRAVITY, INVISIBLE, IS_MOBILE } from '../env.js';
import { stageH, stageW } from '../state.js';
import { randomColor, resolveEventColor, resolveSingleColor } from '../colors.js';
import { getTextParticles } from '../shapes.js';
import { Star } from '../particles.js';
import { shellTypes } from '../shells.js';
import { Shell } from '../shell.js';
import { horizonSelector, shellSizeSelector } from '../../script.js';

// Tùy chọn pháo và điểm nổ (x, y: 0-1 theo bề ngang, tính từ mép trên) của một phát trong kịch bản
export function buildEventShot(event) {
    const size = event.size !== undefined ? event.size : shellSizeSelector();
    let options;

    if (event.shell === 'Văn bản' && event.text) {
        options = {
            shellSize: size,
            color: randomColor(),
            spreadSize: 300 + size * 100,
            starLife: 1400 + size * 200,
            glitter: 'light',
            glitterColor: COLOR.Gold
        };
    } else if (event.shell === 'Hình ảnh' && event.imageUrl) {
        options = {
            shell: 'Hình ảnh',
            imageUrl: event.imageUrl,
            frame: event.frame,
            crop: event.crop,
            shellSize: size,
            spreadSize: 300 + size * 100,
            // Thời gian ảnh hiện trên trời (ms)
            duration: event.duration
        };
    } else {
        const shellType = shellTypes[event.shell] || shellTypes['Văn bản'];
        options = shellType(size);
    }

    if (event.text) {
        const starDensity = event.starDensity !== undefined ? event.starDensity : 1;
        // Bước lấy mẫu tối thiểu 2px để chữ dày không tạo ra hàng chục nghìn hạt làm treo máy
        const step = Math.max(2, Math.round(3 / starDensity));
        // Không chọn màu (để trống hoặc "Ngẫu nhiên"): biểu tượng cảm xúc giữ màu gốc của nó
        const noColor = [].concat(event.color ?? []).every(c => !c || c === 'Ngẫu nhiên' || c === 'random');
        options.shapePoints = getTextParticles(event.text, 50, step, noColor);
    }

    const hasValue = (value) => value !== undefined && value !== null && value !== '';

    if (hasValue(event.color)) {
        const color = resolveEventColor(event.color);
        if (options.shell === 'Hình ảnh') {
            // Khung ảnh chỉ vẽ được một màu
            options.color = color === 'random' ? randomColor() : color;
        } else if (options.color === INVISIBLE && options.secondColor) {
            // Pháo "Ma": giữ hiệu ứng hiện dần từ vô hình, màu đã chọn là màu hiện ra
            if (color !== 'random') options.secondColor = Array.isArray(color) ? color[0] : color;
        } else {
            options.color = color;
        }
    }

    if (hasValue(event.glitterColor)) {
        options.glitterColor = resolveEventColor(event.glitterColor);
    }

    let xVal = event.x !== undefined ? event.x : 50;
    let yVal = event.y !== undefined ? event.y : 50;

    if (IS_MOBILE) {
        // Ánh xạ x vào khoảng an toàn 15% - 85% để tránh pháo bị tràn mép màn hình bên trái/phải
        xVal = 15 + (xVal / 100) * 70;
        // Ánh xạ y vào khoảng an toàn 5% - 95% (rộng hơn nhiều vì màn hình dọc rất dài, tránh làm nổ quá thấp)
        yVal = 5 + (yVal / 100) * 90;
    }

    const x = xVal / 100;
    // Độ cao tính từ đường chân trời (đáy màn hình, hoặc mép nước khi có mặt nước)
    const y = (100 - yVal) / 100 * horizonSelector();

    // Ghi đè các thuộc tính nâng cao từ event nếu có.
    // Áp dụng TRƯỚC khi tạo Shell để số hạt, kích thước trên mobile và giới hạn góc bắn được tính đúng.
    const overrides = [
        'strobe', 'strobeColor', 'pistil', 'pistilColor',
        'streamers', 'crossette', 'crackle', 'horsetail',
        'comet', 'starLife', 'starDensity', 'spreadSize',
        'starCount', 'starLifeVariation', 'glitter', 'secondColor',
        'transitionTime', 'floral', 'ring', 'strobeFreq',
        'launchAngle', 'ascentSpeed', 'rotation',
        'liftSound', 'burstSound', 'whistleSound',
        'launchStyle', 'spiralLift', 'hang'
    ];

    overrides.forEach(prop => {
        const value = event[prop];
        // Bỏ qua ô để trống và ô tích chưa bật (false): giữ mặc định của loại pháo,
        // ví dụ pháo "Nổ lách tách" vẫn lách tách dù builder lưu sẵn crackle: false.
        if (!hasValue(value) || value === false) return;

        if (prop === 'strobeColor' || prop === 'pistilColor' || prop === 'secondColor') {
            options[prop] = resolveSingleColor(value);
        } else if (prop === 'starDensity') {
            // Mật độ là hệ số so với mật độ gốc của loại pháo (1 = giữ nguyên)
            options.starDensity = (options.starDensity || 1) * value;
        } else {
            options[prop] = value;
        }
    });

    // Bật "Cháy lâu" cho loại pháo khác mà không tự đặt tuổi thọ hạt: cho hạt cháy lâu gấp 2,5 lần
    if (event.hang === true && event.shell !== 'Cháy lâu' && !hasValue(event.starLife)) {
        options.starLife *= 2.5;
    }

    return { options, x, y };
}

export function launchEventShot(shot) {
    const shell = new Shell(shot.options);
    // Nổ đúng tọa độ đã đặt trong kịch bản
    shell.launchAt(shot.x * stageW, shot.y * stageH);
}

// Thời gian bay (ms) từ lúc phóng tới lúc nổ: chạy thử đúng vật lý sao chổi của launchAt() ở 60 khung hình/giây.
// Pháo bay lên tới độ cao điểm nổ (hoặc lên tới đỉnh, hoặc hết thời gian cháy) thì nổ.
export function estimateFlightTime(shot) {
    const { options } = shot;
    const rise = (horizonSelector() - shot.y) * stageH;
    const angle = options.launchAngle !== undefined ? (options.launchAngle - 90) * Math.PI / 180 : 0;
    const burstX = Math.sin(angle) * rise;
    const step = 1000 / 60;
    const gAcc = step / 1000 * GRAVITY;
    let x = 0;
    let y = 0;
    let speedX = 0;
    let speedY = 0;
    let life;
    let targetY;
    // Cùng công thức vận tốc với launchAt() và aimStar()
    const aim = (toX, toY, scale = 1) => {
        const velocity = Math.pow(Math.hypot(toX - x, toY - y) * 0.04, 0.64);
        const direction = Math.atan2(toY - y, toX - x);
        speedX = Math.cos(direction) * velocity * scale;
        speedY = Math.sin(direction) * velocity * scale;
        return velocity;
    };
    // "Bay nhiều tầng": tới từng tầng thì chậm dần, nổ một chùm rồi mới nhắm điểm nổ chính (xem LAUNCH_STYLES.stages)
    const stops = options.launchStyle === 'stages'
        ? (rise > 260 ? [0.42, 0.72] : [0.6]).map(f => ({ x: burstX * f, y: -rise * f }))
        : [];
    if (stops.length) {
        life = 30000;
        aim(stops[0].x, stops[0].y);
    } else {
        const velocity = aim(burstX, -rise, options.horsetail ? 1.2 : 1);
        life = velocity * (options.horsetail ? 100 : 400);
        targetY = -rise;
    }
    let next = 0;
    for (let time = 0; time < 30000; time += step) {
        life -= step;
        if (targetY !== undefined && (y <= targetY || speedY >= 0)) life = 0;
        if (life <= 0) return time;
        x += speedX;
        y += speedY;
        speedX *= Star.airDragHeavy;
        speedY = speedY * Star.airDragHeavy + gAcc;
        if (next < stops.length && (y <= stops[next].y || speedY > -0.15)) {
            next++;
            if (next < stops.length) {
                aim(stops[next].x, stops[next].y);
            } else {
                aim(burstX, -rise);
                targetY = -rise;
            }
        }
    }
    return 30000;
}

// ---------------------------------------------------------------------------
// KHỚP NHỊP NHẠC (music.sync, builder bật khi "Xếp pháo theo nhịp nhạc"): "trễ" của một phát là lúc pháo NỔ
// (tính từ đầu đợt), không phải lúc phóng. Cả kịch bản được xếp lịch trước: mỗi phát phóng sớm hơn đúng bằng
// thời gian bay của nó trên màn hình này, và đồng hồ bám theo vị trí đang phát của bài nhạc, nên tiếng nổ rơi
// đúng nhịp kể cả khi máy giật khung hình. Đồng hồ = 0 là lúc nhạc bắt đầu (từ giây music.start).
// ---------------------------------------------------------------------------

export function isMusicSynced(config) {
    return !!(config && config.music && config.music.sync && Array.isArray(config.events));
}

// Thời điểm (ms) mỗi phát nổ hoặc hiện ra và lúc kết thúc; thời lượng đợt tính giống startSequence()
export function buildSyncTimeline(events) {
    const burstValues = events.map(e => Number(e.burst)).filter(v => !isNaN(v));
    const maxBurst = burstValues.length > 0 ? Math.max(...burstValues) : 0;
    const items = [];
    let start = 0;
    for (let burst = 1; burst <= maxBurst; burst++) {
        const list = events.filter(e => Number(e.burst) === burst);
        let pause = 0;
        list.forEach(event => {
            if (event.shell === 'Tạm dừng') pause = Math.max(pause, event.duration || 2000);
            else items.push({ time: start + (Number(event.delay) || 0), event });
        });
        start += (list.length > 0 ? 2500 + pause : 1000) * 1.25;
    }
    return { items, end: start };
}
