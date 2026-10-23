/*!
 * Hanabi – kiểm thử tự động
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Trang chủ (index.html): banner tự chuyển, thanh chuyển mục, kịch bản mẫu (nổi bật trước, có nhãn), bộ lọc, khung xem
// thử, phiếu đặt; link tặng cũ index.html?config=... chuyển sang /demo; điện thoại không tràn ngang.
import fs from 'fs';
import path from 'path';
import { DIST, ROOT, sleep, openPage } from './helpers.mjs';

const waitFor = async (page, fn, arg, ms = 4000) => {
    try {
        await page.waitForFunction(fn, { timeout: ms }, arg);
        return true;
    } catch (e) {
        return false;
    }
};

export async function run(browser, base, { check }) {
    const index = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/static/configs/configs_index.json'), 'utf8'));
    const featured = index.filter(i => i.featured).map(i => i.id);

    // Link và canonical của trang chủ không lộ tên file
    const html = await (await fetch(`${base}/`)).text();
    const fileLinks = [...html.matchAll(/<(?:a|link)\b[^>]*\bhref="([^"]*)"/g)].map(m => m[1]).filter(h => /\.html\b/.test(h));
    check('trang chủ: link và canonical không có đuôi .html', !fileLinks.length, fileLinks.join(' '));

    const page = await openPage(browser, { width: 1280, height: 720 });
    try {
        await page.goto(`${base}/`, { waitUntil: 'networkidle0' });
        await waitFor(page, () => document.querySelectorAll('.card').length > 0);
        const info = await page.evaluate(() => ({
            slides: document.querySelectorAll('.hero__slide').length,
            active: document.querySelectorAll('.hero__slide.is-active').length,
            sections: document.querySelectorAll('main section[data-nav]').length,
            dots: document.querySelectorAll('.section-nav a').length,
            featured: [...document.querySelectorAll('.showcase__featured .card')].map(c => c.dataset.id),
            badges: document.querySelectorAll('.showcase__featured .card__badge').length,
            cards: document.querySelectorAll('.card').length,
            tabs: document.querySelectorAll('.demo__tabs [role="tab"]').length,
            occasions: document.querySelectorAll('.marquee .occasion[data-occasion]').length,
            samples: document.querySelectorAll('select[name="sample"] option[value]:not([value=""])').length
        }));
        check('trang chủ: banner nhiều ảnh, một ảnh đang hiện', info.slides >= 3 && info.active === 1, JSON.stringify(info));
        check('trang chủ: thanh chuyển mục có một chấm cho mỗi mục', info.dots === info.sections && info.sections >= 6, JSON.stringify(info));
        check('trang chủ: kịch bản nổi bật hiện riêng, đứng trước, có nhãn "Nổi bật"',
            info.featured.join() === featured.join() && info.badges === featured.length && info.cards === index.length, JSON.stringify(info));
        check('trang chủ: khung xem thử có thẻ chọn, phiếu đặt có danh sách mẫu và dịp',
            info.tabs > 0 && info.samples === index.length && info.occasions >= 5, JSON.stringify(info));

        // Nút Xem demo mở kịch bản hero (có cảnh, nhạc), khung Xem thử đặt nó đầu tiên
        const hero = (index.find(i => i.hero) || index.find(i => i.featured)).id;
        const demoLinks = await page.$$eval('[data-demo-link]', l => l.map(a => a.getAttribute('href')));
        const firstTab = await page.$eval('.demo__tabs [role="tab"]', b => b.dataset.key);
        check('trang chủ: nút Xem demo mở kịch bản nổi bật có cảnh, nhạc; khung Xem thử đặt nó đầu tiên',
            demoLinks.length >= 2 && demoLinks.every(h => h === `./demo?config=${hero}`) && firstTab === hero, JSON.stringify({ demoLinks, firstTab, hero }));

        // Bấm ảnh sau: ảnh khác hiện lên
        // Bấm bằng click() của phần tử: trang cuộn mượt (scroll-behavior: smooth) nên bấm theo tọa độ có thể trượt
        const tap = selector => page.$eval(selector, el => el.click());
        await tap('.hero__next');
        const moved = await waitFor(page, () => document.querySelector('.hero__slide.is-active') === document.querySelectorAll('.hero__slide')[1]);
        check('trang chủ: bấm ảnh sau thì banner chuyển ảnh', moved);

        // Lọc "Nổi bật": chỉ còn thẻ nổi bật
        await tap('.filters [data-filter="featured"]');
        const shown = await page.evaluate(() => [...document.querySelectorAll('.card:not(.is-hidden)')].map(c => c.dataset.id));
        check('trang chủ: lọc "Nổi bật" chỉ còn kịch bản nổi bật', shown.join() === featured.join(), shown.join());
        await tap('.filters [data-filter="*"]');

        // Thanh chuyển mục: bấm chấm "Kịch bản mẫu" thì cuộn tới và chấm đó sáng
        await tap('.section-nav a[href="#kich-ban"]');
        const reached = await waitFor(page, () => document.querySelector('.section-nav a[href="#kich-ban"]').classList.contains('is-active')
            && Math.abs(document.getElementById('kich-ban').getBoundingClientRect().top) < 120, null, 6000);
        check('trang chủ: bấm chấm trên thanh chuyển mục thì cuộn tới mục đó', reached);

        // "Đặt mẫu này": chọn sẵn mẫu trong phiếu; gửi khi chưa có tên thì báo
        const firstId = await page.$eval('.card [data-order]', b => b.dataset.order);
        await tap('.card [data-order]');
        await sleep(300);
        const picked = await page.$eval('select[name="sample"]', s => s.value);
        await page.$eval('.order', f => f.requestSubmit());
        const form = await page.evaluate(() => ({
            invalid: document.querySelector('input[name="name"]').closest('.field').classList.contains('is-invalid'),
            hint: document.querySelector('.order__hint').className
        }));
        check('trang chủ: "Đặt mẫu này" chọn sẵn mẫu; thiếu tên thì phiếu báo', picked === firstId && form.invalid && /is-error/.test(form.hint),
            JSON.stringify({ picked, firstId, form }));

        // Xem thử: bấm phát thì nạp trình phát của kịch bản đang chọn trong khung
        await page.$eval('#xem-thu', el => el.scrollIntoView());
        await tap('.demo__play');
        const src = await page.$eval('.demo__screen iframe', f => f.getAttribute('src')).catch(() => '');
        check('trang chủ: bấm phát thì chạy màn trình diễn trong khung xem thử', /^\.\/demo\?config=/.test(src), src);
        check('trang chủ: không lỗi JS', !page.errors.length, page.errors.join(' | '));
    } finally {
        await page.close();
    }

    // Link tặng cũ trỏ vào trang chủ: chuyển sang /demo, giữ nguyên tham số
    const old = await openPage(browser, { width: 800, height: 600 });
    try {
        for (const url of ['/index.html?config=graduation_nguyen_van', '/?config=graduation_nguyen_van']) {
            await old.goto(base + url, { waitUntil: 'domcontentloaded' });
            const ok = await waitFor(old, () => location.pathname.endsWith('/demo') && location.search === '?config=graduation_nguyen_van');
            check(`link tặng cũ ${url} chuyển sang /demo`, ok, await old.evaluate(() => location.href));
        }
    } finally {
        await old.close();
    }

    // Điện thoại: không tràn ngang, menu mở ra được
    const phone = await openPage(browser, { width: 390, height: 844 });
    try {
        await phone.goto(`${base}/`, { waitUntil: 'networkidle0' });
        // Đã cuộn xuống (thanh trên cùng mờ kính) menu vẫn phủ cả màn hình
        await phone.evaluate(() => window.scrollTo({ top: 1500, behavior: 'instant' }));
        await sleep(500);
        await phone.click('.menu-toggle');
        await sleep(500);
        const info = await phone.evaluate(() => {
            const menu = document.getElementById('topnav');
            return {
                overflow: document.documentElement.scrollWidth > window.innerWidth,
                open: menu.classList.contains('is-open') && getComputedStyle(menu).visibility === 'visible',
                height: Math.round(menu.getBoundingClientRect().height)
            };
        });
        check('trang chủ trên điện thoại: không tràn ngang, menu mở phủ cả màn hình', !info.overflow && info.open && info.height >= 800,
            JSON.stringify(info));
        check('trang chủ trên điện thoại: không lỗi JS', !phone.errors.length, phone.errors.join(' | '));
    } finally {
        await phone.close();
    }

    check('bản build có ảnh banner trang chủ', fs.readdirSync(path.join(DIST, 'assets/img')).some(f => f.startsWith('landing-')));

    // Logo, biểu tượng trang (scripts/brand-icons.mjs): đủ file, trang nào cũng trỏ tới, đường dẫn tương đối (trang chạy
    // trong thư mục con như GitHub Pages)
    const manifest = await (await fetch(`${base}/site.webmanifest`)).json().catch(() => null);
    const files = ['favicon.svg', 'favicon.ico', 'apple-touch-icon.png', ...(manifest ? manifest.icons.map(i => i.src) : [])];
    const missing = [];
    for (const file of files) if (!(await fetch(`${base}/${file}`)).ok) missing.push(file);
    check('logo, biểu tượng trang: đủ file, site.webmanifest hợp lệ', manifest && manifest.icons.length >= 2 && !missing.length, missing.join(' '));
    const noIcon = [];
    for (const route of ['', 'demo', 'builder', 'privacy', 'terms', 'theo-doi']) {
        const page = await (await fetch(`${base}/${route}`)).text();
        if (!page.includes('<link rel="icon" href="./favicon.svg"') || !page.includes('href="./apple-touch-icon.png"')) noIcon.push(route || '/');
    }
    check('trang nào cũng có biểu tượng mới (đường dẫn tương đối)', !noIcon.length, noIcon.join(' '));

    // Tên thương hiệu Hanabi: tiêu đề mọi trang, tên trang khi chia sẻ (cả trang chia sẻ của kịch bản)
    const noBrand = [];
    for (const route of ['', 'demo', 'builder', 'privacy', 'terms', 'theo-doi', 's/graduation_nguyen_van']) {
        const page = await (await fetch(`${base}/${route}`)).text();
        const title = (page.match(/<title>([^<]*)<\/title>/) || [])[1] || '';
        const site = (page.match(/og:site_name" content="([^"]*)"/) || [])[1];
        if (!/Hanabi/.test(title) && site !== 'Hanabi') noBrand.push(`/${route}: ${title}`);
        if (site !== undefined && site !== 'Hanabi') noBrand.push(`/${route} og:site_name=${site}`);
        if (/Trình diễn Pháo hoa/.test(title) || /Firework Builder/.test(page)) noBrand.push(`/${route}: còn tên cũ`);
    }
    check('tên thương hiệu Hanabi ở mọi trang, không còn tên cũ', !noBrand.length, noBrand.join(' | '));

    // Trang 404 (GitHub Pages trả ở đúng đường dẫn bị gõ sai): tự chứa kiểu chữ, logo; link về trang chủ, demo tính theo
    // gốc web chứ không theo đường dẫn tương đối
    const notFound = await openPage(browser, { width: 800, height: 600 });
    try {
        await notFound.goto(`${base}/404.html`, { waitUntil: 'networkidle0' });
        const info = await notFound.evaluate(() => ({
            title: document.title,
            links: [...document.querySelectorAll('.actions a')].map(a => a.getAttribute('href')),
            external: [...document.querySelectorAll('link[rel="stylesheet"], script[src], img[src]')].length,
            logo: !!document.querySelector('svg.logo')
        }));
        check('trang 404 có logo, tự chứa, link về trang chủ và demo theo gốc web',
            /Hanabi/.test(info.title) && info.logo && info.external === 0 && info.links.join() === '/,/demo', JSON.stringify(info));
    } finally {
        await notFound.close();
    }
}
