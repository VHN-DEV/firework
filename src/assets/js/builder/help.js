/*!
 * Hanabi – builder (giải thích)
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Giải thích nhanh: nội dung từng mục (HELP_TIPS), nút "?" và khung giải thích.

import { isSyncMode } from './timeline.js';
import { beatDensity } from './beat-ui.js';

const HELP_TIPS = {
    // Cấu hình chung
    title: 'Dòng chữ lớn hiện khi màn trình diễn bắt đầu. Cũng là tiêu đề khi gửi link nếu mục <strong>Chia sẻ & SEO</strong> để trống.',
    subtitle: 'Câu ngắn hiện dưới tiêu đề. Ô <strong>Lời chúc ở màn kết</strong> và mô tả khi chia sẻ để trống thì dùng câu này.',
    author: 'Tên người tặng, hiện dưới tiêu đề và trên màn kết. VD: <em>Từ: Con gái</em>.',
    screenTheme: 'Bộ giao diện cho màn mở quà, màn đếm ngược và màn kết: màu, kiểu chữ tiêu đề, hiệu ứng nền (tuyết rơi, hoa mai đào, '
        + 'trái tim bay...), biểu tượng và kiểu thiệp. Chọn bộ theo dịp rồi mở "Tùy chỉnh giao diện" để đổi riêng từng phần.',
    startFrame: 'Màn hình đầu tiên khi mở link. Trình duyệt chỉ cho phát âm thanh sau một lần chạm nên người xem luôn mở quà trước. '
        + '<strong>Thiệp chào</strong>: lời mời và nút Mở quà. Các kiểu còn lại có một vật thể chính hiện ra trước (hộp quà, bao lì xì, '
        + 'cây thông, bánh sinh nhật, thư tình, thiệp cưới, mũ tốt nghiệp, hoa nở, sách tri ân, đèn lồng), rồi tới lời chúc và nút mở; '
        + 'chạm vật thể hoặc nút thì chạy hiệu ứng mở (nắp bật, thư mở, hoa nở bung...) rồi mới vào pháo hoa. Màu sắc, kiểu chữ theo '
        + '<strong>Giao diện</strong> bên dưới nên kiểu nào cũng hợp với dịp nào, vd giao diện Tết với bao lì xì hay hộp quà.',
    recipient: 'Tên người nhận. Có tên thì link mở bằng "Gửi [tên]" và nút "Mở quà"; để trống thì hiện lời chào chung.',
    introMessage: 'Một hai câu trên thiệp hoặc hộp quà trước khi mở. VD: <em>Bật loa lên và mở quà nhé!</em>',
    outroMessage: 'Lời chúc trên màn kết, hiện khi chạy hết một lượt (chỉ khi tắt <strong>Tự động lặp lại</strong>). Để trống thì dùng Dòng phụ.',
    schedule: 'Trước giờ hẹn, link chỉ hiện đồng hồ đếm ngược. <strong>Khóa tới giờ</strong>: tới giờ người nhận tự mở quà. '
        + '<strong>Bắn đúng giờ</strong>: ai bấm "Tôi đã sẵn sàng" và để trang mở sẽ thấy pháo tự bắn đúng khoảnh khắc, hợp cho giao thừa. '
        + 'Người ở múi giờ khác vẫn mở đúng lúc.',
    seoTitle: 'Tiêu đề in đậm trong khung xem trước khi gửi link qua Messenger, Zalo, Facebook. Để trống thì dùng Tiêu đề.',
    seoDescription: 'Dòng mô tả dưới tiêu đề trong khung xem trước khi gửi link. Để trống thì ghép từ Dòng phụ và Người thực hiện.',
    seoImage: 'Ảnh 1200×630 hiện khi gửi link. <strong>Thiệp tự động</strong>: vẽ từ tiêu đề và màu pháo. '
        + '<strong>Ảnh của bạn</strong>: tải ảnh lên, chọn có chèn chữ và chỗ cắt ảnh. Ảnh được tạo lại mỗi lần bấm Lưu.',
    background: 'Cảnh thành phố về đêm phía dưới bầu trời. Bật lên rồi bấm vào ảnh để thay bằng ảnh của bạn.',
    water: 'Nâng đường chân trời lên 1/3 hoặc nửa màn hình: pháo bắn lên từ mép nước, phía dưới là mặt nước phản chiếu pháo, '
        + 'khói, đèn trời và ảnh nền (ảnh nền đứng trên mép nước). Độ cao 0 của mỗi phát bắn là mặt nước, nên bố cục cũ vẫn giữ nguyên, '
        + 'chỉ thu gọn vào phần trời.',
    decor: '<strong>Đèn trời</strong>: những chiếc đèn lồng giấy chập chờn bay lên chậm. <strong>Khinh khí cầu</strong>: vài khinh khí cầu '
        + 'trôi ngang, thỉnh thoảng bừng sáng khi đốt lửa. <strong>Máy bay</strong>: thỉnh thoảng một chiếc bay ngang trên cao, ban đêm chỉ '
        + 'thấy đèn đỏ, xanh ở hai đầu cánh và đèn chớp. Chỉ để trang trí, không ảnh hưởng tới các phát bắn; bật Giảm chớp sáng thì đèn không chớp.',
    bank: 'Bờ bên kia mặt nước, chỗ pháo bắn lên: <strong>bờ đất</strong> cỏ lau quê, <strong>kè gạch</strong> có đèn đường, '
        + '<strong>kè đá</strong> liễu rủ, <strong>bãi cát</strong> hàng dừa, <strong>phố cổ</strong> đèn lồng, <strong>cầu đá nhiều vòm</strong> (vòm to dần vào giữa), '
        + '<strong>cầu vòm cong</strong> (một cây cầu ở giữa), '
        + '<strong>thành phố</strong> về đêm như Sài Gòn (tháp cao sáng đèn, thuyền neo giăng đèn bên sông), hoặc <strong>biển khơi</strong> không bờ (xa xa có thuyền câu mực, tàu khách). Đèn, nhà, cầu đều in bóng xuống nước, '
        + 'được ánh pháo rọi sáng.',
    people: 'Nhân vật hoạt hình kiểu anime đứng ở bờ bên này, quay lưng ngắm pháo hoa (chuyển động quay từ người thật nên đi đứng tự '
        + 'nhiên, tóc, váy bay theo bước chân). Bật riêng <strong>Nam</strong> hoặc <strong>Nữ</strong>: một người thong thả bước ra giữa bờ, đứng một '
        + 'mình ngắm pháo với dáng cô đơn (cúi đầu, thở dài, nhìn sang bên cạnh trống trải, lau nước mắt). Bật cả hai: chàng '
        + 'trai, cô gái từ hai phía đi lại gặp nhau ở giữa, nắm tay, tựa vai, ôm nhau ngước nhìn pháo hoa. Trời mưa thì che ô; cặp '
        + 'đôi gặp nhau thì cô gái gập ô, chàng trai che ô cho cô. Quần áo theo <strong>Mùa</strong> của cảnh kiểu phố Nhật, '
        + 'Hàn: xuân chàng trai mặc áo khoác jean để mở ngoài áo thun trắng, cô gái khoác áo trench màu be thắt đai; thu cả hai mặc '
        + 'cardigan len cổ chữ V (chàng trai cardigan xanh than, quần màu be; cô gái cardigan nâu caramel, tất mỏng); đông cả hai '
        + 'mặc áo măng tô dài, quàng khăn len to bản có tua rua (chàng trai măng tô màu lạc đà, khăn xám; cô gái măng tô màu than, '
        + 'khăn kem, quần tất). Trời có tuyết thì đội thêm mũ len (chàng trai mũ xám ôm đầu, cô gái mũ kem có quả bông). Tắt cả hai nút là không có người. Lần đầu '
        + 'xem cần tải thêm khoảng 4 MB.',
    peoplePlan: 'Mỗi thanh ngang là bề ngang màn hình, kéo để chọn chỗ người đó bắt đầu: <strong>mép trái</strong>, <strong>mép phải</strong> '
        + 'thì đi vào từ ngoài khung (như mặc định: chàng trai từ trái, cô gái từ phải); <strong>giữa</strong> thì đứng đợi sẵn ở giữa từ '
        + 'đầu; chỗ khác thì đứng ở đó ngắm pháo rồi đi ra giữa. Hai người cùng một chỗ thì nắm tay đi cùng nhau; cùng một phía thì '
        + 'người tới sau đi vòng qua người kia. <strong>Ai đến trước</strong>: người đó tới giữa trước, đứng đợi người kia đúng số giây '
        + 'đã chọn (quay ra mặt nước ngắm pháo, ngó về phía người kia sẽ tới, nhìn quanh, chàng trai gãi đầu, cô gái vén tóc), người '
        + 'kia sắp tới thì quay sang nhìn. Có một người đứng đợi sẵn ở giữa thì người đó là người đợi. Ở bờ bên kia, hai mép là hai '
        + 'đầu cầu (hoặc cách giữa bờ ít bước). Chàng trai luôn đứng bên trái cô gái khi hai người gặp nhau.',
    nearBank: 'Bật (mặc định): người ngắm pháo đứng ở bờ bên này, sát người xem, thấy rõ dáng người. Tắt: bỏ dải bờ bên này, '
        + 'người đứng nhỏ xa xa ở bờ bên kia, ngay dưới chỗ pháo bắn lên; bờ bên kia là <strong>cầu vòm cong</strong> hoặc '
        + '<strong>cầu nhiều vòm</strong> thì người đi lên giữa cầu theo độ vồng của mặt cầu, lan can cầu che phần dưới người. '
        + '<strong>Biển khơi</strong> không có bờ bên kia nên người vẫn đứng ở bờ bên này.',
    floating: '<strong>Hoa đăng</strong>: đèn hoa sen thả nước, ánh nến in bóng xuống nước. <strong>Cánh hoa</strong>: cánh hoa hồng, trắng '
        + 'lác đác trên mặt nước. Kiểu "Sông chảy" thì chúng trôi theo dòng, "Hồ tĩnh lặng" thì gần như đứng yên, dập dềnh.',
    waterThings: '<ul>'
        + '<li><strong>Cò</strong>: bay tới đậu trên khúc gỗ, đá, gò đất hoặc lội chỗ nước nông rình cá, ngó nghiêng, rỉa lông rồi bay đi.</li>'
        + '<li><strong>Vịt trời</strong>: cả đàn bay tới, bơi để lại vệt sóng, chổng đuôi kiếm ăn rồi cất cánh.</li>'
        + '<li><strong>Cá</strong>: cá mè, cá chép, cá trắm, đàn cá con nhảy khỏi mặt nước, con to con nhỏ (con to nhảy cao, tõm to), '
        + 'bóng in xuống nước; cá đớp mồi làm sóng lăn tăn.</li>'
        + '<li><strong>Ếch</strong>: ló đầu khỏi mặt nước gần đá, gò đất, lá bèo hoặc sát bờ; nhảy lên lá bèo, đá, gò đất ngồi phập '
        + 'phồng túi kêu, đớp đom đóm bay ngang, rồi nhảy tõm xuống nước. Con to con nhỏ: nhái bé kêu the thé, ếch to kêu trầm. '
        + 'Mặt nước còn có bong bóng nổi lên rồi vỡ.</li>'
        + '<li><strong>Khúc gỗ trôi</strong>: mỗi khúc một dáng, trôi theo dòng (chỉ khi "Sông chảy").</li>'
        + '<li><strong>Lá bèo</strong>: lá bèo, thỉnh thoảng có hoa súng; hồ thì mọc thành đám, sông thì trôi theo dòng.</li>'
        + '<li><strong>Đá, gò đất</strong>: giữa dòng; sông chảy thì nước dồn vào, rẽ ra hai bên, vật trôi lách qua.</li>'
        + '<li><strong>Thuyền</strong>: biển khơi có thuyền câu mực thắp đèn sáng rực sát chân trời, tàu khách, thuyền nhỏ '
        + 'treo đèn; sông thành phố có thuyền neo sát bờ giăng đèn. Đèn in vệt sáng lấp lánh xuống nước.</li>'
        + '</ul>Giữa biển khơi chỉ có cá và thuyền (không có đá, lá bèo, cò, vịt, ếch).',
    viewerQuality: 'Như trang xem phim: số càng lớn hình càng nét nhưng càng nặng máy. <strong>Tự động</strong> (khuyên dùng): theo màn hình '
        + 'và sức máy người xem, giật thì tự hạ xuống. Từ <strong>1080p</strong> (Full HD) trở lên vẽ đầy đủ mọi hiệu ứng, hợp khi biết '
        + 'người nhận dùng máy mạnh; <strong>720p</strong> bớt tia lửa lúc pháo dày đặc nhất; <strong>480p</strong> trở xuống nhẹ nhất, '
        + 'không có khói pháo và quầng sáng quanh pháo. Màn hình không hiện được nhiều điểm ảnh hơn chính nó: mức cao hơn màn hình người xem thì máy tính mạnh '
        + 'vẽ dư tới gấp đôi rồi thu nhỏ cho mịn, rõ hơn (nặng máy hơn nhiều), điện thoại và máy yếu vẽ bằng độ phân giải gốc của màn '
        + 'hình; muốn thật sự 4K thì cần màn hình 4K. Khung xem nhanh luôn vẽ nhẹ cho dễ chỉnh, bấm <strong>Xem thử</strong> để thấy '
        + 'đúng chất lượng. Người xem đã tự chọn mức khác thì giữ theo họ.',
    viewerSky: 'Bầu trời sáng lên theo màu pháo khi pháo nổ: sáng nhất quanh chỗ nổ, nhạt dần ra xa; cầu, nhà, bờ ngay dưới quả '
        + 'pháo cũng sáng hơn chỗ khác. Chọn <strong>Mờ</strong> hoặc <strong>Tắt</strong> nếu muốn trời tối hơn, vd khi bật ảnh nền thành phố.',
    viewerScale: 'Phóng to hoặc thu nhỏ toàn bộ pháo hoa. <strong>Theo màn hình</strong>: điện thoại tự thu nhỏ một chút cho pháo lớn '
        + 'không tràn khung. Đặt cỡ cố định thì mọi máy dùng cùng cỡ.',
    viewerFullscreen: 'Người nhận chạm "Mở quà" (hoặc hộp quà) là màn trình diễn vào toàn màn hình luôn. Trình duyệt chỉ cho bật toàn '
        + 'màn hình đúng lúc người xem chạm; iPhone không hỗ trợ toàn màn hình cho trang web nên giữ nguyên.',
    tapToLaunch: 'Bật (mặc định): người xem chạm hoặc bấm vào bầu trời là bắn thêm một quả pháo, vui cho trẻ nhỏ và người thích tự tay '
        + 'bắn. Tắt: chạm vào trời không bắn thêm pháo, màn trình diễn giữ đúng như bạn sắp đặt (vẫn chạm được các nút tạm dừng, âm thanh, cài đặt).',
    receiverShare: 'Bật (mặc định): góc dưới màn trình diễn có nút 📷 để người nhận chụp lại khoảnh khắc đẹp (hoặc bấm phím C) và nút '
        + 'chia sẻ để gửi link qua Facebook, Messenger, Zalo..., tự tạo video dọc đăng TikTok, Reels, Shorts. Ảnh và video làm ngay trên máy '
        + 'người nhận, không tải lên máy chủ. Người khác mở link được chia sẻ cũng được tính khi bạn bật báo mở quà. Tắt nếu quà chỉ dành riêng cho người nhận.',
    viewerControls: 'Mặc định các nút tạm dừng, âm thanh, cài đặt ẩn đi cho trọn khung hình (đưa chuột hoặc chạm góc trên để mở). '
        + 'Bật mục này để các nút luôn hiện.',
    stars: 'Bầu trời sao như ngoài đời: hàng nghìn sao mờ, vài chục tới hơn trăm sao sáng lấp lánh, màu theo nhiệt độ (xanh trắng tới '
        + 'cam đỏ); sát chân trời sao mờ đi, nhấp nháy mạnh hơn, sao sáng chớp đổi sắc. Thỉnh thoảng một vệ tinh lặng lẽ trôi qua. '
        + 'Có ảnh nền thành phố thì sao chỉ ở phần trời phía trên. Trăng càng sáng thì sao càng mờ.',
    meteors: 'Ít: lâu lâu một ngôi sao băng vụt qua. Nhiều: mưa sao băng, sao băng dày, cùng tỏa ra từ một điểm trên trời như mưa '
        + 'sao băng thật (gần điểm tỏa thì ngắn và chậm). Đôi khi có thiên thạch lửa sáng rực, vỡ tóe rồi để lại vệt khói mờ.',
    milkyWay: 'Dải Ngân Hà vắt chéo bầu trời: lõi sáng ngả vàng ở thấp gần chân trời, dải bụi tối chạy giữa, những đám sao dày đặc; '
        + 'mặt nước soi bóng. Trăng càng tròn thì Ngân Hà càng mờ như ngoài đời: muốn thấy rõ thì bỏ trăng hoặc chọn trăng khuyết.',
    clouds: 'Mây đêm trôi chậm theo gió: mây gần chân trời nhỏ, dẹt, trôi chậm; mây trên cao to và trôi nhanh hơn. Mây che sao, trăng phía sau; '
        + 'có trăng thì thân mây sáng lên, viền trên ánh bạc (gần trăng càng sáng); mây che trăng thì cả bầu trời tối lại. Pháo nổ rọi sáng mây.',
    moon: '<strong>Theo ngày xem</strong>: trăng đúng pha của hôm người nhận mở (tính theo chu kỳ 29,53 ngày; rằm thì trăng tròn). '
        + '<strong>Tự chọn</strong>: chọn 1 trong 8 pha. Trăng trôi chậm theo một cung, phản chiếu xuống mặt nước nếu có. '
        + 'Ánh trăng làm cả bầu trời sáng xanh lên: trăng càng tròn càng sáng, trăng non gần như không; mây che trăng thì tối lại. '
        + 'Độ cao tính từ chân trời (0) tới đỉnh khung (100).',
    season: '<strong>Xuân</strong>: cây đâm lộc non, hoa đào nở, cánh hoa bay theo gió rơi xuống trôi trên mặt nước, cỏ lấm tấm hoa, '
        + 'bướm lượn ven bờ. <strong>Hạ</strong>: lá xanh um, sen nở, đom đóm. <strong>Thu</strong>: lá vàng, lá đỏ, lá rụng bay theo gió '
        + 'rồi trôi trên mặt nước, cỏ úa, lau trắng. <strong>Đông</strong>: cây trơ cành đọng tuyết, bờ phủ tuyết, mặt nước đóng băng. '
        + '<strong>Theo ngày xem</strong>: mùa của hôm người nhận mở (tính theo lập xuân, lập hạ, lập thu, lập đông). '
        + 'Cây, cỏ, bờ, mặt nước chỉ có khi bật Mặt nước; lá rụng, cánh hoa bay thì luôn có.',
    weather: '<strong>Mưa</strong>: mưa rơi xiên theo gió, gần to xa nhỏ, hạt mưa gợn vòng lăn tăn trên mặt nước (mặt băng thì hạt mưa vỡ '
        + 'tung), lóe sáng khi pháo nổ. <strong>Tuyết rơi</strong>: bông tuyết lả tả bay theo gió, rơi xuống mặt nước thì tan. '
        + 'Chọn được cùng mùa bất kỳ, vd mùa đông có tuyết rơi.',
    smoke: 'Như pháo hoa thật: mỗi quả nổ để lại một đám khói trắng, đường bay lên có vệt khói mảnh. Khói nở dần, trôi theo gió rồi tan, '
        + 'và được những quả nổ sau rọi màu. <strong>Nhẹ</strong>: thoáng qua. <strong>Dày</strong>: đám khói đặc, lâu tan. '
        + 'Người xem đặt chất lượng 480p trở xuống thì không có khói để khỏi giật.',
    reduceFlashing: 'Bật khi người nhận nhạy cảm với ánh sáng nhấp nháy (người lớn tuổi, người dễ bị co giật do ánh sáng...): hạt pháo không chớp tắt hay lấp lánh, '
        + 'không có quầng chớp lúc nổ, bầu trời không đổi màu theo pháo. Người xem cũng tự bật được bằng nút "Giảm chớp sáng" trên màn mở quà.',
    loop: 'Bật: chạy hết đợt cuối thì quay lại đợt đầu, bắn mãi. Tắt: chạy một lượt rồi hiện màn kết với lời chúc và nút Xem lại.',
    music: 'Nhạc phát cùng đợt pháo đầu tiên. Chọn bài trong kho nhạc có sẵn, file từ máy (tối đa 20MB) hoặc dán link trực tiếp tới file .mp3; '
        + 'link trang YouTube, Zing không dùng được.',
    musicStart: 'Bỏ đoạn dạo đầu: nhạc phát từ giây này. Nghe trên thanh phát rồi bấm nút <i class="fas fa-location-crosshairs"></i> để lấy đúng chỗ đang nghe.',
    musicVolume: 'Độ to của nhạc nền so với tiếng pháo.',
    musicSync: 'Bật: "Nổ sau" của mỗi phát là lúc pháo <strong>nổ</strong> (pháo tự phóng sớm cho kịp) và pháo bám theo bài nhạc nên nổ đúng phách; '
        + 'dòng thời gian hiện mốc ♪ trong bài. Nút <strong>Xếp pháo theo nhịp nhạc</strong> tự bật mục này.',
    effectsVolume: 'Độ to của tiếng phóng và tiếng nổ. Có nhạc nền thì nên giảm để nghe rõ nhạc; 0% là tắt hẳn.',
    natureSound: 'Tiếng của khung cảnh, tạo ngay trong trình duyệt: nước chảy, sóng vỗ bờ (theo kiểu bờ), gió lùa qua lá (theo cây '
        + 'trên bờ và mùa), dế, ếch nhái kêu đêm, vịt kêu, cò cất cánh, cá quẫy nước, mưa rơi. Ếch kêu đúng lúc túi kêu phồng, '
        + 'tiếng ở bên trái màn hình nghe bên trái, ở xa thì nhỏ hơn. Chỉ có tiếng của những thứ đang có trong cảnh, nhỏ hơn '
        + 'tiếng pháo; có nhạc nền thì tự nhỏ lại. Người xem vẫn tắt được trong Cài đặt.',
    filename: 'Tên dùng để lưu và làm link chia sẻ (…/s/ten-file). Chỉ chữ không dấu, số, gạch nối, gạch dưới. Trùng tên kịch bản khác thì tự thêm số.',
    timelineTrack: 'Mỗi nút là một phát bắn đặt đúng thời điểm (lúc phóng; khi khớp nhịp nhạc là lúc nổ), phía trên là sóng nhạc và vạch phách. '
        + '<strong>Kéo ngang</strong> để đổi thời điểm (bám phách hoặc theo 0,1 giây; giữ Alt để thả tự do), <strong>bấm</strong> để chỉnh, '
        + '<strong>nhấn đúp</strong> chỗ trống để thêm phát, phím mũi tên để nhích. Các phát khác giữ nguyên thời điểm, đợt được xếp lại tự động.',
    timeline: 'Kịch bản gồm các <strong>đợt</strong> chạy lần lượt, mỗi đợt khoảng 3 giây. Các phát cùng đợt bắn cùng lúc, trừ khi đặt <strong>Trễ</strong>. '
        + 'Thêm phát <strong>Tạm dừng</strong> để kéo dài một đợt. Bấm vào một phát để chỉnh.',
    preview: 'Chạy chính trình phát thật nên giống hệt khi gửi đi. Đang chọn một phát thì chỉ bắn lặp phát đó. '
        + '<i class="fas fa-play"></i> chạy cả kịch bản từ đầu (tiêu đề, lời nhắn, màn kết). <i class="fas fa-volume-high"></i> bật tiếng pháo và nhạc nền. '
        + '<i class="fas fa-gift"></i> xem như người nhận: thiệp hoặc hộp quà, chạm vào khung để mở. '
        + 'Hẹn giờ (đồng hồ đếm ngược) và toàn màn hình khi mở quà chỉ xem được bằng <strong>Xem thử</strong>.',
    // Xếp pháo theo nhịp nhạc
    beatDensity: '<strong>Thưa</strong>: chủ yếu phách đầu mỗi ô nhịp. <strong>Vừa</strong>: thêm các phách khác ở đoạn sôi động. '
        + '<strong>Dày</strong>: thêm phát nhỏ giữa các phách ở đoạn cao trào; máy yếu có thể giật.',
    beatLength: 'Bắn tới đâu trong bài, tính từ giây bắt đầu ở mục Nhạc nền. Bài rất dài thì tối đa 8 phút.',
    beatKeep: 'Chữ trên trời, hình ảnh và lời nhắn đang có được đặt vào các phách mạnh trải đều suốt bài, giữ thứ tự cũ. '
        + 'Quanh chữ và ảnh không bắn pháo khác cho dễ nhìn.',
    // Bảng chỉnh sửa phát bắn
    shellType: 'Hình dạng khi nổ. <strong>Văn bản</strong>: chữ trên trời. <strong>Hình ảnh</strong>: ảnh lớn dần trong khung. '
        + '<strong>Lời nhắn</strong>: dòng chữ như phụ đề, không bắn pháo. <strong>Tạm dừng</strong>: kéo dài đợt.',
    launchStyle: 'Cách pháo bay lên trước khi nổ (xoắn đôi, nổ dọc đường, bay nhiều tầng, đạn tàng hình...). Dùng được với mọi loại pháo.',
    burst: 'Các phát cùng đợt bắn cùng lúc; các đợt chạy lần lượt từ nhỏ đến lớn. Đổi số đợt để chuyển phát này sang đợt khác.',
    delay: () => (isSyncMode()
        ? 'Kịch bản đang <strong>khớp nhịp nhạc</strong>: đây là lúc pháo <strong>nổ</strong>, tính từ đầu đợt (1000 ms = 1 giây). Pháo tự phóng sớm hơn cho kịp.'
        : 'Chờ bao lâu kể từ đầu đợt rồi mới phóng (1000 ms = 1 giây). Dùng để các phát nổ nối tiếp nhau thay vì cùng lúc.'),
    text: 'Chữ hiện trên trời bằng hạt pháo, tối đa 60 ký tự; chèn được biểu tượng cảm xúc (🎓, ❤️, 🎂...), để màu "Ngẫu nhiên" thì '
        + 'biểu tượng giữ màu gốc của nó. Mã tự thay: <strong>[YEAR]</strong> năm hiện tại, '
        + '<strong>[LUNAR_YEAR]</strong> tên năm âm lịch, <strong>[SINCE:2000]</strong> số năm kể từ năm 2000.',
    captionDuration: 'Lời nhắn hiện trên màn hình bao lâu rồi mờ dần (1000 ms = 1 giây).',
    position: 'Bấm hoặc kéo trên khung để chọn điểm nổ. Số nhỏ trên khung là các phát khác cùng đợt, giúp tránh nổ chồng lên nhau.',
    x: 'Vị trí ngang của điểm nổ: 0 là mép trái, 100 là mép phải. Trên điện thoại được thu vào giữa cho khỏi tràn màn hình.',
    y: 'Độ cao của điểm nổ: 0 là mặt đất, 100 là đỉnh trời. Cao hơn thì pháo bay lâu hơn.',
    size: 'Cỡ chùm nổ, 1 là cỡ chuẩn. Lớn hơn thì chùm to và nhiều hạt hơn, máy yếu có thể giật.',
    rotation: 'Xoay các pháo hình (trái tim, ngôi sao, bướm...) theo độ. Để trống thì mỗi lần nổ nghiêng ngẫu nhiên một chút. Chữ không bị xoay.',
    sounds: 'Âm thanh lúc phóng, lúc bay (tiếng huýt) và lúc nổ; "Mặc định" là âm của loại pháo. Bấm <i class="fas fa-volume-high"></i> ở khung xem nhanh để nghe.',
    effects: '<ul>'
        + '<li><strong>Nhấp nháy</strong>: hạt chớp tắt liên tục.</li>'
        + '<li><strong>Lách tách</strong>: hạt tàn thì nổ lép bép.</li>'
        + '<li><strong>Nổ chéo</strong>: mỗi hạt tách thành 4 tia.</li>'
        + '<li><strong>Nhụy ở giữa</strong>: thêm một chùm nhỏ ở tâm.</li>'
        + '<li><strong>Dải sáng</strong>: vài vệt sáng dài bay xa.</li>'
        + '<li><strong>Đuôi ngựa</strong>: hạt rủ xuống như bờm ngựa.</li>'
        + '<li><strong>Hoa nở</strong>: mỗi hạt tàn lại nở thành một chùm nhỏ.</li>'
        + '<li><strong>Vòng nhẫn</strong>: hạt xếp thành vòng tròn.</li>'
        + '<li><strong>Cháy lâu, rơi chậm</strong>: hạt sáng lâu và lơ lửng.</li>'
        + '</ul>Ô đã tích sẵn và không bỏ được là hiệu ứng có sẵn của loại pháo.',
    glitter: 'Tia lửa nhỏ tóe ra sau mỗi hạt khi bay: Nhẹ, Vừa, Dày, Đặc là nhiều dần; Dải sáng là vệt dài; Liễu là tia rủ xuống.',
    starDensity: 'Nhân số hạt so với mặc định của loại pháo: 2 là gấp đôi (dày hơn, nặng máy hơn), 0,5 là một nửa.',
    starCount: 'Đặt đúng số hạt, bỏ qua Mật độ hạt. Để trống thì tự tính theo cỡ pháo.',
    starLife: 'Mỗi hạt sáng bao lâu rồi tắt (1000 ms = 1 giây). Để trống thì theo loại pháo, VD Liễu khoảng 3 giây, Cháy lâu khoảng 6 giây.',
    starLifeVariation: 'Độ chênh tuổi thọ giữa các hạt, từ 0 đến 1. 0: mọi hạt tắt cùng lúc. Lớn hơn: tắt lác đác, trông tự nhiên hơn.',
    spreadSize: 'Độ rộng chùm nổ: lớn hơn thì hạt bay xa tâm hơn. Để trống thì theo loại pháo và cỡ pháo.',
    strobeFreq: 'Dùng khi bật Nhấp nháy: mỗi lần chớp cách nhau bao nhiêu ms. Nhỏ hơn thì nháy nhanh hơn.',
    secondColor: 'Hạt đổi sang màu này sau một lúc; chọn thời điểm ở ô Lúc chuyển màu.',
    transitionTime: 'Sau bao nhiêu ms kể từ lúc nổ thì hạt đổi sang Màu chuyển sang. Để trống thì tự chọn.',
    glitterColor: 'Màu tia lửa lấp lánh tóe ra sau mỗi hạt.',
    pistilColor: 'Màu chùm nhỏ ở tâm, dùng khi bật Nhụy ở giữa.',
    // Báo mở quà
    notifyOpen: 'Biết khi người nhận <strong>mở link</strong>, <strong>bấm mở quà</strong> và <strong>xem hết</strong> (chỉ thời điểm và loại thiết bị, '
        + 'không có thông tin cá nhân). Xem trong hộp Chia sẻ, danh sách Kịch bản của tôi hoặc link theo dõi riêng. '
        + 'Người nhận thấy một dòng nhỏ "Người gửi sẽ biết khi bạn mở quà". Cần bản có máy chủ PHP.',
    giftTracking: 'Trạng thái món quà: đã mở link, đã mở quà, đã xem hết. Link theo dõi riêng mở được trên mọi máy, hãy giữ bí mật. '
        + 'Bạn tự mở thử trên máy này (hoặc máy đã mở link theo dõi) thì không tính là người nhận mở.',
    // Xuất video
    videoFormat: '<strong>Dọc 9:16</strong>: TikTok, Story, Reels, xem trên điện thoại (pháo bố trí như trên điện thoại). '
        + '<strong>Ngang 16:9</strong>: YouTube, Facebook, màn hình máy tính. <strong>Vuông 1:1</strong>: bài đăng Facebook, Instagram.',
    videoQuality: '<strong>Full HD</strong> (1080p): nét nhất, file nặng hơn. <strong>HD</strong> (720p): file nhẹ khoảng một nửa, '
        + 'gửi qua Zalo, Messenger nhanh hơn và tạo xong nhanh hơn.',
    strobeColor: 'Màu lúc hạt chớp sáng, dùng khi bật Nhấp nháy.'
};

export function helpTip(key) {
    return `<button type="button" class="help-tip" data-help="${key}" aria-label="Giải thích">?</button>`;
}

// Nút "?" luôn đi cùng chữ cuối của tên mục: gói chữ cuối và nút vào một cụm không ngắt dòng, hết chỗ thì cả cụm cùng
// xuống dòng chứ không để nút rớt một mình (nút là một khối riêng nên trình duyệt được ngắt dòng ngay trước nó)
function glueHelpTips(root) {
    const tips = root.matches && root.matches('.help-tip') ? [root] : root.querySelectorAll('.help-tip');
    tips.forEach(tip => {
        const prev = tip.previousSibling;
        if (!prev || prev.nodeType !== Node.TEXT_NODE || tip.parentNode.classList.contains('help-glue')) return;
        const word = prev.textContent.match(/(\S+)\s*$/);
        if (!word) return;
        prev.textContent = prev.textContent.slice(0, word.index);
        const glue = document.createElement('span');
        glue.className = 'help-glue';
        glue.textContent = word[1];
        tip.replaceWith(glue);
        glue.appendChild(tip);
    });
}

// Một khung giải thích dùng chung, đặt ngay dưới (hoặc trên) nút "?" và không tràn khỏi màn hình
export const helpTooltip = {
    el: null,
    anchor: null,
    // Bấm/chạm để ghim: chỉ đóng khi bấm ra ngoài, bấm lại nút hoặc nhấn Esc
    pinned: false,
    timer: null,
    frame: null,

    init() {
        const el = document.createElement('div');
        el.id = 'help-tooltip';
        el.className = 'help-tooltip';
        el.setAttribute('role', 'tooltip');
        el.hidden = true;
        el.innerHTML = '<div class="help-tooltip__body"></div><span class="help-tooltip__arrow"></span>';
        document.body.appendChild(el);
        this.el = el;

        // Nút "?" có sẵn trong trang và nút thêm vào sau (khung chỉnh phát bắn, hộp thoại...)
        glueHelpTips(document);
        new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) glueHelpTips(node);
        }))).observe(document.body, { childList: true, subtree: true });

        // Pha bắt: nút "?" nằm trong nhãn, tiêu đề mục thu gọn, dòng phát bắn... không để các phần đó nhận cú bấm
        document.addEventListener('click', (e) => {
            const tip = e.target.closest('.help-tip[data-help]');
            if (tip) {
                e.preventDefault();
                e.stopPropagation();
                if (this.anchor === tip && this.pinned) this.hide();
                else this.show(tip, true);
            } else if (this.anchor && !el.contains(e.target)) {
                this.hide();
            }
        }, true);

        if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
            document.addEventListener('mouseover', (e) => {
                const tip = e.target.closest && e.target.closest('.help-tip[data-help]');
                if (!tip) return;
                clearTimeout(this.timer);
                if (tip !== this.anchor) this.timer = setTimeout(() => this.show(tip, false), 120);
            });
            document.addEventListener('mouseout', (e) => {
                const tip = e.target.closest && e.target.closest('.help-tip[data-help]');
                if (!tip || tip.contains(e.relatedTarget)) return;
                clearTimeout(this.timer);
                if (tip === this.anchor && !this.pinned) this.timer = setTimeout(() => this.hide(), 120);
            });
        }

        // Bàn phím: Tab tới nút thì hiện, rời đi thì ẩn, Esc để đóng
        document.addEventListener('focusin', (e) => {
            if (e.target.matches('.help-tip[data-help]') && e.target.matches(':focus-visible')) this.show(e.target, false);
        });
        document.addEventListener('focusout', (e) => {
            if (e.target === this.anchor && !this.pinned) this.hide();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.anchor) {
                // Chỉ đóng khung giải thích, chưa đóng hộp thoại phía sau
                e.stopPropagation();
                this.hide();
            }
        }, true);
    },

    show(anchor, pinned) {
        const tip = HELP_TIPS[anchor.dataset.help];
        if (!tip) return;
        clearTimeout(this.timer);
        if (this.anchor && this.anchor !== anchor) this.release();
        this.anchor = anchor;
        this.pinned = pinned;
        anchor.classList.add('active');
        anchor.setAttribute('aria-describedby', 'help-tooltip');
        this.el.querySelector('.help-tooltip__body').innerHTML = typeof tip === 'function' ? tip() : tip;
        this.el.hidden = false;
        this.place();
        // Bám theo nút khi cuộn hoặc bảng được dựng lại
        if (!this.frame) this.follow();
    },

    hide() {
        clearTimeout(this.timer);
        cancelAnimationFrame(this.frame);
        this.frame = null;
        this.release();
        this.anchor = null;
        this.pinned = false;
        this.el.hidden = true;
    },

    release() {
        if (!this.anchor) return;
        this.anchor.classList.remove('active');
        this.anchor.removeAttribute('aria-describedby');
    },

    follow() {
        this.frame = requestAnimationFrame(() => {
            this.frame = null;
            if (!this.anchor) return;
            if (!this.anchor.isConnected || !this.anchor.offsetParent) {
                this.hide();
                return;
            }
            this.place();
            this.follow();
        });
    },

    place() {
        const margin = 8;
        const gap = 10;
        const rect = this.anchor.getBoundingClientRect();
        // Nút đã cuộn ra khỏi màn hình
        if (rect.bottom < 0 || rect.top > window.innerHeight) {
            this.hide();
            return;
        }
        const el = this.el;
        const width = el.offsetWidth;
        const height = el.offsetHeight;
        const center = rect.left + rect.width / 2;
        const left = Math.max(margin, Math.min(center - width / 2, window.innerWidth - width - margin));
        // Ưu tiên hiện bên dưới; không đủ chỗ thì lật lên trên
        const below = rect.bottom + gap + height <= window.innerHeight - margin || rect.top - gap - height < margin;
        el.style.left = `${Math.round(left)}px`;
        el.style.top = `${Math.round(below ? rect.bottom + gap : rect.top - gap - height)}px`;
        el.classList.toggle('is-above', !below);
        el.style.setProperty('--arrow-x', `${Math.round(center - left)}px`);
    }
};

// ---------------------------------------------------------------------------
// BẢNG CHỈNH SỬA phát bắn đang chọn
// ---------------------------------------------------------------------------
