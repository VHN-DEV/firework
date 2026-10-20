/*!
 * Trình diễn Pháo hoa – kiểm thử tự động
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
        await page.goto(base + '/builder.html', { waitUntil: 'networkidle0' });
        check('builder mới mở: có dải "Tạo nhanh theo dịp"', await page.$eval('#template-strip', e => !e.classList.contains('hide')));

        // Nút "?" giải thích: bấm thì hiện, không bật/tắt công tắc chứa nó, Esc để đóng
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
        check('mẫu theo dịp điền đủ kịch bản', created.title.includes('20/10') && created.recipient === 'E2E Test' && created.filename === ID && created.shots > 25 && created.frame.endsWith('Hộp quà'), JSON.stringify(created));

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

        // Lưu qua API PHP
        await page.evaluate(() => saveConfig());
        await page.waitForFunction(() => !document.getElementById('share-modal').classList.contains('hide'), { timeout: 20000 }).catch(() => {});
        await page.evaluate(() => closeShareModal());
        const file = path.join(DIST, 'configs', `${ID}.json`);
        const cfg = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
        check('lưu kịch bản qua API', cfg && cfg.recipient === 'E2E Test' && cfg.startFrame === 'gift' && cfg.events[0].launchStyle === 'stealth',
            cfg ? JSON.stringify({ r: cfg.recipient, f: cfg.startFrame, l: cfg.events[0].launchStyle }) : 'không có file');
        check('lưu kèm ảnh xem trước khi chia sẻ', fs.existsSync(path.join(DIST, 'configs', `${ID}.jpg`)));

        // Trang chia sẻ có tiêu đề cho mạng xã hội và chuyển tới màn trình diễn
        const html = await (await fetch(`${base}/s/${ID}.html`)).text();
        check('trang chia sẻ có og:title và chuyển tới màn trình diễn', html.includes('og:title') && html.includes(`index.html?config=${ID}`));

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
        await page.goto(base + '/builder.html', { waitUntil: 'networkidle0' });
        await page.evaluate(id => editScript(id), ID);
        await sleep(1500);
        const reopened = await page.evaluate(() => ({
            recipient: document.getElementById('recipient').value,
            frame: document.querySelector('#start-frame-grid .shell-option.selected')?.textContent.trim()
        }));
        check('mở lại kịch bản đã lưu', reopened.recipient === 'E2E Test' && reopened.frame.endsWith('Hộp quà'), JSON.stringify(reopened));
        check('builder không lỗi JS', page.errors.length === 0, page.errors.join(' | '));
    } finally {
        await page.close();
        removeConfig(ID);
    }
}
