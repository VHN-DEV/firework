/*!
 * Trình diễn Pháo hoa – kiểm thử tự động
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Người ngắm pháo (people): có mặt nước thì nhân vật anime đi vào từ mép khung, đứng ở bờ bên này (lớp trước cùng);
// tắt người hoặc không có mặt nước thì lớp trống; mưa thì có ô; có trong video tạo ra (dựng nhanh dù khung dựng ẩn);
// builder chọn, lưu đúng, tắt mặt nước thì không lưu.
import { sleep, openPage, writeConfig, removeConfig } from './helpers.mjs';
import { peoplePlan, validPeople, validPeopleStart, validPeopleWait } from '../../src/assets/js/player/people-options.js';

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
    // Cách đi vào: chỗ bắt đầu làm tròn bước 5 trong 0-100 (giá trị lạ về mặc định), đợi 2-60 giây, người đứng sẵn ở giữa là
    // người đợi
    const start = validPeopleStart({ m: 33, f: 'x' });
    const odd = validPeopleStart({ m: true, f: 150 });
    check('cách đi vào: chỉ nhận chỗ bắt đầu 0-100 (bước 5), đợi 2-60 giây; người đứng sẵn ở giữa là người đợi',
        start.m === 35 && start.f === 100 && odd.m === 0 && odd.f === 100 && validPeopleWait(0) === 2 && validPeopleWait('x') === 8
        && peoplePlan({ peopleStart: { f: 50 }, peopleFirst: 'm' }).first === 'f' && peoplePlan({ peopleFirst: 'm' }).first === 'm',
        JSON.stringify({ start, odd }));
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

        // Cách đi vào: chàng trai đứng đợi sẵn ở giữa, cô gái tới sau 12 giây (máy chậm thì màn trình diễn chậm theo: chờ lâu)
        await post(page, { loop: true, events, water: 'half', people: 'couple', peopleStart: { m: 50 }, peopleWait: 12 });
        const waiting = await waitFor(f => f.center > 100, 20);
        check('chàng trai đứng đợi sẵn ở giữa từ đầu, cô gái chưa tới', waiting.center > 100 && waiting.left < 10 && waiting.right < 10, JSON.stringify(waiting));
        const comes = await waitFor(f => f.right > 30, 60);
        check('đứng đợi một lúc thì cô gái đi vào từ mép phải', comes.right > 30 && comes.center > 100, JSON.stringify(comes));
        // Hai người cùng bắt đầu ở mép trái: đi cùng nhau từ bên trái, bên phải không có ai
        await post(page, { loop: true, events, water: 'half', people: 'couple', peopleStart: { m: 0, f: 0 } });
        const pair = await waitFor(f => f.left > 60, 20);
        check('hai người cùng bắt đầu ở mép trái thì đi cùng nhau từ bên trái', pair.left > 60 && pair.right === 0, JSON.stringify(pair));

        // Đồ theo mùa: mùa đông chàng trai mặc áo măng tô màu lạc đà, mùa hạ áo hoodie trắng (đếm điểm màu nâu trên lớp
        // người: dưới ánh đêm ngả xanh thành nâu đỏ trầm; pháo trắng cho ánh pháo không nhuộm vàng áo trắng)
        const camel = () => page.evaluate(() => {
            const c = document.getElementById('front-canvas');
            const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
            let n = 0;
            for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200 && d[i] > 50 && d[i] > d[i + 2] * 1.3 && d[i] > d[i + 1] * 1.1) n++;
            return n;
        });
        const white = [{ burst: 1, shell: 'Hoa cúc', color: 'White', x: 50, y: 70 }];
        const seasonal = {};
        for (const season of ['winter', 'summer']) {
            await post(page, { loop: true, events: white, water: 'half', people: 'man', season });
            await waitFor(f => f.center > 200, 20);
            seasonal[season] = await camel();
        }
        check('mùa đông chàng trai mặc áo măng tô, mùa hạ thì không', seasonal.winter > 300 && seasonal.summer < seasonal.winter * 0.1, JSON.stringify(seasonal));

        // Tắt bờ bên này: người ở bờ bên kia, đi lên giữa cầu vòm (dải chân trời giữa khung), không còn dải bờ ở đáy.
        // Người ở xa nhỏ (đứng trên cầu chừng 35-45 điểm ảnh trong dải đếm) nên đặt cứng 720p: máy không có card đồ họa (CI,
        // WebGL dựng bằng phần mềm) chất lượng Tự động hạ xuống ~360p, cả khung nhỏ đi bốn lần thì không bao giờ đủ điểm.
        // Máy đó cũng chậm (khung hình chậm thì màn trình diễn chậm theo) nên chờ tới 90 giây
        await post(page, { loop: true, events, water: 'half', bank: 'arch', people: 'couple', nearBank: false, viewer: { quality: '720' } });
        let bridge = null;
        for (let i = 0; i < 180; i++) {
            await sleep(500);
            bridge = await page.evaluate(() => {
                const c = document.getElementById('front-canvas');
                const g = c.getContext('2d');
                const band = (from, to, x0 = 0, x1 = 1) => {
                    const d = g.getImageData(Math.round(c.width * x0), Math.round(c.height * from), Math.round(c.width * (x1 - x0)), Math.round(c.height * (to - from))).data;
                    let n = 0;
                    for (let i = 3; i < d.length; i += 4) if (d[i] > 150) n++;
                    return n;
                };
                return { top: band(0.36, 0.5, 0.4, 0.6), low: band(0.55, 1) };
            });
            if (bridge.top > 40) break;
        }
        check('tắt bờ bên này: người lên giữa cầu bên kia, không còn bờ bên này', bridge.top > 40 && bridge.low === 0, JSON.stringify(bridge));

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

    // Tạo video có người: khung dựng ẩn vẫn dựng nhanh, cặp đôi có trong khung hình cuối video. Máy không có card đồ họa
    // (CI: WebGL dựng bằng phần mềm, mỗi khung chờ dựng nhân vật cả trăm mili giây) thì không đo được chuyện khung ẩn bị
    // chậm: chỉ cần tạo xong
    const ID = 'zz_e2e_people_video';
    writeConfig(ID, { title: 'NGẮM PHÁO', loop: true, water: 'half', people: 'couple', events: [1, 2, 3].map(b => ({ burst: b, shell: 'Hoa cúc', x: 50, y: 65, color: 'Gold' })) });
    const vpage = await openPage(browser, { width: 1440, height: 900 });
    try {
        await vpage.goto(base + '/builder.html', { waitUntil: 'networkidle0' });
        const gpu = await vpage.evaluate(() => {
            const g = document.createElement('canvas').getContext('webgl2');
            const ext = g && g.getExtension('WEBGL_debug_renderer_info');
            return g ? String(g.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : g.RENDERER)) : '';
        });
        const limit = /swiftshader|llvmpipe|softpipe|software|basic render/i.test(gpu) ? 360 : 120;
        await vpage.evaluate(id => editScript(id), ID);
        await sleep(1200);
        await vpage.evaluate(() => { openVideoModal(); setVideoFormat('portrait'); setVideoQuality('hd'); });
        const started = Date.now();
        await vpage.click('#btn-video-create');
        // Chờ ở phía kiểm thử (mỗi lần hỏi ngắn): một lệnh chờ dài trong trang vượt hạn giao thức 180 giây của trình duyệt
        while (Date.now() - started < (limit + 30) * 1000) {
            await sleep(1000);
            if (await vpage.evaluate(() => !document.getElementById('video-result').classList.contains('hide'))) break;
        }
        const seconds = (Date.now() - started) / 1000;
        const shot = await vpage.evaluate(async () => {
            const v = document.getElementById('video-output');
            if (!v.src) return null;
            if (v.readyState < 1) await new Promise(r => v.addEventListener('loadedmetadata', r, { once: true }));
            v.currentTime = Math.max(0, v.duration - 5);
            await new Promise(r => v.addEventListener('seeked', r, { once: true }));
            const c = document.createElement('canvas');
            c.width = v.videoWidth;
            c.height = v.videoHeight;
            const g = c.getContext('2d');
            g.drawImage(v, 0, 0);
            // Áo hoodie, áo sơ mi, da: điểm sáng ở dải dưới giữa khung (mặt nước phía sau tối)
            const d = g.getImageData(Math.round(c.width * 0.3), Math.round(c.height * 0.7), Math.round(c.width * 0.4), Math.round(c.height * 0.25)).data;
            let bright = 0;
            for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 330) bright++;
            return { duration: v.duration, bright };
        });
        check('video có người ngắm pháo, dựng nhanh dù khung dựng ẩn', !!shot && shot.bright > 400 && seconds < limit, JSON.stringify({ ...shot, seconds, limit, gpu }));
        check('tạo video có người không lỗi JS', vpage.errors.length === 0, vpage.errors.join(' | '));
    } finally {
        await vpage.close();
        removeConfig(ID);
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
        // Cách đi vào: kéo chàng trai vào giữa thì đứng đợi sẵn, nút "Ai đến trước" khóa vào chàng trai, lưu peopleStart,
        // peopleWait; kéo về mép trái (mặc định) rồi chọn cô gái đến trước thì chỉ lưu peopleFirst
        const slide = (id, value) => builder.evaluate((id, value) => {
            const input = document.getElementById(id);
            input.value = value;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
        }, id, value);
        const planOf = () => builder.evaluate(() => {
            const c = (JSON.parse(localStorage.getItem('firework_builder_draft') || 'null') || {}).config || {};
            return {
                start: c.peopleStart || null, first: c.peopleFirst || null, wait: c.peopleWait || null,
                locked: [...document.querySelectorAll('.people-first [data-first]')].every(b => b.disabled),
                active: document.querySelector('.people-first .active')?.dataset.first ?? null,
                label: document.getElementById('out-people-start-m').textContent,
                hint: document.getElementById('people-plan-hint').textContent
            };
        });
        await slide('people-start-m', 50);
        await slide('people-wait', 15);
        await sleep(1200);
        const stand = await planOf();
        check('builder: kéo chàng trai vào giữa thì đứng đợi sẵn, là người đợi; lưu peopleStart, peopleWait',
            stand.start && stand.start.m === 50 && stand.start.f === undefined && stand.wait === 15 && !stand.first && stand.locked && stand.active === 'm'
            && /đứng đợi sẵn/i.test(stand.label) && /15 giây/.test(stand.hint), JSON.stringify(stand));
        await slide('people-start-m', 0);
        await builder.evaluate(() => setPeopleFirst('f'));
        await sleep(1200);
        const womanFirst = await planOf();
        check('builder: chỗ bắt đầu mặc định thì không lưu; cô gái đến trước thì lưu peopleFirst: "f"',
            !womanFirst.start && womanFirst.first === 'f' && womanFirst.wait === 15 && !womanFirst.locked && /Cô gái đến trước/.test(womanFirst.hint), JSON.stringify(womanFirst));
        // Công tắc bờ bên này hiện khi có người; tắt thì lưu nearBank: false
        const nearShown = await builder.$eval('.near-bank-row', e => !e.classList.contains('hide'));
        await builder.evaluate(() => {
            setBank('arch');
            document.getElementById('near-bank').click();
        });
        await sleep(1200);
        const farDraft = await builder.evaluate(() => (JSON.parse(localStorage.getItem('firework_builder_draft') || 'null') || {}).config || {});
        const nearHint = await builder.$eval('#near-bank-hint', e => e.textContent);
        check('builder: tắt bờ bên này thì lưu nearBank: false, gợi ý người đi lên giữa cầu',
            nearShown && farDraft.nearBank === false && /giữa cầu/.test(nearHint), JSON.stringify({ nearShown, nearBank: farDraft.nearBank, nearHint }));
        await builder.evaluate(() => document.querySelector('[data-water=""]').click());
        await sleep(1200);
        const off = await draft();
        check('builder: tắt mặt nước thì không lưu người ngắm pháo', off && off.people === null, JSON.stringify(off));
        check('người ngắm pháo trong builder không lỗi JS', builder.errors.length === 0, builder.errors.join(' | '));
    } finally {
        await builder.close();
    }
}
