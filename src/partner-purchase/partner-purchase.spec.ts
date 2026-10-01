import { PartnerPurchaseService } from './partner-purchase.service';

/**
 * Luồng đối tác tự mua hàng (#046).
 *
 * Mỗi ca ở đây canh một cách mất tiền thật của một bên nào đó: đối tác bị trừ
 * tiền mà không có hàng, hoặc esim.vn giao hàng mà không thu được tiền.
 */
describe('PartnerPurchaseService', () => {
  const build = (over: Record<string, unknown> = {}) => {
    const calls: string[] = [];

    // Trả Promise để service `await` được, nhưng không khai `async` — trong
    // thân hàm không có `await` nào nên eslint sẽ bắt lỗi.
    const debitWalletForPurchase = jest.fn(() => {
      calls.push('debit');
      return Promise.resolve();
    });
    const refundWalletForPurchase = jest.fn(() => {
      calls.push('refund');
      return Promise.resolve();
    });
    const submitPartnerPurchase = jest.fn(async (input: any) => {
      calls.push('order');
      await input.onDebit(77, 'PTN-1-AAA');
      calls.push('provision');
      return { id: 77, orderNumber: 'PTN-1-AAA', status: 'completed' };
    });

    const service = Object.create(
      PartnerPurchaseService.prototype,
    ) as PartnerPurchaseService;
    const internals = service as unknown as Record<string, unknown>;

    internals.logger = { log: jest.fn(), error: jest.fn(), warn: jest.fn() };
    internals.partnersService = {
      getPartnerOrThrowById: jest.fn().mockResolvedValue({
        id: 8,
        userId: 100,
        contactName: 'Công ty ABC',
      }),
      quotePurchase: jest.fn().mockResolvedValue({
        quantity: 100,
        unitPriceVnd: 108000,
        totalVnd: 10800000,
        listUnitPriceVnd: 150000,
        listTotalVnd: 15000000,
        marginVnd: 4200000,
        marginPercent: 28,
        rejection: null,
      }),
      debitWalletForPurchase,
      refundWalletForPurchase,
      ...((over.partnersService as object) ?? {}),
    };
    internals.ordersService = {
      submitPartnerPurchase,
      cancelOrder: jest.fn().mockResolvedValue(undefined),
      ...((over.ordersService as object) ?? {}),
    };
    internals.dataSource = {
      query: over.query ?? jest.fn().mockResolvedValue([{ id: 5, slug: 'jp' }]),
    };

    return {
      service,
      calls,
      debitWalletForPurchase,
      refundWalletForPurchase,
      submitPartnerPurchase,
    };
  };

  describe('đặt mua', () => {
    it('should trừ ví TRƯỚC khi gọi nhà cung cấp', async () => {
      // Trừ sau thì có lúc đối tác đã cầm eSIM mà ví không đủ tiền để trừ.
      const { service, calls } = build({
        query: jest
          .fn()
          .mockResolvedValueOnce([{ id: 5, slug: 'jp' }])
          .mockResolvedValue([{ n: 100 }]),
      });

      await service.purchase(8, { planId: 5, quantity: 100 });

      expect(calls.indexOf('debit')).toBeLessThan(calls.indexOf('provision'));
    });

    it('should trừ đúng số tiền đã báo giá', async () => {
      const { service, debitWalletForPurchase } = build({
        query: jest
          .fn()
          .mockResolvedValueOnce([{ id: 5, slug: 'jp' }])
          .mockResolvedValue([{ n: 100 }]),
      });

      await service.purchase(8, { planId: 5, quantity: 100 });

      expect(debitWalletForPurchase).toHaveBeenCalledWith(
        8,
        expect.objectContaining({ amountVnd: 10800000, orderId: 77 }),
      );
    });

    it('should từ chối trước khi tạo đơn khi báo giá đã nói không mua được', async () => {
      const { service, submitPartnerPurchase } = build({
        partnersService: {
          quotePurchase: jest.fn().mockResolvedValue({
            quantity: 100,
            unitPriceVnd: 108000,
            totalVnd: 10800000,
            listUnitPriceVnd: 150000,
            listTotalVnd: 15000000,
            marginVnd: 4200000,
            marginPercent: 28,
            rejection: 'Số dư ví không đủ',
          }),
        },
      });

      await expect(
        service.purchase(8, { planId: 5, quantity: 100 }),
      ).rejects.toThrow('Số dư ví không đủ');
      expect(submitPartnerPurchase).not.toHaveBeenCalled();
    });

    it('should hoàn nguyên tiền khi không cấp được eSIM nào', async () => {
      const { service, refundWalletForPurchase } = build({
        query: jest
          .fn()
          .mockResolvedValueOnce([{ id: 5, slug: 'jp' }])
          .mockResolvedValue([{ n: 0 }]),
      });

      await expect(
        service.purchase(8, { planId: 5, quantity: 100 }),
      ).rejects.toThrow('Tiền đã được hoàn lại ví');

      expect(refundWalletForPurchase).toHaveBeenCalledWith(
        8,
        expect.objectContaining({
          amountVnd: 10800000,
          suffix: 'provisioning-failed',
        }),
      );
    });

    it('should giữ nguyên đơn khi chỉ cấp thiếu một phần', async () => {
      // Cấp 98/100 thì đối tác báo lỗi từng cái, admin duyệt tay (A4) — tự
      // hoàn một phần ở đây sẽ hoàn cả tiền của eSIM đang dùng được.
      const { service, refundWalletForPurchase } = build({
        query: jest
          .fn()
          .mockResolvedValueOnce([{ id: 5, slug: 'jp' }])
          .mockResolvedValue([{ n: 98 }]),
      });

      const result = await service.purchase(8, { planId: 5, quantity: 100 });

      expect(result.esimCount).toBe(98);
      expect(refundWalletForPurchase).not.toHaveBeenCalled();
    });

    it('should trả về cả doanh thu bán ra và chênh lệch', async () => {
      const { service } = build({
        query: jest
          .fn()
          .mockResolvedValueOnce([{ id: 5, slug: 'jp' }])
          .mockResolvedValue([{ n: 100 }]),
      });

      await expect(
        service.purchase(8, { planId: 5, quantity: 100 }),
      ).resolves.toMatchObject({
        totalVnd: 10800000,
        listPriceVnd: 15000000,
        marginVnd: 4200000,
      });
    });
  });

  describe('đối tác tự huỷ đơn', () => {
    it('should huỷ và hoàn tiền khi chưa cấp eSIM nào', async () => {
      const { service, refundWalletForPurchase } = build({
        query: jest
          .fn()
          .mockResolvedValueOnce([{ id: 77, status: 'pending' }]) // đơn
          .mockResolvedValueOnce([{ n: 0 }]) // số eSIM
          .mockResolvedValueOnce([{ costVnd: '10800000' }]), // đã trừ ví
      });

      await expect(service.cancelPurchase(8, 'PTN-1-AAA')).resolves.toEqual({
        orderNumber: 'PTN-1-AAA',
        refundedVnd: 10800000,
      });

      expect(refundWalletForPurchase).toHaveBeenCalledWith(
        8,
        expect.objectContaining({ amountVnd: 10800000, suffix: 'cancelled' }),
      );
    });

    it('should từ chối huỷ khi eSIM đã cấp', async () => {
      // eSIM đã cấp là hàng đã giao — đối tác có thể đã bán đi rồi.
      const { service, refundWalletForPurchase } = build({
        query: jest
          .fn()
          .mockResolvedValueOnce([{ id: 77, status: 'completed' }])
          .mockResolvedValueOnce([{ n: 100 }]),
      });

      await expect(service.cancelPurchase(8, 'PTN-1-AAA')).rejects.toThrow(
        'đã cấp 100 eSIM',
      );
      expect(refundWalletForPurchase).not.toHaveBeenCalled();
    });

    it('should báo không tìm thấy khi đơn không thuộc đối tác này', async () => {
      // Mã đơn đoán được, nên truy vấn đã lọc theo userId; không có dòng nào
      // nghĩa là đơn của người khác.
      const { service } = build({ query: jest.fn().mockResolvedValue([]) });

      await expect(service.cancelPurchase(8, 'PTN-9-ZZZ')).rejects.toThrow(
        'Không tìm thấy đơn',
      );
    });
  });
});
