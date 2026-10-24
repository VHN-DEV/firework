/*!
 * Hanabi – kiểm thử tự động
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Phần máy chủ trên Cloudflare Workers (worker/, wrangler.jsonc), chạy tại máy bằng "wrangler dev" (D1, KV giả lập trong
// .wrangler/): builder lưu kịch bản kèm ảnh thiệp, link s/<tên> có ảnh, tiêu đề xem trước, mở ở trình duyệt khác đúng
// kịch bản, tải ảnh, nhạc lên rồi đọc lại (nhạc tải từng đoạn), file giả dạng ảnh bị từ chối, mã chủ khi lưu đè, xóa, báo
// mở quà, Xem thử, trình duyệt giữ được kịch bản, nhạc, trang chia sẻ (mở lại không tải lại), giới hạn số lần tải lên của mỗi máy, xóa kịch bản thì xóa ảnh, nhạc chỉ nó dùng, lần dọn hằng ngày
// xóa ảnh không kịch bản nào dùng, đăng nhập Google (khóa giả thay Google: mã đăng nhập do kiểm thử tự ký) giữ kịch bản
// trên máy khác, trang quản trị (chỉ email quản trị vào được; xem, xóa kịch bản; khóa, xóa người dùng; kho nhạc; lời cảm
// ơn gom theo kịch bản; hạn mức Cloudflare đọc từ GraphQL giả). Mỗi lần chạy dùng dữ liệu mới (thư mục tạm). Cần bản build (npm run build) và mạng để npx tải wrangler lần đầu. Chạy: npm run test:worker
import { spawn, spawnSync } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import http from 'http';
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

// "Google" giả: khóa công khai ở http://127.0.0.1:<cổng>/certs (Worker đọc qua GOOGLE_CERTS_URL), mã đăng nhập tự ký
const CLIENT_ID = 'hanabi-test';
const ADMIN_EMAIL = 'quantri@example.com';
const CERTS_PORT = PORT - 3;
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'hanabi-test', alg: 'RS256', use: 'sig' };
// Cùng máy chủ giả trả số liệu Cloudflare (GraphQL) cho trang quản trị: một nhóm báo lỗi để thấy nhóm khác vẫn hiện
const CF_ACCOUNT = 'a'.repeat(32);
const today = new Date().toISOString().slice(0, 10);
const GRAPHQL = {
    workersInvocationsAdaptive: [{ sum: { requests: 1200, errors: 3 } }, { sum: { requests: 34, errors: 0 } }],
    d1AnalyticsAdaptiveGroups: [{ sum: { readQueries: 90, writeQueries: 9, rowsRead: 5000, rowsWritten: 70 } }],
    kvOperationsAdaptiveGroups: [{ sum: { requests: 40 }, dimensions: { actionType: 'read' } }, { sum: { requests: 5 }, dimensions: { actionType: 'write' } }],
    kvStorageAdaptiveGroups: [{ max: { byteCount: 2048, keyCount: 3 }, dimensions: { date: today, namespaceId: 'n1' } },
        { max: { byteCount: 1024, keyCount: 2 }, dimensions: { date: '2000-01-01', namespaceId: 'n1' } }]
};
const certs = http.createServer((req, res) => {
    if (req.url !== '/graphql') {
        res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'public, max-age=3600' });
        res.end(JSON.stringify({ keys: [jwk] }));
        return;
    }
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
        const query = JSON.parse(body).query;
        const name = Object.keys(GRAPHQL).find(key => query.includes(key));
        const authorized = req.headers.authorization === 'Bearer cf-test-token' && query.includes(CF_ACCOUNT);
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify(!authorized ? { data: null, errors: [{ message: 'not authorized' }] }
            : name ? { data: { viewer: { accounts: [{ [name]: GRAPHQL[name] }] } }, errors: null }
                : { data: null, errors: [{ message: 'unknown field "databaseSizeBytes"' }] }));
    });
}).listen(CERTS_PORT, '127.0.0.1');
const base64url = obj => Buffer.from(JSON.stringify(obj)).toString('base64url');
const googleToken = (claims = {}) => {
    const head = base64url({ alg: 'RS256', kid: 'hanabi-test', typ: 'JWT' });
    const body = base64url({
        iss: 'https://accounts.google.com', aud: CLIENT_ID, sub: '1000001', email: 'khach@example.com', email_verified: true,
        name: 'Khách Thử', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600, ...claims
    });
    return `${head}.${body}.${crypto.sign('RSA-SHA256', Buffer.from(`${head}.${body}`), privateKey).toString('base64url')}`;
};

// --test-scheduled: gọi lần dọn hằng ngày qua /__scheduled; ORPHAN_DAYS=0: dọn cả ảnh vừa tải lên
const wrangler = spawn('npx', ['--yes', 'wrangler@4', 'dev', '--port', String(PORT), '--ip', '127.0.0.1', '--persist-to', `"${STATE}"`,
    '--test-scheduled', '--var', 'ORPHAN_DAYS:0', '--var', `GOOGLE_CLIENT_ID:${CLIENT_ID}`, '--var', `GOOGLE_CERTS_URL:http://127.0.0.1:${CERTS_PORT}/certs`,
    '--var', `ADMIN_EMAILS:${ADMIN_EMAIL}`, '--var', `CF_ACCOUNT_ID:${CF_ACCOUNT}`, '--var', 'CF_API_TOKEN:cf-test-token',
    '--var', `CF_GRAPHQL_URL:http://127.0.0.1:${CERTS_PORT}/graphql`,
    '--show-interactive-dev-session=false'],
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
    certs.close();
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

    // Đăng nhập Google: máy A (đã tạo kịch bản) đăng nhập, máy B đăng nhập cùng tài khoản thì có lại kịch bản, lưu kịch bản
    // mới ở B thì A cũng có; mã sai bị từ chối; đăng xuất ở B thì B không còn kịch bản; xóa tài khoản thì A vẫn giữ mã
    const bad = {
        audience: await api('account.php?action=login', { credential: googleToken({ aud: 'trang-khac' }) }),
        expired: await api('account.php?action=login', { credential: googleToken({ exp: Math.floor(Date.now() / 1000) - 10 }) }),
        forged: await api('account.php?action=login', { credential: googleToken().replace(/.{8}$/, 'AAAAAAAA') })
    };
    check('đăng nhập: mã của trang khác, hết hạn, sai chữ ký bị từ chối', Object.values(bad).every(r => !r.success && !r.user), JSON.stringify(bad));
    const loggedA = await a.evaluate(token => accountLogin(token), googleToken());
    const headerA = await a.$eval('#btn-account', b => ({ shown: !b.classList.contains('hide'), signedIn: b.classList.contains('signed-in') }));
    const { context: deviceB, p: pb } = await page();
    await pb.goto(`${BASE}/builder`, { waitUntil: 'networkidle0' });
    await pb.waitForFunction(() => !document.getElementById('btn-account').classList.contains('hide'), { timeout: 10000 }).catch(() => {});
    const beforeB = await pb.evaluate(id => ({ shown: !document.getElementById('btn-account').classList.contains('hide'), key: JSON.parse(localStorage.getItem('firework_owner_keys') || '{}')[id] }), ID);
    const loggedB = await pb.evaluate(token => accountLogin(token), googleToken());
    const afterB = await pb.evaluate(id => JSON.parse(localStorage.getItem('firework_owner_keys') || '{}')[id], ID);
    await pb.evaluate(() => openScriptsModal());
    await pb.waitForSelector(`#scripts-list [data-panel="mine"] .script-item[data-id="${ID}"]`, { timeout: 10000 }).catch(() => {});
    const listedB = !!(await pb.$(`#scripts-list [data-panel="mine"] .script-item[data-id="${ID}"]`));
    check('đăng nhập ở máy khác: có lại kịch bản (Của tôi, mã sửa, xóa, Báo mở quà)', loggedA && headerA.shown && headerA.signedIn && beforeB.shown && !beforeB.key
        && loggedB && afterB === ownerKey && listedB, JSON.stringify({ loggedA, headerA, beforeB, loggedB, same: afterB === ownerKey, listedB }));
    const NEW_ID = `${ID}_b`;
    const savedB = await pb.evaluate(id => fetch('api/save_config.php', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: id, config: { title: 'Lưu ở máy B', events: [] } }) }).then(r => r.json()), NEW_ID);
    await a.reload({ waitUntil: 'networkidle0' });
    await a.waitForFunction(id => JSON.parse(localStorage.getItem('firework_owner_keys') || '{}')[id], { timeout: 10000 }, NEW_ID).catch(() => {});
    const syncedA = await a.evaluate(id => JSON.parse(localStorage.getItem('firework_owner_keys') || '{}')[id], NEW_ID);
    check('lưu kịch bản mới ở máy B thì máy A (cùng tài khoản) cũng sửa được', !!savedB.trackKey && syncedA === savedB.trackKey, JSON.stringify({ savedB, syncedA }));
    await pb.evaluate(() => accountLogout());
    const outB = await pb.evaluate((id, other) => {
        const keys = JSON.parse(localStorage.getItem('firework_owner_keys') || '{}');
        return { key: keys[id], other: keys[other], signedIn: document.getElementById('btn-account').classList.contains('signed-in') };
    }, ID, NEW_ID);
    const meB = await pb.evaluate(() => fetch('api/account.php?action=me', { method: 'POST', body: '{}' }).then(r => r.json()));
    check('đăng xuất: máy đó không còn mã của các kịch bản trong tài khoản', !outB.key && !outB.other && !outB.signedIn && !meB.user, JSON.stringify({ outB, meB: meB.user }));
    await deviceB.close();
    await a.evaluate(() => accountDelete());
    await a.click('#btn-confirm-yes');
    await sleep(800);
    const meA = await a.evaluate(() => fetch('api/account.php?action=me', { method: 'POST', body: '{}' }).then(r => r.json()));
    const keptA = await a.evaluate(id => JSON.parse(localStorage.getItem('firework_owner_keys') || '{}')[id], ID);
    const again = await api('account.php?action=login', { credential: googleToken() });
    check('xóa tài khoản: đăng xuất, máy này vẫn giữ mã; đăng nhập lại là tài khoản mới, trống', !meA.user && keptA === ownerKey && again.success
        && !Object.keys(again.keys).length, JSON.stringify({ me: meA.user, kept: keptA === ownerKey, keys: again.keys }));
    const template = await api('save_config.php', { filename: 'christmas', config: { title: 'x', events: [] } });
    check('không ghi đè kịch bản mẫu', template.code === 'not_owner');
    const key = await a.evaluate(id => JSON.parse(localStorage.getItem('firework_owner_keys') || '{}')[id], ID);
    const notify = await api('save_config.php', { filename: ID, key, config: { title: TITLE, events: [{ burst: 1 }], notifyOpen: true } });
    const recorded = await api('opens.php?action=record', { id: ID, event: 'open', device: 'mobile' });
    const status = await api('opens.php?action=status', { items: [{ id: ID, key }, { id: ID, key: '0'.repeat(32) }] });
    check('báo mở quà: ghi lần mở, chỉ mã đúng mới xem được', notify.success && recorded.success && status.items[0].ok && status.items[0].counts.open === 1 && !status.items[1].ok,
        JSON.stringify(status));
    const replies = {
        sent: await api('opens.php?action=reply', { id: ID, name: 'Mẹ', message: '  Cảm ơn con!\nMẹ vui lắm.  ' }),
        empty: await api('opens.php?action=reply', { id: ID, message: '   ' }),
        long: await api('opens.php?action=reply', { id: ID, message: 'x'.repeat(501) })
    };
    const withReply = (await api('opens.php?action=status', { items: [{ id: ID, key }] })).items[0];
    const closed = await api('save_config.php', { filename: `${ID}_kin`, config: { title: 'Kín', events: [], allowReply: false } });
    const refused = await api('opens.php?action=reply', { id: `${ID}_kin`, message: 'Cảm ơn' });
    check('lời cảm ơn: gửi được, người tặng đọc trong trạng thái; lời trống, quá dài, kịch bản tắt nhận lời cảm ơn bị từ chối',
        replies.sent.success && withReply.replies.length === 1 && withReply.replies[0].message === 'Cảm ơn con!\nMẹ vui lắm.'
        && withReply.replies[0].name === 'Mẹ' && !replies.empty.success && !replies.long.success && closed.success && !refused.success,
        JSON.stringify({ replies, got: withReply.replies, refused }));
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

    // Trang quản trị: phiên đăng nhập lấy từ cookie trả về khi đăng nhập
    const loginAs = async claims => {
        const response = await fetch(`${BASE}/api/account.php?action=login`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ credential: googleToken(claims), keys: {} }) });
        return { cookie: (response.headers.get('set-cookie') || '').split(';')[0], data: await response.json() };
    };
    const call = (cookie, path, body = {}) => fetch(`${BASE}/api/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', cookie },
        body: JSON.stringify(body) }).then(async r => ({ status: r.status, ...(await r.json()) }));
    const adm = await loginAs({ sub: '2000002', email: ADMIN_EMAIL, name: 'Quản trị' });
    const guest = await loginAs({ sub: '3000003', email: 'nguoidung@example.com', name: 'Người dùng' });
    const gates = { anonymous: await call('', 'admin.php?action=overview'), guest: await call(guest.cookie, 'admin.php?action=overview') };
    const overview = await call(adm.cookie, 'admin.php?action=overview');
    check('quản trị: chưa đăng nhập, tài khoản thường bị chặn; email quản trị vào được', gates.anonymous.status === 401 && gates.guest.status === 403
        && overview.success && overview.counts.users >= 2, JSON.stringify({ gates: [gates.anonymous.status, gates.guest.status], counts: overview.counts }));

    const GUEST_ID = `${ID}_khach`;
    const guestSave = await call(guest.cookie, 'save_config.php', { filename: GUEST_ID, config: { title: 'Quà của khách', author: 'Khách', events: [{ burst: 1 }] } });
    const guestId = (await call(adm.cookie, 'admin.php?action=users', { q: 'nguoidung' })).items[0];
    const found = await call(adm.cookie, 'admin.php?action=scripts', { q: 'quà của' });
    const byUser = await call(adm.cookie, 'admin.php?action=scripts', { user: guestId.id });
    const detail = await call(adm.cookie, 'admin.php?action=script', { id: GUEST_ID });
    check('quản trị: tìm kịch bản, lọc theo người dùng, xem chi tiết (tài khoản sở hữu)', guestSave.success && found.items.some(s => s.id === GUEST_ID)
        && byUser.items.length === 1 && byUser.items[0].owners === 'nguoidung@example.com' && detail.config.title === 'Quà của khách'
        && detail.owners[0].email === 'nguoidung@example.com', JSON.stringify({ found: found.total, byUser: byUser.items.map(s => s.id), owners: detail.owners }));

    const lock = await call(adm.cookie, 'admin.php?action=lockUser', { id: guestId.id, locked: true });
    const lockedMe = await call(guest.cookie, 'account.php?action=me');
    const lockedLogin = await loginAs({ sub: '3000003', email: 'nguoidung@example.com' });
    const lockSelf = await call(adm.cookie, 'admin.php?action=lockUser', { id: 'google:2000002', locked: true });
    await call(adm.cookie, 'admin.php?action=lockUser', { id: guestId.id, locked: false });
    const relogin = await loginAs({ sub: '3000003', email: 'nguoidung@example.com' });
    check('quản trị: khóa thì người dùng bị đăng xuất, không đăng nhập lại được; mở khóa thì được; không tự khóa mình', lock.success && !lockedMe.user
        && lockedLogin.data.code === 'locked' && !lockSelf.success && relogin.data.success, JSON.stringify({ me: lockedMe.user, login: lockedLogin.data, self: lockSelf.message }));

    // Kho nhạc: thêm bài (WAV tự tạo), ẩn bài có sẵn, đổi tên, xóa
    const n = 16000;
    const wav = Buffer.alloc(44 + n, 128);
    wav.write('RIFF', 0); wav.writeUInt32LE(36 + n, 4); wav.write('WAVE', 8); wav.write('fmt ', 12); wav.writeUInt32LE(16, 16);
    wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(8000, 28); wav.writeUInt16LE(1, 32);
    wav.writeUInt16LE(8, 34); wav.write('data', 36); wav.writeUInt32LE(n, 40);
    const form = new FormData();
    form.append('kind', 'music');
    form.append('file', new Blob([wav]), 'bai-thu.wav');
    form.append('name', 'Bài thử quản trị');
    form.append('tags', 'Thử, Vui tươi');
    form.append('duration', '2');
    const added = await fetch(`${BASE}/api/admin.php?action=libraryAdd`, { method: 'POST', headers: { cookie: adm.cookie }, body: form }).then(r => r.json());
    const guestAdd = await fetch(`${BASE}/api/admin.php?action=libraryAdd`, { method: 'POST', headers: { cookie: relogin.cookie }, body: form });
    const index = async () => (await fetch(`${BASE}/library/music/index.json`)).json();
    const builtIn = (await index()).find(item => item.id === 'happy-birthday');
    await call(adm.cookie, 'admin.php?action=libraryUpdate', { kind: 'music', id: 'happy-birthday', hidden: true });
    await call(adm.cookie, 'admin.php?action=libraryUpdate', { kind: 'music', id: added.item.id, name: 'Bài thử đã đổi tên', tags: 'Thử' });
    const afterEdit = await index();
    const file = await fetch(`${BASE}/library/music/${added.item.file}`);
    check('quản trị kho nhạc: thêm bài (builder thấy, phát được), ẩn bài có sẵn, đổi tên; tài khoản thường không thêm được',
        added.success && guestAdd.status === 403 && !!builtIn && !afterEdit.some(item => item.id === 'happy-birthday')
        && afterEdit.find(item => item.id === added.item.id)?.name === 'Bài thử đã đổi tên' && file.ok && file.headers.get('content-type') === 'audio/wav',
        JSON.stringify({ added, ids: afterEdit.map(item => item.id) }));
    await call(adm.cookie, 'admin.php?action=libraryUpdate', { kind: 'music', id: 'happy-birthday', hidden: false });
    const removedItem = await call(adm.cookie, 'admin.php?action=libraryDelete', { kind: 'music', id: added.item.id });
    const builtInDelete = await call(adm.cookie, 'admin.php?action=libraryDelete', { kind: 'music', id: 'happy-birthday' });
    const finalIndex = await index();
    check('quản trị kho nhạc: hiện lại bài có sẵn, xóa bài tự thêm (hết file); bài có sẵn không xóa được', removedItem.success && !builtInDelete.success
        && finalIndex.some(item => item.id === 'happy-birthday') && !finalIndex.some(item => item.id === added.item.id)
        && (await fetch(`${BASE}/library/music/${added.item.file}`)).status === 404, JSON.stringify({ removedItem, builtInDelete: builtInDelete.message }));

    // Lời cảm ơn: xem, xóa; xóa người dùng kèm kịch bản
    await api('opens.php?action=reply', { id: GUEST_ID, name: 'Bạn', message: 'Lời cần xóa' });
    const adminReplies = await call(adm.cookie, 'admin.php?action=replies');
    const group = adminReplies.items.find(g => g.id === GUEST_ID) || { replies: [] };
    const reply = group.replies.find(r => r.message === 'Lời cần xóa');
    await call(adm.cookie, 'admin.php?action=deleteReply', { n: reply && reply.n });
    const repliesAfter = await call(adm.cookie, 'admin.php?action=replies');
    const removedUser = await call(adm.cookie, 'admin.php?action=deleteUser', { id: guestId.id, scripts: true });
    const usersAfter = await call(adm.cookie, 'admin.php?action=users');
    check('quản trị: lời cảm ơn gom theo kịch bản (ai tặng, tài khoản), xóa được; xóa người dùng kèm kịch bản của họ', !!reply
        && group.title === 'Quà của khách' && group.author === 'Khách' && group.owners === 'nguoidung@example.com'
        && !repliesAfter.items.some(g => g.replies.some(r => r.message === 'Lời cần xóa')) && removedUser.success && !usersAfter.items.some(u => u.email === 'nguoidung@example.com')
        && (await fetch(`${BASE}/configs/${GUEST_ID}.json`)).status === 404, JSON.stringify({ group, removedUser }));

    const usage = await call(adm.cookie, 'admin.php?action=usage');
    const used = Object.fromEntries((usage.items || []).map(item => [item.key, item.used]));
    const guestUsage = await call((await loginAs({ sub: '4000004', email: 'khac@example.com' })).cookie, 'admin.php?action=usage');
    check('quản trị: hạn mức Cloudflare hôm nay (lượt gọi, D1, KV, dung lượng); nhóm lỗi chỉ báo nhóm đó; tài khoản thường không xem được',
        usage.configured && used.requests === 1234 && used.d1RowsRead === 5000 && used.d1RowsWritten === 70 && used.kvRead === 40
        && used.kvWrite === 5 && used.kvStorage === 2048 && used.d1Storage === null && guestUsage.status === 403, JSON.stringify(usage));

    // Trang /admin trong trình duyệt: email quản trị thấy các mục; tài khoản thường chỉ thấy lời báo không có quyền
    const { context: adminCtx, p: adminPage } = await page();
    await adminPage.setViewport({ width: 1366, height: 900 });
    await adminPage.goto(`${BASE}/admin`, { waitUntil: 'networkidle0' });
    const gateText = await adminPage.$eval('#gate-message', e => e.textContent);
    await adminPage.evaluate(token => fetch('api/account.php?action=login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: token, keys: {} }) }), googleToken({ sub: '2000002', email: ADMIN_EMAIL }));
    await adminPage.reload({ waitUntil: 'networkidle0' });
    await adminPage.waitForSelector('.kpi', { timeout: 10000 }).catch(() => {});
    await adminPage.waitForSelector('#usage .meter', { timeout: 10000 }).catch(() => {});
    const stats = await adminPage.$$eval('.kpi', els => els.length);
    const meters = await adminPage.$$eval('#usage .meter', els => els.length);
    await adminPage.click('[data-tab="scripts"]');
    await adminPage.waitForSelector('#panel tbody tr', { timeout: 10000 }).catch(() => {});
    const scriptRows = await adminPage.$$eval('#panel tbody tr', els => els.length);
    // Chi tiết kịch bản -> Xóa kịch bản -> hộp hỏi lại (không bấm Xóa)
    await adminPage.click('#panel [data-action="detail"]');
    await adminPage.waitForSelector('#modal[open] [data-modal-action="delete"]', { timeout: 5000 }).catch(() => {});
    await adminPage.click('#modal [data-modal-action="delete"]');
    await adminPage.waitForSelector('#modal[open] [data-modal-action="ok"]', { timeout: 5000 }).catch(() => {});
    await sleep(300);
    const confirmTitle = await adminPage.$eval('#modal[open] #modal-title', el => el.textContent).catch(() => '');
    await adminPage.click('#modal [data-modal-action="cancel"]');
    await adminPage.click('[data-tab="music"]');
    await adminPage.waitForSelector('#panel tbody tr', { timeout: 10000 }).catch(() => {});
    const musicRows = await adminPage.$$eval('#panel tbody tr', els => els.length);
    check('trang /admin: chưa đăng nhập thì mời đăng nhập; quản trị thấy Bảng điều khiển (số liệu, hạn mức Cloudflare), Kịch bản (hỏi lại trước khi xóa), Kho nhạc, không lỗi JS',
        /Đăng nhập/.test(gateText) && stats === 4 && meters === 9 && scriptRows > 0 && confirmTitle === 'Xóa kịch bản?'
        && musicRows === JSON.parse(fs.readFileSync(path.join(DIST, 'library/music/index.json'), 'utf8')).length && !adminPage.errors.length,
        JSON.stringify({ gateText, stats, meters, scriptRows, confirmTitle, musicRows, errors: adminPage.errors }));
    await adminCtx.close();
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
