import { PartnersService } from './partners.service';
import { PartnerTypeEnum } from './partners.enum';

/**
 * doitac-3010 #023 — a partner whose top-up qualifies for a promotion is told
 * how much extra it brings before paying, not only by a line that appears in
 * the wallet afterwards.
 */
function buildService(bonus: object | null) {
  const service = Object.create(PartnersService.prototype) as PartnersService;
  Object.assign(service, {
    getPartnerOrThrowById: jest
      .fn()
      .mockResolvedValue({ id: 5, partnerType: PartnerTypeEnum.DISTRIBUTION }),
    programSettingRepository: {
      findOne: jest.fn().mockResolvedValue({
        depositMinDistributionVnd: 100_000,
      }),
    },
    configService: {
      get: () => ({
        accountNumber: '19000000000000',
        bankCode: 'ICB',
        accountName: 'ESIM VN',
      }),
    },
    depositRequestRepository: {
      create: (row: unknown) => row,
      save: jest.fn((row: object) => Promise.resolve({ id: 9, ...row })),
    },
    depositBonusFor: jest.fn().mockResolvedValue(bonus),
  });
  return service;
}

describe('Deposit promotion shown before paying (doitac-3010 #023)', () => {
  it('should say how much the promotion adds to this top-up', async () => {
    const service = buildService({
      bonusVnd: 250_000,
      promotion: { name: 'Nạp 5 triệu tặng 5%', bonusPercent: '5.00' },
    });
    const result = await service.createDepositRequest(5, {
      amountVnd: 5_000_000,
    } as never);
    expect(result).toMatchObject({
      amountVnd: 5_000_000,
      creditedVnd: 5_000_000,
      expectedBonusVnd: 250_000,
      promotionName: 'Nạp 5 triệu tặng 5%',
      promotionBonusPercent: 5,
    });
  });

  it('should say nothing extra when no promotion applies', async () => {
    const service = buildService(null);
    const result = await service.createDepositRequest(5, {
      amountVnd: 1_000_000,
    } as never);
    expect(result).toMatchObject({
      expectedBonusVnd: 0,
      promotionName: null,
      promotionBonusPercent: null,
    });
  });
});
