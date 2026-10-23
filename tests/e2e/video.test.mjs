/*!
 * Trình diễn Pháo hoa – kiểm thử tự động
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Tạo video: builder dựng màn trình diễn thành file MP4 trong khung ẩn (không phải chờ theo thời gian thật, không bấm
// gì thêm) kèm tiếng pháo và nhạc nền; kiểm tra định dạng, độ phân giải, thời lượng, hình, khói và tiếng trong file.
import fs from 'fs';
import path from 'path';
import { DIST, sleep, openPage, writeConfig, removeConfig, writeMelody } from './helpers.mjs';

const ID = 'zz_e2e_video';

export async function run(browser, base, { check }) {
    writeMelody(path.join(DIST, 'uploads/music/zz_e2e_video/melody.wav'), 30);
    writeConfig(ID, {
        title: 'CHÚC MỪNG', subtitle: 'Thử quay video', author: 'Từ: E2E', loop: true, smoke: 'heavy',
        music: { url: './uploads/music/zz_e2e_video/melody.wav', volume: 0.8 },
        events: [
            { burst: 1, shell: 'Hoa cúc', x: 50, y: 60, color: 'Gold' },
            { burst: 2, shell: 'Trái tim', x: 50, y: 62, color: 'Red' },
            { burst: 2, shell: 'Lời nhắn', text: 'Xin chào!', delay: 300, duration: 3000 }
        ]
    });
    const page = await openPage(browser, { width: 1440, height: 900 });
    try {
        await page.goto(base + '/builder', { waitUntil: 'networkidle0' });
        await page.evaluate(id => editScript(id), ID);
        await sleep(1200);
        await page.evaluate(() => { openVideoModal(); setVideoFormat('portrait'); setVideoQuality('hd'); });
        // Thời gian thật của từng bước dựng (khung dựng báo kèm khi xong)
        await page.evaluate(() => window.addEventListener('message', e => {
            if (e.data && e.data.type === 'firework-record-done') window.__videoTiming = e.data.timing;
        }));
        const started = Date.now();
        await page.click('#btn-video-create');
        const frame = await page.waitForFrame(f => f.url().includes('record=1'), { timeout: 10000 });
        await page.waitForFunction(() => /Đang tạo video/.test(document.getElementById('video-status').textContent), { timeout: 60000 }).catch(() => {});
        const canvas = await frame.$eval('#trails-canvas', c => [c.width, c.height]).catch(() => null);
        check('khung dựng vẽ đúng độ phân giải video (720×1280), không hiện ra màn hình',
            !!canvas && canvas[0] === 720 && canvas[1] === 1280 && await page.$eval('iframe[title="Khung dựng video"]', f => f.getBoundingClientRect().width <= 1 || getComputedStyle(f.parentElement).opacity === '0'),
            canvas && canvas.join('×'));
        await page.waitForFunction(() => !document.getElementById('video-result').classList.contains('hide'), { timeout: 120000 }).catch(() => {});
        const renderSeconds = (Date.now() - started) / 1000;
        const timing = await page.evaluate(() => window.__videoTiming) || {};

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
            // Tua tới đúng mốc t rồi lấy điểm ảnh (builder cũng tự tua khung xem trước: chờ tới khi thật sự đứng ở t)
            const frameAt = async t => {
                for (let i = 0; i < 20 && (v.seeking || Math.abs(v.currentTime - t) > 0.05); i++) {
                    if (!v.seeking) v.currentTime = t;
                    await new Promise(r => v.addEventListener('seeked', r, { once: true }));
                }
                await new Promise(r => setTimeout(r, 150));
                c.getContext('2d').drawImage(v, 0, 0);
                return c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
            };
            const d = await frameAt(4);
            let lit = 0;
            for (let i = 0; i < d.length; i += 16) if (d[i] + d[i + 1] + d[i + 2] > 150) lit++;
            // Khói (pháo cuối đã nổ vài giây, trời hết ửng màu): điểm xám, ba kênh gần bằng nhau, sáng hơn bầu trời đêm nhưng
            // không chói như hạt pháo. Khói ngẫu nhiên (gió, số đám) nên lấy mốc nhiều khói nhất trong vài mốc. Máy GitHub (không
            // có GPU) đo được khoảng 1/3 so với máy thường (1,4% so với 3-4% ở mốc 8,5 giây); tắt khói thì gần 0% ở các mốc này.
            // Không đo sớm hơn: 5,5-6,5 giây còn tiêu đề, vệt pháo mờ (tắt khói vẫn ra 0,8-1,2%), 7,5 giây kịch bản lặp lại.
            const smokeSamples = [];
            for (const t of [8.5, 9.5, 10.5]) {
                const s = await frameAt(t);
                let n = 0;
                for (let i = 0; i < s.length; i += 16) {
                    const hi = Math.max(s[i], s[i + 1], s[i + 2]);
                    const lo = Math.min(s[i], s[i + 1], s[i + 2]);
                    if (lo >= 18 && hi <= 160 && hi - lo < 14) n++;
                }
                smokeSamples.push(n / (s.length / 16));
            }
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
            return { w: v.videoWidth, h: v.videoHeight, duration, type: blob.type, size: blob.size, lit, smoky: Math.max(...smokeSamples), smokeSamples, rms };
        });
        check('tạo xong ra file MP4 720×1280', !!video && video.type === 'video/mp4' && video.w === 720 && video.h === 1280,
            video && `${video.type} ${video.w}×${video.h} ${(video.size / 1e6).toFixed(1)} MB`);
        // Phần còn lại là bộ mã hóa H.264 của máy (phần cứng thì rất nhanh, máy thử không có GPU thì chậm hơn nhiều)
        check('dựng hình không chờ theo thời gian thật (mô phỏng + vẽ dưới 1/4 thời lượng video)',
            !!video && timing.simulate + timing.paint < video.duration * 250,
            video && `mô phỏng + vẽ ${((timing.simulate + timing.paint) / 1000).toFixed(1)} s, cả quá trình ${renderSeconds.toFixed(1)} s cho video ${video.duration.toFixed(1)} s ${JSON.stringify(timing)}`);
        check('video dài trọn màn trình diễn kèm thiệp lời chúc', !!video && video.duration > 13 && video.duration < 22, video && `${video.duration.toFixed(1)} s`);
        check('video có hình pháo hoa và chữ', !!video && video.lit > 100, video && `${video.lit} điểm sáng`);
        check('video có khói pháo (kịch bản bật "Dày")', !!video && video.smoky > 0.006, video && `${video.smokeSamples.map(x => (x * 100).toFixed(1)).join(' / ')}% điểm xám`);
        check('video có tiếng (nhạc nền, tiếng pháo)', !!video && video.rms > 0.005, video && `rms ${video.rms.toFixed(4)}`);

        await page.evaluate(() => closeVideoModal());
        await sleep(300);
        check('xong thì gỡ khung dựng', await page.$$eval('iframe[title="Khung dựng video"]', f => f.length) === 0);
        check('tạo video không lỗi JS', page.errors.length === 0, page.errors.join(' | '));
    } finally {
        await page.close();
        removeConfig(ID);
        fs.rmSync(path.join(DIST, 'uploads/music/zz_e2e_video'), { recursive: true, force: true });
    }
}
