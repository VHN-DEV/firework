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

// Validate file type
$allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
if (!in_array($file['type'], $allowedTypes)) {
    echo json_encode(['success' => false, 'message' => 'Loại file không được hỗ trợ. Chỉ cho phép JPG, PNG, WEBP, GIF.']);
    exit;
}

// Detect environment based on directory structure
// src structure: src/static/static/api/upload_image.php
// dist structure: dist/static/api/upload_image.php
$isDist = (strpos(__DIR__, 'dist') !== false) || (strpos(__DIR__, 'src/static/static/api') === false);

if ($isDist) {
    // Production (dist)
    $targetDir = __DIR__ . '/../../assets/img/uploads/' . $filename . '/';
    $baseUrl = './assets/img/uploads/';
} else {
    // Development (src)
    $targetDir = __DIR__ . '/../../../assets/img/uploads/' . $filename . '/';
    $baseUrl = './src/assets/img/uploads/';
}

if (!is_dir($targetDir)) {
    mkdir($targetDir, 0755, true);
}

// Generate unique filename
$extension = pathinfo($file['name'], PATHINFO_EXTENSION);
if (empty($extension)) {
    $extension = 'png';
}
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
