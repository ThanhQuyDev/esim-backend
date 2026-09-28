import { PartnersService } from './partners.service';
import { PartnerTypeEnum } from './partners.enum';

/**
 * The deposit wallet belongs to partners who buy stock (#013).
 *
 * A marketing partner earns commission on orders placed on esim.vn; they never
 * buy eSIMs to resell, so a deposit request from one is a screen they should
 * not have reached — and the rule has to live here, not only in the menu.
 */

function buildService(partnerType: PartnerTypeEnum) {
  const save = jest.fn().mockImplementation((row) => Promise.resolve(row));
  const service = Object.create(PartnersService.prototype) as PartnersService;

  Object.assign(service, {
    getPartnerOrThrowById: jest.fn().mockResolvedValue({ id: 5, partnerType }),
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
        accountNumber: '19000000000000',
        bankCode: 'TCB',
        accountName: 'ESIM VN',
      }),
    },
    depositRequestRepository: { create: (row: unknown) => row, save },
  });

  return { service, save };
}

describe('PartnersService — who may open a deposit request (#013)', () => {
  it('should refuse a marketing partner and say what they use instead', async () => {
    const { service, save } = buildService(PartnerTypeEnum.KOL);

    await expect(
      service.createDepositRequest(5, { amountVnd: 1_000_000 } as never),
    ).rejects.toThrow('Đối tác tiếp thị không dùng ví ký quỹ');

    expect(save).not.toHaveBeenCalled();
  });

  it('should still let a distribution partner deposit', async () => {
    const { service, save } = buildService(PartnerTypeEnum.DISTRIBUTION);

    await service.createDepositRequest(5, { amountVnd: 1_000_000 } as never);

    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ partnerId: 5, amountVnd: 1_000_000 }),
    );
  });
});
