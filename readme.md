# Trình mô phỏng Pháo hoa

Đây là một dự án Trình mô phỏng Pháo hoa (Firework Simulator) tuyệt đẹp chạy trực tiếp trên nền tảng Web (HTML5/Canvas), cho phép bạn tạo và tùy chỉnh các hiệu ứng pháo hoa một cách sinh động, mượt mà và chân thực.

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
   - **Cách 1**: Mở trực tiếp tệp `index.html` bằng bất kỳ trình duyệt web nào (Chrome, Firefox, Edge, Safari...).
   - **Cách 2**: Sử dụng các công cụ Live Server (như tiện ích Live Server của VS Code) để khởi chạy máy chủ web cục bộ và trải nghiệm mượt mà hơn.

## Kiểm thử & triển khai

- `npm run build`: build vào thư mục `dist` (chạy trên XAMPP tại `http://localhost/firework/dist/`).
- `npm test`: build rồi chạy kiểm thử tự động (hơn 60 bước: trình phát, link tặng, hộp quà, hẹn giờ, nhạc nền, lời nhắn,
  màn kết, mọi loại pháo và kiểu bắn, builder lưu/mở/chia sẻ, dòng thời gian theo giây, hoàn tác và bản nháp, xếp pháo
  theo nhịp nhạc với bài nhạc biết trước đáp án, xuất video có hình và tiếng, báo mở quà, trang Điều khoản/Bảo mật).
  Cần PHP (lệnh `php`, hoặc biến `PHP_BIN`) và Google Chrome (biến `CHROME_PATH` nếu không ở chỗ mặc định).
  `npm run test:e2e` chạy kiểm thử trên bản build sẵn có.
- Mỗi lần push lên `main`, GitHub Actions (`.github/workflows/deploy.yml`) tự cài thư viện, build, chạy kiểm thử;
  đạt hết mới triển khai lên GitHub Pages. Pull request chỉ được kiểm thử, không triển khai.
- Thư mục `dist` và `node_modules` không còn đưa lên git. Kịch bản lưu bằng builder trên XAMPP nằm trong `dist/configs`
  (và ảnh, nhạc trong `dist/uploads`): muốn giữ lâu dài hoặc đưa lên GitHub Pages thì chép sang `src/static/configs`
  (và `src/static/uploads`) rồi commit.
- **Báo mở quà** (cần máy chủ PHP): mã theo dõi và lịch sử mở quà nằm trong `api/data/` (file JSON, các hàm đọc/ghi gom
  trong `api/tracking.inc.php` để sau này chuyển sang cơ sở dữ liệu). Thư mục này cần quyền ghi và phải chặn tải trực
  tiếp: Apache dùng sẵn `api/data/.htaccess`; Nginx cần thêm `location ^~ /api/data/ { deny all; }`. Khi triển khai bản
  mới, đừng xóa `api/data/` (và `configs/`, `uploads/`) trên máy chủ.

## Hướng dẫn sử dụng

Khi bạn đã mở dự án trên trình duyệt, đây là các thao tác và tính năng chính:

- **Tự do tương tác**: Bạn có thể nhấp chuột hoặc chạm (trên màn hình cảm ứng) vào bất cứ đâu trên màn hình bầu trời đêm để tự bắn một quả pháo hoa.
- **Tạo màn trình diễn riêng**: Mở trình soạn kịch bản (`builder.html`, nút "Tạo kịch bản pháo hoa") để chọn loại pháo, chữ trên trời, nhạc nền (tự tải lên hoặc chọn từ kho nhạc có sẵn), ảnh (kho ảnh), lời chúc, khói pháo (Tắt / Nhẹ / Dày), mặt nước phản chiếu, bầu trời đêm (sao, trăng đúng pha, đèn trời,
  khinh khí cầu, máy bay) rồi chia sẻ link.
- **Cài đặt** (nút bánh răng ⚙️ ở góc trên bên phải, hoặc phím `O`): chỉ gồm các tùy chọn khi xem, mỗi mục có nút "?" giải thích:
  - **Chất lượng**: Thấp / Vừa / Cao (hạ xuống nếu máy bị giật).
  - **Ánh sáng bầu trời**: Tắt / Mờ / Bình thường.
  - **Thu phóng**: phóng to hay thu nhỏ toàn bộ pháo hoa.
  - **Toàn màn hình**, **Giảm chớp sáng** (cho người nhạy cảm với ánh sáng nhấp nháy), **Ẩn nút điều khiển**.
- **Âm lượng**: Bật/tắt âm thanh bằng biểu tượng loa 🔈 ở thanh điều khiển trên cùng.

## Cấu trúc thư mục

- `index.html`, `builder.html`, `theo-doi.html`, `privacy.html`, `terms.html`: các trang (Vite build ra `dist/`).
- `src/assets/js/script.js`: trình phát (cài đặt, menu, khung mở quà, hẹn giờ, khớp nhịp nhạc, quay video, vòng lặp
  vẽ). Lõi pháo hoa tách trong `src/assets/js/player/`:
  - `env.js`, `state.js`: môi trường, hằng số, trạng thái dùng chung (cỡ sân khấu, chất lượng, tốc độ, cài đặt);
  - `particles.js` (hạt, tia lửa), `effects.js` (hiệu ứng nổ), `shapes.js` (pháo hình, chữ), `colors.js`;
  - `shell.js` (quả pháo), `shells.js` (các loại pháo), `launch-styles.js` (kiểu bắn), `image-burst.js` (pháo ảnh);
  - `smoke.js` (khói pháo: lớp canvas riêng dưới lớp pháo, độ phân giải thấp, có giới hạn số đám khói);
  - `scenery.js` (mặt nước phản chiếu; bầu trời đêm: sao, trăng, đèn trời, khinh khí cầu, máy bay), `moon.js` (pha trăng
    theo ngày);
  - `audio.js` (tiếng pháo, nhạc nền), `start-frames.js` (khung mở quà), `captions.js` (lời nhắn), `utils.js`.
- `src/assets/js/builder.js`: trình soạn; kèm `beat-sync.js` (xếp pháo theo nhịp), `timeline.js`, `timeline-track.js`
  (dòng thời gian theo giây), `templates.js` (mẫu theo dịp), `recorder.js` (quay video), `gift-tracking.js` (báo mở
  quà), `share-image.js` (ảnh khi chia sẻ).
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

Chính sách bảo mật và điều khoản sử dụng của trang: `privacy.html`, `terms.html`.
