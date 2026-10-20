/*!
 * Trình diễn Pháo hoa – kiểm thử tự động
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Dùng chung cho các bộ kiểm thử: máy chủ PHP phục vụ thư mục dist, trình duyệt Chrome, dữ liệu thử.
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer-core';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const DIST = path.join(ROOT, 'dist');
export const sleep = ms => new Promise(r => setTimeout(r, ms));

// Chrome có sẵn trên máy (đổi bằng biến môi trường CHROME_PATH)
function chromePath() {
    if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
    if (process.platform === 'win32') return 'C:/Program Files/Google/Chrome/Application/chrome.exe';
    if (process.platform === 'darwin') return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    return '/usr/bin/google-chrome';
}

export function launchBrowser() {
    const args = ['--mute-audio'];
    // Máy chạy CI (Linux) không cho Chrome dùng sandbox
    if (process.platform === 'linux') args.push('--no-sandbox');
    return puppeteer.launch({ executablePath: chromePath(), headless: 'new', protocolTimeout: 180000, args });
}

// Mở trang mới, ghi lại lỗi JS để kiểm tra cuối bài
export async function openPage(browser, { width = 1280, height = 720 } = {}) {
    const page = await browser.newPage();
    const mobile = width < 768;
    await page.setViewport({ width, height, isMobile: mobile, hasTouch: mobile });
    page.errors = [];
    page.on('pageerror', e => page.errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') page.errors.push(m.text()); });
    return page;
}

// Máy chủ PHP có sẵn (php -S) phục vụ dist; router.php làm thay .htaccess (trang chia sẻ s/<tên>.html)
export async function startServer(port) {
    const server = spawn(process.env.PHP_BIN || 'php', ['-S', `127.0.0.1:${port}`, '-t', DIST, path.join(ROOT, 'tests/e2e/router.php')], { stdio: 'ignore' });
    const base = `http://127.0.0.1:${port}`;
    for (let i = 0; i < 50; i++) {
        try {
            if ((await fetch(`${base}/index.html`)).ok) return { base, stop: () => server.kill() };
        } catch (e) {
            // Chưa sẵn sàng
        }
        await sleep(200);
    }
    server.kill();
    throw new Error('Không khởi động được máy chủ PHP (cần lệnh php trong PATH hoặc biến PHP_BIN)');
}

// Kịch bản thử trong dist/configs, xóa sau mỗi bài
export function writeConfig(id, config) {
    fs.writeFileSync(path.join(DIST, 'configs', `${id}.json`), JSON.stringify(config));
}

export function removeConfig(id) {
    for (const ext of ['json', 'jpg']) fs.rmSync(path.join(DIST, 'configs', `${id}.${ext}`), { force: true });
}

// File WAV một chuỗi nốt nhạc (dùng làm nhạc nền thử)
export function writeMelody(file, seconds = 12) {
    const rate = 22050;
    const samples = rate * seconds;
    const buffer = Buffer.alloc(44 + samples * 2);
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + samples * 2, 4);
    buffer.write('WAVEfmt ', 8);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20);
    buffer.writeUInt16LE(1, 22);
    buffer.writeUInt32LE(rate, 24);
    buffer.writeUInt32LE(rate * 2, 28);
    buffer.writeUInt16LE(2, 32);
    buffer.writeUInt16LE(16, 34);
    buffer.write('data', 36);
    buffer.writeUInt32LE(samples * 2, 40);
    const notes = [262, 294, 330, 349, 392, 440, 494, 523];
    for (let i = 0; i < samples; i++) {
        const note = notes[Math.floor(i / (rate / 2)) % notes.length];
        buffer.writeInt16LE(Math.round(8000 * Math.sin(2 * Math.PI * note * i / rate)), 44 + i * 2);
    }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, buffer);
}

// Số điểm sáng trên bầu trời (pháo đang bay/nổ)
export function litPixels(page) {
    return page.evaluate(() => {
        const c = document.getElementById('trails-canvas');
        if (!c || !c.width) return 0;
        const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        let n = 0;
        for (let i = 0; i < d.length; i += 64) if (d[i] + d[i + 1] + d[i + 2] > 60) n++;
        return n;
    });
}

// Ghi kết quả từng bước kiểm tra
export function createReporter(suite) {
    const results = [];
    return {
        check(name, ok, detail = '') {
            results.push({ suite, name, ok: !!ok, detail });
            console.log(`${ok ? '  ✓' : '  ✗'} ${name}${!ok && detail !== '' ? `  -> ${detail}` : ''}`);
        },
        results
    };
}
