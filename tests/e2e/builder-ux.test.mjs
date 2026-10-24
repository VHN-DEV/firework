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

        // Danh sách phát bắn như người tạo thấy: loại pháo, vị trí, thời điểm của từng dòng
        const rows = () => page.$$eval('.shot-row', list => list.map(row => {
            const [x, y] = row.querySelector('.fa-location-dot')?.parentElement.textContent.split(',').map(Number) || [];
            const when = row.querySelector('.fa-clock')?.parentElement.textContent.trim();
            return { id: Number(row.dataset.id), shell: row.querySelector('.shot-title').childNodes[2]?.textContent.trim(), x, y, when };
        }));
        // Phát mới giống phát đang chọn (Liễu, cỡ, độ cao), đặt vào chỗ trống của đợt, nổ sau một nhịp; không chồng lên nhau
        const first = (await rows())[0].id;
        await page.evaluate(id => {
            selectEvent(id);
            updateEvent(id, 'shell', 'Liễu');
            updateEvent(id, 'x', 22);
            updateEvent(id, 'y', 60);
        }, first);
        await page.evaluate(() => addEventFromUI());
        await sleep(300);
        const added = (await rows())[1];
        check('thêm phát bắn: giống phát đang chọn, cùng độ cao, đặt chỗ trống của đợt, nổ sau một nhịp',
            added && added.shell === 'Liễu' && added.y === 60 && Math.abs(added.x - 22) >= 15 && added.when === '+250 ms', JSON.stringify(added));
        // Nhân bản: bản sao đối xứng sang bên kia (22 -> 78), không nổ chồng lên phát gốc
        await page.evaluate(id => duplicateEvent(id), first);
        await sleep(300);
        const copy = (await rows())[1];
        check('nhân bản phát bắn: bản sao đặt đối xứng sang bên kia, cùng độ cao, cùng thời điểm',
            copy && copy.shell === 'Liễu' && copy.x === 78 && copy.y === 60 && copy.when === 'Ngay', JSON.stringify(copy));

        check('builder (tinh chỉnh thao tác) không lỗi JS', page.errors.length === 0, page.errors.join(' | '));
    } finally {
        await page.close();
        removeConfig(ID);
    }
}
