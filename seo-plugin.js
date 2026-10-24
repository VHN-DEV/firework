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

// Địa chỉ trang chính khi đăng lên mạng (bắt buộc là URL tuyệt đối cho ảnh xem trước). Đổi bằng biến môi trường SITE_URL.
export const SITE_URL = (process.env.SITE_URL || 'https://firework.vhnam18032002.workers.dev/').replace(/\/?$/, '/');
// Địa chỉ bản cũ khi build cho chính bản cũ (biến môi trường MOVED_FROM, vd bản GitHub Pages sau khi trang chính chuyển
// sang Cloudflare): mỗi trang tự mở trang tương ứng ở SITE_URL, xem movedScript
const MOVED_FROM = process.env.MOVED_FROM || '';

// Chạy trong trang của bản cũ (from: gốc bản cũ, to: gốc bản mới, page: tên trang): mở đúng trang đó ở bản mới, giữ
// nguyên ?config=..., #k=... Bản cũ là trang tĩnh lưu kịch bản trong trình duyệt của người tạo, bản mới khác tên miền nên
// không đọc được: builder còn kịch bản, bản nháp thì ở lại và báo cách chuyển sang; màn trình diễn kịch bản lưu trong
// trình duyệt này cũng ở lại.
function movedRedirect(from, to, page) {
    var here = location.href;
    if (here.indexOf(from) !== 0) return;
    var saved = {};
    var draft = false;
    try {
        saved = JSON.parse(localStorage.getItem('my_firework_scripts') || '{}') || {};
        draft = !!localStorage.getItem('firework_builder_draft');
    } catch (e) {
        // localStorage bị chặn: trình duyệt không giữ kịch bản nào
    }
    var config = new URLSearchParams(location.search).get('config');
    if (page === 'demo' && config && saved[config]) return;
    if (page !== 'builder' || (!Object.keys(saved).length && !draft)) {
        location.replace(to + here.slice(from.length));
        return;
    }
    document.addEventListener('DOMContentLoaded', function () {
        var bar = document.createElement('div');
        bar.id = 'moved-notice';
        bar.setAttribute('role', 'status');
        bar.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;z-index:100000;max-width:720px;margin:0 auto;'
            + 'padding:12px 16px;border-radius:12px;background:#1d1838;color:#eef0ff;font:14px/1.5 system-ui,sans-serif;'
            + 'box-shadow:0 8px 28px rgba(0,0,0,.45);display:flex;gap:12px;align-items:center';
        bar.innerHTML = '<span>Hanabi đã chuyển sang <a href="' + to + 'builder" style="color:#ffc65c;font-weight:600">trang mới</a>.'
            + ' Kịch bản bạn lưu ở đây chỉ nằm trong trình duyệt này: mở từng kịch bản, bấm Xuất để lưu ra file .json, rồi vào'
            + ' trang mới bấm Nhập.</span><button type="button" style="flex:none;padding:6px 12px;border:0;border-radius:8px;'
            + 'background:#3a3266;color:inherit;font:inherit;cursor:pointer">Đóng</button>';
        bar.querySelector('button').onclick = function () {
            bar.remove();
        };
        document.body.appendChild(bar);
    });
}

// Thẻ <script> chèn ngay sau <meta charset> của mỗi trang khi build cho bản cũ ('' khi không có MOVED_FROM)
export function movedScript(page, from = MOVED_FROM, to = SITE_URL) {
    if (!from) return '';
    const args = [from.replace(/\/?$/, '/'), to, page].map(v => JSON.stringify(v)).join(', ');
    return `<script>(${movedRedirect})(${args});</script>`;
}

const withMovedScript = (html, page) => html.replace(/<meta charset="UTF-8">/i, tag => tag + movedScript(page));

export default function seoPlugin({ configsDir }) {
    return {
        name: 'firework-seo',

        // Điền địa chỉ tuyệt đối vào thẻ meta của các trang (index.html, demo.html, builder.html)
        transformIndexHtml(html, ctx) {
            return withMovedScript(html.replace(/__SITE_URL__/g, SITE_URL), path.basename(ctx.filename || ctx.path || '', '.html'));
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
                    source: withMovedScript(renderSharePage({ id, ...shareMetaFromConfig(config), shareUrl: `${SITE_URL}s/${id}`, imageUrl }), 's')
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
