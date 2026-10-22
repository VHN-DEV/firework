/*!
 * Trình diễn Pháo hoa – kiểm thử tự động
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Trình phát: trang chủ, link tặng (thiệp chào, hộp quà, hẹn giờ), nhạc nền, màn kết, âm thanh, mọi loại pháo và kiểu bắn.
import fs from 'fs';
import path from 'path';
import { DIST, sleep, openPage, writeConfig, removeConfig, writeMelody, litPixels } from './helpers.mjs';
import { MOON_PHASES, moonFraction, moonPhaseIndex } from '../../src/assets/js/player/moon.js';

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

        // ---- Giảm chớp sáng: bật ngay trên màn mở quà (chưa bắt đầu màn trình diễn), lần sau vẫn nhớ
        page = await openPage(browser);
        await page.goto(base + '/index.html?config=zz_e2e_card', { waitUntil: 'networkidle0' });
        await page.waitForSelector('.start-screen.is-ready');
        await page.click('.start-screen__a11y');
        await sleep(200);
        await page.reload({ waitUntil: 'networkidle0' });
        await page.waitForSelector('.start-screen.is-ready');
        const a11y = await page.evaluate(() => ({
            pressed: document.querySelector('.start-screen__a11y').getAttribute('aria-pressed'),
            waiting: !document.querySelector('.start-screen').classList.contains('hide')
        }));
        check('giảm chớp sáng: bật trên màn mở quà và được nhớ', a11y.pressed === 'true' && a11y.waiting, JSON.stringify(a11y));
        await page.click('.start-screen__a11y');
        await page.close();

        // ---- Hẹn giờ mở quà: khóa tới giờ (còn nhiều ngày), đếm ngược rồi tự bắn
        // Thêm 1 giờ: trang tải mất vài giây vẫn còn đủ 3 ngày
        writeConfig('zz_e2e_lock', { ...story, openAt: new Date(Date.now() + 3 * 86400000 + 3600000).toISOString() });
        page = await openPage(browser);
        await page.goto(base + '/index.html?config=zz_e2e_lock', { waitUntil: 'networkidle0' });
        await page.waitForSelector('.start-screen.is-ready');
        const locked = await page.evaluate(() => ({
            countdown: document.querySelector('.start-screen').className,
            days: document.querySelector('[data-unit="days"]').textContent,
            ready: document.querySelector('.countdown-stage__ready').hidden
        }));
        check('hẹn giờ: chưa tới giờ thì hiện đếm ngược thay cho thiệp', /frame-countdown/.test(locked.countdown) && /has-days/.test(locked.countdown) && locked.days === '3' && locked.ready, JSON.stringify(locked));
        await page.close();

        writeConfig('zz_e2e_auto', { ...story, openAt: new Date(Date.now() + 4000).toISOString(), openMode: 'countdown' });
        page = await openPage(browser);
        await page.goto(base + '/index.html?config=zz_e2e_auto', { waitUntil: 'networkidle0' });
        await page.waitForSelector('.start-screen.frame-countdown');
        await page.click('.countdown-stage__ready');
        await waitForShow(page).catch(() => {});
        check('hẹn giờ: bấm sẵn sàng thì đúng giờ pháo hoa tự bắn', await page.evaluate(() => !document.querySelector('.stage-container').classList.contains('remove')));
        check('hẹn giờ không lỗi JS', page.errors.length === 0, page.errors.join(' | '));
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

        // ---- Khói pháo: kịch bản bật thì có khói, tắt thì xóa ngay, chất lượng Thấp thì không có khói
        const smokeCover = p => p.evaluate(() => {
            const c = document.getElementById('smoke-canvas');
            const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
            let n = 0;
            for (let i = 3; i < d.length; i += 4) if (d[i] > 8) n++;
            return n / (d.length / 4);
        });
        const smokeShow = smoke => ({
            loop: true, smoke, events: [
                { burst: 1, shell: 'Hoa cúc', x: 30, y: 60, color: 'Gold' },
                { burst: 1, shell: 'Hoa cúc', x: 70, y: 60, color: 'Red', delay: 300 }
            ]
        });
        page = await openPage(browser);
        await page.goto(base + '/index.html?preview=1', { waitUntil: 'networkidle0' });
        await page.evaluate(cfg => window.postMessage({ type: 'firework-preview', config: cfg, restart: true }, location.origin), smokeShow('heavy'));
        await sleep(5000);
        const heavy = await smokeCover(page);
        check('khói pháo: kịch bản bật "Dày" thì có khói quanh chỗ nổ', heavy > 0.05, heavy.toFixed(3));
        await page.evaluate(cfg => window.postMessage({ type: 'firework-preview', config: cfg, restart: true }, location.origin), smokeShow(undefined));
        await sleep(800);
        const cleared = await smokeCover(page);
        check('khói pháo: chuyển về Tắt thì khói biến mất ngay', cleared === 0, cleared.toFixed(3));
        check('khói pháo không lỗi JS', page.errors.length === 0, page.errors.join(' | '));
        await page.close();

        // Chạm vào trời bắn pháo; kịch bản khóa (tapToLaunch: false) thì chạm không bắn
        const tapLit = async tapToLaunch => {
            const p = await openPage(browser);
            await p.goto(base + '/index.html?preview=1', { waitUntil: 'networkidle0' });
            await p.evaluate(cfg => window.postMessage({ type: 'firework-preview', config: cfg, restart: true }, location.origin),
                { loop: true, events: [], tapToLaunch });
            await sleep(500);
            const { width, height } = p.viewport();
            await p.mouse.click(width / 2, height * 0.4);
            await sleep(1500);
            const lit = await litPixels(p);
            await p.close();
            return lit;
        };
        const tapOn = await tapLit(undefined);
        const tapOff = await tapLit(false);
        check('chạm vào trời bắn pháo; kịch bản khóa chạm bắn pháo thì không bắn', tapOn > 0 && tapOff === 0, JSON.stringify({ tapOn, tapOff }));

        // Xem như người nhận trong bản xem nhanh: chạm ra ngoài hộp quà không bắn pháo phía sau màn mở quà
        page = await openPage(browser);
        await page.goto(base + '/index.html?preview=1', { waitUntil: 'networkidle0' });
        await page.evaluate(cfg => window.postMessage({ type: 'firework-preview', config: cfg, restart: true, startFrame: true }, location.origin),
            { loop: true, startFrame: 'gift', events: [{ burst: 1, shell: 'Hoa cúc', x: 50, y: 60 }] });
        await sleep(800);
        await page.mouse.click(page.viewport().width * 0.12, page.viewport().height * 0.5);
        await sleep(1500);
        const behindGift = await litPixels(page);
        check('màn mở quà đang hiện: chạm ra ngoài hộp quà không bắn pháo phía sau', behindGift === 0, behindGift);
        await page.close();

        // ---- Cảnh vật: mặt nước phản chiếu (pháo không vẽ dưới mép nước), đèn trời, khinh khí cầu
        page = await openPage(browser);
        await page.goto(base + '/index.html?preview=1', { waitUntil: 'networkidle0' });
        await page.evaluate(cfg => window.postMessage({ type: 'firework-preview', config: cfg, restart: true }, location.origin),
            { ...smokeShow(undefined), water: 'half', decor: 'both', waterLife: false });
        await sleep(4500);
        const scene = await page.evaluate(() => {
            const cov = (id, from = 0, to = 1) => {
                const c = document.getElementById(id);
                const y0 = Math.round(c.height * from), h = Math.max(1, Math.round(c.height * (to - from)));
                const d = c.getContext('2d').getImageData(0, y0, c.width, h).data;
                let n = 0;
                for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 60) n++;
                return n / (d.length / 4);
            };
            return { water: cov('water-canvas', 0.5, 1), sky: cov('water-canvas', 0, 0.48), deco: cov('deco-canvas'), sparksBelow: cov('trails-canvas', 0.52, 1) };
        });
        check('mặt nước: có bóng phản chiếu dưới mép nước, pháo không vẽ xuống nước',
            scene.water > 0.001 && scene.sky === 0 && scene.sparksBelow === 0, JSON.stringify(scene));
        check('trang trí: đèn trời, khinh khí cầu hiện trên trời', scene.deco > 0.001, scene.deco.toFixed(4));
        // Sông chảy có hoa đăng: đèn hoa sen sáng trên mặt nước
        await page.evaluate(cfg => window.postMessage({ type: 'firework-preview', config: cfg, restart: true }, location.origin),
            { ...smokeShow(undefined), water: 'half', waterStyle: 'river', floating: 'lanterns' });
        await sleep(1500);
        const lanterns = await page.evaluate(() => {
            const c = document.getElementById('water-canvas');
            const d = c.getContext('2d').getImageData(0, Math.round(c.height / 2), c.width, Math.round(c.height / 2)).data;
            let n = 0;
            for (let i = 0; i < d.length; i += 4) if (d[i] > 200 && d[i + 1] > 120 && d[i + 2] > 120) n++;
            return n;
        });
        check('sông chảy: hoa đăng trôi trên mặt nước', lanterns > 5, lanterns);
        // Sông chảy: có khúc gỗ trôi (màu gỗ nâu trên mặt nước); tắt "Chim, cá, khúc gỗ" thì không có
        const woodOnWater = () => page.evaluate(() => {
            const c = document.getElementById('water-canvas');
            const d = c.getContext('2d').getImageData(0, Math.round(c.height * 0.56), c.width, Math.round(c.height * 0.44)).data;
            let n = 0;
            for (let i = 0; i < d.length; i += 4) if (d[i] > 60 && d[i] > d[i + 1] + 15 && d[i + 1] > d[i + 2] + 8) n++;
            return n;
        });
        await page.evaluate(cfg => window.postMessage({ type: 'firework-preview', config: cfg, restart: true }, location.origin),
            { loop: true, events: [], water: 'half', waterStyle: 'river', waterRocks: false, waterPlants: false });
        await sleep(1500);
        const wood = await woodOnWater();
        await page.evaluate(cfg => window.postMessage({ type: 'firework-preview', config: cfg, restart: true }, location.origin),
            { loop: true, events: [], water: 'half', waterStyle: 'river', waterLife: false, waterRocks: false, waterPlants: false });
        await sleep(800);
        const noWood = await woodOnWater();
        check('sông chảy: có khúc gỗ trôi, tắt "Chim, cá, khúc gỗ" thì không còn', wood > 20 && noWood === 0, JSON.stringify({ wood, noWood }));
        // Lá bèo (màu lá xanh trên mặt nước, dưới bờ); tắt thì không còn. Bờ đá màu đất ở mép nước.
        const onWater = (from, to, test) => page.evaluate((from, to, test) => {
            const c = document.getElementById('water-canvas');
            const d = c.getContext('2d').getImageData(0, Math.round(c.height * from), c.width, Math.max(1, Math.round(c.height * (to - from)))).data;
            const match = new Function('r', 'g', 'b', `return ${test}`);
            let n = 0;
            for (let i = 0; i < d.length; i += 4) if (match(d[i], d[i + 1], d[i + 2])) n++;
            return n;
        }, from, to, test);
        // Xanh lá bèo (đỏ thấp); ánh đom đóm vàng xanh in xuống nước (đỏ cao) không tính
        const green = 'g > 50 && g > r + 15 && g > b + 5 && r < 120';
        await page.evaluate(cfg => window.postMessage({ type: 'firework-preview', config: cfg, restart: true }, location.origin),
            { loop: true, events: [], water: 'half', waterLife: false, waterRocks: false });
        await sleep(800);
        const plants = await onWater(0.56, 1, green);
        const bank = await onWater(0.5, 0.505, 'r > 25 && r >= g && g >= b');
        await page.evaluate(cfg => window.postMessage({ type: 'firework-preview', config: cfg, restart: true }, location.origin),
            { loop: true, events: [], water: 'half', waterLife: false, waterPlants: false, waterRocks: false });
        await sleep(800);
        const noPlants = await onWater(0.56, 1, green);
        // Đá, gò đất giữa dòng (đá xám, gò màu đất); tắt thì không còn
        const stone = 'r > 40 && r < 170 && Math.abs(r - g) < 14 && Math.abs(g - b) < 16 || (r > 45 && r > g + 8 && g > b + 6)';
        await page.evaluate(cfg => window.postMessage({ type: 'firework-preview', config: cfg, restart: true }, location.origin),
            { loop: true, events: [], water: 'half', waterStyle: 'river', waterLife: false, waterPlants: false });
        await sleep(800);
        const rocks = await onWater(0.56, 1, stone);
        check('sông: có đá, gò đất giữa dòng (tắt lá bèo, sinh vật thì vẫn còn)', rocks > 100, rocks);
        // Tắt lá bèo: chỉ còn vài điểm quầng sáng đom đóm bên bờ in xuống nước
        check('mặt nước: có bờ đất ở mép nước, lá bèo; tắt "Lá bèo" thì không còn', plants > 50 && noPlants < Math.max(60, plants * 0.05) && bank > 100,
            JSON.stringify({ plants, noPlants, bank }));
        check('cảnh vật không lỗi JS', page.errors.length === 0, page.errors.join(' | '));
        await page.close();

        // ---- Bầu trời đêm: pha trăng theo ngày (so với các kỳ trăng mới/tròn đã biết), trăng đúng chỗ, sao
        const phaseOf = iso => MOON_PHASES[moonPhaseIndex(moonFraction(new Date(iso)))].name;
        const known = [['2024-04-08T18:21Z', 'Trăng mới'], ['2024-04-23T23:49Z', 'Trăng tròn'], ['2025-09-07T18:09Z', 'Trăng tròn'],
            ['2025-09-21T19:54Z', 'Trăng mới'], ['2026-10-18T16:13Z', 'Bán nguyệt đầu tháng']];
        const wrong = known.filter(([iso, name]) => phaseOf(iso) !== name);
        check('pha trăng theo ngày khớp các kỳ trăng mới, tròn, bán nguyệt đã biết', wrong.length === 0, JSON.stringify(wrong));
        page = await openPage(browser);
        await page.goto(base + '/index.html?preview=1', { waitUntil: 'networkidle0' });
        await page.evaluate(cfg => window.postMessage({ type: 'firework-preview', config: cfg, restart: true }, location.origin),
            { loop: true, events: [], stars: 'many', moon: { phase: 4, x: 25, y: 70 } });
        await sleep(1500);
        const sky = await page.evaluate(() => {
            const c = document.getElementById('deco-canvas');
            const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
            let moonX = 0, moonY = 0, moon = 0, stars = 0;
            for (let y = 0; y < c.height; y++) {
                for (let x = 0; x < c.width; x++) {
                    const i = (y * c.width + x) * 4;
                    if (d[i] > 225 && d[i + 1] > 220 && d[i + 3] > 240) { moonX += x; moonY += y; moon++; } else if (d[i + 3] > 20 && d[i] > 150) stars++;
                }
            }
            return { x: moonX / moon / c.width, y: moonY / moon / c.height, moon, stars };
        });
        check('trăng tròn hiện đúng chỗ đã chọn (25% ngang, 70% độ cao)',
            sky.moon > 300 && Math.abs(sky.x - 0.25) < 0.05 && Math.abs(sky.y - 0.3) < 0.06, JSON.stringify(sky));
        check('sao lấp lánh trên trời', sky.stars > 100, sky.stars);

        // Trăng tròn làm bầu trời sáng lên (trăng non thì không); mây trôi trên trời, mây che trăng thì tối lại
        const skyGlow = cfg => page.evaluate(async cfg => {
            window.postMessage({ type: 'firework-preview', config: cfg, restart: true }, location.origin);
            await new Promise(r => setTimeout(r, 1800));
            const c = document.getElementById('deco-canvas');
            const d = c.getContext('2d').getImageData(0, 0, c.width, Math.round(c.height * 0.5)).data;
            let blue = 0;
            let cloud = 0;
            for (let i = 0; i < d.length; i += 16) {
                blue += d[i + 2] * d[i + 3] / 255;
                if (d[i + 3] > 60 && d[i + 2] > 40 && d[i + 2] < 140 && Math.abs(d[i] - d[i + 1]) < 20) cloud++;
            }
            return { blue: blue / (d.length / 16), cloud: cloud / (d.length / 16) };
        }, cfg);
        const fullMoon = await skyGlow({ loop: true, events: [], moon: { phase: 4, x: 50, y: 70 } });
        const newMoon = await skyGlow({ loop: true, events: [], moon: { phase: 0, x: 50, y: 70 } });
        const cloudy = await skyGlow({ loop: true, events: [], clouds: 'many' });
        check('trăng tròn làm bầu trời sáng lên, trăng non thì không', fullMoon.blue > newMoon.blue * 3 && fullMoon.blue > 8,
            JSON.stringify({ full: fullMoon.blue.toFixed(1), new: newMoon.blue.toFixed(1) }));
        check('mây trôi trên trời', cloudy.cloud > 0.02, cloudy.cloud.toFixed(3));
        await page.close();

        // Người nhận mở link tặng trên máy đã đặt chất lượng thấp: bản lưu cũ "Thấp" (1) thành 480p (xem nhanh không đọc cài đặt đã lưu)
        writeConfig('zz_e2e_smoke', smokeShow('heavy'));
        page = await openPage(browser);
        await page.evaluateOnNewDocument(() => localStorage.setItem('cm_fireworks_data',
            JSON.stringify({ schemaVersion: '1.2', data: { quality: '1', skyLighting: '2', scaleFactor: 1 } })));
        await page.goto(base + '/index.html?config=zz_e2e_smoke', { waitUntil: 'networkidle0' });
        await page.click('.btn-start');
        await waitForShow(page).catch(() => {});
        await sleep(5000);
        const low = await smokeCover(page);
        check('khói pháo: máy đặt chất lượng 480p (bản lưu cũ "Thấp") thì không có khói', low === 0, low.toFixed(3));
        await page.close();

        // Kịch bản đặt sẵn cách xem (viewer): áp cho người xem mới, không lưu thành cài đặt của họ
        writeConfig('zz_e2e_viewer', { ...smokeShow(undefined), loop: false, viewer: { quality: '360', skyLighting: '1', scaleFactor: 0.75, hideControls: false } });
        page = await openPage(browser);
        await page.evaluateOnNewDocument(() => localStorage.removeItem('cm_fireworks_data'));
        await page.goto(base + '/index.html?config=zz_e2e_viewer', { waitUntil: 'networkidle0' });
        await page.click('.btn-start');
        await waitForShow(page).catch(() => {});
        const viewer = await page.evaluate(() => ({
            quality: document.querySelector('.quality-ui').value, sky: document.querySelector('.sky-lighting').value,
            scale: document.querySelector('.scaleFactor').value, controls: !document.querySelector('.controls').classList.contains('hide'),
            stored: JSON.parse(localStorage.getItem('cm_fireworks_data') || 'null')
        }));
        check('kịch bản đặt sẵn cách xem: áp cho người xem mới, không lưu thành cài đặt của họ',
            viewer.quality === '360' && viewer.sky === '1' && viewer.scale === '0.75' && viewer.controls
            && (!viewer.stored || (viewer.stored.data.quality === 'auto' && viewer.stored.data.skyLighting === '2')), JSON.stringify(viewer));
        await page.close();
        removeConfig('zz_e2e_viewer');

        // Chất lượng theo độ phân giải: mặc định Tự động (máy mạnh: độ phân giải gốc); 480p trên điện thoại 390×844 vẽ cạnh
        // ngắn đúng 480 điểm ảnh; bản lưu cũ "Cao" (3) thành 2160p, vẫn đủ độ phân giải gốc
        for (const [stored, value, ratio] of [[null, 'auto', 3], ['480', '480', 480 / 390], ['3', '2160', 3]]) {
            page = await openPage(browser);
            await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
            await page.evaluateOnNewDocument(q => {
                if (q) localStorage.setItem('cm_fireworks_data', JSON.stringify({ schemaVersion: '1.2', data: { quality: q, skyLighting: '2', scaleFactor: 1 } }));
                else localStorage.removeItem('cm_fireworks_data');
            }, stored);
            await page.goto(base + '/index.html?config=zz_e2e_smoke', { waitUntil: 'networkidle0' });
            await page.click('.btn-start');
            await waitForShow(page).catch(() => {});
            const q = await page.evaluate(() => ({
                value: document.querySelector('.quality-ui').value,
                label: document.querySelector('.quality-ui option[value="auto"]').textContent,
                ratio: document.getElementById('trails-canvas').width / document.getElementById('trails-canvas').clientWidth
            }));
            const name = { auto: 'chất lượng mặc định "Tự động", máy mạnh vẽ đủ độ phân giải', 480: 'chất lượng 480p: cạnh ngắn vẽ đúng 480 điểm ảnh',
                2160: 'bản lưu cũ chất lượng "Cao" đổi thành 2160p, vẽ đủ độ phân giải' }[value];
            check(name, q.value === value && (value !== 'auto' || /^Tự động \(\d+p\)$/.test(q.label)) && Math.abs(q.ratio - ratio) < 0.01, JSON.stringify(q));
            await page.close();
        }
    } finally {
        removeConfig('zz_e2e_card');
        removeConfig('zz_e2e_gift');
        removeConfig('zz_e2e_lock');
        removeConfig('zz_e2e_auto');
        removeConfig('zz_e2e_smoke');
        fs.rmSync(path.join(DIST, 'uploads/music/zz_e2e'), { recursive: true, force: true });
    }
}
