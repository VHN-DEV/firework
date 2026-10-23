/*!
 * Trình diễn Pháo hoa – kiểm thử tự động
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Người nhận: chụp khoảnh khắc (nút 📷, phím C), bảng chia sẻ (link trang chia sẻ, mạng xã hội), tạo video dọc ngay
// trên trang xem; người tạo tắt được (receiverShare: false); bản xem nhanh chỉ báo nút dùng làm gì.
import fs from 'fs';
import path from 'path';
import { DIST, sleep, openPage, writeConfig, removeConfig, writeMelody } from './helpers.mjs';

const ID = 'zz_e2e_viewer_share';
const LOCKED = 'zz_e2e_viewer_locked';

// Mở link quà (chờ kịch bản nạp xong: máy chủ thử php -S đôi khi đóng kết nối, khi đó tải lại trang) và bấm mở
async function openGift(browser, base, id, viewport, title) {
    const page = await openPage(browser, viewport);
    for (let attempt = 0; attempt < 2; attempt++) {
        await page.goto(`${base}/demo.html?config=${id}`, { waitUntil: 'networkidle0' });
        const loaded = await page.waitForFunction(t => document.title.includes(t), { timeout: 8000 }, title).then(() => true, () => false);
        if (loaded) break;
    }
    await page.waitForSelector('.start-screen.is-ready');
    await page.click('.btn-start');
    await page.waitForFunction(() => !document.querySelector('.stage-container').classList.contains('remove'), { timeout: 15000 });
    return page;
}

const isHidden = (page, selector) => page.$eval(selector, el => el.classList.contains('hide') || !!el.closest('.remove'));

export async function run(browser, base, { check }) {
    writeMelody(path.join(DIST, 'uploads/music/zz_e2e_viewer_share/melody.wav'), 30);
    writeConfig(ID, {
        title: 'CHÚC MỪNG', subtitle: 'Thử chia sẻ', author: 'Từ: E2E', loop: true, showBackground: true,
        music: { url: './uploads/music/zz_e2e_viewer_share/melody.wav', volume: 0.8 },
        events: [
            { burst: 1, shell: 'Hoa cúc', x: 50, y: 60, color: 'Gold' },
            { burst: 2, shell: 'Trái tim', x: 50, y: 62, color: 'Red' }
        ]
    });
    writeConfig(LOCKED, { title: 'Riêng tư', loop: false, receiverShare: false, events: [{ burst: 1, shell: 'Hoa cúc', x: 50, y: 60, color: 'Gold' }] });
    let page = null;
    try {
        page = await openGift(browser, base, ID, { width: 1280, height: 720 }, 'CHÚC MỪNG');
        check('người nhận thấy nút chụp và chia sẻ', !(await isHidden(page, '.moment-bar')));

        // Chụp khoảnh khắc lúc pháo đang nổ: ảnh JPEG cỡ canvas, có ảnh nền và pháo
        await sleep(3000);
        await page.click('.moment-bar__snap');
        await page.waitForFunction(() => !document.querySelector('.snap-toast').classList.contains('hide'), { timeout: 5000 }).catch(() => {});
        const shot = await page.evaluate(async () => {
            const img = document.querySelector('.snap-toast img');
            if (!img.src) return null;
            const blob = await (await fetch(img.src)).blob();
            await img.decode();
            const c = document.createElement('canvas');
            c.width = img.naturalWidth;
            c.height = img.naturalHeight;
            c.getContext('2d').drawImage(img, 0, 0);
            const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
            let lit = 0;
            let dim = 0;
            for (let i = 0; i < d.length; i += 64) {
                const sum = d[i] + d[i + 1] + d[i + 2];
                if (sum > 400) lit++;
                else if (sum > 30) dim++;
            }
            const canvas = document.getElementById('main-canvas');
            return { type: blob.type, w: c.width, h: c.height, cw: canvas.width, ch: canvas.height, lit, dim: dim / (d.length / 64) };
        });
        check('chụp khoảnh khắc ra ảnh JPEG đúng cỡ khung pháo', !!shot && shot.type === 'image/jpeg' && shot.w === shot.cw && shot.h === shot.ch,
            shot && `${shot.type} ${shot.w}×${shot.h} (canvas ${shot.cw}×${shot.ch})`);
        check('ảnh chụp có pháo/chữ và ảnh nền', !!shot && shot.lit > 20 && shot.dim > 0.2, shot && `${shot.lit} điểm sáng, ${(shot.dim * 100).toFixed(0)}% nền`);

        // Phím C chụp thêm một ảnh; bảng chia sẻ liệt kê đủ
        await page.keyboard.press('c');
        await sleep(800);
        await page.click('.moment-bar__share');
        await sleep(600);
        const sheet = await page.evaluate(() => ({
            open: !document.querySelector('.share-sheet').classList.contains('hide'),
            url: document.querySelector('.share-sheet__url').value,
            platforms: [...document.querySelectorAll('.share-grid [data-platform]')].map(b => b.dataset.platform),
            moments: document.querySelectorAll('.moments .moment').length,
            paused: document.querySelector('.pause-btn use').getAttribute('href')
        }));
        check('bảng chia sẻ: link trang chia sẻ của kịch bản', sheet.open && sheet.url.endsWith(`/s/${ID}.html`), sheet.url);
        check('bảng chia sẻ có Facebook, Messenger, Zalo, Telegram, TikTok...',
            ['facebook', 'messenger', 'zalo', 'telegram', 'whatsapp', 'x', 'tiktok', 'email'].every(p => sheet.platforms.includes(p)), sheet.platforms.join(','));
        check('bảng chia sẻ có 2 ảnh đã chụp (nút và phím C)', sheet.moments === 2, String(sheet.moments));
        check('mở bảng chia sẻ thì màn trình diễn tạm dừng', sheet.paused === '#icon-play', sheet.paused);

        // Facebook: mở trang chia sẻ của Facebook với link của kịch bản
        await page.evaluate(() => {
            window.__opened = [];
            window.open = url => {
                window.__opened.push(url);
                return {};
            };
        });
        await page.click('.share-grid [data-platform="facebook"]');
        await sleep(300);
        const opened = await page.evaluate(() => window.__opened);
        check('chia sẻ Facebook mở sharer với link kịch bản', opened.length === 1 && opened[0].includes('facebook.com/sharer') && opened[0].includes(encodeURIComponent(`/s/${ID}.html`)),
            opened.join(' '));

        // TikTok không nhận link: mở tạo video khổ dọc
        await page.click('.share-grid [data-platform="tiktok"]');
        await sleep(500);
        const tiktok = await page.evaluate(() => ({
            open: !document.querySelector('.video-sheet').classList.contains('hide'),
            format: document.querySelector('.video-format.is-active')?.dataset.format,
            note: document.querySelector('.video-notes li')?.textContent || ''
        }));
        check('TikTok: mở tạo video khổ dọc 9:16', tiktok.open && tiktok.format === 'portrait' && tiktok.note.includes('TikTok'), JSON.stringify(tiktok));

        // Tạo video ngay trên trang xem (HD cho nhanh): bấm một lần là có file, không phải quay
        await page.click('.video-qualities [data-quality="hd"]');
        await page.click('.video-sheet [data-act="create"]');
        await page.waitForFunction(() => !document.querySelector('.video-sheet__result').classList.contains('remove'), { timeout: 120000 }).catch(() => {});
        const video = await page.evaluate(async () => {
            const v = document.querySelector('.video-output');
            if (!v.src) return null;
            if (v.readyState < 1) await new Promise(r => v.addEventListener('loadedmetadata', r, { once: true }));
            let duration = v.duration;
            if (!Number.isFinite(duration)) {
                v.currentTime = 1e6;
                await new Promise(r => v.addEventListener('timeupdate', r, { once: true }));
                duration = v.duration;
            }
            const blob = await (await fetch(v.src)).blob();
            return {
                w: v.videoWidth, h: v.videoHeight, duration, type: blob.type,
                download: !!document.querySelector('.video-sheet [data-act="download"]'),
                tip: document.querySelector('.video-tip').textContent
            };
        });
        check('người nhận tạo được video MP4 dọc 720×1280 có nút tải về', !!video && video.type === 'video/mp4' && video.w === 720 && video.h === 1280 && video.download,
            video && `${video.type} ${video.w}×${video.h}`);
        check('video người nhận dài trọn màn trình diễn kèm thiệp lời chúc', !!video && video.duration > 12 && video.duration < 22, video && `${video.duration.toFixed(1)} s`);
        check('kèm hướng dẫn đăng TikTok', !!video && video.tip.includes('TikTok'), video && video.tip);

        // Đóng hết bảng: không còn khung dựng, màn trình diễn chạy tiếp
        await page.click('.video-sheet .sheet__close');
        // Chờ bảng video mờ hẳn rồi mới bấm nút đóng của bảng chia sẻ bên dưới
        await sleep(400);
        await page.click('.share-sheet .sheet__close');
        await sleep(300);
        const after = await page.evaluate(() => ({
            frames: document.querySelectorAll('iframe[title="Khung dựng video"]').length,
            paused: document.querySelector('.pause-btn use').getAttribute('href')
        }));
        check('đóng bảng: không còn khung dựng, màn trình diễn chạy tiếp', after.frames === 0 && after.paused === '#icon-pause', JSON.stringify(after));
        check('chia sẻ, chụp, tạo video không lỗi JS', page.errors.length === 0, page.errors.join(' | '));
        await page.close();

        // Người tạo tắt chia sẻ: không có nút chụp/chia sẻ, kể cả ở màn kết; phím C không chụp
        page = await openGift(browser, base, LOCKED, { width: 1280, height: 720 }, 'Riêng tư');
        await page.waitForFunction(() => !document.querySelector('.end-screen').classList.contains('hide'), { timeout: 20000 }).catch(() => {});
        await page.keyboard.press('c');
        await sleep(500);
        const locked = await page.evaluate(() => ({
            bar: !!document.querySelector('.moment-bar').closest('.remove'),
            end: document.querySelector('.end-screen__share').classList.contains('remove'),
            endShown: !document.querySelector('.end-screen').classList.contains('hide'),
            snapped: !document.querySelector('.snap-toast').classList.contains('hide'),
            title: document.title
        }));
        check('kịch bản tắt chia sẻ (receiverShare: false): ẩn nút chụp, chia sẻ, kể cả ở màn kết', locked.bar && locked.end && locked.endShown && !locked.snapped,
            JSON.stringify(locked));
        await page.close();

        // Bản xem nhanh trong builder: bấm chia sẻ chỉ báo nút dùng làm gì
        page = await openPage(browser);
        await page.goto(base + '/demo.html?preview=1', { waitUntil: 'networkidle0' });
        await page.evaluate(() => window.postMessage({ type: 'firework-preview', config: { loop: true, events: [] }, restart: true }, location.origin));
        await sleep(500);
        await page.click('.moment-bar__share');
        await sleep(300);
        const preview = await page.evaluate(() => ({
            sheet: !document.querySelector('.share-sheet').classList.contains('hide'),
            toast: document.querySelector('.viewer-toast').textContent
        }));
        check('xem nhanh: nút chia sẻ chỉ báo cho người tạo, không mở bảng', !preview.sheet && preview.toast.includes('người nhận'), JSON.stringify(preview));
    } finally {
        if (page && !page.isClosed()) await page.close();
        removeConfig(ID);
        removeConfig(LOCKED);
        fs.rmSync(path.join(DIST, 'uploads/music/zz_e2e_viewer_share'), { recursive: true, force: true });
    }
}
