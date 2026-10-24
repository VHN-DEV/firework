# Hanabi – Pháo hoa gửi tặng

**Hanabi** (花火, "pháo hoa" trong tiếng Nhật; trước đây tên là Trình diễn Pháo hoa) là dự án Trình mô phỏng Pháo hoa (Firework Simulator) tuyệt đẹp chạy trực tiếp trên nền tảng Web (HTML5/Canvas), cho phép bạn tạo và tùy chỉnh các hiệu ứng pháo hoa một cách sinh động, mượt mà và chân thực.

## Cài đặt và Chạy dự án

> Phần này dành cho tác giả và những người đã được tác giả cho phép (xem [LICENSE](LICENSE)).

Để tải mã nguồn và chạy dự án trên máy tính, làm theo các bước sau:

1. **Clone mã nguồn (hoặc tải mã nguồn)**
   Mở terminal/command prompt và chạy lệnh sau (yêu cầu máy tính đã cài đặt [Git](https://git-scm.com/)):
   ```bash
   git clone https://github.com/your-username/firework-simulator.git
   ```
   *Lưu ý: Thay thế URL trên bằng địa chỉ URL chính xác của repository nếu bạn đã đẩy mã nguồn này lên GitHub.*

2. **Truy cập thư mục dự án**
   ```bash
   cd firework-simulator
   ```

3. **Chạy dự án**
   Dự án này là thuần Front-end (HTML, CSS, JS), không yêu cầu cài đặt Node.js hay bất kỳ build tool phức tạp nào. Bạn có thể chạy theo các cách sau:
   - **Cách 1**: Mở trực tiếp tệp `demo.html` (màn trình diễn) bằng bất kỳ trình duyệt web nào (Chrome, Firefox, Edge, Safari...).
   - **Cách 2**: Sử dụng các công cụ Live Server (như tiện ích Live Server của VS Code) để khởi chạy máy chủ web cục bộ và trải nghiệm mượt mà hơn.

## Kiểm thử & triển khai

- `npm run build`: build vào thư mục `dist` (chạy trên XAMPP tại `http://localhost/firework/dist/`).
- `npm test`: build rồi chạy kiểm thử tự động (hơn 60 bước: trình phát, link tặng, hộp quà, hẹn giờ, nhạc nền, lời nhắn,
  màn kết, mọi loại pháo và kiểu bắn, builder lưu/mở/chia sẻ, dòng thời gian theo giây, hoàn tác và bản nháp, xếp pháo
  theo nhịp nhạc với bài nhạc biết trước đáp án, tạo video MP4 có hình và tiếng nhanh hơn thời gian thật, người nhận
  chụp khoảnh khắc, chia sẻ và tạo video, báo mở quà, trang Điều khoản/Bảo mật).
  Cần PHP (lệnh `php`, hoặc biến `PHP_BIN`) và Google Chrome (biến `CHROME_PATH` nếu không ở chỗ mặc định).
  `npm run test:e2e` chạy kiểm thử trên bản build sẵn có.
- Mỗi lần push lên `main`, GitHub Actions (`.github/workflows/deploy.yml`) tự cài thư viện, build, chạy kiểm thử;
  đạt hết mới triển khai lên GitHub Pages. Pull request chỉ được kiểm thử, không triển khai.
- Thư mục `dist` và `node_modules` không còn đưa lên git. Kịch bản lưu bằng builder trên XAMPP nằm trong `dist/configs`
  (và ảnh, nhạc trong `dist/uploads`): muốn giữ lâu dài hoặc đưa lên GitHub Pages thì chép sang `src/static/configs`
  (và `src/static/uploads`) rồi commit.
- **Trang tĩnh** (GitHub Pages, Cloudflare Pages, Vercel, Netlify, mở file trực tiếp: không có máy chủ): builder lưu kịch
  bản trong trình duyệt của người tạo, link chia sẻ và tab Xem thử dạng `/demo#k=...` chứa sẵn cả kịch bản (nén, xem
  `src/assets/js/share-link.js`) nên ai mở cũng xem đúng. Ảnh tự tải lên không gói vào link; muốn link ngắn, có ảnh xem
  trước khi dán link, báo mở quà thì chạy trên máy chủ có PHP hoặc Cloudflare Workers. Trang chính hiện chạy trên
  Cloudflare Workers: bản GitHub Pages build với `MOVED_FROM=https://vhn-dev.github.io/firework/` (`deploy.yml`) nên mỗi
  trang tự mở trang tương ứng ở trang chính (giữ `?config=`, `#k=`); builder còn kịch bản, bản nháp trong trình duyệt thì
  ở lại và báo cách Xuất, Nhập sang trang mới (`movedScript` trong `seo-plugin.js`).
- **Cloudflare Workers** (miễn phí, có máy chủ, không phải tự quản): `wrangler.jsonc` + `worker/` thay cho API PHP, cùng
  đường dẫn (`api/*.php`, `s/<tên>`) nên trang không phải sửa. Kịch bản, mã chủ, lịch sử mở quà lưu trong cơ sở dữ liệu
  D1; ảnh, nhạc tải lên và ảnh thiệp lưu trong KV (hoặc R2: đổi khối `kv_namespaces` thành `"r2_buckets": [{ "binding":
  "MEDIA" }]`); file tĩnh trong `dist` (`src/static/.assetsignore` bỏ thư mục `api/` PHP). Triển khai: trên Cloudflare,
  Workers & Pages, nối repo GitHub; lệnh build `npm run build`, lệnh triển khai `npx wrangler@4 deploy` (dự án không ghi wrangler trong package.json). Địa chỉ trang
  (ảnh, link xem trước của trang chủ, sitemap) mặc định là `https://firework.vhnam18032002.workers.dev/` (`SITE_URL` trong
  `seo-plugin.js`); gắn tên miền khác thì đặt biến môi trường lúc build `SITE_URL=https://<tên miền>/`. Lần triển
  khai đầu Cloudflare tự tạo D1, KV (wrangler 4.45 trở lên), bảng do Worker tự tạo. Chống spam: mỗi máy (IP, lưu bản
  băm) chỉ được lưu, tải ảnh nhạc, báo mở quà một số lần (`LIMITS` trong `worker/index.js`); ảnh thiệp giống lần lưu
  trước thì không ghi lại (KV chỉ có 1.000 lần ghi mỗi ngày). Xóa kịch bản thì xóa luôn ảnh, nhạc chỉ nó dùng; mỗi ngày
  lúc 7h05 sáng (`triggers` trong `wrangler.jsonc`) Worker xóa bản Xem thử cũ, bộ đếm hết hạn, ảnh, nhạc quá 30 ngày
  không kịch bản nào dùng. Mở lại link quà chỉ tốn 1 lượt gọi Worker (giới hạn 100.000 lượt mỗi ngày): trình duyệt giữ
  trang chia sẻ 1 giờ, giữ ảnh, nhạc (cả các đoạn nhạc đã tải), hỏi lại kịch bản thì Worker trả 304 nếu chưa đổi.
  Chạy thử tại máy: `npm run build` rồi
  `npx wrangler dev` (D1, KV giả lập trong `.wrangler/`); kiểm thử `npm run test:worker` (cần mạng để tải wrangler).
- **Đường dẫn (route)**: mọi link dùng đường dẫn không đuôi `.html`: `/` (trang chủ), `/demo` (trình phát, link tặng
  `/demo?config=<tên>`), `/builder`, `/terms`, `/privacy`, `/theo-doi?id=...&key=...`, `/s/<tên>` (trang chia sẻ). Mỗi
  route là file `<tên>.html` ở thư mục gốc nên đường dẫn tương đối (`assets/`, `api/`, `configs/`) không đổi. GitHub
  Pages và Vite dev tự phục vụ `/<tên>` bằng `<tên>.html`; Apache dùng `.htaccess` (cần `mod_rewrite`); máy chủ kiểm thử
  dùng `tests/e2e/router.php`. Nginx cần thêm `try_files $uri $uri.html $uri/ =404;` và chuyển `s/<tên>` sang
  `api/share.php?c=<tên>`. Link cũ có `.html` vẫn mở được; thẻ `canonical` của mỗi trang trỏ về bản không đuôi.
- **Báo mở quà** (cần máy chủ PHP hoặc Cloudflare Workers; dưới đây là bản PHP): mã theo dõi và lịch sử mở quà nằm trong `api/data/` (file JSON, các hàm đọc/ghi gom
  trong `api/tracking.inc.php` để sau này chuyển sang cơ sở dữ liệu). Thư mục này cần quyền ghi và phải chặn tải trực
  tiếp: Apache dùng sẵn `api/data/.htaccess`; Nginx cần thêm `location ^~ /api/data/ { deny all; }`. Khi triển khai bản
  mới, đừng xóa `api/data/` (và `configs/`, `uploads/`) trên máy chủ.

## Hướng dẫn sử dụng

Khi bạn đã mở dự án trên trình duyệt, đây là các thao tác và tính năng chính:

- **Tự do tương tác**: Bạn có thể nhấp chuột hoặc chạm (trên màn hình cảm ứng) vào bất cứ đâu trên màn hình bầu trời đêm để tự bắn một quả pháo hoa.
- **Tạo màn trình diễn riêng**: Mở trình soạn kịch bản (`/builder`, nút "Tạo kịch bản pháo hoa") để chọn loại pháo, chữ trên trời, nhạc nền (tự tải lên hoặc chọn từ kho nhạc có sẵn), ảnh (kho ảnh), lời chúc, khói pháo (Tắt / Nhẹ / Dày), mặt nước phản chiếu, bầu trời đêm (sao, trăng đúng pha, đèn trời,
  khinh khí cầu, máy bay) rồi chia sẻ link.
- **Cài đặt** (nút bánh răng ⚙️ ở góc trên bên phải, hoặc phím `O`): chỉ gồm các tùy chọn khi xem, mỗi mục có nút "?" giải thích:
  - **Chất lượng**: theo độ phân giải như trang xem phim: Tự động (mặc định: theo màn hình và sức máy, giật thì tự hạ
    xuống) hoặc 144p, 240p, 360p, 480p SD, 720p HD, 1080p Full HD, 1440p 2K, 2160p 4K, 4320p 8K (số điểm ảnh cạnh ngắn của
    khung vẽ, không vượt độ phân giải gốc của màn hình). Từ 1080p trở lên vẽ đầy đủ mọi hiệu ứng; 720p bớt tia lửa lúc dày
    đặc nhất; 480p trở xuống bớt thêm, không có khói pháo và quầng sáng quanh pháo. Người tạo có thể đặt sẵn trong builder (nhóm
    "Khi người nhận xem"), lựa chọn người xem tự đặt luôn được ưu tiên.
  - **Ánh sáng bầu trời**: Tắt / Mờ / Bình thường.
  - **Thu phóng**: phóng to hay thu nhỏ toàn bộ pháo hoa.
  - **Toàn màn hình**, **Giảm chớp sáng** (cho người nhạy cảm với ánh sáng nhấp nháy), **Ẩn nút điều khiển**.
- **Âm lượng**: Bật/tắt âm thanh bằng biểu tượng loa 🔈 ở thanh điều khiển trên cùng.
- **Chụp khoảnh khắc, chia sẻ, tạo video** (hai nút tròn ở góc dưới phải khi xem):
  - 📷 (hoặc phím `C`): chụp khung hình đang hiện (ảnh nền, pháo, chữ) thành ảnh JPEG để lưu hoặc gửi; các ảnh đã chụp
    xem lại trong bảng chia sẻ.
  - Chia sẻ (cũng có ở màn kết): sao chép link hoặc gửi qua Facebook, Messenger, Zalo, Telegram, WhatsApp, X, Threads,
    LinkedIn, Email, tin nhắn, bảng chia sẻ của máy. **Tạo video** dựng màn trình diễn thành file MP4 (khổ dọc 9:16 cho
    TikTok, Reels, Shorts; ngang 16:9; vuông 1:1) kèm nhạc và thiệp lời chúc; nút TikTok, Instagram mở thẳng video dọc.
- **Tạo video** (builder nút Video, hoặc người nhận): bấm một lần là có file MP4, không phải ngồi chờ hết màn trình
  diễn. Khung ẩn chạy màn trình diễn theo đồng hồ giả lập (`player/clock.js`), từng khung hình được mã hóa H.264 ngay
  trong trình duyệt (WebCodecs, ưu tiên bộ mã hóa phần cứng), tiếng pháo và nhạc nền trộn sẵn rồi mã hóa AAC, ghép
  bằng mp4-muxer. Cần Chrome, Edge hoặc Safari bản mới.
  - Ảnh và video làm ngay trên máy người xem. Người tạo tắt được trong builder (nhóm "Khi người nhận xem", kịch bản lưu
    `receiverShare: false`).

## Cấu trúc thư mục

- `index.html` (trang chủ giới thiệu dịch vụ), `demo.html` (trình phát: màn trình diễn, link tặng `/demo?config=<tên>`;
  link cũ `index.html?config=...` tự chuyển sang), `builder.html`, `theo-doi.html`, `privacy.html`, `terms.html`: các
  trang (Vite build ra `dist/`).
- `src/assets/js/landing.js` + `src/assets/js/landing/`, `src/assets/scss/landing.scss`: trang chủ (banner ảnh tự chuyển,
  thanh chuyển mục dọc, xem thử trình phát trong khung, kịch bản mẫu, phiếu đặt làm riêng). Thông tin liên hệ (email,
  Zalo, Messenger) và video giới thiệu YouTube sửa trong `landing/content.js`; kịch bản mẫu, mục nổi bật sửa trong
  `src/static/configs/configs_index.json` (xem README trong thư mục đó). Ảnh banner `src/assets/img/landing/` là ảnh
  chụp thật từ trình phát (WebP 1920 và 1280 px).
- Logo, biểu tượng trang (`src/static/favicon.svg`, `favicon.ico`, `apple-touch-icon.png`, `icon-*.png`,
  `site.webmanifest`): dựng bằng `scripts/brand-icons.mjs` (đổi hình, màu ở đó rồi chạy `npm run icons`, cần Chrome).
  Ảnh xem trước mặc định khi chia sẻ link (`src/static/og-default.jpg`, tên Hanabi trên nền ảnh chụp thật): `npm run og-image`
  (`scripts/og-image.mjs`). Trình soạn kịch bản mang tên Hanabi Studio.
- `src/assets/js/script.js`: trình phát (cài đặt, menu, khung mở quà, hẹn giờ, khớp nhịp nhạc, dựng video, vòng lặp
  vẽ). Lõi pháo hoa tách trong `src/assets/js/player/`:
  - `env.js`, `state.js`: môi trường, hằng số, trạng thái dùng chung (cỡ sân khấu, chất lượng, tốc độ, cài đặt);
  - `particles.js` (hạt, tia lửa), `effects.js` (hiệu ứng nổ), `shapes.js` (pháo hình, chữ), `colors.js`;
  - `shell.js` (quả pháo), `shells.js` (các loại pháo), `launch-styles.js` (kiểu bắn), `image-burst.js` (pháo ảnh);
  - `smoke.js` (khói pháo: lớp canvas riêng dưới lớp pháo, độ phân giải thấp, có giới hạn số đám khói);
  - `glow.js` (quầng sáng quanh pháo: thu nhỏ lớp vệt sáng nhiều bậc rồi cộng sáng ngược lên, như máy quay thấy pháo
    thật);
  - `scenery.js` (mặt nước phản chiếu; bầu trời đêm: sao, trăng, đèn trời, khinh khí cầu, máy bay), `moon.js` (pha trăng
    theo ngày);
  - `audio.js` (tiếng pháo, nhạc nền), `start-frames.js` (khung mở quà), `captions.js` (lời nhắn), `utils.js`;
  - `clock.js` (đồng hồ của màn trình diễn: thật khi xem, giả lập khi dựng video).
- `src/assets/js/builder.js`: trình soạn; kèm `beat-sync.js` (xếp pháo theo nhịp), `timeline.js`, `timeline-track.js`
  (dòng thời gian theo giây), `templates.js` (mẫu theo dịp), `recorder.js` (ghép khung hình, mã hóa MP4, trộn tiếng),
  `video-export.js` (khung dựng video), `share-targets.js` (chia sẻ link lên mạng xã hội), `gift-tracking.js` (báo mở
  quà), `share-image.js` (ảnh khi chia sẻ). Trình phát dùng `viewer-share.js` (người nhận chụp khoảnh khắc, chia sẻ,
  tạo video) cùng các module video, chia sẻ này.
- `src/assets/scss/`: giao diện; `src/assets/audio/`, `src/assets/img/`: âm thanh, hình ảnh.
- `src/static/`: chép nguyên vào bản build: `api/` (PHP: lưu, chia sẻ, tải lên, báo mở quà), `configs/` (kịch bản).
- `src/static/library/`: kho nhạc (`music/`) và kho ảnh (`images/`) có sẵn trong builder; thêm bài, ảnh mới theo hướng dẫn
  trong `src/static/library/README.md`.
- `tests/e2e/`: kiểm thử tự động.

## Bản quyền & giấy phép

© 2026 **Vũ Hoài Nam**. Mọi quyền được bảo lưu – xem [LICENSE](LICENSE).

Đây **không phải** dự án mã nguồn mở. Mã nguồn được công khai để tham khảo và vận hành trang chính thức;
không được sao chép, đăng lại, triển khai thành trang/ứng dụng khác hay dùng cho mục đích thương mại khi chưa có
sự đồng ý của tác giả. Liên hệ xin phép: vuhoainam18032002@gmail.com

Lõi mô phỏng pháo hoa dựa trên **Firework Simulator v2** của Caleb Miller (giấy phép MIT); bản Việt hóa ban đầu
được chia sẻ bởi Jay Ramoliya. Danh sách đầy đủ các thành phần bên thứ ba và giấy phép của chúng:
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Chính sách bảo mật và điều khoản sử dụng của trang: `/privacy`, `/terms`.
