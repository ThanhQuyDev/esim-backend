import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PartnerPurchaseService } from './partner-purchase.service';

/**
 * doitac-1410 #039 — the actions on one eSIM's page in the partner portal:
 * "Gửi lại email eSIM", the topup package list and "Topup hộ khách".
 *
 * An ICCID is easy to guess, so each action must refuse an eSIM the partner
 * did not buy before it does anything.
 */
describe('Partner eSIM actions (doitac-1410 #039)', () => {
  const build = (
    opts: { owns?: boolean; rejection?: string | null; sent?: number } = {},
  ) => {
    const assertOwnsEsim = jest.fn(() =>
      opts.owns === false
        ? Promise.reject(new NotFoundException('Không tìm thấy eSIM'))
        : Promise.resolve({ esimId: 3, orderId: 77, orderNumber: 'PTN-1' }),
    );
    const debitWalletForPurchase = jest.fn().mockResolvedValue({});
    const partnersService = {
      assertOwnsPurchase: jest.fn((_p: number, code: string) =>
        Promise.resolve({
          orderId: 77,
          orderNumber: code,
          orderType: code.startsWith('TOPUP') ? 'TOPUP' : 'BUY_NEW',
        }),
      ),
      assertOwnsEsim,
      getPartnerOrThrowById: jest
        .fn()
        .mockResolvedValue({ id: 11, userId: 20 }),
      partnerAgentPriceVnd: jest.fn((_id: number, cost: number) =>
        Promise.resolve(Math.round((cost * 1.2) / 1000) * 1000),
      ),
      partnerWalletPaymentRejection: jest
        .fn()
        .mockResolvedValue(opts.rejection ?? null),
      debitWalletForPurchase,
    };
    const ordersService = {
      resendEsimEmail: jest.fn().mockResolvedValue({ sent: opts.sent ?? 1 }),
    };
    const topupService = {
      listPackagesWithCost: jest.fn().mockResolvedValue({
        iccid: 'X',
        provider: 'BILLION',
        packages: [
          {
            packageId: '42',
            name: 'Thailand 3GB',
            dataAmountText: '3GB',
            durationDays: 7,
            isUnlimited: false,
            price: 4,
            retailPrice: 7,
            vndPrice: 179000,
            costVnd: 100000,
          },
          {
            packageId: '43',
            name: 'No cost',
            dataAmountText: '1GB',
            durationDays: 1,
            isUnlimited: false,
            price: 0,
            retailPrice: 1,
            vndPrice: 30000,
            costVnd: 0,
          },
        ],
      }),
      checkoutForPartner: jest.fn(
        async (
          _userId: number,
          _input: unknown,
          priceFor: (c: number) => Promise<number>,
          pay: (
            o: { id: number; orderNumber: string },
            a: number,
          ) => Promise<void>,
        ) => {
          const amountVnd = await priceFor(100000);
          await pay({ id: 9, orderNumber: 'TOPUP-9' }, amountVnd);
          return { orderNumber: 'TOPUP-9', status: 'completed', amountVnd };
        },
      ),
    };

    const service = Object.create(
      PartnerPurchaseService.prototype,
    ) as PartnerPurchaseService;
    const internals = service as unknown as Record<string, unknown>;
    internals.logger = { log: jest.fn(), error: jest.fn(), warn: jest.fn() };
    internals.partnersService = partnersService;
    internals.ordersService = ordersService;
    internals.topupService = topupService;
    return { service, partnersService, ordersService, topupService };
  };

  it('should resend the email of that one eSIM only', async () => {
    const { service, ordersService } = build();
    await expect(service.resendEsimEmail(11, '8900')).resolves.toEqual({
      sent: 1,
    });
    expect(ordersService.resendEsimEmail).toHaveBeenCalledWith(77, {
      onlyIccid: '8900',
    });
  });

  it('should say so when nothing could be mailed', async () => {
    const { service } = build({ sent: 0 });
    await expect(service.resendEsimEmail(11, '8900')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('should list topup packages at the agent price, without the supplier cost', async () => {
    const { service } = build();
    const list = await service.listTopupPackages(11, '8900');
    expect(list[0]).toEqual({
      packageId: '42',
      name: 'Thailand 3GB',
      dataText: '3GB',
      durationDays: 7,
      isUnlimited: false,
      agentPriceVnd: 120000,
      retailPriceVnd: 179000,
      purchasable: true,
    });
    expect(list[0]).not.toHaveProperty('costVnd');
    expect(list[1]).toMatchObject({ agentPriceVnd: 0, purchasable: false });
  });

  it('should debit the wallet at the agent price for a topup', async () => {
    const { service, partnersService, topupService } = build();
    const result = await service.topupEsim(11, '8900', '42');
    expect(topupService.checkoutForPartner).toHaveBeenCalledWith(
      20,
      { iccid: '8900', packageId: '42' },
      expect.any(Function),
      expect.any(Function),
    );
    expect(partnersService.debitWalletForPurchase).toHaveBeenCalledWith(
      11,
      expect.objectContaining({
        orderId: 9,
        orderNumber: 'TOPUP-9',
        amountVnd: 120000,
      }),
    );
    expect(result).toEqual({
      orderNumber: 'TOPUP-9',
      status: 'completed',
      amountVnd: 120000,
    });
  });

  it('should not debit when the wallet cannot pay', async () => {
    const { service, partnersService } = build({
      rejection: 'Số dư ví không đủ',
    });
    await expect(service.topupEsim(11, '8900', '42')).rejects.toThrow(
      'Số dư ví không đủ',
    );
    expect(partnersService.debitWalletForPurchase).not.toHaveBeenCalled();
  });

  it('should refuse every action on an eSIM the partner did not buy', async () => {
    const { service, ordersService, topupService } = build({ owns: false });
    await expect(service.resendEsimEmail(11, 'x')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.listTopupPackages(11, 'x')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.topupEsim(11, 'x', '42')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(ordersService.resendEsimEmail).not.toHaveBeenCalled();
    expect(topupService.listPackagesWithCost).not.toHaveBeenCalled();
    expect(topupService.checkoutForPartner).not.toHaveBeenCalled();
  });

  it('should resend every eSIM of an order (doitac-1410 #042)', async () => {
    const { service, ordersService } = build({ sent: 3 });
    await expect(service.resendPurchaseEmail(11, 'PTN-1')).resolves.toEqual({
      sent: 3,
    });
    expect(ordersService.resendEsimEmail).toHaveBeenCalledWith(77);
  });

  it('should not resend a topup order, which has no eSIM of its own', async () => {
    const { service, ordersService } = build();
    await expect(
      service.resendPurchaseEmail(11, 'TOPUP-9'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(ordersService.resendEsimEmail).not.toHaveBeenCalled();
  });
});
