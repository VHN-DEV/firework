# 📁 Thư mục `configs/` — Lời Chúc Pháo Hoa

Thư mục này chứa các file JSON để **custom lời chúc theo từng đợt bắn pháo hoa**.

---

## 🚀 Cách sử dụng

1. **Copy một file mẫu** trong thư mục này (ví dụ `birthday_nguyen_van.json`)
2. **Đổi tên** thành tên người được chúc (ví dụ `birthday_lan.json`)
3. **Sửa nội dung** JSON theo ý muốn
4. **Gửi link** cho người được chúc:
   ```
   http://localhost/firework/?config=birthday_lan
   ```
   Hoặc nếu deploy lên web:
   ```
   https://yourdomain.com/firework/?config=birthday_lan
   ```

---

## 📋 Cấu trúc file JSON

```json
{
  "title": "Tiêu đề hiển thị trên màn hình",
  "subtitle": "Dòng phụ (tùy chọn)",
  "author": "Từ: Tên người gửi",
  "loop": true,
  "events": [
    {
      "burst": 1,
      "text": "CHÚC MỪNG",
      "shell": "Văn bản",
      "color": "Gold",
      "x": 0.5,
      "y": 0.5
    },
    {
      "burst": 2,
      "shell": "Trái tim",
      "color": "Ngẫu nhiên",
      "glitterColor": "Ngẫu nhiên"
    }
  ]
}
```

### Giải thích các trường chính:

| Trường | Bắt buộc | Mô tả |
|--------|----------|-------|
| `title` | Không | Tiêu đề hiển thị lúc đầu |
| `subtitle` | Không | Dòng phụ bên dưới title |
| `author` | Không | Tên người gửi lời chúc |
| `loop` | Không | `true` = lặp lại sau khi hết events, `false` = chạy 1 lần rồi random |
| `events` | **Có** | Danh sách các đợt bắn đặc biệt |

### Cấu trúc nâng cao cho mỗi event:

| Trường | Kiểu | Mô tả |
|--------|------|-------|
| `burst` | Số | Đợt bắn (bắt đầu từ 1) |
| `shell` | Chuỗi | Loại pháo hoa (xem danh sách bên dưới) |
| `text` | Chuỗi | Nội dung chữ (khi shell = "Văn bản") |
| `color` | Chuỗi | Màu chính: `Red`, `Green`, `Blue`, `Purple`, `Gold`, `White`, `Ngẫu nhiên` |
| `glitterColor`| Chuỗi | Màu của vệt sáng rủ xuống: (Giống danh sách màu ở trên) |
| `x` | Số | Vị trí ngang (0.1 - 0.9). 0.5 là chính giữa. |
| `y` | Số | Vị trí cao (0.1 - 0.9). 0.2 là rất cao, 0.8 là thấp. |
| `delay` | Số | Thời gian trễ (ms) so với bắt đầu đợt bắn. |
| `size` | Số | Kích thước pháo (0: 3", 1: 4", 2: 6", 3: 8", 4: 12", 5: 16") |
| `duration` | Số | Thời gian nghỉ (ms) khi dùng shell = "Tạm dừng" |

---

## 🎆 Các loại `shell` (Loại pháo)

| Giá trị | Mô tả |
|---------|-------|
| `"Văn bản"` | Hiển thị chữ (cần có `text`) |
| `"Trái tim"` | Pháo hình trái tim ❤️ |
| `"Ngôi sao"` | Pháo hình ngôi sao ⭐ |
| `"Mặt cười"` | Pháo mặt cười 😊 |
| `"Mặt mèo"` | Pháo mặt mèo 🐱 |
| `"Hoa cúc"` | Pháo hoa cúc truyền thống |
| `"Vòng nhẫn"` | Pháo hình vòng tròn |
| `"Liễu"` | Pháo liễu rủ (đẹp nhất khi kèm màu Ngẫu nhiên) |
| `"Kim cương"` | Pháo hình kim cương 💎 |
| `"Bông tuyết"`| Pháo hình bông tuyết ❄️ |
| `"Bông sen"` | Pháo hình hoa sen 🪷 |
| `"Hành tinh"` | Pháo hình hành tinh (Thổ tinh) 🪐 |
| `"Tạm dừng"` | Nghỉ một khoảng thời gian (dùng `duration`) |

---

## 💡 Mẹo và Kỹ thuật nâng cao

1. **Hiệu ứng Đa sắc (Rainbow):**
   Để pháo có mỗi nhánh một màu khác nhau, hãy đặt:
   `"color": "Ngẫu nhiên", "glitterColor": "Ngẫu nhiên"`
   Cách này hoạt động cực đẹp với pháo loại `"Liễu"`, `"Trái tim"`, `"Ngôi sao"`.

2. **Xếp chữ nhiều dòng:**
   Bạn có thể tạo nhiều event trong cùng 1 `burst` với các tọa độ `y` khác nhau và `delay` khác nhau.

3. **Pháo nổ đồng thời:**
   Đặt nhiều event có cùng số `burst` và cùng `delay` nhưng khác vị trí `x`.

4. **Tự động cập nhật năm:**
   Dùng `[YEAR]` trong chuỗi `text` để tự động hiển thị năm hiện tại.
   Ví dụ: `"text": "CHÚC MỪNG NĂM [YEAR]"`

---

## 📁 Các file mẫu
- `birthday_nguyen_van.json`: Mẫu sinh nhật chuyên sâu với finale.
- `national_day_vn.json`: Mẫu ngày Quốc khánh với cờ đỏ sao vàng.
- `tet_holiday.json`: Mẫu Tết Nguyên Đán.
