/*!
 * Trình diễn Pháo hoa – trình phát (chất lượng)
 * Phần bổ sung và chỉnh sửa © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Độ phân giải vẽ theo mức chất lượng, vẽ dư, tự hạ, tự nâng khi máy không kịp.

import { now } from '../clock.js';
import { IS_HIGH_END_DEVICE, IS_MOBILE, IS_PREVIEW, IS_RECORD } from '../env.js';
import { isLowQuality } from '../state.js';
import { QUALITY_AUTO, QUALITY_LEVELS } from '../quality.js';
import { Spark } from '../particles.js';
import { appNodes, configDidUpdate, frameH, frameW, handleResize, mainStage, qualityLevelSelector, stages, store, waterLowQuality } from '../../script.js';

// Chất lượng "Tự động" (các mức: player/quality.js): máy mạnh bắt đầu ở độ phân giải gốc của màn hình, ít nhất 1080p
// cho đủ hiệu ứng; máy yếu bắt đầu ở 720p HD. Điện thoại bắt đầu tối đa ở 1080p: màn nhỏ mật độ điểm ảnh rất cao (vd
// 1170 điểm ảnh cạnh ngắn) mắt gần như không phân biệt được với 1080p mà nhẹ máy hơn nhiều. autoTuner hạ/nâng khi đang
// xem, không xuống dưới 360p. Tính lại khi cửa sổ đổi cỡ hoặc sang màn hình khác (refreshAutoStart).
function startLevel() {
    if (!IS_HIGH_END_DEVICE) return '720';
    if (IS_MOBILE) return '1080';
    const native = Math.min(window.innerWidth, window.innerHeight) * (window.devicePixelRatio || 1);
    const fits = QUALITY_LEVELS.filter(level => Number(level.value) >= Math.max(native, 1080));
    return (fits[fits.length - 1] || QUALITY_LEVELS[0]).value;
}

export let AUTO_QUALITY_START = startLevel();

const AUTO_QUALITY_FLOOR = '360';

export let autoQuality = AUTO_QUALITY_START;

const levelIndex = value => QUALITY_LEVELS.findIndex(level => level.value === value);

// Mở trên màn laptop rồi kéo cửa sổ sang màn 2K/4K (hoặc ngược lại): mức ban đầu theo màn hình mới. Chưa phải hạ vì giật
// thì dùng luôn mức mới; đã hạ thì giữ mức đang dùng (không vượt mức ban đầu mới), autoTuner nâng dần nếu mượt
function refreshAutoStart() {
    const start = startLevel();
    if (start === AUTO_QUALITY_START) return;
    AUTO_QUALITY_START = start;
    if (!autoTuner.drops || levelIndex(autoQuality) < levelIndex(start)) autoQuality = start;
    renderQualityLabel();
}

// Chất lượng khi xem (Tự động hoặc 144p ... 4320p, xem player/quality.js): giới hạn tia lửa của mức, và vẽ khung pháo
// đúng số điểm ảnh của mức ở cạnh ngắn (720p: 720).
export function applyQualityLimits() {
    // Khung quay video giữ đúng độ phân giải video
    if (!IS_RECORD) refreshAutoStart();
    const level = qualityLevelSelector();
    Spark.budget = level.sparks;
    if (IS_RECORD) return;
    const shortSide = Math.min(frameW || window.innerWidth, frameH || window.innerHeight);
    const native = window.devicePixelRatio || 1;
    const max = maxRenderScale();
    let dpr = Math.min(max, Number(level.value) / shortSide);
    // Sát độ phân giải gốc (vd điện thoại 412px × 2,625 ở mức 1080p ra 2,621): vẽ bằng đúng màn hình. Lệch chút ít thì
    // trình duyệt vẫn phải co giãn cả lớp (nhòe mọi nét) chỉ để bớt vài phần trăm điểm ảnh
    if (dpr < native && dpr > native * 0.95) dpr = native;
    // Vẽ dư chỉ gấp đúng 2 lần màn hình: tỉ lệ lẻ (vd 2160p trong cửa sổ màn 2K ra 1,66 lần, màn 4K ra 1,08 lần) thì trình
    // duyệt co cả lớp lại bằng nội suy, tia pháo, hạt lửa nhòe đi, còn kém hơn vẽ bằng màn hình. Gần gấp đôi thì vẽ gấp đôi
    // (mỗi điểm ảnh màn hình đúng 2×2 điểm ảnh vẽ), không đủ chỗ thì vẽ bằng màn hình
    if (dpr > native) dpr = dpr >= native * 1.5 && max >= native * 2 ? native * 2 : native;
    // Đổi mật độ điểm ảnh, hoặc qua lại mức 480p (mặt nước vẽ thưa/nét): dựng lại các lớp
    if (stages.some(stage => stage.dpr !== dpr) || waterLowQuality !== isLowQuality) {
        stages.forEach(stage => { stage.dpr = dpr; });
        handleResize();
    }
}

// Mức cao hơn độ phân giải màn hình (vd 2160p 4K trên màn 1080p): máy tính mạnh vẽ dư tới gấp đôi mật độ điểm ảnh rồi
// để trình duyệt thu nhỏ, tia pháo, chữ, vật trên nước mịn và rõ hơn (như "resolution scale" trong game). Chỉ khi người
// xem tự chọn hoặc kịch bản đặt sẵn mức đó; "Tự động", điện thoại, máy yếu, bản xem nhanh trong builder thì vẽ bằng độ
// phân giải gốc của màn hình (vẽ dư nặng gấp 4 lần)
function maxRenderScale() {
    const native = window.devicePixelRatio || 1;
    const chosen = store.state.config.quality !== QUALITY_AUTO;
    if (!chosen || !IS_HIGH_END_DEVICE || IS_MOBILE || IS_PREVIEW) return native;
    // Tối đa ~16,6 triệu điểm ảnh mỗi lớp (gấp đôi 4K) để không ngốn hết bộ nhớ đồ họa
    const area = (frameW || window.innerWidth) * (frameH || window.innerHeight);
    return Math.max(native, Math.min(native * superSampler.limit, 4, Math.sqrt(3840 * 2160 * 2 / area)));
}

// Vẽ dư tự lùi: đang vẽ dư mà máy không kịp (khung hình trung bình chậm hơn ~54 khung/giây trong 2 giây có pháo, vd card
// đồ họa tích hợp) thì thôi vẽ dư, vẽ bằng độ phân giải màn hình (không lùi về tỉ lệ lẻ như 1,5 lần: nhòe, xem
// applyQualityLimits). Mức chất lượng đã chọn giữ nguyên; không nâng lại trong lần xem này (chọn lại mức chất lượng thì thử
// lại từ đầu)
export const superSampler = {
    limit: 2,
    last: 0,
    sum: 0,
    count: 0,
    since: 0,
    waitUntil: 0,

    frame(now) {
        const dt = this.last ? now - this.last : 0;
        this.last = now;
        const extra = mainStage.dpr > (window.devicePixelRatio || 1) + 0.01;
        if (this.limit <= 1 || !extra || IS_RECORD || !Spark.count || dt <= 0 || dt > 250 || now < this.waitUntil) {
            this.count = 0;
            this.sum = 0;
            return;
        }
        if (!this.count) this.since = now;
        this.sum += dt;
        this.count++;
        if (now - this.since < 2000) return;
        const avg = this.sum / this.count;
        this.sum = 0;
        this.count = 0;
        if (avg > 18.5) {
            this.limit = 1;
            // Chờ vẽ lại ở độ phân giải mới rồi mới đo tiếp
            this.waitUntil = now + 1500;
            applyQualityLimits();
        }
    },

    reset() {
        this.limit = 2;
        this.count = 0;
        this.sum = 0;
    }
};

// Độ phân giải đang vẽ khung pháo và độ phân giải màn hình (điểm ảnh thật), cho phần giải thích Chất lượng
export function renderResolution() {
    const native = window.devicePixelRatio || 1;
    const size = scale => `${Math.round(frameW * scale)}×${Math.round(frameH * scale)}`;
    return { screen: size(native), drawn: size(mainStage.dpr), extra: mainStage.dpr > native + 0.01 };
}

// "Tự động": bắt đầu theo màn hình và cấu hình máy; lúc đang có pháo mà giật kéo dài (dưới ~26 khung/giây trong 4 giây)
// thì hạ một mức (vd 1080p xuống 720p), mượt lâu (trên ~50 khung/giây) thì nâng lại, không vượt mức ban đầu. Mỗi lần
// hạ, lần nâng sau phải chờ lâu hơn.
export const autoTuner = {
    last: 0,
    sum: 0,
    count: 0,
    since: 0,
    bad: 0,
    good: 0,
    drops: 0,
    cooldownUntil: 0,

    frame(now) {
        const dt = this.last ? now - this.last : 0;
        this.last = now;
        // Chỉ đo khung hình lúc có pháo; bỏ khung sau khi chuyển tab, tạm dừng (khoảng cách lớn bất thường)
        if (store.state.config.quality !== QUALITY_AUTO || IS_RECORD || !Spark.count || dt <= 0 || dt > 250) return;
        if (!this.count) this.since = now;
        this.sum += dt;
        this.count++;
        if (now - this.since < 2000) return;
        const avg = this.sum / this.count;
        this.sum = 0;
        this.count = 0;
        if (now < this.cooldownUntil) return;
        if (avg > 38) {
            this.good = 0;
            const index = levelIndex(autoQuality);
            const floor = levelIndex(AUTO_QUALITY_FLOOR);
            // Giật nặng (dưới ~17 khung/giây) thì hạ ngay, rất nặng (dưới ~11) thì hạ liền hai mức, khỏi bắt người xem chờ
            if ((++this.bad >= 2 || avg > 60) && index < floor) this.change(QUALITY_LEVELS[Math.min(floor, index + (avg > 90 ? 2 : 1))].value, now, true);
        } else if (avg < 20) {
            this.bad = 0;
            const index = levelIndex(autoQuality);
            if (++this.good >= 5 * (1 + this.drops) && index > levelIndex(AUTO_QUALITY_START)) this.change(QUALITY_LEVELS[index - 1].value, now, false);
        } else {
            this.bad = 0;
            this.good = 0;
        }
    },

    change(level, now, drop) {
        autoQuality = level;
        if (drop) this.drops++;
        this.bad = 0;
        this.good = 0;
        this.cooldownUntil = now + (drop ? 2500 : 4000);
        configDidUpdate();
        renderQualityLabel();
    }
};

// Ô chọn chất lượng ghi rõ mức "Tự động" đang dùng
export function renderQualityLabel() {
    const option = appNodes.quality && appNodes.quality.querySelector(`option[value="${QUALITY_AUTO}"]`);
    if (option) option.textContent = `Tự động (${autoQuality}p)`;
}
