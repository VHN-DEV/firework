/*!
 * Hanabi – dựng ảnh xem trước mặc định khi chia sẻ link
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// src/static/og-default.jpg (1200×630): ảnh chụp thật sông thành phố, logo, tên Hanabi, câu khẩu hiệu, nút "Bấm để xem".
// Facebook, Zalo, Messenger... hiện ảnh này khi gửi link trang chủ, demo, builder và kịch bản không có ảnh riêng.
// Chạy: npm run og-image (cần Chrome và mạng để tải phông Be Vietnam Pro).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { launchBrowser } from '../tests/e2e/helpers.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataUrl = (file, type) => `data:${type};base64,${fs.readFileSync(path.join(ROOT, file)).toString('base64')}`;
const bg = dataUrl('src/assets/img/landing/landing-city-1920.webp', 'image/webp');
const logo = dataUrl('src/static/favicon.svg', 'image/svg+xml');

const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@500;600;700;800&display=block">
<style>
* { box-sizing: border-box; margin: 0; }
body { width: 1200px; height: 630px; overflow: hidden; font-family: 'Be Vietnam Pro', sans-serif; color: #fff; background: #06070d; }
.bg { position: absolute; inset: 0; background: url(${bg}) 62% 40% / cover; transform: scale(1.06); }
.shade { position: absolute; inset: 0; background:
    linear-gradient(90deg, rgba(6,7,13,.94) 0%, rgba(6,7,13,.78) 38%, rgba(6,7,13,.15) 72%, rgba(6,7,13,0) 100%),
    linear-gradient(0deg, rgba(6,7,13,.6) 0%, rgba(6,7,13,0) 40%); }
.content { position: absolute; left: 72px; top: 0; bottom: 0; width: 640px; display: flex; flex-direction: column; justify-content: center; }
.brand { display: flex; align-items: center; gap: 22px; }
.brand img { width: 96px; height: 96px; border-radius: 24px; box-shadow: 0 12px 40px -8px rgba(255,95,162,.6); }
.name { font-size: 92px; font-weight: 800; letter-spacing: -0.035em; line-height: 1; }
.kicker { margin-top: 10px; color: #ffc65c; font-size: 19px; font-weight: 700; letter-spacing: .22em; }
h1 { margin-top: 40px; font-size: 50px; font-weight: 800; line-height: 1.12; letter-spacing: -0.02em; }
h1 span { display: block; background: linear-gradient(120deg, #ffd27a, #ff6aa8 50%, #a493ff); -webkit-background-clip: text; color: transparent; }
.occ { margin-top: 18px; color: #d3d7e6; font-size: 24px; font-weight: 500; }
.cta { margin-top: 34px; align-self: flex-start; padding: 16px 30px; border-radius: 999px; font-size: 23px; font-weight: 700; color: #1a0b16;
    background: linear-gradient(120deg, #ffd27a, #ff6aa8 50%, #8b7bff); box-shadow: 0 14px 40px -12px rgba(255,106,168,.8); }
</style></head><body>
<div class="bg"></div><div class="shade"></div>
<div class="content">
  <div class="brand"><img src="${logo}" alt=""><div><div class="name">Hanabi</div><div class="kicker">花火 · PHÁO HOA GỬI TẶNG</div></div></div>
  <h1>Gửi tặng cả một <span>bầu trời pháo hoa</span></h1>
  <div class="occ">Sinh nhật · Tốt nghiệp · Năm mới · Tình yêu</div>
  <div class="cta">▶&nbsp; Bấm để xem màn pháo hoa</div>
</div>
</body></html>`;

const browser = await launchBrowser();
try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.evaluate(() => document.fonts.ready);
    const out = path.join(ROOT, 'src/static/og-default.jpg');
    await page.screenshot({ path: out, type: 'jpeg', quality: 88 });
    console.log('Đã ghi', out, Math.round(fs.statSync(out).size / 1024) + ' kB');
} finally {
    await browser.close();
}
