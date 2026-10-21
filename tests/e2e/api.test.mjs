/*!
 * Trình diễn Pháo hoa – kiểm thử tự động
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// API máy chủ: lưu, liệt kê, xóa kịch bản không bị khóa giả, dữ liệu sai kiểu hay lỗi giữa chừng làm hỏng
import fs from 'fs';
import path from 'path';
import { DIST, writeConfig, removeConfig } from './helpers.mjs';

export async function run(browser, base, { check }) {
    const post = async (url, body) => {
        const res = await fetch(base + url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) });
        const text = await res.text();
        try {
            return JSON.parse(text);
        } catch (e) {
            return { raw: text };
        }
    };
    const file = id => path.join(DIST, 'configs', `${id}.json`);
    const read = id => (fs.existsSync(file(id)) ? JSON.parse(fs.readFileSync(file(id), 'utf8')) : null);

    try {
        // Trình duyệt gửi status "private": không khóa được kịch bản, lần sau vẫn lưu và xóa được
        const first = await post('/api/save_config.php', { filename: 'zz_e2e_api', config: { status: 'private', title: 'API', events: [] } });
        const again = await post('/api/save_config.php', { filename: 'zz_e2e_api', config: { status: 'private', title: 'API 2', events: [] } });
        check('lưu kịch bản: không nhận "riêng tư" từ trình duyệt, lưu lại được',
            first.success && again.success && read('zz_e2e_api')?.title === 'API 2' && !('status' in read('zz_e2e_api')),
            JSON.stringify({ first: first.message, again: again.message, saved: read('zz_e2e_api') }));
        check('kịch bản mới được cấp mã theo dõi, lưu lại thì không cấp nữa', /^[a-f0-9]{32}$/.test(first.trackKey || '') && !again.trackKey);

        // Lỗi mã hóa (số vô cực) không ghi đè làm mất kịch bản đang có
        const broken = await post('/api/save_config.php', '{"filename":"zz_e2e_api","config":{"title":"x","events":[],"n":1e400}}');
        check('lưu thất bại giữa chừng không làm hỏng kịch bản đang có', !broken.success && read('zz_e2e_api')?.title === 'API 2', JSON.stringify(broken));

        // Kịch bản sai kiểu: không lưu; file sai kiểu có sẵn không làm hỏng danh sách
        const wrong = await post('/api/save_config.php', { filename: 'zz_e2e_api_bad', config: { events: 5 } });
        writeConfig('zz_e2e_api_odd', { title: ['x'], events: 5 });
        const list = await (await fetch(base + '/api/manage_configs.php?action=list')).json().catch(() => null);
        const odd = Array.isArray(list) && list.find(s => s.id === 'zz_e2e_api_odd');
        check('kịch bản sai kiểu bị từ chối, file hỏng không làm hỏng danh sách',
            !wrong.success && !fs.existsSync(file('zz_e2e_api_bad')) && odd && odd.eventCount === 0 && odd.title === 'zz_e2e_api_odd', JSON.stringify(odd));

        // Kịch bản có từ trước mà chưa có mã theo dõi: người lưu đè không lấy được mã
        writeConfig('zz_e2e_api_old', { title: 'Cũ', events: [] });
        const takeover = await post('/api/save_config.php', { filename: 'zz_e2e_api_old', config: { title: 'Đè', events: [] } });
        check('lưu đè kịch bản cũ chưa có mã theo dõi thì không được cấp mã', takeover.success && !takeover.trackKey, JSON.stringify(takeover));

        // Trang chia sẻ: tiêu đề sai kiểu không in "Array" hay cảnh báo PHP
        writeConfig('zz_e2e_api_share', { seoTitle: ['x'], title: 'Tiêu đề đúng', subtitle: ['y'], events: [] });
        const share = await (await fetch(`${base}/s/zz_e2e_api_share.html`)).text();
        check('trang chia sẻ bỏ qua giá trị sai kiểu', share.includes('<title>Tiêu đề đúng</title>') && !/Array|Warning|Notice/.test(share));

        // Dữ liệu báo mở quà không tải được bằng đường dẫn biến thể
        const codes = await Promise.all(['/api/%64ata/owners/zz_e2e_api.json', '//api/data/owners/zz_e2e_api.json', '/API/data/owners/zz_e2e_api.json',
            '/api/./data/owners/zz_e2e_api.json'].map(async url => (await fetch(base + url)).status));
        check('dữ liệu báo mở quà bị chặn cả với đường dẫn biến thể', codes.every(c => c === 403), codes.join(', '));

        const removed = await post('/api/manage_configs.php?action=delete', { filename: 'zz_e2e_api' });
        check('xóa được kịch bản từng gửi kèm "riêng tư"', removed.success && !fs.existsSync(file('zz_e2e_api')), JSON.stringify(removed));
    } finally {
        for (const id of ['zz_e2e_api', 'zz_e2e_api_bad', 'zz_e2e_api_odd', 'zz_e2e_api_old', 'zz_e2e_api_share']) {
            removeConfig(id);
            for (const kind of ['owners', 'opens']) fs.rmSync(path.join(DIST, 'api/data', kind, `${id}.json`), { force: true });
        }
    }
}
