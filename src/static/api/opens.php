<?php
/**
 * Hanabi – © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 *
 * Báo mở quà (xem tracking.inc.php):
 * POST ?action=record { id, event: view|open|finish, device: mobile|tablet|desktop } - trình phát gửi khi người nhận
 *      mở link, bấm mở quà, xem hết; chỉ ghi khi kịch bản bật "notifyOpen".
 * POST ?action=status { items: [{ id, key }] } - người gửi (có mã theo dõi) xem trạng thái.
 */

require __DIR__ . '/tracking.inc.php';

header('Content-Type: application/json');
header('Cache-Control: no-store');

$action = isset($_GET['action']) ? $_GET['action'] : '';
$body = json_decode(file_get_contents('php://input'), true);
if (!is_array($body)) {
    $body = [];
}

if ($action === 'record') {
    $id = isset($body['id']) && is_string($body['id']) ? strtolower($body['id']) : '';
    $event = isset($body['event']) ? $body['event'] : '';
    $device = isset($body['device']) && in_array($body['device'], TRACK_DEVICES, true) ? $body['device'] : 'desktop';
    if (!track_valid_id($id) || !in_array($event, TRACK_EVENTS, true)) {
        http_response_code(400);
        echo json_encode(['success' => false]);
        exit;
    }
    // Chỉ ghi cho kịch bản có thật, có mã theo dõi và người gửi đã bật "Báo cho tôi khi người nhận mở quà"
    $configFile = __DIR__ . '/../configs/' . $id . '.json';
    $config = is_file($configFile) ? json_decode(file_get_contents($configFile), true) : null;
    if (!is_array($config) || empty($config['notifyOpen']) || !track_has_key($id)) {
        echo json_encode(['success' => false]);
        exit;
    }
    echo json_encode(['success' => track_record($id, $event, $device)]);
    exit;
}

if ($action === 'reply') {
    // Lời cảm ơn người nhận gửi người tặng: kịch bản có thật, có mã theo dõi, người tạo không tắt "Cho người nhận gửi lời
    // cảm ơn" (allowReply)
    $id = isset($body['id']) && is_string($body['id']) ? strtolower($body['id']) : '';
    // Chữ không đúng UTF-8: preg_replace trả null, coi như chưa viết gì
    $message = isset($body['message']) && is_string($body['message']) ? trim((string) preg_replace('/[\x00-\x08\x0B-\x1F\x7F]/u', '', $body['message'])) : '';
    $name = isset($body['name']) && is_string($body['name']) ? trim((string) preg_replace('/[\x00-\x1F\x7F]/u', '', $body['name'])) : '';
    if (!track_valid_id($id) || $message === '') {
        echo json_encode(['success' => false, 'message' => 'Hãy viết vài lời trước khi gửi.']);
        exit;
    }
    if (mb_strlen($message, 'UTF-8') > 500 || mb_strlen($name, 'UTF-8') > 60) {
        echo json_encode(['success' => false, 'message' => 'Lời nhắn tối đa 500 ký tự, tên tối đa 60 ký tự.']);
        exit;
    }
    $configFile = __DIR__ . '/../configs/' . $id . '.json';
    $config = is_file($configFile) ? json_decode(file_get_contents($configFile), true) : null;
    if (!is_array($config) || (isset($config['allowReply']) && $config['allowReply'] === false) || !track_has_key($id)) {
        echo json_encode(['success' => false, 'message' => 'Màn pháo hoa này không nhận lời cảm ơn.']);
        exit;
    }
    if (!track_reply($id, $name, $message)) {
        echo json_encode(['success' => false, 'code' => 'rate_limited', 'message' => 'Đã có nhiều lời cảm ơn vừa gửi, hãy thử lại sau ít phút.']);
        exit;
    }
    echo json_encode(['success' => true, 'message' => 'Đã gửi lời cảm ơn!']);
    exit;
}

if ($action === 'status') {
    $items = isset($body['items']) && is_array($body['items']) ? array_slice($body['items'], 0, 100) : [];
    $result = [];
    foreach ($items as $item) {
        $id = is_array($item) && isset($item['id']) && is_string($item['id']) ? strtolower($item['id']) : '';
        $key = is_array($item) && isset($item['key']) && is_string($item['key']) ? $item['key'] : '';
        if (!track_check_key($id, $key)) {
            $result[] = ['id' => $id, 'ok' => false];
            continue;
        }
        $data = track_load($id);
        $result[] = [
            'id' => $id,
            'ok' => true,
            'counts' => $data['counts'],
            'first' => (object) $data['first'],
            'events' => array_slice($data['events'], -50),
            'replies' => array_slice(track_replies($id), -REPLY_SHOWN)
        ];
    }
    echo json_encode(['success' => true, 'items' => $result]);
    exit;
}

http_response_code(400);
echo json_encode(['success' => false, 'message' => 'Hành động không hợp lệ.']);
