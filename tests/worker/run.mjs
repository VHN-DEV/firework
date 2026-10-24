/*!
 * Hanabi – kiểm thử tự động
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Phần máy chủ trên Cloudflare Workers (worker/, wrangler.jsonc), chạy tại máy bằng "wrangler dev" (D1, KV giả lập trong
// .wrangler/): builder lưu kịch bản kèm ảnh thiệp, link s/<tên> có ảnh, tiêu đề xem trước, mở ở trình duyệt khác đúng
// kịch bản, tải ảnh, nhạc lên rồi đọc lại (nhạc tải từng đoạn), file giả dạng ảnh bị từ chối, mã chủ khi lưu đè, xóa, báo
// mở quà, Xem thử. Cần bản build (npm run build) và mạng để npx tải wrangler lần đầu. Chạy: npm run test:worker
import { spawn, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { DIST, ROOT, launchBrowser, sleep } from '../e2e/helpers.mjs';

if (!fs.existsSync(path.join(DIST, 'index.html'))) {
    console.error('Chưa có bản build: chạy "npm run build" trước.');
    process.exit(1);
}

const PORT = Number(process.env.WORKER_PORT) || 8798;
const BASE = `http://127.0.0.1:${PORT}`;
const wrangler = spawn('npx', ['--yes', 'wrangler@4', 'dev', '--port', String(PORT), '--ip', '127.0.0.1', '--show-interactive-dev-session=false'],
    { cwd: ROOT, shell: true, stdio: ['ignore', 'pipe', 'pipe'] });
let log = '';
wrangler.stdout.on('data', d => { log += d; });
wrangler.stderr.on('data', d => { log += d; });
const stop = () => {
    // npx chạy wrangler, wrangler chạy workerd trong tiến trình con: dừng cả cây tiến trình, đợi xong mới thoát (thoát sớm
    // thì workerd còn giữ cổng)
    if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(wrangler.pid), '/T', '/F'], { stdio: 'ignore' });
    else spawnSync('pkill', ['-P', String(wrangler.pid)], { stdio: 'ignore' });
    wrangler.kill();
};

const results = [];
const check = (name, ok, info = '') => {
    results.push(ok);
    console.log(ok ? '  ✓' : '  ✗', name, ok ? '' : info);
};

let browser;
try {
    for (let i = 0; i < 240 && !/Ready on/.test(log); i++) await sleep(500);
    if (!/Ready on/.test(log)) throw new Error(`wrangler dev không chạy được:\n${log.slice(-2000)}`);
    browser = await launchBrowser();
    const ID = `zz_worker_${Date.now().toString(36)}`;
    const TITLE = 'Thử Cloudflare Worker';
    const page = async () => {
        const context = await browser.createBrowserContext();
        const p = await context.newPage();
        p.errors = [];
        p.on('pageerror', e => p.errors.push(e.message));
        return { context, p };
    };

    const { context, p: a } = await page();
    await a.goto(`${BASE}/builder`, { waitUntil: 'networkidle0' });
    await a.evaluate(() => editScript('christmas'));
    await sleep(2000);
    await a.evaluate((id, title) => {
        document.getElementById('filename').value = id;
        const input = document.getElementById('title');
        input.value = title;
        input.dispatchEvent(new Event('input', { bubbles: true }));
    }, ID, TITLE);
    await sleep(500);
    await a.evaluate(() => saveConfig());
    await a.waitForFunction(() => document.getElementById('share-link-input').value.includes('/s/'), { timeout: 30000 }).catch(() => {});
    const shareUrl = await a.$eval('#share-link-input', el => el.value);
    check('builder lưu lên Worker, link chia sẻ ngắn s/<tên>', shareUrl === `${BASE}/s/${ID}`, shareUrl);

    const html = await (await fetch(shareUrl)).text();
    const meta = name => (new RegExp(`${name}" content="([^"]+)"`).exec(html) || [])[1] || '';
    const ogImage = meta('og:image');
    check('trang chia sẻ có tiêu đề, ảnh thiệp riêng của kịch bản', meta('og:title') === TITLE && ogImage.startsWith(`${BASE}/configs/${ID}.jpg?v=`), html.slice(0, 300));
    const image = await fetch(ogImage);
    const bytes = new Uint8Array(await image.arrayBuffer());
    check('ảnh thiệp tải được (JPEG)', image.ok && image.headers.get('content-type') === 'image/jpeg' && bytes[0] === 0xFF && bytes[1] === 0xD8);

    const { context: other, p: b } = await page();
    await b.goto(shareUrl, { waitUntil: 'networkidle0' });
    const shown = await b.waitForFunction(t => document.title.includes(t), { timeout: 20000 }, TITLE).then(() => true, () => false);
    check('mở link ở trình duyệt khác: đúng kịch bản, không lỗi JS', shown && b.url().includes(`demo?config=${ID}`) && !b.errors.length, `${b.url()} ${b.errors.join(' | ')}`);
    await other.close();

    // Tải ảnh, nhạc lên như builder; file giả dạng ảnh
    const up = await a.evaluate(async id => {
        const send = async (api, field, file) => {
            const form = new FormData();
            form.append(field, file);
            form.append('filename', id);
            return (await fetch(api, { method: 'POST', body: form })).json();
        };
        const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='), c => c.charCodeAt(0));
        const n = 8000;
        const wav = new ArrayBuffer(44 + n);
        const v = new DataView(wav);
        const ascii = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
        ascii(0, 'RIFF'); v.setUint32(4, 36 + n, true); ascii(8, 'WAVE'); ascii(12, 'fmt '); v.setUint32(16, 16, true);
        v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 8000, true); v.setUint32(28, 8000, true);
        v.setUint16(32, 1, true); v.setUint16(34, 8, true); ascii(36, 'data'); v.setUint32(40, n, true);
        return {
            image: await send('api/upload_image.php', 'image', new File([png], 'anh.png')),
            audio: await send('api/upload_audio.php', 'audio', new File([wav], 'Bài hát thử.wav')),
            fake: await send('api/upload_image.php', 'image', new File(['<?php echo 1; ?>'], 'x.png'))
        };
    }, ID);
    check('tải ảnh, nhạc lên: trả đường dẫn uploads/, giữ tên bài', up.image.success && /^\.\/uploads\/zz_worker_\w+\/img_[a-f0-9]{16}\.png$/.test(up.image.url)
        && up.audio.success && /\.wav$/.test(up.audio.url) && up.audio.name === 'Bài hát thử.wav', JSON.stringify(up));
    check('file giả dạng ảnh bị từ chối', !up.fake.success, JSON.stringify(up.fake));
    const uploaded = await fetch(new URL(up.image.url, `${BASE}/builder`));
    check('ảnh đã tải lên đọc lại được đúng loại', uploaded.ok && uploaded.headers.get('content-type') === 'image/png');
    const part = await fetch(new URL(up.audio.url, `${BASE}/builder`), { headers: { range: 'bytes=100-199' } });
    check('nhạc tải từng đoạn (Range) để tua được', part.status === 206 && (await part.arrayBuffer()).byteLength === 100
        && part.headers.get('content-range') === 'bytes 100-199/8044', `${part.status} ${part.headers.get('content-range')}`);

    // Mã chủ: máy khác không lưu đè, không xóa được; báo mở quà; xóa bằng mã của máy đã tạo
    const api = (path, body) => fetch(`${BASE}/api/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json());
    const stranger = await api('save_config.php', { filename: ID, config: { title: 'Người lạ', events: [] } });
    const strangerDelete = await api('manage_configs.php?action=delete', { filename: ID, key: '0'.repeat(32) });
    check('máy khác không lưu đè, không xóa được kịch bản', stranger.code === 'not_owner' && strangerDelete.code === 'not_owner');
    const template = await api('save_config.php', { filename: 'christmas', config: { title: 'x', events: [] } });
    check('không ghi đè kịch bản mẫu', template.code === 'not_owner');
    const key = await a.evaluate(id => JSON.parse(localStorage.getItem('firework_owner_keys') || '{}')[id], ID);
    const notify = await api('save_config.php', { filename: ID, key, config: { title: TITLE, events: [{ burst: 1 }], notifyOpen: true } });
    const recorded = await api('opens.php?action=record', { id: ID, event: 'open', device: 'mobile' });
    const status = await api('opens.php?action=status', { items: [{ id: ID, key }, { id: ID, key: '0'.repeat(32) }] });
    check('báo mở quà: ghi lần mở, chỉ mã đúng mới xem được', notify.success && recorded.success && status.items[0].ok && status.items[0].counts.open === 1 && !status.items[1].ok,
        JSON.stringify(status));

    // Xem thử: kịch bản tạm trên máy chủ
    const opened = new Promise(resolve => context.on('targetchanged', t => { if (t.url().includes('/demo')) resolve(t.url()); }));
    await a.evaluate(() => previewConfig());
    const previewUrl = await Promise.race([opened, sleep(15000).then(() => '')]);
    check('Xem thử mở kịch bản tạm lưu trên máy chủ', /demo\?config=preview_temp_[a-f0-9]{16}$/.test(previewUrl), previewUrl);

    const removed = await api('manage_configs.php?action=delete', { filename: ID, key });
    const gone = await Promise.all([fetch(`${BASE}/configs/${ID}.json`), fetch(`${BASE}/configs/${ID}.jpg`)]);
    check('xóa kịch bản bằng mã của máy đã tạo: hết kịch bản, ảnh thiệp', removed.success && gone.every(r => r.status === 404));
    check('builder không lỗi JS', !a.errors.length, a.errors.join(' | '));
    await context.close();
} catch (e) {
    check('chạy hết', false, e.stack || e.message);
} finally {
    if (browser) await browser.close();
    stop();
}
const failed = results.filter(ok => !ok).length;
console.log(`\n${results.length - failed}/${results.length} kiểm tra đạt${failed ? `, ${failed} không đạt` : ''}.`);
process.exit(failed ? 1 : 0);
