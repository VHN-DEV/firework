/*!
 * Trình diễn Pháo hoa – builder (chia sẻ)
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Chia sẻ: ảnh xem trước khi gửi link, link, mạng xã hội, mã QR, ảnh chia sẻ.

import qrcode from 'qrcode-generator';
import { renderShareImage } from '../share-image.js';
import { availablePlatforms, copyText, platformIcon, shareLink } from '../share-targets.js';
import { isStaticEnv, state } from './state.js';
import { getShowUrl, hideLoading, hideModal, notify, showLoading, showModal } from './util.js';
import { getUploadFolder } from './images.js';
import { getFinalConfig } from './config.js';
import { renderShareTracking } from './gift-watch.js';

// Mô tả khi chia sẻ: người dùng tự nhập, hoặc ghép từ dòng phụ và người thực hiện (giống trang chia sẻ)
function getShareDescription(config) {
    return config.seoDescription || [config.subtitle, config.author].filter(Boolean).join(' – ');
}

export function getSeoImageConfig() {
    const seo = state.seo;
    if (seo.mode !== 'custom' || !seo.image) return {};
    return {
        seoImage: seo.image,
        seoImageText: seo.imageText ? undefined : false,
        seoImagePosition: seo.imagePosition !== 50 ? seo.imagePosition : undefined
    };
}

let seoPreviewTimer = null;

let seoPreviewVersion = 0;

export function scheduleSeoPreview() {
    clearTimeout(seoPreviewTimer);
    seoPreviewTimer = setTimeout(renderSeoPreview, 350);
}

// Thẻ xem trước giống khung Facebook/Zalo hiện ra khi gửi link
async function renderSeoPreview() {
    const canvas = document.getElementById('seo-preview-canvas');
    if (!canvas) return;
    const config = getFinalConfig();
    document.getElementById('seo-preview-domain').textContent = window.location.hostname || 'localhost';
    document.getElementById('seo-preview-title').textContent = config.seoTitle || config.title;
    document.getElementById('seo-preview-desc').textContent = getShareDescription(config);
    [['seo-title', 90], ['seo-description', 200]].forEach(([id, max]) => {
        document.getElementById(`count-${id}`).textContent = `${document.getElementById(id).value.length}/${max}`;
    });
    const version = ++seoPreviewVersion;
    try {
        const card = await renderShareImage(config);
        if (version === seoPreviewVersion) canvas.getContext('2d').drawImage(card, 0, 0);
    } catch (e) {
        // Không vẽ được thì giữ ảnh cũ
    }
}

export function renderSeoControls() {
    const seo = state.seo;
    const custom = seo.mode === 'custom' && !!seo.image;
    document.getElementById('seo-mode-auto')?.classList.toggle('active', !custom);
    document.getElementById('seo-mode-custom')?.classList.toggle('active', custom);
    document.getElementById('seo-image-options')?.classList.toggle('hide', !custom);
    const text = document.getElementById('seo-image-text');
    if (text) text.checked = seo.imageText;
    const position = document.getElementById('seo-image-position');
    if (position) position.value = seo.imagePosition;
    const label = document.getElementById('out-seo-image-position');
    if (label) {
        const [start, end] = seo.axis === 'x' ? ['sang trái', 'sang phải'] : ['lên trên', 'xuống dưới'];
        label.textContent = seo.imagePosition === 50 ? 'Giữa' : `Lệch ${seo.imagePosition < 50 ? start : end}`;
    }
}

export function setSeoImageMode(mode) {
    if (mode === 'custom' && !state.seo.image) {
        // Chưa có ảnh: chọn ảnh xong mới chuyển sang "Ảnh của bạn"
        document.getElementById('seo-image-file').click();
        return;
    }
    state.seo.mode = mode;
    renderSeoControls();
    scheduleSeoPreview();
}

// Ảnh rộng hơn khung 1200×630 thì cắt bớt hai bên, hẹp hơn thì cắt trên dưới
export function detectSeoImageAxis() {
    if (!state.seo.image) return;
    const img = new Image();
    img.onload = () => {
        state.seo.axis = img.naturalWidth / img.naturalHeight > 1200 / 630 ? 'x' : 'y';
        renderSeoControls();
    };
    img.src = state.seo.image;
}

// Thu nhỏ ảnh (cạnh dài tối đa maxSide) thành JPEG dạng DataURL để lưu trong trình duyệt
function shrinkImageToDataUrl(file, maxSide) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            const k = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(img.naturalWidth * k);
            canvas.height = Math.round(img.naturalHeight * k);
            canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
            URL.revokeObjectURL(url);
            resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Không đọc được ảnh'));
        };
        img.src = url;
    });
}

// Ảnh người dùng chọn (ảnh nền, ảnh khi chia sẻ): bản có máy chủ PHP tải lên uploads/ (giữ nguyên chất lượng), kịch
// bản chỉ ghi đường dẫn; trang tĩnh lưu kịch bản trong trình duyệt (chỉ vài MB) nên thu nhỏ còn cạnh dài maxSide.
// Lỗi thì báo và trả về null.
export async function storeImageFile(file, maxSide) {
    if (isStaticEnv) {
        try {
            return await shrinkImageToDataUrl(file, maxSide);
        } catch (e) {
            notify('Không đọc được file ảnh này.', 'error');
            return null;
        }
    }
    showLoading('Đang tải ảnh lên...');
    const formData = new FormData();
    formData.append('image', file);
    formData.append('filename', getUploadFolder());
    try {
        const response = await fetch('api/upload_image.php', { method: 'POST', body: formData });
        const data = await response.json();
        hideLoading();
        if (!data.success) {
            notify('Lỗi: ' + data.message, 'error');
            return null;
        }
        return data.url;
    } catch (e) {
        hideLoading();
        notify('Lỗi kết nối khi tải ảnh.', 'error');
        return null;
    }
}

export async function handleSeoImageUpload(input) {
    const file = input.files[0];
    input.value = '';
    if (!file) return;

    const imageUrl = await storeImageFile(file, 1600);
    if (!imageUrl) return;

    Object.assign(state.seo, { mode: 'custom', image: imageUrl, imagePosition: 50 });
    detectSeoImageAxis();
    renderSeoControls();
    scheduleSeoPreview();
    notify('Đã đặt ảnh khi chia sẻ!', 'success');
}

// ---------------------------------------------------------------------------
// CHIA SẺ: link có ảnh + tiêu đề xem trước, nhiều nền tảng, mã QR, ảnh thiệp
// ---------------------------------------------------------------------------

// Trang chia sẻ s/<tên>.html chứa sẵn ảnh, tiêu đề, mô tả cho mạng xã hội rồi tự mở màn trình diễn
function getShareUrl(filename) {
    return new URL(`s/${encodeURIComponent(filename)}.html`, window.location.href).href;
}

// Thông tin của lần chia sẻ hiện tại
export const share = { id: '', url: '', published: true, title: '', description: '', imageCanvas: null };

// Trên GitHub Pages kịch bản chỉ lưu trong trình duyệt, nên chỉ kịch bản đã đưa vào configs/ mới có trang chia sẻ
export async function resolveShareUrl(filename) {
    const pageUrl = getShareUrl(filename);
    if (!isStaticEnv) return { url: pageUrl, published: true };
    try {
        const response = await fetch(pageUrl, { method: 'HEAD', cache: 'no-store' });
        if (response.ok) return { url: pageUrl, published: true };
    } catch (e) {
        // Không kiểm tra được (vd mở file trực tiếp): coi như chưa đăng
    }
    return { url: getShowUrl(filename), published: false };
}

function refreshShareText() {
    const config = getFinalConfig();
    share.title = config.seoTitle || config.title;
    share.description = getShareDescription(config);
}

export function updateShareBar(filename) {
    const shareBar = document.getElementById('share-bar');
    const shareUrlEl = document.getElementById('share-url');
    share.id = filename;
    share.url = getShareUrl(filename);
    shareUrlEl.innerText = share.url;
    shareBar.classList.remove('hide');
    resolveShareUrl(filename).then(({ url, published }) => {
        if (share.id !== filename) return;
        Object.assign(share, { url, published });
        shareUrlEl.innerText = url;
    });

    // Add highlight effect
    shareBar.classList.add('highlight-save');
    setTimeout(() => {
        shareBar.classList.remove('highlight-save');
    }, 2000);
}

export async function copyShareLink() {
    if (!share.id) {
        notify('Vui lòng lưu kịch bản trước khi sao chép link!', 'warning');
        return;
    }
    if (await copyText(share.url)) {
        notify('Đã sao chép link chia sẻ!', 'success');
    } else {
        notify('Không thể sao chép tự động, hãy chọn link và sao chép thủ công.', 'error');
    }
}

export async function shareTo(platform) {
    if (!share.id) {
        notify('Vui lòng lưu kịch bản trước khi chia sẻ!', 'warning');
        return;
    }
    refreshShareText();
    const url = share.url;
    const text = `🎆 ${share.title}${share.description ? ` – ${share.description}` : ''}`;
    await shareLink(platform, { url, title: share.title, text }, {
        notify,
        // Instagram, TikTok không nhận link từ web: tải ảnh thiệp để đăng và sao chép link để dán vào phần mô tả/bio
        onMedia: async p => {
            await copyText(url);
            await downloadShareImage();
            const name = p === 'instagram' ? 'Instagram' : 'TikTok';
            notify(`${name} không cho chia sẻ link từ web: đã tải ảnh thiệp và sao chép link để bạn đăng kèm.`, 'info');
        }
    });
}

function renderShareGrid() {
    document.getElementById('share-grid').innerHTML = availablePlatforms().map(p => `
            <button type="button" class="share-item" onclick="shareTo('${p.id}')" title="Chia sẻ qua ${p.name}">
                ${platformIcon(p)}
                <span class="share-name">${p.name}</span>
            </button>`).join('');
}

// Vẽ mã QR lên canvas (nền trắng, chừa lề 2 ô theo chuẩn để camera dễ nhận)
function drawQr(canvas, text, size) {
    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    const count = qr.getModuleCount();
    const cell = size / (count + 4);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#0b0d14';
    for (let row = 0; row < count; row++) {
        for (let col = 0; col < count; col++) {
            if (qr.isDark(row, col)) {
                ctx.fillRect(Math.floor((col + 2) * cell), Math.floor((row + 2) * cell), Math.ceil(cell), Math.ceil(cell));
            }
        }
    }
}

function downloadDataUrl(dataUrl, name) {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
}

// Mã QR dạng thẻ để in: tiêu đề + QR + lời nhắn quét mã
export function downloadShareQr() {
    if (!share.id) return;
    refreshShareText();
    const W = 720, H = 900, qrSize = 520;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#1d1033';
    ctx.font = '700 40px Outfit, Inter, sans-serif';
    let titleSize = 40;
    while (titleSize > 24 && ctx.measureText(share.title).width > W - 80) {
        titleSize -= 2;
        ctx.font = `700 ${titleSize}px Outfit, Inter, sans-serif`;
    }
    ctx.fillText(share.title, W / 2, 92);

    const qrCanvas = document.createElement('canvas');
    qrCanvas.width = qrCanvas.height = qrSize;
    drawQr(qrCanvas, share.url, qrSize);
    ctx.drawImage(qrCanvas, (W - qrSize) / 2, 140);

    ctx.fillStyle = '#6b21a8';
    ctx.font = '600 28px Inter, sans-serif';
    ctx.fillText('Quét mã để xem màn pháo hoa 🎆', W / 2, 720);
    ctx.fillStyle = '#64748b';
    ctx.font = '400 22px Inter, sans-serif';
    ctx.fillText(new URL(share.url).hostname, W / 2, 762);

    downloadDataUrl(canvas.toDataURL('image/png'), `qr-${share.id}.png`);
}

export async function downloadShareImage() {
    if (!share.id) return;
    const canvas = share.imageCanvas || await renderShareImage(getFinalConfig());
    downloadDataUrl(canvas.toDataURL('image/jpeg', 0.92), `${share.id}.jpg`);
}

export async function openShareModal() {
    if (!share.id) {
        notify('Vui lòng lưu kịch bản trước khi chia sẻ!', 'warning');
        return;
    }
    refreshShareText();
    showModal('share-modal');
    renderShareGrid();

    const { url, published } = await resolveShareUrl(share.id);
    Object.assign(share, { url, published });
    document.getElementById('share-link-input').value = url;
    document.getElementById('share-preview-domain').textContent = new URL(url).hostname;
    document.getElementById('share-preview-title').textContent = share.title;
    document.getElementById('share-preview-desc').textContent = share.description;

    // Cảnh báo trên GitHub Pages: kịch bản lưu trong trình duyệt không tới được người nhận
    const warning = document.getElementById('share-warning');
    warning.classList.toggle('hide', !isStaticEnv);
    if (isStaticEnv) {
        warning.innerHTML = published
            ? '<i class="fas fa-circle-info"></i><span>Người nhận sẽ thấy <strong>bản đã đăng</strong> của kịch bản này. Những thay đổi bạn vừa lưu (kể cả tiêu đề, mô tả, ảnh khi chia sẻ) chỉ nằm trong trình duyệt của bạn. Để cập nhật: bấm <strong>Xuất</strong> và <strong>Tải ảnh thiệp</strong> bên dưới, chép file <code>.json</code> và <code>.jpg</code> vào <code>src/static/configs/</code> rồi đăng lại trang.</span>'
            : '<i class="fas fa-triangle-exclamation"></i><span>Kịch bản này mới chỉ lưu trong trình duyệt của bạn nên <strong>người khác mở link sẽ không xem được</strong>. Để gửi tặng: bấm <strong>Xuất</strong> và <strong>Tải ảnh thiệp</strong> bên dưới, đưa file <code>.json</code> và <code>.jpg</code> vào thư mục <code>src/static/configs/</code> của dự án rồi đăng lại trang (hoặc chạy trên máy chủ có PHP).</span>';
    }

    const qrCanvas = document.getElementById('share-qr');
    qrCanvas.width = qrCanvas.height = 320;
    drawQr(qrCanvas, url, 320);

    renderShareTracking();
    share.imageCanvas = await renderShareImage(getFinalConfig());
    document.getElementById('share-preview-img').src = share.imageCanvas.toDataURL('image/jpeg', 0.88);
}

export function closeShareModal() {
    hideModal('share-modal');
}
