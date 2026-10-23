/*!
 * Hanabi – mẫu màn trình diễn theo dịp
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Chọn dịp + tên người nhận/người gửi -> kịch bản hoàn chỉnh để chỉnh tiếp trong builder.
// Các dịp chỉ khác nội dung (lời chúc, chữ trên trời, hình, bảng màu); bố cục các đợt bắn dùng chung trong buildShow().
// theme: giao diện màn mở quà và màn kết (SCREEN_THEMES trong player/screen-themes.js); frame: khung bắt đầu (START_FRAMES
// trong player/start-frames.js); season, weather: mùa, thời tiết của cảnh (player/seasons.js).
// Thêm dịp mới: thêm một mục vào OCCASIONS.
export const OCCASIONS = [
    {
        id: 'sinh_nhat', name: 'Sinh nhật', icon: '🎂', who: 'bạn',
        theme: 'birthday',
        frame: 'cake',
        palette: ['Gold', 'Red', 'Purple'],
        shapes: ['Trái tim', 'Ngôi sao'],
        texts: ['HAPPY BIRTHDAY', 'TUỔI MỚI RỰC RỠ'],
        title: 'CHÚC MỪNG SINH NHẬT',
        subtitle: r => `Chúc ${r} tuổi mới thật nhiều niềm vui, sức khỏe và hạnh phúc!`,
        intro: r => `Hôm nay là ngày đặc biệt của ${r}. Bật loa lên và mở quà nhé!`,
        outro: 'Chúc mừng sinh nhật! Mong tuổi mới mang đến thật nhiều điều tuyệt vời.',
        seoTitle: r => `🎂 Món quà sinh nhật dành tặng ${r}`
    },
    {
        id: 'tot_nghiep', name: 'Tốt nghiệp', icon: '🎓', who: 'bạn',
        theme: 'graduation',
        frame: 'cap',
        palette: ['Gold', 'Blue', 'White'],
        shapes: ['Ngôi sao', 'Kim cương'],
        texts: ['CONGRATULATIONS', 'TƯƠNG LAI RỰC RỠ'],
        title: 'CHÚC MỪNG TỐT NGHIỆP',
        subtitle: r => `Chúc mừng ${r} đã hoàn thành chặng đường đầy nỗ lực. Tương lai rực rỡ đang chờ phía trước!`,
        intro: r => `Một chặng đường đáng tự hào đã khép lại. Mở quà mừng ${r} tốt nghiệp nhé!`,
        outro: 'Chúc bạn vững bước trên hành trình mới và gặt hái thật nhiều thành công!',
        seoTitle: r => `🎓 Chúc mừng ${r} tốt nghiệp`
    },
    {
        id: 'dam_cuoi', name: 'Đám cưới', icon: '💍', who: 'hai bạn',
        theme: 'wedding',
        frame: 'invite',
        palette: ['Red', 'Gold', '#ff6ad5'],
        shapes: ['Trái tim', 'Kim cương'],
        texts: ['HAPPY WEDDING', 'TRĂM NĂM HẠNH PHÚC'],
        title: 'CHÚC MỪNG HẠNH PHÚC',
        subtitle: r => `Chúc ${r} trăm năm hạnh phúc, mãi yêu thương và thấu hiểu nhau!`,
        intro: r => `Ngày vui của ${r} không thể thiếu pháo hoa. Mở quà nhé!`,
        outro: 'Chúc hai bạn mãi bên nhau, cùng nhau đi hết chặng đường dài phía trước.',
        seoTitle: r => `💍 Mừng ngày cưới của ${r}`
    },
    {
        id: 'tinh_yeu', name: 'Tình yêu, kỷ niệm', icon: '💖', who: 'người thương',
        theme: 'love',
        frame: 'letter',
        palette: ['Red', '#ff6ad5', 'Purple'],
        shapes: ['Trái tim', 'Bông sen'],
        texts: ['I LOVE YOU', 'MÃI BÊN NHAU'],
        title: 'GỬI NGƯỜI THƯƠNG',
        subtitle: r => `Gửi ${r}, người khiến mỗi ngày đều rực rỡ như pháo hoa.`,
        intro: r => `Có một điều muốn nói với ${r}... Bấm để mở nhé!`,
        outro: 'Cảm ơn vì đã luôn ở bên. Thương thật nhiều!',
        seoTitle: r => `💖 Gửi ${r} cả một bầu trời pháo hoa`
    },
    {
        id: 'phu_nu_8_3', name: 'Quốc tế Phụ nữ 8/3', icon: '🌷', who: 'bạn',
        theme: 'women',
        frame: 'flower',
        palette: ['Purple', '#ff6ad5', 'Gold'],
        shapes: ['Bông sen', 'Trái tim'],
        texts: ["HAPPY WOMEN'S DAY", 'LUÔN XINH ĐẸP'],
        title: 'CHÚC MỪNG NGÀY QUỐC TẾ PHỤ NỮ 8/3',
        subtitle: r => `Chúc ${r} luôn xinh đẹp, hạnh phúc và được yêu thương mỗi ngày!`,
        intro: r => `Ngày 8/3 này, có một món quà nhỏ dành riêng cho ${r}. Mở ra xem nhé!`,
        outro: 'Chúc bạn một ngày 8/3 thật ngọt ngào và ý nghĩa!',
        seoTitle: r => `🌷 Quà 8/3 dành tặng ${r}`
    },
    {
        id: 'phu_nu_20_10', name: 'Phụ nữ Việt Nam 20/10', icon: '💐', who: 'bạn',
        theme: 'women',
        frame: 'flower',
        palette: ['#ff6ad5', 'Gold', 'Purple'],
        shapes: ['Bông sen', 'Trái tim'],
        texts: ['CHÚC MỪNG 20/10', 'LUÔN RẠNG RỠ'],
        title: 'CHÚC MỪNG NGÀY PHỤ NỮ VIỆT NAM 20/10',
        subtitle: r => `Chúc ${r} luôn rạng rỡ, hạnh phúc và tràn đầy năng lượng!`,
        intro: r => `Nhân ngày Phụ nữ Việt Nam 20/10, có một món quà nhỏ dành cho ${r}. Mở ra xem nhé!`,
        outro: 'Cảm ơn vì đã luôn dịu dàng và mạnh mẽ. Chúc bạn một ngày 20/10 thật vui!',
        seoTitle: r => `💐 Quà 20/10 dành tặng ${r}`
    },
    {
        id: 'nha_giao_20_11', name: 'Nhà giáo 20/11', icon: '📚', who: 'thầy cô',
        theme: 'teacher',
        frame: 'book',
        palette: ['Gold', 'Red', 'White'],
        shapes: ['Ngôi sao', 'Bông sen'],
        texts: ["HAPPY TEACHER'S DAY", 'TRI ÂN THẦY CÔ'],
        title: 'TRI ÂN NGÀY NHÀ GIÁO VIỆT NAM 20/11',
        subtitle: r => `Kính chúc ${r} luôn mạnh khỏe, hạnh phúc và tràn đầy nhiệt huyết!`,
        intro: r => `Nhân ngày Nhà giáo Việt Nam 20/11, xin gửi tới ${r} một món quà nhỏ thay lời tri ân.`,
        outro: 'Cảm ơn những bài học và sự tận tâm. Kính chúc thầy cô luôn mạnh khỏe, hạnh phúc!',
        seoTitle: r => `📚 Tri ân ${r} nhân ngày 20/11`
    },
    {
        id: 'nam_moi', name: 'Năm mới, Tết', icon: '🧧', who: 'bạn',
        theme: 'tet',
        frame: 'lixi',
        // Mùa xuân: cánh hoa đào bay
        season: 'spring',
        palette: ['Red', 'Gold', 'Green'],
        shapes: ['Ngôi sao', 'Kim cương'],
        texts: ['HAPPY NEW YEAR', 'AN KHANG THỊNH VƯỢNG'],
        title: 'CHÚC MỪNG NĂM MỚI',
        subtitle: r => `Chúc ${r} năm mới an khang thịnh vượng, vạn sự như ý!`,
        intro: r => `Năm mới đã đến! Có cả một bầu trời pháo hoa dành cho ${r}.`,
        outro: 'Chúc mừng năm mới! Chúc một năm thật nhiều may mắn, sức khỏe và niềm vui.',
        seoTitle: r => `🧧 Chúc ${r} năm mới an khang`
    },
    {
        id: 'giang_sinh', name: 'Giáng sinh', icon: '🎄', who: 'bạn',
        theme: 'noel',
        frame: 'tree',
        // Mùa đông, tuyết rơi
        season: 'winter',
        weather: 'snow',
        palette: ['Red', 'Green', 'White'],
        shapes: ['Bông tuyết', 'Ngôi sao'],
        texts: ['MERRY CHRISTMAS', 'GIÁNG SINH AN LÀNH'],
        title: 'GIÁNG SINH AN LÀNH',
        subtitle: r => `Chúc ${r} một mùa Giáng sinh ấm áp và an lành!`,
        intro: r => `Ông già Noel gửi tới ${r} một món quà nhỏ. Mở ra xem nhé!`,
        outro: 'Merry Christmas! Chúc mùa lễ hội thật ấm áp bên những người thân yêu.',
        seoTitle: r => `🎄 Quà Giáng sinh dành tặng ${r}`
    },
    {
        id: 'trung_thu', name: 'Trung thu', icon: '🏮', who: 'bạn',
        theme: 'midautumn',
        frame: 'lantern',
        season: 'autumn',
        palette: ['Gold', 'Red', '#ff9a3c'],
        shapes: ['Ngôi sao', 'Bông sen'],
        texts: ['TRUNG THU VUI VẺ', 'TRĂNG RẰM SUM VẦY'],
        title: 'TRUNG THU VUI VẺ',
        subtitle: r => `Chúc ${r} một mùa trăng rằm thật đầm ấm, sum vầy bên những người thân yêu!`,
        intro: r => `Trăng sáng, đèn lồng đã thắp. Có một món quà nhỏ dành cho ${r}!`,
        outro: 'Trung thu vui vẻ! Chúc mọi điều tròn đầy như vầng trăng rằm.',
        seoTitle: r => `🏮 Quà Trung thu dành tặng ${r}`
    }
];

// Bố cục chung (~45 giây): mở màn → lời chào → hình → nổ dọc đường → tên người nhận → bánh xe xoay
// → hình bay nhiều tầng → lời chúc → thiên hà xoắn ốc → cao trào → kết bằng pháo cháy lâu.
// Mọi vị trí đã thử trên máy tính, máy tính bảng và điện thoại (trình phát tự co vùng bắn trên điện thoại).
function buildShow(o, recipient, who) {
    const [c1, c2, c3] = o.palette;
    const events = [];
    let burst = 0;
    const shot = (e) => events.push({ burst, x: 50, y: 60, size: 1, delay: 0, color: c1, ...e });
    const pause = (duration) => events.push({ burst, shell: 'Tạm dừng', duration });
    // Chữ trên trời: to hơn và cháy lâu cho kịp đọc
    const text = (value, color) => shot({ shell: 'Văn bản', text: value, y: 64, size: 1.3, color, hang: true });
    // Hai phát thấp nổ sớm, lấp khoảng tối trong lúc pháo chính còn đang bay lên
    const fillers = (shell, colors) => {
        shot({ shell, x: 15, y: 36, size: 0.7, color: colors[0] });
        shot({ shell, x: 85, y: 36, size: 0.7, color: colors[1], delay: 200 });
    };

    // 1. Mở màn: hai cây liễu vàng hai bên, giữa bay xoắn đôi lên nổ hoa cúc lớn
    burst++;
    shot({ shell: 'Liễu', x: 22, y: 58, color: 'Gold' });
    shot({ shell: 'Liễu', x: 78, y: 58, color: 'Gold', delay: 250 });
    shot({ shell: 'Hoa cúc', y: 72, size: 1.5, color: [c1, c2], launchStyle: 'spiral', pistil: true, pistilColor: 'White', delay: 700 });

    // 2. Lời chào trên trời, hai bên nhấp nháy
    burst++;
    text(o.texts[0], c1);
    shot({ shell: 'Nhấp nháy', x: 15, y: 42, size: 0.8, color: c2, delay: 900 });
    shot({ shell: 'Nhấp nháy', x: 85, y: 42, size: 0.8, color: c3, delay: 1100 });

    // 3. Hình thứ nhất lơ lửng, hai vòng nhẫn
    burst++;
    shot({ shell: o.shapes[0], y: 62, color: c2, hang: true });
    shot({ shell: 'Vòng nhẫn', x: 20, y: 48, color: c1, delay: 500 });
    shot({ shell: 'Vòng nhẫn', x: 80, y: 48, color: c3, delay: 700 });

    // 4. Ba phát vừa bay vừa nổ lụp bụp
    burst++;
    [[25, 55, c1], [50, 70, c2], [75, 55, c3]].forEach(([x, y, color], i) => {
        shot({ shell: 'Hoa cúc', x, y, color, launchStyle: 'popping', delay: i * 400 });
    });

    // 5. Tên người nhận, giữ lâu cho kịp đọc
    if (recipient) {
        burst++;
        text(recipient.toLocaleUpperCase('vi'), 'Gold');
        fillers('Nhấp nháy', [c2, c3]);
        pause(1500);
    }

    // 6. Bánh xe lửa xoay giữa trời, lách tách hai bên
    burst++;
    shot({ shell: 'Xoay vòng', y: 62, size: 1.5, color: [c1, c2] });
    shot({ shell: 'Nổ lách tách', x: 20, y: 45, color: 'Gold', delay: 600 });
    shot({ shell: 'Nổ lách tách', x: 80, y: 45, color: 'Gold', delay: 800 });

    // 7. Hình thứ hai bay nhiều tầng, cây cọ hai bên nổ cùng lúc với hình
    burst++;
    shot({ shell: o.shapes[1], y: 66, color: c3, launchStyle: 'stages', hang: true });
    fillers('Hoa cúc', [c1, c2]);
    shot({ shell: 'Cây cọ', x: 22, y: 50, color: c1, delay: 2800 });
    shot({ shell: 'Cây cọ', x: 78, y: 50, color: c2, delay: 3000 });
    pause(2000);

    // 8. Lời chúc trên trời, kèm lời nhắn gõ từng chữ phía dưới
    burst++;
    text(o.texts[1], c2);
    events.push({ burst, shell: 'Lời nhắn', text: o.subtitle(who), delay: 1200, duration: 6000, effect: 'type', color: 'White' });
    pause(1000);

    // 9. Thiên hà xoắn ốc giữa, hai phát bay lượn hai bên
    burst++;
    shot({ shell: 'Xoắn ốc', y: 66, size: 1.5, color: c1 });
    shot({ shell: 'Hoa cúc', x: 22, y: 52, color: c2, launchStyle: 'wander', delay: 500 });
    shot({ shell: 'Hoa cúc', x: 78, y: 52, color: c3, launchStyle: 'wander', delay: 700 });

    // 10. Cao trào: dồn dập khắp bầu trời
    burst++;
    [[20, 55], [80, 55], [35, 70], [65, 70], [50, 60], [15, 40], [85, 40], [50, 78]].forEach(([x, y], i) => {
        shot({
            shell: i % 3 === 2 ? 'Nổ nhiều lần' : 'Hoa cúc', x, y, size: 1.2,
            color: o.palette[i % o.palette.length], streamers: i % 2 === 0, delay: i * 220
        });
    });
    pause(1000);

    // 11. Kết: ba phát cháy lâu vàng lơ lửng rồi lấp lánh tắt dần
    burst++;
    fillers('Nhấp nháy', ['Gold', 'Gold']);
    [[30, 62], [50, 72], [70, 62]].forEach(([x, y], i) => {
        shot({ shell: 'Cháy lâu', x, y, size: 1.3, color: 'Gold', delay: i * 300 });
    });
    pause(3000);

    return events;
}

// Kịch bản hoàn chỉnh cho một dịp
export function buildTemplate(occasionId, { recipient = '', sender = '' } = {}) {
    const o = OCCASIONS.find(item => item.id === occasionId) || OCCASIONS[0];
    const name = recipient.trim();
    const from = sender.trim();
    const who = name || o.who;
    return {
        title: o.title,
        subtitle: o.subtitle(who),
        author: from ? `Từ: ${from}` : '',
        recipient: name || undefined,
        // Món quà mở bằng hộp quà rung rinh, nổ ruy băng; màn mở quà, màn kết theo giao diện của dịp
        startFrame: o.frame || 'gift',
        screenTheme: o.theme ? { preset: o.theme } : undefined,
        season: o.season,
        weather: o.weather,
        introMessage: o.intro(who),
        outroMessage: o.outro,
        seoTitle: o.seoTitle(who),
        loop: false,
        showBackground: false,
        events: buildShow(o, name, who)
    };
}
