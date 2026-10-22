# Thành phần bên thứ ba

Dự án **Trình diễn Pháo hoa** (© 2026 Vũ Hoài Nam, xem [LICENSE](LICENSE)) sử dụng các thành phần dưới đây.
Mỗi thành phần thuộc quyền của tác giả tương ứng và tuân theo giấy phép riêng của nó, **không** thuộc
phạm vi giấy phép độc quyền của dự án.

| Thành phần | Tác giả | Giấy phép | Vị trí trong dự án |
|---|---|---|---|
| Firework Simulator v2 (lõi mô phỏng pháo hoa, Stage.js, Ticker.js, MyMath.js, âm thanh gốc) | Caleb Miller – [bản gốc trên CodePen](https://codepen.io/MillerTime/pen/XgpNwb) | MIT | `src/assets/js/script.js` (phần lõi, đã chỉnh sửa và mở rộng), `src/assets/js/Stage@0.1.4.js`, `src/assets/js/MyMath.js`, `src/assets/scss/style.scss` (phần gốc), `src/assets/audio/lift/lift1-3.mp3`, `src/assets/audio/burst/burst1-2.mp3`, `burst-sm-*.mp3`, `crackle1.mp3`, `crackle-sm-1.mp3` |
| Fscreen 1.0.1 | Rafael Pedicini – [github.com/rafrex/fscreen](https://github.com/rafrex/fscreen) | MIT | `src/assets/js/fscreen@1.0.1.js` |
| qrcode-generator | Kazuhiko Arase – [github.com/kazuhikoarase/qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) | MIT | thư viện npm, tạo mã QR trong builder |
| mp4-muxer | Vanilagy – [github.com/Vanilagy/mp4-muxer](https://github.com/Vanilagy/mp4-muxer) | MIT | thư viện npm, ghép hình và tiếng thành file MP4 khi tạo video |
| country-flag-emoji-polyfill (kèm phông Twemoji Country Flags) | TalkJS – [github.com/talkjs/country-flag-emoji-polyfill](https://github.com/talkjs/country-flag-emoji-polyfill); hình cờ từ [Twemoji](https://github.com/twitter/twemoji) © Twitter, Inc. và các cộng tác viên | Mã: MIT · Hình cờ: CC BY 4.0 | thư viện npm, hiện cờ quốc gia trên máy thiếu cờ (Windows) trong builder và trình phát |
| Font Awesome Free 6.5.1 | Fonticons, Inc. – [fontawesome.com](https://fontawesome.com) | Biểu tượng: CC BY 4.0 · Font: SIL OFL 1.1 · Mã: MIT | tải từ cdnjs trong builder và bảng chia sẻ của trang xem |
| Phông chữ Inter, Outfit, Roboto | Các tác giả trên [Google Fonts](https://fonts.google.com) | SIL OFL 1.1 / Apache 2.0 | tải từ Google Fonts |
| Hiệu ứng âm thanh bổ sung | [BigSoundBank](https://bigsoundbank.com), [Pixabay](https://pixabay.com/sound-effects/) | Theo giấy phép của từng trang | `src/assets/audio/lift/lift-wick-*.mp3`, `lift-whoosh-*.mp3`, `src/assets/audio/whistle/*`, `src/assets/audio/burst/burst-out.mp3` |
| Kho nhạc: Pomp and Circumstance March No. 1 (đoạn Trio) | Edward Elgar · United States Marine Band – [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:ELGAR_Pomp_and_Circumstance_in_D,_Opus_39,_No._1_-_United_States_Marine_Band.mp3) | Phạm vi công cộng (bản nhạc: tác giả mất năm 1934; bản thu: tác phẩm của chính phủ liên bang Hoa Kỳ) | `src/static/library/music/pomp-and-circumstance-trio.mp3` |
| Kho nhạc: Happy Birthday to You | Pracchia-78 – [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Happy_Birthday_to_You.ogg) | Phạm vi công cộng (tác giả tự nguyện từ bỏ quyền) | `src/static/library/music/happy-birthday.mp3` |
| Kho nhạc: Radetzky March | Johann Strauss I · United States Marine Band – [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:USMC_Band_-_Radetzky_March.mp3) | Phạm vi công cộng (tác phẩm của chính phủ liên bang Hoa Kỳ) | `src/static/library/music/radetzky-march.mp3` |
| Kho nhạc: Auld Lang Syne | United States Marine Band – [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:%22Auld_Lang_Syne%22_performed_by_the_United_States_Marine_Band.mp3) | Phạm vi công cộng (tác phẩm của chính phủ liên bang Hoa Kỳ) | `src/static/library/music/auld-lang-syne.mp3` |
| Kho nhạc: Wedding March (đoạn 0:00–2:00) | John Philip Sousa · United States Marine Band – [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Sousa%27s_%22Wedding_March%22_-_United_States_Marine_Band_(2019).mp3) | Phạm vi công cộng (tác phẩm của chính phủ liên bang Hoa Kỳ) | `src/static/library/music/wedding-march.mp3` |
| Kho nhạc: Clair de Lune (đoạn 0:00–2:31) | Claude Debussy · U.S. Air Force Band of Flight (Wright Brass) – [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Clair_de_Lune_-_Wright_Brass_-_United_States_Air_Force_Band_of_Flight.mp3) | Phạm vi công cộng (tác phẩm của chính phủ liên bang Hoa Kỳ) | `src/static/library/music/clair-de-lune.mp3` |
| Kho nhạc: Jingle Bells | U.S. Air Force Band of Mid-America (Starlifter and Roots in Blue) – [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Jingle_Bells_(2020)_-_Starlifter_and_Roots_in_Blue_-_United_States_Air_Force_Band_of_Mid-America.mp3) | Phạm vi công cộng (tác phẩm của chính phủ liên bang Hoa Kỳ) | `src/static/library/music/jingle-bells.mp3` |
| three.js | three.js authors – [github.com/mrdoob/three.js](https://github.com/mrdoob/three.js) | MIT | thư viện npm, dựng hình người ngắm pháo (tải riêng khi kịch bản có người) |
| @pixiv/three-vrm | pixiv Inc. – [github.com/pixiv/three-vrm](https://github.com/pixiv/three-vrm) | MIT | thư viện npm, nạp nhân vật VRM, tô kiểu anime (MToon), tóc váy đung đưa |
| Nhân vật anime Sendagaya Shino, HairSample_Male | VRoid Project (pixiv Inc.) – [VRoid Studio CC0 models](https://opengameart.org/content/vroid-studio-cc0-models) | CC0 1.0 (giấy phép VRoid Hub trong tệp: ai cũng dùng được, kể cả thương mại, không cần ghi công, được sửa và phân phối lại) | `src/static/models/people/woman.vrm`, `man.vrm` (đã thu nhỏ ảnh bề mặt, bỏ biểu cảm khuôn mặt) |
| Chuyển động quay từ người thật (đi dạo, dừng bước, đứng thở, nhìn quanh, vén tóc, chạm mặt, gãi đầu, che ô, buồn) | Microsoft – [Microsoft Rocketbox Avatar Library](https://github.com/microsoft/Microsoft-Rocketbox) | MIT | `src/static/models/people/*-moves.json` (đã chuyển sang khung xương VRM) |
| Phông Noto Color Emoji, Be Vietnam Pro (dùng để vẽ ảnh trong kho ảnh và ảnh tạm của kịch bản mẫu) | Google, Lâm Bảo, Tony Le, ViệtAnh Nguyễn – [Google Fonts](https://fonts.google.com) | SIL OFL 1.1 | `src/static/library/images/*.jpg`, `src/static/uploads/graduation_nguyen_van/anh-tot-nghiep.jpg` |

Các bài trong kho nhạc đã được cắt đoạn, cân âm lượng và nén lại MP3 160 kbps; danh mục ở `src/static/library/music/index.json`.

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

Fscreen, qrcode-generator, mp4-muxer, three.js và @pixiv/three-vrm dùng cùng nội dung giấy phép MIT ở trên, với dòng bản
quyền của tác giả tương ứng (xem trong mã nguồn của từng thư viện).

## Giấy phép MIT – Microsoft Rocketbox (chuyển động của người ngắm pháo)

```
MIT License

Copyright (c) 2020 Microsoft

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
