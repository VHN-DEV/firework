<?php
/**
 * Trình diễn Pháo hoa – © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 *
 * Script to save firework configuration to a JSON file.
 */

require __DIR__ . '/tracking.inc.php';

header('Content-Type: application/json');

// Get the POST data
$rawData = file_get_contents('php://input');
$data = json_decode($rawData, true);

if (!$data) {
    echo json_encode(['success' => false, 'message' => 'Dữ liệu không hợp lệ.']);
    exit;
}

$filename = isset($data['filename']) && is_string($data['filename']) ? $data['filename'] : '';
$config = isset($data['config']) ? $data['config'] : null;
$key = isset($data['key']) && is_string($data['key']) ? $data['key'] : '';
// Nút "Xem thử": mỗi lần một bản tạm tên ngẫu nhiên (hai người cùng xem thử không thấy kịch bản của nhau)
$isPreview = !empty($data['preview']);
if ($isPreview) {
    $filename = 'preview_temp_' . bin2hex(random_bytes(8));
}

if (empty($filename) || !$config) {
    echo json_encode(['success' => false, 'message' => 'Thiếu tên file hoặc nội dung cấu hình.']);
    exit;
}
// Kịch bản phải là một đối tượng có danh sách phát bắn (danh sách kịch bản, trang chia sẻ đều dựa vào đó)
if (!is_array($config) || !isset($config['events']) || !is_array($config['events'])) {
    echo json_encode(['success' => false, 'message' => 'Nội dung kịch bản không hợp lệ.']);
    exit;
}
// "Riêng tư" chỉ dành cho kịch bản mẫu có sẵn trên máy chủ, không nhận từ trình duyệt (ai cũng gửi được để khóa
// kịch bản của người khác)
unset($config['status']);

// Sanitize filename: only allow alphanumeric, underscores, and dashes
$filename = preg_replace('/[^a-zA-Z0-9_-]/', '', $filename);
$filename = strtolower($filename);

if (empty($filename)) {
    echo json_encode(['success' => false, 'message' => 'Tên file không hợp lệ.']);
    exit;
}
if (!$isPreview && strpos($filename, 'preview_temp') === 0) {
    echo json_encode(['success' => false, 'message' => 'Tên file này dành cho bản xem thử, hãy đặt tên khác.']);
    exit;
}

$targetDir = __DIR__ . '/../configs/';
if (!is_dir($targetDir)) {
    mkdir($targetDir, 0755, true);
}

$filePath = $targetDir . $filename . '.json';
$isNew = !file_exists($filePath);

// Bản xem thử cũ hơn 1 ngày: xóa (kể cả preview_temp dùng chung của bản trước)
if ($isPreview) {
    foreach (glob($targetDir . 'preview_temp*.json') as $old) {
        if (preg_match('/^preview_temp(_[a-f0-9]{16})?\.json$/', basename($old)) && filemtime($old) < time() - 86400) {
            @unlink($old);
        }
    }
}

// Check if existing file is private
if (!$isNew) {
    $existingContent = json_decode(file_get_contents($filePath), true);
    if (isset($existingContent['status']) && $existingContent['status'] === 'private') {
        echo json_encode(['success' => false, 'message' => 'Kịch bản này là riêng tư và không thể ghi đè.']);
        exit;
    }
    // Kịch bản do máy khác tạo: không ghi đè (builder tự lưu thành bản mới)
    if (!track_can_modify($filename, $key)) {
        echo json_encode(['success' => false, 'code' => 'not_owner',
            'message' => 'Kịch bản này do máy khác tạo, chỉ máy đó mới lưu đè được. Hãy lưu với tên khác.']);
        exit;
    }
}

// Ghi ra file tạm rồi đổi tên: lỗi giữa chừng (hết chỗ, dữ liệu không mã hóa được) không làm hỏng kịch bản đang có
$jsonContent = json_encode($config, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
$tmpPath = $targetDir . '.' . $filename . '.' . bin2hex(random_bytes(4)) . '.tmp';
$saved = $jsonContent !== false && file_put_contents($tmpPath, $jsonContent, LOCK_EX) === strlen($jsonContent)
    && rename($tmpPath, $filePath);
if (!$saved && is_file($tmpPath)) {
    unlink($tmpPath);
}
if ($saved) {
    // Ảnh xem trước khi chia sẻ link (builder vẽ sẵn, dạng data:image/jpeg;base64,...): configs/<tên>.jpg
    if (!empty($data['shareImage']) && is_string($data['shareImage'])
        && preg_match('#^data:image/jpeg;base64,([A-Za-z0-9+/=]+)$#', $data['shareImage'], $m)) {
        $binary = base64_decode($m[1], true);
        $info = ($binary !== false && strlen($binary) <= 2 * 1024 * 1024) ? @getimagesizefromstring($binary) : false;
        if ($info && $info[2] === IMAGETYPE_JPEG) {
            file_put_contents($targetDir . $filename . '.jpg', $binary);
        }
    }
    $response = ['success' => true, 'message' => 'Đã lưu kịch bản thành công!', 'filename' => $filename];
    // Kịch bản mới: tạo mã theo dõi mở quà, chỉ trả về lần này (trình soạn của người gửi giữ lại). Kịch bản đã có từ
    // trước mà chưa có mã (lưu trước khi có tính năng này) thì không cấp, kẻo người khác lưu đè là lấy được mã.
    $trackKey = $isNew && !$isPreview ? track_create_key($filename) : null;
    if ($trackKey) {
        $response['trackKey'] = $trackKey;
    }
    echo json_encode($response);
} else {
    echo json_encode(['success' => false, 'message' => 'Không thể lưu file. Vui lòng kiểm tra quyền ghi của thư mục configs.']);
}
