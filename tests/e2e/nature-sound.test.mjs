/*!
 * Trình diễn Pháo hoa – kiểm thử tự động
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Âm thanh thiên nhiên: tiếng tổng hợp đúng (không lỗi số, đúng độ dài vòng lặp, đủ to mà không vỡ tiếng, cùng yêu cầu ra
// cùng tiếng); chọn tiếng theo cảnh; builder bật/tắt, âm lượng, từng nhóm tiếng lưu vào kịch bản; người xem tắt được
// trong Cài đặt (nhớ cho lần sau), kịch bản tắt thì ẩn; trình phát dựng tiếng ở worker không lỗi.
import fs from 'fs';
import path from 'path';
import { DIST, sleep, openPage, writeConfig, removeConfig } from './helpers.mjs';
import { RATE, peak, rms } from '../../src/assets/js/player/nature/dsp.js';
import { SOUNDS, renderSound } from '../../src/assets/js/player/nature/sounds/index.js';
import { NATURE_GROUPS, ambienceLayers, eventSounds, natureScene } from '../../src/assets/js/player/nature/scene.js';

const LIFE = { birds: true, ducks: true, fish: true, logs: true, frogs: true, bubbles: true };

const ids = list => list.map(item => item.id).sort().join(',');

function checkSynthesis(check) {
    const loops = [
        ['water', { style: 'river', shore: 'wall' }], ['water', { style: 'lake', shore: 'sand' }], ['water', { style: 'lake', shore: 'sea' }],
        ['leaves', { veg: 'leafy', season: 'winter' }], ['leaves', { veg: 'palm', season: 'summer' }], ['crickets', { season: 'autumn' }],
        ['frogChorus', { season: 'summer', rain: true }], ['rain', { water: true, trees: true }]
    ];
    const badLoops = [];
    loops.forEach(([id, params]) => {
        const a = renderSound({ id, params, part: 1 });
        const info = { id, params, finite: a.every(Number.isFinite), seconds: a.length / RATE, rms: rms(a), peak: peak(a) };
        if (!info.finite || Math.abs(info.seconds - SOUNDS[id].loop[1]) > 0.01 || info.rms < 0.05 || info.peak > 0.96) badLoops.push(info);
    });
    check('tiếng nền: không lỗi số, đúng độ dài vòng lặp, đủ to mà không vỡ tiếng', !badLoops.length, JSON.stringify(badLoops));

    const shots = [['frog', {}], ['splash', { size: 'small' }], ['splash', { size: 'large' }], ['plip', {}], ['bubble', {}],
        ['quack', { kind: 'female', series: true }], ['quack', { kind: 'male', series: false }], ['wings', {}], ['egret', {}], ['egretWings', {}]];
    const badShots = [];
    shots.forEach(([id, params]) => [0, 1, 3].forEach(part => {
        const a = renderSound({ id, params, part });
        const info = { id, params, part, finite: a.every(Number.isFinite), seconds: a.length / RATE, peak: peak(a) };
        if (!info.finite || info.seconds > 2.5 || info.seconds < 0.02 || Math.abs(info.peak - 0.9) > 0.05) badShots.push(info);
    }));
    check('tiếng ngắn (ếch, nước bắn, vịt, cò...): không lỗi số, ngắn gọn, cùng độ to', !badShots.length, JSON.stringify(badShots));

    const a = renderSound({ id: 'frog', part: 2 });
    const b = renderSound({ id: 'frog', part: 2 });
    const c = renderSound({ id: 'frog', part: 4 });
    check('cùng yêu cầu ra cùng tiếng, giọng khác thì tiếng khác', a.length === b.length && a.every((v, i) => v === b[i]) && (a.length !== c.length || a.some((v, i) => v !== c[i])));
}

function checkSceneChoice(check) {
    const summer = natureScene({ water: true, style: 'river', bank: 'stone', season: 'summer', life: LIFE });
    check('sông, kè đá mùa hè: tiếng nước, gió lá liễu, dế, ếch nhái xa',
        ids(ambienceLayers(summer)) === 'crickets,frogChorus,leaves,water' && ambienceLayers(summer).find(l => l.id === 'leaves').params.veg === 'willow',
        JSON.stringify(ambienceLayers(summer)));
    const shots = ids(eventSounds(summer));
    check('sinh vật đang bật có tiếng ngắn dựng sẵn (ếch, vịt, cò, cá, bong bóng, nước bắn)',
        ['frog', 'quack', 'wings', 'egret', 'egretWings', 'plip', 'bubble', 'splash'].every(id => shots.includes(id)), shots);
    const winter = natureScene({ water: true, bank: 'brick', season: 'winter', life: LIFE });
    check('mùa đông nước đóng băng: không tiếng nước, dế, ếch; còn gió',
        ids(ambienceLayers(winter)) === 'leaves' && eventSounds(winter).length === 0, JSON.stringify(ambienceLayers(winter)));
    check('không có mặt nước mà mưa: chỉ có tiếng mưa',
        ids(ambienceLayers(natureScene({ water: false, weather: 'rain', life: LIFE }))) === 'rain');
    const sea = natureScene({ water: true, bank: 'none', season: 'summer', life: LIFE });
    check('biển khơi: không có dế, ếch nhái trên bờ; gió không qua cây',
        ids(ambienceLayers(sea)) === 'leaves,water' && ambienceLayers(sea).find(l => l.id === 'leaves').params.veg === 'none');
    const off = natureScene({ water: true, season: 'summer', life: LIFE, off: ['insects', 'water', 'frogs'] });
    check('tắt nhóm nào thì không có tiếng nhóm đó', ids(ambienceLayers(off)) === 'leaves' && !ids(eventSounds(off)).includes('frog'), ids(ambienceLayers(off)));
    check('tắt âm thanh thiên nhiên: không có tiếng nào',
        ambienceLayers(natureScene({ on: false, water: true, life: LIFE })).length === 0 && eventSounds(natureScene({ on: false, water: true, life: LIFE })).length === 0);
}

export async function run(browser, base, { check }) {
    checkSynthesis(check);
    checkSceneChoice(check);

    const worker = fs.readdirSync(path.join(DIST, 'assets/js')).find(f => /^render-worker-.*\.js$/.test(f));
    check('bản build có worker dựng tiếng, kèm thông báo bản quyền',
        !!worker && /Vũ Hoài Nam/.test(fs.readFileSync(path.join(DIST, 'assets/js', worker), 'utf8').slice(0, 300)), worker);

    // Builder: bật/tắt, âm lượng, từng nhóm
    const builder = await openPage(browser, { width: 1440, height: 900 });
    try {
        await builder.goto(base + '/builder.html', { waitUntil: 'networkidle0' });
        const chips = await builder.$$eval('#nature-things [data-nature-group]', list => list.map(i => i.dataset.natureGroup + (i.checked ? '' : '-off')));
        check('builder: có nút bật/tắt từng nhóm tiếng, mặc định bật hết', chips.join(',') === NATURE_GROUPS.map(g => g.key).join(','), chips.join(','));
        await builder.evaluate(() => {
            localStorage.clear();
            const title = document.getElementById('title');
            title.value = 'Thử tiếng thiên nhiên';
            title.dispatchEvent(new Event('input', { bubbles: true }));
            document.querySelector('#nature-things [data-nature-group="insects"]').click();
            const volume = document.getElementById('nature-volume');
            volume.value = '30';
            volume.dispatchEvent(new Event('input', { bubbles: true }));
        });
        await sleep(1200);
        const draft = () => builder.evaluate(() => {
            const d = JSON.parse(localStorage.getItem('firework_builder_draft') || 'null');
            return d && d.config ? { natureSound: d.config.natureSound ?? null, natureVolume: d.config.natureVolume ?? null, natureOff: d.config.natureOff ?? null } : null;
        });
        const saved = await draft();
        const summary = await builder.$eval('[data-summary="sound"]', e => e.textContent).catch(() => '');
        check('builder: tắt dế, âm lượng 30% thì lưu natureOff, natureVolume; tóm tắt ghi có tiếng thiên nhiên',
            saved && saved.natureSound === null && saved.natureVolume === 0.3 && JSON.stringify(saved.natureOff) === '["insects"]' && /Tiếng thiên nhiên/.test(summary),
            JSON.stringify({ saved, summary }));
        await builder.evaluate(() => document.getElementById('nature-sound').click());
        await sleep(1200);
        const off = await draft();
        const hidden = await builder.$eval('#nature-options', e => e.classList.contains('hide'));
        check('builder: tắt âm thanh thiên nhiên thì lưu natureSound: false, ẩn các mục con', off && off.natureSound === false && hidden, JSON.stringify(off));
        check('builder: âm thanh thiên nhiên không lỗi JS', builder.errors.length === 0, builder.errors.join(' | '));
    } finally {
        await builder.close();
    }

    // Trình phát: người xem tắt trong Cài đặt (nhớ lại), kịch bản tắt thì ẩn; dựng tiếng ở worker
    const id = 'zz_nature_sound';
    const offId = 'zz_nature_off';
    writeConfig(id, { loop: true, events: [{ burst: 1, shell: 'Hoa cúc', x: 50, y: 55 }], water: 'half', waterStyle: 'river', bank: 'stone' });
    writeConfig(offId, { loop: true, events: [], water: 'half', natureSound: false });
    const page = await openPage(browser);
    try {
        await page.evaluateOnNewDocument(() => localStorage.removeItem('cm_fireworks_data'));
        await page.goto(base + `/index.html?config=${id}`, { waitUntil: 'networkidle0' });
        await page.waitForSelector('.start-screen.is-ready');
        await page.click('.btn-start');
        await sleep(3000);
        const workers = page.workers().map(w => w.url());
        check('trình phát: dựng tiếng ở worker riêng', workers.some(url => /render-worker/.test(url)), workers.join(', '));
        const option = await page.evaluate(() => ({
            shown: !document.querySelector('.form-option--nature').classList.contains('remove'),
            checked: document.querySelector('.nature-sound').checked
        }));
        check('Cài đặt: có công tắc Âm thanh thiên nhiên, mặc định bật', option.shown && option.checked, JSON.stringify(option));
        await page.evaluate(() => document.querySelector('.nature-sound').click());
        await sleep(300);
        const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('cm_fireworks_data') || 'null'));
        check('người xem tắt âm thanh thiên nhiên thì nhớ cho lần sau', stored && stored.data.natureSound === false, JSON.stringify(stored));
        check('trình phát có âm thanh thiên nhiên không lỗi JS', page.errors.length === 0, page.errors.join(' | '));
    } finally {
        await page.close();
    }
    const offPage = await openPage(browser);
    try {
        await offPage.goto(base + `/index.html?config=${offId}`, { waitUntil: 'networkidle0' });
        await offPage.waitForSelector('.start-screen.is-ready');
        await offPage.click('.btn-start');
        await sleep(800);
        const hidden = await offPage.evaluate(() => document.querySelector('.form-option--nature').classList.contains('remove'));
        check('kịch bản tắt âm thanh thiên nhiên: Cài đặt ẩn công tắc', hidden);
        await offPage.evaluate(() => localStorage.removeItem('cm_fireworks_data'));
    } finally {
        await offPage.close();
        removeConfig(id);
        removeConfig(offId);
    }
}
