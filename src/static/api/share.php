<?php
/**
 * Hanabi – © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 *
 * Trang chia sẻ cho kịch bản lưu trên host PHP (kịch bản có sẵn lúc build đã có file tĩnh s/<tên>.html).
 * .htaccess chuyển s/<tên> (cả link cũ s/<tên>.html) -> api/share.php?c=<tên>. Cùng mẫu HTML với seo-plugin.js:
 * mạng xã hội đọc thẻ meta (ảnh, tiêu đề, mô tả) để dựng khung xem trước, người xem được chuyển sang màn trình diễn.
 */
header('Content-Type: text/html; charset=utf-8');

const SITE_NAME = 'Hanabi';
const SITE_DESCRIPTION = 'Tự thiết kế và gửi tặng những màn pháo hoa lung linh kèm lời chúc cho người thân yêu: sinh nhật, tốt nghiệp, năm mới, kỷ niệm...';

$id = isset($_GET['c']) && is_string($_GET['c']) ? preg_replace('/[^a-zA-Z0-9_-]/', '', $_GET['c']) : '';
$configsDir = __DIR__ . '/../configs/';
$file = $configsDir . $id . '.json';

$https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
    || (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https');
// Gốc trang = thư mục cha của api/
$root = rtrim(str_replace('\\', '/', dirname(dirname($_SERVER['SCRIPT_NAME']))), '/') . '/';
$siteUrl = ($https ? 'https' : 'http') . '://' . $_SERVER['HTTP_HOST'] . $root;

$config = ($id !== '' && is_file($file)) ? json_decode(file_get_contents($file), true) : null;
if (!is_array($config) || !isset($config['events']) || !is_array($config['events'])) {
    // Đường dẫn tương đối: không dựng từ Host do người gửi yêu cầu tự đặt
    header('Location: ../', true, 302);
    exit;
}

// Giống replacePlaceholders() của trình phát
function replace_placeholders($text) {
    if (!is_string($text)) return $text;
    $year = (int)date('Y');
    $cans = ['Canh', 'Tân', 'Nhâm', 'Quý', 'Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ'];
    $chis = ['Thân', 'Dậu', 'Tuất', 'Hợi', 'Tí', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi'];
    $text = str_replace('[YEAR]', (string)$year, $text);
    $text = str_replace('[LUNAR_YEAR]', mb_strtoupper($cans[$year % 10] . ' ' . $chis[$year % 12], 'UTF-8'), $text);
    return preg_replace_callback('/\[SINCE:(\d+)\]/', function ($m) use ($year) {
        return (string)($year - (int)$m[1]);
    }, $text);
}

// Chỉ nhận chữ: kịch bản sửa tay có thể ghi sai kiểu (mảng...)
$text = function ($key) use ($config) {
    return isset($config[$key]) && is_string($config[$key]) ? $config[$key] : '';
};
$title = replace_placeholders($text('seoTitle') !== '' ? $text('seoTitle') : ($text('title') !== '' ? $text('title') : SITE_NAME));
$parts = array_filter([replace_placeholders($text('subtitle')), $text('author')]);
// Mô tả tự nhập trong builder ("Mô tả khi chia sẻ"), không có thì ghép dòng phụ và người thực hiện
$description = !empty($config['seoDescription']) && is_string($config['seoDescription'])
    ? replace_placeholders($config['seoDescription'])
    : ($parts ? implode(' – ', $parts) : SITE_DESCRIPTION);

$imageFile = $configsDir . $id . '.jpg';
$imageUrl = is_file($imageFile)
    ? $siteUrl . 'configs/' . $id . '.jpg?v=' . filemtime($imageFile)
    : $siteUrl . 'og-default.jpg';
$shareUrl = $siteUrl . 's/' . $id;
$showPath = '../demo?config=' . rawurlencode($id);

$e = function ($v) {
    return htmlspecialchars((string)$v, ENT_QUOTES, 'UTF-8');
};
?><!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title><?= $e($title) ?></title>
    <meta name="description" content="<?= $e($description) ?>">
    <!-- Trang tặng riêng (có tên người nhận): không đưa lên Google, nhưng mạng xã hội vẫn đọc được để hiện xem trước -->
    <meta name="robots" content="noindex, follow">
    <link rel="canonical" href="<?= $e($shareUrl) ?>">
    <meta property="og:type" content="website">
    <meta property="og:locale" content="vi_VN">
    <meta property="og:site_name" content="<?= $e(SITE_NAME) ?>">
    <meta property="og:title" content="<?= $e($title) ?>">
    <meta property="og:description" content="<?= $e($description) ?>">
    <meta property="og:url" content="<?= $e($shareUrl) ?>">
    <meta property="og:image" content="<?= $e($imageUrl) ?>">
    <meta property="og:image:type" content="image/jpeg">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="<?= $e($title) ?>">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="<?= $e($title) ?>">
    <meta name="twitter:description" content="<?= $e($description) ?>">
    <meta name="twitter:image" content="<?= $e($imageUrl) ?>">
    <meta name="theme-color" content="#000000">
    <link rel="icon" href="../favicon.svg" type="image/svg+xml">
    <meta http-equiv="refresh" content="0; url=<?= $e($showPath) ?>">
    <script>location.replace(<?= json_encode($showPath) ?> + location.hash);</script>
    <style>
        body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #000; color: #ccc; font-family: system-ui, sans-serif; text-align: center; }
        a { color: #ffbf36; }
    </style>
</head>
<body>
    <p>Đang mở màn trình diễn <a href="<?= $e($showPath) ?>"><?= $e($title) ?></a>...</p>
</body>
</html>
