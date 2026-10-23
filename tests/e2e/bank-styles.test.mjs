/*!
 * Trình diễn Pháo hoa – kiểm thử tự động
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Kiểu bờ bên kia mặt nước (bank): mỗi kiểu vẽ được, phần nhô lên trời có mặt ngay trên chân trời (biển khơi thì không),
// đèn kè gạch sáng ấm, thành phố có nhà cao tầng, đèn màu; biển khơi có thuyền đèn sáng sát chân trời; kịch bản cũ chọn
// cầu sắt thành thành phố; builder chọn kiểu, lưu đúng, tắt mặt nước thì không lưu kiểu bờ, chỉ hiện thứ hợp với kiểu bờ.
import { sleep, openPage } from './helpers.mjs';
import { validBankStyle } from '../../src/assets/js/player/bank-styles.js';

// Dải ngay trên chân trời của lớp bầu trời (mặt nước nửa màn hình: chân trời ở giữa): đếm điểm có hình, điểm sáng ấm,
// điểm sáng có màu đậm
const skyline = page => page.evaluate(() => {
    const c = document.getElementById('deco-canvas');
    const g = c.getContext('2d');
    const h = Math.round(c.height * 0.09);
    const d = g.getImageData(0, Math.round(c.height * 0.5) - h, c.width, h).data;
    let solid = 0, warm = 0, vivid = 0;
    for (let i = 0; i < d.length; i += 8) {
        if (d[i + 3] > 200) solid++;
        if (d[i] > 200 && d[i + 1] > 150 && d[i + 2] < 190 && d[i + 3] > 60) warm++;
        const max = Math.max(d[i], d[i + 1], d[i + 2]);
        const min = Math.min(d[i], d[i + 1], d[i + 2]);
        if (max > 150 && max - min > 70) vivid++;
    }
    return { solid, warm, vivid };
});

// Chân cầu đá xuống tới mép nước (cầu không lơ lửng trên mặt kè): một hàng ngay dưới chân trời, đếm điểm có đá ở lớp bầu
// trời và trong số đó bao nhiêu điểm lớp mặt nước để trống cho lộ ra
const footing = page => page.evaluate(() => {
    const d = document.getElementById('deco-canvas');
    const w = document.getElementById('water-canvas');
    const k = d.width / d.clientWidth;
    const y = Math.round(d.height * 0.5 + 5 * k);
    const dd = d.getContext('2d').getImageData(0, y, d.width, 1).data;
    const wd = w.getContext('2d').getImageData(0, Math.round(y * w.height / d.height), w.width, 1).data;
    let stone = 0, shown = 0;
    for (let x = 0; x < d.width; x++) {
        if (dd[x * 4 + 3] < 200) continue;
        stone++;
        if (wd[Math.floor(x * w.width / d.width) * 4 + 3] < 10) shown++;
    }
    return { stone, shown };
});

export async function run(browser, base, { check }) {
    const page = await openPage(browser, { width: 1280, height: 720 });
    try {
        await page.goto(base + '/demo.html?preview=1', { waitUntil: 'networkidle0' });
        const results = {};
        for (const bank of ['', 'brick', 'stone', 'sand', 'oldtown', 'bridge', 'arch', 'city', 'none']) {
            await page.evaluate(cfg => window.postMessage({ type: 'firework-preview', config: cfg, restart: true }, location.origin),
                { loop: true, events: [], water: 'half', waterStyle: 'river', bank: bank || undefined, waterBirds: false, waterDucks: false });
            await sleep(900);
            results[bank || 'earth'] = { ...(await skyline(page)), foot: await footing(page) };
        }
        const structures = ['brick', 'stone', 'sand', 'oldtown', 'bridge', 'arch', 'city'];
        check('mỗi kiểu bờ có phần nhô lên trời (lan can, cây, nhà, cầu) ngay trên chân trời',
            structures.every(b => results[b].solid > 300), JSON.stringify(Object.fromEntries(structures.map(b => [b, results[b].solid]))));
        check('biển khơi: không có bờ nhô lên trời', results.none.solid < 30 && results.none.solid < results.earth.solid, JSON.stringify({ none: results.none, earth: results.earth }));
        check('kè gạch, phố cổ, cầu vòm đá có đèn sáng ấm', ['brick', 'oldtown', 'bridge'].every(b => results[b].warm > 20),
            JSON.stringify(Object.fromEntries(['brick', 'oldtown', 'bridge'].map(b => [b, results[b].warm]))));
        check('thành phố có đèn màu (mặt tiền, đỉnh tháp)', results.city.vivid > 50, JSON.stringify(results.city));
        check('cầu đá (vòm cong, nhiều vòm): chân cầu xuống tới mép nước, mặt nước để lộ chân cầu',
            ['arch', 'bridge'].every(b => results[b].foot.stone > 150 && results[b].foot.shown > results[b].foot.stone * 0.9),
            JSON.stringify({ arch: results.arch.foot, bridge: results.bridge.foot }));
        // Biển khơi: thuyền câu mực, tàu khách thắp đèn sáng ngay dưới chân trời (lớp mặt nước, dải sát chân trời)
        const seaLights = await page.evaluate(() => {
            const c = document.getElementById('water-canvas');
            const d = c.getContext('2d').getImageData(0, Math.round(c.height * 0.5), c.width, Math.round(c.height * 0.06)).data;
            let n = 0;
            for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 600) n++;
            return n;
        });
        check('biển khơi: xa xa có thuyền thắp đèn sáng', seaLights > 20, String(seaLights));
        check('kịch bản cũ chọn "cầu sắt" (đã bỏ) thì thành thành phố', validBankStyle('steel') === 'city' && validBankStyle('city') === 'city');
        check('các kiểu bờ không lỗi JS', page.errors.length === 0, page.errors.join(' | '));
    } finally {
        await page.close();
    }

    const builder = await openPage(browser, { width: 1440, height: 900 });
    try {
        await builder.goto(base + '/builder.html', { waitUntil: 'networkidle0' });
        await builder.evaluate(() => {
            localStorage.clear();
            const title = document.getElementById('title');
            title.value = 'Thử kiểu bờ';
            title.dispatchEvent(new Event('input', { bubbles: true }));
            setWater('half');
            setBank('arch');
        });
        await sleep(1200);
        const draft = () => builder.evaluate(() => {
            const d = JSON.parse(localStorage.getItem('firework_builder_draft') || 'null');
            return d && d.config ? { bank: d.config.bank ?? null, water: d.config.water ?? null } : null;
        });
        const saved = await draft();
        const selected = await builder.$eval('#bank-grid .shell-option.selected', e => e.textContent.trim());
        const summary = await builder.$eval('[data-summary="scene"]', e => e.textContent).catch(() => '');
        check('builder: chọn "Cầu vòm cong" thì lưu bank: "arch", tóm tắt ghi rõ',
            saved && saved.bank === 'arch' && /Cầu vòm cong/.test(selected) && /Cầu vòm cong/.test(summary), JSON.stringify({ saved, selected, summary }));
        // Bấm nút như người dùng: bản nháp được chụp sau mỗi lần bấm (gọi thẳng hàm thì phải chờ lượt chụp 3 giây một lần)
        await builder.evaluate(() => document.querySelector('[data-water=""]').click());
        await sleep(1200);
        const off = await draft();
        check('builder: tắt mặt nước thì không lưu kiểu bờ', off && off.bank === null, JSON.stringify(off));
        // Chỉ hiện thứ hợp với kiểu bờ: biển khơi chỉ có cá, thuyền; sông thành phố có thuyền, không có đá, gò đất
        const chips = bank => builder.evaluate(value => {
            setWater('half');
            setBank(value);
            return [...document.querySelectorAll('[data-water-thing]')].filter(i => !i.closest('.toggle-chip').classList.contains('hide')).map(i => i.dataset.waterThing);
        }, bank);
        const sea = await chips('none');
        const city = await chips('city');
        const earth = await chips('');
        check('builder: biển khơi chỉ có cá, thuyền; thành phố có thuyền, không đá; bờ đất không có thuyền',
            sea.join() === 'waterFish,waterBoats' && city.includes('waterBoats') && !city.includes('waterRocks') && !earth.includes('waterBoats') && earth.includes('waterRocks'),
            JSON.stringify({ sea, city, earth }));
        check('kiểu bờ trong builder không lỗi JS', builder.errors.length === 0, builder.errors.join(' | '));
    } finally {
        await builder.close();
    }
}
