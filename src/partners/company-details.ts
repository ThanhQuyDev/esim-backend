import { ReconciliationParty } from './reconciliation-workbook';

/**
 * Pháp nhân của chính esim.vn — "Bên A" trên biên bản đối soát (#006).
 *
 * Để ở đây dưới dạng hằng số, không phải cài đặt trong CMS: trong file mẫu anh
 * gửi, phần này là chữ đen cố định, chỉ thông tin đối tác và các con số theo
 * tháng mới là chữ đỏ hệ thống tự điền. Đổi địa chỉ hay người đại diện là việc
 * vài năm một lần và nên đi kèm review, không nên sửa nóng trên CMS.
 *
 * Nguồn: `mau-doi-soat.xlsx` (02/10/2026).
 */
export const ESIM_COMPANY: ReconciliationParty = {
  name: 'CÔNG TY TNHH VIỄN THÔNG ESIM',
  address:
    '331/21 Vườn Lài, Phường Phú Thọ Hòa, Thành Phố Hồ Chí Minh, Việt Nam',
  taxCode: '0318081642',
  representative: 'Bà Lại Thị Hà',
  position: 'Giám Đốc',
};

/**
 * Thuế suất VAT trên tiền chia sẻ doanh thu, theo file mẫu.
 *
 * Một con số cho mọi đối tác vì biên bản mẫu là mẫu duy nhất hiện có. Nếu sau
 * này đối tác cá nhân phải áp thuế TNCN thay vì VAT thì chỗ này cần tách theo
 * `legalType`.
 */
export const RECONCILIATION_VAT_PERCENT = 10;
