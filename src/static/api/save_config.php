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

$filename = isset($data['filename']) ? $data['filename'] : '';
$config = isset($data['config']) ? $data['config'] : null;

if (empty($filename) || !$config) {
    echo json_encode(['success' => false, 'message' => 'Thiếu tên file hoặc nội dung cấu hình.']);
    exit;
}

// Sanitize filename: only allow alphanumeric, underscores, and dashes
$filename = preg_replace('/[^a-zA-Z0-9_-]/', '', $filename);
$filename = strtolower($filename);

if (empty($filename)) {
    echo json_encode(['success' => false, 'message' => 'Tên file không hợp lệ.']);
    exit;
}

$targetDir = __DIR__ . '/../configs/';
if (!is_dir($targetDir)) {
    mkdir($targetDir, 0755, true);
}

$filePath = $targetDir . $filename . '.json';

// Check if existing file is private
if (file_exists($filePath)) {
    $existingContent = json_decode(file_get_contents($filePath), true);
    if (isset($existingContent['status']) && $existingContent['status'] === 'private') {
        echo json_encode(['success' => false, 'message' => 'Kịch bản này là riêng tư và không thể ghi đè.']);
        exit;
    }
}

// Save the file
$jsonContent = json_encode($config, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
if (file_put_contents($filePath, $jsonContent)) {
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
    // Kịch bản mới: tạo mã theo dõi mở quà, chỉ trả về lần này (trình soạn của người gửi giữ lại)
    $trackKey = track_create_key($filename);
    if ($trackKey) {
        $response['trackKey'] = $trackKey;
    }
    echo json_encode($response);
} else {
    echo json_encode(['success' => false, 'message' => 'Không thể lưu file. Vui lòng kiểm tra quyền ghi của thư mục configs.']);
}
