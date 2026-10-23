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
    { value: 'couple', name: 'Nam và nữ', icon: '👫', hint: 'Chàng trai, cô gái từ hai phía đi lại gặp nhau ở giữa, nắm tay, tựa vai, ôm nhau ngước nhìn pháo hoa. Trời mưa thì cô gái gập ô, chàng trai che ô cho cô; tuyết rơi thì cả hai đội mũ len.' }
];

export const validPeople = value => (PEOPLE_OPTIONS.some(option => option.value && option.value === value) ? value : '');

// Chỗ bắt đầu của từng người (kịch bản `peopleStart`: { m: chàng trai, f: cô gái }), phần trăm bề ngang khung theo bước
// 5: 0, 100 là đi vào từ ngoài mép trái, mép phải; 50 là đứng đợi sẵn ở giữa từ đầu; chỗ khác thì đứng ở đó ngắm pháo
// rồi đi ra giữa. Bờ bên kia: 0, 100 là hai đầu cầu (hoặc cách giữa bờ ít bước). Hai người cùng một phía thì đi cùng nhau.
export const PEOPLE_START = { m: 0, f: 100 };
export const PEOPLE_MIDDLE = 50;
// Số hoặc chuỗi số (kịch bản sửa tay), không nhận true, null, chuỗi rỗng
const numberOf = v => ((typeof v === 'number' || (typeof v === 'string' && v.trim())) && Number.isFinite(Number(v)) ? Number(v) : null);
export const validPeopleStart = value => {
    const out = { ...PEOPLE_START };
    if (value && typeof value === 'object') {
        ['m', 'f'].forEach(key => {
            const n = numberOf(value[key]);
            if (n !== null) out[key] = Math.round(Math.max(0, Math.min(100, n)) / 5) * 5;
        });
    }
    return out;
};

// Ai đến trước (`peopleFirst`: '' cùng đến, 'm', 'f') và người đến trước đứng đợi bao lâu (`peopleWait`, giây). Có
// người đứng đợi sẵn ở giữa thì người đó là người đợi
export const PEOPLE_WAIT = 8;
export const PEOPLE_WAIT_MIN = 2;
export const PEOPLE_WAIT_MAX = 60;
export const validPeopleFirst = value => (value === 'm' || value === 'f' ? value : '');
export const validPeopleWait = value => {
    const n = numberOf(value);
    return n !== null ? Math.round(Math.max(PEOPLE_WAIT_MIN, Math.min(PEOPLE_WAIT_MAX, n))) : PEOPLE_WAIT;
};

// Cách đi vào của kịch bản cho trình phát: chỗ bắt đầu, ai đến trước (người đứng sẵn ở giữa tính là đến trước), đợi bao lâu
export function peoplePlan(config = {}) {
    const start = validPeopleStart(config.peopleStart);
    const standM = start.m === PEOPLE_MIDDLE;
    const standF = start.f === PEOPLE_MIDDLE;
    const first = standM !== standF ? (standM ? 'm' : 'f') : validPeopleFirst(config.peopleFirst);
    return { start, first, wait: validPeopleWait(config.peopleWait) };
}
