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

## Hướng dẫn sử dụng

Khi bạn đã mở dự án trên trình duyệt, đây là các thao tác và tính năng chính:

- **Tự do tương tác**: Bạn có thể nhấp chuột hoặc chạm (trên màn hình cảm ứng) vào bất cứ đâu trên màn hình bầu trời đêm để tự bắn một quả pháo hoa.
- **Menu Cài Đặt (Settings)**: Bấm vào nút hình bánh răng ⚙️ ở góc trên bên phải màn hình để tuỳ chỉnh các thông số:
  - **Loại pháo**: Lựa chọn hình dạng nổ của pháo hoa (Trái tim, Ngôi sao, Mặt mèo, Văn bản, v.v.).
  - **Văn bản**: Nếu chọn loại pháo là "Văn bản", bạn có thể nhập tên hoặc lời chúc. Bạn có thể nhập nhiều văn bản ngăn cách bởi dấu phẩy (ví dụ: `Chúc mừng, Năm mới, Hạnh phúc`) để pháo hoa hiển thị ngẫu nhiên các từ này.
  - **Kích thước pháo**: Điều chỉnh độ lớn của pháo (nên hạ thấp kích thước trên thiết bị yếu nếu gặp giật lag).
  - **Chất lượng**: Độ phân giải số lượng tia lửa hiển thị.
  - **Âm lượng**: Bật/tắt âm thanh bằng biểu tượng loa 🔈 ở thanh điều khiển trên cùng.
  - **Tự động bắn**: Để máy tự động tạo ra một màn trình diễn pháo hoa liên tục (mặc định luôn bật).
  - **Hiển thị nền**: Bật/tắt hình nền phong cảnh thành phố để màn trình diễn thêm lung linh.
  - **Chế độ kết thúc (Finale Mode)**: Bắn một loạt pháo hoa liên tiếp dữ dội để làm màn kết ấn tượng.
  - **Mở màn trập (Open Shutter)**: Mô phỏng hiệu ứng chụp ảnh phơi sáng với vệt sáng pháo hoa kéo dài.
  - **Toàn màn hình**: Tận hưởng pháo hoa ở chế độ màn hình rộng.

## Cấu trúc thư mục

- `index.html` - Tập tin chính của ứng dụng.
- `assets/styles/style.css` - Chứa các định dạng kiểu dáng và font chữ cho giao diện người dùng.
- `assets/scripts/script.js` - Chứa toàn bộ mã logic mô phỏng động lực học và vẽ pháo hoa.
- `assets/` - Chứa các tài nguyên hình ảnh (`images/`), phông chữ, CSS (`styles/`) và các tập lệnh (`scripts/`) bổ sung.

## Bản quyền & giấy phép

© 2026 **Vũ Hoài Nam**. Mọi quyền được bảo lưu – xem [LICENSE](LICENSE).

Đây **không phải** dự án mã nguồn mở. Mã nguồn được công khai để tham khảo và vận hành trang chính thức;
không được sao chép, đăng lại, triển khai thành trang/ứng dụng khác hay dùng cho mục đích thương mại khi chưa có
sự đồng ý của tác giả. Liên hệ xin phép: vuhoainam18032002@gmail.com

Lõi mô phỏng pháo hoa dựa trên **Firework Simulator v2** của Caleb Miller (giấy phép MIT); bản Việt hóa ban đầu
được chia sẻ bởi Jay Ramoliya. Danh sách đầy đủ các thành phần bên thứ ba và giấy phép của chúng:
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Chính sách bảo mật và điều khoản sử dụng của trang: `privacy.html`, `terms.html`.
