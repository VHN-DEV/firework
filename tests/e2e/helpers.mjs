/*!
 * Hanabi – kiểm thử tự động
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

// Tên miền giả của trang tĩnh (GitHub Pages): trình duyệt thử trỏ về máy chủ thử, trang tự nhận là trang tĩnh
export const STATIC_HOST = 'hanabi-e2e.github.io';

export function launchBrowser() {
    const args = ['--mute-audio', `--host-resolver-rules=MAP ${STATIC_HOST} 127.0.0.1`];
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
    // Bỏ qua lỗi kết nối của máy chủ thử php -S (xử lý từng yêu cầu một, đôi khi đóng kết nối), không phải lỗi trang
    page.on('console', m => {
        if (m.type() === 'error' && !/net::ERR_CONNECTION_(CLOSED|RESET)/.test(m.text())) page.errors.push(m.text());
    });
    return page;
}

// Máy chủ PHP có sẵn (php -S) phục vụ dist; router.php làm thay .htaccess (đường dẫn không đuôi /builder, trang chia sẻ s/<tên>)
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

// Xóa cả mã chủ, lịch sử mở quà (api/data): còn sót thì lần chạy sau lưu lại cùng tên bị coi là kịch bản của máy khác
export function removeConfig(id) {
    for (const ext of ['json', 'jpg']) fs.rmSync(path.join(DIST, 'configs', `${id}.${ext}`), { force: true });
    for (const kind of ['owners', 'opens']) fs.rmSync(path.join(DIST, 'api', 'data', kind, `${id}.json`), { force: true });
}

// Kịch bản kiểm thử lưu với tên tự đặt (đuôi ngẫu nhiên <tên>-xxxxx, xem withRandomSuffix trong builder/images.js): xóa
// cả <tên> lẫn mọi bản <tên>-xxxxx còn sót từ lần chạy trước
export function removeConfigFamily(id) {
    removeConfig(id);
    const dir = path.join(DIST, 'configs');
    if (!fs.existsSync(dir)) return;
    for (const file of fs.readdirSync(dir)) {
        const m = /^(.+-[a-z0-9]{5})\.json$/.exec(file);
        if (m && m[1].startsWith(`${id}-`) && m[1].length === id.length + 6) removeConfig(m[1]);
    }
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

// File WAV bài nhạc biết trước đáp án (dùng thử "Xếp pháo theo nhịp nhạc"): phách đầu tiên ở giây t0, nhịp 4/4;
// đoạn dạo êm (chỉ hợp âm và hi-hat), đoạn chính có trống, đoạn cao trào trống dồn mỗi phách. Trả về các mốc đúng.
export function writeBeatSong(file, { bpm = 124, t0 = 0.3, sections = [['intro', 4], ['verse', 8], ['chorus', 8]] } = {}) {
    const rate = 22050;
    const T = 60 / bpm;
    const totalBars = sections.reduce((s, [, bars]) => s + bars, 0);
    const n = Math.ceil((t0 + totalBars * 4 * T + 2) * rate);
    const buf = new Float32Array(n);
    let seed = 7;
    const noise = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1;
    const add = (start, len, fn) => {
        const a = Math.round(start * rate);
        for (let i = a; i < Math.min(n, a + Math.round(len * rate)); i++) buf[i] += fn((i - a) / rate);
    };
    const kick = (t, g) => add(t, 0.25, x => g * Math.sin(2 * Math.PI * (45 * x + 2.5 * (1 - Math.exp(-x * 30)))) * Math.exp(-x * 14));
    const snare = (t, g) => add(t, 0.2, x => g * noise() * Math.exp(-x * 22));
    const hat = (t, g) => add(t, 0.05, x => g * noise() * Math.exp(-x * 60));
    const chords = [[220, 277.2, 329.6], [196, 246.9, 293.7], [174.6, 220, 261.6], [196, 246.9, 293.7]];
    const pad = (t, freqs, g) => add(t, 4 * T, x => g * Math.min(1, x / 0.15) * Math.min(1, (4 * T - x) / 0.1)
        * freqs.reduce((s, f) => s + Math.sin(2 * Math.PI * f * x), 0) / freqs.length);
    const beats = [];
    let chorusStart = null;
    let bar = 0;
    sections.forEach(([name, bars]) => {
        for (let b = 0; b < bars; b++, bar++) {
            const start = t0 + bar * 4 * T;
            if (name === 'chorus' && chorusStart === null) chorusStart = start;
            for (let k = 0; k < 4; k++) beats.push(start + k * T);
            pad(start, chords[bar % 4], name === 'chorus' ? 0.25 : 0.12);
            if (name === 'intro') {
                for (let k = 0; k < 4; k++) hat(start + k * T, 0.05);
            } else {
                for (let k = 0; k < 4; k++) if (name === 'chorus' || k % 2 === 0) kick(start + k * T, name === 'chorus' ? 0.85 : 0.6);
                snare(start + T, name === 'chorus' ? 0.45 : 0.25);
                snare(start + 3 * T, name === 'chorus' ? 0.45 : 0.25);
                for (let k = 0; k < 8; k++) hat(start + k * T / 2, name === 'chorus' ? 0.18 : 0.08);
            }
        }
    });
    let peak = 0;
    for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(buf[i]));
    const data = Buffer.alloc(44 + n * 2);
    data.write('RIFF', 0);
    data.writeUInt32LE(36 + n * 2, 4);
    data.write('WAVEfmt ', 8);
    data.writeUInt32LE(16, 16);
    data.writeUInt16LE(1, 20);
    data.writeUInt16LE(1, 22);
    data.writeUInt32LE(rate, 24);
    data.writeUInt32LE(rate * 2, 28);
    data.writeUInt16LE(2, 32);
    data.writeUInt16LE(16, 34);
    data.write('data', 36);
    data.writeUInt32LE(n * 2, 40);
    for (let i = 0; i < n; i++) data.writeInt16LE(Math.round(buf[i] / peak * 0.9 * 32767), 44 + i * 2);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, data);
    return { bpm, T, beats, chorusStart };
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
