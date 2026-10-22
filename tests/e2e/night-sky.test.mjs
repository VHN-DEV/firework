/*!
 * Trình diễn Pháo hoa – kiểm thử tự động
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Bầu trời đêm: sao vẽ được, Dải Ngân Hà dựng dần rồi hiện (quầng mờ phủ một dải trời), sao băng vụt qua; đèn trời,
// khinh khí cầu, máy bay sáng và bay; builder chọn sao băng, Ngân Hà, lưu đúng, tóm tắt ghi rõ.
import { sleep, openPage } from './helpers.mjs';

const show = (page, cfg) => page.evaluate(config => window.postMessage({ type: 'firework-preview', config, restart: true }, location.origin),
    { loop: true, events: [], ...cfg });

// Lớp bầu trời, phần trời phía trên (part: tỉ lệ chiều cao): số điểm có vẽ (alpha > 0) và số điểm sáng rõ
const skyPixels = (page, part = 0.4) => page.evaluate(part => {
    const c = document.getElementById('deco-canvas');
    const d = c.getContext('2d').getImageData(0, 0, c.width, Math.round(c.height * part)).data;
    let any = 0;
    let lit = 0;
    for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] > 0) any++;
        if (d[i + 3] > 120 && d[i] + d[i + 1] + d[i + 2] > 450) lit++;
    }
    return { any, lit };
}, part);

export async function run(browser, base, { check }) {
    const page = await openPage(browser, { width: 1280, height: 720 });
    try {
        await page.goto(base + '/index.html?preview=1', { waitUntil: 'networkidle0' });
        await show(page, { stars: 'many' });
        await sleep(2500);
        const stars = await skyPixels(page);
        check('sao: có sao sáng và hàng nghìn sao mờ', stars.lit > 20 && stars.any > 1500, JSON.stringify(stars));

        await show(page, { stars: 'many', milkyWay: 'bright' });
        await sleep(3500);
        const milky = await skyPixels(page);
        check('Dải Ngân Hà: quầng mờ phủ một dải trời', milky.any > stars.any * 4, JSON.stringify({ stars, milky }));

        // Chỉ có sao băng (không sao, không Ngân Hà, không mặt nước): điểm sáng nào trên lớp trời cũng là sao băng. Sao
        // băng vụt qua trong chưa tới một giây nên lấy mẫu dày, chờ tới khi thấy
        await show(page, { meteors: 'shower' });
        let streak = 0;
        for (let i = 0; i < 120 && streak <= 20; i++) {
            await sleep(100);
            streak = (await skyPixels(page, 1)).any;
        }
        check('mưa sao băng: có sao băng vụt qua', streak > 20, String(streak));

        // Đèn trời, khinh khí cầu, máy bay: có ánh lửa ấm trên trời, và bay (hình đổi theo thời gian)
        await show(page, { decor: ['lanterns', 'balloons', 'planes'] });
        await sleep(2500);
        const warm = () => page.evaluate(() => {
            const c = document.getElementById('deco-canvas');
            const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
            let n = 0;
            let sum = 0;
            for (let i = 0; i < d.length; i += 4) {
                if (d[i + 3] > 100 && d[i] > 200 && d[i + 1] > 110 && d[i + 2] < 140) {
                    n++;
                    sum += i % 7919;
                }
            }
            return { n, sum };
        });
        const a = await warm();
        await sleep(1500);
        const b = await warm();
        check('đèn trời, khinh khí cầu: có ánh lửa ấm trên trời và bay đi', a.n > 40 && b.n > 40 && a.sum !== b.sum, JSON.stringify({ a, b }));
        check('bầu trời sao không lỗi JS', page.errors.length === 0, page.errors.join(' | '));
    } finally {
        await page.close();
    }

    const builder = await openPage(browser, { width: 1440, height: 900 });
    try {
        await builder.goto(base + '/builder.html', { waitUntil: 'networkidle0' });
        await builder.evaluate(() => {
            localStorage.clear();
            const title = document.getElementById('title');
            title.value = 'Thử bầu trời sao';
            title.dispatchEvent(new Event('input', { bubbles: true }));
            setMeteors('shower');
            setMilkyWay('bright');
        });
        await sleep(1200);
        const saved = await builder.evaluate(() => {
            const d = JSON.parse(localStorage.getItem('firework_builder_draft') || 'null');
            return d && d.config ? { meteors: d.config.meteors ?? null, milkyWay: d.config.milkyWay ?? null } : null;
        });
        const summary = await builder.$eval('[data-summary="scene"]', e => e.textContent).catch(() => '');
        const active = await builder.evaluate(() => [...document.querySelectorAll('.sky-meteors .active, .sky-milky-way .active')].map(b => b.textContent.trim()));
        check('builder: chọn mưa sao băng, Ngân Hà rõ thì lưu meteors, milkyWay; tóm tắt ghi rõ',
            saved && saved.meteors === 'shower' && saved.milkyWay === 'bright' && /Mưa sao băng/.test(summary) && /Ngân Hà rõ/.test(summary)
                && active.join(',') === 'Nhiều,Rõ',
            JSON.stringify({ saved, summary, active }));
        await builder.evaluate(() => {
            setMeteors('');
            setMilkyWay('');
        });
        await sleep(1200);
        check('builder: bầu trời sao không lỗi JS', builder.errors.length === 0, builder.errors.join(' | '));
    } finally {
        await builder.close();
    }
}
