/*!
 * Hanabi – trang chia sẻ s/<tên>
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Mẫu HTML trang chia sẻ, dùng chung cho lúc build (seo-plugin.js: trang tĩnh của kịch bản có sẵn) và Cloudflare Worker
// (worker/: kịch bản lưu trên máy chủ). api/share.php dựng đúng mẫu này cho host PHP. Không dùng module của Node ở đây
// (Worker chạy được).

export const SITE_NAME = 'Hanabi';
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
    <meta name="theme-color" content="#06070d">
    <link rel="icon" href="../favicon.svg" type="image/svg+xml">
    <meta http-equiv="refresh" content="0; url=${escapeHtml(showPath)}">
    <script>location.replace(${JSON.stringify(showPath)} + location.hash);</script>
    <style>
        body { margin: 0; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px; padding: 24px; background: #06070d radial-gradient(600px 400px at 50% 40%, rgba(139, 123, 255, 0.18), transparent 70%); color: #c7cce0; font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; text-align: center; }
        .logo { width: 64px; height: 64px; border-radius: 16px; box-shadow: 0 10px 30px -8px rgba(255, 95, 162, 0.6); }
        .spin { width: 26px; height: 26px; border-radius: 50%; border: 3px solid rgba(255, 255, 255, 0.12); border-top-color: #ff6aa8; animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        p { margin: 0; font-size: 15px; line-height: 1.6; }
        a { color: #ffc65c; font-weight: 600; text-decoration: none; }
    </style>
</head>
<body>
    <img class="logo" src="../favicon.svg" alt="Hanabi" width="64" height="64">
    <div class="spin" aria-hidden="true"></div>
    <p>Đang mở màn pháo hoa<br><a href="${escapeHtml(showPath)}">${t}</a></p>
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
