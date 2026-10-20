# Thành phần bên thứ ba

Dự án **Trình diễn Pháo hoa** (© 2026 Vũ Hoài Nam, xem [LICENSE](LICENSE)) sử dụng các thành phần dưới đây.
Mỗi thành phần thuộc quyền của tác giả tương ứng và tuân theo giấy phép riêng của nó, **không** thuộc
phạm vi giấy phép độc quyền của dự án.

| Thành phần | Tác giả | Giấy phép | Vị trí trong dự án |
|---|---|---|---|
| Firework Simulator v2 (lõi mô phỏng pháo hoa, Stage.js, Ticker.js, MyMath.js, âm thanh gốc) | Caleb Miller – [bản gốc trên CodePen](https://codepen.io/MillerTime/pen/XgpNwb) | MIT | `src/assets/js/script.js` (phần lõi, đã chỉnh sửa và mở rộng), `src/assets/js/Stage@0.1.4.js`, `src/assets/js/MyMath.js`, `src/assets/scss/style.scss` (phần gốc), `src/assets/audio/lift/lift1-3.mp3`, `src/assets/audio/burst/burst1-2.mp3`, `burst-sm-*.mp3`, `crackle1.mp3`, `crackle-sm-1.mp3` |
| Fscreen 1.0.1 | Rafael Pedicini – [github.com/rafrex/fscreen](https://github.com/rafrex/fscreen) | MIT | `src/assets/js/fscreen@1.0.1.js` |
| qrcode-generator | Kazuhiko Arase – [github.com/kazuhikoarase/qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) | MIT | thư viện npm, tạo mã QR trong builder |
| Font Awesome Free 6.5.1 | Fonticons, Inc. – [fontawesome.com](https://fontawesome.com) | Biểu tượng: CC BY 4.0 · Font: SIL OFL 1.1 · Mã: MIT | tải từ cdnjs trong builder |
| Phông chữ Inter, Outfit, Roboto | Các tác giả trên [Google Fonts](https://fonts.google.com) | SIL OFL 1.1 / Apache 2.0 | tải từ Google Fonts |
| Hiệu ứng âm thanh bổ sung | [BigSoundBank](https://bigsoundbank.com), [Pixabay](https://pixabay.com/sound-effects/) | Theo giấy phép của từng trang | `src/assets/audio/lift/lift-wick-*.mp3`, `lift-whoosh-*.mp3`, `src/assets/audio/whistle/*`, `src/assets/audio/burst/burst-out.mp3` |

Bản Việt hóa ban đầu của trình mô phỏng được chia sẻ bởi Jay Ramoliya.

## Giấy phép MIT – Firework Simulator v2

```
Copyright (c) Caleb Miller

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

Fscreen và qrcode-generator dùng cùng nội dung giấy phép MIT ở trên, với dòng bản quyền của tác giả tương ứng
(xem trong mã nguồn của từng thư viện).
