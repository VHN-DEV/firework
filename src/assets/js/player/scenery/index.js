/*!
 * Hanabi – trình phát: cảnh vật (mặt nước phản chiếu, bầu trời, thời tiết)
 * Phần bổ sung và chỉnh sửa © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Cảnh vật theo kịch bản:
// - Mặt nước (water.js): đường chân trời (điểm phóng pháo) nâng lên 1/3 hoặc nửa màn hình; phần dưới là mặt nước phản
//   chiếu bầu trời (pháo, khói, trang trí, ảnh nền) lật ngược, gợn sóng, mờ dần theo độ sâu; bờ bên kia (bank.js,
//   bank-life.js, skylines.js), vật trôi, sinh vật (water-life.js).
// - Bầu trời đêm (decor.js): sao lấp lánh, mặt trăng đúng pha (theo ngày xem hoặc tự chọn) trôi chậm theo một cung, mây.
// - Trang trí: đèn trời bay lên chậm, khinh khí cầu trôi ngang, máy bay (chỉ thấy đèn nhấp nháy); đều tự phát sáng
//   (hợp với cách ghép lớp "lighten").
// - Thời tiết (weather.js): mưa, tuyết rơi, lá, cánh hoa rụng theo mùa.
// - Người ngắm pháo (people/): một chàng trai, một cô gái hoặc cả hai đứng ở bờ bên này, lớp riêng phía trên các lớp pháo.
// Mỗi phần vẽ trên lớp canvas riêng; nhiều thứ được vẽ sẵn một lần thành ảnh nhỏ để mỗi khung hình chỉ cần chép ảnh.

export { Water, WATER_RESOLUTION } from './water.js';
export { Decor } from './decor.js';
export { Weather } from './weather.js';
export { People } from './people/index.js';
export { setSceneSoundListener } from './sound-hook.js';
