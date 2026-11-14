import { BadRequestException } from '@nestjs/common';
import { PartnerPurchaseService } from './partner-purchase.service';

/**
 * vande-1411 #002: "Hàng đợi eSIM lỗi" asks for one row at a time. The row
 * narrows the retry; it never makes a line that may not be retried eligible.
 */
describe('Gọi lại từng dòng hàng đợi eSIM lỗi (vande-1411 #002)', () => {
  function build() {
    const service = Object.create(
      PartnerPurchaseService.prototype,
    ) as PartnerPurchaseService;
    const retryProvisioning = jest.fn().mockResolvedValue({
      retriedItemIds: [11],
      message: 'ok',
    });
    Object.assign(service as unknown as Record<string, unknown>, {
      logger: { error: jest.fn() },
      partnersService: {
        assertOwnsPurchase: jest.fn().mockResolvedValue({ orderId: 5 }),
        purchaseRetryLines: jest.fn().mockResolvedValue([
          { itemId: 11, canRetry: true },
          { itemId: 12, canRetry: true },
          { itemId: 13, canRetry: false },
        ]),
      },
      ordersService: { retryProvisioning },
    });
    return { service, retryProvisioning };
  }

  it('should ask for only the row that was pressed', async () => {
    const { service, retryProvisioning } = build();
    await service.retryPurchase(1, 'PTN-1', [11]);
    expect(retryProvisioning).toHaveBeenCalledWith(5, { itemIds: [11] });
  });

  it('should still ask for every eligible line without a row', async () => {
    const { service, retryProvisioning } = build();
    await service.retryPurchase(1, 'PTN-1');
    expect(retryProvisioning).toHaveBeenCalledWith(5, { itemIds: [11, 12] });
  });

  it('should refuse a row that may not be retried', async () => {
    const { service, retryProvisioning } = build();
    await expect(service.retryPurchase(1, 'PTN-1', [13])).rejects.toThrow(
      BadRequestException,
    );
    expect(retryProvisioning).not.toHaveBeenCalled();
  });
});
