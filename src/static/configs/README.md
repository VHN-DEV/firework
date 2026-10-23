# 📁 Thư mục `configs/` — Lời Chúc Pháo Hoa

Thư mục này chứa các file JSON để **tùy biến lời chúc và hiệu ứng pháo hoa** theo từng kịch bản riêng.

---

## 🚀 Cách sử dụng nhanh

1. **Copy một file mẫu** trong thư mục này (ví dụ `birthday_nguyen_van.json`).
2. **Đổi tên** (ví dụ `my_show.json`).
3. **Sửa nội dung** JSON và lưu lại.
4. **Xem kết quả** bằng cách thêm tham số `?config=tên_file` vào URL:
   `http://localhost/firework/dist/demo?config=my_show`

---

## 📋 Cấu trúc file JSON

### 1. Thông tin chung
| Trường | Mô tả |
|--------|-------|
| `title` | Tiêu đề lớn hiển thị lúc mở màn. |
| `subtitle`| Dòng phụ bên dưới tiêu đề. |
| `author` | Tên người đạo diễn/người gửi. |
| `seoTitle` | (Tùy chọn) Tiêu đề hiện trên Facebook, Zalo, Messenger... khi gửi link. Để trống sẽ dùng `title`. |
| `seoDescription` | (Tùy chọn) Mô tả hiện khi gửi link, tối đa 200 ký tự. Để trống sẽ ghép `subtitle` – `author`. |
| `seoImage` | (Tùy chọn) Ảnh riêng làm ảnh khi chia sẻ (`./uploads/...`). Để trống sẽ dùng thiệp pháo hoa tự động. |
| `seoImageText` | (Tùy chọn) `false`: chỉ dùng ảnh, không chèn tiêu đề và lời chúc lên ảnh. |
| `seoImagePosition` | (Tùy chọn) Vị trí cắt ảnh cho vừa khung 1200×630, từ `0` (trên/trái) đến `100` (dưới/phải), mặc định `50`. |
| `loop` | `true`: Tự động lặp lại show; `false`: Chạy hết một lần rồi dừng. |
| `startFrame` | (Tùy chọn) Khung bắt đầu người xem thấy trước màn trình diễn: để trống là thiệp chào (lời mời + nút "Mở quà"), `"gift"` là hộp quà rung rinh, chạm vào thì bung nắp, nổ ruy băng và pháo giấy rồi mới bắt đầu. |
| `openAt` | (Tùy chọn) Hẹn giờ mở quà, dạng ISO (vd. `"2026-12-31T17:00:00.000Z"` là 0 giờ ngày 01/01/2027 giờ Việt Nam). Trước giờ này link hiện đồng hồ đếm ngược. |
| `reduceFlashing` | (Tùy chọn) `true`: giảm chớp sáng cho cả màn trình diễn (hạt không chớp tắt hay lấp lánh, không có quầng chớp lúc nổ, bầu trời không đổi màu theo pháo). Người xem cũng tự bật được bằng nút trên màn mở quà hoặc trong menu cài đặt. |
| `notifyOpen` | (Tùy chọn) `true`: báo cho người gửi khi người nhận mở link, bấm mở quà, xem hết (chỉ thời điểm và loại thiết bị; cần máy chủ PHP, xem `api/opens.php`). Người nhận thấy dòng "Người gửi sẽ biết khi bạn mở quà". |
| `openMode` | (Tùy chọn, đi cùng `openAt`) Để trống là khóa tới giờ rồi mới mở quà; `"countdown"` là đếm ngược rồi tự bắn: người xem bấm "Tôi đã sẵn sàng", 10 giây cuối hiện số lớn, đúng giờ pháo hoa tự bắn. |
| `recipient` | (Tùy chọn) Người nhận. Màn mở đầu hiện "Gửi <người nhận>" cùng hộp quà và nút "Mở quà" thay cho lời chào chung. |
| `introMessage` | (Tùy chọn) Lời mời mở quà ở màn mở đầu. Mặc định: "Một màn pháo hoa được làm riêng để dành tặng bạn." |
| `outroMessage` | (Tùy chọn) Lời chúc ở màn kết. Màn kết chỉ hiện khi `loop: false`, sau đợt cuối, kèm nút "Xem lại" và "Tạo màn pháo hoa của bạn". Để trống sẽ dùng `subtitle`. |
| `music` | (Tùy chọn) Nhạc nền, xem mục **🎵 Nhạc nền** bên dưới. |
| `effectsVolume` | (Tùy chọn) Âm lượng tiếng pháo từ `0` (tắt hẳn) đến `1` (mặc định). Giảm xuống để nghe rõ nhạc nền. |

### 2. Cấu trúc Event (Mỗi phát bắn)
Mỗi phần tử trong mảng `events` đại diện cho một phát bắn hoặc một dòng chữ.

| Thuộc tính | Kiểu dữ liệu | Mô tả |
|------------|--------------|-------|
| **`burst`** | Số | Số thứ tự đợt bắn (bắt đầu từ 1). |
| **`shell`** | Chuỗi | Loại pháo: `"Hoa cúc"`, `"Trái tim"`, `"Ngôi sao"`, `"Liễu"`, `"Văn bản"`, `"Tạm dừng"`... |
| **`text`** | Chuỗi | Nội dung chữ (chỉ dùng khi `shell`: `"Văn bản"`). |
| **`color`** | Chuỗi/Mảng | Màu pháo. Có thể dùng tên (`Red`, `Gold`), mã Hex (`#FF5733`), hoặc mảng màu `["Red", "Blue"]`. Dùng `"Ngẫu nhiên"` để đa sắc. |
| **`glitterColor`**| Chuỗi/Mảng | Màu của vệt sáng rủ xuống. Thường đặt `"Ngẫu nhiên"` để khớp với màu nhánh pháo. |
| **`x`**, **`y`** | Số | Vị trí nổ theo phần trăm màn hình (0 đến 100). `x`: 0 là mép trái; `y`: 0 là mặt đất, 100 là đỉnh. `x: 50, y: 50` là chính giữa màn hình. |
| **`delay`** | Số | Độ trễ (ms) tính từ lúc bắt đầu đợt bắn. |
| **`size`** | Số | Kích thước (0: 3" đến 5: 16"). |

---

## 🎵 Nhạc nền

```json
"music": { "url": "./uploads/music/sinh_nhat_me/bai-hat.mp3", "name": "Bài hát.mp3", "volume": 0.8, "start": 12.5 },
"effectsVolume": 0.5
```

| Trường | Mô tả |
|--------|-------|
| `url` | Đường dẫn file nhạc (MP3, M4A, OGG, WAV): file tải lên bằng builder (`./uploads/music/...`) hoặc link trực tiếp tới file nhạc. Link trang YouTube/Zing không dùng được. |
| `name` | Tên bài, chỉ để hiển thị trong builder. |
| `volume` | Âm lượng nhạc từ `0` đến `1` (mặc định `0.8`). |
| `start` | Phát từ giây thứ mấy của bài (bỏ qua đoạn dạo đầu). Mặc định `0`. |
| `sync` | (Tùy chọn) `true`: khớp nhịp nhạc. `delay` của mỗi phát là lúc pháo **nổ** (tính từ đầu đợt) thay vì lúc phóng: trình phát tự phóng sớm hơn đúng bằng thời gian bay và bám theo vị trí đang phát của bài nhạc. Bài nhạc phát một lượt, không lặp. Builder tự bật khi dùng "Xếp pháo theo nhịp nhạc". |
| `bpm` | (Tùy chọn) Nhịp của bài nhạc builder tìm được, chỉ để hiển thị. |

- Nhạc bắt đầu **cùng lúc với đợt pháo đầu tiên** và lặp lại suốt màn trình diễn. Kịch bản không lặp (`loop: false`)
  thì nhạc nhỏ dần rồi dừng khi chạy xong.
- Nhạc dừng theo nút tạm dừng / tắt âm thanh và khi người xem chuyển sang ứng dụng khác.
- Trên GitHub Pages builder không tải file lên được: chép file vào `src/static/uploads/music/` rồi dán đường dẫn
  `./uploads/music/ten-file.mp3`, hoặc dán link trực tiếp tới file nhạc ở nơi khác.

---

## ⭐ Kịch bản mẫu trên trang chủ

Mục "Kịch bản mẫu" và khung "Xem thử" của trang chủ (`index.html`) lấy danh sách từ `configs_index.json`, ảnh thẻ là
`<tên_file>.jpg` cạnh kịch bản. Mỗi mục có thể thêm:

| Trường | Mô tả |
|--------|-------|
| `featured` | `true`: kịch bản nổi bật, có nhãn "Nổi bật", thẻ lớn đứng đầu; tối đa 4 mục nổi bật đầu tiên thành thẻ chọn trong khung "Xem thử". |
| `category` | Nhóm để lọc (vd `"Sinh nhật"`, `"Lễ, Tết"`). Nhóm trùng tên dịp trong builder thì nút "Đặt mẫu này" chọn sẵn dịp đó trong phiếu đặt. |
| `description` | Mô tả ngắn trên thẻ. |
| `tags` | Tối đa 4 nhãn nhỏ trên thẻ, vd `["Mở quà", "Nhạc theo nhịp"]`. |
| `hero` | `true`: kịch bản mở bằng nút "Xem demo" ở trang chủ, đứng đầu khung "Xem thử". Chỉ đánh dấu một mục; không có thì dùng mục nổi bật đầu tiên. |

Thứ tự trên trang: các mục nổi bật trước, rồi tới các mục còn lại, giữ đúng thứ tự trong file.

---

## 🔗 Chia sẻ có ảnh & tiêu đề xem trước

- Link gửi tặng có dạng `.../s/<tên_file>` (link cũ có `.html` vẫn mở được): trang này chứa sẵn ảnh, tiêu đề, lời chúc để Facebook, Zalo,
  Messenger, Telegram... hiện khung xem trước, rồi tự mở màn trình diễn.
- Ảnh xem trước nằm cạnh kịch bản: `<tên_file>.jpg` (1200×630). Builder tự vẽ và lưu ảnh này khi bấm **Lưu**
  trên máy chủ có PHP. Kịch bản không có ảnh riêng sẽ dùng ảnh chung `og-default.jpg`.
- Trên GitHub Pages, các trang `s/<tên_file>` (file `s/*.html`) được tạo khi build cho mọi file `.json` trong thư mục này. Hãy thêm kịch bản
  mới vào `configs_index.json` để nó hiện trong mục "Mở kịch bản" của builder.
- Địa chỉ trang dùng trong thẻ xem trước được đặt bằng biến môi trường `SITE_URL` khi build
  (mặc định `https://vhn-dev.github.io/firework/`).
- Facebook/Zalo lưu tạm khung xem trước. Nếu đổi tiêu đề/ảnh sau khi đã gửi link, dùng
  [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/) để làm mới.

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
| **`launchStyle`** | chuỗi | Kiểu bắn (cách pháo bay lên), dùng được cho mọi loại pháo: `"straight"` bay thẳng, `"spiral"` xoắn đôi (hai vệt sáng quấn vào nhau), `"popping"` nổ dọc đường, `"stages"` bay nhiều tầng (chậm dần, nổ một chùm rồi vọt lên tầng tiếp), `"wander"` bay lượn, `"stealth"` đạn tàng hình (không thấy đường đạn, chỉ nghe tiếng phóng rồi pháo nổ). Để trống thì theo loại pháo (bay thẳng, riêng `"Xoắn ốc"` bay xoắn đôi). Kịch bản cũ dùng `spiralLift: true` vẫn chạy như `"spiral"`. |
| **`hang`** | bool | `true`: Hạt cháy lâu gấp 2,5 lần, lơ lửng rơi chậm và lấp lánh trước khi tàn (hợp với `"Trái tim"`, `"Văn bản"` để hình giữ lâu hơn). |
| **`starLife`** | số | Thời gian tồn tại của hạt pháo (ms). Để trống thì dùng mặc định của từng loại pháo. |
| **`starDensity`**| số | Hệ số mật độ hạt so với mặc định của loại pháo (`1` = giữ nguyên). Tăng lên (ví dụ `2`) để pháo dày hơn. |
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
  "x": 30,
  "y": 60
}
```

### 3. Ảnh trong khung trái tim
Pháo nổ thành viền trái tim, ảnh lớn dần và rõ dần bên trong, giữ 6 giây rồi tan thành tia lửa:
```json
{
  "burst": 4,
  "shell": "Hình ảnh",
  "imageUrl": "./uploads/sinh_nhat_me/anh-me.jpg",
  "frame": "heart",
  "color": "Red",
  "duration": 6000,
  "size": 1,
  "x": 50,
  "y": 60
}
```
- `frame`: `""` (không khung, giữ nguyên tỉ lệ ảnh), `"heart"` (trái tim), `"star"` (ngôi sao), `"circle"` (tròn),
  `"rounded"` (vuông bo góc), `"square"` (vuông), `"triangle"` (tam giác). Ảnh dọc/ngang được cắt giữa cho vừa khung, không bị méo.
- `color`: màu viền phát sáng của khung.
- `duration`: thời gian ảnh hiện trên trời (ms, mặc định `4500`). Muốn đợt sau chờ ảnh tan hết thì thêm phát `"Tạm dừng"`.
- `size`: `1` ≈ 500px, tự thu nhỏ cho vừa màn hình điện thoại.

### 4. Cơn Mưa Ngôi Sao (Dày đặc)
Dùng `starDensity` để tạo cơn mưa sao:
```json
{
  "burst": 3,
  "shell": "Ngôi sao",
  "color": "Gold",
  "starDensity": 3,
  "starLife": 5000,
  "x": 50,
  "y": 80
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
- `"Xoay vòng"` (Bánh xe lửa nhiều nan xoay tít quanh tâm)
- `"Xoắn ốc"` (Mặc định bay xoắn đôi, nổ thành thiên hà nhiều nhánh xoáy)
- `"Cháy lâu"` (Hạt cháy ~6 giây, lơ lửng rơi chậm, lấp lánh trước khi tàn)
- `"Hình ảnh"` (Cần có `imageUrl`, xem ví dụ 3)
- `"Lời nhắn"` (Không bắn pháo: hiện một dòng chữ như phụ đề đúng lúc với pháo và nhạc. `text` nội dung (xuống dòng bằng `\n`),
  `duration` thời gian hiện (ms, mặc định `4000`), `position` `"bottom"` (mặc định) / `"middle"` / `"top"`,
  `effect` `"type"` để gõ từng chữ, `textSize` `"large"` cho chữ lớn, `color` màu chữ, `delay` lúc hiện trong đợt)
- `"Tạm dừng"` (Dùng kèm `duration` tính bằng ms, mặc định `2000`)
