/*!
 * Hanabi – kiểm thử tự động
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Báo mở quà: người gửi lưu kịch bản (nhận mã theo dõi), người nhận mở link và mở quà ở trình duyệt khác,
// người gửi tự xem thử thì không tính, builder báo đã mở, người nhận gửi lời cảm ơn (người gửi đọc trong hộp Chia sẻ, trang
// theo dõi), kịch bản lặp xem trọn một lượt thì tính là xem hết, dữ liệu không tải trực tiếp được.
import fs from 'fs';
import path from 'path';
import { DIST, sleep, openPage, removeConfig } from './helpers.mjs';

const ID = 'zz_e2e_gift';
const LOOP_ID = 'zz_e2e_gift_loop';

export async function run(browser, base, { check }) {
    const status = async (key, id = ID) => {
        const res = await fetch(`${base}/api/opens.php?action=status`, { method: 'POST', body: JSON.stringify({ items: [{ id, key }] }) });
        return (await res.json()).items[0];
    };
    removeConfig(ID);
    removeConfig(LOOP_ID);
    let recipientCtx = null;
    const sender = await openPage(browser, { width: 1440, height: 900 });
    try {
        // Người gửi: lưu kịch bản đang bật "Báo cho tôi khi người nhận mở quà"
        await sender.goto(base + '/builder', { waitUntil: 'networkidle0' });
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
        check('lưu kịch bản: người gửi có mã và link theo dõi riêng', /^[a-f0-9]{32}$/.test(key || '') && link.includes(`theo-doi?id=${ID}`), key);
        const openHref = await sender.$eval('#share-track-open', a => a.href);
        check('hộp Chia sẻ có nút Mở trang theo dõi', openHref === link, openHref);
        await sender.evaluate(() => closeShareModal());
        check('dữ liệu theo dõi không tải trực tiếp được', (await fetch(`${base}/api/data/owners/${ID}.json`)).status === 403);

        // Người nhận: trình duyệt khác, mở link rồi mở quà
        recipientCtx = await browser.createBrowserContext();
        const recipient = await recipientCtx.newPage();
        await recipient.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
        await recipient.goto(`${base}/demo?config=${ID}`, { waitUntil: 'networkidle0' });
        await recipient.waitForSelector('.start-screen.is-ready');
        check('người nhận được báo trước "Người gửi sẽ biết khi bạn mở quà"',
            /Người gửi sẽ biết khi bạn mở quà/.test(await recipient.$eval('.start-screen__legal', e => e.textContent)));
        await recipient.tap('.gift-stage__cta');
        await sleep(1500);
        let s = await status(key);
        check('ghi nhận người nhận mở link và mở quà (điện thoại)', s.ok && s.counts.view === 1 && s.counts.open === 1 && s.events[0].d === 'mobile', JSON.stringify(s.counts));

        // Người gửi tự xem thử: không tính
        const own = await sender.browserContext().newPage();
        await own.goto(`${base}/demo?config=${ID}`, { waitUntil: 'networkidle0' });
        await sleep(1200);
        await own.close();
        s = await status(key);
        check('người gửi tự xem thử thì không tính', s.counts.view === 1, JSON.stringify(s.counts));

        // Builder báo cho người gửi
        await sender.evaluate(() => checkGiftOpens());
        await sleep(1500);
        const toast = await sender.evaluate(() => [...document.querySelectorAll('.toast')].map(t => t.textContent).find(t => /đã mở quà/.test(t)) || '');
        check('builder báo người nhận đã mở quà', /Mẹ đã mở quà/.test(toast), toast.trim());
        await sender.evaluate(() => openScriptsModal());
        const cardTrack = await sender.waitForFunction(id => {
            const a = document.querySelector(`#scripts-list .script-item[data-id="${id}"] .script-actions a[href*="theo-doi"]`);
            return a && a.href;
        }, { timeout: 10000 }, ID).then(h => h.jsonValue()).catch(() => '');
        await sender.evaluate(() => hideModal('scripts-modal'));
        check('thẻ kịch bản trong danh sách Của tôi có nút Theo dõi', cardTrack === link, cardTrack);

        // Người nhận gửi lời cảm ơn: nút ♥ ở góc dưới, tên điền sẵn tên người nhận
        const MESSAGE = 'Cảm ơn con, mẹ vui lắm!';
        await recipient.waitForSelector('.moment-bar__reply:not(.remove)', { visible: true, timeout: 5000 }).catch(() => {});
        const replyButton = !!(await recipient.$('.moment-bar__reply:not(.remove)'));
        if (replyButton) await recipient.tap('.moment-bar__reply');
        await recipient.waitForSelector('.reply-sheet:not(.hide)', { timeout: 5000 }).catch(() => {});
        const prefilled = await recipient.$eval('.reply-name', i => i.value);
        await recipient.type('.reply-message', MESSAGE);
        await recipient.tap('.reply-send');
        await recipient.waitForSelector('.reply-sheet.is-sent', { timeout: 10000 }).catch(() => {});
        const sent = await recipient.$eval('.reply-sheet', e => e.classList.contains('is-sent'));
        s = await status(key);
        check('người nhận bấm ♥ gửi lời cảm ơn (tên điền sẵn), máy chủ lưu', replyButton && prefilled === 'Mẹ' && sent
            && s.replies && s.replies.length === 1 && s.replies[0].message === MESSAGE && s.replies[0].name === 'Mẹ',
            JSON.stringify({ replyButton, prefilled, sent, replies: s.replies }));
        await sender.evaluate(() => checkGiftOpens());
        await sleep(1500);
        const replyToast = await sender.evaluate(() => [...document.querySelectorAll('.toast')].map(t => t.textContent).find(t => /lời cảm ơn/.test(t)) || '');
        await sender.evaluate(() => openShareModal());
        await sender.waitForSelector('#share-track-replies:not(.hide) li', { timeout: 10000 }).catch(() => {});
        const inShare = await sender.$eval('#share-track-replies', e => e.textContent).catch(() => '');
        await sender.evaluate(() => closeShareModal());
        check('người gửi được báo có lời cảm ơn, đọc trong hộp Chia sẻ', replyToast.includes(MESSAGE) && inShare.includes(MESSAGE) && inShare.includes('Mẹ'),
            JSON.stringify({ replyToast: replyToast.trim(), inShare: inShare.trim() }));

        // Trang theo dõi riêng
        const tracker = await recipientCtx.newPage();
        await tracker.goto(link, { waitUntil: 'networkidle0' });
        await tracker.waitForSelector('#gift-status:not(.hide)', { timeout: 10000 }).catch(() => {});
        const done = await tracker.$$eval('.track-steps li.done', els => els.map(li => li.dataset.step).join());
        // Màn trình diễn của người nhận vẫn đang chạy: chạy hết lượt đầu thì có thêm Xem hết
        check('trang theo dõi hiện đã mở link, đã mở quà', /^view,open(,finish)?$/.test(done), done);
        const trackedReply = await tracker.$eval('#gift-replies', e => e.textContent).catch(() => '');
        check('trang theo dõi hiện lời cảm ơn', trackedReply.includes('Cảm ơn con, mẹ vui lắm!'), trackedReply.trim());
        await tracker.close();

        // Kịch bản lặp (builder để Lặp lại bật sẵn) không bao giờ tới màn kết: xem trọn một lượt vẫn tính là xem hết, một lần
        const looped = await (await fetch(`${base}/api/save_config.php`, {
            method: 'POST',
            body: JSON.stringify({ filename: LOOP_ID, config: { title: 'Lặp', loop: true, notifyOpen: true, events: [{ burst: 1, shell: 'Liễu', x: 50, y: 60, delay: 0, color: 'Gold' }] } })
        })).json();
        const looper = await recipientCtx.newPage();
        await looper.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
        await looper.goto(`${base}/demo?config=${LOOP_ID}`, { waitUntil: 'networkidle0' });
        await looper.waitForSelector('.start-screen.is-ready');
        await looper.tap('.btn-start');
        let loopCounts = {};
        for (let i = 0; i < 30 && !loopCounts.finish; i++) {
            await sleep(1000);
            loopCounts = ((await status(looped.trackKey, LOOP_ID)) || {}).counts || {};
        }
        await sleep(6000);
        const loopAgain = ((await status(looped.trackKey, LOOP_ID)) || {}).counts || {};
        await looper.close();
        check('kịch bản lặp: xem trọn một lượt thì tính là xem hết, lặp lại không tính thêm', loopCounts.finish === 1 && loopAgain.finish === 1,
            JSON.stringify({ loopCounts, loopAgain }));
        await fetch(`${base}/api/manage_configs.php?action=delete`, { method: 'POST', body: JSON.stringify({ filename: LOOP_ID, key: looped.trackKey }) });

        // Xóa kịch bản thì xóa luôn dữ liệu theo dõi
        await fetch(`${base}/api/manage_configs.php?action=delete`, { method: 'POST', body: JSON.stringify({ filename: ID, key }) });
        const left = ['owners', 'opens', 'replies'].filter(k => fs.existsSync(path.join(DIST, 'api/data', k, `${ID}.json`)));
        check('xóa kịch bản thì xóa luôn dữ liệu theo dõi', left.length === 0, left.join(', '));
        check('báo mở quà không lỗi JS', sender.errors.length === 0, sender.errors.join(' | '));
    } finally {
        await sender.close();
        if (recipientCtx) await recipientCtx.close();
        for (const id of [ID, LOOP_ID]) {
            removeConfig(id);
            for (const kind of ['owners', 'opens', 'replies']) fs.rmSync(path.join(DIST, 'api/data', kind, `${id}.json`), { force: true });
        }
    }
}
