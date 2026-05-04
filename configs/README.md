# 📁 Thư mục `configs/` — Lời Chúc Pháo Hoa

Thư mục này chứa các file JSON để **custom lời chúc theo từng đợt bắn pháo hoa**.

---

## 🚀 Cách sử dụng

1. **Copy một file mẫu** trong thư mục này (ví dụ `birthday_template.json`)
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
      "shell": "Văn bản"
    },
    {
      "burst": 2,
      "shell": "Trái tim"
    }
  ]
}
```

### Giải thích các trường:

| Trường | Bắt buộc | Mô tả |
|--------|----------|-------|
| `title` | Không | Tiêu đề hiển thị lúc đầu |
| `subtitle` | Không | Dòng phụ bên dưới title |
| `author` | Không | Tên người gửi lời chúc |
| `loop` | Không | `true` = lặp lại sau khi hết events, `false` = chạy 1 lần rồi random |
| `events` | **Có** | Danh sách các đợt bắn đặc biệt |

### Cấu trúc mỗi event:

| Trường | Bắt buộc | Mô tả |
|--------|----------|-------|
| `burst` | **Có** | Số thứ tự đợt bắn (bắt đầu từ 1) |
| `text` | Khi shell = "Văn bản" | Nội dung chữ sẽ hiển thị |
| `shell` | **Có** | Loại pháo hoa |
| `note` | Không | Ghi chú cho bản thân, không hiển thị |

---

## 🎆 Các loại `shell` có thể dùng

| Giá trị | Mô tả |
|---------|-------|
| `"Văn bản"` | Hiển thị chữ (cần có `text`) |
| `"Trái tim"` | Pháo hình trái tim ❤️ |
| `"Ngôi sao"` | Pháo hình ngôi sao ⭐ |
| `"Mặt cười"` | Pháo mặt cười 😊 |
| `"Mặt mèo"` | Pháo mặt mèo 🐱 |
| `"Hoa cúc"` | Pháo hoa cúc truyền thống |
| `"Vòng nhẫn"` | Pháo hình vòng tròn |
| `"Ngẫu nhiên"` | Ngẫu nhiên loại pháo |

---

## 📁 Các file mẫu có sẵn

| File | Dùng cho |
|------|---------|
| `birthday_template.json` | Chúc mừng sinh nhật (10 đợt, có loop) |
| `example_newyear.json` | Chúc mừng năm mới (8 đợt, có loop) |
| `example_custom.json` | Lời nhắn tùy chỉnh (7 đợt, không loop) |

---

## 💡 Mẹo hay

- Dùng `"burst"` không liền nhau (ví dụ 1, 3, 5, 7) để xen kẽ pháo ngẫu nhiên giữa các đợt đặc biệt.
- Đặt `"loop": true` để lời chúc lặp lại liên tục.
- Có thể viết tiếng Việt có dấu trong `"text"`.
- Trường `"note"` dùng để ghi chú khi chỉnh sửa, không ảnh hưởng gì.
