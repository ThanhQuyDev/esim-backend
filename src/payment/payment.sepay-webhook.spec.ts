import { PaymentService } from './payment.service';
import { TOPUP_ORDER_STATUS } from '../topup/topup.constants';

/**
 * Regression tests for what the SePay webhook does with a transfer that lands
 * on an order which is no longer `pending`.
 *
 * The handler used to return `{ success: true }` for every non-pending status.
 * That is right for an order whose money is already accounted for, but a
 * `failed` order (auto-expired by the 30-minute cron, or cancelled by the
 * buyer) that later receives the transfer was silently written off: the money
 * stayed with us, nothing was provisioned and nothing was flagged.
 */

const CODE = 'ESIMAB12CD';

function buildService(order: Record<string, unknown> | null) {
  const ordersService = {
    findByBankTransferCode: jest.fn().mockResolvedValue(order),
    update: jest.fn().mockResolvedValue(undefined),
    finalizePaidOrder: jest.fn().mockResolvedValue(undefined),
    submitProviders: jest.fn().mockResolvedValue(undefined),
    clearCartForUser: jest.fn().mockResolvedValue(undefined),
    applyCouponAndClearCart: jest.fn().mockResolvedValue(undefined),
  };
  const topupService = { executeTopup: jest.fn().mockResolvedValue(undefined) };
  const partnersService = {
    findDepositRequestByBankTransferCode: jest.fn().mockResolvedValue(null),
  };
  const service = new PaymentService(
    {} as never,
    ordersService as never,
    {} as never,
    {} as never,
    topupService as never,
    partnersService as never,
  );
  return { service, ordersService, topupService };
}

function payload(overrides: Record<string, unknown> = {}) {
  return {
    id: 4242,
    gateway: 'TCB',
    transferType: 'in',
    transferAmount: 119000,
    content: `${CODE} chuyen tien`,
    referenceCode: 'FT26000123',
    accountNumber: '19000000000000',
    ...overrides,
  };
}

describe('PaymentService — SePay webhook on a non-pending order', () => {
  it('should flag a failed order for reconciliation instead of dropping the payment', async () => {
    const { service, ordersService, topupService } = buildService({
      id: 55,
      orderNumber: 'TOPUP-1-ABC',
      orderType: 'TOPUP',
      status: 'failed',
      vndPrice: 119000,
      payableVndPrice: 119000,
      userId: 2,
    });

    await expect(service.handleSepayWebhook(payload())).resolves.toEqual({
      success: true,
    });

    expect(ordersService.update).toHaveBeenCalledWith(55, {
      status: TOPUP_ORDER_STATUS.MANUAL_INTERVENTION,
      paymentMethod: 'bank_transfer',
      paymentId: 'FT26000123',
    });
    // Nothing may be provisioned off a written-off order.
    expect(topupService.executeTopup).not.toHaveBeenCalled();
    expect(ordersService.finalizePaidOrder).not.toHaveBeenCalled();
  });

  it('should stay idempotent when the same event is delivered for a paid order', async () => {
    const { service, ordersService, topupService } = buildService({
      id: 56,
      orderNumber: 'ORD-2-DEF',
      orderType: 'BUY_NEW',
      status: TOPUP_ORDER_STATUS.PAID,
      vndPrice: 119000,
      payableVndPrice: 119000,
      userId: 2,
    });

    await expect(service.handleSepayWebhook(payload())).resolves.toEqual({
      success: true,
    });

    expect(ordersService.update).not.toHaveBeenCalled();
    expect(ordersService.finalizePaidOrder).not.toHaveBeenCalled();
    expect(topupService.executeTopup).not.toHaveBeenCalled();
  });

  it('should not re-flag an order already awaiting manual intervention', async () => {
    const { service, ordersService } = buildService({
      id: 57,
      orderNumber: 'TOPUP-3-GHI',
      orderType: 'TOPUP',
      status: TOPUP_ORDER_STATUS.MANUAL_INTERVENTION,
      vndPrice: 119000,
      payableVndPrice: 119000,
      userId: 2,
    });

    await service.handleSepayWebhook(payload());

    expect(ordersService.update).not.toHaveBeenCalled();
  });
});
