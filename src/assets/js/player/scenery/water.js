/*!
 * Hanabi – trình phát: cảnh vật (mặt nước)
 * Phần bổ sung và chỉnh sửa © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Mặt nước phản chiếu bầu trời: bóng trời gợn sóng, vệt sáng, đường trăng, bờ, vật trôi, sinh vật, theo mùa.

import MyMath from '../../MyMath.js';
import { IS_MOBILE } from '../env.js';
import { horizon, isLowQuality, season as sceneSeason } from '../state.js';
import { validBankStyle } from '../bank-styles.js';
import { fireLight, hash, litCanvas } from './util.js';
import { horizonLight, skyAmbient } from '../sky-light.js';
import { fallingLeafSprite, floatLanternSprite, moundSprite, padSprite, rockSprite, seasonSprite, setSpriteRes, warmWaterSprites } from './water-sprites.js';
import { WaterLife } from './water-life.js';
import { drawFlowMarks, drawLightStreak, drawReflection, drawSubmerged, iceSheet, steerAround } from './water-fx.js';
import { cityLightStreaks } from './city-skyline.js';
import { bankBandCss, bankSprite, bankStyle, drawBeachFoam, setBankStyle } from './bank.js';
import { skylineCache } from './skylines.js';
import { Decor } from './decor.js';

// Độ phân giải lớp mặt nước so với điểm ảnh CSS khi chất lượng 480p trở xuống (cho nhẹ máy); mức cao hơn thì vẽ nét
// theo mật độ điểm ảnh màn hình như trăng, sao
export const WATER_RESOLUTION = IS_MOBILE ? 0.35 : 0.5;

// ---------------------------------------------------------------------------
// Mặt nước
// ---------------------------------------------------------------------------
const backgroundImages = new Map();

// Ảnh nền đang hiện (CSS background-image) để phản chiếu, cùng vị trí trong khung
// Đọc lại kiểu CSS của ảnh nền tối đa 4 lần mỗi giây (không phải mỗi khung hình)
let backgroundCache = { el: null, at: 0, value: null };

function backgroundOf(el) {
    if (!el) return null;
    const now = performance.now();
    if (backgroundCache.el === el && now - backgroundCache.at < 250 && (!backgroundCache.value || backgroundCache.value.image.complete)) {
        return backgroundCache.value;
    }
    backgroundCache = { el, at: now, value: readBackground(el) };
    return backgroundCache.value;
}

function readBackground(el) {
    const style = getComputedStyle(el);
    const opacity = parseFloat(style.opacity);
    const match = style.backgroundImage.match(/url\(["']?(.*?)["']?\)/);
    if (!match || opacity < 0.01) return null;
    let image = backgroundImages.get(match[1]);
    if (!image) {
        image = new Image();
        image.src = match[1];
        backgroundImages.set(match[1], image);
    }
    if (!image.complete || !image.naturalWidth) return null;
    const box = el.getBoundingClientRect();
    return { image, opacity, width: box.width, height: box.height };
}

let mirror = null;

// Thành phố: bóng đèn nhà cao tầng thu nhỏ để kéo dài, làm nhòe (xem bước 4)
let cityGlow = null;

export const Water = {
    drawn: false,
    frame: 0,
    last: 0,
    flow: 0,
    dashes: [],
    swells: [],
    dashKey: '',
    floats: [],
    floatKey: '',
    seasonFloats: [],
    seasonKey: '',
    plants: [],
    plantKey: '',
    rocks: [],
    rockKey: '',

    // sources: các canvas cùng kích thước khung (vẽ theo điểm ảnh CSS cssW x cssH); background: phần tử ảnh nền;
    // style: 'lake' hồ tĩnh lặng | 'river' sông chảy; floating: '' | 'lanterns' hoa đăng | 'petals' cánh hoa;
    // life: { birds: cò, ducks: vịt trời, fish: cá nhảy, logs: khúc gỗ trôi, boats: thuyền } (false: tắt hết); plants: lá bèo;
    // rocks: đá, gò đất giữa dòng
    // bank: kiểu bờ bên kia (bank-styles.js)
    render(ctx, { sources, background, cssW, cssH, time, style, floating, calm, life: lifeFlags, plants, rocks: rocksOn, bank: bankKind }) {
        // Mùa: đông mặt nước đóng băng (không sóng, không cá, vịt, cò, khúc gỗ, lá bèo, vật trôi); biển thì không đóng băng
        const season = sceneSeason();
        this.season = season;
        // Biển khơi: giữa biển không có đá, gò đất, lá bèo, khúc gỗ, ếch, cò, vịt, lá rụng, thuyền. Sông thành phố: không
        // có gò đất, đá giữa dòng; có thuyền neo sát bờ
        const shore = validBankStyle(bankKind);
        const sea = shore === 'none';
        const frozen = season === 'winter' && !sea;
        if (sea) plants = false;
        if (sea || shore === 'city') rocksOn = false;
        if (lifeFlags) {
            lifeFlags = { ...lifeFlags, sea, ...(sea ? { birds: false, ducks: false, frogs: false, logs: false } : {}),
                boats: !!lifeFlags.boats && shore === 'city' };
        }
        const life = !frozen && !!lifeFlags && (lifeFlags.birds || lifeFlags.ducks || lifeFlags.fish || lifeFlags.logs || lifeFlags.frogs || lifeFlags.bubbles || !!lifeFlags.boats);
        const level = horizon();
        const { width: W, height: H } = ctx.canvas;
        if (level >= 1 || !W || !H) {
            if (this.drawn) ctx.clearRect(0, 0, W, H);
            this.drawn = false;
            return 'none';
        }
        // Chất lượng 480p trở xuống: vẽ lại cách một khung hình
        if (isLowQuality && this.drawn && (++this.frame & 1)) return 'skip';
        this.drawn = true;
        setSpriteRes(W / cssW > 1.35 ? 4 : 2);
        setBankStyle(validBankStyle(bankKind));
        warmWaterSprites();

        const k = W / cssW;
        const top = Math.round(level * H);
        const depth = H - top;
        const horizonCss = level * cssH;
        const depthCss = depth / k;
        const fromCss = Math.max(0, horizonCss - depthCss);
        // Bờ đất ở mép nước (kiểu Kingdom Two Crowns): pháo bắn lên từ mặt bờ. Mặt nước bắt đầu dưới chân bờ (surf);
        // ngay dưới đó là bóng của bờ, rồi mới tới bóng bầu trời (reflTop)
        // Biển khơi: không có bờ, chỉ một vệt chân trời mảnh
        const bankPx = bankStyle === 'none' ? Math.max(1, Math.round(1.2 * k)) : Math.max(2, Math.round(bankBandCss(cssH) * k));
        const surf = Math.min(H, top + bankPx);
        const reflTop = Math.min(H, surf + bankPx);
        const waterTopCss = surf / k;
        const waterDepthCss = Math.max(1, (H - surf) / k);

        // 1. Bầu trời ngay trên mặt nước, lật ngược (dải cao bằng phần nước)
        if (!mirror) mirror = document.createElement('canvas');
        if (mirror.width !== W || mirror.height !== depth) {
            mirror.width = W;
            mirror.height = depth;
        }
        const m = mirror.getContext('2d');
        m.setTransform(1, 0, 0, 1, 0, 0);
        m.clearRect(0, 0, W, depth);
        m.setTransform(k, 0, 0, -k, 0, k * horizonCss);
        const bg = backgroundOf(background);
        if (bg) {
            // Ảnh nền đứng trên mép nước: phủ kín phần trời, canh đáy
            const scale = Math.max(bg.width / bg.image.naturalWidth, bg.height / bg.image.naturalHeight);
            const w = bg.image.naturalWidth * scale;
            const h = bg.image.naturalHeight * scale;
            m.globalAlpha = bg.opacity;
            m.drawImage(bg.image, (cssW - w) / 2, horizonCss - h, w, h);
            m.globalAlpha = 1;
        }
        // Ghép các lớp kiểu cộng sáng: card đồ họa làm sẵn được (kiểu "lighten" như trên trang thì card phải chép lại vùng
        // đích cho từng lần vẽ, rất chậm trên card tích hợp); lớp vệt pháo phủ đen dần nên phần đen không cộng thêm gì
        m.globalCompositeOperation = 'lighter';
        sources.forEach(src => {
            if (!src || !src.width) return;
            const sk = src.width / cssW;
            m.drawImage(src, 0, fromCss * sk, src.width, (horizonCss - fromCss) * sk, 0, fromCss, cssW, horizonCss - fromCss);
        });
        m.globalCompositeOperation = 'source-over';

        // 2. Nền nước: xanh đêm, sát chân trời sáng hơn (ánh trời đêm in xuống nước), sáng thêm theo màu pháo
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1;
        ctx.clearRect(0, 0, W, H);
        // (phần sáng đều cả trời; vầng sáng quanh chỗ nổ đã soi bóng cùng các lớp ở trên)
        const tint = `${16 + skyAmbient.r * 0.5 | 0}, ${26 + skyAmbient.g * 0.5 | 0}, ${46 + skyAmbient.b * 0.5 | 0}`;
        const base = ctx.createLinearGradient(0, top, 0, H);
        base.addColorStop(0, `rgb(${tint})`);
        // Mặt băng: xanh xám nhạt hơn nước, sáng đều hơn
        base.addColorStop(0.35, frozen ? 'rgb(24, 32, 48)' : 'rgb(9, 15, 30)');
        base.addColorStop(1, frozen ? 'rgb(14, 19, 30)' : 'rgb(3, 6, 13)');
        ctx.fillStyle = base;
        ctx.fillRect(0, top, W, depth);

        // 3. Bóng phản chiếu kiểu tranh điểm ảnh: mặt nước chia thành từng dải ngang, mỗi dải lệch một nấc theo nhịp
        //    sóng riêng. Sát bờ dải mỏng, lệch ít (gần như gương); càng xa bờ dải càng dày, lệch nhiều, mờ hơn.
        //    Sông thì sóng mạnh hơn và các vệt sáng trôi ngang theo dòng.
        const river = style === 'river';
        const dt = Math.min(50, this.last ? time - this.last : 16);
        this.last = time;
        if (!frozen) this.flow += dt * (river ? 0.03 : 0.004);
        // Dải cao khoảng 2-3 điểm ảnh CSS dù lớp vẽ nét hay thưa (cùng dáng sóng, cùng số lần vẽ)
        const strip = Math.max(1, Math.round((IS_MOBILE ? 6 : 4) * k));
        // Ghép kiểu cộng sáng: phần đen (lớp vệt pháo được phủ đen dần) không làm tối mặt nước, card đồ họa làm sẵn được.
        // Cầu đá (vòm cong, nhiều vòm): trong khoảng cầu (gapX) không có kè mà là chân cầu, trụ cầu đứng dưới nước; tâm
        // vòm ở mép nước nên vòm và bóng khép thành vòng tròn
        const footLayer = skylineCache.style === bankStyle && skylineCache.data.foot ? skylineCache : null;
        const gapX = footLayer ? footLayer.data.foot.map(x => Math.round(x * k)) : null;
        // Chỉ vẽ ngoài khoảng dưới cầu (bờ, bóng bờ)
        const clipGap = () => {
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, 0, gapX[0], H);
            ctx.rect(gapX[1], 0, W - gapX[1], H);
            ctx.clip();
        };
        ctx.globalCompositeOperation = 'lighter';
        const drawStrips = from => {
            const span = H - from;
            for (let y = 0, i = 0; y < span; i++) {
                const d = y / span;
                const band = Math.max(strip, Math.round((strip + d * (river ? 9 : 5) * k * 2) / strip) * strip);
                const phase = hash(i) * Math.PI * 2;
                const speed = 0.0008 + hash(i + 50) * 0.0016;
                const amp = frozen ? 0 : (river ? 0.6 + d * 9 : 0.2 + d * 3) * k;
                const dx = Math.round((Math.sin(time * speed + phase) + 0.5 * Math.sin(time * speed * 1.7 + phase * 2)) * amp);
                const alpha = frozen ? 0.4 * (1 - d * 0.5) : (river ? 0.6 * (1 - d * 0.6) : 0.78 * (1 - d * 0.5));
                // Khe tối, càng xa bờ càng nhiều: bóng trăng, bóng pháo vỡ thành từng lát như mặt nước gợn. Mỗi khe chỉ là
                // một đoạn ngắn, trôi theo dòng (hồ trôi rất chậm) và mờ dần rồi hiện lại theo nhịp riêng: không thành vạch
                // tối kẻ suốt bề ngang đứng yên như vạch quét màn hình. Mặt băng: bóng phẳng, không khe
                let dark = 0;
                let gx = 0;
                let gw = 0;
                if (!frozen && hash(i + 99) < 0.16 + d * 0.4) {
                    dark = 0.4 * (0.5 - 0.5 * Math.cos((time / (3000 + hash(i + 31) * 4000) + hash(i + 17)) * Math.PI * 2));
                    const gwCss = cssW * (0.12 + hash(i + 13) * 0.3);
                    const loop = cssW + gwCss;
                    const x = (hash(i + 7) * loop + this.flow * (river ? 0.5 + d * 0.8 : 0.6 + hash(i + 23))) % loop - gwCss;
                    gx = Math.round(x * k);
                    gw = Math.round(gwCss * k);
                }
                ctx.globalAlpha = alpha;
                if (dark < 0.02) {
                    ctx.drawImage(mirror, 0, y, W, band, dx, from + y, W, band);
                } else {
                    // Phần trước khe, khe (tối hơn), phần sau khe
                    const a = Math.max(0, gx);
                    const b = Math.min(W, gx + gw);
                    if (a > 0) ctx.drawImage(mirror, 0, y, a, band, dx, from + y, a, band);
                    ctx.globalAlpha = alpha * (1 - dark);
                    if (b > a) ctx.drawImage(mirror, a, y, b - a, band, dx + a, from + y, b - a, band);
                    ctx.globalAlpha = alpha;
                    if (b < W) ctx.drawImage(mirror, b, y, W - b, band, dx + b, from + y, W - b, band);
                }
                y += band;
            }
        };
        drawStrips(reflTop);
        // 4. Ánh sáng in thành vệt dọc xuống nước (trăng, pháo sáng kéo dài như ngoài đời)
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, surf, W, H - surf);
        ctx.clip();
        ctx.globalCompositeOperation = 'lighter';
        const streaks = from => {
            ctx.globalAlpha = 0.16;
            ctx.drawImage(mirror, 0, from + Math.round(3 * k));
            ctx.globalAlpha = 0.08;
            ctx.drawImage(mirror, 0, from + Math.round(7 * k));
        };
        streaks(reflTop);
        // Thành phố: ánh đèn nhà cao tầng loang dài, nhòe xuống sông như ảnh chụp đêm (phần bóng gần chân trời thu nhỏ rồi
        // kéo dài theo chiều dọc, phóng lại: vừa dài vừa mịn)
        if (bankStyle === 'city' && !frozen) {
            if (!cityGlow) cityGlow = document.createElement('canvas');
            const gw = Math.max(1, Math.round(W / 8));
            const gh = Math.max(1, Math.round(depth / 8));
            if (cityGlow.width !== gw || cityGlow.height !== gh) {
                cityGlow.width = gw;
                cityGlow.height = gh;
            }
            const gg = cityGlow.getContext('2d');
            gg.clearRect(0, 0, gw, gh);
            gg.drawImage(mirror, 0, 0, W, Math.max(1, Math.round(depth * 0.45)), 0, 0, gw, gh);
            ctx.globalAlpha = 0.32;
            ctx.drawImage(cityGlow, 0, 0, gw, gh, 0, reflTop, W, (H - reflTop) * 0.95);
        }

        // 5. Dải sóng dài mờ trôi chậm (kết cấu mặt nước), rồi vệt sóng ngắn lấp lánh; vệt nào nằm chỗ có ánh pháo thì
        //    sáng rực lên. Gần chân trời vệt nhỏ, dày; gần người xem vệt dài, thưa (phối cảnh).
        this.syncDashes(river, cssW);
        const thin = Math.max(1, Math.round(k));
        ctx.globalCompositeOperation = 'source-over';
        // Mặt băng: mảng tuyết, sương giá, vết nứt phủ lên bóng phản chiếu
        if (frozen) {
            ctx.globalAlpha = 1;
            ctx.drawImage(iceSheet(W, H, surf, k), 0, surf);
        }
        ctx.fillStyle = 'rgb(120, 150, 210)';
        if (!frozen) this.swells.forEach(swell => {
            const x = (((swell.u * (cssW + 160) + this.flow * (river ? 0.25 + swell.d * 0.8 : 0.12)) % (cssW + 160)) - 80) * k;
            const row = surf + Math.round(swell.d * (H - surf - 1) + Math.sin(time * swell.speed + swell.phase) * 2 * k);
            const len = swell.len * (0.4 + swell.d) * k;
            ctx.globalAlpha = (calm ? 0.07 : 0.04 + 0.05 * (0.5 + 0.5 * Math.sin(time * swell.speed * 1.3 + swell.phase))) * (1 - swell.d * 0.4);
            ctx.fillRect(x, row, len, thin);
        });
        // Vệt sóng: màu riêng của vệt, cộng thêm màu bóng phản chiếu ngay dưới vệt (ánh pháo, ánh trăng làm vệt sáng rực).
        // Hai lượt gom (tô hết màu rồi mới cộng sáng hết bóng): đổi kiểu ghép từng vệt làm card đồ họa phải ngắt mạch vẽ
        // vài trăm lần mỗi khung
        const twinkles = this.dashes.map(dash => (calm ? 0.6 : 0.2 + 0.8 * Math.pow(0.5 + 0.5 * Math.sin(time * dash.speed + dash.phase), 2)));
        const dashX = dash => (((dash.u * (cssW + 40) + this.flow * (river ? 0.4 + dash.d * 1.2 : 0.3)) % (cssW + 40)) - 20) * k;
        const dashRow = dash => surf + Math.round(dash.d * (H - surf - 1));
        // Mặt băng: vệt sóng thành hạt sương giá lấp lánh đứng yên
        const dashLen = dash => (frozen ? thin : Math.max(1, dash.len * (0.5 + dash.d) * k));
        let dashFill = '';
        ctx.globalCompositeOperation = 'source-over';
        this.dashes.forEach((dash, i) => {
            ctx.globalAlpha = twinkles[i] * 0.42 * (1 - dash.d * 0.35);
            if (dash.color !== dashFill) {
                dashFill = dash.color;
                ctx.fillStyle = dashFill;
            }
            ctx.fillRect(dashX(dash), dashRow(dash), dashLen(dash), thin);
        });
        ctx.globalCompositeOperation = 'lighter';
        this.dashes.forEach((dash, i) => {
            const x = dashX(dash);
            const row = dashRow(dash);
            const len = dashLen(dash);
            ctx.globalAlpha = twinkles[i];
            ctx.drawImage(mirror, Math.max(0, x), Math.max(0, row - reflTop), len, 1, x, row, len, thin);
        });
        const moon = Decor.moonGlow();
        if (moon && moon.light > 0.03 && moon.x > -moon.radius * 4 && moon.x < cssW + moon.radius * 4) {
            this.drawMoonGlade(ctx, moon, k, surf, H, time, river && !frozen, calm || frozen);
        }
        // Thành phố: đèn sáng (mặt kính màu, đỉnh tháp, biển quảng cáo, dãy nhà ven sông) in vệt dài lấp lánh xuống sông
        if (bankStyle === 'city' && skylineCache.style === 'city' && !frozen) {
            ctx.globalCompositeOperation = 'lighter';
            // Màu theo cùng đồng hồ với đèn trên nhà (Decor.clock) để vệt đổi màu đúng lúc với mặt kính
            cityLightStreaks(skylineCache.data, Decor.clock, calm).forEach((s, i) => {
                drawLightStreak(ctx, s.x * k, reflTop, s.reach * (H - reflTop), s.w * k * 0.45, s.rgb, Math.min(0.6, s.a * 1.4), time, i * 0.61, k);
            });
        }
        ctx.restore();

        // 6. Bờ đất: bóng của bờ in ngay dưới chân bờ, rồi tới bờ. Pháo rọi lên bờ và bóng bờ như lên cầu, nhà, cây ở lớp
        //    bầu trời (cùng một độ sáng, theo màu của vật)
        const bank = bankSprite(W, bankPx, k, bankStyle, sceneSeason());
        const light = fireLight(horizonLight);
        const bankLayer = (src, mode) => {
            ctx.globalCompositeOperation = mode;
            ctx.save();
            ctx.globalAlpha = 0.4;
            ctx.translate(0, surf);
            ctx.scale(1, -1);
            ctx.drawImage(src, 0, 0, W, bankPx, 0, -bankPx, W, bankPx);
            ctx.restore();
            ctx.globalAlpha = 1;
            ctx.drawImage(src, 0, 0, W, bankPx, 0, top, W, bankPx);
        };
        // Cầu đá: trong khoảng cầu là chân cầu, không vẽ bờ
        if (gapX) clipGap();
        bankLayer(bank.canvas, 'source-over');
        if (light) bankLayer(litCanvas(bank.canvas, light), 'lighter');
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
        if (gapX) ctx.restore();
        // Cầu đá: chân cầu (lớp bầu trời vẽ, ánh pháo rọi lên như phần trên cầu; ở đây khoét mặt nước cho lộ ra), bóng chân
        // cầu ngay dưới mép nước như bóng kè; trong lòng vòm thấy mặt nước phía xa sau cầu, sáng như trời sát chân trời
        if (gapX) {
            const fk = footLayer.k;
            const fw = footLayer.canvas.width;
            const fy = footLayer.up * fk;
            const fh = Math.min(footLayer.canvas.height - fy, bankPx / k * fk);
            const dw = fw / fk * k;
            const flipped = (src = footLayer.canvas, sy = fy) => {
                ctx.save();
                ctx.translate(0, surf);
                ctx.scale(1, -1);
                ctx.drawImage(src, 0, sy, fw, fh, 0, -bankPx, dw, bankPx);
                ctx.restore();
            };
            ctx.save();
            ctx.beginPath();
            ctx.rect(gapX[0], top, gapX[1] - gapX[0], reflTop - top);
            ctx.clip();
            // Lòng vòm: dải trời ngay trên chân trời (trong vòm) kéo dọc xuống hết bóng chân cầu
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = river ? 0.6 : 0.78;
            const drop = footLayer.drop;
            footLayer.data.openings.forEach(o => {
                const hw = o.rx * Math.sqrt(Math.max(0, 1 - (drop / o.ry) ** 2)) - 1;
                if (hw <= 0) return;
                ctx.drawImage(mirror, Math.max(0, Math.round((o.cx - hw) * k)), 0, Math.max(1, Math.round(hw * 2 * k)), 1,
                    Math.round((o.cx - o.rx) * k), top, Math.round(o.rx * 2 * k), reflTop - top);
            });
            // Khoét chỗ chân cầu (lộ lớp bầu trời) và chỗ bóng chân cầu, lót lại nền nước rồi in bóng mờ như bóng kè
            ctx.globalCompositeOperation = 'destination-out';
            ctx.globalAlpha = 1;
            ctx.drawImage(footLayer.canvas, 0, fy, fw, fh, 0, top, dw, bankPx);
            flipped();
            ctx.globalCompositeOperation = 'destination-over';
            ctx.fillStyle = base;
            ctx.fillRect(gapX[0], surf, gapX[1] - gapX[0], reflTop - surf);
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = 0.4;
            flipped();
            // Bóng chân cầu sáng theo ánh pháo như bóng kè hai bên
            if (light) {
                ctx.globalCompositeOperation = 'lighter';
                flipped(litCanvas(footLayer.canvas, light, 0, fy, fw, fh), 0);
                ctx.globalCompositeOperation = 'source-over';
            }
            ctx.restore();
        }
        if (bankStyle === 'sand') drawBeachFoam(ctx, W, surf, k, time, calm);

        // 7. Vật trên mặt nước: lá bèo, hoa đăng, cánh hoa, đá, gò đất, khúc gỗ, cò, vịt. Vẽ chung theo tầm
        //    xa (xa trước, gần sau); quanh mỗi vật mặt nước gợn lên, trên sông nước rẽ qua vật. Vật trôi né đá, gò đất.
        //    Tọa độ điểm ảnh CSS.
        const rocks = this.syncRocks(rocksOn, river, cssW);
        const surfY = d => waterTopCss + d * waterDepthCss;
        const floatScale = d => (0.35 + d * 0.9) * (IS_MOBILE ? 0.85 : 1);
        this.syncPlants(plants && !frozen, river, cssW);
        this.syncFloats(frozen ? '' : floating, river);
        this.syncSeasonFloats(frozen || sea ? '' : season, river, cssW);
        // Sông thì trôi theo dòng (xa bờ người xem trôi nhanh hơn); hồ thì gần như đứng yên
        const drift = (item, half, still) => {
            item.u += (river ? item.speed * (0.3 + item.d) : item.speed * still) * dt / cssW;
            if (item.u > 1.06) item.u = -0.06;
            if (item.u < -0.06) item.u = 1.06;
            steerAround(item, item.u * cssW, half, rocks, dt, waterDepthCss, river ? 1 : 0);
        };
        this.plants.forEach(item => {
            item.bob += dt * 0.0012;
            drift(item, 12 * floatScale(item.d), 0.02);
        });
        this.floats.forEach(item => {
            item.bob += dt * 0.0015;
            if (item.kind !== 'lantern') item.rot += dt * item.spin;
            drift(item, (item.kind === 'lantern' ? 10 : 3) * floatScale(item.d), 0.08);
        });
        this.seasonFloats.forEach(item => {
            item.bob += dt * 0.0015;
            item.rot += dt * item.spin;
            drift(item, 4 * floatScale(item.d), 0.08);
        });
        if (life) {
            const key = `${river}_${Math.round(cssW)}_${Math.round(cssH)}_${level}`;
            if (key !== WaterLife.key) {
                WaterLife.key = key;
                WaterLife.reset(river, cssW, lifeFlags);
            }
            WaterLife.update(dt, river, cssW, waterTopCss, waterDepthCss, rocks, lifeFlags, this.plants);
        } else if (WaterLife.key) {
            WaterLife.key = '';
        }
        ctx.setTransform(k, 0, 0, k, 0, 0);
        ctx.globalCompositeOperation = 'source-over';
        if (life) WaterLife.drawUnder(ctx, k, waterTopCss, waterDepthCss, time);
        [
            ...this.plants.map(item => ({
                d: item.d, draw: () => this.drawPlant(ctx, item, item.u * cssW, surfY(item.d) + Math.sin(item.bob) * 0.5, floatScale(item.d), k, time, river)
            })),
            ...this.floats.map(item => ({
                d: item.d, draw: () => this.drawFloat(ctx, item, item.u * cssW, surfY(item.d) + Math.sin(item.bob), floatScale(item.d), k, time, river, calm)
            })),
            ...this.seasonFloats.map(item => ({
                d: item.d, draw: () => this.drawFloat(ctx, item, item.u * cssW, surfY(item.d) + Math.sin(item.bob) * 0.6, floatScale(item.d), k, time, river, calm)
            })),
            ...rocks.map(rock => ({ d: rock.d, draw: () => this.drawRock(ctx, rock, surfY(rock.d), WaterLife.scale(rock.d), k, time, river, frozen) })),
            ...(life ? WaterLife.things(ctx, k, waterTopCss, waterDepthCss, time, river) : [])
        ].sort((a, b) => a.d - b.d).forEach(item => item.draw());
        if (life) WaterLife.drawOver(ctx, k, waterTopCss, waterDepthCss, time);
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
        return 'drawn';
    },

    // Rải lại các vệt sáng khi đổi kiểu nước hoặc cỡ khung
    syncDashes(river, cssW) {
        const key = `${river}_${Math.round(cssW)}`;
        if (key === this.dashKey) return;
        this.dashKey = key;
        const count = Math.round((river ? 230 : 150) * (IS_MOBILE ? 0.6 : 1));
        // Ánh trăng, sao in xuống: phần lớn xanh bạc, thỉnh thoảng một vệt trắng ấm
        const colors = ['rgb(185, 205, 255)', 'rgb(205, 222, 255)', 'rgb(160, 190, 245)', 'rgb(255, 240, 215)'];
        this.dashes = Array.from({ length: count }, () => ({
            u: Math.random(),
            d: Math.pow(Math.random(), 1.2),
            len: MyMath.random(2, 12),
            phase: Math.random() * Math.PI * 2,
            speed: MyMath.random(0.0015, 0.005),
            color: colors[Math.random() < 0.12 ? 3 : (Math.random() * 3) | 0]
        }));
        this.swells = Array.from({ length: Math.round((river ? 70 : 50) * (IS_MOBILE ? 0.6 : 1)) }, () => ({
            u: Math.random(),
            d: Math.pow(Math.random(), 1.1),
            len: MyMath.random(30, 120),
            phase: Math.random() * Math.PI * 2,
            speed: MyMath.random(0.0004, 0.0012)
        }));
    },

    // Lá bèo (lớp đã nhân k, tọa độ điểm ảnh CSS): gợn nước quanh lá
    drawPlant(ctx, item, x, y, s, k, time, river) {
        drawFlowMarks(ctx, x, y, 11 * s, s, k, time, item.seed, river, 0.15);
        ctx.save();
        ctx.translate(x, y);
        if (item.flip) ctx.scale(-1, 1);
        ctx.globalAlpha = 0.95;
        // Sen chỉ nở mùa hạ
        ctx.drawImage(seasonSprite(padSprite(item.variant === 3 && this.season !== 'summer' ? 0 : item.variant), this.season), -12 * s, -5 * s, 24 * s, 10 * s);
        ctx.restore();
    },

    // Hoa đăng (tự phát sáng, ánh nến in xuống nước, gợn nước quanh đế), cánh hoa
    drawFloat(ctx, item, x, y, s, k, time, river, calm) {
        if (item.kind === 'lantern') {
            drawFlowMarks(ctx, x, y + 2 * s, 10 * s, s, k, time, item.seed, river, 0.2);
            const glow = ctx.createRadialGradient(x, y + 6 * s, 0, x, y + 6 * s, 16 * s);
            glow.addColorStop(0, `rgba(255, 180, 90, ${calm ? 0.3 : 0.25 + Math.sin(item.bob * 3) * 0.05})`);
            glow.addColorStop(1, 'rgba(255, 150, 60, 0)');
            ctx.globalAlpha = 1;
            ctx.fillStyle = glow;
            ctx.save();
            ctx.translate(x, y + 6 * s);
            ctx.scale(1, 1.8);
            ctx.translate(-x, -(y + 6 * s));
            ctx.fillRect(x - 16 * s, y + 6 * s - 16 * s, 32 * s, 32 * s);
            ctx.restore();
            ctx.drawImage(floatLanternSprite(), x - 12 * s, y - 14 * s, 24 * s, 20 * s);
        } else if (item.kind === 'leaf') {
            // Lá vàng, cánh hoa nằm dẹt trên mặt nước (phối cảnh), xoay chậm theo dòng
            const size = (item.season === 'autumn' ? 14 : 9) * s;
            ctx.save();
            ctx.translate(x, y);
            ctx.scale(1, 0.42);
            ctx.rotate(item.rot);
            ctx.globalAlpha = 0.88;
            ctx.drawImage(fallingLeafSprite(item.season, item.leaf), -size / 2, -size / 2, size, size);
            ctx.restore();
        } else {
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(item.rot);
            ctx.globalAlpha = 0.85;
            ctx.fillStyle = item.color;
            ctx.beginPath();
            ctx.ellipse(0, 0, 2.6 * s, 1.5 * s, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    },

    // Lá vàng (thu), cánh hoa đào (xuân) trôi trên mặt nước, rải lại khi đổi mùa, kiểu nước hoặc cỡ khung
    syncSeasonFloats(season, river, cssW) {
        this.cssW = cssW;
        const key = `${season}_${river}_${Math.round(cssW)}`;
        if (key === this.seasonKey) return;
        this.seasonKey = key;
        this.seasonFloats = [];
        if (season !== 'autumn' && season !== 'spring') return;
        const count = Math.round((season === 'autumn' ? 46 : 30) * (IS_MOBILE ? 0.6 : 1) * Math.min(1.4, cssW / 1200));
        for (let i = 0; i < count; i++) {
            this.seasonFloats.push(this.floatingLeaf(Math.random(), MyMath.random(0.04, 0.95), season, (Math.random() * 5) | 0, Math.random() * Math.PI * 2));
        }
    },

    floatingLeaf(u, d, season, leaf, rot) {
        return { kind: 'leaf', season, leaf, u, d, rot, speed: MyMath.random(0.015, 0.03), bob: Math.random() * 6, spin: MyMath.random(-0.0004, 0.0004) };
    },

    // Lá, cánh hoa rơi xuống mặt nước (x: điểm ảnh CSS, d: độ xa 0-1): nằm lại trôi theo dòng; nhiều quá thì lá cũ nhất chìm
    dropLeaf(x, d, season, leaf, rot) {
        if (!this.cssW || (season !== 'autumn' && season !== 'spring')) return;
        this.seasonFloats.push(this.floatingLeaf(x / this.cssW, Math.max(0.02, Math.min(0.98, d)), season, leaf, rot));
        if (this.seasonFloats.length > 70) this.seasonFloats.splice(0, 1);
    },

    // Đá, gò đất: bóng phần nổi in xuống nước, dòng nước dồn vào rồi rẽ qua
    // frozen: mặt băng mùa đông (đá, gò phủ tuyết, chân đá có gò tuyết, không có sóng nước)
    drawRock(ctx, rock, y, s, k, time, river, frozen) {
        const sprite = seasonSprite(rock.kind === 'rock' ? rockSprite(rock.variant) : moundSprite(rock.variant), this.season);
        const w = rock.size * s;
        const h = w * sprite.height / sprite.width;
        const wlOff = h * sprite.wl / sprite.height;
        const x0 = rock.x - w / 2;
        drawReflection(ctx, sprite, x0, y, w, wlOff, frozen ? 0.15 : 0.3, time, rock.seed, s);
        if (!frozen) drawFlowMarks(ctx, rock.x, y, w * 0.46, s, k, time, rock.seed, river, 1);
        ctx.globalAlpha = 1;
        ctx.drawImage(sprite, 0, 0, sprite.width, sprite.wl, x0, y - wlOff, w, wlOff);
        if (frozen) {
            ctx.fillStyle = 'rgba(184, 194, 214, 0.7)';
            ctx.beginPath();
            ctx.ellipse(rock.x, y, w * 0.55, 2.2 * s, 0, 0, Math.PI * 2);
            ctx.fill();
        } else drawSubmerged(ctx, sprite, x0, y, w, h - wlOff, time, rock.seed, s);
        if (!sprite.reeds) return;
        // Gò đất: lau sậy đung đưa theo gió (mỗi cây một nhịp), bông lau nâu; nước vỗ nhẹ dọc chân gò
        const u = w / sprite.logicalW;
        const y0 = y - wlOff;
        ctx.lineCap = 'round';
        sprite.reeds.forEach(reed => {
            const bx = x0 + reed.x * u;
            const by = y0 + reed.base * u;
            const sway = (Math.sin(time * 0.0014 + reed.phase) * 1.4 + Math.sin(time * 0.0033 + reed.phase * 2) * 0.5 + reed.lean) * u;
            const len = reed.h * u;
            ctx.globalAlpha = 0.95;
            ctx.strokeStyle = reed.color;
            ctx.lineWidth = Math.max(1 / k, 0.7 * u);
            ctx.beginPath();
            ctx.moveTo(bx, by);
            ctx.quadraticCurveTo(bx + sway * 0.25, by - len * 0.6, bx + sway, by - len);
            ctx.stroke();
            if (reed.cattail) {
                ctx.save();
                ctx.translate(bx + sway * 0.8, by - len * 0.85);
                ctx.rotate(Math.atan2(sway, len) * 0.9);
                ctx.fillStyle = '#6b4a2c';
                ctx.beginPath();
                ctx.ellipse(0, 0, 0.9 * u, 2.4 * u, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
        });
        if (frozen) return;
        ctx.fillStyle = 'rgb(205, 222, 255)';
        for (let i = 0; i < 9; i++) {
            const fx = x0 + w * (0.12 + i * 0.095) + Math.sin(time * 0.0021 + i * 1.7 + rock.seed * 5) * 1.5 * u;
            ctx.globalAlpha = 0.14 + 0.18 * (0.5 + 0.5 * Math.sin(time * 0.0035 + i * 2.3 + rock.seed * 3));
            ctx.fillRect(fx, y - 0.4 * u, (2.5 + (i % 3) * 1.5) * u, Math.max(1 / k, 0.5 * u));
        }
    },

    // Đường trăng: dưới trăng là vệt sáng lấp lánh trải dài trên mặt nước, hẹp ở xa, loe dần về phía người xem; từng
    // đốm ánh trăng chớp lên rồi tắt, lượt sau hiện chỗ khác (sông chảy thì lấp lánh nhanh hơn); trăng càng tròn càng
    // sáng, mây che thì tối đi, trăng thấp thì ngả vàng cam
    drawMoonGlade(ctx, moon, k, surf, H, time, river, calm) {
        const tone = `255, ${Math.round(244 - 40 * moon.warm)}, ${Math.round(222 - 95 * moon.warm)}`;
        const cx = moon.x * k;
        const depth = H - surf;
        const halfAt = d => moon.radius * k * (1 + 6 * d);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 1;
        // Nền vệt: dải sáng mờ, giữa sáng nhất
        for (let i = 0; i < 10; i++) {
            const d = (i + 0.5) / 10;
            const half = halfAt(d) * 1.3;
            const glow = ctx.createLinearGradient(cx - half, 0, cx + half, 0);
            glow.addColorStop(0, `rgba(${tone}, 0)`);
            glow.addColorStop(0.5, `rgba(${tone}, ${0.06 * moon.light * (1 - 0.5 * d)})`);
            glow.addColorStop(1, `rgba(${tone}, 0)`);
            ctx.fillStyle = glow;
            ctx.fillRect(cx - half, surf + (i / 10) * depth, half * 2, depth / 10 + 1);
        }
        // Đốm lấp lánh: mỗi đốm chớp một nhịp riêng, hết nhịp thì sang chỗ mới (gom về giữa vệt)
        const count = IS_MOBILE ? 120 : 220;
        const thin = Math.max(1, Math.round(k));
        const pace = river ? 1 : 0.6;
        ctx.fillStyle = `rgb(${tone})`;
        for (let i = 0; i < count; i++) {
            const t = time * (0.0012 + 0.0016 * hash(i + 7)) * pace + hash(i + 31) * 100;
            const cycle = Math.floor(t);
            const d = hash(i * 13 + cycle * 7 + 1);
            const u = (hash(i * 17 + cycle * 3 + 5) + hash(i * 5 + cycle * 11 + 9) + hash(i * 23 + cycle * 2 + 4) - 1.5) / 0.75;
            const flash = calm ? 0.3 : Math.pow(Math.sin(Math.PI * (t - cycle)), 3);
            const len = (2 + 6 * hash(i * 3 + cycle)) * (0.4 + d * 1.2) * k;
            ctx.globalAlpha = Math.min(1, 1.3 * moon.light * flash * Math.exp(-u * u * 0.5) * (1 - 0.5 * d));
            ctx.fillRect(cx + u * halfAt(d) * 0.6 - len / 2, surf + Math.round(d * (depth - 1)), len, thin);
        }
        ctx.globalCompositeOperation = 'source-over';
    },

    // Đá, gò đất giữa dòng: rải lại khi bật/tắt, đổi kiểu nước hoặc cỡ khung; cách xa nhau cho vật trôi có lối đi
    syncRocks(on, river, cssW) {
        const key = `${on}_${river}_${Math.round(cssW)}`;
        if (key === this.rockKey) return this.rocks;
        this.rockKey = key;
        this.rocks = [];
        if (!on) return this.rocks;
        const count = river ? 2 + (Math.random() < 0.5 ? 1 : 0) : 1 + (Math.random() < 0.4 ? 1 : 0);
        for (let tries = 0; this.rocks.length < count && tries < 40; tries++) {
            const kind = Math.random() < 0.55 ? 'rock' : 'mound';
            const rock = {
                kind, variant: (Math.random() * (kind === 'rock' ? 3 : 2)) | 0, x: MyMath.random(0.12, 0.88) * cssW,
                d: MyMath.random(0.25, 0.8), size: kind === 'rock' ? MyMath.random(55, 80) : MyMath.random(95, 135), seed: Math.random()
            };
            if (this.rocks.some(o => Math.abs(o.x - rock.x) < cssW * 0.2 && Math.abs(o.d - rock.d) < 0.3)) continue;
            this.rocks.push(rock);
        }
        return this.rocks;
    },

    // Rải lại lá bèo khi bật/tắt, đổi kiểu nước hoặc cỡ khung: hồ thì mọc thành từng đám, sông thì từng nhóm nhỏ trôi
    syncPlants(on, river, cssW) {
        const key = `${on}_${river}_${Math.round(cssW)}`;
        if (key === this.plantKey) return;
        this.plantKey = key;
        this.plants = [];
        if (!on) return;
        const scale = IS_MOBILE ? 0.6 : 1;
        const clusters = Math.max(1, Math.round((river ? 5 : 6) * scale));
        for (let c = 0; c < clusters; c++) {
            const u = Math.random();
            const d = MyMath.random(0.1, 0.85);
            const n = river ? 2 + ((Math.random() * 2) | 0) : 3 + ((Math.random() * 4) | 0);
            for (let i = 0; i < n; i++) {
                this.plants.push({
                    kind: 'pad', variant: Math.random() < 0.2 ? 3 : (Math.random() * 3) | 0, u: u + MyMath.random(-0.04, 0.04),
                    d: Math.min(0.97, Math.max(0.04, d + MyMath.random(-0.08, 0.08))), speed: MyMath.random(0.008, 0.014),
                    bob: Math.random() * 6, flip: Math.random() < 0.5, seed: Math.random()
                });
            }
        }
    },

    syncFloats(kind, river) {
        const key = `${kind}_${river}`;
        if (key === this.floatKey) return;
        this.floatKey = key;
        this.floats = [];
        if (kind === 'lanterns') {
            const count = IS_MOBILE ? 6 : 10;
            for (let i = 0; i < count; i++) {
                this.floats.push({
                    kind: 'lantern', u: Math.random(), d: MyMath.random(0.12, 0.9), speed: MyMath.random(0.012, 0.022), bob: Math.random() * 6,
                    seed: Math.random()
                });
            }
        } else if (kind === 'petals') {
            const count = IS_MOBILE ? 22 : 38;
            const colors = ['#ff9ec4', '#ffc2d8', '#ffffff', '#ffb3c7'];
            for (let i = 0; i < count; i++) {
                this.floats.push({
                    kind: 'petal', u: Math.random(), d: MyMath.random(0.05, 0.95), speed: MyMath.random(0.015, 0.03),
                    bob: Math.random() * 6, rot: Math.random() * Math.PI, spin: MyMath.random(-0.0006, 0.0006),
                    color: colors[(Math.random() * colors.length) | 0]
                });
            }
        }
    }
};

// ---------------------------------------------------------------------------
// Thời tiết: mưa, tuyết rơi; lá vàng (thu), cánh hoa đào (xuân) rụng bay theo gió. Vẽ trên lớp mặt nước (lớp trên cùng,
// phủ cả khung) nên không in bóng xuống nước mà vẫn có trong ảnh chụp, video; hạt mưa rơi xuống mặt nước gợn vòng lăn tăn
// (mặt băng thì vỡ tung thành chấm sáng); lá, cánh hoa rơi xuống nước gợn vòng rồi nằm lại trôi theo dòng.
// ---------------------------------------------------------------------------
