/*!
 * Trình diễn Pháo hoa – kiểm thử tự động
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Người ngắm pháo (people): có mặt nước thì nhân vật anime đi vào từ mép khung, đứng ở bờ bên này (lớp trước cùng);
// tắt người hoặc không có mặt nước thì lớp trống; mưa thì có ô; builder chọn, lưu đúng, tắt mặt nước thì không lưu.
import { sleep, openPage } from './helpers.mjs';
import { validPeople } from '../../src/assets/js/player/people-options.js';

// Điểm có hình của lớp người trong dải phía trên bờ (không tính dải bờ đất ở đáy): tổng số và số ở nửa trái, nửa phải
const figures = page => page.evaluate(() => {
    const c = document.getElementById('front-canvas');
    const g = c.getContext('2d');
    const top = Math.round(c.height * 0.55);
    const h = Math.round(c.height * 0.36);
    const d = g.getImageData(0, top, c.width, h).data;
    let n = 0, left = 0, right = 0, center = 0;
    for (let i = 0; i < d.length; i += 16) {
        if (d[i + 3] < 200) continue;
        n++;
        const x = (i / 4) % c.width;
        if (x < c.width * 0.35) left++;
        else if (x > c.width * 0.65) right++;
        else center++;
    }
    const band = g.getImageData(0, c.height - 3, c.width, 1).data;
    let ground = 0;
    for (let i = 3; i < band.length; i += 4) if (band[i] > 200) ground++;
    return { n, left, right, center, ground: ground / c.width };
});

const post = (page, cfg) => page.evaluate(c => window.postMessage({ type: 'firework-preview', config: c, restart: true }, location.origin), cfg);

export async function run(browser, base, { check }) {
    check('chỉ nhận đúng các lựa chọn người ngắm pháo', validPeople('couple') === 'couple' && validPeople('man') === 'man' && validPeople('x') === '' && validPeople('') === '');
    const page = await openPage(browser, { width: 700, height: 700 });
    try {
        await page.goto(base + '/index.html?preview=1', { waitUntil: 'networkidle0' });
        const events = [{ burst: 1, shell: 'Hoa cúc', color: 'Gold', x: 50, y: 70 }];
        await post(page, { loop: true, events, water: 'half', people: 'couple' });
        // Chờ theo điều kiện (máy chậm thì tải nhân vật lâu hơn), tối đa chừng ấy giây
        const waitFor = async (test, seconds) => {
            let last = null;
            for (let i = 0; i < seconds * 2; i++) {
                await sleep(500);
                last = await figures(page);
                if (test(last)) break;
            }
            return last;
        };
        const entering = await waitFor(f => f.left > 30, 12);
        check('có người: bờ bên này hiện ở đáy khung', entering.ground > 0.9, JSON.stringify(entering));
        check('chàng trai đi vào từ mép trái', entering.left > 30, JSON.stringify(entering));
        const both = await waitFor(f => f.right > 30, 12);
        check('cô gái đi vào từ mép phải', both.right > 30, JSON.stringify(both));
        const met = await waitFor(f => f.center > 300 && f.left < f.center * 0.25 && f.right < f.center * 0.25, 25);
        check('cặp đôi gặp nhau ở giữa bờ', met.center > 300 && met.left < met.center * 0.25 && met.right < met.center * 0.25, JSON.stringify(met));

        await post(page, { loop: true, events, water: 'half', people: 'woman', weather: 'rain' });
        const solo = await waitFor(f => f.center > 200 && f.left < f.center * 0.25, 20);
        check('một mình, trời mưa: cô gái che ô đi ra giữa bờ', solo.center > 200, JSON.stringify(solo));

        await post(page, { loop: true, events, water: 'half' });
        await sleep(600);
        const none = await figures(page);
        check('tắt người ngắm pháo thì lớp người trống', none.n === 0 && none.ground === 0, JSON.stringify(none));
        await post(page, { loop: true, events, people: 'couple' });
        await sleep(600);
        const dry = await figures(page);
        check('không có mặt nước thì không có người', dry.n === 0 && dry.ground === 0, JSON.stringify(dry));
        check('người ngắm pháo không lỗi JS', page.errors.length === 0, page.errors.join(' | '));
    } finally {
        await page.close();
    }

    const builder = await openPage(browser, { width: 1440, height: 900 });
    try {
        await builder.goto(base + '/builder.html', { waitUntil: 'networkidle0' });
        await builder.evaluate(() => {
            localStorage.clear();
            const title = document.getElementById('title');
            title.value = 'Thử người ngắm pháo';
            title.dispatchEvent(new Event('input', { bubbles: true }));
            setWater('half');
        });
        await builder.evaluate(() => document.querySelector('[data-people="couple"]').click());
        await sleep(1200);
        const draft = () => builder.evaluate(() => {
            const d = JSON.parse(localStorage.getItem('firework_builder_draft') || 'null');
            return d && d.config ? { people: d.config.people ?? null, water: d.config.water ?? null } : null;
        });
        const saved = await draft();
        const active = await builder.$eval('.water-people .active', e => e.textContent.trim()).catch(() => '');
        const summary = await builder.$eval('[data-summary="scene"]', e => e.textContent).catch(() => '');
        const hint = await builder.$eval('#people-hint', e => e.textContent).catch(() => '');
        check('builder: chọn "Cả hai" thì lưu people: "couple", tóm tắt, gợi ý ghi rõ',
            saved && saved.people === 'couple' && /Cả hai/.test(active) && /người ngắm pháo/i.test(summary) && /gặp nhau/.test(hint), JSON.stringify({ saved, active, summary, hint }));
        await builder.evaluate(() => document.querySelector('[data-water=""]').click());
        await sleep(1200);
        const off = await draft();
        check('builder: tắt mặt nước thì không lưu người ngắm pháo', off && off.people === null, JSON.stringify(off));
        check('người ngắm pháo trong builder không lỗi JS', builder.errors.length === 0, builder.errors.join(' | '));
    } finally {
        await builder.close();
    }
}
