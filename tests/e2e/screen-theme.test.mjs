/*!
 * Trình diễn Pháo hoa – kiểm thử tự động
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Giao diện màn mở quà & màn kết theo dịp (screenTheme): trình phát áp màu, kiểu chữ, biểu tượng, kiểu thiệp, hiệu ứng
// nền; hiệu ứng tắt khi mở quà, bật lại ở màn kết; giá trị lạ bỏ qua. Builder chọn bộ có sẵn, tự chỉnh, lưu gọn,
// mẫu theo dịp tự gắn giao diện.
import { sleep, openPage, writeConfig, removeConfig } from './helpers.mjs';

const ID = 'zz_e2e_theme';

// Lớp hiệu ứng nền của một màn có vẽ gì không (số điểm ảnh không trong suốt)
const ambientPixels = (page, screen) => page.evaluate(sel => {
    const c = document.querySelector(`${sel} .screen-ambient`);
    if (!c || c.hidden || !c.width) return 0;
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 16) if (d[i] > 20) n++;
    return n;
}, screen);

const themeState = page => page.evaluate(() => {
    const root = document.documentElement;
    const css = getComputedStyle(root);
    return {
        theme: root.dataset.stTheme, card: root.dataset.stCard, font: root.dataset.stFont, border: root.classList.contains('st-border'),
        main: css.getPropertyValue('--st-main').trim(), bg: css.getPropertyValue('--st-bg').trim(),
        icon: document.querySelector('.start-screen__gift').textContent,
        fontLink: [...document.querySelectorAll('link[href*="fonts.googleapis.com/css2?family="]')].map(l => l.href).join(' ')
    };
});

export async function run(browser, base, { check }) {
    const page = await openPage(browser, { width: 1100, height: 700 });
    try {
        // Bộ Tết: màu, kiểu chữ, biểu tượng, viền kép, thiệp đậm màu, hoa mai đào rơi
        writeConfig(ID, { loop: false, title: 'CHÚC MỪNG NĂM MỚI', author: 'Từ: Nam', recipient: 'Mẹ', screenTheme: { preset: 'tet' }, events: [] });
        await page.goto(`${base}/demo.html?config=${ID}`, { waitUntil: 'networkidle0' });
        await page.waitForSelector('.start-screen.is-ready', { timeout: 10000 });
        await sleep(1200);
        let s = await themeState(page);
        check('bộ Tết: màu đỏ son, thiệp đậm màu, viền kép, biểu tượng bao lì xì, tải kiểu chữ',
            s.theme === 'tet' && s.main === '#d7141a' && s.card === 'tint' && s.border && s.icon === '🧧' && /Playfair\+Display/.test(s.fontLink), JSON.stringify(s));
        check('bộ Tết: hiệu ứng hoa mai, đào rơi đang chạy sau thiệp', (await ambientPixels(page, '.start-screen')) > 30);

        // Mở quà: màn chờ ẩn thì hiệu ứng nền dừng, xóa sạch
        await page.click('.btn-start');
        await sleep(1500);
        check('mở quà thì hiệu ứng nền của màn mở quà dừng', (await ambientPixels(page, '.start-screen')) === 0);

        // Màn kết theo giao diện: biểu tượng, hiệu ứng nền bật lại
        await page.waitForSelector('.end-screen:not(.hide)', { timeout: 15000 });
        await sleep(1000);
        const end = await page.evaluate(() => ({
            icon: document.querySelector('.end-screen__icon').textContent,
            title: document.querySelector('.end-screen__title').textContent,
            font: getComputedStyle(document.querySelector('.end-screen__title')).fontFamily
        }));
        check('màn kết theo giao diện (biểu tượng, kiểu chữ tiêu đề)', end.icon === '🧧' && /Playfair/.test(end.font), JSON.stringify(end));
        check('màn kết: hiệu ứng nền chạy lại', (await ambientPixels(page, '.end-screen')) > 30);

        // Tự chỉnh trên nền bộ Giáng sinh: màu, hiệu ứng, kiểu thiệp, kiểu chữ viết tay (tiêu đề VIẾT HOA đổi Viết Hoa Đầu Từ)
        writeConfig(ID, {
            loop: false, title: 'GIÁNG SINH AN LÀNH', screenTheme: { preset: 'noel', main: '#123456', effect: 'hearts', card: 'light', font: 'dancing', icon: '⛄' }, events: []
        });
        await page.goto(`${base}/demo.html?config=${ID}`, { waitUntil: 'networkidle0' });
        await page.waitForSelector('.start-screen.is-ready', { timeout: 10000 });
        await sleep(1200);
        s = await themeState(page);
        check('tự chỉnh: màu, thiệp giấy sáng, kiểu chữ viết tay, biểu tượng thay cho mặc định của bộ',
            s.theme === 'noel' && s.main === '#123456' && s.card === 'light' && s.font === 'script' && s.icon === '⛄' && /Dancing\+Script/.test(s.fontLink), JSON.stringify(s));
        check('tự chỉnh: hiệu ứng trái tim bay đang chạy', (await ambientPixels(page, '.start-screen')) > 30);
        await page.click('.btn-start');
        await page.waitForSelector('.end-screen:not(.hide)', { timeout: 15000 });
        const scriptTitle = await page.$eval('.end-screen__title', e => e.textContent);
        check('kiểu chữ viết tay: tiêu đề VIẾT HOA hiện thành Viết Hoa Đầu Từ', scriptTitle === 'Giáng Sinh An Lành', scriptTitle);

        // Giá trị lạ (bộ không có, màu sai, kiểu chữ lạ) bỏ qua; kịch bản cũ không có giao diện giữ như trước
        writeConfig(ID, { loop: false, title: 'X', screenTheme: { preset: 'khong-co', main: 'red', font: 'comic', effect: 'mua' }, events: [] });
        await page.goto(`${base}/demo.html?config=${ID}`, { waitUntil: 'networkidle0' });
        await page.waitForSelector('.start-screen.is-ready', { timeout: 10000 });
        await sleep(800);
        s = await themeState(page);
        check('giá trị lạ bỏ qua: về bộ Cổ điển, nền xám đen như trước, không hiệu ứng nền',
            s.theme === 'classic' && s.main === '#ff0043' && s.bg === '#1a1a1a' && s.icon === '🎁' && (await ambientPixels(page, '.start-screen')) === 0, JSON.stringify(s));
        check('giao diện theo dịp ở trình phát không lỗi JS', page.errors.length === 0, page.errors.join(' | '));
    } finally {
        await page.close();
        removeConfig(ID);
    }

    // Builder: chọn bộ, tự chỉnh, lưu gọn; mẫu theo dịp tự gắn giao diện
    const builder = await openPage(browser, { width: 1440, height: 900 });
    try {
        await builder.goto(`${base}/builder.html`, { waitUntil: 'networkidle0' });
        await builder.evaluate(() => {
            localStorage.clear();
            document.querySelector('details.settings-group[data-group="gift"]').open = true;
            const title = document.getElementById('title');
            title.value = 'Thử giao diện';
            title.dispatchEvent(new Event('input', { bubbles: true }));
        });
        const draftTheme = () => builder.evaluate(() => {
            const draft = JSON.parse(localStorage.getItem('firework_builder_draft') || 'null');
            return draft && draft.config ? JSON.stringify(draft.config.screenTheme ?? null) : 'không có nháp';
        });
        await builder.click('#screen-theme-grid .theme-option[title="Giáng sinh"]');
        await sleep(1200);
        const preset = await draftTheme();
        const selected = await builder.$eval('#screen-theme-grid .theme-option.selected', e => e.textContent.trim());
        check('builder: chọn bộ Giáng sinh, chỉ lưu tên bộ', preset === '{"preset":"noel"}' && /Giáng sinh/.test(selected), preset);

        // Tự chỉnh hiệu ứng và kiểu thiệp: lưu phần khác bộ, tóm tắt nhóm ghi "(tự chỉnh)"
        await builder.evaluate(() => document.getElementById('screen-theme-custom').open = true);
        await builder.evaluate(() => {
            [...document.querySelectorAll('#st-effects .theme-chip')].find(b => b.textContent.includes('Đèn lồng')).click();
            [...document.querySelectorAll('#st-cards button')].find(b => b.textContent.includes('Giấy sáng')).click();
        });
        await sleep(1200);
        const custom = JSON.parse(await draftTheme());
        await builder.waitForFunction(() => document.querySelector('[data-summary="gift"]').textContent.includes('(tự chỉnh)'), { timeout: 5000 }).catch(() => {});
        const summary = await builder.$eval('[data-summary="gift"]', e => e.textContent);
        check('builder: tự chỉnh lưu phần khác bộ, tóm tắt ghi "(tự chỉnh)"',
            custom && custom.preset === 'noel' && custom.effect === 'lanterns' && custom.card === 'light' && !('main' in custom) && summary.includes('Giáng sinh (tự chỉnh)'),
            JSON.stringify({ custom, summary }));

        // Về mặc định của bộ
        await builder.click('#st-reset');
        await sleep(1200);
        check('builder: "Về mặc định của bộ" bỏ phần tự chỉnh', (await draftTheme()) === '{"preset":"noel"}', await draftTheme());

        // Mẫu theo dịp: Tết thì màn mở quà, màn kết theo bộ Tết
        await builder.evaluate(() => openTemplatesModal('nam_moi'));
        await builder.type('#tpl-recipient', 'Mẹ');
        await builder.click('#btn-create-template');
        await sleep(1500);
        const tet = await builder.$eval('#screen-theme-grid .theme-option.selected', e => e.textContent.trim());
        check('mẫu theo dịp Năm mới gắn giao diện Tết', tet.endsWith('Tết'), tet);
        check('giao diện theo dịp ở builder không lỗi JS', builder.errors.length === 0, builder.errors.join(' | '));
    } finally {
        await builder.close();
    }
}
