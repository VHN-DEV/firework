/*!
 * Hanabi – kiểm thử tự động
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Trang Điều khoản/Bảo mật, giấy phép và sitemap trong bản build, trang chia sẻ của kịch bản mẫu,
// đường dẫn không đuôi .html (/builder, /demo, /s/<tên>) và link cũ có .html.
import fs from 'fs';
import path from 'path';
import { DIST, openPage } from './helpers.mjs';

export async function run(browser, base, { check }) {
    for (const [name, heading] of [['privacy', 'Chính sách bảo mật'], ['terms', 'Điều khoản sử dụng & Bản quyền']]) {
        const page = await openPage(browser, { width: 390, height: 844 });
        await page.goto(`${base}/${name}`, { waitUntil: 'networkidle0' });
        const info = await page.evaluate(() => ({
            h1: document.querySelector('h1').textContent,
            overflow: document.documentElement.scrollWidth > window.innerWidth
        }));
        check(`trang /${name} hiển thị trên điện thoại`, info.h1 === heading && !info.overflow, JSON.stringify(info));
        await page.close();
    }

    // Link giữa các trang và canonical không lộ tên file
    for (const route of ['demo', 'builder', 'privacy', 'terms', 'theo-doi']) {
        const html = await (await fetch(`${base}/${route}`)).text();
        const links = [...html.matchAll(/<(?:a|link)\b[^>]*\bhref="([^"]*)"/g)].map(m => m[1]).filter(h => /\.html\b/.test(h));
        check(`trang /${route}: link và canonical không có đuôi .html`, !links.length, links.join(' '));
    }
    // Link cũ (đã gửi đi, đã lưu, Google đã ghi nhận) vẫn mở được
    for (const url of ['/demo.html?config=graduation_nguyen_van', '/builder.html', '/privacy.html', '/terms.html', '/theo-doi.html']) {
        check(`link cũ ${url} vẫn mở được`, (await fetch(base + url)).ok);
    }

    for (const file of ['LICENSE.txt', 'THIRD_PARTY_NOTICES.md', 'sitemap.xml', 'robots.txt']) {
        check(`bản build có ${file}`, (await fetch(`${base}/${file}`)).ok);
    }
    const sitemap = await (await fetch(`${base}/sitemap.xml`)).text();
    check('sitemap chỉ gồm đường dẫn sạch', sitemap.includes('/builder</loc>') && !sitemap.includes('.html'), sitemap);

    // Trang chia sẻ: link mới s/<tên> và link cũ s/<tên>.html (trang động trên host PHP)
    for (const url of ['/s/graduation_nguyen_van', '/s/graduation_nguyen_van.html']) {
        const share = await (await fetch(base + url)).text();
        check(`kịch bản mẫu có trang chia sẻ ${url}`, share.includes('og:image') && share.includes('noindex')
            && share.includes('/s/graduation_nguyen_van"') && share.includes('demo?config=graduation_nguyen_van') && !share.includes('.html'));
    }
    // Trang chia sẻ tĩnh lúc build (GitHub Pages phục vụ cả s/<tên> lẫn s/<tên>.html bằng file này)
    const staticShare = fs.readFileSync(path.join(DIST, 's', 'graduation_nguyen_van.html'), 'utf8');
    check('trang chia sẻ tĩnh: canonical s/<tên>, mở demo?config=<tên>', staticShare.includes('/s/graduation_nguyen_van"')
        && staticShare.includes('../demo?config=graduation_nguyen_van') && !staticShare.includes('.html'));
}
