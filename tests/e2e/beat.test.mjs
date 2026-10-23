/*!
 * Trình diễn Pháo hoa – kiểm thử tự động
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Xếp pháo theo nhịp nhạc: builder nghe bài nhạc biết trước đáp án, tìm đúng nhịp, đặt pháo trúng phách;
// trình phát cho tiếng nổ trùng đúng vị trí bài nhạc đang phát.
import fs from 'fs';
import path from 'path';
import { DIST, sleep, openPage, writeConfig, removeConfig, writeBeatSong } from './helpers.mjs';

const MUSIC = 'uploads/music/zz_e2e_beat/song.wav';
const ID = 'zz_e2e_beat';

// Thời điểm nổ đã hẹn (giây trong bài) của kịch bản khớp nhịp, tính như trình phát
function plannedTimes(config) {
    const maxBurst = Math.max(...config.events.map(e => e.burst));
    const times = [];
    let start = 0;
    for (let burst = 1; burst <= maxBurst; burst++) {
        const list = config.events.filter(e => e.burst === burst);
        const pause = Math.max(0, ...list.filter(e => e.shell === 'Tạm dừng').map(e => e.duration || 2000));
        list.filter(e => e.shell !== 'Tạm dừng' && e.shell !== 'Lời nhắn')
            .forEach(e => times.push({ at: (config.music.start || 0) + (start + (e.delay || 0)) / 1000, event: e }));
        start += (list.length ? 2500 + pause : 1000) * 1.25;
    }
    return times;
}

// Ghi lại mỗi lần tiếng nổ phát ra kèm vị trí bài nhạc lúc đó
function recordBurstSounds() {
    window.__bursts = [];
    const urls = new WeakMap();
    const buffers = new WeakMap();
    const arrayBuffer = Response.prototype.arrayBuffer;
    Response.prototype.arrayBuffer = function () {
        const url = this.url;
        return arrayBuffer.call(this).then(data => { urls.set(data, url); return data; });
    };
    const decode = BaseAudioContext.prototype.decodeAudioData;
    BaseAudioContext.prototype.decodeAudioData = function (data, ok, fail) {
        const url = urls.get(data);
        const tag = buffer => { if (buffer) buffers.set(buffer, url); return buffer; };
        const result = decode.call(this, data, buffer => ok && ok(tag(buffer)), fail);
        return result && result.then ? result.then(tag) : result;
    };
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args) {
        const url = this.buffer && buffers.get(this.buffer);
        if (url && /burst\/burst(\d|-sm)/.test(url) && window.__music && !window.__music.paused) window.__bursts.push(window.__music.currentTime);
        return start.apply(this, args);
    };
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
        if (/zz_e2e_beat/.test(this.src)) window.__music = this;
        return play.call(this);
    };
}

export async function run(browser, base, { check }) {
    const truth = writeBeatSong(path.join(DIST, MUSIC));
    removeConfig(ID);
    try {
        // ---- Builder: nghe bài nhạc, xếp pháo
        let page = await openPage(browser, { width: 1440, height: 900 });
        await page.goto(base + '/builder', { waitUntil: 'networkidle0' });
        await page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* bỏ qua */ } });
        await page.$eval('#music-url', (input, url) => { input.value = url; }, './' + MUSIC);
        await page.evaluate(() => setMusicFromUrl());
        await page.waitForFunction(() => !document.getElementById('music-card').classList.contains('hide'), { timeout: 15000 });
        await page.evaluate(() => openBeatModal());
        await page.waitForFunction(() => !document.getElementById('beat-result').classList.contains('hide')
            || document.getElementById('beat-status').classList.contains('error'), { timeout: 60000 });
        const summary = await page.$eval('#beat-summary', e => e.textContent);
        check('tìm đúng nhịp bài nhạc (124 BPM)', /124 BPM/.test(summary), summary);
        await page.click('#btn-beat-apply');
        await sleep(1200);
        const draft = await page.evaluate(() => JSON.parse(localStorage.getItem('firework_builder_draft')));
        const config = draft && draft.config;
        check('xếp pháo xong: bật khớp nhịp nhạc, tắt lặp lại', !!config && config.music.sync === true && config.loop === false,
            config && JSON.stringify({ sync: config.music.sync, loop: config.loop, events: config.events.length }));
        const planned = plannedTimes(config);
        const grid = truth.beats.flatMap(t => [t, t + truth.T / 2]);
        const worst = Math.max(...planned.map(p => Math.min(...grid.map(g => Math.abs(g - p.at))))) * 1000;
        check('mọi phát pháo nổ đúng phách', planned.length > 30 && worst < 30, `${planned.length} phát, lệch tối đa ${worst.toFixed(1)} ms`);
        const cluster = planned.filter(p => p.event.shell === 'Nổ nhiều lần' && p.event.size >= 1.5);
        check('chùm pháo lớn ngay đầu đoạn cao trào', cluster.some(p => Math.abs(p.at - truth.chorusStart) < 0.03),
            cluster.map(p => p.at.toFixed(3)).join(', ') + ` / ${truth.chorusStart.toFixed(3)}`);
        check('builder xếp pháo không lỗi JS', page.errors.length === 0, page.errors.join(' | '));
        await page.close();

        // ---- Trình phát: tiếng nổ trùng vị trí bài nhạc
        writeConfig(ID, config);
        page = await openPage(browser);
        await page.evaluateOnNewDocument(recordBurstSounds);
        await page.goto(`${base}/demo?config=${ID}`, { waitUntil: 'networkidle0' });
        await page.waitForSelector('.start-screen.is-ready');
        await page.click('.btn-start');
        await page.waitForFunction(() => window.__music && window.__music.currentTime > 20, { timeout: 60000 }).catch(() => {});
        const { bursts, now } = await page.evaluate(() => ({ bursts: window.__bursts, now: window.__music ? window.__music.currentTime : 0 }));
        const due = [...new Set(planned.map(p => p.at.toFixed(3)))].map(Number).filter(t => t > 0.2 && t < now - 0.8);
        const errors = due.map(t => Math.min(...bursts.map(b => Math.abs(b - t))) * 1000).sort((a, b) => a - b);
        const p90 = errors[Math.floor(errors.length * 0.9)];
        check('trình phát: tiếng nổ trùng nhịp nhạc', errors.length > 10 && p90 < 60 && errors[errors.length - 1] < 150,
            `${errors.length} mốc, p90 ${p90?.toFixed(0)} ms, tối đa ${errors[errors.length - 1]?.toFixed(0)} ms`);
        check('trình phát khớp nhịp không lỗi JS', page.errors.length === 0, page.errors.join(' | '));
        await page.close();
    } finally {
        removeConfig(ID);
        fs.rmSync(path.join(DIST, path.dirname(MUSIC)), { recursive: true, force: true });
    }
}
