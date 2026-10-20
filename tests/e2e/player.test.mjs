/*!
 * Trình diễn Pháo hoa – kiểm thử tự động
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Trình phát: trang chủ, link tặng (thiệp chào, hộp quà), nhạc nền, màn kết, âm thanh, mọi loại pháo và kiểu bắn.
import fs from 'fs';
import path from 'path';
import { DIST, sleep, openPage, writeConfig, removeConfig, writeMelody, litPixels } from './helpers.mjs';

const SHELLS = ['Hoa cúc', 'Liễu', 'Cây cọ', 'Xoay vòng', 'Xoắn ốc', 'Cháy lâu', 'Vòng nhẫn', 'Nổ chéo', 'Nổ lách tách',
    'Nhấp nháy', 'Đuôi ngựa', 'Ma', 'Nổ nhiều lần', 'Trái tim', 'Ngôi sao', 'Kim cương', 'Bông tuyết', 'Bông sen',
    'Hành tinh', 'Con bướm', 'Cỏ 3 lá', 'Cỏ 4 lá', 'Mặt cười', 'Mặt mèo', 'Văn bản'];
const LAUNCH_STYLES = ['', 'straight', 'spiral', 'popping', 'stages', 'wander', 'stealth'];

const waitForShow = page => page.waitForFunction(() => !document.querySelector('.stage-container').classList.contains('remove'), { timeout: 30000 });

export async function run(browser, base, { check }) {
    writeMelody(path.join(DIST, 'uploads/music/zz_e2e/melody.wav'));
    const story = {
        title: 'CHÚC MỪNG SINH NHẬT', subtitle: 'Tuổi mới rực rỡ', author: 'Từ: Con gái', recipient: 'Mẹ yêu',
        introMessage: 'Con có món quà nhỏ cho mẹ!', outroMessage: 'Con thương mẹ nhiều lắm!', loop: false,
        events: [
            { burst: 1, shell: 'Hoa cúc', x: 50, y: 60, burstSound: 'crackleBang' },
            { burst: 1, shell: 'Lời nhắn', text: 'Mẹ ơi, con yêu mẹ!', delay: 500, duration: 3000 },
            { burst: 2, shell: 'Trái tim', x: 50, y: 60, color: 'Red' }
        ]
    };
    writeConfig('zz_e2e_card', { ...story, music: { url: './uploads/music/zz_e2e/melody.wav', volume: 0.6, start: 1 } });
    writeConfig('zz_e2e_gift', { ...story, startFrame: 'gift' });

    try {
        // ---- Trang chủ: lời chào chung, bộ âm thanh cơ bản
        let page = await openPage(browser);
        let audio = [];
        page.on('request', r => { const m = r.url().match(/assets\/audio\/(.+\.mp3)/); if (m) audio.push(m[1]); });
        await page.goto(base + '/index.html', { waitUntil: 'networkidle0' });
        check('trang chủ hiện lời chào chung', await page.$eval('.start-screen__title', e => e.textContent) === 'Xin chào!');
        await page.click('.btn-start');
        await waitForShow(page);
        const t0 = Date.now();
        while ((await litPixels(page)) === 0 && Date.now() - t0 < 10000) await sleep(200);
        check('trang chủ bắn pháo sau khi bấm Bắt đầu', (await litPixels(page)) > 0);
        check('trang chủ chỉ tải 9 file âm thanh cơ bản', new Set(audio).size === 9, [...new Set(audio)].join(', '));
        check('trang chủ không lỗi JS', page.errors.length === 0, page.errors.join(' | '));
        await page.close();

        // ---- Link tặng, thiệp chào: lời mời riêng, nhạc nền, màn kết, xem lại
        page = await openPage(browser);
        audio = [];
        page.on('request', r => { const m = r.url().match(/assets\/audio\/(.+\.mp3)/); if (m) audio.push(m[1]); });
        await page.evaluateOnNewDocument(() => {
            const play = HTMLMediaElement.prototype.play;
            HTMLMediaElement.prototype.play = function () { if (/melody/.test(this.src)) window.__music = this; return play.call(this); };
        });
        await page.goto(base + '/index.html?config=zz_e2e_card', { waitUntil: 'networkidle0' });
        await page.waitForSelector('.start-screen.is-ready');
        const card = await page.evaluate(() => ({
            title: document.querySelector('.start-screen__title').textContent,
            button: document.querySelector('.btn-start').textContent
        }));
        check('link tặng: thiệp mời "Gửi <người nhận>" và nút Mở quà', card.title === 'Gửi Mẹ yêu' && card.button === 'Mở quà', JSON.stringify(card));
        await page.click('.btn-start');
        await waitForShow(page);
        await page.waitForFunction(() => window.__music && !window.__music.paused, { timeout: 20000 }).catch(() => {});
        const music = await page.evaluate(() => window.__music && { paused: window.__music.paused, t: window.__music.currentTime });
        check('nhạc nền phát từ giây đã chọn cùng đợt pháo đầu', music && !music.paused && music.t >= 1 && music.t < 2.5, JSON.stringify(music));
        const caption = await page.waitForFunction(() => document.querySelector('.caption')?.textContent, { timeout: 10000 }).then(h => h.jsonValue(), () => null);
        check('lời nhắn hiện đúng lúc trong đợt', caption === 'Mẹ ơi, con yêu mẹ!', caption);
        check('chỉ tải âm thanh kịch bản dùng (cơ bản + tiếng bụp)', new Set(audio).size === 10 && audio.includes('burst/crackle-bang-1.mp3'), [...new Set(audio)].join(', '));
        await page.keyboard.press('p');
        await sleep(300);
        check('tạm dừng (P) dừng cả nhạc', await page.evaluate(() => window.__music.paused));
        await page.keyboard.press('p');
        await page.waitForFunction(() => !document.querySelector('.end-screen').classList.contains('hide'), { timeout: 40000 }).catch(() => {});
        const end = await page.evaluate(() => ({
            shown: !document.querySelector('.end-screen').classList.contains('hide'),
            message: document.querySelector('.end-screen__message').textContent
        }));
        check('kịch bản không lặp chạy xong thì hiện màn kết', end.shown && end.message === 'Con thương mẹ nhiều lắm!', JSON.stringify(end));
        await page.click('.end-screen__replay');
        await sleep(400);
        check('"Xem lại" đóng màn kết và chạy lại', await page.evaluate(() => document.querySelector('.end-screen').classList.contains('hide')));
        check('link tặng không lỗi JS', page.errors.length === 0, page.errors.join(' | '));
        await page.close();

        // ---- Khung bắt đầu "Hộp quà" (điện thoại)
        page = await openPage(browser, { width: 390, height: 844 });
        await page.goto(base + '/index.html?config=zz_e2e_gift', { waitUntil: 'networkidle0' });
        await page.waitForSelector('.start-screen.frame-gift.is-ready');
        await page.click('.gift-box');
        await sleep(800);
        const opened = await page.evaluate(() => ({
            open: document.querySelector('.start-screen').classList.contains('gift-open'),
            confetti: !!document.querySelector('.confetti-layer')
        }));
        check('hộp quà: chạm vào thì bung nắp và nổ pháo giấy', opened.open && opened.confetti, JSON.stringify(opened));
        await waitForShow(page);
        check('hộp quà: mở xong thì vào màn trình diễn', true);
        check('hộp quà không lỗi JS', page.errors.length === 0, page.errors.join(' | '));
        await page.close();

        // ---- Mọi loại pháo × kiểu bắn trong chế độ xem nhanh: không được có lỗi JS
        page = await openPage(browser);
        await page.goto(base + '/index.html?preview=1', { waitUntil: 'networkidle0' });
        await sleep(500);
        const events = SHELLS.map((shell, i) => ({
            burst: Math.floor(i / 5) + 1, shell, x: 15 + (i % 5) * 17, y: 55 + (i % 3) * 10, size: 1,
            delay: (i % 5) * 150, text: shell === 'Văn bản' ? 'HAPPY' : undefined,
            launchStyle: LAUNCH_STYLES[i % LAUNCH_STYLES.length], hang: i % 6 === 0
        }));
        await page.evaluate(cfg => window.postMessage({ type: 'firework-preview', config: cfg, restart: true }, location.origin), { loop: false, events });
        await sleep(20000);
        check(`chạy đủ ${SHELLS.length} loại pháo và ${LAUNCH_STYLES.length} kiểu bắn không lỗi`, page.errors.length === 0, page.errors.join(' | '));
        await page.close();
    } finally {
        removeConfig('zz_e2e_card');
        removeConfig('zz_e2e_gift');
        fs.rmSync(path.join(DIST, 'uploads/music/zz_e2e'), { recursive: true, force: true });
    }
}
