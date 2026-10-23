/*!
 * Trình diễn Pháo hoa – trình phát: người ngắm pháo bên bờ
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Người ngắm pháo (kịch bản lưu `people`, chỉ khi có mặt nước), dùng chung cho trình phát (scenery/people/ vẽ) và
// builder (ô chọn). Họ đứng ở bờ bên này, quay lưng về phía người xem.
export const PEOPLE_OPTIONS = [
    { value: '', name: 'Không', icon: '', hint: '' },
    { value: 'man', name: 'Nam', icon: '🧍‍♂️', hint: 'Một chàng trai một mình thong thả đi ra giữa bờ, tay đút túi, ngước nhìn pháo hoa rồi cúi đầu, thở dài, ngoái sang bên cạnh trống trải. Trời mưa thì che ô, tuyết rơi thì đội mũ len.' },
    { value: 'woman', name: 'Nữ', icon: '🧍‍♀️', hint: 'Một cô gái tóc dài một mình đi ra giữa bờ, tay ôm lấy mình, ngước nhìn pháo hoa rồi cúi đầu, vén tóc, ngoái sang bên cạnh trống trải. Trời mưa thì che ô, tuyết rơi thì đội mũ len.' },
    { value: 'couple', name: 'Cả hai', icon: '👫', hint: 'Chàng trai, cô gái từ hai phía đi lại gặp nhau ở giữa, nắm tay, tựa vai, ôm nhau ngước nhìn pháo hoa. Trời mưa thì cô gái gập ô, chàng trai che ô cho cô; tuyết rơi thì cả hai đội mũ len.' }
];

export const validPeople = value => (PEOPLE_OPTIONS.some(option => option.value && option.value === value) ? value : '');
