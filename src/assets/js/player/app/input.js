/*!
 * Hanabi – trình phát (chạm, phím)
 * Phần bổ sung và chỉnh sửa © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Chạm vào trời để bắn, kéo thanh tốc độ, phím tắt.

import { IS_RECORD } from '../env.js';
import { launchShellFromConfig } from './sequences.js';
import { appNodes, burstConfig, isRunning, mainStage, previewWaitingOpen, toggleMenu, togglePause, toggleSound, updateSpeedFromEvent } from '../../script.js';

// Chạm góc phải trên để mở menu: trình duyệt di động còn phát thêm một cú click giả lập ngay tại chỗ đó,
// trúng nút Đóng vừa hiện ra làm menu đóng lại ngay. Bỏ qua click đóng trong khoảng ngắn sau khi mở.
export let menuOpenedByCornerAt = 0;

let activePointerCount = 0;

export let isUpdatingSpeed = false;

export function handlePointerStart(event) {
    activePointerCount++;
    // Chưa bắt đầu màn trình diễn: bỏ qua, tránh chạm vào góc màn hình chờ làm tạm dừng/mở menu ngầm
    if (appNodes.stageContainer.classList.contains('remove')) return;
    // Khung quay video: bấm nút "Bắt đầu quay" hay lỡ tay bấm vào khung không được bắn thêm pháo vào video
    if (IS_RECORD) return;
    // Bản xem nhanh đang hiện màn mở quà: người nhận thật lúc này chưa thấy sân khấu
    if (previewWaitingOpen) return;
    const btnSize = 50;

    if (event.y < btnSize) {
        if (event.x < btnSize) {
            togglePause();
            return;
        }
        if (event.x > mainStage.width / 2 - btnSize / 2 && event.x < mainStage.width / 2 + btnSize / 2) {
            toggleSound();
            return;
        }
        if (event.x > mainStage.width - btnSize) {
            menuOpenedByCornerAt = Date.now();
            toggleMenu();
            return;
        }
    }

    if (!isRunning()) return;

    if (updateSpeedFromEvent(event)) {
        isUpdatingSpeed = true;
    }
    // Người tạo có thể khóa chạm bắn pháo (kịch bản tapToLaunch: false): chạm vào trời không bắn thêm pháo
    else if (event.onCanvas && !(burstConfig && burstConfig.tapToLaunch === false)) {
        launchShellFromConfig(event);
    }
}

export function handlePointerEnd(event) {
    activePointerCount--;
    isUpdatingSpeed = false;
}

export function handlePointerMove(event) {
    if (!isRunning()) return;

    if (isUpdatingSpeed) {
        updateSpeedFromEvent(event);
    }
}

export function handleKeydown(event) {
    // Đang chọn trong menu thì chỉ giữ lại phím Esc, tránh gõ chữ "o"/"p" làm đóng menu/tạm dừng
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(event.target.tagName) && event.keyCode !== 27) {
        return;
    }
    // Chưa vào màn trình diễn (màn mở quà, đếm ngược): P, O không được chạy ngầm phía sau
    if (appNodes.stageContainer.classList.contains('remove')) return;
    // P
    if (event.keyCode === 80) {
        togglePause();
    }
    // ồ
    else if (event.keyCode === 79) {
        toggleMenu();
    }
    // Thoát
    else if (event.keyCode === 27) {
        toggleMenu(false);
    }
}
