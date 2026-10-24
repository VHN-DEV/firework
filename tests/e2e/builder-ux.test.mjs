/*!
 * Hanabi – kiểm thử tự động
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Builder dễ thao tác: tên file tự đặt theo Tiêu đề khi Lưu.
import fs from 'fs';
import path from 'path';
import { DIST, sleep, openPage, removeConfig } from './helpers.mjs';

// Tiêu đề riêng cho kiểm thử: tên file tự đặt không thể trùng kịch bản thật
const TITLE = 'Chúc mừng E2E Thử Tên';
const ID = 'chuc_mung_e2e_thu_ten';

export async function run(browser, base, { check }) {
    removeConfig(ID);
    const page = await openPage(browser, { width: 1440, height: 900 });
    try {
        await page.goto(base + '/builder', { waitUntil: 'networkidle0' });
        await page.evaluate(() => localStorage.clear());
        await page.reload({ waitUntil: 'networkidle0' });

        // Chưa đặt tên file: ô Tên file cho biết tên sẽ tự đặt, bấm Lưu thì lưu theo Tiêu đề (bỏ dấu)
        await page.$eval('#title', (i, t) => { i.value = t; i.dispatchEvent(new Event('input', { bubbles: true })); }, TITLE);
        const placeholder = await page.$eval('#filename', i => i.placeholder);
        await page.evaluate(() => saveConfig());
        await page.waitForFunction(() => !document.getElementById('share-modal').classList.contains('hide'), { timeout: 20000 }).catch(() => {});
        await page.evaluate(() => closeShareModal());
        const saved = await page.$eval('#filename', i => i.value);
        check('chưa đặt tên file: bấm Lưu tự đặt theo Tiêu đề, ô Tên file báo trước tên sẽ dùng',
            saved === ID && placeholder.includes(ID) && fs.existsSync(path.join(DIST, 'configs', `${ID}.json`)), JSON.stringify({ saved, placeholder }));

        check('builder (tinh chỉnh thao tác) không lỗi JS', page.errors.length === 0, page.errors.join(' | '));
    } finally {
        await page.close();
        removeConfig(ID);
    }
}
