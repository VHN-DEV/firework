/*!
 * Hanabi – kiểm thử tự động
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Phần máy chủ trên Cloudflare Workers (worker/, wrangler.jsonc), chạy tại máy bằng "wrangler dev" (D1, KV giả lập trong
// .wrangler/): builder lưu kịch bản kèm ảnh thiệp, link s/<tên> có ảnh, tiêu đề xem trước, mở ở trình duyệt khác đúng
// kịch bản, tải ảnh, nhạc lên rồi đọc lại (nhạc tải từng đoạn), file giả dạng ảnh bị từ chối, mã chủ khi lưu đè, xóa, báo
// mở quà, Xem thử, trình duyệt giữ được kịch bản, nhạc, trang chia sẻ (mở lại không tải lại), giới hạn số lần tải lên của mỗi máy, xóa kịch bản thì xóa ảnh, nhạc chỉ nó dùng, lần dọn hằng ngày
// xóa ảnh không kịch bản nào dùng. Mỗi lần chạy dùng dữ liệu mới (thư mục tạm). Cần bản build (npm run build) và mạng để npx tải wrangler lần đầu. Chạy: npm run test:worker
import { spawn, spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { DIST, ROOT, launchBrowser, sleep } from '../e2e/helpers.mjs';

if (!fs.existsSync(path.join(DIST, 'index.html'))) {
    console.error('Chưa có bản build: chạy "npm run build" trước.');
    process.exit(1);
}

const PORT = Number(process.env.WORKER_PORT) || 8798;
const BASE = `http://127.0.0.1:${PORT}`;
const STATE = fs.mkdtempSync(path.join(os.tmpdir(), 'hanabi-worker-'));
// --test-scheduled: gọi lần dọn hằng ngày qua /__scheduled; ORPHAN_DAYS=0: dọn cả ảnh vừa tải lên
const wrangler = spawn('npx', ['--yes', 'wrangler@4', 'dev', '--port', String(PORT), '--ip', '127.0.0.1', '--persist-to', `"${STATE}"`,
    '--test-scheduled', '--var', 'ORPHAN_DAYS:0', '--show-interactive-dev-session=false'],
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
    try {
        fs.rmSync(STATE, { recursive: true, force: true });
    } catch (e) {
        // workerd chưa nhả file: để thư mục tạm của hệ điều hành tự dọn
    }
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
    const musicTag = part.headers.get('etag');
    const musicAgain = await fetch(new URL(up.audio.url, `${BASE}/builder`), { headers: { 'if-none-match': musicTag || 'x' } });
    const shareCache = (await fetch(shareUrl)).headers.get('cache-control') || '';
    check('trình duyệt giữ được nhạc, trang chia sẻ: hỏi lại nhạc thì 304', !!musicTag && musicAgain.status === 304 && /max-age=3600/.test(shareCache),
        `${musicTag} ${musicAgain.status} ${shareCache}`);
    const configTag = (await fetch(`${BASE}/configs/${ID}.json`)).headers.get('etag');

    // Mã chủ: máy khác không lưu đè, không xóa được; báo mở quà; xóa bằng mã của máy đã tạo
    const api = (path, body) => fetch(`${BASE}/api/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json());
    const stranger = await api('save_config.php', { filename: ID, config: { title: 'Người lạ', events: [] } });
    const strangerDelete = await api('manage_configs.php?action=delete', { filename: ID, key: '0'.repeat(32) });
    check('máy khác không lưu đè, không xóa được kịch bản', stranger.code === 'not_owner' && strangerDelete.code === 'not_owner');
    const ownerKey = await a.evaluate(id => JSON.parse(localStorage.getItem('firework_owner_keys') || '{}')[id], ID);
    const lists = {
        owner: await api('manage_configs.php?action=list', { keys: { [ID]: ownerKey } }),
        stranger: await (await fetch(`${BASE}/api/manage_configs.php?action=list`)).json(),
        wrongKey: await api('manage_configs.php?action=list', { keys: { [ID]: '0'.repeat(32) } })
    };
    check('danh sách kịch bản: chỉ máy đã tạo (gửi mã) thấy, máy khác chỉ thấy kịch bản mẫu', lists.owner.some(s => s.id === ID && s.locked)
        && !lists.stranger.some(s => s.id === ID) && !lists.wrongKey.some(s => s.id === ID) && lists.stranger.every(s => s.status === 'private'),
        JSON.stringify({ owner: lists.owner.length, stranger: lists.stranger.map(s => s.id).filter(id => id.startsWith('zz')) }));
    const template = await api('save_config.php', { filename: 'christmas', config: { title: 'x', events: [] } });
    check('không ghi đè kịch bản mẫu', template.code === 'not_owner');
    const key = await a.evaluate(id => JSON.parse(localStorage.getItem('firework_owner_keys') || '{}')[id], ID);
    const notify = await api('save_config.php', { filename: ID, key, config: { title: TITLE, events: [{ burst: 1 }], notifyOpen: true } });
    const recorded = await api('opens.php?action=record', { id: ID, event: 'open', device: 'mobile' });
    const status = await api('opens.php?action=status', { items: [{ id: ID, key }, { id: ID, key: '0'.repeat(32) }] });
    check('báo mở quà: ghi lần mở, chỉ mã đúng mới xem được', notify.success && recorded.success && status.items[0].ok && status.items[0].counts.open === 1 && !status.items[1].ok,
        JSON.stringify(status));
    const changed = await fetch(`${BASE}/configs/${ID}.json`, { headers: { 'if-none-match': configTag || 'x' } });
    const newTag = changed.headers.get('etag');
    const same = await fetch(`${BASE}/configs/${ID}.json`, { headers: { 'if-none-match': newTag || 'x' } });
    check('kịch bản: lưu lại thì gửi bản mới, chưa đổi thì 304', !!configTag && changed.status === 200 && (await changed.json()).notifyOpen === true
        && newTag !== configTag && same.status === 304, `${configTag} ${changed.status} ${newTag} ${same.status}`);

    // Xem thử: kịch bản tạm trên máy chủ
    const opened = new Promise(resolve => context.on('targetchanged', t => { if (t.url().includes('/demo')) resolve(t.url()); }));
    await a.evaluate(() => previewConfig());
    const previewUrl = await Promise.race([opened, sleep(15000).then(() => '')]);
    check('Xem thử mở kịch bản tạm lưu trên máy chủ', /demo\?config=preview_temp_[a-f0-9]{16}$/.test(previewUrl), previewUrl);

    // Tải lên liên tục (ảnh đầu tiên dưới tên khác, không kịch bản nào dùng): tới giới hạn của máy thì bị chặn, có câu
    // báo thử lại sau bao lâu
    const flood = await a.evaluate(async id => {
        const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='), c => c.charCodeAt(0));
        const out = [];
        for (let i = 0; i < 25; i++) {
            const form = new FormData();
            form.append('image', new File([png], 'anh.png'));
            form.append('filename', i ? id : 'zz_orphan');
            const r = await (await fetch('api/upload_image.php', { method: 'POST', body: form })).json();
            out.push(r);
            if (!r.success) break;
        }
        return out;
    }, ID);
    const blocked = flood[flood.length - 1];
    check('tải lên quá nhiều lần thì bị chặn, báo thử lại sau', flood.length > 10 && blocked.code === 'rate_limited' && /thử lại sau \d+ phút/.test(blocked.message),
        JSON.stringify(blocked) + ` sau ${flood.length - 1} lần`);

    // Kịch bản khác dùng lại một ảnh của kịch bản này (như lưu thành bản mới)
    const copy = await api('save_config.php', { filename: `${ID}_ban`, config: { title: 'Bản sao', events: [{ burst: 1, imageUrl: up.image.url }] } });
    const status404 = async rel => (await fetch(new URL(rel, `${BASE}/builder`))).status;
    const removed = await api('manage_configs.php?action=delete', { filename: ID, key });
    const gone = await Promise.all([fetch(`${BASE}/configs/${ID}.json`), fetch(`${BASE}/configs/${ID}.jpg`)]);
    check('xóa kịch bản bằng mã của máy đã tạo: hết kịch bản, ảnh thiệp', removed.success && gone.every(r => r.status === 404));
    const after = { audio: await status404(up.audio.url), image: await status404(flood[1].url), shared: await status404(up.image.url), orphan: await status404(flood[0].url) };
    check('xóa kịch bản thì xóa ảnh, nhạc chỉ nó dùng, giữ ảnh kịch bản khác còn dùng', copy.success && after.audio === 404 && after.image === 404
        && after.shared === 200 && after.orphan === 200, JSON.stringify(after));

    // Lần dọn hằng ngày: ảnh không kịch bản nào dùng bị xóa, ảnh còn dùng giữ lại
    await sleep(1100);
    const cron = await fetch(`${BASE}/__scheduled?cron=5+0+*+*+*`);
    await sleep(500);
    const swept = { orphan: await status404(flood[0].url), shared: await status404(up.image.url) };
    check('lần dọn hằng ngày xóa ảnh không kịch bản nào dùng', cron.ok && swept.orphan === 404 && swept.shared === 200, `${cron.status} ${JSON.stringify(swept)}`);
    const removedCopy = await api('manage_configs.php?action=delete', { filename: `${ID}_ban`, key: copy.trackKey });
    check('xóa nốt kịch bản dùng lại ảnh thì ảnh mất theo', removedCopy.success && await status404(up.image.url) === 404);
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
