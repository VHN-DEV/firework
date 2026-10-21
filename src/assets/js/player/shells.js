/*!
 * Trình diễn Pháo hoa – trình phát: các loại pháo
 * Phần bổ sung và chỉnh sửa © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Các loại pháo (Hoa cúc, Liễu, Trái tim, Xoay vòng...): mỗi loại là một hàm trả về tùy chọn cho Shell theo cỡ pháo.

import { randomColor, makePistilColor, whiteOrGold } from './colors.js';
import { COLOR, INVISIBLE, PI_2 } from './env.js';
import { isLowQuality, isHighQuality, settings } from './state.js';
import {
    getHeartPoints, getStarPoints, getSmileyPoints, getCatPoints, getTextParticles, getClover3Points,
    getCloverPoints, getSaturnPoints, getSnowflakePoints, getLotusPoints, getButterflyPoints, getDiamondPoints
} from './shapes.js';

// Các loại vỏ độc đáo
export const crysanthemumShell = (size = 1) => {
    const glitter = Math.random() < 0.25;
    const singleColor = Math.random() < 0.72;
    const color = singleColor ? randomColor({ limitWhite: true }) : [randomColor(), randomColor({ notSame: true })];
    const pistil = singleColor && Math.random() < 0.42;
    const pistilColor = pistil && makePistilColor(color);
    const secondColor = singleColor && (Math.random() < 0.2 || color === COLOR.White) ? pistilColor || randomColor({ notColor: color, limitWhite: true }) : null;
    const streamers = !pistil && color !== COLOR.White && Math.random() < 0.42;
    let starDensity = glitter ? 1.1 : 1.25;
    if (isLowQuality) starDensity *= 0.8;
    if (isHighQuality) starDensity = 1.2;
    return {
        shellSize: size,
        spreadSize: 300 + size * 100,
        starLife: 900 + size * 200,
        starDensity,
        color,
        secondColor,
        glitter: glitter ? 'light' : '',
        glitterColor: whiteOrGold(),
        pistil,
        pistilColor,
        streamers
    };
};


const ghostShell = (size = 1) => {
    // Mở rộng vỏ crysanthemum
    const shell = crysanthemumShell(size);
    // Hiệu ứng ma có thể nhanh nên kéo dài tuổi thọ của sao
    shell.starLife *= 1.5;
    // Đảm bảo chúng tôi luôn có một màu duy nhất ngoài màu trắng
    let ghostColor = randomColor({ notColor: COLOR.White });
    // Luôn sử dụng dây truyền và đôi khi là nhụy hoa
    shell.streamers = true;
    const pistil = Math.random() < 0.42;
    const pistilColor = pistil && makePistilColor(ghostColor);
    // Hiệu ứng ma quái - chuyển từ màu vô hình sang màu đã chọn
    shell.color = INVISIBLE;
    shell.secondColor = ghostColor;
    // Chúng tôi không muốn những ngôi sao vô hình phun ra ánh sáng lấp lánh và hiện tại chúng tôi cũng không muốn
    // có cách chuyển sang trạng thái long lanh. Vì vậy chúng ta sẽ vô hiệu hóa nó.
    shell.glitter = '';

    return shell;
};


const strobeShell = (size = 1) => {
    const color = randomColor({ limitWhite: true });
    return {
        shellSize: size,
        spreadSize: 280 + size * 92,
        starLife: 1100 + size * 200,
        starLifeVariation: 0.40,
        starDensity: 1.1,
        color,
        glitter: 'light',
        glitterColor: COLOR.White,
        strobe: true,
        strobeColor: Math.random() < 0.5 ? COLOR.White : null,
        pistil: Math.random() < 0.5,
        pistilColor: makePistilColor(color)
    };
};


const palmShell = (size = 1) => {
    const color = randomColor();
    const thick = Math.random() < 0.5;
    return {
        shellSize: size,
        color,
        spreadSize: 250 + size * 75,
        starDensity: thick ? 0.15 : 0.4,
        starLife: 1800 + size * 200,
        glitter: thick ? 'thick' : 'heavy'
    };
};

export const ringShell = (size = 1) => {
    const color = randomColor();
    const pistil = Math.random() < 0.75;
    return {
        shellSize: size,
        ring: true,
        color,
        spreadSize: 300 + size * 100,
        starLife: 900 + size * 200,
        starCount: 2.2 * PI_2 * (size + 1),
        pistil,
        pistilColor: makePistilColor(color),
        glitter: !pistil ? 'light' : '',
        glitterColor: color === COLOR.Gold ? COLOR.Gold : COLOR.White,
        streamers: Math.random() < 0.3
    };
    // return Object.sign({}, defaultShell, config);
};

const crossetteShell = (size = 1) => {
    const color = randomColor({ limitWhite: true });
    return {
        shellSize: size,
        spreadSize: 300 + size * 100,
        starLife: 750 + size * 160,
        starLifeVariation: 0.4,
        starDensity: 0.85,
        color,
        crossette: true,
        pistil: Math.random() < 0.5,
        pistilColor: makePistilColor(color)
    };
};

const floralShell = (size = 1) => ({
    shellSize: size,
    spreadSize: 300 + size * 120,
    starDensity: 0.12,
    starLife: 500 + size * 50,
    starLifeVariation: 0.5,
    color: Math.random() < 0.65 ? 'random' : (Math.random() < 0.15 ? randomColor() : [randomColor(), randomColor({ notSame: true })]),
    floral: true
});

const fallingLeavesShell = (size = 1) => ({
    shellSize: size,
    color: INVISIBLE,
    spreadSize: 300 + size * 120,
    starDensity: 0.12,
    starLife: 500 + size * 50,
    starLifeVariation: 0.5,
    glitter: 'medium',
    glitterColor: COLOR.Gold,
    fallingLeaves: true
});

const willowShell = (size = 1) => ({
    shellSize: size,
    spreadSize: 300 + size * 100,
    starDensity: 0.7,
    starLife: 3000 + size * 300,
    glitter: 'willow',
    glitterColor: COLOR.Gold,
    color: COLOR.Gold,
    comet: true
});

const crackleShell = (size = 1) => {
    // ủng hộ vàng
    const color = Math.random() < 0.75 ? COLOR.Gold : randomColor();
    return {
        shellSize: size,
        spreadSize: 380 + size * 75,
        starDensity: isLowQuality ? 0.65 : 1,
        starLife: 600 + size * 100,
        starLifeVariation: 0.32,
        glitter: 'light',
        glitterColor: COLOR.Gold,
        color,
        crackle: true,
        pistil: Math.random() < 0.65,
        pistilColor: makePistilColor(color)
    };
};

const horsetailShell = (size = 1) => {
    const color = randomColor();
    return {
        shellSize: size,
        horsetail: true,
        color,
        spreadSize: 250 + size * 38,
        starDensity: 0.9,
        starLife: 2500 + size * 300,
        glitter: 'medium',
        glitterColor: Math.random() < 0.5 ? whiteOrGold() : color,
        // Thêm hiệu ứng nhấp nháy vào đuôi ngựa màu trắng để làm cho chúng thú vị hơn
        strobe: color === COLOR.White
    };
};

// Bánh xe lửa: các nan sáng xoay tít quanh tâm, tóe tia lửa ra xung quanh
const spinWheelShell = (size = 1) => {
    const color = Math.random() < 0.6 ? randomColor({ limitWhite: true }) : [randomColor(), randomColor({ notSame: true })];
    return {
        shellSize: size,
        spreadSize: 300 + size * 100,
        starLife: 2200 + size * 200,
        starLifeVariation: 0.1,
        color,
        glitter: 'medium',
        glitterColor: whiteOrGold(),
        spin: 'wheel'
    };
};

// Bay lên theo hai vệt xoắn vào nhau, nổ thành thiên hà nhiều nhánh xoáy
const spiralShell = (size = 1) => {
    const color = randomColor({ limitWhite: true });
    return {
        shellSize: size,
        spreadSize: 320 + size * 100,
        starLife: 2600 + size * 250,
        starLifeVariation: 0.15,
        color,
        secondColor: Math.random() < 0.5 ? randomColor({ notColor: color, limitWhite: true }) : null,
        glitter: 'light',
        glitterColor: whiteOrGold(),
        spin: 'galaxy',
        launchStyle: 'spiral'
    };
};

// Pháo treo: hạt cháy rất lâu, lơ lửng rồi rơi chậm, cuối đời lấp lánh như sao
const longBurnShell = (size = 1) => {
    const color = Math.random() < 0.6 ? COLOR.Gold : randomColor();
    return {
        shellSize: size,
        spreadSize: 280 + size * 90,
        starLife: 5200 + size * 400,
        starLifeVariation: 0.25,
        starDensity: 0.75,
        color,
        glitter: 'willow',
        glitterColor: color === COLOR.White ? COLOR.White : COLOR.Gold,
        hang: true
    };
};

const heartShell = (size = 1) => {
    const color = randomColor();
    return {
        shellSize: size,
        color,
        spreadSize: 300 + size * 100,
        starLife: 1000 + size * 200,
        starLifeVariation: 0.2,
        shapePoints: getHeartPoints(),
        glitter: 'light',
        glitterColor: COLOR.White,
    };
};

const starShapeShell = (size = 1) => {
    const color = randomColor();
    return {
        shellSize: size,
        color,
        spreadSize: 350 + size * 100,
        starLife: 1200 + size * 200,
        shapePoints: getStarPoints(),
        glitter: 'light',
        glitterColor: COLOR.Gold,
    };
};

const smileyShell = (size = 1) => {
    const color = randomColor();
    return {
        shellSize: size,
        color,
        spreadSize: 300 + size * 100,
        starLife: 1200 + size * 200,
        shapePoints: getSmileyPoints(),
        glitter: 'light',
        glitterColor: color,
    };
};

const catShell = (size = 1) => {
    const color = randomColor();
    return {
        shellSize: size,
        color,
        spreadSize: 350 + size * 100,
        starLife: 1200 + size * 200,
        shapePoints: getCatPoints(),
        glitter: 'light',
        glitterColor: color,
    };
};

const textShell = (size = 1) => {
    const color = randomColor();
    let textStr = settings().customText || '';
    let text = '';

    if (!textStr.trim()) {
        text = 'HAPPY';
    } else {
        // Tách chuỗi bằng dấu phẩy và chọn ngẫu nhiên một phần tử
        const parts = textStr.split(',').map(s => s.trim()).filter(s => s.length > 0);
        text = parts[(Math.random() * parts.length) | 0];
    }

    return {
        shellSize: size,
        color,
        spreadSize: 300 + size * 100, // Thêm spreadSize để tránh lỗi NaN
        starLife: 1400 + size * 200,
        shapePoints: getTextParticles(text, 50, 3, true),
        glitter: 'light',
        glitterColor: COLOR.Gold,
    };
};

const clover3Shell = (size = 1) => {
    const color = COLOR.Green;
    return {
        shellSize: size,
        color,
        spreadSize: 300 + size * 100,
        starLife: 1200 + size * 200,
        shapePoints: getClover3Points(),
        glitter: 'light',
        glitterColor: COLOR.White,
    };
};

const cloverShell = (size = 1) => {
    const color = COLOR.Green;
    return {
        shellSize: size,
        color,
        spreadSize: 300 + size * 100,
        starLife: 1200 + size * 200,
        shapePoints: getCloverPoints(),
        glitter: 'light',
        glitterColor: COLOR.White,
    };
};

const saturnShell = (size = 1) => {
    const color = COLOR.Gold;
    return {
        shellSize: size,
        color,
        spreadSize: 400 + size * 100,
        starLife: 1500 + size * 200,
        shapePoints: getSaturnPoints(),
        glitter: 'light',
        glitterColor: COLOR.White,
    };
};

const snowflakeShell = (size = 1) => {
    const color = COLOR.White;
    return {
        shellSize: size,
        color,
        spreadSize: 350 + size * 100,
        starLife: 1500 + size * 200,
        shapePoints: getSnowflakePoints(),
        glitter: 'light',
        glitterColor: COLOR.Blue,
    };
};

const lotusShell = (size = 1) => {
    const color = Math.random() < 0.5 ? COLOR.Purple : COLOR.Red;
    return {
        shellSize: size,
        color,
        spreadSize: 350 + size * 100,
        starLife: 1500 + size * 200,
        shapePoints: getLotusPoints(),
        glitter: 'light',
        glitterColor: COLOR.Gold,
    };
};

const butterflyShell = (size = 1) => {
    const color = randomColor();
    return {
        shellSize: size,
        color,
        spreadSize: 300 + size * 100,
        starLife: 1500 + size * 200,
        shapePoints: getButterflyPoints(),
        glitter: 'light',
        glitterColor: COLOR.White,
    };
};

const diamondShell = (size = 1) => {
    const color = randomColor();
    return {
        shellSize: size,
        color,
        spreadSize: 300 + size * 100,
        starLife: 1200 + size * 200,
        shapePoints: getDiamondPoints(),
        glitter: 'heavy',
        glitterColor: COLOR.White,
    };
};

const imageShell = (size = 1) => {
    return {
        shell: 'Hình ảnh',
        shellSize: size,
        spreadSize: 300 + size * 100,
        starLife: 2000,
        glitter: 'light'
    };
};

const multiBurstShell = (size = 1) => {
    const color = randomColor({ limitWhite: true });
    return {
        shellSize: size,
        spreadSize: 300 + size * 100,
        starLife: 900 + size * 200,
        starDensity: 1.2,
        color,
        multiBurst: true,
        glitter: 'light'
    };
};

// "Ngẫu nhiên" (luôn đứng đầu danh sách): trình phát cắm hàm chọn loại pháo theo cài đặt vào lúc khởi động
let pickRandomShell = size => crysanthemumShell(size);

export function setRandomShell(pick) {
    pickRandomShell = pick;
}

export const shellTypes = {
    'Ngẫu nhiên': size => pickRandomShell(size),
    'Trái tim': heartShell,
    'Ngôi sao': starShapeShell,
    'Hình ảnh': imageShell,
    'Mặt mèo': catShell,
    'Mặt cười': smileyShell,
    'Văn bản': textShell,
    'Cỏ 3 lá': clover3Shell,
    'Cỏ 4 lá': cloverShell,
    'Hành tinh': saturnShell,
    'Bông tuyết': snowflakeShell,
    'Bông sen': lotusShell,
    'Con bướm': butterflyShell,
    'Kim cương': diamondShell,
    'Nổ nhiều lần': multiBurstShell,
    'Nổ lách tách': crackleShell,
    'Nổ chéo': crossetteShell,
    'Hoa cúc': crysanthemumShell,
    'Lá rơi': fallingLeavesShell,
    'Lá rụng': fallingLeavesShell,
    'Hoa': floralShell,
    'Ma': ghostShell,
    'Đuôi ngựa': horsetailShell,
    'Cây cọ': palmShell,
    'Vòng nhẫn': ringShell,
    'Nhấp nháy': strobeShell,
    'Liễu': willowShell,
    'Xoay vòng': spinWheelShell,
    'Xoắn ốc': spiralShell,
    'Cháy lâu': longBurnShell
};

export const shellNames = Object.keys(shellTypes);
