/*!
 * Trình diễn Pháo hoa – kiểm thử tự động
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Trang Điều khoản/Bảo mật, giấy phép và sitemap trong bản build, trang chia sẻ của kịch bản mẫu.
import { openPage } from './helpers.mjs';

export async function run(browser, base, { check }) {
    for (const [name, heading] of [['privacy', 'Chính sách bảo mật'], ['terms', 'Điều khoản sử dụng & Bản quyền']]) {
        const page = await openPage(browser, { width: 390, height: 844 });
        await page.goto(`${base}/${name}.html`, { waitUntil: 'networkidle0' });
        const info = await page.evaluate(() => ({
            h1: document.querySelector('h1').textContent,
            overflow: document.documentElement.scrollWidth > window.innerWidth
        }));
        check(`trang ${name}.html hiển thị trên điện thoại`, info.h1 === heading && !info.overflow, JSON.stringify(info));
        await page.close();
    }
    for (const file of ['LICENSE.txt', 'THIRD_PARTY_NOTICES.md', 'sitemap.xml', 'robots.txt']) {
        check(`bản build có ${file}`, (await fetch(`${base}/${file}`)).ok);
    }
    const share = await (await fetch(`${base}/s/graduation_nguyen_van.html`)).text();
    check('kịch bản mẫu có trang chia sẻ', share.includes('og:image') && share.includes('noindex'));
}
