import { BadRequestException } from '@nestjs/common';
import { PartnersService } from './partners.service';
import {
  PartnerDepositRequestStatusEnum,
  PartnerTopupMethodEnum,
  PartnerTypeEnum,
} from './partners.enum';
import {
  PARTNER_CARD_TOPUP_FEE_PERCENT,
  PARTNER_DEPOSIT_MAX_VND,
  PARTNER_DEPOSIT_MIN_VND,
} from './partners.constants';

/**
 * Topping up the ký quỹ wallet (#047).
 *
 * No request to raise and nobody to wait for: the partner types an amount and
 * pays. A transfer is credited in full; a card goes through OnePay, which
 * charges, and the brief puts that on the partner — send 100.000đ by card and
 * 94.000đ reaches the wallet.
 */

function buildService(
  opts: {
    partnerType?: PartnerTypeEnum;
    existing?: Record<string, unknown>;
  } = {},
) {
  const save = jest
    .fn()
    .mockImplementation((row) => Promise.resolve({ id: 42, ...row }));
  const buildPaymentUrl = jest
    .fn()
    .mockReturnValue(
      'https://onepay.example/pay?vpc_MerchTxnRef=PDEP-42-ESIMABC',
    );
  const createWalletTransaction = jest.fn().mockResolvedValue({ id: 7 });

  const service = Object.create(PartnersService.prototype) as PartnersService;
  Object.assign(service, {
    logger: { warn: jest.fn(), log: jest.fn(), error: jest.fn() },
    // The programme's thresholds now live in a settings row (#075).
    programSettingRepository: {
      findOne: jest.fn().mockResolvedValue({
        payoutMinKolVnd: 50_000,
        payoutMinDistributionVnd: 50_000,
        depositMinKolVnd: 100_000,
        depositMinDistributionVnd: 100_000,
        lowDepositWarningVnd: 500_000,
      }),
    },
    configService: {
      get: () => ({
        accountNumber: '19036789',
        accountName: 'CONG TY ESIM',
        bankCode: 'TCB',
      }),
    },
    getPartnerOrThrowById: jest.fn().mockResolvedValue({
      id: 8,
      userId: 100,
      partnerType: opts.partnerType ?? PartnerTypeEnum.DISTRIBUTION,
    }),
    depositRequestRepository: {
      create: (row: unknown) => row,
      save,
      findOne: jest.fn().mockResolvedValue(
        opts.existing === undefined
          ? {
              id: 42,
              partnerId: 8,
              amountVnd: 100_000,
              feeVnd: 6_000,
              creditedVnd: 94_000,
              method: PartnerTopupMethodEnum.CARD,
              status: PartnerDepositRequestStatusEnum.PENDING,
            }
          : opts.existing,
      ),
    },
    onepayService: { buildPaymentUrl },
    createWalletTransaction,
  });

  return { service, save, buildPaymentUrl, createWalletTransaction };
}

describe('PartnersService.createDepositRequest — amounts and methods (#047)', () => {
  it('should credit a bank transfer in full', async () => {
    const { service } = buildService();

    const result = await service.createDepositRequest(8, {
      amountVnd: 1_000_000,
    });

    expect(result).toMatchObject({
      amountVnd: 1_000_000,
      feeVnd: 0,
      creditedVnd: 1_000_000,
      method: PartnerTopupMethodEnum.BANK_TRANSFER,
    });
    // A transfer needs a QR and a memo code, not a payment page.
    expect(result).toHaveProperty('qrUrl');
    expect(result).not.toHaveProperty('paymentUrl');
  });

  it('should take the card fee out of what is credited', async () => {
    // The brief's own example: 100.000đ by card credits 94.000đ.
    const { service } = buildService();

    await expect(
      service.createDepositRequest(8, {
        amountVnd: 100_000,
        method: PartnerTopupMethodEnum.CARD,
      }),
    ).resolves.toMatchObject({
      amountVnd: 100_000,
      feeVnd: 6_000,
      creditedVnd: 94_000,
    });
  });

  it('should charge the card fee on the amount, whatever it is', async () => {
    const { service } = buildService();

    const result = await service.createDepositRequest(8, {
      amountVnd: 2_500_000,
      method: PartnerTopupMethodEnum.CARD,
    });

    expect(result.feeVnd).toBe(
      (2_500_000 * PARTNER_CARD_TOPUP_FEE_PERCENT) / 100,
    );
    expect(result.creditedVnd).toBe(2_500_000 - result.feeVnd);
  });

  it('should send a card top-up to OnePay with a reference of its own', async () => {
    const { service, buildPaymentUrl } = buildService();

    const result = await service.createDepositRequest(8, {
      amountVnd: 500_000,
      method: PartnerTopupMethodEnum.CARD,
    });

    expect(result.paymentUrl).toContain('onepay');
    // The prefix is what lets the IPN tell a top-up from an order.
    expect(result.paymentRef).toMatch(/^PDEP-42-/);
    expect(buildPaymentUrl).toHaveBeenCalledWith(
      expect.objectContaining({ vndAmount: 500_000 }),
    );
  });

  it('should refuse less than the minimum', async () => {
    const { service } = buildService();

    await expect(
      service.createDepositRequest(8, {
        amountVnd: PARTNER_DEPOSIT_MIN_VND - 1,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should refuse more than the per-transaction maximum', async () => {
    const { service } = buildService();

    await expect(
      service.createDepositRequest(8, {
        amountVnd: PARTNER_DEPOSIT_MAX_VND + 1,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should refuse a marketing partner outright', async () => {
    // They earn commission; there is no stock to deposit against (#013).
    const { service } = buildService({ partnerType: PartnerTypeEnum.KOL });

    await expect(
      service.createDepositRequest(8, { amountVnd: 1_000_000 }),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('PartnersService.confirmCardTopupByOnePay (#047)', () => {
  it('should credit the amount after the fee, not the amount paid', async () => {
    const { service, createWalletTransaction } = buildService();

    await service.confirmCardTopupByOnePay('PDEP-42-ESIMABC', 'txn-1', true);

    expect(createWalletTransaction).toHaveBeenCalledWith(
      8,
      expect.anything(),
      94_000,
      expect.objectContaining({ idempotencyKey: 'partner_deposit:42' }),
    );
  });

  it('should cancel the row when the payment failed', async () => {
    const { service, save, createWalletTransaction } = buildService();

    await service.confirmCardTopupByOnePay('PDEP-42-ESIMABC', 'txn-1', false);

    expect(createWalletTransaction).not.toHaveBeenCalled();
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: PartnerDepositRequestStatusEnum.CANCELLED,
      }),
    );
  });

  it('should do nothing the second time the gateway tells us', async () => {
    // OnePay redelivers, and a partner reloading the return page must not top
    // up twice.
    const { service, createWalletTransaction } = buildService({
      existing: {
        id: 42,
        partnerId: 8,
        amountVnd: 100_000,
        creditedVnd: 94_000,
        status: PartnerDepositRequestStatusEnum.CONFIRMED,
      },
    });

    await service.confirmCardTopupByOnePay('PDEP-42-ESIMABC', 'txn-1', true);

    expect(createWalletTransaction).not.toHaveBeenCalled();
  });

  it('should ignore a reference it cannot read', async () => {
    const { service } = buildService();

    await expect(
      service.confirmCardTopupByOnePay('PDEP-not-a-number', 'txn', true),
    ).resolves.toBeNull();
  });

  it('should ignore a top-up that is not there', async () => {
    const { service } = buildService({
      existing: null as unknown as undefined,
    });

    await expect(
      service.confirmCardTopupByOnePay('PDEP-42-ESIMABC', 'txn', true),
    ).resolves.toBeNull();
  });
});
