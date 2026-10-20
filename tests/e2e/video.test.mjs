/*!
 * Trình diễn Pháo hoa – kiểm thử tự động
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Xuất video: builder dựng khung quay, bấm "Bắt đầu quay" trong khung, màn trình diễn được quay lại
// kèm tiếng pháo và nhạc nền; kiểm tra định dạng, độ phân giải, thời lượng, hình và tiếng trong file.
import fs from 'fs';
import path from 'path';
import { DIST, sleep, openPage, writeConfig, removeConfig, writeMelody } from './helpers.mjs';

const ID = 'zz_e2e_video';

export async function run(browser, base, { check }) {
    writeMelody(path.join(DIST, 'uploads/music/zz_e2e_video/melody.wav'), 30);
    writeConfig(ID, {
        title: 'CHÚC MỪNG', subtitle: 'Thử quay video', author: 'Từ: E2E', loop: true,
        music: { url: './uploads/music/zz_e2e_video/melody.wav', volume: 0.8 },
        events: [
            { burst: 1, shell: 'Hoa cúc', x: 50, y: 60, color: 'Gold' },
            { burst: 2, shell: 'Trái tim', x: 50, y: 62, color: 'Red' },
            { burst: 2, shell: 'Lời nhắn', text: 'Xin chào!', delay: 300, duration: 3000 }
        ]
    });
    const page = await openPage(browser, { width: 1440, height: 900 });
    try {
        await page.goto(base + '/builder.html', { waitUntil: 'networkidle0' });
        await page.evaluate(id => editScript(id), ID);
        await sleep(1200);
        await page.evaluate(() => { openVideoModal(); setVideoFormat('portrait'); setVideoQuality('hd'); });
        await page.click('#btn-video-prepare');
        await page.waitForFunction(() => /Sẵn sàng/.test(document.getElementById('video-status').textContent), { timeout: 60000 });
        const frame = page.frames().find(f => f.url().includes('record=1'));
        const canvas = await frame.$eval('#trails-canvas', c => [c.width, c.height]);
        check('khung quay vẽ đúng độ phân giải video (720×1280)', canvas[0] === 720 && canvas[1] === 1280, canvas.join('×'));

        // Khung quay được thu nhỏ bằng CSS transform: quy đổi tọa độ nút trong khung ra tọa độ trang
        const inner = await frame.$eval('.record-start button', b => {
            const r = b.getBoundingClientRect();
            return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: innerWidth };
        });
        const outer = await page.$eval('#video-frame-box iframe', f => {
            const r = f.getBoundingClientRect();
            return { x: r.left, y: r.top, w: r.width };
        });
        const k = outer.w / inner.w;
        await page.mouse.click(outer.x + inner.x * k, outer.y + inner.y * k);
        await page.waitForFunction(() => !document.getElementById('video-result').classList.contains('hide'), { timeout: 90000 }).catch(() => {});

        const video = await page.evaluate(async () => {
            const v = document.getElementById('video-output');
            if (!v.src) return null;
            if (v.readyState < 1) await new Promise(r => v.addEventListener('loadedmetadata', r, { once: true }));
            let duration = v.duration;
            if (!Number.isFinite(duration)) {
                // WebM từ MediaRecorder không ghi sẵn thời lượng
                v.currentTime = 1e6;
                await new Promise(r => v.addEventListener('timeupdate', r, { once: true }));
                duration = v.duration;
            }
            const c = document.createElement('canvas');
            c.width = v.videoWidth;
            c.height = v.videoHeight;
            v.currentTime = 4;
            await new Promise(r => v.addEventListener('seeked', r, { once: true }));
            await new Promise(r => setTimeout(r, 150));
            c.getContext('2d').drawImage(v, 0, 0);
            const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
            let lit = 0;
            for (let i = 0; i < d.length; i += 16) if (d[i] + d[i + 1] + d[i + 2] > 150) lit++;
            const blob = await (await fetch(v.src)).blob();
            let rms = -1;
            try {
                const audio = await new OfflineAudioContext(1, 1, 44100).decodeAudioData(await blob.arrayBuffer());
                const ch = audio.getChannelData(0);
                let sum = 0;
                for (let i = 0; i < ch.length; i += 10) sum += ch[i] * ch[i];
                rms = Math.sqrt(sum / (ch.length / 10));
            } catch (e) {
                // Trình duyệt không tự giải mã được rãnh tiếng của file này
            }
            return { w: v.videoWidth, h: v.videoHeight, duration, type: blob.type, size: blob.size, lit, rms };
        });
        check('quay xong ra file video MP4/WebM 720×1280', !!video && /video\/(mp4|webm)/.test(video.type) && video.w === 720 && video.h === 1280,
            video && `${video.type} ${video.w}×${video.h} ${(video.size / 1e6).toFixed(1)} MB`);
        check('video dài trọn màn trình diễn kèm thiệp lời chúc', !!video && video.duration > 13 && video.duration < 22, video && `${video.duration.toFixed(1)} s`);
        check('video có hình pháo hoa và chữ', !!video && video.lit > 100, video && `${video.lit} điểm sáng`);
        check('video có tiếng (nhạc nền, tiếng pháo)', !!video && video.rms > 0.005, video && `rms ${video.rms.toFixed(4)}`);

        await page.evaluate(() => closeVideoModal());
        await sleep(300);
        check('đóng hộp thoại thì gỡ khung quay', await page.$$eval('#video-frame-box iframe', f => f.length) === 0);
        check('xuất video không lỗi JS', page.errors.length === 0, page.errors.join(' | '));
    } finally {
        await page.close();
        removeConfig(ID);
        fs.rmSync(path.join(DIST, 'uploads/music/zz_e2e_video'), { recursive: true, force: true });
    }
}
