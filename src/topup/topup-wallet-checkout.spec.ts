import { BadRequestException } from '@nestjs/common';
import { TopupService } from './topup.service';
import { TOPUP_ORDER_STATUS } from './topup.constants';
import { EXU_WALLET_PAYMENT_METHOD } from './dto/topup-checkout.dto';

/**
 * #028 — topup paid from the customer's eXu balance.
 *
 * There is no gateway to come back from, so the money and the recharge settle in
 * one call. The dangerous parts: charging the balance and then not recharging,
 * recharging without charging, and leaving a pending order behind when the
 * balance was too low.
 */
describe('Topup paid from the eXu balance (#028)', () => {
  const ORDER = { id: 5, orderNumber: 'TOPUP-5' };

  function makeService(
    opts: { holdFails?: boolean; finalStatus?: string } = {},
  ) {
    const updates: Record<string, unknown>[] = [];
    const captured: number[] = [];

    const orderRepository = {
      update: jest.fn((_id: unknown, payload: Record<string, unknown>) => {
        updates.push(payload);
        return Promise.resolve(payload);
      }),
      findByOrderNumber: jest.fn().mockResolvedValue({
        ...ORDER,
        status: opts.finalStatus ?? TOPUP_ORDER_STATUS.COMPLETED,
      }),
    };
    const walletsService = {
      createHold: jest.fn(() =>
        opts.holdFails
          ? Promise.reject(new BadRequestException('Số dư eXu không đủ.'))
          : Promise.resolve({ id: 1 }),
      ),
      captureHoldForOrder: jest.fn((orderId: number) => {
        captured.push(orderId);
        return Promise.resolve({ id: 2 });
      }),
    };

    const service = Object.create(TopupService.prototype) as TopupService;
    const internals = service as unknown as Record<string, unknown>;
    internals.orderRepository = orderRepository;
    internals.walletsService = walletsService;
    internals.logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
    internals.createPendingTopupOrder = jest
      .fn()
      .mockResolvedValue({ order: ORDER, vndAmount: 179000 });
    internals.executeTopup = jest.fn().mockResolvedValue(undefined);

    return { service, updates, captured, walletsService, internals };
  }

  const DTO = {
    iccid: '8901234567890123456',
    packageId: 'Vietnam-3days-3gb-topup',
    provider: 'AIRALO',
    paymentMethod: 'EXU_WALLET',
  } as never;

  it('should holds the balance, marks the order paid, captures and recharges — in that order', async () => {
    const { service, updates, captured, walletsService, internals } =
      makeService();

    const result = await service.checkoutWithWallet(7, DTO);

    expect(walletsService.createHold).toHaveBeenCalledWith(5, 7, 179000);
    expect(updates[0]).toMatchObject({
      status: TOPUP_ORDER_STATUS.PAID,
      paymentMethod: EXU_WALLET_PAYMENT_METHOD,
      walletSpentVndAmount: 179000,
      payableVndPrice: 0,
    });
    expect(captured).toEqual([5]);
    expect(internals.executeTopup).toHaveBeenCalledWith('TOPUP-5');
    expect(result).toMatchObject({
      success: true,
      walletSpentVndAmount: 179000,
    });
  });

  it('should fails the order and never recharges when the balance is too low', async () => {
    const { service, updates, captured, internals } = makeService({
      holdFails: true,
    });

    await expect(service.checkoutWithWallet(7, DTO)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    // The pending order must not be left sitting there unpaid…
    expect(updates[0]).toMatchObject({ status: TOPUP_ORDER_STATUS.FAILED });
    // …and nothing may be charged or recharged.
    expect(captured).toEqual([]);
    expect(internals.executeTopup).not.toHaveBeenCalled();
  });

  it('should never marks the order paid when the hold failed', async () => {
    const { service, updates } = makeService({ holdFails: true });

    await expect(service.checkoutWithWallet(7, DTO)).rejects.toThrow();

    expect(updates.some((u) => u.status === TOPUP_ORDER_STATUS.PAID)).toBe(
      false,
    );
  });

  it('should reports success = false when the provider has not applied it yet', async () => {
    // The money is taken and the order is paid, but the recharge is pending: the
    // caller must not be told it worked.
    const { service } = makeService({ finalStatus: TOPUP_ORDER_STATUS.PAID });

    const result = await service.checkoutWithWallet(7, DTO);

    expect(result.success).toBe(false);
    expect(result.status).toBe(TOPUP_ORDER_STATUS.PAID);
  });

  it('should leaves nothing payable through a gateway', async () => {
    const { service, updates } = makeService();

    await service.checkoutWithWallet(7, DTO);

    expect(updates[0].payableVndPrice).toBe(0);
  });
});
