/*!
 * Trình diễn Pháo hoa – builder (ảnh)
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Ảnh của pháo ảnh: tải lên, cắt chọn phần hiển thị.

import { cropRect, traceFramePath } from '../player/image-frame.js';
import { isStaticEnv, state } from './state.js';
import { hideLoading, hideModal, normalizeAssetPath, notify, showLoading, showModal } from './util.js';
import { updateEvent } from './events.js';
import { renderInspector } from './inspector.js';

// Chữ có dấu -> chữ thường không dấu, nối bằng gạch dưới ("Chúc mừng Đạt" -> "chuc_mung_dat")
export function toSlug(text) {
    return String(text || '')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd').replace(/Đ/g, 'D')
        .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
        .slice(0, 40);
}

// Thư mục trên máy chủ chứa ảnh/nhạc tải lên: theo tên file kịch bản. Chưa đặt tên thì lấy theo tiêu đề
// (không bắt người dùng điền tên trước, rồi bỏ mất file vừa chọn).
export function getUploadFolder() {
    const filename = document.getElementById('filename').value.trim();
    if (/^[a-zA-Z0-9_-]+$/.test(filename)) return filename;
    return toSlug(document.getElementById('title').value) || 'chua_dat_ten';
}

async function handleImageUpload(id, input) {
    const file = input.files[0];
    if (!file) return;

    const scenarioName = getUploadFolder();

    showLoading('Đang xử lý hình ảnh...');

    if (isStaticEnv) {
        // Trên GitHub Pages hoặc môi trường tĩnh, dùng FileReader để lấy DataURL
        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target.result;
            updateEvent(id, 'imageUrl', dataUrl);
            renderInspector();
            hideLoading();
            openCropper(id);
            notify('Đã tải ảnh lên (Lưu cục bộ dưới dạng DataURL)!', 'success');
        };
        reader.onerror = () => {
            hideLoading();
            notify('Lỗi khi đọc file ảnh.', 'error');
        };
        reader.readAsDataURL(file);
        return;
    }

    const formData = new FormData();
    formData.append('image', file);
    formData.append('filename', scenarioName);

    try {
        const response = await fetch('api/upload_image.php', {
            method: 'POST',
            body: formData
        });
        const data = await response.json();

        hideLoading();
        if (data.success) {
            updateEvent(id, 'imageUrl', data.url);
            renderInspector();
            notify('Tải ảnh lên thành công!', 'success');
            openCropper(id);
        } else {
            notify('Lỗi: ' + data.message, 'error');
        }
    } catch (e) {
        hideLoading();
        notify('Lỗi kết nối khi tải ảnh.', 'error');
    }
}

window.handleImageUpload = handleImageUpload;

// ---------------------------------------------------------------------------
// CHỌN PHẦN ẢNH HIỂN THỊ (như đổi ảnh đại diện): kéo để dời ảnh, cuộn chuột / chụm hai ngón / thanh trượt để phóng to.
// Lưu vào event.crop = { x, y, zoom } (xem cropRect trong player/image-frame.js), trình phát cắt ảnh đúng như vậy.
// ---------------------------------------------------------------------------

const CROP_MAX_ZOOM = 4;

const cropper = { eventId: null, img: null, frame: '', crop: null, layout: null, pointers: new Map(), pinch: null };

const cropImages = new Map();

function loadCropImage(url) {
    const src = normalizeAssetPath(url);
    if (!cropImages.has(src)) {
        cropImages.set(src, new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => {
                cropImages.delete(src);
                reject(new Error('Không đọc được ảnh'));
            };
            img.src = src;
        }));
    }
    return cropImages.get(src);
}

// Vẽ đúng phần ảnh và khung sẽ hiện trên trời (giống getProcessedImage của trình phát)
function drawCroppedImage(canvas, img, frame, crop, maxSide = 320) {
    const area = cropRect(img.naturalWidth, img.naturalHeight, frame, crop);
    const k = maxSide / Math.max(area.w, area.h);
    canvas.width = Math.max(1, Math.round(area.w * k));
    canvas.height = Math.max(1, Math.round(area.h * k));
    const ctx = canvas.getContext('2d');
    if (frame) {
        traceFramePath(ctx, frame, canvas.width / 2, canvas.height / 2, canvas.width / 2);
        ctx.clip();
    }
    ctx.drawImage(img, area.x, area.y, area.w, area.h, 0, 0, canvas.width, canvas.height);
}

// Ảnh thu nhỏ trong bảng chỉnh sửa
export function paintImageThumb(event) {
    const canvas = document.getElementById('image-thumb');
    if (!canvas || !event.imageUrl) return;
    // Nét theo cỡ khung đang hiện và mật độ điểm ảnh màn hình (cố định 320 thì màn nét gấp 2, 3 bị phóng to, nhòe)
    const shown = Math.max(canvas.clientWidth, canvas.clientHeight) * (window.devicePixelRatio || 1);
    const side = Math.round(Math.min(1600, Math.max(320, shown)));
    loadCropImage(event.imageUrl)
        .then(img => canvas.isConnected && drawCroppedImage(canvas, img, event.frame, event.crop, side))
        .catch(() => {});
}

export async function openCropper(id) {
    const event = state.events.find(e => e.id === id);
    if (!event?.imageUrl) return;
    let img;
    try {
        img = await loadCropImage(event.imageUrl);
    } catch (e) {
        notify('Không đọc được ảnh này.', 'error');
        return;
    }
    Object.assign(cropper, { eventId: id, img, frame: event.frame || '', crop: { x: 0.5, y: 0.5, zoom: 1, ...event.crop } });
    cropper.pointers.clear();
    cropper.pinch = null;
    showModal('crop-modal');
    layoutCropper();
    drawCropper();
    document.getElementById('crop-canvas').focus();
}

export function closeCropper() {
    hideModal('crop-modal');
    cropper.img = null;
}

// Khung cắt nằm giữa vùng vẽ, phần ảnh bên ngoài khung vẫn thấy nhưng tối đi
function layoutCropper() {
    const canvas = document.getElementById('crop-canvas');
    const size = canvas.clientWidth;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    const { naturalWidth: iw, naturalHeight: ih } = cropper.img;
    const aspect = cropper.frame ? 1 : iw / ih;
    const box = size * 0.8;
    const w = aspect >= 1 ? box : box * aspect;
    const h = aspect >= 1 ? box / aspect : box;
    cropper.layout = { size, dpr, w, h, left: (size - w) / 2, top: (size - h) / 2 };
}

function drawCropper() {
    const canvas = document.getElementById('crop-canvas');
    const { img, frame, layout: L } = cropper;
    if (!img || !L) return;
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    const area = cropRect(iw, ih, frame, cropper.crop);
    // Tâm đã chạm mép ảnh thì giữ ở đó, kéo tiếp ra ngoài không bị dồn lại
    cropper.crop.x = (area.x + area.w / 2) / iw;
    cropper.crop.y = (area.y + area.h / 2) / ih;
    const k = L.w / area.w;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
    ctx.clearRect(0, 0, L.size, L.size);
    const drawImage = () => ctx.drawImage(img, L.left - area.x * k, L.top - area.y * k, iw * k, ih * k);
    drawImage();
    ctx.fillStyle = 'rgba(8, 10, 16, 0.65)';
    ctx.fillRect(0, 0, L.size, L.size);
    ctx.save();
    traceFramePath(ctx, frame, L.left + L.w / 2, L.top + L.h / 2, L.w / 2, L.h / 2);
    ctx.clip();
    drawImage();
    ctx.restore();
    traceFramePath(ctx, frame, L.left + L.w / 2, L.top + L.h / 2, L.w / 2, L.h / 2);
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.stroke();
    document.getElementById('crop-zoom').value = cropper.crop.zoom;
}

// Đổi độ phóng, giữ nguyên điểm ảnh đang nằm dưới (px, py) (mặc định: tâm khung)
function setCropZoom(zoom, px, py) {
    const { img, frame, layout: L, crop } = cropper;
    if (!img) return;
    zoom = Math.min(CROP_MAX_ZOOM, Math.max(1, zoom));
    px = px ?? L.left + L.w / 2;
    py = py ?? L.top + L.h / 2;
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    const before = cropRect(iw, ih, frame, crop);
    const u = before.x + (px - L.left) * before.w / L.w;
    const v = before.y + (py - L.top) * before.h / L.h;
    const w = before.w * crop.zoom / zoom;
    const h = before.h * crop.zoom / zoom;
    crop.x = (u - (px - L.left) * w / L.w + w / 2) / iw;
    crop.y = (v - (py - L.top) * h / L.h + h / 2) / ih;
    crop.zoom = zoom;
    drawCropper();
}

export function zoomCropper(delta) {
    setCropZoom(cropper.crop.zoom + delta);
}

function moveCropper(dx, dy) {
    const { img, frame, layout: L, crop } = cropper;
    const area = cropRect(img.naturalWidth, img.naturalHeight, frame, crop);
    crop.x -= dx * area.w / L.w / img.naturalWidth;
    crop.y -= dy * area.h / L.h / img.naturalHeight;
    drawCropper();
}

export function resetCropper() {
    cropper.crop = { x: 0.5, y: 0.5, zoom: 1 };
    drawCropper();
}

export function saveCropper() {
    const { img, frame, crop } = cropper;
    if (!img) return;
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    const area = cropRect(iw, ih, frame, crop);
    const center = cropRect(iw, ih, frame, null);
    // Đúng vùng mặc định (giữa ảnh, không phóng) thì không lưu gì
    const isDefault = Math.abs(area.x - center.x) < 1 && Math.abs(area.y - center.y) < 1 && Math.abs(area.w - center.w) < 1;
    const round = v => Math.round(v * 1000) / 1000;
    updateEvent(cropper.eventId, 'crop', isDefault ? undefined : { x: round(crop.x), y: round(crop.y), zoom: round(crop.zoom) });
    renderInspector();
    closeCropper();
}

export function initCropper() {
    const canvas = document.getElementById('crop-canvas');
    if (!canvas) return;
    const point = e => {
        const rect = canvas.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const pinchState = () => {
        const [a, b] = [...cropper.pointers.values()];
        return { dist: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, zoom: cropper.crop.zoom };
    };
    canvas.addEventListener('pointerdown', e => {
        canvas.setPointerCapture(e.pointerId);
        cropper.pointers.set(e.pointerId, point(e));
        cropper.pinch = cropper.pointers.size === 2 ? pinchState() : null;
    });
    canvas.addEventListener('pointermove', e => {
        const last = cropper.pointers.get(e.pointerId);
        if (!last || !cropper.img) return;
        const now = point(e);
        cropper.pointers.set(e.pointerId, now);
        if (cropper.pinch) {
            // Chụm hai ngón: phóng theo khoảng cách, dời theo điểm giữa hai ngón
            const p = pinchState();
            moveCropper(p.x - cropper.pinch.x, p.y - cropper.pinch.y);
            setCropZoom(cropper.pinch.zoom * p.dist / Math.max(1, cropper.pinch.dist), p.x, p.y);
            cropper.pinch.x = p.x;
            cropper.pinch.y = p.y;
        } else if (cropper.pointers.size === 1) {
            moveCropper(now.x - last.x, now.y - last.y);
        }
    });
    const release = e => {
        cropper.pointers.delete(e.pointerId);
        cropper.pinch = cropper.pointers.size === 2 ? pinchState() : null;
    };
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);
    canvas.addEventListener('wheel', e => {
        e.preventDefault();
        const p = point(e);
        setCropZoom(cropper.crop.zoom * Math.exp(-e.deltaY * 0.0015), p.x, p.y);
    }, { passive: false });
    canvas.addEventListener('keydown', e => {
        const step = e.shiftKey ? 20 : 5;
        const moves = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
        if (moves[e.key]) moveCropper(...moves[e.key]);
        else if (e.key === '+' || e.key === '=') zoomCropper(0.1);
        else if (e.key === '-') zoomCropper(-0.1);
        else return;
        e.preventDefault();
    });
    document.getElementById('crop-zoom').addEventListener('input', e => setCropZoom(Number(e.target.value)));
    document.getElementById('crop-modal').addEventListener('keydown', e => {
        if (e.key === 'Escape') closeCropper();
    });
    window.addEventListener('resize', () => {
        if (!cropper.img) return;
        layoutCropper();
        drawCropper();
    });
}

// ---------------------------------------------------------------------------
// NHẠC NỀN
// ---------------------------------------------------------------------------
