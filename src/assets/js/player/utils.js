/*!
 * Trình diễn Pháo hoa – trình phát: tiện ích
 * Phần bổ sung và chỉnh sửa © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Tiện ích dùng chung: mã tự thay trong chữ ([YEAR], [LUNAR_YEAR], [SINCE:...]), đường dẫn ảnh/nhạc trong kịch bản, số
// ngẫu nhiên theo hạt giống, tạo canvas vẽ sẵn.

// Số ngẫu nhiên 0-1 lặp lại được theo hạt giống (Park-Miller): cùng hạt giống ra cùng dãy số, nên cảnh, ảnh vẽ sẵn dựng lại
// lần nào cũng y hệt
export const seededRandom = seed => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

// Canvas mới cỡ w x h điểm ảnh cùng nét vẽ 2D; opts: tùy chọn của getContext (vd { willReadFrequently: true })
export function makeCanvas(w, h, opts) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return [c, c.getContext('2d', opts)];
}

function getLunarYearName(year) {
    const cans = ["Canh", "Tân", "Nhâm", "Quý", "Giáp", "Ất", "Bính", "Đinh", "Mậu", "Kỷ"];
    const chis = ["Thân", "Dậu", "Tuất", "Hợi", "Tí", "Sửu", "Dần", "Mão", "Thìn", "Tỵ", "Ngọ", "Mùi"];
    return `${cans[year % 10]} ${chis[year % 12]}`;
}

export function replacePlaceholders(text) {
    if (typeof text !== 'string') return text;
    const now = new Date();
    const year = now.getFullYear();
    return text
        .replace(/\[YEAR\]/g, year)
        .replace(/\[LUNAR_YEAR\]/g, getLunarYearName(year).toUpperCase())
        .replace(/\[SINCE:(\d+)\]/g, (match, p1) => {
            return year - parseInt(p1);
        });
}

export function normalizeAssetPath(path) {
    if (!path) return path;

    // Ảnh dạng data:/blob: (ảnh lưu cục bộ trên GitHub Pages) và URL tuyệt đối thì giữ nguyên
    if (/^(data:|blob:|https?:|\/)/i.test(path)) return path;

    // Xử lý đường dẫn tương đối
    let cleanPath = path.replace(/^\.\//, '');

    if (import.meta.env.DEV) {
        // Trong môi trường dev, đảm bảo có 'src/assets/'
        if (cleanPath.startsWith('assets/')) {
            cleanPath = 'src/' + cleanPath;
        }
    } else if (cleanPath.startsWith('src/assets/')) {
        // Trong bản build, chuyển 'src/assets/' thành 'assets/'
        cleanPath = cleanPath.replace('src/assets/', 'assets/');
    }
    // Đảm bảo đường dẫn là tương đối từ gốc site
    return './' + cleanPath.replace(/^dist\//, '');
}
