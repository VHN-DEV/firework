/*!
 * Hanabi – thông tin bản quyền
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

export const COPYRIGHT = '© 2026 Vũ Hoài Nam';
export const CONTACT = 'vuhoainam18032002@gmail.com';

// Thông báo bản quyền trong bảng Console của trình duyệt (nơi người muốn sao chép mã thường mở đầu tiên)
export function printCopyrightNotice(appName) {
    console.info(
        `%c${appName}%c\n${COPYRIGHT}. Mọi quyền được bảo lưu.\n`
        + `Mã nguồn được bảo hộ quyền tác giả. Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép.\n`
        + `Liên hệ xin phép: ${CONTACT}`,
        'font: 700 16px sans-serif; color: #ffbf36',
        'font: 12px sans-serif'
    );
}
