<?php
/**
 * Hanabi – © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 *
 * Trang quản trị (/admin) chỉ có trên bản Cloudflare Workers (worker/admin.js): cần đăng nhập Google.
 */

header('Content-Type: application/json');
http_response_code(501);
echo json_encode(['success' => false, 'code' => 'unsupported', 'message' => 'Trang quản trị chỉ có trên bản chạy Cloudflare Workers.']);
