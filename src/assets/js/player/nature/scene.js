/*!
 * Hanabi – trình phát: âm thanh thiên nhiên (chọn tiếng theo cảnh)
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Cảnh nào nghe tiếng gì: chỉ nghe tiếng của thứ có trong cảnh (mặt nước, kiểu bờ, cây trên bờ, mùa, thời tiết, sinh
// vật đang bật). Nhóm tiếng (NATURE_GROUPS) dùng chung cho builder (bật/tắt từng nhóm) và trình phát.

// Nhóm tiếng người tạo bật/tắt riêng được (kịch bản: natureOff là danh sách nhóm tắt)
export const NATURE_GROUPS = [
    { key: 'water', icon: '🌊', name: 'Dòng nước' },
    { key: 'trees', icon: '🍃', name: 'Gió, lá cây' },
    { key: 'frogs', icon: '🐸', name: 'Ếch' },
    { key: 'birds', icon: '🦢', name: 'Cò' },
    { key: 'ducks', icon: '🦆', name: 'Vịt trời' },
    { key: 'fish', icon: '🐟', name: 'Cá quẫy' },
    { key: 'insects', icon: '🦗', name: 'Dế' },
    { key: 'rain', icon: '🌧️', name: 'Mưa' }
];

// Âm lượng mặc định (kịch bản không ghi natureVolume)
export const NATURE_VOLUME = 0.6;

export const validNatureVolume = value => (value !== undefined && value !== null && value !== '' && Number.isFinite(Number(value))
    ? Math.max(0, Math.min(1, Number(value)))
    : NATURE_VOLUME);

export const validNatureOff = list => (Array.isArray(list) ? NATURE_GROUPS.map(g => g.key).filter(key => list.includes(key)) : []);

// Kiểu bờ (player/bank-styles.js) -> mép nước ('earth' bờ đất, 'wall' kè, chân cầu, 'sand' bãi cát, 'sea' biển khơi) và
// cây trên bờ ('reeds' lau sậy, 'leafy' cây tán lá, 'willow' liễu, 'palm' dừa, 'none' không có cây)
const BANKS = {
    '': ['earth', 'reeds'],
    brick: ['wall', 'leafy'],
    stone: ['wall', 'willow'],
    sand: ['sand', 'palm'],
    oldtown: ['wall', 'none'],
    bridge: ['wall', 'leafy'],
    arch: ['wall', 'willow'],
    city: ['wall', 'leafy'],
    none: ['sea', 'none']
};

const WARM = ['spring', 'summer', 'autumn'];

// Cảnh để nghe: on (người tạo và người xem đều bật), volume (0-1), off (nhóm tắt), water (có mặt nước), style ('river' |
// 'lake'), bank, season, weather ('' | 'rain' | 'snow'), life (sinh vật trên mặt nước đang bật), music (có nhạc nền).
// key: hai cảnh cùng key thì nghe như nhau.
export function natureScene({ on = true, volume = NATURE_VOLUME, off = [], water = false, style = 'lake', bank = '', season = 'summer', weather = '', life = {}, music = false }) {
    const [shore, veg] = BANKS[bank] || BANKS[''];
    const scene = {
        on, volume, off: new Set(off), water, style: style === 'river' ? 'river' : 'lake', shore, veg, season, weather,
        frozen: water && season === 'winter' && shore !== 'sea', life: { ...life }, music
    };
    scene.key = JSON.stringify([on, volume, [...scene.off], water, scene.style, shore, veg, season, weather, scene.life, music]);
    return scene;
}

// Lớp tiếng nền của cảnh (lặp liên tục, hai đoạn lặp dài khác nhau đặt hai bên trái phải nên không nghe ra lặp):
// [{ key, id, params, gain }]
export function ambienceLayers(scene) {
    if (!scene.on) return [];
    const on = group => !scene.off.has(group);
    const rain = scene.weather === 'rain';
    const land = scene.water && scene.shore !== 'sea';
    const layers = [];
    const add = (id, params, gain) => layers.push({ key: id + JSON.stringify(params), id, params, gain });
    if (scene.water && !scene.frozen && on('water')) add('water', { style: scene.style, shore: scene.shore }, scene.style === 'river' ? 1 : 0.85);
    // Không có mặt nước thì không có bờ, cây: chỉ còn mưa
    if (scene.water && on('trees')) add('leaves', { veg: scene.veg, season: scene.season }, scene.veg === 'none' ? 0.4 : 0.65);
    if (land && WARM.includes(scene.season) && scene.weather !== 'snow' && on('insects')) add('crickets', { season: scene.season, rain }, rain ? 0.3 : 0.55);
    if (land && !scene.frozen && WARM.includes(scene.season) && scene.life.frogs && on('frogs')) add('frogChorus', { season: scene.season, rain }, rain ? 0.9 : 0.6);
    if (rain && on('rain')) add('rain', { water: scene.water && !scene.frozen, trees: scene.water && scene.veg !== 'none' }, 0.9);
    return layers;
}

// Tiếng sự việc: tên sự việc cảnh vật báo (../scenery/sound-hook.js) -> tiếng (id, params, số giọng), nhóm, độ to, khoảng
// cách tối thiểu giữa hai lần phát (ms)
const EVENTS = {
    frog: { id: 'frog', variants: 6, group: 'frogs', gain: 0.55 },
    plip: { id: 'plip', variants: 4, group: 'fish', gain: 0.2, gap: 150 },
    bubble: { id: 'bubble', variants: 4, group: 'water', gain: 0.08, gap: 120 },
    wings: { id: 'wings', variants: 3, group: 'ducks', gain: 0.32 },
    egret: { id: 'egret', variants: 4, group: 'birds', gain: 0.42 },
    egretWings: { id: 'egretWings', variants: 2, group: 'birds', gain: 0.3 }
};

const SPLASH_SIZES = ['small', 'medium', 'large'];

const splashSize = size => (size < 0.5 ? 'small' : size < 0.8 ? 'medium' : 'large');

// extra: chi tiết từ cảnh vật (seed: giọng riêng của con vật; size: cỡ tia nước; who: con gì làm nước bắn; kind, series:
// vịt đực/mái, kêu cả tràng)
export function eventSound(name, extra = {}) {
    const pick = n => Math.min(n - 1, Math.floor((extra.seed ?? Math.random()) * n));
    if (name === 'splash') {
        const size = Number(extra.size) || 0.6;
        return { id: 'splash', params: { size: splashSize(size) }, variant: pick(4), group: extra.who || 'water', gain: 0.22 + 0.3 * Math.min(1, size) };
    }
    if (name === 'quack') {
        const kind = extra.kind === 'male' ? 'male' : 'female';
        return { id: 'quack', params: { kind, series: kind === 'female' && !!extra.series }, variant: pick(3), group: 'ducks', gain: kind === 'male' ? 0.28 : 0.42 };
    }
    const sound = EVENTS[name];
    return sound && { ...sound, params: {}, variant: pick(sound.variants) };
}

// Mọi tiếng ngắn cảnh này có thể phát (dựng sẵn trước): [{ id, params, variants }]
export function eventSounds(scene) {
    if (!scene.on || !scene.water || scene.frozen) return [];
    const on = group => !scene.off.has(group);
    const list = [];
    const life = scene.life;
    const add = (id, params, variants) => list.push({ id, params, variants });
    if (on('water') || on('fish') || on('frogs') || on('ducks') || on('birds')) SPLASH_SIZES.forEach(size => add('splash', { size }, 4));
    if (on('water') && life.bubbles) add('bubble', {}, 4);
    if (on('fish') && life.fish) add('plip', {}, 4);
    if (on('frogs') && life.frogs) add('frog', {}, 6);
    if (on('ducks') && life.ducks) {
        add('quack', { kind: 'female', series: false }, 3);
        add('quack', { kind: 'female', series: true }, 3);
        add('quack', { kind: 'male', series: false }, 3);
        add('wings', {}, 3);
    }
    if (on('birds') && life.birds) {
        add('egret', {}, 4);
        add('egretWings', {}, 2);
    }
    return list;
}
