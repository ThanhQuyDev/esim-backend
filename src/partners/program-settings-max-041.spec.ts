import { BadRequestException } from '@nestjs/common';
import {
  assertProgramLimitsConsistent,
  PartnersService,
} from './partners.service';
import { PartnerTypeEnum } from './partners.enum';

/**
 * doitac-3010 #041 — "Cấu hình chung" gains the withdrawal and deposit
 * ceilings, and a partner without their own limits follows it.
 */
describe('Programme withdrawal and deposit ceilings (doitac-3010 #041)', () => {
  const settings = {
    payoutMinKolVnd: 50_000,
    payoutMinDistributionVnd: 50_000,
    depositMinKolVnd: 50_000,
    depositMinDistributionVnd: 50_000,
    payoutMaxKolVnd: 0,
    payoutMaxDistributionVnd: 20_000_000,
    depositMaxKolVnd: 10_000_000,
    depositMaxDistributionVnd: 200_000_000,
  };
  const service = (s = settings) => {
    const svc = Object.create(PartnersService.prototype) as PartnersService;
    Object.assign(svc, { getProgramSettings: jest.fn().mockResolvedValue(s) });
    return svc;
  };

  it('should give a partner without own limits the programme min and max', async () => {
    await expect(
      service().depositLimitsFor({
        partnerType: PartnerTypeEnum.DISTRIBUTION,
        depositMinVnd: null,
        depositMaxVnd: null,
      } as never),
    ).resolves.toEqual({ minVnd: 50_000, maxVnd: 200_000_000 });
  });

  it("should still prefer the partner's own limits", async () => {
    await expect(
      service().depositLimitsFor({
        partnerType: PartnerTypeEnum.DISTRIBUTION,
        depositMinVnd: 1_000_000,
        depositMaxVnd: 500_000_000,
      } as never),
    ).resolves.toEqual({ minVnd: 1_000_000, maxVnd: 500_000_000 });
  });

  it('should read a withdrawal ceiling of 0 as none', async () => {
    await expect(
      service().payoutMaxVndFor(PartnerTypeEnum.KOL),
    ).resolves.toBeNull();
    await expect(
      service().payoutMaxVndFor(PartnerTypeEnum.DISTRIBUTION),
    ).resolves.toBe(20_000_000);
  });

  it('should accept consistent settings', () => {
    expect(() => assertProgramLimitsConsistent(settings)).not.toThrow();
  });

  it('should refuse a minimum above its maximum', () => {
    expect(() =>
      assertProgramLimitsConsistent({
        ...settings,
        payoutMinDistributionVnd: 30_000_000,
      }),
    ).toThrow(BadRequestException);
    expect(() =>
      assertProgramLimitsConsistent({
        ...settings,
        depositMinKolVnd: 20_000_000,
      }),
    ).toThrow(/tối thiểu không được lớn hơn tối đa/);
  });

  it('should refuse a deposit ceiling of 0', () => {
    expect(() =>
      assertProgramLimitsConsistent({ ...settings, depositMaxKolVnd: 0 }),
    ).toThrow(/phải lớn hơn 0/);
  });
});
