/*!
 * Trình diễn Pháo hoa – trình phát (chuỗi bắn tự động)
 * Phần bổ sung và chỉnh sửa © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Chuỗi bắn tự động khi không có kịch bản: vị trí, cỡ pháo, các kiểu chuỗi.

import { IS_DESKTOP, PI_HALF } from '../env.js';
import { stageH } from '../state.js';
import { resolveSingleColor } from '../colors.js';
import { crysanthemumShell, ringShell, shellTypes } from '../shells.js';
import { Shell } from '../shell.js';
import { randomFastShell, randomShell, shellFromConfig } from './shell-picker.js';
import { burstConfig, horizonSelector, scaleFactorSelector, shellNameSelector, shellSizeSelector } from '../../script.js';

function fitShellPositionInBoundsH(position) {
    const edge = 0.18;
    return (1 - edge * 2) * position + edge;
}

function fitShellPositionInBoundsV(position) {
    return position * 0.75;
}

function getRandomShellPositionH() {
    return fitShellPositionInBoundsH(Math.random());
}

function getRandomShellPositionV() {
    return fitShellPositionInBoundsV(Math.random());
}

function getRandomShellSize() {
    const baseSize = shellSizeSelector();
    const maxVariance = Math.min(2.5, baseSize);
    const variance = Math.random() * maxVariance;
    const size = baseSize - variance;
    const height = maxVariance === 0 ? Math.random() : 1 - (variance / maxVariance);
    const centerOffset = Math.random() * (1 - height * 0.65) * 0.5;
    const x = Math.random() < 0.5 ? 0.5 - centerOffset : 0.5 + centerOffset;
    return {
        size,
        x: fitShellPositionInBoundsH(x),
        height: fitShellPositionInBoundsV(height)
    };
}

// Khởi chạy shell từ sự kiện con trỏ người dùng, dựa trên state.config
export function launchShellFromConfig(event) {
    const shellName = shellNameSelector();
    const size = shellSizeSelector();
    
    const shellProps = shellTypes[shellName](size);
    // Nếu là hình ảnh nổ thủ công, ta thử lấy ảnh từ kịch bản hiện tại nếu có
    if (shellName === 'Hình ảnh' && !shellProps.imageUrl) {
        const firstImgEvent = (burstConfig && burstConfig.events || []).find(e => e.shell === 'Hình ảnh' && e.imageUrl);
        if (firstImgEvent) {
            shellProps.imageUrl = firstImgEvent.imageUrl;
            shellProps.frame = firstImgEvent.frame;
            shellProps.crop = firstImgEvent.crop;
            shellProps.duration = firstImgEvent.duration;
            if (firstImgEvent.color) shellProps.color = resolveSingleColor(Array.isArray(firstImgEvent.color) ? firstImgEvent.color[0] : firstImgEvent.color);
        }
    }
    
    const shell = new Shell(shellProps);
    
    if (event) {
        const scaleFactor = scaleFactorSelector();
        // Bắn chính xác vào vị trí click (đã điều chỉnh theo tỉ lệ zoom)
        // Chạm xuống mặt nước thì nổ ngay trên mép nước
        shell.launchAt(event.x / scaleFactor, Math.min(event.y / scaleFactor, stageH * horizonSelector() - 40));
    } else {
        shell.launch(getRandomShellPositionH(), getRandomShellPositionV());
    }
}


// trình tự
// -----------

export function seqRandomShell() {
    const size = getRandomShellSize();
    const shell = new Shell(shellFromConfig(size.size));
    shell.launch(size.x, size.height);

    let extraDelay = shell.starLife;
    if (shell.fallingLeaves) {
        extraDelay = 4600;
    }

    return 900 + Math.random() * 600 + extraDelay;
}

export function seqRandomFastShell() {
    const shellType = randomFastShell();
    const size = getRandomShellSize();
    const shell = new Shell(shellType(size.size));
    shell.launch(size.x, size.height);

    let extraDelay = shell.starLife;

    return 900 + Math.random() * 600 + extraDelay;
}

export function seqTwoRandom() {
    const size1 = getRandomShellSize();
    const size2 = getRandomShellSize();
    const shell1 = new Shell(shellFromConfig(size1.size));
    const shell2 = new Shell(shellFromConfig(size2.size));
    const leftOffset = Math.random() * 0.2 - 0.1;
    const rightOffset = Math.random() * 0.2 - 0.1;
    shell1.launch(0.3 + leftOffset, size1.height);
    setTimeout(() => {
        shell2.launch(0.7 + rightOffset, size2.height);
    }, 100);

    let extraDelay = Math.max(shell1.starLife, shell2.starLife);
    if (shell1.fallingLeaves || shell2.fallingLeaves) {
        extraDelay = 4600;
    }

    return 900 + Math.random() * 600 + extraDelay;
}

export function seqTriple() {
    const shellType = randomFastShell();
    const baseSize = shellSizeSelector();
    const smallSize = Math.max(0, baseSize - 1.25);

    const offset = Math.random() * 0.08 - 0.04;
    const shell1 = new Shell(shellType(baseSize));
    shell1.launch(0.5 + offset, 0.7);

    const leftDelay = 1000 + Math.random() * 400;
    const rightDelay = 1000 + Math.random() * 400;

    setTimeout(() => {
        const offset = Math.random() * 0.08 - 0.04;
        const shell2 = new Shell(shellType(smallSize));
        shell2.launch(0.2 + offset, 0.1);
    }, leftDelay);

    setTimeout(() => {
        const offset = Math.random() * 0.08 - 0.04;
        const shell3 = new Shell(shellType(smallSize));
        shell3.launch(0.8 + offset, 0.1);
    }, rightDelay);

    return 4000;
}

export function seqPyramid() {
    const barrageCountHalf = IS_DESKTOP ? 7 : 4;
    const largeSize = shellSizeSelector();
    const smallSize = Math.max(0, largeSize - 3);
    const randomMainShell = Math.random() < 0.78 ? crysanthemumShell : ringShell;
    const randomSpecialShell = randomShell;

    function launchShell(x, useSpecial) {
        const chosenShell = shellNameSelector();
        const isRandom = chosenShell === 'Ngẫu nhiên';
        let shellType = isRandom
            ? useSpecial ? randomSpecialShell : randomMainShell
            : shellTypes[chosenShell];
        const shell = new Shell(shellType(useSpecial ? largeSize : smallSize));
        const height = x <= 0.5 ? x / 0.5 : (1 - x) / 0.5;
        shell.launch(x, useSpecial ? 0.75 : height * 0.42);
    }

    let count = 0;
    let delay = 0;
    while (count <= barrageCountHalf) {
        if (count === barrageCountHalf) {
            setTimeout(() => {
                launchShell(0.5, true);
            }, delay);
        } else {
            const offset = count / barrageCountHalf * 0.5;
            const delayOffset = Math.random() * 30 + 30;
            setTimeout(() => {
                launchShell(offset, false);
            }, delay);
            setTimeout(() => {
                launchShell(1 - offset, false);
            }, delay + delayOffset);
        }

        count++;
        delay += 200;
    }

    return 3400 + barrageCountHalf * 250;
}

export function seqSmallBarrage() {
    seqSmallBarrage.lastCalled = Date.now();
    const barrageCount = IS_DESKTOP ? 11 : 5;
    const specialIndex = IS_DESKTOP ? 3 : 1;
    const shellSize = Math.max(0, shellSizeSelector() - 2);
    const randomMainShell = Math.random() < 0.78 ? crysanthemumShell : ringShell;
    const randomSpecialShell = randomFastShell();

    // (cos(x*5π+0.5π)+1)/2 là sóng tùy chỉnh được giới hạn bởi 0 và 1 được sử dụng để đặt các độ cao phóng khác nhau
    function launchShell(x, useSpecial) {
        const chosenShell = shellNameSelector();
        const isRandom = chosenShell === 'Ngẫu nhiên';
        let shellType = isRandom
            ? useSpecial ? randomSpecialShell : randomMainShell
            : shellTypes[chosenShell];
        const shell = new Shell(shellType(shellSize));
        const height = (Math.cos(x * 5 * Math.PI + PI_HALF) + 1) / 2;
        shell.launch(x, height * 0.75);
    }

    let count = 0;
    let delay = 0;
    while (count < barrageCount) {
        if (count === 0) {
            launchShell(0.5, false)
            count += 1;
        }
        else {
            const offset = (count + 1) / barrageCount / 2;
            const delayOffset = Math.random() * 30 + 30;
            const useSpecial = count === specialIndex;
            setTimeout(() => {
                launchShell(0.5 + offset, useSpecial);
            }, delay);
            setTimeout(() => {
                launchShell(0.5 - offset, useSpecial);
            }, delay + delayOffset);
            count += 2;
        }
        delay += 200;
    }

    return 3400 + barrageCount * 120;
}

const sequences = [
    seqRandomShell,
    seqTwoRandom,
    seqTriple,
    seqPyramid,
    seqSmallBarrage
];
