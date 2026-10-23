/*!
 * Hanabi – trình phát: cảnh vật (vật bay trên trời)
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Vật bay trên trời theo kịch bản (decor: 'lanterns' đèn trời, 'balloons' khinh khí cầu, 'planes' máy bay). Mỗi loại một
// module cùng một cách gắn vào bầu trời (decor.js):
//   populate(env) -> các vật có sẵn lúc dựng cảnh;
//   update(item, dt, env) -> false khi vật đã đi khỏi (thay bằng respawn(item, env));
//   draw(ctx, item, view) vẽ (lớp đã nhân độ nét: tọa độ điểm ảnh CSS).
// env: { width, ground (chân trời), wind (px/ms, dấu là hướng gió), light (ánh trăng 0-1) }; view: env thêm k, calm
// (giảm chớp sáng), flash (pháo đang rọi sáng trời 0-1), time (ms). Mỗi vật có z (0 xa - 1 gần) để vẽ xa trước gần sau.
// Thêm loại mới: một module như trên, đưa vào SKY_LIFE.

import { Lanterns } from './lanterns.js';
import { Balloons } from './balloons.js';
import { Planes } from './planes.js';

export const SKY_LIFE = { lanterns: Lanterns, balloons: Balloons, planes: Planes };
