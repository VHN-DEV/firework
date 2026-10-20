/*!
 * Trình diễn Pháo hoa – kiểm thử tự động
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Chạy toàn bộ kiểm thử trên bản build (dist): npm test (build rồi chạy) hoặc npm run test:e2e (dùng bản build sẵn).
// Cần PHP (lệnh php hoặc biến PHP_BIN) và Chrome (biến CHROME_PATH nếu không ở chỗ mặc định).
import fs from 'fs';
import path from 'path';
import { DIST, launchBrowser, startServer, createReporter } from './helpers.mjs';
import * as player from './player.test.mjs';
import * as builder from './builder.test.mjs';
import * as pages from './pages.test.mjs';
import * as beat from './beat.test.mjs';
import * as video from './video.test.mjs';
import * as gift from './gift.test.mjs';

if (!fs.existsSync(path.join(DIST, 'index.html'))) {
    console.error('Chưa có bản build: chạy "npm run build" trước (hoặc dùng "npm test").');
    process.exit(1);
}

const server = await startServer(Number(process.env.E2E_PORT) || 8790);
const browser = await launchBrowser();
const all = [];
let crashed = false;
try {
    for (const [name, suite] of [['Trình phát', player], ['Builder', builder], ['Xếp pháo theo nhịp nhạc', beat], ['Xuất video', video], ['Báo mở quà', gift], ['Trang & bản build', pages]]) {
        console.log(`\n${name}`);
        const reporter = createReporter(name);
        try {
            await suite.run(browser, server.base, reporter);
        } catch (e) {
            crashed = true;
            reporter.check('bộ kiểm thử chạy hết', false, e.stack || e.message);
        }
        all.push(...reporter.results);
    }
} finally {
    await browser.close();
    server.stop();
}

const failed = all.filter(r => !r.ok);
console.log(`\n${all.length - failed.length}/${all.length} kiểm tra đạt${failed.length ? `, ${failed.length} không đạt` : ''}.`);
process.exit(failed.length || crashed ? 1 : 0);
