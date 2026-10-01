import { TopupService } from './topup.service';
import { OrderType } from './topup.constants';
import { WalletsService } from '../wallets/wallets.service';
import { OrderReferralStatusEnum } from '../wallets/wallets.enum';

/**
 * #032 — a Topup order runs no promotion: no coupon, no referral code, no
 * affiliate commission, no % back into the eXu wallet.
 *
 * None of those could fire today, but only by accident: the checkout DTO has no
 * coupon field and the order row happens to be written with zeros. These tests
 * pin the behaviour at the two places money is actually decided, so a later
 * change has to break a test before it can pay a reward on a topup.
 *
 * The affiliate half is covered separately in
 * `partners/partner-topup-excluded.spec.ts`.
 */
describe('Topup earns no promotion (#032)', () => {
  describe('the order the checkout writes', () => {
    const PKG = {
      packageId: 'Vietnam-3days-3gb-topup',
      name: '3 GB - 3 Days',
      dataAmountText: '3 GB',
      durationDays: 3,
      isUnlimited: false,
      price: 4.5,
      retailPrice: 6,
      vndPrice: 179000,
    };

    function makeService() {
      const created: Record<string, unknown>[] = [];
      const service = Object.create(TopupService.prototype) as TopupService;
      const internals = service as unknown as Record<string, unknown>;

      internals.orderRepository = {
        create: jest.fn((payload: Record<string, unknown>) => {
          created.push(payload);
          return Promise.resolve({ id: 9, orderNumber: 'TOPUP-9', ...payload });
        }),
      };
      internals.invoicesService = { createForOrder: jest.fn() };
      internals.logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
      internals.resolveProviderForIccid = jest
        .fn()
        .mockResolvedValue({ provider: 'AIRALO' });
      internals.listPackages = jest.fn().mockResolvedValue({ packages: [PKG] });
      internals.fetchVndRate = jest.fn().mockResolvedValue(25500);

      return { service, created };
    }

    const DTO = {
      iccid: '8901234567890123456',
      packageId: PKG.packageId,
      provider: 'AIRALO',
      paymentMethod: 'ONEPAY',
    } as never;

    async function createOrder() {
      const { service, created } = makeService();
      const internals = service as unknown as {
        createPendingTopupOrder: (u: number, d: never) => Promise<unknown>;
      };
      await internals.createPendingTopupOrder(7, DTO);
      return created[0];
    }

    it('should carries no coupon and no discount', async () => {
      const order = await createOrder();

      expect(order.couponCode).toBeNull();
      expect(order.discountAmount).toBe(0);
      expect(order.couponDiscountVndAmount).toBe(0);
    });

    it('should carries no referral code, referrer or referral discount', async () => {
      const order = await createOrder();

      expect(order.referralCode).toBeNull();
      expect(order.referrerUserId).toBeNull();
      expect(order.referralDiscountVndAmount).toBe(0);
    });

    it('should promises no eXu cashback', async () => {
      const order = await createOrder();

      expect(order.cashbackAmountVnd).toBe(0);
      expect(order.cashbackTransactionId).toBeNull();
    });

    it('should charges the full package price — nothing is discounted away', async () => {
      const order = await createOrder();

      // subtotal == payable: with no coupon and no referral there is nothing
      // between the two.
      expect(order.subtotalVndPrice).toBe(PKG.vndPrice);
      expect(order.payableVndPrice).toBe(PKG.vndPrice);
      expect(order.orderType).toBe(OrderType.TOPUP);
    });
  });

  describe('the benefits a paid order grants', () => {
    function makeWallets() {
      const transactions: { userId: number; type: string; amount: number }[] =
        [];
      const savedReferrals: Record<string, unknown>[] = [];
      const captured: number[] = [];

      const service = Object.create(WalletsService.prototype) as WalletsService;
      const internals = service as unknown as Record<string, unknown>;

      internals.logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
      internals.createTransaction = jest.fn(
        (userId: number, type: string, amount: number) => {
          transactions.push({ userId, type, amount });
          return Promise.resolve({ id: transactions.length });
        },
      );
      internals.orderRepository = { update: jest.fn() };
      internals.captureHoldForOrder = jest.fn((orderId: number) => {
        captured.push(orderId);
        return Promise.resolve({ id: 1 });
      });
      internals.recordPurchaseSpend = jest.fn().mockResolvedValue(undefined);
      internals.orderReferralRepository = {
        findOne: jest.fn().mockResolvedValue({
          id: 3,
          orderId: 9,
          referrerUserId: 42,
          refereeUserId: 7,
          rewardVnd: 50000,
          status: OrderReferralStatusEnum.PENDING,
          rewardTransactionId: null,
        }),
        save: jest.fn((row: Record<string, unknown>) => {
          savedReferrals.push(row);
          return Promise.resolve(row);
        }),
      };

      return { service, transactions, savedReferrals, captured, internals };
    }

    /**
     * Deliberately hostile: a topup order that *does* carry a cashback figure and
     * *does* have a pending referral row. Neither may pay out.
     */
    function order(orderType: string) {
      return {
        id: 9,
        userId: 7,
        orderType,
        walletSpentVndAmount: 179000,
        cashbackAmountVnd: 3580,
        cashbackPercentSnapshot: 2,
        cashbackTransactionId: null,
        eligibleSpendVnd: 179000,
      } as never;
    }

    it('should pays no eXu cashback on a topup', async () => {
      const { service, transactions, internals } = makeWallets();

      await service.completePaidOrderBenefits(order(OrderType.TOPUP));

      expect(transactions).toEqual([]);
      // …and the order is not stamped with a cashback transaction it never got.
      expect(
        (internals.orderRepository as { update: jest.Mock }).update,
      ).not.toHaveBeenCalled();
    });

    it('should pays no referral reward on a topup', async () => {
      const { service, savedReferrals, transactions } = makeWallets();

      await service.completePaidOrderBenefits(order(OrderType.TOPUP));

      expect(savedReferrals).toEqual([]);
      expect(transactions.some((t) => t.userId === 42)).toBe(false);
    });

    it('should still captures the eXu the customer spent on the topup', async () => {
      // The guard skips rewards, not the money: #028 pays topups from the eXu
      // balance and that hold has to be captured.
      const { service, captured } = makeWallets();

      await service.completePaidOrderBenefits(order(OrderType.TOPUP));

      expect(captured).toEqual([9]);
    });

    it('should still pays both on a normal eSIM order', async () => {
      // Proves the two tests above fail for the reason claimed — the topup guard —
      // and not because the mocks never pay anything.
      const { service, transactions, savedReferrals } = makeWallets();

      await service.completePaidOrderBenefits(order(OrderType.BUY_NEW));

      expect(transactions).toEqual([
        expect.objectContaining({ userId: 7, amount: 3580 }),
        expect.objectContaining({ userId: 42, amount: 50000 }),
      ]);
      expect(savedReferrals[0]).toMatchObject({
        status: OrderReferralStatusEnum.CREDITED,
      });
    });

    it('should logs a warning when a topup order somehow carries a cashback figure', async () => {
      const { service, internals } = makeWallets();

      await service.completePaidOrderBenefits(order(OrderType.TOPUP));

      const logger = internals.logger as { warn: jest.Mock };
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('TOPUP carrying cashbackAmountVnd=3580'),
      );
    });
  });
});
