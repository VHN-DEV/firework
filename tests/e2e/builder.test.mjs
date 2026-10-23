/*!
 * Hanabi – kiểm thử tự động
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Builder: nút "?" giải thích, mẫu theo dịp, dòng thời gian theo giây, lưu qua API PHP, trang chia sẻ, mở lại, kiểu bắn, khung bắt đầu, hoàn tác và bản nháp.
import fs from 'fs';
import path from 'path';
import { DIST, sleep, openPage, removeConfig } from './helpers.mjs';

// Tên người nhận riêng cho kiểm thử: tên file kịch bản không thể trùng kịch bản thật
const ID = 'phu_nu_20_10_e2e_test';

export async function run(browser, base, { check }) {
    removeConfig(ID);
    const page = await openPage(browser, { width: 1600, height: 900 });
    try {
        await page.goto(base + '/builder', { waitUntil: 'networkidle0' });
        check('builder mới mở: có dải "Tạo nhanh theo dịp"', await page.$eval('#template-strip', e => !e.classList.contains('hide')));
        // Dải gọn một hàng; lăn chuột trên các dịp thì cuộn ngang
        const strip = await page.$eval('#template-strip', e => e.getBoundingClientRect().height);
        const chips = await page.$('#template-chips');
        const chipsBox = await chips.boundingBox();
        await page.mouse.move(chipsBox.x + chipsBox.width / 2, chipsBox.y + chipsBox.height / 2);
        await page.mouse.wheel({ deltaY: 200 });
        await sleep(300);
        const scrolled = await page.$eval('#template-chips', e => e.scrollLeft);
        check('dải "Tạo nhanh" gọn một hàng, lăn chuột thì cuộn ngang', strip < 60 && scrolled > 0, JSON.stringify({ strip, scrolled }));

        // Nút "?" giải thích: bấm thì hiện, không bật/tắt công tắc chứa nó, Esc để đóng
        // "Tự động lặp lại" nằm trong nhóm "Màn mở quà & màn kết" (đang gấp): mở nhóm trước
        await page.evaluate(() => { document.querySelector('.settings-group[data-group="gift"]').open = true; });
        const loopBefore = await page.$eval('#loop', i => i.checked);
        await page.click('.help-tip[data-help="loop"]');
        await sleep(200);
        const tip = await page.evaluate(() => {
            const el = document.getElementById('help-tooltip');
            return { shown: !el.hidden, text: el.textContent, loop: document.getElementById('loop').checked };
        });
        await page.keyboard.press('Escape');
        await sleep(100);
        const closed = await page.$eval('#help-tooltip', el => el.hidden);
        check('nút "?" hiện giải thích, không bật/tắt công tắc, Esc để đóng',
            tip.shown && tip.text.includes('màn kết') && tip.loop === loopBefore && closed, JSON.stringify(tip));

        // Tạo từ mẫu 20/10
        await page.evaluate(() => openTemplatesModal('phu_nu_20_10'));
        await page.type('#tpl-recipient', 'E2E Test');
        await page.type('#tpl-sender', 'Con gái');
        await page.click('#btn-create-template');
        await sleep(600);
        const created = await page.evaluate(() => ({
            title: document.getElementById('title').value, recipient: document.getElementById('recipient').value,
            filename: document.getElementById('filename').value, shots: document.querySelectorAll('.shot-row').length,
            frame: document.querySelector('#start-frame-grid .shell-option.selected')?.textContent.trim()
        }));
        check('mẫu theo dịp điền đủ kịch bản', created.title.includes('20/10') && created.recipient === 'E2E Test' && created.filename === ID && created.shots > 25 && created.frame.endsWith('Hoa nở'), JSON.stringify(created));

        // Dòng thời gian theo giây: kéo một phát sang phải ~1 giây, các phát khác giữ nguyên thời điểm, Ctrl+Z hoàn tác
        await page.evaluate(() => setTimelineView('track'));
        await sleep(400);
        const markerTimes = () => page.$$eval('.track-marker', els => Object.fromEntries(els.map(e => [e.dataset.id, Number(e.dataset.time)])));
        const times0 = await markerTimes();
        check('xem theo giây: mỗi phát một nút trên thước giây', Object.keys(times0).length > 20, Object.keys(times0).length);
        const target = await page.$$eval('.track-marker', els => {
            const sorted = els.sort((a, b) => a.dataset.time - b.dataset.time);
            const [a, b] = [sorted[0], sorted[sorted.length - 1]];
            const pps = (parseFloat(b.style.left) - parseFloat(a.style.left)) / ((b.dataset.time - a.dataset.time) / 1000);
            const el = sorted[2];
            el.scrollIntoView({ block: 'nearest', inline: 'center' });
            const r = el.getBoundingClientRect();
            return { id: el.dataset.id, x: r.left + r.width / 2, y: r.top + r.height / 2, pps };
        });
        await page.mouse.move(target.x, target.y);
        await page.mouse.down();
        await page.mouse.move(target.x + target.pps * 0.5, target.y, { steps: 4 });
        await page.mouse.move(target.x + target.pps * 1.02, target.y, { steps: 4 });
        await page.mouse.up();
        await sleep(500);
        const times1 = await markerTimes();
        const changed = Object.keys(times0).filter(id => Math.abs(times1[id] - times0[id]) > 1);
        check('kéo phát bắn đổi đúng thời điểm của nó, các phát khác giữ nguyên',
            changed.length === 1 && changed[0] === target.id && Math.abs(times1[target.id] - times0[target.id] - 1000) <= 100,
            changed.map(id => `${id}: +${times1[id] - times0[id]}`).join(', '));
        await page.keyboard.down('Control');
        await page.keyboard.press('z');
        await page.keyboard.up('Control');
        await sleep(500);
        const times2 = await markerTimes();
        check('Ctrl+Z đưa phát bắn về chỗ cũ', Object.keys(times0).every(id => Math.abs(times2[id] - times0[id]) <= 1));
        await page.evaluate(() => setTimelineView('list'));
        await sleep(300);

        // Kiểu bắn cho phát đầu tiên
        await page.evaluate(() => document.querySelector('.shot-row').click());
        await sleep(300);
        await page.evaluate(() => [...document.querySelectorAll('.launch-grid .shell-option')].find(b => b.textContent.includes('Đạn tàng hình')).click());
        await sleep(300);

        // Khóa chạm bắn pháo (nhóm "Khi người nhận xem")
        await page.evaluate(() => document.getElementById('tap-to-launch').click());
        // Tắt "Cho người nhận chụp ảnh, tạo video, chia sẻ"
        await page.evaluate(() => document.getElementById('receiver-share').click());
        // Tóm tắt nhóm vẽ lại ở khung hình kế tiếp (máy chậm như máy chạy CI thì trễ hơn): chờ rồi mới đọc
        await page.waitForFunction(() => {
            const text = document.querySelector('[data-summary="viewer"]').textContent;
            return text.includes('Khóa chạm bắn pháo') && text.includes('Khóa chia sẻ');
        }, { timeout: 5000 }).catch(() => {});
        const tapSummary = await page.$eval('[data-summary="viewer"]', e => e.textContent);

        // Lưu qua API PHP
        await page.evaluate(() => saveConfig());
        await page.waitForFunction(() => !document.getElementById('share-modal').classList.contains('hide'), { timeout: 20000 }).catch(() => {});
        await page.evaluate(() => closeShareModal());
        const file = path.join(DIST, 'configs', `${ID}.json`);
        const cfg = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
        check('lưu kịch bản qua API', cfg && cfg.recipient === 'E2E Test' && cfg.startFrame === 'flower' && cfg.events[0].launchStyle === 'stealth',
            cfg ? JSON.stringify({ r: cfg.recipient, f: cfg.startFrame, l: cfg.events[0].launchStyle }) : 'không có file');
        check('tắt "Chạm màn hình để bắn pháo": lưu tapToLaunch: false, tóm tắt nhóm ghi rõ',
            cfg && cfg.tapToLaunch === false && tapSummary.includes('Khóa chạm bắn pháo'), JSON.stringify({ tap: cfg && cfg.tapToLaunch, tapSummary }));
        check('tắt "Cho người nhận chụp ảnh, tạo video, chia sẻ": lưu receiverShare: false, tóm tắt nhóm ghi rõ',
            cfg && cfg.receiverShare === false && tapSummary.includes('Khóa chia sẻ'), JSON.stringify({ share: cfg && cfg.receiverShare, tapSummary }));
        check('lưu kèm ảnh xem trước khi chia sẻ', fs.existsSync(path.join(DIST, 'configs', `${ID}.jpg`)));

        // Trang chia sẻ có tiêu đề cho mạng xã hội và chuyển tới màn trình diễn
        const html = await (await fetch(`${base}/s/${ID}`)).text();
        check('trang chia sẻ có og:title và chuyển tới màn trình diễn', html.includes('og:title') && html.includes(`demo?config=${ID}`));

        // Bản nháp: đã lưu thì không còn nháp; sửa thì có nháp; hoàn tác về bản đã lưu thì hết nháp
        await sleep(3500);
        check('đã lưu thì không giữ nháp', await page.evaluate(() => !localStorage.getItem('firework_builder_draft')));
        await page.$eval('#subtitle', i => { i.value = 'Sửa thêm'; i.dispatchEvent(new Event('input', { bubbles: true })); });
        await sleep(900);
        check('sửa thì tự lưu nháp', await page.evaluate(() => !!localStorage.getItem('firework_builder_draft')));
        await page.evaluate(() => document.activeElement.blur());
        await page.keyboard.down('Control');
        await page.keyboard.press('z');
        await page.keyboard.up('Control');
        await sleep(500);
        const undone = await page.evaluate(() => ({ subtitle: document.getElementById('subtitle').value, draft: !!localStorage.getItem('firework_builder_draft') }));
        check('Ctrl+Z hoàn tác và bỏ nháp khi về đúng bản đã lưu', undone.subtitle !== 'Sửa thêm' && !undone.draft, JSON.stringify(undone));

        // Mở lại kịch bản đã lưu
        await page.goto(base + '/builder', { waitUntil: 'networkidle0' });
        await page.evaluate(id => editScript(id), ID);
        await sleep(1500);
        const reopened = await page.evaluate(() => ({
            recipient: document.getElementById('recipient').value,
            frame: document.querySelector('#start-frame-grid .shell-option.selected')?.textContent.trim(),
            tap: document.getElementById('tap-to-launch').checked,
            share: document.getElementById('receiver-share').checked
        }));
        check('mở lại kịch bản đã lưu', reopened.recipient === 'E2E Test' && reopened.frame.endsWith('Hoa nở') && reopened.tap === false && reopened.share === false, JSON.stringify(reopened));

        // Xem nhanh như người nhận: nút quà hiện đúng màn mở quà, chạm mở trong khung thì chạy từ đầu kèm tiêu đề
        const preview = () => page.frames().find(f => f.url().includes('preview=1'));
        await page.click('#btn-gift-mini');
        await sleep(1000);
        const gift = await preview().evaluate(() => ({
            shown: !document.querySelector('.start-screen').classList.contains('remove'),
            title: document.querySelector('.gift-stage__title').textContent
        }));
        const clickable = await page.$eval('#mini-preview-stage', e => e.classList.contains('is-interactive'));
        check('xem nhanh như người nhận: hiện màn mở quà, cho chạm vào khung', gift.shown && gift.title === 'Gửi E2E Test' && clickable, JSON.stringify(gift));
        // Khung thu nhỏ bằng CSS transform: quy đổi tọa độ vật thể (mẫu 20/10: hoa nở) ra tọa độ trang
        const inner = await preview().$eval('.gift-stage__hero > *', b => { const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: innerWidth }; });
        const outer = await page.$eval('#mini-preview-frame', f => { const r = f.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width }; });
        await page.mouse.click(outer.x + inner.x * outer.w / inner.w, outer.y + inner.y * outer.w / inner.w);
        await sleep(2500);
        const opened = await preview().evaluate(() => ({
            hidden: document.querySelector('.start-screen').classList.contains('hide'),
            title: document.querySelector('.config-overlay h1')?.textContent || ''
        }));
        check('chạm vật thể mở quà trong khung xem nhanh: mở quà, chạy từ đầu kèm tiêu đề', opened.hidden && opened.title.length > 0, JSON.stringify(opened));

        // Nhân bản phát bắn: bản sao hiện ngay trong danh sách, ngay sau phát gốc
        await page.evaluate(() => setTimelineView('list'));
        const rowsBefore = await page.$$eval('.shot-row', rows => rows.length);
        await page.evaluate(() => document.querySelector('.shot-row').click());
        await sleep(300);
        await page.evaluate(() => document.querySelector('#inspector [title="Nhân bản"]').click());
        await sleep(300);
        const rowsAfter = await page.$$eval('.shot-row', rows => rows.length);
        check('nhân bản phát bắn: bản sao hiện ngay trong danh sách', rowsAfter === rowsBefore + 1, `${rowsBefore} → ${rowsAfter}`);

        // Đổi bản sao sang "Tạm dừng" rồi đổi lại được loại pháo khác
        const pick = name => page.evaluate(n => [...document.querySelectorAll('#inspector .shell-grid .shell-option')].find(b => b.textContent.trim().endsWith(n))?.click(), name);
        await pick('Tạm dừng');
        await sleep(300);
        await pick('Hoa cúc');
        await sleep(300);
        const backFromPause = await page.$eval('#inspector .shell-option.selected', b => b.textContent.trim()).catch(() => '');
        check('phát "Tạm dừng" vẫn đổi lại được loại pháo khác', backFromPause.endsWith('Hoa cúc'), backFromPause);
        check('builder không lỗi JS', page.errors.length === 0, page.errors.join(' | '));
    } finally {
        await page.close();
        removeConfig(ID);
    }
}
