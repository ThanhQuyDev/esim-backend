import { OrdersService } from './orders.service';
import { WalletsService } from '../wallets/wallets.service';

/**
 * vande-1411 #009: an order marked failed whose eSIM came back anyway can be
 * refunded from the eSIM's page — only for an eSIM it delivered, and only the
 * cash: its eXU hold went back when it failed.
 */
describe('Hoàn tiền đơn lỗi đã có eSIM (vande-1411 #009)', () => {
  function orders(order: Record<string, unknown>, esims: { status: string }[]) {
    const s = Object.create(OrdersService.prototype) as OrdersService;
    Object.assign(s as unknown as Record<string, unknown>, {
      orderRepository: { findById: jest.fn().mockResolvedValue(order) },
      orderItemsService: {
        findByOrderId: jest.fn().mockResolvedValue([{ id: 1 }]),
      },
      esimsService: { findByOrderItemIds: jest.fn().mockResolvedValue(esims) },
    });
    return s;
  }

  it('should refuse a failed order that delivered no eSIM, before any supplier is asked', async () => {
    const s = orders({ id: 9, orderNumber: 'ORD-X', status: 'failed' }, []);
    await expect(
      s.refundOrder(9, { amountVnd: 1000 } as never, 1),
    ).rejects.toThrow('chưa có eSIM nào được giao');
  });

  it('should still refuse a pending order', async () => {
    const s = orders({ id: 9, orderNumber: 'ORD-X', status: 'pending' }, [
      { status: 'sold' },
    ]);
    await expect(
      s.refundOrder(9, { amountVnd: 1000 } as never, 1),
    ).rejects.toThrow('Only paid orders can be refunded');
  });

  it('should refund only the cash of a failed order, not its released eXU', async () => {
    const wallets = Object.create(WalletsService.prototype) as WalletsService;
    const failed = {
      id: 9,
      status: 'failed',
      payableVndPrice: 0,
      vndPrice: 0,
      walletSpentVndAmount: 72_000,
      refundedAmountVnd: 0,
    };
    await expect(
      wallets.refundOrder(failed as never, { amountVnd: 72_000 } as never, 1),
    ).rejects.toThrow('cannot exceed');
  });
});
