<?php
/**
 * Hanabi – © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 *
 * Tải nhạc nền cho một kịch bản, lưu tại uploads/music/<tên kịch bản>/.
 */

header('Content-Type: application/json');

function fail($message)
{
    echo json_encode(['success' => false, 'message' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    fail('Phương thức không hợp lệ.');
}

// File lớn hơn post_max_size: PHP bỏ cả biểu mẫu, $_POST và $_FILES đều rỗng
if (empty($_FILES) && !empty($_SERVER['CONTENT_LENGTH'])) {
    fail('File nhạc vượt giới hạn tải lên của máy chủ (post_max_size = ' . ini_get('post_max_size') . ').');
}

$filename = strtolower(preg_replace('/[^a-zA-Z0-9_-]/', '', isset($_POST['filename']) ? $_POST['filename'] : ''));
if ($filename === '') {
    fail('Thiếu tên kịch bản.');
}

if (!isset($_FILES['audio'])) {
    fail('Không tìm thấy file nhạc.');
}

$file = $_FILES['audio'];
if ($file['error'] === UPLOAD_ERR_INI_SIZE || $file['error'] === UPLOAD_ERR_FORM_SIZE) {
    fail('File nhạc vượt giới hạn tải lên của máy chủ (upload_max_filesize = ' . ini_get('upload_max_filesize') . ').');
}
if ($file['error'] !== UPLOAD_ERR_OK) {
    fail('Lỗi upload: ' . $file['error']);
}
if ($file['size'] > 20 * 1024 * 1024) {
    fail('File nhạc quá lớn (tối đa 20MB).');
}

// Nhận dạng định dạng từ NỘI DUNG file và tự đặt đuôi file theo định dạng.
// Không tin tên file/MIME do trình duyệt gửi lên (tránh tải lên file .php giả dạng nhạc rồi chạy trên server).
function detect_audio_type($path)
{
    $head = file_get_contents($path, false, null, 0, 16);
    if ($head === false || strlen($head) < 12) {
        return null;
    }
    if (substr($head, 0, 3) === 'ID3') {
        return 'mp3';
    }
    // Khung MPEG audio không có thẻ ID3: 11 bit đồng bộ, layer khác 0
    if (ord($head[0]) === 0xFF && (ord($head[1]) & 0xE0) === 0xE0 && (ord($head[1]) & 0x06) !== 0) {
        return 'mp3';
    }
    if (substr($head, 4, 4) === 'ftyp') {
        return 'm4a';
    }
    if (substr($head, 0, 4) === 'OggS') {
        return 'ogg';
    }
    if (substr($head, 0, 4) === 'RIFF' && substr($head, 8, 4) === 'WAVE') {
        return 'wav';
    }
    return null;
}

$type = detect_audio_type($file['tmp_name']);
if ($type === null) {
    fail('Định dạng không được hỗ trợ. Hãy dùng file MP3, M4A, OGG hoặc WAV.');
}

// Cạnh thư mục configs/ giống ảnh: chạy dev phục vụ tại ./uploads/..., khi build được copy sang dist/uploads/...
$targetDir = __DIR__ . '/../uploads/music/' . $filename . '/';
if (!is_dir($targetDir) && !mkdir($targetDir, 0755, true)) {
    fail('Không thể tạo thư mục lưu nhạc.');
}

$newFileName = uniqid('music_', true) . '.' . $type;
if (!move_uploaded_file($file['tmp_name'], $targetDir . $newFileName)) {
    fail('Không thể lưu file nhạc.');
}

// Tên bài để hiển thị trong builder: bỏ ký tự điều khiển, tối đa 120 ký tự
$displayName = preg_replace('/[\x00-\x1F\x7F]/u', '', basename($file['name']));
$displayName = preg_match('/^.{0,120}/us', (string) $displayName, $m) ? $m[0] : '';

echo json_encode([
    'success' => true,
    'message' => 'Tải nhạc lên thành công!',
    'url' => './uploads/music/' . $filename . '/' . $newFileName,
    'name' => $displayName,
], JSON_UNESCAPED_UNICODE);
