/*!
 * Hanabi – dựng logo, biểu tượng trang
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Logo: một quả pháo bay lên theo vệt cong từ dưới trái rồi nở thành chùm; đuôi tia mờ dần về tâm, đầu tia là hạt sáng,
// màu vàng → hồng → tím chuyển dần quanh vòng, trên ô bo góc nền tím đêm.
// Chạy: npm run icons (cần Chrome như khi chạy kiểm thử). Ghi vào src/static/ (chép nguyên vào gốc bản build):
//   favicon.svg               bản 8 tia, rõ ở cỡ nhỏ: biểu tượng tab, logo trên thanh đầu trang
//   favicon.ico               16, 32, 48 px (trình duyệt, công cụ tìm kiếm tự tìm /favicon.ico)
//   apple-touch-icon.png      180 px, nền kín (iPhone tự bo góc)
//   icon-192.png, icon-512.png            ô bo góc, bản 12 tia (Android, site.webmanifest)
//   icon-maskable-512.png     nền kín, hình thu vào vùng an toàn (Android cắt theo hình của máy)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { launchBrowser } from '../tests/e2e/helpers.mjs';

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/static');
const f = n => +n.toFixed(2);

const mix = (a, b, t) => '#' + [1, 3, 5].map(i => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - t) + parseInt(b.slice(i, i + 2), 16) * t)
    .toString(16).padStart(2, '0')).join('');

// Màu đầu tia theo góc tính từ đỉnh (theo chiều kim đồng hồ): vàng → hồng → tím → hồng → vàng
function colorAt(deg) {
    const stops = [[0, '#ffd27a'], [110, '#ff6aa8'], [220, '#9d7bff'], [300, '#ff8fc0'], [360, '#ffd27a']];
    const d = ((deg % 360) + 360) % 360;
    for (let i = 1; i < stops.length; i++) {
        if (d <= stops[i][0]) return mix(stops[i - 1][1], stops[i][1], (d - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]));
    }
    return stops[0][1];
}

// Tia: nhọn ở phía tâm, rộng dần ra tới hạt sáng ở đầu
function ray(cx, cy, a, r1, r2, w) {
    const c = Math.cos(a), s = Math.sin(a), px = -s, py = c;
    return `M${f(cx + c * r1)} ${f(cy + s * r1)}L${f(cx + c * r2 + px * w / 2)} ${f(cy + s * r2 + py * w / 2)}`
        + `L${f(cx + c * r2 - px * w / 2)} ${f(cy + s * r2 - py * w / 2)}Z`;
}

// Chùm pháo tâm (cx, cy), cỡ k; rays: số tia (bỏ tia trùng hướng vệt bay lên), trailW: độ dày vệt
function mark({ cx, cy, k, rays, trailW, id }) {
    const S = v => v * k;
    const skip = Math.round(rays * 7 / 12); // tia chỉ xuống dưới trái, trùng vệt bay lên
    let defs = '';
    let body = '';
    for (let i = 0; i < rays; i++) {
        if (i === skip) continue;
        const long = i % 2 === 0;
        const deg = i * 360 / rays;
        const a = (deg - 90) * Math.PI / 180;
        const r1 = S(long ? 38 : 44), r2 = S(long ? 150 : 110), head = S(long ? 15 : 11.5);
        const color = colorAt(deg);
        const x1 = cx + Math.cos(a) * r1, y1 = cy + Math.sin(a) * r1, x2 = cx + Math.cos(a) * r2, y2 = cy + Math.sin(a) * r2;
        defs += `<linearGradient id="${id}r${i}" x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" gradientUnits="userSpaceOnUse">`
            + `<stop offset="0" stop-color="${color}" stop-opacity="0"/><stop offset="1" stop-color="${color}"/></linearGradient>`;
        body += `<path d="${ray(cx, cy, a, r1, r2, head * 1.55)}" fill="url(#${id}r${i})"/>`
            + `<circle cx="${f(x2)}" cy="${f(y2)}" r="${f(head)}" fill="${color}"/>`;
    }
    // Vệt bay lên: cong nhẹ, thon và mờ dần về gốc, đầu vệt chạm quầng sáng ở tâm
    const ex = cx - S(20), ey = cy + S(30);
    const sx = cx - S(170), sy = cy + S(270);
    const w = S(trailW);
    defs += `<linearGradient id="${id}t" x1="${f(ex)}" y1="${f(ey)}" x2="${f(sx)}" y2="${f(sy)}" gradientUnits="userSpaceOnUse">`
        + '<stop offset="0" stop-color="#ffd27a"/><stop offset="1" stop-color="#ff6aa8" stop-opacity="0"/></linearGradient>';
    const trail = `<path d="M${f(ex - w * 0.45)} ${f(ey - w * 0.3)}Q${f(cx - S(150))} ${f(cy + S(120))} ${f(sx)} ${f(sy)}`
        + `Q${f(cx - S(120))} ${f(cy + S(140))} ${f(ex + w * 0.45)} ${f(ey + w * 0.3)}Z" fill="url(#${id}t)"/>`;
    // Lõi sáng
    defs += `<radialGradient id="${id}g" cx="${f(cx)}" cy="${f(cy)}" r="${f(S(72))}" gradientUnits="userSpaceOnUse">`
        + '<stop offset="0" stop-color="#ffe9b0" stop-opacity="0.9"/><stop offset="0.5" stop-color="#ff8ac0" stop-opacity="0.3"/>'
        + '<stop offset="1" stop-color="#ff5fa2" stop-opacity="0"/></radialGradient>';
    const core = `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(S(72))}" fill="url(#${id}g)"/><circle cx="${f(cx)}" cy="${f(cy)}" r="${f(S(18))}" fill="#fff"/>`;
    return { defs, body: trail + body + core };
}

// Ô nền tím đêm: rounded bo góc (biểu tượng trang), không bo thì nền kín (iPhone, Android tự cắt)
function icon({ rays, k, cx, cy, trailW, rounded = true }) {
    const m = mark({ cx, cy, k, rays, trailW, id: 'm' });
    const rx = rounded ? 116 : 0;
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">'
        + '<defs><linearGradient id="bg" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">'
        + '<stop offset="0" stop-color="#2b1d5e"/><stop offset="1" stop-color="#0a0b19"/></linearGradient>'
        + `<radialGradient id="gl" cx="${f(cx)}" cy="${f(cy)}" r="260" gradientUnits="userSpaceOnUse">`
        + '<stop offset="0" stop-color="#ff5fa2" stop-opacity="0.3"/><stop offset="1" stop-color="#ff5fa2" stop-opacity="0"/></radialGradient>'
        + `${m.defs}</defs><rect width="512" height="512" rx="${rx}" fill="url(#bg)"/><rect width="512" height="512" rx="${rx}" fill="url(#gl)"/>`
        + `${m.body}</svg>`;
}

const SIMPLE = { rays: 8, k: 1.16, cx: 288, cy: 210, trailW: 24 };
const DETAILED = { rays: 12, k: 1.06, cx: 284, cy: 212, trailW: 16 };
const MASKABLE = { rays: 12, k: 0.84, cx: 272, cy: 230, trailW: 18, rounded: false };

const svgs = {
    simple: icon(SIMPLE),
    detailed: icon(DETAILED),
    square: icon({ ...DETAILED, rounded: false }),
    maskable: icon(MASKABLE)
};
fs.writeFileSync(path.join(OUT, 'favicon.svg'), svgs.simple + '\n');

// Vẽ SVG ra PNG bằng Chrome
const browser = await launchBrowser();
const page = await browser.newPage();
const png = async (svg, size) => {
    const data = await page.evaluate(async (svg, size) => {
        const img = new Image();
        img.src = 'data:image/svg+xml;base64,' + btoa(svg);
        await img.decode();
        const c = document.createElement('canvas');
        c.width = c.height = size;
        const g = c.getContext('2d');
        g.imageSmoothingQuality = 'high';
        g.drawImage(img, 0, 0, size, size);
        return c.toDataURL('image/png');
    }, svg, size);
    return Buffer.from(data.split(',')[1], 'base64');
};
const files = {
    'apple-touch-icon.png': await png(svgs.square, 180),
    'icon-192.png': await png(svgs.detailed, 192),
    'icon-512.png': await png(svgs.detailed, 512),
    'icon-maskable-512.png': await png(svgs.maskable, 512)
};
for (const [name, buf] of Object.entries(files)) fs.writeFileSync(path.join(OUT, name), buf);

// favicon.ico: các ảnh PNG 16, 32, 48 gói trong một file ICO
const ico = await Promise.all([16, 32, 48].map(async size => ({ size, data: await png(svgs.simple, size) })));
const header = Buffer.alloc(6 + 16 * ico.length);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(ico.length, 4);
let offset = header.length;
ico.forEach(({ size, data }, i) => {
    const e = 6 + 16 * i;
    header.writeUInt8(size, e);
    header.writeUInt8(size, e + 1);
    header.writeUInt16LE(1, e + 4);
    header.writeUInt16LE(32, e + 6);
    header.writeUInt32LE(data.length, e + 8);
    header.writeUInt32LE(offset, e + 12);
    offset += data.length;
});
fs.writeFileSync(path.join(OUT, 'favicon.ico'), Buffer.concat([header, ...ico.map(i => i.data)]));
await browser.close();
console.log('Đã ghi favicon.svg, favicon.ico, apple-touch-icon.png, icon-192.png, icon-512.png, icon-maskable-512.png vào', OUT);
