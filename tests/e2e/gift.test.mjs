/*!
 * Trình diễn Pháo hoa – kiểm thử tự động
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Báo mở quà: người gửi lưu kịch bản (nhận mã theo dõi), người nhận mở link và mở quà ở trình duyệt khác,
// người gửi tự xem thử thì không tính, builder báo đã mở, trang theo dõi, dữ liệu không tải trực tiếp được.
import fs from 'fs';
import path from 'path';
import { DIST, sleep, openPage, removeConfig } from './helpers.mjs';

const ID = 'zz_e2e_gift';

export async function run(browser, base, { check }) {
    const status = async key => {
        const res = await fetch(`${base}/api/opens.php?action=status`, { method: 'POST', body: JSON.stringify({ items: [{ id: ID, key }] }) });
        return (await res.json()).items[0];
    };
    removeConfig(ID);
    let recipientCtx = null;
    const sender = await openPage(browser, { width: 1440, height: 900 });
    try {
        // Người gửi: lưu kịch bản đang bật "Báo cho tôi khi người nhận mở quà"
        await sender.goto(base + '/builder.html', { waitUntil: 'networkidle0' });
        await sender.evaluate(() => { localStorage.clear(); openTemplatesModal('sinh_nhat'); });
        await sender.type('#tpl-recipient', 'Mẹ');
        await sender.click('#btn-create-template');
        await sleep(500);
        await sender.$eval('#filename', (i, id) => { i.value = id; }, ID);
        await sender.evaluate(() => saveConfig());
        await sender.waitForFunction(() => !document.getElementById('share-modal').classList.contains('hide'), { timeout: 20000 });
        await sender.waitForFunction(() => /chưa mở link/.test(document.getElementById('share-track-status').textContent), { timeout: 10000 }).catch(() => {});
        const key = await sender.evaluate(id => JSON.parse(localStorage.getItem('firework_owner_keys') || '{}')[id], ID);
        const link = await sender.$eval('#share-track-input', i => i.value);
        check('lưu kịch bản: người gửi có mã và link theo dõi riêng', /^[a-f0-9]{32}$/.test(key || '') && link.includes(`theo-doi.html?id=${ID}`), key);
        await sender.evaluate(() => closeShareModal());
        check('dữ liệu theo dõi không tải trực tiếp được', (await fetch(`${base}/api/data/owners/${ID}.json`)).status === 403);

        // Người nhận: trình duyệt khác, mở link rồi mở quà
        recipientCtx = await browser.createBrowserContext();
        const recipient = await recipientCtx.newPage();
        await recipient.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
        await recipient.goto(`${base}/index.html?config=${ID}`, { waitUntil: 'networkidle0' });
        await recipient.waitForSelector('.start-screen.is-ready');
        check('người nhận được báo trước "Người gửi sẽ biết khi bạn mở quà"',
            /Người gửi sẽ biết khi bạn mở quà/.test(await recipient.$eval('.start-screen__legal', e => e.textContent)));
        await recipient.tap('.gift-box');
        await sleep(1500);
        let s = await status(key);
        check('ghi nhận người nhận mở link và mở quà (điện thoại)', s.ok && s.counts.view === 1 && s.counts.open === 1 && s.events[0].d === 'mobile', JSON.stringify(s.counts));

        // Người gửi tự xem thử: không tính
        const own = await sender.browserContext().newPage();
        await own.goto(`${base}/index.html?config=${ID}`, { waitUntil: 'networkidle0' });
        await sleep(1200);
        await own.close();
        s = await status(key);
        check('người gửi tự xem thử thì không tính', s.counts.view === 1, JSON.stringify(s.counts));

        // Builder báo cho người gửi
        await sender.evaluate(() => checkGiftOpens());
        await sleep(1500);
        const toast = await sender.evaluate(() => [...document.querySelectorAll('.toast')].map(t => t.textContent).find(t => /đã mở quà/.test(t)) || '');
        check('builder báo người nhận đã mở quà', /Mẹ đã mở quà/.test(toast), toast.trim());

        // Trang theo dõi riêng
        const tracker = await recipientCtx.newPage();
        await tracker.goto(link, { waitUntil: 'networkidle0' });
        await tracker.waitForSelector('#gift-status:not(.hide)', { timeout: 10000 }).catch(() => {});
        const done = await tracker.$$eval('.track-steps li.done', els => els.map(li => li.dataset.step).join());
        check('trang theo dõi hiện đã mở link, đã mở quà', done === 'view,open', done);
        await tracker.close();

        // Xóa kịch bản thì xóa luôn dữ liệu theo dõi
        await fetch(`${base}/api/manage_configs.php?action=delete`, { method: 'POST', body: JSON.stringify({ filename: ID, key }) });
        const left = ['owners', 'opens'].filter(k => fs.existsSync(path.join(DIST, 'api/data', k, `${ID}.json`)));
        check('xóa kịch bản thì xóa luôn dữ liệu theo dõi', left.length === 0, left.join(', '));
        check('báo mở quà không lỗi JS', sender.errors.length === 0, sender.errors.join(' | '));
    } finally {
        await sender.close();
        if (recipientCtx) await recipientCtx.close();
        removeConfig(ID);
        for (const kind of ['owners', 'opens']) fs.rmSync(path.join(DIST, 'api/data', kind, `${ID}.json`), { force: true });
    }
}
