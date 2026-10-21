<?php
/**
 * Trình diễn Pháo hoa – © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 *
 * Báo mở quà: lưu lúc người nhận mở link, bấm mở quà, xem hết (chỉ thời điểm và loại thiết bị, không lưu IP).
 * Mỗi kịch bản có một mã theo dõi bí mật (chỉ lưu bản băm), ai có mã mới xem được trạng thái.
 * Tạm lưu bằng file JSON trong api/data (chặn tải trực tiếp bằng api/data/.htaccess); khi chuyển sang máy chủ có
 * cơ sở dữ liệu chỉ cần viết lại các hàm trong file này.
 */

const TRACK_EVENTS = ['view', 'open', 'finish'];
const TRACK_DEVICES = ['mobile', 'tablet', 'desktop'];
// Giữ tối đa chừng này sự kiện gần nhất mỗi kịch bản (số đếm vẫn cộng dồn)
const TRACK_MAX_EVENTS = 300;
// Chống gửi dồn: tối đa chừng này sự kiện mỗi phút cho một kịch bản
const TRACK_MAX_PER_MINUTE = 20;

function track_dir($kind)
{
    $dir = __DIR__ . '/data/' . $kind . '/';
    if (!is_dir($dir)) {
        // Không tạo được (thư mục không có quyền ghi): các hàm dưới tự báo thất bại, không in cảnh báo lẫn vào JSON
        @mkdir($dir, 0755, true);
    }
    return $dir;
}

// Bản tạm của nút "Xem thử" (preview_temp...) không có mã theo dõi, không ghi lịch sử mở quà
function track_valid_id($id)
{
    return is_string($id) && preg_match('/^[a-z0-9_-]{1,80}$/', $id) && strpos($id, 'preview_temp') !== 0;
}

function track_empty()
{
    return ['events' => [], 'counts' => ['view' => 0, 'open' => 0, 'finish' => 0], 'first' => []];
}

// Kịch bản mới: tạo mã theo dõi, trả về mã (chỉ một lần duy nhất). Đã có mã thì trả về null.
// Mã này cũng là quyền của máy đã tạo kịch bản: lưu đè, xóa kịch bản đã có mã phải gửi kèm đúng mã.
function track_create_key($id)
{
    if (!track_valid_id($id)) {
        return null;
    }
    // Tạo file mới hoặc thất bại nếu đã có ('x'): hai lần lưu cùng lúc không thể cùng nhận mã
    $fp = @fopen(track_dir('owners') . $id . '.json', 'x');
    if (!$fp) {
        return null;
    }
    $key = bin2hex(random_bytes(16));
    $json = json_encode(['hash' => hash('sha256', $key), 'created' => gmdate('c')]);
    $ok = fwrite($fp, $json) === strlen($json);
    fclose($fp);
    // Không ghi được mã thì không trả về (mã trả về mà không lưu thì link theo dõi không bao giờ chạy)
    return $ok ? $key : null;
}

function track_has_key($id)
{
    return track_valid_id($id) && is_file(track_dir('owners') . $id . '.json');
}

function track_check_key($id, $key)
{
    if (!track_has_key($id) || !is_string($key) || !preg_match('/^[a-f0-9]{32}$/', $key)) {
        return false;
    }
    $owner = json_decode(file_get_contents(track_dir('owners') . $id . '.json'), true);
    return is_array($owner) && isset($owner['hash']) && hash_equals($owner['hash'], hash('sha256', $key));
}

function track_load($id)
{
    $file = track_dir('opens') . $id . '.json';
    $raw = '';
    // Khóa đọc: track_record đang xóa rồi ghi lại file thì chờ, không đọc phải file rỗng (số lần mở về 0)
    if (is_file($file) && ($fp = fopen($file, 'r'))) {
        flock($fp, LOCK_SH);
        $raw = stream_get_contents($fp);
        flock($fp, LOCK_UN);
        fclose($fp);
    }
    $data = $raw ? json_decode($raw, true) : null;
    return is_array($data) ? $data : track_empty();
}

function track_record($id, $event, $device)
{
    $fp = @fopen(track_dir('opens') . $id . '.json', 'c+');
    if (!$fp) {
        return false;
    }
    flock($fp, LOCK_EX);
    $raw = stream_get_contents($fp);
    $data = $raw ? json_decode($raw, true) : null;
    if (!is_array($data)) {
        $data = track_empty();
    }
    $recent = 0;
    foreach ($data['events'] as $item) {
        if (strtotime($item['t']) > time() - 60) {
            $recent++;
        }
    }
    $ok = $recent < TRACK_MAX_PER_MINUTE;
    if ($ok) {
        $now = gmdate('c');
        $data['events'][] = ['t' => $now, 'e' => $event, 'd' => $device];
        if (count($data['events']) > TRACK_MAX_EVENTS) {
            $data['events'] = array_slice($data['events'], -TRACK_MAX_EVENTS);
        }
        $data['counts'][$event] = (isset($data['counts'][$event]) ? $data['counts'][$event] : 0) + 1;
        if (empty($data['first'][$event])) {
            $data['first'][$event] = $now;
        }
        ftruncate($fp, 0);
        rewind($fp);
        fwrite($fp, json_encode($data));
        fflush($fp);
    }
    flock($fp, LOCK_UN);
    fclose($fp);
    return $ok;
}

// Kịch bản đã có mã (tạo từ khi có tính năng này) chỉ máy giữ mã mới lưu đè, xóa được; kịch bản cũ chưa có mã thì ai
// cũng sửa được như trước
function track_can_modify($id, $key)
{
    return !track_has_key($id) || track_check_key($id, $key);
}

// Xóa kịch bản thì xóa luôn mã theo dõi và lịch sử mở quà
function track_delete($id)
{
    foreach (['owners', 'opens'] as $kind) {
        $file = __DIR__ . '/data/' . $kind . '/' . $id . '.json';
        if (is_file($file)) {
            unlink($file);
        }
    }
}
