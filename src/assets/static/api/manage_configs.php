<?php
/**
 * Script to list and delete firework configurations.
 */

header('Content-Type: application/json');

$action = isset($_GET['action']) ? $_GET['action'] : '';

$targetDir = __DIR__ . '/../configs/';

if ($action === 'list') {
    if (!is_dir($targetDir)) {
        echo json_encode([]);
        exit;
    }

    $files = glob($targetDir . '*.json');
    $result = [];

    foreach ($files as $file) {
        $filename = basename($file, '.json');
        // Optionally read some info from the file
        $content = json_decode(file_get_contents($file), true);
        $result[] = [
            'id' => $filename,
            'title' => isset($content['title']) ? $content['title'] : $filename,
            'author' => isset($content['author']) ? $content['author'] : 'Unknown',
            'eventCount' => isset($content['events']) ? count($content['events']) : 0,
            'status' => isset($content['status']) ? $content['status'] : 'public'
        ];
    }

    echo json_encode($result);
    exit;
}

if ($action === 'delete') {
    $rawData = file_get_contents('php://input');
    $data = json_decode($rawData, true);
    $filename = isset($data['filename']) ? $data['filename'] : '';

    if (empty($filename)) {
        echo json_encode(['success' => false, 'message' => 'Thiếu tên file.']);
        exit;
    }

    // Sanitize
    $filename = preg_replace('/[^a-zA-Z0-9_-]/', '', $filename);
    $filePath = $targetDir . $filename . '.json';

    if (file_exists($filePath)) {
        // Double check status
        $content = json_decode(file_get_contents($filePath), true);
        if (isset($content['status']) && $content['status'] === 'private') {
            echo json_encode(['success' => false, 'message' => 'Kịch bản này là riêng tư và không thể xóa.']);
            exit;
        }

        if (unlink($filePath)) {
            echo json_encode(['success' => true, 'message' => 'Đã xóa kịch bản thành công!']);
        } else {
            echo json_encode(['success' => false, 'message' => 'Không thể xóa file.']);
        }
    } else {
        echo json_encode(['success' => false, 'message' => 'File không tồn tại.']);
    }
    exit;
}

echo json_encode(['success' => false, 'message' => 'Hành động không hợp lệ.']);
