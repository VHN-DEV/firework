<?php
/**
 * Trình diễn Pháo hoa – © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 *
 * Bộ định tuyến cho máy chủ PHP có sẵn (php -S) khi chạy kiểm thử, làm thay .htaccess của Apache:
 * s/<tên>.html -> api/share.php?c=<tên>, chặn api/data/. Các đường dẫn khác phục vụ như bình thường.
 */
// Không dùng parse_url: nó hiểu //api/... là tên máy chủ 'api' chứ không phải đường dẫn
$path = explode('?', $_SERVER['REQUEST_URI'], 2)[0];
// Như api/data/.htaccess: dữ liệu báo mở quà không tải trực tiếp được. So theo đường dẫn đã giải mã và chuẩn hóa
// (%64ata, //api, /API, /./ đều trỏ tới cùng thư mục trên Windows)
$plain = strtolower(preg_replace('#/(\./)+#', '/', preg_replace('#/+#', '/', rawurldecode($path))));
if (strpos($plain, '/api/data/') === 0 || $plain === '/api/data') {
    http_response_code(403);
    return true;
}
if (preg_match('#^/s/([A-Za-z0-9_-]+)\.html$#', $path, $m)) {
    $_GET['c'] = $m[1];
    $_SERVER['SCRIPT_NAME'] = '/api/share.php';
    require __DIR__ . '/../../dist/api/share.php';
    return true;
}

// php -S không hỗ trợ tải theo đoạn (HTTP Range) như Apache/GitHub Pages; thiếu nó trình duyệt không tua được nhạc
// (nhạc nền "phát từ giây ..."). Tự trả 206 Partial Content cho file âm thanh.
$dist = realpath(__DIR__ . '/../../dist');
$file = realpath($dist . $path);
$types = ['mp3' => 'audio/mpeg', 'wav' => 'audio/wav', 'm4a' => 'audio/mp4', 'ogg' => 'audio/ogg'];
$ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
if ($file && strpos($file, $dist) === 0 && is_file($file) && isset($types[$ext])
    && isset($_SERVER['HTTP_RANGE']) && preg_match('/^bytes=(\d*)-(\d*)$/', $_SERVER['HTTP_RANGE'], $r)) {
    $size = filesize($file);
    $start = $r[1] === '' ? max(0, $size - (int) $r[2]) : (int) $r[1];
    $end = ($r[1] !== '' && $r[2] !== '') ? min((int) $r[2], $size - 1) : $size - 1;
    header('HTTP/1.1 206 Partial Content');
    header('Accept-Ranges: bytes');
    header("Content-Range: bytes $start-$end/$size");
    header('Content-Length: ' . ($end - $start + 1));
    header('Content-Type: ' . $types[$ext]);
    $fp = fopen($file, 'rb');
    fseek($fp, $start);
    echo fread($fp, $end - $start + 1);
    fclose($fp);
    return true;
}
return false;
