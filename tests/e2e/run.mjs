/*!
 * Hanabi – kiểm thử tự động
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
import * as builderUx from './builder-ux.test.mjs';
import * as pages from './pages.test.mjs';
import * as beat from './beat.test.mjs';
import * as video from './video.test.mjs';
import * as gift from './gift.test.mjs';
import * as viewerShare from './viewer-share.test.mjs';
import * as api from './api.test.mjs';
import * as screenTheme from './screen-theme.test.mjs';
import * as bankStyles from './bank-styles.test.mjs';
import * as seasons from './seasons.test.mjs';
import * as startFrames from './start-frames.test.mjs';
import * as natureSound from './nature-sound.test.mjs';
import * as nightSky from './night-sky.test.mjs';
import * as people from './people.test.mjs';
import * as staticShare from './static-share.test.mjs';
import * as landing from './landing.test.mjs';

if (!fs.existsSync(path.join(DIST, 'index.html'))) {
    console.error('Chưa có bản build: chạy "npm run build" trước (hoặc dùng "npm test").');
    process.exit(1);
}

const server = await startServer(Number(process.env.E2E_PORT) || 8790);
const browser = await launchBrowser();
const all = [];
let crashed = false;
try {
    for (const [name, suite] of [['Trình phát', player], ['Builder', builder], ['Builder dễ thao tác', builderUx], ['Xếp pháo theo nhịp nhạc', beat], ['Xuất video', video], ['Người nhận chụp, chia sẻ, tạo video', viewerShare], ['Báo mở quà', gift], ['Giao diện màn mở quà, màn kết', screenTheme], ['Kiểu bờ bên kia mặt nước', bankStyles], ['Mùa, thời tiết', seasons], ['Khung bắt đầu', startFrames], ['Âm thanh thiên nhiên', natureSound], ['Bầu trời sao', nightSky], ['Người ngắm pháo', people], ['Chia sẻ trên trang tĩnh (GitHub Pages)', staticShare], ['API máy chủ', api], ['Trang chủ', landing], ['Trang & bản build', pages]]) {
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
