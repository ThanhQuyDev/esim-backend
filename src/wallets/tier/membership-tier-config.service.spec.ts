import { UnprocessableEntityException } from '@nestjs/common';
import { MembershipTierConfigService } from './membership-tier-config.service';
import { TIER_BENEFITS, TIER_ORDER } from './tier.constants';
import { MembershipTierEnum } from './tier.enum';
import { applyTierBenefits } from './tier.registry';
import { resolveTierSummary } from './tier.resolver';

type Row = {
  tier: MembershipTierEnum;
  minimumSpendVnd: number | string;
  cashbackPercent: number | string;
  referralRewardVnd: number | string;
};

function defaultRows(): Row[] {
  return TIER_ORDER.map((tier) => ({ tier, ...TIER_BENEFITS[tier] }));
}

function buildService(rows: Row[]) {
  const repository = {
    find: jest.fn(() => Promise.resolve(rows)),
    create: jest.fn((row: Row) => row),
    save: jest.fn((saved: Row[]) => {
      rows.splice(0, rows.length, ...saved);
      return Promise.resolve(saved);
    }),
  };

  const service = new MembershipTierConfigService(repository as any);
  return { service, repository };
}

describe('MembershipTierConfigService (#024)', () => {
  afterEach(() => applyTierBenefits(TIER_BENEFITS));

  it('should load saved tiers, reading Postgres numeric strings as numbers', async () => {
    const rows = defaultRows();
    rows[1] = {
      tier: MembershipTierEnum.SILVER,
      minimumSpendVnd: '2000000',
      cashbackPercent: '3.50',
      referralRewardVnd: '13000',
    };
    const { service } = buildService(rows);

    await service.reload();

    expect(resolveTierSummary(2_000_000).benefits).toEqual({
      minimumSpendVnd: 2_000_000,
      cashbackPercent: 3.5,
      referralRewardVnd: 13_000,
    });
  });

  it('should keep the tiers in use when the saved ladder is broken', async () => {
    const rows = defaultRows();
    rows[0] = { ...rows[0], minimumSpendVnd: 500 };
    const { service } = buildService(rows);

    await service.reload();

    expect(service.list()[0].minimumSpendVnd).toBe(0);
  });

  it('should keep the tiers in use when the table cannot be read', async () => {
    const { service, repository } = buildService(defaultRows());
    repository.find.mockRejectedValueOnce(new Error('relation does not exist'));

    await expect(service.reload()).resolves.toBeUndefined();
    expect(service.list()).toHaveLength(4);
  });

  it('should save an edit and pay it out straight away', async () => {
    const { service, repository } = buildService(defaultRows());

    const ladder = await service.update(MembershipTierEnum.GOLD, {
      cashbackPercent: 5,
      referralRewardVnd: 16_000,
    });

    expect(repository.save).toHaveBeenCalledTimes(1);
    expect(ladder[2]).toEqual({
      tier: MembershipTierEnum.GOLD,
      minimumSpendVnd: 5_000_000,
      cashbackPercent: 5,
      referralRewardVnd: 16_000,
    });
    expect(resolveTierSummary(5_000_000).benefits.cashbackPercent).toBe(5);
    expect(
      resolveTierSummary(0, MembershipTierEnum.GOLD).benefits.referralRewardVnd,
    ).toBe(16_000);
  });

  it('should refuse a threshold that breaks the ladder and save nothing', async () => {
    const { service, repository } = buildService(defaultRows());

    await expect(
      service.update(MembershipTierEnum.SILVER, { minimumSpendVnd: 5_000_000 }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(repository.save).not.toHaveBeenCalled();
    expect(resolveTierSummary(1_000_000).membershipTier).toBe(
      MembershipTierEnum.SILVER,
    );
  });
});
