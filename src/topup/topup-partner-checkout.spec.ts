import { BadRequestException } from '@nestjs/common';
import { TopupService } from './topup.service';
import {
  PARTNER_WALLET_PAYMENT_METHOD,
  TOPUP_ORDER_STATUS,
} from './topup.constants';

/**
 * doitac-1410 #039 — "Topup hộ khách" from the partner portal, paid from the
 * partner's deposit wallet at cost + tier markup.
 *
 * What must hold: the order is priced at the partner's price (not retail),
 * nothing is recharged unless the wallet paid, and a refused payment leaves no
 * pending order behind.
 */
describe('Topup bought by a distribution partner (doitac-1410 #039)', () => {
  const ORDER = { id: 9, orderNumber: 'TOPUP-9', vndCostPrice: 100000 };

  function makeService(opts: { costVnd?: number } = {}) {
    const updates: Record<string, unknown>[] = [];
    const orderRepository = {
      update: jest.fn((_id: unknown, payload: Record<string, unknown>) => {
        updates.push(payload);
        return Promise.resolve(payload);
      }),
      findByOrderNumber: jest.fn().mockResolvedValue({
        ...ORDER,
        status: TOPUP_ORDER_STATUS.COMPLETED,
      }),
    };
    const service = Object.create(TopupService.prototype) as TopupService;
    const internals = service as unknown as Record<string, unknown>;
    internals.orderRepository = orderRepository;
    internals.logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
    internals.resolveProviderForIccid = jest
      .fn()
      .mockResolvedValue({ provider: 'BILLION', esim: {} });
    internals.createPendingTopupOrder = jest.fn().mockResolvedValue({
      order: { ...ORDER, vndCostPrice: opts.costVnd ?? ORDER.vndCostPrice },
      vndAmount: 179000,
    });
    internals.executeTopup = jest.fn().mockResolvedValue(undefined);
    return { service, updates, internals };
  }

  const INPUT = { iccid: '8900000633806287368', packageId: '42' };

  it('should price at the partner price, debit, mark paid and recharge', async () => {
    const { service, updates, internals } = makeService();
    const pay = jest.fn().mockResolvedValue(undefined);

    const result = await service.checkoutForPartner(
      20,
      INPUT,
      (cost) => Promise.resolve(cost + 10000),
      pay,
    );

    expect(internals.createPendingTopupOrder).toHaveBeenCalledWith(
      20,
      expect.objectContaining({
        iccid: INPUT.iccid,
        packageId: '42',
        provider: 'BILLION',
        paymentMethod: PARTNER_WALLET_PAYMENT_METHOD,
      }),
    );
    expect(updates[0]).toMatchObject({
      vndPrice: 110000,
      subtotalVndPrice: 110000,
      payableVndPrice: 0,
    });
    expect(pay).toHaveBeenCalledWith({ id: 9, orderNumber: 'TOPUP-9' }, 110000);
    expect(updates[1]).toMatchObject({ status: TOPUP_ORDER_STATUS.PAID });
    expect(internals.executeTopup).toHaveBeenCalledWith('TOPUP-9');
    expect(result).toEqual({
      orderNumber: 'TOPUP-9',
      status: TOPUP_ORDER_STATUS.COMPLETED,
      amountVnd: 110000,
    });
  });

  it('should fail the order and never recharge when the wallet refuses', async () => {
    const { service, updates, internals } = makeService();
    const pay = jest
      .fn()
      .mockRejectedValue(new BadRequestException('Số dư ví không đủ'));

    await expect(
      service.checkoutForPartner(20, INPUT, (c) => Promise.resolve(c), pay),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(updates[updates.length - 1]).toMatchObject({
      status: TOPUP_ORDER_STATUS.FAILED,
    });
    expect(updates.some((u) => u.status === TOPUP_ORDER_STATUS.PAID)).toBe(
      false,
    );
    expect(internals.executeTopup).not.toHaveBeenCalled();
  });

  it('should refuse a package with no cost yet instead of selling it at 0đ', async () => {
    const { service, updates, internals } = makeService({ costVnd: 0 });
    const pay = jest.fn();

    await expect(
      service.checkoutForPartner(20, INPUT, (c) => Promise.resolve(c), pay),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(pay).not.toHaveBeenCalled();
    expect(updates[0]).toMatchObject({ status: TOPUP_ORDER_STATUS.FAILED });
    expect(internals.executeTopup).not.toHaveBeenCalled();
  });
});
