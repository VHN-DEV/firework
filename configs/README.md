# 📁 Thư mục `configs/` — Lời Chúc Pháo Hoa

Thư mục này chứa các file JSON để **tùy biến lời chúc và hiệu ứng pháo hoa** theo từng kịch bản riêng.

---

## 🚀 Cách sử dụng nhanh

1. **Copy một file mẫu** trong thư mục này (ví dụ `birthday_nguyen_van.json`).
2. **Đổi tên** (ví dụ `my_show.json`).
3. **Sửa nội dung** JSON và lưu lại.
4. **Xem kết quả** bằng cách thêm tham số `?config=tên_file` vào URL:
   `http://localhost/firework/?config=my_show`

---

## 📋 Cấu trúc file JSON

### 1. Thông tin chung
| Trường | Mô tả |
|--------|-------|
| `title` | Tiêu đề lớn hiển thị lúc mở màn. |
| `subtitle`| Dòng phụ bên dưới tiêu đề. |
| `author` | Tên người đạo diễn/người gửi. |
| `loop` | `true`: Tự động lặp lại show; `false`: Chạy xong sẽ chuyển sang chế độ pháo ngẫu nhiên. |

### 2. Cấu trúc Event (Mỗi phát bắn)
Mỗi phần tử trong mảng `events` đại diện cho một phát bắn hoặc một dòng chữ.

| Thuộc tính | Kiểu dữ liệu | Mô tả |
|------------|--------------|-------|
| **`burst`** | Số | Số thứ tự đợt bắn (bắt đầu từ 1). |
| **`shell`** | Chuỗi | Loại pháo: `"Hoa cúc"`, `"Trái tim"`, `"Ngôi sao"`, `"Liễu"`, `"Văn bản"`, `"Tạm dừng"`... |
| **`text`** | Chuỗi | Nội dung chữ (chỉ dùng khi `shell`: `"Văn bản"`). |
| **`color`** | Chuỗi/Mảng | Màu pháo. Có thể dùng tên (`Red`, `Gold`), mã Hex (`#FF5733`), hoặc mảng màu `["Red", "Blue"]`. Dùng `"Ngẫu nhiên"` để đa sắc. |
| **`glitterColor`**| Chuỗi/Mảng | Màu của vệt sáng rủ xuống. Thường đặt `"Ngẫu nhiên"` để khớp với màu nhánh pháo. |
| **`x`**, **`y`** | Số | Vị trí (0.1 đến 0.9). `x: 0.5, y: 0.5` là ở chính giữa màn hình. |
| **`delay`** | Số | Độ trễ (ms) tính từ lúc bắt đầu đợt bắn. |
| **`size`** | Số | Kích thước (0: 3" đến 5: 16"). |

---

## 🛠️ Tùy biến Hiệu ứng Nâng cao (Siêu cấp)
Bạn có thể thêm các thuộc tính này vào bất kỳ loại pháo nào để tạo ra hiệu ứng độc lạ:

| Thuộc tính | Kiểu | Hiệu ứng |
|------------|------|----------|
| **`strobe`** | bool | `true`: Làm hạt pháo nhấp nháy, lấp lánh như kim cương. |
| **`crackle`** | bool | `true`: Thêm tiếng nổ và hiệu ứng lách tách li ti khi pháo tan. |
| **`crossette`**| bool | `true`: Các hạt pháo tự tách làm 4 nhánh nhỏ khi nổ. |
| **`pistil`** | bool | `true`: Thêm một tâm pháo (nhụy) ở giữa vụ nổ. |
| **`pistilColor`**| chuỗi | Màu của tâm pháo (ví dụ: `"White"`). |
| **`streamers`**| bool | `true`: Tạo các dải sáng dài vút ra ngoài. |
| **`horsetail`**| bool | `true`: Hiệu ứng đuôi ngựa rủ xuống từ từ. |
| **`starLife`** | số | Thời gian tồn tại của hạt pháo (ms). Mặc định khoảng 2500-3000. |
| **`starDensity`**| số | Mật độ hạt pháo. Tăng lên (ví dụ `2`) để pháo dày hơn. |
| **`spreadSize`**| số | Độ rộng của vòng nổ. |

---

## 💡 Ví dụ thực tế

### 1. Pháo Liễu Đa Sắc (Cực đẹp)
Mỗi nhánh một màu khác nhau, rủ xuống lấp lánh:
```json
{
  "burst": 1,
  "shell": "Liễu",
  "color": "Ngẫu nhiên",
  "glitterColor": "Ngẫu nhiên",
  "strobe": true,
  "size": 4
}
```

### 2. Trái Tim Lách Tách (Có nhụy trắng)
Trái tim màu đỏ, có tâm màu trắng và nổ lách tách:
```json
{
  "burst": 2,
  "shell": "Trái tim",
  "color": "Red",
  "pistil": true,
  "pistilColor": "White",
  "crackle": true,
  "x": 0.3,
  "y": 0.4
}
```

### 3. Cơn Mưa Ngôi Sao (Dày đặc)
Dùng `starDensity` để tạo cơn mưa sao:
```json
{
  "burst": 3,
  "shell": "Ngôi sao",
  "color": "Gold",
  "starDensity": 3,
  "starLife": 5000,
  "x": 0.5,
  "y": 0.2
}
```

---

## 🎇 Danh sách các loại `shell` có sẵn
- `"Văn bản"` (Cần có `text`)
- `"Hoa cúc"` (Cơ bản)
- `"Liễu"` (Rủ xuống)
- `"Trái tim"`, `"Ngôi sao"`, `"Kim cương"`, `"Bông tuyết"`
- `"Mặt cười"`, `"Mặt mèo"`, `"Bông sen"`, `"Hành tinh"`
- `"Vòng nhẫn"`, `"Nổ chéo"`, `"Cây cọ"`, `"Ma"`, `"Đuôi ngựa"`
- `"Tạm dừng"` (Dùng kèm `duration`)
