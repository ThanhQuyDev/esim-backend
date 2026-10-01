import {
  partnerPurchaseQuote,
  partnerPurchaseRejection,
  partnerPurchaseUnitPriceVnd,
} from './partner-purchase';
import { PartnerStatusEnum, PartnerTypeEnum } from './partners.enum';

/**
 * Đối tác phân phối mua hàng bằng ví (#046).
 *
 * Mỗi ca ở đây canh một cách mất tiền thật: bán dưới giá vốn, cho mua quá số
 * dư, hoặc hiện cho đối tác một con số lãi không có thật.
 */
describe('partner purchase', () => {
  describe('giá bán cho đối tác', () => {
    it('should cộng markup của hạng vào giá vốn', () => {
      // Giá vốn 100.000đ, hạng markup 8% → 108.000đ một eSIM.
      expect(partnerPurchaseUnitPriceVnd(100000, 8)).toBe(108000);
    });

    it('should markup 0 thì bán đúng giá vốn', () => {
      expect(partnerPurchaseUnitPriceVnd(100000, 0)).toBe(100000);
    });

    it('should làm tròn tới đồng, không để số lẻ', () => {
      expect(partnerPurchaseUnitPriceVnd(99999, 7.5)).toBe(107499);
    });

    it('should không nhận số âm hay rác', () => {
      expect(partnerPurchaseUnitPriceVnd(-5000, 10)).toBe(0);
      expect(partnerPurchaseUnitPriceVnd(100000, -10)).toBe(100000);
      expect(partnerPurchaseUnitPriceVnd(NaN as never, 10)).toBe(0);
    });
  });

  describe('báo giá một lần mua', () => {
    it('should tính đủ tổng tiền, doanh thu bán ra và chênh lệch', () => {
      // Ví dụ của đề bài: 100 cái, giá vốn đối tác 108.000đ, niêm yết 150.000đ.
      const quote = partnerPurchaseQuote({
        unitCostVnd: 100000,
        costMarkupPercent: 8,
        listPriceVnd: 150000,
        quantity: 100,
      });

      expect(quote.unitPriceVnd).toBe(108000);
      expect(quote.totalVnd).toBe(10800000);
      expect(quote.listTotalVnd).toBe(15000000);
      expect(quote.marginVnd).toBe(4200000);
      expect(quote.marginPercent).toBe(28);
    });

    it('should giữ nguyên chênh lệch âm khi markup vượt giá niêm yết', () => {
      // Kẹp về 0 ở đây sẽ làm đối tác tưởng hoà vốn trong khi đang lỗ.
      const quote = partnerPurchaseQuote({
        unitCostVnd: 200000,
        costMarkupPercent: 10,
        listPriceVnd: 150000,
        quantity: 2,
      });

      // 2 × 220.000đ vốn so với 2 × 150.000đ niêm yết.
      expect(quote.marginVnd).toBe(-140000);
      expect(quote.marginPercent).toBeLessThan(0);
    });

    it('should không chia cho 0 khi gói chưa có giá niêm yết', () => {
      const quote = partnerPurchaseQuote({
        unitCostVnd: 100000,
        costMarkupPercent: 8,
        listPriceVnd: 0,
        quantity: 3,
      });

      expect(quote.listTotalVnd).toBe(0);
      expect(quote.marginPercent).toBe(0);
    });

    it('should cắt số lượng lẻ thành số nguyên', () => {
      expect(
        partnerPurchaseQuote({
          unitCostVnd: 100000,
          costMarkupPercent: 0,
          listPriceVnd: 150000,
          quantity: 2.9,
        }).quantity,
      ).toBe(2);
    });
  });

  describe('được phép mua hay không', () => {
    const quote = partnerPurchaseQuote({
      unitCostVnd: 100000,
      costMarkupPercent: 8,
      listPriceVnd: 150000,
      quantity: 100,
    });
    const ok = {
      partnerType: PartnerTypeEnum.DISTRIBUTION,
      partnerStatus: PartnerStatusEnum.ACTIVE,
      walletLocked: false,
      balanceVnd: 20000000,
    };

    it('should cho qua khi đủ điều kiện', () => {
      expect(partnerPurchaseRejection(ok, quote)).toBeNull();
    });

    it('should không giới hạn số lượng — đủ tiền là mua được', () => {
      // Chốt 02/10/2026: ví là ràng buộc duy nhất.
      const big = partnerPurchaseQuote({
        unitCostVnd: 100000,
        costMarkupPercent: 0,
        listPriceVnd: 150000,
        quantity: 10000,
      });
      expect(
        partnerPurchaseRejection({ ...ok, balanceVnd: 1_000_000_000 }, big),
      ).toBeNull();
    });

    it('should chặn đối tác tiếp thị', () => {
      expect(
        partnerPurchaseRejection(
          { ...ok, partnerType: PartnerTypeEnum.KOL },
          quote,
        ),
      ).toContain('tiếp thị');
    });

    it('should chặn tài khoản chưa kích hoạt', () => {
      expect(
        partnerPurchaseRejection(
          { ...ok, partnerStatus: PartnerStatusEnum.PENDING },
          quote,
        ),
      ).toContain('kích hoạt');
    });

    it('should chặn ví đang khoá', () => {
      expect(
        partnerPurchaseRejection({ ...ok, walletLocked: true }, quote),
      ).toContain('khoá');
    });

    it('should nói rõ còn thiếu bao nhiêu khi số dư không đủ', () => {
      const message = partnerPurchaseRejection(
        { ...ok, balanceVnd: 10000000 },
        quote,
      );
      expect(message).toContain('800.000đ');
    });

    it('should báo lý do gốc chứ không báo thiếu tiền khi ví bị khoá', () => {
      // Ví khoá + hết tiền: đối tác cần biết ví bị khoá, nạp thêm vô ích.
      expect(
        partnerPurchaseRejection(
          { ...ok, walletLocked: true, balanceVnd: 0 },
          quote,
        ),
      ).toContain('khoá');
    });

    it('should chặn gói chưa có giá vốn thay vì bán 0đ', () => {
      const free = partnerPurchaseQuote({
        unitCostVnd: 0,
        costMarkupPercent: 8,
        listPriceVnd: 150000,
        quantity: 5,
      });
      expect(partnerPurchaseRejection(ok, free)).toContain('chưa có giá vốn');
    });

    it('should chặn số lượng 0', () => {
      const none = partnerPurchaseQuote({
        unitCostVnd: 100000,
        costMarkupPercent: 8,
        listPriceVnd: 150000,
        quantity: 0,
      });
      expect(partnerPurchaseRejection(ok, none)).toContain('từ 1 trở lên');
    });
  });
});
