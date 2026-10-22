/*!
 * Trình diễn Pháo hoa – trình phát: hạt và tia lửa
 * Phần bổ sung và chỉnh sửa © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Hạt pháo (Star), tia lửa (Spark) và quầng chớp lúc nổ (BurstFlash): các bể đối tượng dùng lại, gom theo màu để vẽ nhanh.

import { reduceFlashing } from './state.js';
import { COLOR_CODES_W_INVIS, randomColor } from './colors.js';
import { PI_2 } from './env.js';

export const BurstFlash = {
    active: [],
    _pool: [],

    _new() {
        return {}
    },

    add(x, y, radius) {
        // Giảm chớp sáng: không vẽ quầng chớp lúc nổ
        if (reduceFlashing()) return;
        const instance = this._pool.pop() || this._new();

        instance.x = x;
        instance.y = y;
        instance.radius = radius;

        this.active.push(instance);
        return instance;
    },

    returnInstance(instance) {
        this._pool.push(instance);
    }
};



// Trình trợ giúp tạo các đối tượng để lưu trữ các hạt hoạt động.
// Các hạt được lưu trữ trong các mảng được khóa theo màu (mã chứ không phải tên) để cải thiện hiệu suất hiển thị.
function createParticleCollection() {
    const collection = {};
    COLOR_CODES_W_INVIS.forEach(color => {
        collection[color] = [];
    });
    return collection;
}


// Thuộc tính sao (WIP)
// --------------
// transitionTime - quá trình chuyển đổi ngôi sao diễn ra gần đến cuối cuộc đời như thế nào

export const Star = {
    // Thuộc tính hình ảnh
    drawWidth: 3,
    airDrag: 0.98,
    airDragHeavy: 0.992,

    // Các hạt sao sẽ được khóa theo màu sắc
    active: createParticleCollection(),
    _pool: [],

    _new() {
        return {};
    },

    add(x, y, color, angle, speed, life, speedOffX, speedOffY) {
        const instance = this._pool.pop() || this._new();

        let finalColor;
        if (Array.isArray(color)) {
            finalColor = color[Math.floor(Math.random() * color.length)];
        } else {
            finalColor = (color && color !== 'random') ? color : randomColor();
        }

        instance.visible = true;
        instance.heavy = false;
        // Quả pháo đang bay lên để lại vệt khói (khi kịch bản bật khói pháo)
        instance.smokeTrail = false;
        instance.smokeTimer = 0;
        instance.targetY = undefined;
        instance.x = x;
        instance.y = y;
        instance.prevX = x;
        instance.prevY = y;
        instance.color = finalColor;
        instance.speedX = Math.cos(angle) * speed + (speedOffX || 0);
        instance.speedY = Math.sin(angle) * speed + (speedOffY || 0);
        instance.life = life;
        instance.fullLife = life;
        // Mức tàn (render-loop.js: STAR_FADE), 0 là đang cháy sáng
        instance.fade = 0;
        instance.spinAngle = Math.random() * PI_2;
        instance.spinSpeed = 0.8;
        instance.spinRadius = 0;
        instance.sparkFreq = 0; // ms giữa lượng phát ra tia lửa
        instance.sparkSpeed = 1;
        instance.sparkTimer = 0;
        instance.sparkColor = finalColor;
        instance.sparkLife = 750;
        instance.sparkLifeVariation = 0.25;
        instance.strobe = false;
        instance.twinkle = false;
        // Hệ số trọng lực: < 1 thì hạt lơ lửng, rơi chậm (pháo "Cháy lâu")
        instance.gravityScale = 1;
        // Hành vi riêng mỗi khung hình (kiểu bắn) và độ lệch ngang khỏi đường bay vật lý
        instance.onUpdate = null;
        instance.lateralOffset = 0;
        // Quay quanh tâm vụ nổ (pháo "Xoay vòng", "Xoắn ốc")
        instance.orbit = null;

        if (!this.active[finalColor]) {
            this.active[finalColor] = [];
        }
        this.active[finalColor].push(instance);
        return instance;
    },

    // Phương thức công khai để dọn dẹp và trả lại một phiên bản trở lại nhóm.
    returnInstance(instance) {
        // Gọi trình xử lý onDeath nếu có (và truyền cho nó phiên bản sao hiện tại)
        instance.onDeath && instance.onDeath(instance);
        // Dọn dẹp
        instance.onDeath = null;
        instance.secondColor = null;
        instance.transitionTime = 0;
        instance.colorChanged = false;
        instance.targetY = undefined;
        // Thêm trở lại hồ bơi.
        this._pool.push(instance);
    }
};


export const Spark = {
    // Thuộc tính hình ảnh
    drawWidth: 0, // được đặt trong `configDidUpdate()`
    airDrag: 0.9,

    // Các hạt sao sẽ được khóa theo màu sắc
    active: createParticleCollection(),
    _pool: [],

    // Số tia lửa đang bay và ngân sách theo mức chất lượng (Cao: không giới hạn). Lúc pháo dày đặc nhất có thể hơn
    // 20.000 tia: vượt ngân sách thì tia mới thưa dần theo tỉ lệ, không cắt đột ngột.
    count: 0,
    budget: Infinity,

    _new() {
        return {};
    },

    add(x, y, color, angle, speed, life) {
        if (this.count > this.budget && Math.random() > Math.pow(this.budget / this.count, 3)) return null;
        this.count++;
        const instance = this._pool.pop() || this._new();

        instance.x = x;
        instance.y = y;
        instance.prevX = x;
        instance.prevY = y;
        instance.color = color;
        instance.speedX = Math.cos(angle) * speed;
        instance.speedY = Math.sin(angle) * speed;
        instance.life = life;
        instance.fullLife = life;
        instance.fade = 0;

        if (!this.active[color]) {
            this.active[color] = [];
        }
        this.active[color].push(instance);
        return instance;
    },

    // Phương thức công khai để dọn dẹp và trả lại một phiên bản trở lại nhóm.
    returnInstance(instance) {
        this.count--;
        // Thêm trở lại hồ bơi.
        this._pool.push(instance);
    }
};
