/*!
 * Hanabi – SEO và trang chia sẻ lúc build
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

/**
 * SEO & chia sẻ mạng xã hội lúc build.
 *
 * Facebook, Zalo, Messenger, Telegram... chỉ đọc thẻ <meta> trong HTML tĩnh (không chạy JavaScript) để dựng
 * khung xem trước (ảnh, tiêu đề, mô tả). Vì vậy mỗi kịch bản trong src/static/configs có một trang chia sẻ riêng
 * s/<tên> chứa sẵn các thẻ đó rồi tự chuyển sang màn trình diễn (demo?config=<tên>).
 * Trên host PHP, kịch bản lưu sau khi build được phục vụ bằng api/share.php, trên Cloudflare bằng worker/ (cùng mẫu HTML,
 * share-page.js).
 *
 * Mọi link dùng đường dẫn không đuôi .html (/builder, /demo, /s/<tên>): GitHub Pages tự phục vụ /<tên> bằng <tên>.html,
 * Apache theo src/static/.htaccess. Link cũ có .html vẫn mở được; canonical của mỗi trang trỏ về bản không đuôi.
 */
import fs from 'fs';
import path from 'path';
import { renderSharePage, shareMetaFromConfig } from './share-page.js';

// Địa chỉ trang khi đăng lên mạng (bắt buộc là URL tuyệt đối cho ảnh xem trước). Đổi bằng biến môi trường SITE_URL.
export const SITE_URL = (process.env.SITE_URL || 'https://vhn-dev.github.io/firework/').replace(/\/?$/, '/');
export default function seoPlugin({ configsDir }) {
    return {
        name: 'firework-seo',

        // Điền địa chỉ tuyệt đối vào thẻ meta của các trang (index.html, demo.html, builder.html)
        transformIndexHtml(html) {
            return html.replace(/__SITE_URL__/g, SITE_URL);
        },

        generateBundle() {
            const files = fs.existsSync(configsDir) ? fs.readdirSync(configsDir) : [];
            const ids = [];
            for (const file of files) {
                if (!file.endsWith('.json') || file === 'configs_index.json') continue;
                const id = path.basename(file, '.json');
                let config;
                try {
                    config = JSON.parse(fs.readFileSync(path.join(configsDir, file), 'utf8'));
                } catch (e) {
                    this.warn(`Bỏ qua ${file}: JSON không hợp lệ`);
                    continue;
                }
                if (!config || !Array.isArray(config.events)) continue;

                // Ảnh xem trước riêng configs/<tên>.jpg (builder tạo khi lưu), không có thì dùng ảnh chung
                const imageFile = path.join(configsDir, `${id}.jpg`);
                const imageUrl = fs.existsSync(imageFile)
                    ? `${SITE_URL}configs/${id}.jpg?v=${Math.round(fs.statSync(imageFile).mtimeMs / 1000)}`
                    : `${SITE_URL}og-default.jpg`;

                this.emitFile({
                    type: 'asset',
                    fileName: `s/${id}.html`,
                    source: renderSharePage({ id, ...shareMetaFromConfig(config), shareUrl: `${SITE_URL}s/${id}`, imageUrl })
                });
                ids.push(id);
            }

            // Sitemap chỉ gồm các trang chung; trang tặng riêng không đưa lên công cụ tìm kiếm
            const today = new Date().toISOString().slice(0, 10);
            this.emitFile({
                type: 'asset',
                fileName: 'sitemap.xml',
                source: `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url><loc>${SITE_URL}</loc><lastmod>${today}</lastmod><priority>1.0</priority></url>
    <url><loc>${SITE_URL}demo</loc><lastmod>${today}</lastmod><priority>0.9</priority></url>
    <url><loc>${SITE_URL}builder</loc><lastmod>${today}</lastmod><priority>0.8</priority></url>
    <url><loc>${SITE_URL}terms</loc><lastmod>${today}</lastmod><priority>0.3</priority></url>
    <url><loc>${SITE_URL}privacy</loc><lastmod>${today}</lastmod><priority>0.3</priority></url>
</urlset>
`
            });
            this.emitFile({
                type: 'asset',
                fileName: 'robots.txt',
                source: `User-agent: *
Allow: /
Disallow: ${new URL(SITE_URL).pathname}api/
Disallow: ${new URL(SITE_URL).pathname}theo-doi

Sitemap: ${SITE_URL}sitemap.xml
`
            });
            this.info?.(`Đã tạo ${ids.length} trang chia sẻ: ${ids.join(', ')}`);
        }
    };
}
