<?php
/**
 * API to upload images for a specific firework scenario.
 */

header('Content-Type: application/json');

// Check if it's a POST request
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Phương thức không hợp lệ.']);
    exit;
}

$filename = isset($_POST['filename']) ? $_POST['filename'] : '';
if (empty($filename)) {
    echo json_encode(['success' => false, 'message' => 'Thiếu tên kịch bản.']);
    exit;
}

// Sanitize filename
$filename = preg_replace('/[^a-zA-Z0-9_-]/', '', $filename);
$filename = strtolower($filename);

if (empty($filename)) {
    echo json_encode(['success' => false, 'message' => 'Tên kịch bản không hợp lệ.']);
    exit;
}

if (!isset($_FILES['image'])) {
    echo json_encode(['success' => false, 'message' => 'Không tìm thấy file ảnh.']);
    exit;
}

$file = $_FILES['image'];
$error = $file['error'];

if ($error !== UPLOAD_ERR_OK) {
    echo json_encode(['success' => false, 'message' => 'Lỗi upload: ' . $error]);
    exit;
}

if ($file['size'] > 10 * 1024 * 1024) {
    echo json_encode(['success' => false, 'message' => 'Ảnh quá lớn (tối đa 10MB).']);
    exit;
}

// Xác định loại ảnh từ NỘI DUNG file và tự đặt đuôi file theo loại ảnh.
// Không tin tên file/MIME do trình duyệt gửi lên: nếu không, có thể tải lên file .php giả dạng ảnh rồi chạy nó trên server.
$allowedTypes = [
    IMAGETYPE_JPEG => 'jpg',
    IMAGETYPE_PNG => 'png',
    IMAGETYPE_GIF => 'gif',
    IMAGETYPE_WEBP => 'webp',
];
$imageInfo = @getimagesize($file['tmp_name']);
if ($imageInfo === false || !isset($allowedTypes[$imageInfo[2]])) {
    echo json_encode(['success' => false, 'message' => 'Loại file không được hỗ trợ. Chỉ cho phép JPG, PNG, WEBP, GIF.']);
    exit;
}
$extension = $allowedTypes[$imageInfo[2]];

// Lưu cạnh thư mục configs/ (src/static/uploads/). Thư mục này là publicDir của Vite nên:
// - khi chạy dev: được phục vụ tại ./uploads/...
// - khi build: được copy sang dist/uploads/...
// (Cách cũ dò môi trường bằng đường dẫn '/' nên sai trên Windows/XAMPP và ảnh không hiện khi chạy dev.)
$targetDir = __DIR__ . '/../uploads/' . $filename . '/';
$baseUrl = './uploads/';

if (!is_dir($targetDir) && !mkdir($targetDir, 0755, true)) {
    echo json_encode(['success' => false, 'message' => 'Không thể tạo thư mục lưu ảnh.']);
    exit;
}

// Generate unique filename
$newFileName = uniqid('img_', true) . '.' . $extension;
$targetPath = $targetDir . $newFileName;

// Move uploaded file
if (move_uploaded_file($file['tmp_name'], $targetPath)) {
    $relativeUrl = $baseUrl . $filename . '/' . $newFileName;

    echo json_encode([
        'success' => true,
        'message' => 'Tải ảnh lên thành công!',
        'url' => $relativeUrl
    ]);
} else {
    echo json_encode(['success' => false, 'message' => 'Không thể lưu file ảnh.']);
}
