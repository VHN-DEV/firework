<?php
/**
 * Hanabi – © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 *
 * Tài khoản: đăng nhập bằng Google chỉ có trên bản Cloudflare Workers (worker/account.js). Bản PHP luôn trả "chưa bật"
 * để builder không hiện nút đăng nhập.
 */

header('Content-Type: application/json');
echo json_encode(['success' => true, 'enabled' => false, 'user' => null]);
