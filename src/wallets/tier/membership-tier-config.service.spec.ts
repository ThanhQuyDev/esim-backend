import { UnprocessableEntityException } from '@nestjs/common';
import { MembershipTierConfigService } from './membership-tier-config.service';
import { MembershipTierEnum } from './tier.enum';
import { applyTierBenefits, defaultTable, tierOrder } from './tier.registry';
import { resolveTierSummary } from './tier.resolver';

type Row = {
  tier: string;
  name?: string | null;
  nameEn?: string | null;
  minimumSpendVnd: number | string;
  cashbackPercent: number | string;
  referralRewardVnd: number | string;
};

function defaultRows(): Row[] {
  return tierOrder(defaultTable()).map((tier) => ({
    tier,
    ...defaultTable()[tier],
  }));
}

function buildService(rows: Row[], overrides = 0) {
  const repository = {
    find: jest.fn(() => Promise.resolve(rows)),
    create: jest.fn((row: Row) => row),
    delete: jest.fn(({ tier }: { tier: string }) => {
      rows.splice(
        rows.findIndex((r) => r.tier === tier),
        1,
      );
      return Promise.resolve();
    }),
    query: jest.fn(() => Promise.resolve([{ count: overrides }])),
    save: jest.fn((saved: Row[]) => {
      rows.splice(0, rows.length, ...saved);
      return Promise.resolve(saved);
    }),
  };

  const service = new MembershipTierConfigService(repository as any);
  return { service, repository };
}

describe('MembershipTierConfigService (#024)', () => {
  afterEach(() => applyTierBenefits(defaultTable()));

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
      name: 'Du khách vàng',
      nameEn: 'Gold Traveler',
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

  describe('tiers the admin adds, renames and removes (vande #066)', () => {
    it('should add "Kim cương" at the top of the ladder by its threshold', async () => {
      const { service } = buildService(defaultRows());

      const ladder = await service.create({
        name: 'Kim cương',
        nameEn: 'Diamond',
        minimumSpendVnd: 100_000_000,
        cashbackPercent: 10,
        referralRewardVnd: 30_000,
      });

      expect(ladder.map((t) => t.tier)).toEqual([
        'traveler',
        'silver',
        'gold',
        'platinum',
        'kim-cuong',
      ]);
      expect(resolveTierSummary(150_000_000).membershipTier).toBe('kim-cuong');
      expect(resolveTierSummary(150_000_000).benefits.cashbackPercent).toBe(10);
      // Platinum now has a tier above it to climb to.
      expect(resolveTierSummary(30_000_000).nextTier).toBe('kim-cuong');
    });

    it('should slot a tier in between by its threshold', async () => {
      const { service } = buildService(defaultRows());
      const ladder = await service.create({
        name: 'Đồng',
        minimumSpendVnd: 500_000,
        cashbackPercent: 2.5,
        referralRewardVnd: 11_000,
      });
      expect(ladder.map((t) => t.tier).slice(0, 3)).toEqual([
        'traveler',
        'dong',
        'silver',
      ]);
    });

    it('should refuse a new tier on a threshold already taken', async () => {
      const { service } = buildService(defaultRows());
      await expect(
        service.create({
          name: 'Trùng',
          minimumSpendVnd: 5_000_000,
          cashbackPercent: 5,
          referralRewardVnd: 0,
        }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('should rename a tier', async () => {
      const { service } = buildService(defaultRows());
      const ladder = await service.update(MembershipTierEnum.PLATINUM, {
        name: 'Khách VIP',
        nameEn: 'VIP',
      });
      expect(ladder[3]).toMatchObject({
        tier: 'platinum',
        name: 'Khách VIP',
        nameEn: 'VIP',
        minimumSpendVnd: 25_000_000,
      });
    });

    it('should remove a tier nobody is placed on by hand', async () => {
      const { service } = buildService(defaultRows());
      const ladder = await service.remove(MembershipTierEnum.GOLD);
      expect(ladder.map((t) => t.tier)).toEqual([
        'traveler',
        'silver',
        'platinum',
      ]);
      // Customers it held fall to the tier below by their spend.
      expect(resolveTierSummary(6_000_000).membershipTier).toBe('silver');
    });

    it('should not remove a tier customers are placed on by hand', async () => {
      const { service } = buildService(defaultRows(), 3);
      await expect(service.remove(MembershipTierEnum.GOLD)).rejects.toThrow(
        /Còn 3 khách hàng/,
      );
    });

    it('should never remove the first tier', async () => {
      const { service } = buildService(defaultRows());
      await expect(service.remove(MembershipTierEnum.TRAVELER)).rejects.toThrow(
        /hạng đầu tiên/,
      );
    });

    it('should let a customer placed on a deleted tier fall back to their spend', () => {
      expect(
        resolveTierSummary(6_000_000, 'tier-that-is-gone').membershipTier,
      ).toBe('gold');
    });
  });
});
