/*!
 * Hanabi – chia sẻ link lên mạng xã hội
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Các nơi chia sẻ link, dùng chung cho builder (người tạo) và trình phát (người nhận).
// icon: lớp Font Awesome; Zalo không có trong Font Awesome nên dùng ZALO_ICON.

// Điện thoại/máy tính bảng: theo User-Agent, iPad đời mới (báo là Mac) và thiết bị cảm ứng màn hình nhỏ
export const isMobileDevice = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent))
    || (navigator.maxTouchPoints > 0 && window.matchMedia('(pointer: coarse)').matches && window.innerWidth < 1024);

// Sao chép; có cách dự phòng khi trang không chạy https (vd mở qua IP mạng LAN trên điện thoại)
export async function copyText(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (e) {
        const input = document.createElement('textarea');
        input.value = text;
        input.style.cssText = 'position:fixed;opacity:0';
        document.body.appendChild(input);
        input.select();
        const ok = document.execCommand('copy');
        input.remove();
        return ok;
    }
}

export const ZALO_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" aria-hidden="true">'
    + '<path fill="#2962ff" d="M15,36V6.827l-1.211-0.811C8.64,8.083,5,13.112,5,19v10c0,7.732,6.268,14,14,14h10c4.722,0,8.883-2.348,11.417-5.931V36H15z"/>'
    + '<path fill="#eee" d="M29,5H19c-1.845,0-3.601,0.366-5.214,1.014C10.453,9.25,8,14.528,8,19c0,6.771,0.936,10.735,3.712,14.607c0.216,0.301,0.357,0.653,0.376,1.022c0.043,0.835-0.129,2.365-1.634,3.742c-0.162,0.148-0.059,0.419,0.16,0.428c0.942,0.041,2.843-0.014,4.797-0.877c0.557-0.246,1.191-0.203,1.729,0.083C20.453,39.764,24.333,40,28,40c4.676,0,9.339-1.04,12.417-2.916C42.038,34.799,43,32.014,43,29V19C43,11.268,36.732,5,29,5z"/>'
    + '<path fill="#2962ff" d="M36.75,27C34.683,27,33,25.317,33,23.25s1.683-3.75,3.75-3.75s3.75,1.683,3.75,3.75S38.817,27,36.75,27z M36.75,21c-1.24,0-2.25,1.01-2.25,2.25s1.01,2.25,2.25,2.25S39,24.49,39,23.25S37.99,21,36.75,21z"/>'
    + '<path fill="#2962ff" d="M31.5,27h-1c-0.276,0-0.5-0.224-0.5-0.5V18h1.5V27z"/>'
    + '<path fill="#2962ff" d="M27,19.75v0.519c-0.629-0.476-1.403-0.769-2.25-0.769c-2.067,0-3.75,1.683-3.75,3.75S22.683,27,24.75,27c0.847,0,1.621-0.293,2.25-0.769V26.5c0,0.276,0.224,0.5,0.5,0.5h1v-7.25H27z M24.75,25.5c-1.24,0-2.25-1.01-2.25-2.25S23.51,21,24.75,21S27,22.01,27,23.25S25.99,25.5,24.75,25.5z"/>'
    + '<path fill="#2962ff" d="M21.25,18h-8v1.5h5.321L13,26h0.026c-0.163,0.211-0.276,0.463-0.276,0.75V27h7.5c0.276,0,0.5-0.224,0.5-0.5v-1h-5.321L21,19h-0.026c0.163-0.211,0.276-0.463,0.276-0.75V18z"/>'
    + '</svg>';

export const SHARE_PLATFORMS = [
    { id: 'native', name: 'Ứng dụng khác', icon: 'fas fa-share-nodes', bg: '#7c6cff', available: () => !!navigator.share },
    { id: 'facebook', name: 'Facebook', icon: 'fab fa-facebook-f', bg: '#1877f2' },
    { id: 'messenger', name: 'Messenger', icon: 'fab fa-facebook-messenger', bg: 'linear-gradient(45deg, #0695ff, #a334fa, #ff6968)' },
    { id: 'zalo', name: 'Zalo', icon: 'zalo', bg: '#0068ff' },
    { id: 'telegram', name: 'Telegram', icon: 'fab fa-telegram', bg: '#229ed9' },
    { id: 'whatsapp', name: 'WhatsApp', icon: 'fab fa-whatsapp', bg: '#25d366' },
    { id: 'x', name: 'X (Twitter)', icon: 'fab fa-x-twitter', bg: '#000000' },
    { id: 'threads', name: 'Threads', icon: 'fab fa-threads', bg: '#000000' },
    { id: 'linkedin', name: 'LinkedIn', icon: 'fab fa-linkedin-in', bg: '#0a66c2' },
    { id: 'instagram', name: 'Instagram', icon: 'fab fa-instagram', bg: 'linear-gradient(45deg, #f9ce34, #ee2a7b, #6228d7)' },
    { id: 'tiktok', name: 'TikTok', icon: 'fab fa-tiktok', bg: '#000000' },
    { id: 'email', name: 'Email', icon: 'fas fa-envelope', bg: '#ea4335' },
    { id: 'sms', name: 'Tin nhắn', icon: 'fas fa-comment-sms', bg: '#34c759', available: isMobileDevice }
];

export const availablePlatforms = () => SHARE_PLATFORMS.filter(p => !p.available || p.available());

// Biểu tượng tròn của một nơi chia sẻ (lớp share-icon, Zalo thêm is-zalo)
export function platformIcon(p) {
    return `<span class="share-icon${p.id === 'zalo' ? ' is-zalo' : ''}" style="background: ${p.bg}">`
        + `${p.icon === 'zalo' ? ZALO_ICON : `<i class="${p.icon}"></i>`}</span>`;
}

function openShareWindow(href, notify) {
    const win = window.open(href, '_blank');
    if (win) {
        win.opener = null;
    } else {
        notify('Trình duyệt đã chặn cửa sổ mới, hãy cho phép popup để chia sẻ.', 'warning');
    }
}

/**
 * Chia sẻ `url` qua một nền tảng: trang chia sẻ của nền tảng, bảng chia sẻ của máy, hoặc sao chép link rồi mở bản web
 * (Messenger, Zalo trên máy tính). Instagram, TikTok không nhận link từ web: gọi onMedia(platform) để trang tự lo
 * (builder tải ảnh thiệp, người nhận tạo video).
 */
export async function shareLink(platform, { url, title, text }, { notify, onMedia }) {
    const enc = encodeURIComponent;
    const useNativeShare = isMobileDevice() && !!navigator.share;

    switch (platform) {
        case 'native':
            try {
                await navigator.share({ title, text, url });
            } catch (e) {
                // Người dùng đóng bảng chia sẻ
            }
            return;
        case 'facebook':
            return openShareWindow(`https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`, notify);
        case 'messenger':
            // Điện thoại: bảng chia sẻ của hệ thống có sẵn Messenger; máy tính: Messenger không có link chia sẻ công khai
            if (useNativeShare) return shareLink('native', { url, title, text }, { notify, onMedia });
            if (isMobileDevice()) {
                window.location.href = `fb-messenger://share/?link=${enc(url)}`;
                return;
            }
            await copyText(url);
            notify('Đã sao chép link, hãy dán (Ctrl+V) vào cuộc trò chuyện Messenger.', 'success');
            return openShareWindow('https://www.messenger.com/', notify);
        case 'zalo':
            // Zalo không có link chia sẻ công khai: điện thoại dùng bảng chia sẻ hệ thống, máy tính mở Zalo Web
            if (useNativeShare) return shareLink('native', { url, title, text }, { notify, onMedia });
            await copyText(url);
            notify('Đã sao chép link, hãy dán (Ctrl+V) vào cuộc trò chuyện Zalo.', 'success');
            return openShareWindow('https://chat.zalo.me/', notify);
        case 'telegram':
            return openShareWindow(`https://t.me/share/url?url=${enc(url)}&text=${enc(text)}`, notify);
        case 'whatsapp':
            return openShareWindow(`https://wa.me/?text=${enc(`${text}\n${url}`)}`, notify);
        case 'x':
            return openShareWindow(`https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(url)}`, notify);
        case 'threads':
            return openShareWindow(`https://www.threads.net/intent/post?text=${enc(`${text}\n${url}`)}`, notify);
        case 'linkedin':
            return openShareWindow(`https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`, notify);
        case 'email':
            window.location.href = `mailto:?subject=${enc(title)}&body=${enc(`${text}\n\nMở xem màn pháo hoa: ${url}`)}`;
            return;
        case 'sms':
            window.location.href = `sms:?&body=${enc(`${text} ${url}`)}`;
            return;
        case 'instagram':
        case 'tiktok':
            return onMedia(platform);
    }
}
