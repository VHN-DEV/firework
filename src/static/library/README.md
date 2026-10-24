# Kho nhạc và kho ảnh có sẵn

Builder hiện các file trong thư mục này ở nút **"Chọn từ kho nhạc"** (mục Nhạc nền) và **"Chọn từ kho ảnh"**
(pháo Hình ảnh), dành cho người chưa có file nhạc, file ảnh của riêng mình.

## Thêm bài nhạc

1. Chép file `.mp3` vào `music/`. Nên dùng MP3 bitrate cố định 128–192 kbps, dài 1–3 phút, âm lượng tương đương các
   bài có sẵn.
2. Thêm một mục vào `music/index.json`:

   ```json
   {
     "id": "ten-bai",
     "file": "ten-bai.mp3",
     "name": "Tên bài",
     "artist": "Tác giả · Người trình bày",
     "duration": 120,
     "tags": ["Sinh nhật", "Vui tươi"],
     "license": "Phạm vi công cộng",
     "source": "https://... (trang gốc của bản thu)"
   }
   ```

   `tags` là các nhãn để lọc (dịp, tâm trạng). Chỉ đưa vào bài mình có quyền dùng và phân phối lại, và ghi nguồn,
   giấy phép vào `THIRD_PARTY_NOTICES.md` ở thư mục gốc.

## Thêm ảnh

1. Chép ảnh `.jpg` / `.png` / `.webp` vào `images/`. Nên dùng ảnh vuông khoảng 1024×1024, nội dung chính ở giữa
   (pháo ảnh có thể cắt theo khung tròn, trái tim, ngôi sao...).
2. Thêm một mục vào `images/index.json`: `{ "id": "ten-anh", "file": "ten-anh.jpg", "name": "Tên ảnh", "tags": ["Dịp"] }`.

Sau khi thêm: `npm run build` (XAMPP) hoặc commit để GitHub Actions build lại.

Bản chạy trên Cloudflare: thêm, đổi tên, ẩn bài nhạc, ảnh ngay ở trang quản trị `/admin` (mục Kho nhạc, Kho ảnh), không cần
build lại. Bài, ảnh thêm ở đó lưu trên Cloudflare (KV/R2, bảng `library` của D1), không nằm trong thư mục này.
