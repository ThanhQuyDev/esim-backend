import { numberInWords, vndInWords } from './vnd-in-words';

/**
 * "Bằng chữ:" trên biên bản đối soát (#006).
 *
 * Biên bản này hai bên ký, nên dòng chữ sai là một văn bản sai — file mẫu được
 * gửi kèm đã mắc đúng lỗi đó (số 1.081.691 nhưng chữ đọc là "một triệu sáu trăm
 * năm mươi nghìn").
 */
describe('đọc số tiền thành chữ', () => {
  describe('các con số trong file mẫu', () => {
    it('should đọc đúng số tiền của biên bản mẫu', () => {
      expect(vndInWords(1_650_000)).toBe(
        'Một triệu sáu trăm năm mươi nghìn đồng',
      );
    });

    it('should đọc đủ "không trăm" ở nhóm giữa', () => {
      // Bỏ "không trăm" là ra một số khác hẳn.
      expect(numberInWords(1_081_691)).toBe(
        'một triệu không trăm tám mươi mốt nghìn sáu trăm chín mươi mốt',
      );
    });
  });

  describe('các quy tắc tiếng Việt dễ sai', () => {
    it('should đọc 15 là "mười lăm"', () => {
      expect(numberInWords(15)).toBe('mười lăm');
      expect(numberInWords(11)).toBe('mười một');
      expect(numberInWords(10)).toBe('mười');
    });

    it('should đọc 21 là "hai mươi mốt"', () => {
      expect(numberInWords(21)).toBe('hai mươi mốt');
      expect(numberInWords(31)).toBe('ba mươi mốt');
    });

    it('should đọc 25 là "hai mươi lăm"', () => {
      expect(numberInWords(25)).toBe('hai mươi lăm');
      expect(numberInWords(95)).toBe('chín mươi lăm');
    });

    it('should dùng "lẻ" khi thiếu hàng chục', () => {
      expect(numberInWords(105)).toBe('một trăm lẻ năm');
      expect(numberInWords(101)).toBe('một trăm lẻ một');
    });

    it('should không thêm tên nhóm cho nhóm toàn số 0', () => {
      // "một triệu", không phải "một triệu không nghìn".
      expect(numberInWords(1_000_000)).toBe('một triệu');
      expect(numberInWords(2_000)).toBe('hai nghìn');
    });
  });

  describe('các mốc', () => {
    it('should đọc được số 0', () => {
      expect(vndInWords(0)).toBe('Không đồng');
    });

    it('should đọc được hàng tỷ', () => {
      expect(numberInWords(1_234_567_890)).toBe(
        'một tỷ hai trăm ba mươi bốn triệu năm trăm sáu mươi bảy nghìn tám trăm chín mươi',
      );
    });

    it('should đọc số âm thay vì nuốt mất dấu', () => {
      // Hoa hồng bị cấn trừ khi khách trả hàng (#007) có thể làm kỳ đối soát
      // ra số âm.
      expect(vndInWords(-50_000)).toBe('Âm năm mươi nghìn đồng');
    });

    it('should làm tròn và chịu được dữ liệu rác', () => {
      expect(vndInWords(1_500_000.4)).toBe('Một triệu năm trăm nghìn đồng');
      expect(vndInWords(Number.NaN)).toBe('Không đồng');
    });

    it('should viết hoa chữ cái đầu', () => {
      expect(vndInWords(5_000)).toBe('Năm nghìn đồng');
    });
  });
});
