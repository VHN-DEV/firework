/*!
 * Hanabi – trang chủ: kênh liên hệ, phiếu đặt làm riêng
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

import { OCCASIONS } from '../templates.js';
import { CONTACT } from './content.js';
import { niceTitle } from './showcase.js';

// Zalo: số điện thoại hoặc link; Messenger: link
const zaloUrl = value => {
    const v = String(value || '').trim();
    if (!v) return '';
    if (/^https?:\/\//i.test(v)) return v;
    const digits = v.replace(/[^\d]/g, '');
    return digits ? `https://zalo.me/${digits}` : '';
};
const linkUrl = value => (/^https?:\/\//i.test(String(value || '').trim()) ? String(value).trim() : '');

function initChannels() {
    const email = document.querySelector('[data-contact="email"]');
    if (CONTACT.email) {
        email.href = `mailto:${CONTACT.email}`;
        email.querySelector('small').textContent = CONTACT.email;
    } else {
        email.hidden = true;
    }
    const zalo = zaloUrl(CONTACT.zalo);
    const zaloLink = document.querySelector('[data-contact="zalo"]');
    if (zalo) {
        zaloLink.href = zalo;
        zaloLink.hidden = false;
    }
    const fb = linkUrl(CONTACT.facebook);
    const fbLink = document.querySelector('[data-contact="facebook"]');
    if (fb) {
        fbLink.href = fb;
        fbLink.hidden = false;
    }
    return { zalo, fb };
}

async function copyText(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (e) {
        // Trình duyệt cũ, trang không an toàn: chép bằng ô chữ ẩn
        const area = document.createElement('textarea');
        area.value = text;
        area.setAttribute('readonly', '');
        area.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
        document.body.appendChild(area);
        area.select();
        let ok = false;
        try {
            ok = document.execCommand('copy');
        } catch (err) {
            ok = false;
        }
        area.remove();
        return ok;
    }
}

export function initOrder() {
    const form = document.querySelector('.order');
    const hint = form.querySelector('.order__hint');
    const occasion = form.elements.occasion;
    const sample = form.elements.sample;
    const channels = initChannels();
    let samples = [];

    occasion.innerHTML = '<option value="">Chọn dịp</option>'
        + OCCASIONS.map(o => `<option value="${o.name}">${o.icon} ${o.name}</option>`).join('')
        + '<option value="Khác">✨ Dịp khác</option>';

    const say = (text, kind = '') => {
        hint.textContent = text;
        hint.className = `order__hint${kind ? ` is-${kind}` : ''}`;
    };

    const compose = () => {
        const f = form.elements;
        const picked = samples.find(s => s.id === f.sample.value);
        const date = f.date.value ? new Date(`${f.date.value}T00:00`).toLocaleDateString('vi-VN') : '';
        const message = f.message.value.trim();
        const details = [
            `Tên: ${f.name.value.trim()}`,
            f.phone.value.trim() && `Điện thoại/Zalo: ${f.phone.value.trim()}`,
            f.occasion.value && `Dịp tặng: ${f.occasion.value}`,
            date && `Ngày cần gửi: ${date}`,
            f.recipient.value.trim() && `Người nhận: ${f.recipient.value.trim()}`,
            picked && `Mẫu thích: ${niceTitle(picked.title || picked.id)} (${new URL(`./demo?config=${encodeURIComponent(picked.id)}`, location.href).href})`
        ].filter(Boolean);
        return {
            subject: `Đặt màn pháo hoa${f.occasion.value ? ` – ${f.occasion.value}` : ''} – ${f.name.value.trim()}`,
            body: ['Chào bạn, mình muốn đặt làm một màn pháo hoa.', '', ...details, ...(message ? ['', 'Lời chúc, ý tưởng:', message] : [])].join('\n')
        };
    };

    const validate = () => {
        const name = form.elements.name;
        const ok = name.value.trim().length > 0;
        name.closest('.field').classList.toggle('is-invalid', !ok);
        if (!ok) {
            say('Bạn cho mình biết tên để tiện liên hệ nhé.', 'error');
            name.focus();
        }
        return ok;
    };
    form.elements.name.addEventListener('input', e => e.target.closest('.field').classList.remove('is-invalid'));

    form.addEventListener('submit', e => {
        e.preventDefault();
        if (!validate()) return;
        const { subject, body } = compose();
        window.location.href = `mailto:${CONTACT.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        say('Đang mở ứng dụng email với nội dung đã điền sẵn. Không thấy gì? Bấm "Chép để nhắn tin" rồi gửi qua Zalo, Messenger.', 'success');
    });

    form.querySelector('.order__copy').addEventListener('click', async () => {
        if (!validate()) return;
        const { body } = compose();
        const where = [channels.zalo && 'Zalo', channels.fb && 'Messenger', 'email'].filter(Boolean).join(', ');
        if (await copyText(body)) say(`Đã chép nội dung. Dán vào ${where} để gửi cho mình nhé!`, 'success');
        else say('Không chép được, bạn chọn và chép nội dung trong ô thủ công giúp mình nhé.', 'error');
    });

    return {
        // Danh sách mẫu (từ kịch bản mẫu) cho ô "Mẫu bạn thích"
        setSamples(items) {
            samples = items;
            sample.innerHTML = '<option value="">Để mình tư vấn</option>'
                + items.map(i => `<option value="${i.id}">${i.featured ? '★ ' : ''}${niceTitle(i.title || i.id).replace(/</g, '&lt;')}</option>`).join('');
        },
        // "Đặt mẫu này" trên thẻ kịch bản: chọn sẵn mẫu, dịp gần đúng, cuộn tới phiếu
        pick(id) {
            const item = samples.find(s => s.id === id);
            if (item) {
                sample.value = id;
                const match = OCCASIONS.find(o => item.category && (o.name.includes(item.category) || item.category.includes(o.name.split(',')[0])));
                if (match) occasion.value = match.name;
            }
            document.getElementById('lien-he').scrollIntoView({ behavior: 'smooth' });
            setTimeout(() => form.elements.name.focus({ preventScroll: true }), 700);
        },
        pickOccasion(name) {
            occasion.value = name;
        }
    };
}
