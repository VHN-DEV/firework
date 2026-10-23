/*!
 * Trình diễn Pháo hoa – kiểm thử tự động
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Khung bắt đầu: mỗi kiểu dựng đúng vật thể, nút mở có chữ riêng; bấm nút thì chạy hiệu ứng mở (hạt bung ra) rồi vào màn
// trình diễn; mẫu theo dịp gắn đúng khung.
import { sleep, openPage } from './helpers.mjs';

const FRAMES = {
    gift: '.gift-box', lixi: '.hero--lixi', tree: '.hero--tree', cake: '.hero--cake', letter: '.hero--letter',
    invite: '.hero--invite', cap: '.hero--cap', flower: '.hero--flower', book: '.hero--book', lantern: '.hero--lantern'
};

export async function run(browser, base, { check }) {
    const page = await openPage(browser, { width: 1280, height: 760 });
    try {
        await page.goto(base + '/demo?preview=1', { waitUntil: 'networkidle0' });
        const results = {};
        for (const [frame, selector] of Object.entries(FRAMES)) {
            await page.evaluate(cfg => window.postMessage({ type: 'firework-preview', config: cfg, restart: true, startFrame: true }, location.origin),
                { loop: true, startFrame: frame, recipient: 'Lan', events: [{ burst: 1, shell: 'Hoa cúc', x: 50, y: 60 }] });
            await sleep(1600);
            const before = await page.evaluate(sel => ({
                hero: !!document.querySelector(`.gift-stage__hero ${sel}`),
                cta: document.querySelector('.gift-stage__cta').textContent.trim(),
                visible: getComputedStyle(document.querySelector('.gift-stage__cta')).opacity > 0.9
            }), selector);
            await page.click('.gift-stage__cta');
            // Sau nhịp lấy đà (dài nhất 650ms) hạt đã bung ra
            await sleep(800);
            const burst = await page.evaluate(() => !!document.querySelector('.confetti-layer'));
            await sleep(1300);
            const hidden = await page.evaluate(() => document.querySelector('.start-screen').classList.contains('hide'));
            results[frame] = { ...before, burst, hidden };
        }
        const bad = Object.entries(results).filter(([, r]) => !(r.hero && r.cta && r.visible && r.burst && r.hidden));
        check('mỗi khung bắt đầu: hiện vật thể, nút mở có chữ; bấm mở thì hạt bung ra rồi vào màn trình diễn',
            bad.length === 0, JSON.stringify(bad.length ? Object.fromEntries(bad) : Object.fromEntries(Object.entries(results).map(([k, r]) => [k, r.cta]))));
        check('khung bắt đầu không lỗi JS', page.errors.length === 0, page.errors.join(' | '));
    } finally {
        await page.close();
    }

    const builder = await openPage(browser, { width: 1440, height: 900 });
    try {
        await builder.goto(base + '/builder', { waitUntil: 'networkidle0' });
        await builder.evaluate(() => localStorage.clear());
        const draftFrame = () => builder.evaluate(() => {
            const d = JSON.parse(localStorage.getItem('firework_builder_draft') || 'null');
            return d && d.config ? d.config.startFrame ?? null : null;
        });
        const frames = {};
        for (const occasion of ['sinh_nhat', 'nam_moi', 'trung_thu']) {
            await builder.evaluate(id => openTemplatesModal(id), occasion);
            await builder.click('#tpl-recipient', { clickCount: 3 });
            await builder.type('#tpl-recipient', 'Lan');
            await builder.click('#btn-create-template');
            await sleep(1500);
            frames[occasion] = await draftFrame();
        }
        check('mẫu theo dịp gắn khung hợp dịp (sinh nhật: bánh, Tết: lì xì, Trung thu: đèn lồng)',
            frames.sinh_nhat === 'cake' && frames.nam_moi === 'lixi' && frames.trung_thu === 'lantern', JSON.stringify(frames));
        const options = await builder.$$eval('#start-frame-grid .shell-option', els => els.length);
        check('builder: lưới chọn có đủ 11 khung bắt đầu', options === 11, String(options));
        check('khung bắt đầu trong builder không lỗi JS', builder.errors.length === 0, builder.errors.join(' | '));
    } finally {
        await builder.close();
    }
}
