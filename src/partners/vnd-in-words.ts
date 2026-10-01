/**
 * Đọc số tiền thành chữ, cho dòng "Bằng chữ:" của biên bản đối soát (#006).
 *
 * Biên bản đối soát là văn bản hai bên ký, nên dòng chữ phải khớp con số —
 * đó là lý do nó được viết tay ở đây và có test riêng, thay vì ghép tạm. (Chính
 * file mẫu anh gửi cũng đang lệch: số ghi 1.081.691 nhưng dòng chữ lại đọc là
 * "một triệu sáu trăm năm mươi nghìn", tức 1.650.000.)
 *
 * Các quy tắc tiếng Việt dễ sai nhất và đều có test:
 *  - 15 → "mười lăm", không phải "mười năm";
 *  - 21 → "hai mươi mốt", không phải "hai mươi một";
 *  - 25 → "hai mươi lăm";
 *  - 105 → "một trăm lẻ năm";
 *  - nhóm giữa phải đọc đủ "không trăm" (1.081.691 → "một triệu không trăm tám
 *    mươi mốt nghìn…"), nếu bỏ sẽ thành số khác.
 */

const DIGITS = [
  'không',
  'một',
  'hai',
  'ba',
  'bốn',
  'năm',
  'sáu',
  'bảy',
  'tám',
  'chín',
];

/** Thứ tự nhóm 3 chữ số, từ lớn xuống nhỏ. */
const GROUPS = ['tỷ', 'triệu', 'nghìn', ''];

/**
 * Đọc một nhóm 3 chữ số.
 *
 * `full` = true khi nhóm này không phải nhóm đầu tiên: lúc đó phải đọc cả
 * "không trăm" để giữ đúng vị trí hàng.
 */
function readTriple(value: number, full: boolean): string {
  const hundreds = Math.floor(value / 100);
  const tens = Math.floor((value % 100) / 10);
  const units = value % 10;
  const parts: string[] = [];

  if (hundreds > 0 || full) {
    parts.push(DIGITS[hundreds], 'trăm');
  }

  if (tens === 0) {
    // "một trăm lẻ năm" — không có hàng chục nhưng còn hàng đơn vị.
    if (units > 0 && (hundreds > 0 || full)) parts.push('lẻ', DIGITS[units]);
    else if (units > 0) parts.push(DIGITS[units]);
  } else if (tens === 1) {
    parts.push('mười');
    // 11 → "mười một", 15 → "mười lăm".
    if (units === 5) parts.push('lăm');
    else if (units > 0) parts.push(DIGITS[units]);
  } else {
    parts.push(DIGITS[tens], 'mươi');
    // 21 → "hai mươi mốt", 25 → "hai mươi lăm".
    if (units === 1) parts.push('mốt');
    else if (units === 5) parts.push('lăm');
    else if (units > 0) parts.push(DIGITS[units]);
  }

  return parts.join(' ');
}

/** Số thành chữ, chưa có đơn vị tiền. */
export function numberInWords(input: number): string {
  const n = Math.round(Math.abs(Number(input) || 0));
  if (n === 0) return 'không';

  // Tách thành các nhóm 3 chữ số, từ trái sang phải.
  const triples: number[] = [];
  let rest = n;
  while (rest > 0) {
    triples.unshift(rest % 1000);
    rest = Math.floor(rest / 1000);
  }

  const offset = GROUPS.length - triples.length;
  const parts: string[] = [];

  triples.forEach((triple, index) => {
    const label = GROUPS[offset + index];
    // Nhóm toàn số 0 thì bỏ qua tên nhóm luôn: 1.000.000 là "một triệu",
    // không phải "một triệu không nghìn".
    if (triple === 0) return;
    parts.push(readTriple(triple, index > 0));
    if (label) parts.push(label);
  });

  return parts.join(' ');
}

/** Viết hoa chữ cái đầu, phần còn lại giữ nguyên. */
function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Dòng "Bằng chữ" hoàn chỉnh: "Một triệu sáu trăm năm mươi nghìn đồng".
 *
 * Số âm có thật trong nghiệp vụ này — hoa hồng bị cấn trừ khi khách trả hàng
 * (#007) có thể làm kỳ đối soát ra số âm — nên được đọc là "âm …" thay vì bị
 * nuốt mất dấu.
 */
export function vndInWords(amount: number): string {
  const n = Math.round(Number(amount) || 0);
  const words = `${numberInWords(n)} đồng`;
  return capitalize(n < 0 ? `âm ${words}` : words);
}
