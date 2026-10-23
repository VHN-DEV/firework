/*!
 * Trình diễn Pháo hoa – SEO và trang chia sẻ lúc build
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

/**
 * SEO & chia sẻ mạng xã hội lúc build.
 *
 * Facebook, Zalo, Messenger, Telegram... chỉ đọc thẻ <meta> trong HTML tĩnh (không chạy JavaScript) để dựng
 * khung xem trước (ảnh, tiêu đề, mô tả). Vì vậy mỗi kịch bản trong src/static/configs có một trang chia sẻ riêng
 * s/<tên> chứa sẵn các thẻ đó rồi tự chuyển sang màn trình diễn (demo?config=<tên>).
 * Trên host PHP, kịch bản lưu sau khi build được phục vụ bằng api/share.php (cùng mẫu HTML).
 *
 * Mọi link dùng đường dẫn không đuôi .html (/builder, /demo, /s/<tên>): GitHub Pages tự phục vụ /<tên> bằng <tên>.html,
 * Apache theo src/static/.htaccess. Link cũ có .html vẫn mở được; canonical của mỗi trang trỏ về bản không đuôi.
 */
import fs from 'fs';
import path from 'path';

// Địa chỉ trang khi đăng lên mạng (bắt buộc là URL tuyệt đối cho ảnh xem trước). Đổi bằng biến môi trường SITE_URL.
export const SITE_URL = (process.env.SITE_URL || 'https://vhn-dev.github.io/firework/').replace(/\/?$/, '/');
export const SITE_NAME = 'Trình diễn Pháo hoa';
export const SITE_DESCRIPTION = 'Tự thiết kế và gửi tặng những màn pháo hoa lung linh kèm lời chúc cho người thân yêu: sinh nhật, tốt nghiệp, năm mới, kỷ niệm...';

const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// Giống replacePlaceholders() của trình phát, để tiêu đề trên mạng xã hội khớp với màn trình diễn
function replacePlaceholders(text) {
    if (typeof text !== 'string') return text;
    const year = new Date().getFullYear();
    const cans = ['Canh', 'Tân', 'Nhâm', 'Quý', 'Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ'];
    const chis = ['Thân', 'Dậu', 'Tuất', 'Hợi', 'Tí', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi'];
    return text
        .replace(/\[YEAR\]/g, year)
        .replace(/\[LUNAR_YEAR\]/g, `${cans[year % 10]} ${chis[year % 12]}`.toUpperCase())
        .replace(/\[SINCE:(\d+)\]/g, (m, p1) => year - parseInt(p1, 10));
}

// Mẫu HTML trang chia sẻ. api/share.php dựng đúng mẫu này cho kịch bản lưu trên host PHP.
export function renderSharePage({ id, title, description, shareUrl, imageUrl }) {
    const showPath = `../demo?config=${encodeURIComponent(id)}`;
    const t = escapeHtml(title);
    const d = escapeHtml(description);
    return `<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${t}</title>
    <meta name="description" content="${d}">
    <!-- Trang tặng riêng (có tên người nhận): không đưa lên Google, nhưng mạng xã hội vẫn đọc được để hiện xem trước -->
    <meta name="robots" content="noindex, follow">
    <link rel="canonical" href="${escapeHtml(shareUrl)}">
    <meta property="og:type" content="website">
    <meta property="og:locale" content="vi_VN">
    <meta property="og:site_name" content="${escapeHtml(SITE_NAME)}">
    <meta property="og:title" content="${t}">
    <meta property="og:description" content="${d}">
    <meta property="og:url" content="${escapeHtml(shareUrl)}">
    <meta property="og:image" content="${escapeHtml(imageUrl)}">
    <meta property="og:image:type" content="image/jpeg">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="${t}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${t}">
    <meta name="twitter:description" content="${d}">
    <meta name="twitter:image" content="${escapeHtml(imageUrl)}">
    <meta name="theme-color" content="#000000">
    <link rel="icon" type="image/png" href="../assets/img/firework-burst-icon-v2.png">
    <meta http-equiv="refresh" content="0; url=${escapeHtml(showPath)}">
    <script>location.replace(${JSON.stringify(showPath)} + location.hash);</script>
    <style>
        body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #000; color: #ccc; font-family: system-ui, sans-serif; text-align: center; }
        a { color: #ffbf36; }
    </style>
</head>
<body>
    <p>Đang mở màn trình diễn <a href="${escapeHtml(showPath)}">${t}</a>...</p>
</body>
</html>
`;
}

export function shareMetaFromConfig(config) {
    const title = replacePlaceholders(config.seoTitle || config.title || SITE_NAME);
    const parts = [replacePlaceholders(config.subtitle), config.author].filter(Boolean);
    // Mô tả tự nhập trong builder ("Mô tả khi chia sẻ"), không có thì ghép dòng phụ và người thực hiện
    const description = replacePlaceholders(config.seoDescription) || (parts.length ? parts.join(' – ') : SITE_DESCRIPTION);
    return { title, description };
}

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
