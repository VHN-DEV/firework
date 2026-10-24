/*!
 * Hanabi – kiểm thử tự động
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Trang tĩnh (GitHub Pages: không có máy chủ lưu kịch bản): tên miền *.github.io trỏ về máy chủ thử (STATIC_HOST). Builder
// lưu kịch bản trong trình duyệt, link chia sẻ chứa sẵn cả kịch bản (demo#k=...) nên mở ở trình duyệt khác (không có bản
// lưu) vẫn đúng; kịch bản dài không vừa mã QR; ảnh tự tải lên không gói vào link (có báo); Xem thử mở link chứa kịch bản.
// Bản GitHub Pages sau khi trang chính chuyển đi (build có MOVED_FROM, seo-plugin.js): mở đúng trang ở trang chính.
import fs from 'fs';
import path from 'path';
import { movedScript } from '../../seo-plugin.js';
import { DIST, STATIC_HOST, sleep } from './helpers.mjs';

// Trang mới trong một "trình duyệt" riêng (không chung localStorage), ghi lỗi JS
async function freshPage(browser) {
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    page.errors = [];
    page.on('pageerror', e => page.errors.push(e.message));
    return { context, page };
}

export async function run(browser, base, { check }) {
    const host = base.replace('127.0.0.1', STATIC_HOST);
    const read = name => JSON.parse(fs.readFileSync(path.join(DIST, 'configs', `${name}.json`), 'utf8'));
    const long = read('roi_ta_se_ngam_phao_hoa');
    const short = { ...read('christmas'), title: 'Thử link chứa kịch bản' };
    const withImage = { ...short, title: 'Có ảnh tự tải', events: [...short.events, { burst: 99, shell: 'Hình ảnh', imageUrl: `data:image/png;base64,${'A'.repeat(4000)}`, x: 50, y: 50 }] };

    const { context, page } = await freshPage(browser);
    try {
        await page.goto(`${host}/builder`, { waitUntil: 'networkidle0' });
        await page.evaluate(scripts => localStorage.setItem('my_firework_scripts', JSON.stringify(scripts)), { zz_dai: long, zz_ngan: short, zz_anh: withImage });
        // Mở kịch bản đã lưu trong trình duyệt, bấm Lưu, đọc hộp Chia sẻ
        const share = async id => {
            await page.goto(`${host}/builder`, { waitUntil: 'networkidle0' });
            await page.evaluate(name => editScript(name), id);
            await sleep(1200);
            await page.evaluate(() => saveConfig());
            await page.waitForFunction(() => !document.getElementById('share-modal').classList.contains('hide')
                && document.getElementById('share-link-input').value.includes('#k='), { timeout: 30000 }).catch(() => {});
            return page.evaluate(() => ({
                url: document.getElementById('share-link-input').value,
                bar: document.getElementById('share-url').textContent,
                warning: document.getElementById('share-warning').textContent,
                qr: !document.getElementById('share-qr').classList.contains('hide') && !document.getElementById('btn-share-qr').classList.contains('hide')
            }));
        };
        // Mở link ở trình duyệt khác: tiêu đề tab theo kịch bản, không có bản lưu nào
        const view = async (url, title) => {
            const other = await freshPage(browser);
            try {
                await other.page.goto(url, { waitUntil: 'networkidle0' });
                const shown = await other.page.waitForFunction(t => document.title.includes(t), { timeout: 15000 }, title).then(() => true, () => false);
                const stored = await other.page.evaluate(() => localStorage.getItem('my_firework_scripts'));
                return { shown: shown && !stored, title: await other.page.title(), errors: other.page.errors };
            } finally {
                await other.context.close();
            }
        };

        const big = await share('zz_dai');
        check('trang tĩnh: link chia sẻ chứa sẵn kịch bản (demo#k=...), thanh chia sẻ cũng vậy',
            /\/demo#k=[A-Za-z0-9_-]+$/.test(big.url) && big.bar === big.url, big.url.slice(0, 120));
        check('trang tĩnh: hộp Chia sẻ giải thích link chứa sẵn cả kịch bản', big.warning.includes('link chứa sẵn cả kịch bản'), big.warning);
        check('kịch bản dài: link không vừa mã QR thì ẩn mã QR, nút tải mã QR', !big.qr, `${big.url.length} ký tự`);
        const seen = await view(big.url, long.title);
        check('mở link ở trình duyệt khác (không có bản lưu): đúng kịch bản đã lưu, không lỗi JS', seen.shown && !seen.errors.length,
            JSON.stringify({ title: seen.title, errors: seen.errors }));

        const small = await share('zz_ngan');
        check('kịch bản ngắn: link chứa kịch bản vẫn có mã QR', small.qr, `${small.url.length} ký tự`);
        check('kịch bản ngắn mở ở trình duyệt khác đúng kịch bản', (await view(small.url, short.title)).shown);

        const image = await share('zz_anh');
        check('ảnh tự tải lên không gói vào link, hộp Chia sẻ báo rõ', !image.url.includes('AAAA') && image.warning.includes('1 ảnh bạn tự tải lên'), image.warning);

        // Xem thử: tab mở ra là link chứa sẵn kịch bản (chép link ở đó gửi người khác vẫn đúng)
        await page.goto(`${host}/builder`, { waitUntil: 'networkidle0' });
        await page.evaluate(() => editScript('zz_ngan'));
        await sleep(1000);
        const opened = new Promise(resolve => context.on('targetchanged', t => { if (t.url().includes('/demo')) resolve(t.url()); }));
        await page.evaluate(() => previewConfig());
        const tab = await Promise.race([opened, sleep(15000).then(() => '')]);
        check('Xem thử trên trang tĩnh mở link chứa sẵn kịch bản', tab.includes('/demo#k='), tab.slice(0, 100));
        check('builder trên trang tĩnh không lỗi JS', !page.errors.length, page.errors.join(' | '));
    } finally {
        await context.close();
    }
    await moved(browser, check);
}

// Trang của bản cũ, bản mới giả lập bằng chặn request (không cần mạng): bản cũ trả trang có đoạn chuyển trang của build
// thật, __setup là trang không có đoạn đó để ghi localStorage của tên miền cũ
async function moved(browser, check) {
    const FROM = 'https://hanabi-cu.example/firework/';
    const TO = 'https://hanabi-moi.example/';
    const { context, page } = await freshPage(browser);
    try {
        await page.setRequestInterception(true);
        page.on('request', r => {
            const url = r.url();
            if (!url.startsWith(FROM)) return r.respond({ contentType: 'text/html; charset=utf-8', body: '<!DOCTYPE html><html><body>mới</body></html>' });
            const name = url.slice(FROM.length).split(/[?#]/)[0].replace(/\.html$/, '').split('/')[0] || 'index';
            const script = name === '__setup' ? '' : movedScript(name, FROM, TO);
            return r.respond({ contentType: 'text/html; charset=utf-8', body: `<!DOCTYPE html><html><head><meta charset="UTF-8">${script}</head><body>cũ</body></html>` });
        });
        const open = async rel => {
            await page.goto(FROM + rel, { waitUntil: 'load' });
            await page.waitForFunction(() => document.body && document.body.textContent.length, { timeout: 5000 }).catch(() => {});
            await sleep(300);
            return page.url();
        };
        const packed = await open('demo?config=christmas#k=abc');
        const builder = await open('builder');
        const share = await open('s/christmas');
        check('bản cũ mở đúng trang ở trang chính, giữ ?config=, #k=', packed === `${TO}demo?config=christmas#k=abc` && builder === `${TO}builder` && share === `${TO}s/christmas`,
            `${packed} | ${builder} | ${share}`);

        await open('__setup');
        await page.evaluate(() => localStorage.setItem('my_firework_scripts', JSON.stringify({ zz_cua_toi: { events: [] } })));
        const kept = await open('builder');
        const notice = await page.$eval('#moved-notice a', a => a.href).catch(() => '');
        const local = await open('demo?config=zz_cua_toi');
        const other = await open('demo?config=christmas');
        check('bản cũ: builder còn kịch bản trong trình duyệt thì ở lại, báo cách chuyển sang trang mới', kept === `${FROM}builder` && notice === `${TO}builder`,
            `${kept} ${notice}`);
        check('bản cũ: kịch bản lưu trong trình duyệt vẫn xem được, kịch bản khác chuyển sang trang chính', local === `${FROM}demo?config=zz_cua_toi` && other === `${TO}demo?config=christmas`,
            `${local} | ${other}`);
        check('bản build thường không chèn đoạn chuyển trang', !movedScript('builder', '') && !fs.readFileSync(path.join(DIST, 'builder.html'), 'utf8').includes('movedRedirect'));
    } finally {
        await context.close();
    }
}
