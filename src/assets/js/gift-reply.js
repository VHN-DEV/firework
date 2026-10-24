/*!
 * Hanabi – lời cảm ơn của người nhận
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Người nhận gửi lời cảm ơn cho người tặng: nút ♥ ở thanh nút góc dưới và ở màn kết mở bảng viết lời nhắn (tên không bắt
// buộc). Máy chủ lưu (api/opens.php?action=reply), người tặng đọc trong hộp Chia sẻ của builder và trang theo dõi. Chỉ có
// khi kịch bản lưu trên máy chủ (link ?config=<tên> trên bản có máy chủ, không phải kịch bản mẫu của trang) và người tạo
// không tắt (allowReply: false). Bản xem nhanh trong builder: hiện nút để người tạo thấy, không gửi.

import { syncMomentBar } from './viewer-share.js';

const $ = selector => document.querySelector(selector);

// canSend: kịch bản lưu trên máy chủ, gửi được; preview: bản xem nhanh; off: khung dựng video, ảnh đầu trang
export function setupGiftReply({ configName, canSend, preview, off, pauseShow }) {
    const sheet = $('.reply-sheet');
    const form = sheet.querySelector('.reply-form');
    const message = form.querySelector('.reply-message');
    const name = form.querySelector('.reply-name');
    const status = form.querySelector('.reply-status');
    const send = form.querySelector('.reply-send');
    const buttons = [$('.moment-bar__reply'), $('.end-screen__reply')];
    let wasPaused = false;

    function open() {
        if (!sheet.classList.contains('hide')) return;
        wasPaused = pauseShow(true);
        sheet.classList.remove('hide', 'is-sent');
        status.textContent = '';
        setTimeout(() => message.focus(), 60);
    }

    function close() {
        if (sheet.classList.contains('hide')) return;
        sheet.classList.add('hide');
        if (!wasPaused) pauseShow(false);
    }

    buttons.forEach(button => button.addEventListener('click', open));
    sheet.querySelector('.sheet__close').addEventListener('click', close);
    sheet.querySelector('.reply-close').addEventListener('click', close);
    sheet.querySelector('.reply-again').addEventListener('click', () => {
        sheet.classList.remove('is-sent');
        message.focus();
    });
    sheet.addEventListener('click', e => {
        if (e.target === sheet) close();
    });
    window.addEventListener('keydown', e => {
        if (e.key === 'Escape') close();
    });

    form.addEventListener('submit', async e => {
        e.preventDefault();
        const text = message.value.trim();
        if (!text) {
            status.textContent = 'Hãy viết vài lời trước khi gửi.';
            message.focus();
            return;
        }
        if (preview) {
            status.textContent = 'Bản xem nhanh: lời cảm ơn chỉ gửi được khi người nhận mở link.';
            return;
        }
        send.disabled = true;
        status.textContent = 'Đang gửi...';
        try {
            const response = await fetch('api/opens.php?action=reply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: configName, name: name.value.trim(), message: text })
            });
            const data = await response.json();
            if (!data.success) throw new Error(data.message || 'Không gửi được, hãy thử lại.');
            message.value = '';
            status.textContent = '';
            sheet.classList.add('is-sent');
        } catch (err) {
            status.textContent = err instanceof SyntaxError || err instanceof TypeError ? 'Không gửi được, hãy kiểm tra mạng rồi thử lại.' : err.message;
        } finally {
            send.disabled = false;
        }
    });

    return {
        // Kịch bản đang xem (bản gốc) hoặc null (pháo ngẫu nhiên)
        setConfig(config) {
            // Kịch bản mẫu của trang ("riêng tư") không có người tặng để nhận lời cảm ơn
            const enabled = !off && (canSend || preview) && !!config && Array.isArray(config.events) && config.allowReply !== false
                && config.status !== 'private';
            buttons.forEach(button => button.classList.toggle('remove', !enabled));
            syncMomentBar();
            if (!enabled) return;
            sheet.querySelector('.reply-to').textContent = config.author
                ? `Chỉ ${config.author} (người tặng) đọc được lời nhắn này.`
                : 'Chỉ người tặng đọc được lời nhắn này.';
            if (!name.value && typeof config.recipient === 'string') name.value = config.recipient.slice(0, 60);
        }
    };
}
