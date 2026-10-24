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

        // Phím tắt với phát đang chọn: Ctrl+D nhân bản, Delete xóa
        const shortcut = async (key, ctrl) => {
            if (ctrl) await page.keyboard.down('Control');
            await page.keyboard.press(key);
            if (ctrl) await page.keyboard.up('Control');
            await sleep(300);
            return (await rows()).length;
        };
        await page.click(`.shot-row[data-id="${first}"]`);
        await sleep(200);
        const count0 = (await rows()).length;
        const afterCopy = await shortcut('d', true);
        const afterDelete = await shortcut('Delete', false);
        check('phím tắt: Ctrl+D nhân bản, Delete xóa phát đang chọn', afterCopy === count0 + 1 && afterDelete === count0, `${count0} → ${afterCopy} → ${afterDelete}`);

        // Esc đóng hộp thoại: Tạo màn trình diễn mới; Ctrl+S lưu (mở hộp Chia sẻ), Esc đóng
        const openModals = () => page.$$eval('.modal:not(.hide)', list => list.map(m => m.id));
        await page.evaluate(() => openTemplatesModal());
        await sleep(200);
        const templatesOpen = await openModals();
        await page.keyboard.press('Escape');
        await sleep(200);
        const templatesClosed = await openModals();
        await shortcut('s', true);
        await page.waitForFunction(() => !document.getElementById('share-modal').classList.contains('hide'), { timeout: 20000 }).catch(() => {});
        const shareOpen = await openModals();
        await page.keyboard.press('Escape');
        await sleep(200);
        const shareClosed = await openModals();
        check('Esc đóng hộp thoại; Ctrl+S lưu kịch bản (mở hộp Chia sẻ)',
            templatesOpen.includes('templates-modal') && !templatesClosed.length && shareOpen.includes('share-modal') && !shareClosed.length,
            JSON.stringify({ templatesOpen, templatesClosed, shareOpen, shareClosed }));

        // Hộp Chia sẻ: nút Mở link trong tab mới cạnh Sao chép; "Gửi đi bằng: Mã QR" thì các nút gửi ảnh mã QR (máy tính:
        // sao chép hoặc tải ảnh rồi mở bản web để dán). Không mở trang ngoài thật khi kiểm thử
        await page.evaluate(() => {
            window.open = url => { window.openedUrl = url; return null; };
            // Ghi lại thông báo ngay khi hiện (thông báo tự ẩn sau 4 giây)
            window.toasts = [];
            new MutationObserver(() => document.querySelectorAll('.toast').forEach(t => window.toasts.push(t.textContent.trim())))
                .observe(document.getElementById('notification-container'), { childList: true });
            openShareModal();
        });
        await page.waitForFunction(() => document.getElementById('share-link-input').value, { timeout: 10000 }).catch(() => {});
        await page.evaluate(() => document.querySelector('[data-share-mode="qr"]').click());
        const qrMode = await page.evaluate(() => ({
            link: document.getElementById('share-link-input').value,
            open: document.getElementById('share-open-link').href,
            target: document.getElementById('share-open-link').target,
            barOpen: document.getElementById('share-bar-open').href,
            titles: [...document.querySelectorAll('#share-grid .share-item')].map(b => b.title),
            hint: !document.getElementById('share-mode-hint').classList.contains('hide')
        }));
        await page.evaluate(() => document.querySelector('#share-grid [onclick*="telegram"]').click());
        await page.waitForFunction(() => window.openedUrl, { timeout: 15000 }).catch(() => {});
        const sent = await page.evaluate(() => ({ opened: window.openedUrl, toast: window.toasts.find(t => t.includes('mã QR')) || '' }));
        check('hộp Chia sẻ: nút Mở link trong tab mới; chọn Mã QR thì các nút gửi ảnh mã QR (máy tính mở bản web để dán)',
            qrMode.link.endsWith(`/s/${ID}`) && qrMode.open === qrMode.link && qrMode.barOpen === qrMode.link && qrMode.target === '_blank'
                && qrMode.titles.every(t => t.startsWith('Gửi mã QR')) && qrMode.hint && sent.opened === 'https://web.telegram.org/' && sent.toast,
            JSON.stringify({ qrMode: { ...qrMode, titles: qrMode.titles.slice(0, 2) }, sent }));
        await page.evaluate(() => { setShareMode('link'); closeShareModal(); });

        // Lời chúc ở màn kết chỉ hiện khi tắt "Tự động lặp lại" (bật thì không có màn kết)
        await page.evaluate(() => { document.querySelector('.settings-group[data-group="gift"]').open = true; });
        const outroShown = () => page.$eval('#outro-message', el => el.offsetParent !== null);
        const loopOn = await page.$eval('#loop', i => i.checked);
        const whileLoop = await outroShown();
        await page.click('label[for="loop"] .switch');
        await sleep(200);
        const afterOff = await outroShown();
        await page.click('label[for="loop"] .switch');
        check('ô Lời chúc ở màn kết chỉ hiện khi tắt Tự động lặp lại', loopOn && !whileLoop && afterOff, JSON.stringify({ loopOn, whileLoop, afterOff }));

        // Giao diện theo dịp kéo theo khung bắt đầu hợp dịp, trừ khi người tạo đã tự chọn khung khác
        const frameAfter = async theme => {
            await page.click(`#screen-theme-grid .theme-option[title="${theme}"]`);
            await sleep(200);
            return page.$eval('#start-frame-grid .shell-option.selected', e => e.textContent.trim());
        };
        const tetFrame = await frameAfter('Tết');
        const noelFrame = await frameAfter('Giáng sinh');
        await page.evaluate(() => setStartFrame('gift'));
        const keptFrame = await frameAfter('Trung thu');
        check('chọn giao diện Tết, Giáng sinh thì khung bắt đầu đổi theo (Bao lì xì, Cây thông); đã tự chọn khung khác thì giữ',
            tetFrame.endsWith('Bao lì xì') && noelFrame.endsWith('Cây thông') && keptFrame.endsWith('Hộp quà'), JSON.stringify({ tetFrame, noelFrame, keptFrame }));

        // Tiếng thiên nhiên không có trong cảnh thì mờ đi (vẫn bật/tắt được); thứ trên mặt nước theo kiểu mặt nước, mùa
        const idleSounds = () => page.$$eval('#nature-things .toggle-chip.is-idle input', list => list.map(i => i.dataset.natureGroup).sort().join());
        const waterChips = () => page.$$eval('[data-water-thing]', list => list.map(i => {
            const chip = i.closest('.toggle-chip');
            return i.dataset.waterThing + (chip.classList.contains('hide') ? ':hide' : chip.classList.contains('is-idle') ? ':idle' : '');
        }).join());
        const dry = await idleSounds();
        await page.evaluate(() => { setWater('half'); setWaterStyle('lake'); setBank(''); });
        const lake = await idleSounds();
        const lakeThings = await waterChips();
        await page.evaluate(() => { setWeather('rain'); setBank('none'); });
        const seaRain = await idleSounds();
        await page.evaluate(() => { setBank(''); setWaterStyle('river'); setSeason('winter'); setWeather(''); });
        const riverThings = await waterChips();
        await page.evaluate(() => { setSeason('auto'); setWater(''); });
        check('tiếng thiên nhiên không có trong cảnh thì mờ đi: chưa có mặt nước mờ hết, có mặt nước chỉ còn mưa mờ, biển không có ếch, cò, vịt',
            dry === 'birds,ducks,fish,frogs,insects,rain,trees,water' && lake === 'rain' && seaRain === 'birds,ducks,frogs,insects',
            JSON.stringify({ dry, lake, seaRain }));
        // Menu "⋯" của đợt: nhân bản, đưa lên, xóa cả đợt; Esc đóng menu; Ctrl+Z lấy lại đợt vừa xóa
        await page.evaluate(() => setTimelineView('list'));
        const waves = () => page.$$eval('.burst-group', groups => groups.map(g => g.querySelectorAll('.shot-row').length).join());
        const waveAction = async (wave, action) => {
            await page.click(`.burst-group:nth-child(${wave}) .burst-more`);
            await sleep(150);
            await page.click(`#burst-menu [data-burst-action="${action}"]`);
            await sleep(400);
            return waves();
        };
        await page.evaluate(() => addBurst());
        await sleep(300);
        const start = await waves();
        const n = start.split(',')[0];
        const duplicated = await waveAction(1, 'duplicate');
        const moved = await waveAction(3, 'up');
        await page.click('.burst-group:nth-child(1) .burst-more');
        await sleep(150);
        const menuOpen = await page.$eval('#burst-menu', m => {
            const r = m.getBoundingClientRect();
            return !m.classList.contains('hide') && r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth;
        });
        await page.keyboard.press('Escape');
        await sleep(150);
        const menuClosed = await page.$eval('#burst-menu', m => m.classList.contains('hide'));
        const removed = await waveAction(2, 'remove');
        await page.evaluate(() => document.activeElement.blur());
        await page.keyboard.down('Control');
        await page.keyboard.press('z');
        await page.keyboard.up('Control');
        await sleep(500);
        const undone = await waves();
        check('menu ⋯ của đợt: nhân bản đợt, đưa lên trước, xóa đợt (Ctrl+Z lấy lại), menu nằm trong màn hình, Esc đóng',
            start === `${n},1` && duplicated === `${n},${n},1` && moved === `${n},1,${n}` && removed === `${n},${n}` && undone === `${n},1,${n}`
                && menuOpen && menuClosed,
            JSON.stringify({ start, duplicated, moved, removed, undone, menuOpen, menuClosed }));

        check('Trên mặt nước: hồ không có khúc gỗ trôi, sông thì có; mùa đông mặt nước đóng băng nên con vật mờ đi, đá vẫn rõ',
            lakeThings.includes('waterLogs:hide') && riverThings.includes('waterLogs:idle') && riverThings.includes('waterBirds:idle')
                && /waterRocks(,|$)/.test(riverThings),
            JSON.stringify({ lakeThings, riverThings }));

        // Hộp Kịch bản: bấm vào thẻ là mở kịch bản để sửa; nút xóa ở góc ảnh hỏi lại trước khi xóa (Esc là Hủy bỏ)
        await page.$eval('#title', i => { i.value = 'Tiêu đề chưa lưu'; i.dispatchEvent(new Event('input', { bubbles: true })); });
        await page.evaluate(() => openScriptsModal());
        const card = `#scripts-list .script-item[data-id="${ID}"]`;
        await page.waitForSelector(card, { timeout: 10000 });
        await page.click(`${card} .script-delete`);
        await sleep(200);
        const asked = await openModals();
        await page.keyboard.press('Escape');
        await sleep(200);
        const stillListed = !!(await page.$(card));
        await page.click(`${card} h4`);
        await page.waitForFunction(() => document.getElementById('scripts-modal').classList.contains('hide'), { timeout: 10000 }).catch(() => {});
        await sleep(300);
        const reopened = await page.evaluate(() => ({ title: document.getElementById('title').value, modals: [...document.querySelectorAll('.modal:not(.hide)')].map(m => m.id) }));
        check('hộp Kịch bản: bấm vào thẻ mở kịch bản để sửa; nút xóa ở góc hỏi lại, Hủy bỏ thì giữ',
            asked.includes('confirm-modal') && stillListed && reopened.title === TITLE && !reopened.modals.length, JSON.stringify({ asked, stillListed, reopened }));

        // Ô chọn mở danh sách vẽ theo giao diện builder: bấm chọn mục, bàn phím (mũi tên, Enter), Esc chỉ đóng danh sách
        await page.evaluate(() => {
            document.querySelector('.settings-group[data-group="viewer"]').open = true;
            document.querySelector('.shot-row').click();
        });
        await sleep(200);
        await page.click('#viewer-scale');
        await sleep(200);
        const listed = await page.$$eval('.select-menu:not(.hide) [role="option"]', items => items.map(i => i.textContent.trim()));
        await page.click('.select-menu [data-value="1.5"]');
        await sleep(200);
        const picked = await page.evaluate(() => ({ value: document.getElementById('viewer-scale').value, open: !document.querySelector('.select-menu').classList.contains('hide') }));
        await page.focus('#viewer-quality');
        await page.keyboard.press('ArrowDown');
        await sleep(150);
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');
        await sleep(200);
        const byKeys = await page.$eval('#viewer-quality', s => s.value);
        await page.click('#viewer-scale');
        await sleep(150);
        await page.keyboard.press('Escape');
        await sleep(200);
        const escaped = await page.evaluate(() => ({
            menu: !document.querySelector('.select-menu').classList.contains('hide'),
            inspector: !!document.getElementById('insp-title'),
            focus: document.activeElement.id
        }));
        await page.waitForFunction(() => document.querySelector('[data-summary="viewer"]').textContent.includes('Thu phóng 150%'), { timeout: 5000 }).catch(() => {});
        const viewerSummary = await page.$eval('[data-summary="viewer"]', e => e.textContent);
        check('ô chọn mở danh sách theo giao diện builder: bấm chọn được, mũi tên + Enter chọn được, Esc chỉ đóng danh sách',
            listed.length === 8 && listed[6] === '150%' && picked.value === '1.5' && !picked.open && byKeys !== '' && viewerSummary.includes('Thu phóng 150%')
                && !escaped.menu && escaped.inspector && escaped.focus === 'viewer-scale',
            JSON.stringify({ listed, picked, byKeys, escaped, viewerSummary }));

        // Thông báo không che bảng chỉnh sửa phát bắn (máy tính: giữa cạnh dưới; bảng chỉnh sửa ở bên phải)
        await page.evaluate(() => {
            document.querySelectorAll('.toast').forEach(t => t.remove());
            document.querySelector('.shot-row').click();
            duplicateEvent(Number(document.querySelector('.shot-row').dataset.id));
        });
        await sleep(400);
        const overlap = await page.evaluate(() => {
            const t = document.querySelector('.toast').getBoundingClientRect();
            const i = document.getElementById('inspector').getBoundingClientRect();
            return t.left < i.right && t.right > i.left && t.top < i.bottom && t.bottom > i.top;
        });
        check('thông báo không che bảng chỉnh sửa phát bắn', !overlap);

        check('builder (tinh chỉnh thao tác) không lỗi JS', page.errors.length === 0, page.errors.join(' | '));
    } finally {
        await page.close();
        removeConfig(ID);
    }
}
