/*!
 * Trình diễn Pháo hoa – kiểm thử tự động
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Mùa và thời tiết: mưa, tuyết rơi vẽ được (cả khi không có mặt nước, không để vệt chồng khung trước); builder chọn mùa,
// thời tiết, lưu đúng, tóm tắt ghi rõ.
import { sleep, openPage } from './helpers.mjs';

const show = (page, cfg) => page.evaluate(config => window.postMessage({ type: 'firework-preview', config, restart: true }, location.origin),
    { loop: true, events: [], ...cfg });

// Điểm sáng trên lớp trên cùng (lớp mặt nước, nơi vẽ mưa, tuyết) ở nửa trên khung (bầu trời)
const skyMarks = page => page.evaluate(() => {
    const c = document.getElementById('water-canvas');
    const d = c.getContext('2d').getImageData(0, 0, c.width, Math.round(c.height * 0.45)).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 20) n++;
    return n;
});

// Dải cây, bờ ngay trên chân trời (lớp bầu trời) và mặt bờ ngay dưới (lớp mặt nước): đếm điểm màu ấm (lá vàng, đỏ) và
// điểm trắng (tuyết)
const bankColors = page => page.evaluate(() => {
    const count = (id, from, to) => {
        const c = document.getElementById(id);
        const d = c.getContext('2d').getImageData(0, Math.round(c.height * from), c.width, Math.round(c.height * (to - from))).data;
        let warm = 0, snow = 0;
        for (let i = 0; i < d.length; i += 4) {
            if (d[i + 3] < 200) continue;
            if (d[i] > 70 && d[i] > d[i + 1] + 10 && d[i + 1] > d[i + 2] + 10) warm++;
            if (Math.min(d[i], d[i + 1], d[i + 2]) > 140) snow++;
        }
        return { warm, snow };
    };
    const sky = count('deco-canvas', 0.41, 0.5);
    const bank = count('water-canvas', 0.5, 0.515);
    return { warm: sky.warm, snow: sky.snow + bank.snow };
});

export async function run(browser, base, { check }) {
    const page = await openPage(browser, { width: 1280, height: 720 });
    try {
        await page.goto(base + '/index.html?preview=1', { waitUntil: 'networkidle0' });
        await show(page, {});
        await sleep(600);
        const clear = await skyMarks(page);
        await show(page, { weather: 'rain' });
        await sleep(700);
        // Số điểm mưa dao động theo đợt gió; vệt khung trước mà chồng lên thì sau một giây đã lên hàng chục nghìn điểm
        const rains = [];
        for (let i = 0; i < 4; i++) {
            rains.push(await skyMarks(page));
            await sleep(400);
        }
        check('mưa: có vệt mưa trên trời (không bật mặt nước)', clear === 0 && Math.min(...rains) > 800, JSON.stringify({ clear, rains }));
        check('mưa không để vệt của khung trước chồng lên', Math.max(...rains) < Math.min(...rains) * 3, JSON.stringify(rains));
        await show(page, { weather: 'snow', water: 'half' });
        await sleep(800);
        const snow = await skyMarks(page);
        check('tuyết rơi: có bông tuyết trên trời', snow > 400, JSON.stringify({ snow }));
        await show(page, { weather: 'bogus' });
        await sleep(500);
        check('thời tiết lạ thì bỏ qua (trời quang)', (await skyMarks(page)) === 0);
        const looks = {};
        for (const season of ['', 'autumn', 'winter']) {
            await show(page, { water: 'half', bank: 'stone', season: season || undefined, waterBirds: false, waterDucks: false });
            await sleep(1500);
            looks[season || 'summer'] = await bankColors(page);
        }
        check('mùa thu: liễu ngả vàng', looks.autumn.warm > looks.summer.warm * 3 + 200, JSON.stringify(looks));
        check('mùa đông: tuyết đọng trên bờ, cây', looks.winter.snow > looks.summer.snow * 3 + 300, JSON.stringify(looks));
        await show(page, { water: 'half', season: 'winter', waterBirds: false, waterDucks: false });
        await sleep(900);
        const earth = await bankColors(page);
        check('mùa đông: bờ đất phủ tuyết', earth.snow > 1500, JSON.stringify(earth));
        check('mưa, tuyết, cảnh theo mùa không lỗi JS', page.errors.length === 0, page.errors.join(' | '));
    } finally {
        await page.close();
    }

    const builder = await openPage(browser, { width: 1440, height: 900 });
    try {
        await builder.goto(base + '/builder.html', { waitUntil: 'networkidle0' });
        await builder.evaluate(() => {
            localStorage.clear();
            const title = document.getElementById('title');
            title.value = 'Thử mùa';
            title.dispatchEvent(new Event('input', { bubbles: true }));
            setSeason('autumn');
            setWeather('snow');
        });
        await sleep(1200);
        const draft = () => builder.evaluate(() => {
            const d = JSON.parse(localStorage.getItem('firework_builder_draft') || 'null');
            return d && d.config ? { season: d.config.season ?? null, weather: d.config.weather ?? null } : null;
        });
        const saved = await draft();
        const summary = await builder.$eval('[data-summary="scene"]', e => e.textContent).catch(() => '');
        check('builder: chọn mùa thu, tuyết rơi thì lưu season, weather; tóm tắt ghi rõ',
            saved && saved.season === 'autumn' && saved.weather === 'snow' && /Mùa thu/.test(summary) && /Tuyết rơi/.test(summary),
            JSON.stringify({ saved, summary }));
        await builder.evaluate(() => setSeason('auto'));
        const hint = await builder.$eval('#season-hint', e => e.textContent);
        check('builder: "Theo ngày xem" cho biết mùa của hôm nay', /Hôm nay/.test(hint), hint);
        await builder.evaluate(() => {
            setSeason('');
            setWeather('');
        });
        await sleep(1200);
        const off = await draft();
        check('builder: mùa hạ, trời quang thì không lưu (như kịch bản cũ)', off && off.season === null && off.weather === null, JSON.stringify(off));
        check('mùa, thời tiết trong builder không lỗi JS', builder.errors.length === 0, builder.errors.join(' | '));
    } finally {
        await builder.close();
    }
}
