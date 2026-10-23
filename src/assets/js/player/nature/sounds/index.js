/*!
 * Hanabi – trình phát: âm thanh thiên nhiên (danh mục tiếng)
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Mọi tiếng tổng hợp được, mỗi họ tiếng một module cùng một cách khai báo: { loop: [độ dài từng đoạn lặp (giây)] (tiếng
// nền) , render(s, params, { seconds, variant }) -> Float32Array }. Thêm tiếng mới: khai báo trong một module rồi gộp
// vào SOUNDS, chọn khi nào phát ở ../scene.js.

import { RATE, Synth } from '../dsp.js';
import { WATER_SOUNDS } from './water.js';
import { WIND_SOUNDS } from './wind.js';
import { INSECT_SOUNDS } from './insects.js';
import { FROG_SOUNDS } from './frogs.js';
import { BIRD_SOUNDS } from './birds.js';
import { RAIN_SOUNDS } from './rain.js';

export const SOUNDS = { ...WATER_SOUNDS, ...WIND_SOUNDS, ...INSECT_SOUNDS, ...FROG_SOUNDS, ...BIRD_SOUNDS, ...RAIN_SOUNDS };

// Hạt giống theo tên tiếng, tham số, phần: cùng yêu cầu luôn ra cùng một tiếng (dựng lại giống hệt, kiểm thử được)
function seedOf(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return ((h >>> 0) % 2147483645 + 1) / 2147483647;
}

// Dựng một tiếng: id (tên trong SOUNDS), params, part (tiếng nền: đoạn lặp thứ mấy; tiếng ngắn: giọng thứ mấy)
export function renderSound({ id, params = {}, part = 0, rate = RATE }) {
    const spec = SOUNDS[id];
    if (!spec) throw new Error('Không có tiếng: ' + id);
    const s = new Synth(rate, seedOf(`${id}|${JSON.stringify(params)}|${part}`));
    return spec.render(s, params, spec.loop ? { seconds: spec.loop[part % spec.loop.length] } : { variant: part });
}
