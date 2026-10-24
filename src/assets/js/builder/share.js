/*!
 * Hanabi – builder (chia sẻ)
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Chia sẻ: ảnh xem trước khi gửi link, link, mạng xã hội, mã QR, ảnh chia sẻ.

import qrcode from 'qrcode-generator';
import { renderShareImage } from '../share-image.js';
import { availablePlatforms, copyText, isMobileDevice, platformIcon, shareLink } from '../share-targets.js';
import { isStaticEnv, state } from './state.js';
import { getShowUrl, hideLoading, hideModal, localScript, notify, showLoading, showModal } from './util.js';
import { canPackConfig, packedShowUrl } from '../share-link.js';
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

// Trang chia sẻ s/<tên> chứa sẵn ảnh, tiêu đề, mô tả cho mạng xã hội rồi tự mở màn trình diễn
function getShareUrl(filename) {
    return new URL(`s/${encodeURIComponent(filename)}`, window.location.href).href;
}

// Thông tin của lần chia sẻ hiện tại; packed: link chứa sẵn kịch bản, dropped: số ảnh tự tải lên không gói vào link được
export const share = { id: '', url: '', published: true, packed: false, dropped: 0, title: '', description: '', imageCanvas: null };

// Trang tĩnh (GitHub Pages...) không có máy chủ, kịch bản chỉ lưu trong trình duyệt: link chứa sẵn cả kịch bản vừa lưu
// (share-link.js), ai mở cũng xem đúng. Trình duyệt quá cũ không nén được thì chỉ kịch bản đã đưa vào configs/ mới có
// trang chia sẻ
export async function resolveShareUrl(filename) {
    const pageUrl = getShareUrl(filename);
    if (!isStaticEnv) return { url: pageUrl, published: true, packed: false, dropped: 0 };
    if (canPackConfig) {
        try {
            const { url, dropped } = await packedShowUrl(localScript(filename) || getFinalConfig());
            return { url, published: true, packed: true, dropped };
        } catch (e) {
            // Không nén được: dùng trang chia sẻ hoặc link theo tên bên dưới
        }
    }
    try {
        const response = await fetch(pageUrl, { method: 'HEAD', cache: 'no-store' });
        if (response.ok) return { url: pageUrl, published: true, packed: false, dropped: 0 };
    } catch (e) {
        // Không kiểm tra được (vd mở file trực tiếp): coi như chưa đăng
    }
    return { url: getShowUrl(filename), published: false, packed: false, dropped: 0 };
}

function refreshShareText() {
    const config = getFinalConfig();
    share.title = config.seoTitle || config.title;
    share.description = getShareDescription(config);
}

// Nút "Mở" cạnh nút Sao chép (thanh link sau khi lưu, hộp Chia sẻ): mở link chia sẻ trong tab mới
function setOpenLinks(url) {
    ['share-bar-open', 'share-open-link'].forEach(id => {
        const link = document.getElementById(id);
        if (link) link.href = url;
    });
}

export function updateShareBar(filename) {
    const shareBar = document.getElementById('share-bar');
    const shareUrlEl = document.getElementById('share-url');
    share.id = filename;
    share.url = getShareUrl(filename);
    shareUrlEl.innerText = share.url;
    setOpenLinks(share.url);
    shareBar.classList.remove('hide');
    resolveShareUrl(filename).then(found => {
        if (share.id !== filename) return;
        Object.assign(share, found);
        shareUrlEl.innerText = found.url;
        setOpenLinks(found.url);
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

// mode: 'link' gửi link (thanh link sau khi lưu luôn gửi link), 'qr' gửi ảnh mã QR (các nút trong hộp Chia sẻ khi chọn
// "Gửi đi bằng: Mã QR")
export async function shareTo(platform, mode = 'link') {
    if (!share.id) {
        notify('Vui lòng lưu kịch bản trước khi chia sẻ!', 'warning');
        return;
    }
    refreshShareText();
    if (mode === 'qr') return shareQrTo(platform);
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

// Các nút trong hộp Chia sẻ gửi link hay ảnh mã QR (giữ lựa chọn tới lần mở hộp sau)
let shareMode = 'link';

export function setShareMode(mode) {
    shareMode = mode === 'qr' ? 'qr' : 'link';
    renderShareGrid();
}

function renderShareGrid() {
    const qr = shareMode === 'qr';
    document.querySelectorAll('[data-share-mode]').forEach(btn => {
        const on = btn.dataset.shareMode === shareMode;
        btn.classList.toggle('active', on);
        btn.setAttribute('aria-pressed', String(on));
    });
    document.getElementById('share-grid').innerHTML = availablePlatforms().map(p => `
            <button type="button" class="share-item" onclick="shareTo('${p.id}', '${shareMode}')" title="${qr ? 'Gửi mã QR' : 'Chia sẻ'} qua ${p.name}">
                ${platformIcon(p)}
                <span class="share-name">${p.name}</span>
            </button>`).join('');
    const hint = document.getElementById('share-mode-hint');
    hint.classList.toggle('hide', !qr);
    hint.textContent = isMobileDevice()
        ? 'Gửi ảnh mã QR kèm tiêu đề qua bảng chia sẻ của máy; người nhận quét mã bằng camera để xem.'
        : 'Máy tính: ảnh mã QR được sao chép để dán (Ctrl+V) vào khung chat, bài đăng hoặc thư; người nhận quét mã bằng camera để xem.';
}

// Bản web của từng nơi để dán ảnh mã QR vào (máy tính)
const QR_WEB = {
    facebook: 'https://www.facebook.com/',
    messenger: 'https://www.messenger.com/',
    zalo: 'https://chat.zalo.me/',
    telegram: 'https://web.telegram.org/',
    whatsapp: 'https://web.whatsapp.com/',
    x: 'https://x.com/compose/post',
    threads: 'https://www.threads.net/',
    linkedin: 'https://www.linkedin.com/feed/'
};

async function copyImage(blob) {
    try {
        await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
        return true;
    } catch (e) {
        return false;
    }
}

// Gửi ảnh mã QR: điện thoại (mọi nút) và nút "Ứng dụng khác" dùng bảng chia sẻ của máy (chọn Zalo, Messenger... ở đó);
// máy tính sao chép ảnh rồi mở bản web để dán, không sao chép được thì tải ảnh về để đính kèm. Instagram, TikTok: tải ảnh
// về để đăng.
async function shareQrTo(platform) {
    const card = renderQrCard();
    if (!card) return;
    const name = qrFileName();
    const blob = await new Promise(resolve => card.toBlob(resolve, 'image/png'));
    const file = new File([blob], name, { type: 'image/png' });
    const label = (availablePlatforms().find(p => p.id === platform) || {}).name || '';
    if ((platform === 'native' || isMobileDevice()) && navigator.canShare?.({ files: [file] })) {
        try {
            await navigator.share({ files: [file], title: share.title, text: `🎆 ${share.title}: quét mã để xem màn pháo hoa` });
        } catch (e) {
            // Người dùng đóng bảng chia sẻ
        }
        return;
    }
    if (platform === 'instagram' || platform === 'tiktok' || !(await copyImage(blob))) {
        downloadDataUrl(card.toDataURL('image/png'), name);
        notify(platform === 'instagram' || platform === 'tiktok' ? `Đã tải ảnh mã QR để đăng lên ${label}.`
            : `Đã tải ảnh mã QR về máy, hãy đính kèm ảnh khi gửi${label && platform !== 'native' ? ` qua ${label}` : ''}.`, 'success');
    } else {
        notify(`Đã sao chép ảnh mã QR, hãy dán (Ctrl+V) vào ${platform === 'email' ? 'thư' : platform === 'native' ? 'nơi muốn gửi' : label}.`, 'success');
    }
    if (QR_WEB[platform]) {
        const win = window.open(QR_WEB[platform], '_blank');
        if (win) win.opener = null;
    } else if (platform === 'email') {
        window.location.href = `mailto:?subject=${encodeURIComponent(share.title)}&body=${encodeURIComponent('Quét mã QR trong ảnh để xem màn pháo hoa 🎆')}`;
    }
}

// Vẽ mã QR lên canvas (nền trắng, chừa lề 2 ô theo chuẩn để camera dễ nhận). Link quá dài (kịch bản gói trong link) không
// vừa mã QR thì trả về false
function drawQr(canvas, text, size) {
    let qr = null;
    for (const level of ['M', 'L']) {
        try {
            qr = qrcode(0, level);
            qr.addData(text);
            qr.make();
            break;
        } catch (e) {
            qr = null;
        }
    }
    if (!qr) return false;
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
    return true;
}

function downloadDataUrl(dataUrl, name) {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
}

const qrFileName = () => `qr-${share.id}.png`;

// Mã QR dạng thẻ để in hoặc gửi: tiêu đề + QR + lời nhắn quét mã. Link quá dài không vừa mã QR thì null
function renderQrCard() {
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
    if (!drawQr(qrCanvas, share.url, qrSize)) return null;
    ctx.drawImage(qrCanvas, (W - qrSize) / 2, 140);

    ctx.fillStyle = '#6b21a8';
    ctx.font = '600 28px Inter, sans-serif';
    ctx.fillText('Quét mã để xem màn pháo hoa 🎆', W / 2, 720);
    ctx.fillStyle = '#64748b';
    ctx.font = '400 22px Inter, sans-serif';
    ctx.fillText(new URL(share.url).hostname, W / 2, 762);
    return canvas;
}

export function downloadShareQr() {
    if (!share.id) return;
    const card = renderQrCard();
    if (card) downloadDataUrl(card.toDataURL('image/png'), qrFileName());
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
    setOpenLinks(share.url);

    const found = await resolveShareUrl(share.id);
    Object.assign(share, found);
    const { url, published } = found;
    document.getElementById('share-link-input').value = url;
    setOpenLinks(url);
    document.getElementById('share-preview-domain').textContent = new URL(url).hostname;
    document.getElementById('share-preview-title').textContent = share.title;
    document.getElementById('share-preview-desc').textContent = share.description;

    // Cảnh báo trên GitHub Pages: kịch bản lưu trong trình duyệt không tới được người nhận
    const warning = document.getElementById('share-warning');
    warning.classList.toggle('hide', !isStaticEnv);
    if (isStaticEnv) {
        const dropped = share.dropped
            ? ` <strong>${share.dropped} ảnh bạn tự tải lên</strong> (ảnh pháo, ảnh nền, ảnh khi chia sẻ) không gửi kèm link được: người nhận sẽ không thấy các ảnh đó.`
            : '';
        warning.innerHTML = share.packed
            ? `<i class="fas fa-circle-info"></i><span>Trang đang chạy không có máy chủ lưu kịch bản nên <strong>link chứa sẵn cả kịch bản</strong>: ai mở, ở máy nào cũng xem đúng bản bạn vừa lưu. Link khá dài, hãy gửi bằng nút Sao chép hoặc các nút chia sẻ; khi dán link, Zalo, Facebook hiện thẻ chung của Hanabi.${dropped}</span>`
            : published
            ? '<i class="fas fa-circle-info"></i><span>Người nhận sẽ thấy <strong>bản đã đăng</strong> của kịch bản này. Những thay đổi bạn vừa lưu (kể cả tiêu đề, mô tả, ảnh khi chia sẻ) chỉ nằm trong trình duyệt của bạn. Để cập nhật: bấm <strong>Xuất</strong> và <strong>Tải ảnh thiệp</strong> bên dưới, chép file <code>.json</code> và <code>.jpg</code> vào <code>src/static/configs/</code> rồi đăng lại trang.</span>'
            : '<i class="fas fa-triangle-exclamation"></i><span>Kịch bản này mới chỉ lưu trong trình duyệt của bạn nên <strong>người khác mở link sẽ không xem được</strong>. Để gửi tặng: bấm <strong>Xuất</strong> và <strong>Tải ảnh thiệp</strong> bên dưới, đưa file <code>.json</code> và <code>.jpg</code> vào thư mục <code>src/static/configs/</code> của dự án rồi đăng lại trang (hoặc chạy trên máy chủ có PHP).</span>';
    }

    // Link dài (kịch bản gói trong link) không vừa mã QR: ẩn mã QR, nút tải mã QR
    const qrCanvas = document.getElementById('share-qr');
    qrCanvas.width = qrCanvas.height = 320;
    const qrOk = drawQr(qrCanvas, url, 320);
    qrCanvas.classList.toggle('hide', !qrOk);
    document.getElementById('btn-share-qr').classList.toggle('hide', !qrOk);
    // Không có mã QR thì chỉ gửi được link
    document.getElementById('share-mode').classList.toggle('hide', !qrOk);
    if (!qrOk && shareMode === 'qr') setShareMode('link');
    const qrText = document.getElementById('share-qr-text');
    qrText.dataset.text ??= qrText.textContent;
    qrText.textContent = qrOk ? qrText.dataset.text : 'Kịch bản dài nên link không vừa mã QR, hãy gửi link. Ảnh thiệp dùng để đăng Instagram, TikTok hoặc gửi kèm tin nhắn.';

    renderShareTracking();
    share.imageCanvas = await renderShareImage(getFinalConfig());
    document.getElementById('share-preview-img').src = share.imageCanvas.toDataURL('image/jpeg', 0.88);
}

export function closeShareModal() {
    hideModal('share-modal');
}
