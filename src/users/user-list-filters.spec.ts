import { UsersRelationalRepository } from './infrastructure/persistence/relational/repositories/user.repository';
import { MembershipTierEnum } from '../wallets/tier/tier.enum';
import { TIER_BENEFITS } from '../wallets/tier/tier.constants';
import { applyTierBenefits } from '../wallets/tier/tier.registry';

/**
 * #037 — the admin customer list filters: Mã khách hàng, Hạng khách hàng and
 * Trạng thái.
 *
 * `membershipTier` is the interesting one. It is NOT a column: it is
 * `tierOverride ?? automaticTier(lifetimeSpendVnd)`, so the filter has to ask for
 * both cases and must not confuse them — a customer demoted to Du khách by an
 * override still spends like a Bạch kim, and filtering on Bạch kim must not
 * return them.
 */
describe('Admin user list filters (#037)', () => {
  /** Captures the `where` array handed to findAndCount. */
  function run(filterOptions: Record<string, unknown>) {
    const findAndCount = jest.fn().mockResolvedValue([[], 0]);
    const repo = new UsersRelationalRepository({
      findAndCount,
      manager: { query: jest.fn().mockResolvedValue([]) },
    } as never);

    return repo
      .findManyWithPagination({
        filterOptions: filterOptions as never,
        sortOptions: null,
        paginationOptions: { page: 1, limit: 10 },
      })
      .then(() => findAndCount.mock.calls[0][0].where as Record<string, any>[]);
  }

  /** The value a TypeORM FindOperator was built with. */
  function opValue(operator: any) {
    return operator?._value;
  }

  function opType(operator: any) {
    return operator?._type;
  }

  beforeEach(() => {
    // The bands come from the live registry, so pin it to the documented ladder.
    applyTierBenefits({ ...TIER_BENEFITS });
  });

  describe('Mã khách hàng', () => {
    it('should reads the id out of the code however it was typed', async () => {
      for (const code of ['KH-000123', 'kh000123', '123', ' KH 000123 ']) {
        const where = await run({ customerCode: code });
        expect(where[0].id).toBe(123);
      }
    });

    it('should matches nothing when the code carries no digits', async () => {
      // Not "no filter": returning every customer for a typo would look like the
      // filter silently failed.
      const where = await run({ customerCode: 'KH-' });

      expect(where[0].id).toBe(0);
    });
  });

  describe('Trạng thái', () => {
    it('should filters on the status ids given', async () => {
      const where = await run({ statusIds: [1] });

      expect(opValue(where[0].status.id)).toEqual([1]);
    });

    it('should accepts both statuses at once', async () => {
      const where = await run({ statusIds: [1, 2] });

      expect(opValue(where[0].status.id)).toEqual([1, 2]);
    });
  });

  describe('Hạng khách hàng', () => {
    it('should matches an admin-pinned tier and an earned tier separately', async () => {
      const where = await run({ membershipTiers: [MembershipTierEnum.GOLD] });

      // One branch for the override…
      expect(opValue(where[0].tierOverride)).toEqual([MembershipTierEnum.GOLD]);
      // …and one for the spend band, which only applies when nothing is pinned.
      expect(opType(where[1].tierOverride)).toBe('isNull');
      expect(opValue(where[1].lifetimeSpendVnd)).toEqual([
        TIER_BENEFITS[MembershipTierEnum.GOLD].minimumSpendVnd,
        TIER_BENEFITS[MembershipTierEnum.PLATINUM].minimumSpendVnd - 1,
      ]);
    });

    it('should gives the top tier no upper bound', async () => {
      const where = await run({
        membershipTiers: [MembershipTierEnum.PLATINUM],
      });

      expect(opType(where[1].lifetimeSpendVnd)).toBe('moreThanOrEqual');
      expect(opValue(where[1].lifetimeSpendVnd)).toBe(
        TIER_BENEFITS[MembershipTierEnum.PLATINUM].minimumSpendVnd,
      );
    });

    it('should starts the bottom tier at zero spend', async () => {
      const where = await run({
        membershipTiers: [MembershipTierEnum.TRAVELER],
      });

      expect(opValue(where[1].lifetimeSpendVnd)).toEqual([
        0,
        TIER_BENEFITS[MembershipTierEnum.SILVER].minimumSpendVnd - 1,
      ]);
    });

    it('should leaves no gap or overlap between adjacent bands', async () => {
      // A customer whose spend is exactly a threshold must land in the upper
      // tier and only there — off-by-one here silently mis-buckets everyone
      // sitting on a round number.
      const silver = await run({
        membershipTiers: [MembershipTierEnum.SILVER],
      });
      const gold = await run({ membershipTiers: [MembershipTierEnum.GOLD] });

      const silverBand = opValue(silver[1].lifetimeSpendVnd) as number[];
      const goldBand = opValue(gold[1].lifetimeSpendVnd) as number[];

      expect(silverBand[1] + 1).toBe(goldBand[0]);
    });

    it('should ORs several tiers, adding one spend band per tier', async () => {
      const where = await run({
        membershipTiers: [MembershipTierEnum.SILVER, MembershipTierEnum.GOLD],
      });

      // 1 override branch + 2 spend branches.
      expect(where).toHaveLength(3);
      expect(opValue(where[0].tierOverride)).toEqual([
        MembershipTierEnum.SILVER,
        MembershipTierEnum.GOLD,
      ]);
    });

    it('should follows the live ladder, not the hardcoded defaults', async () => {
      // An admin who moves a threshold in membership_tier_config must move this
      // filter with it, or the list disagrees with the badge in its own column.
      applyTierBenefits({
        ...TIER_BENEFITS,
        [MembershipTierEnum.SILVER]: {
          ...TIER_BENEFITS[MembershipTierEnum.SILVER],
          minimumSpendVnd: 2_000_000,
        },
      });

      const where = await run({
        membershipTiers: [MembershipTierEnum.TRAVELER],
      });

      expect(opValue(where[1].lifetimeSpendVnd)).toEqual([0, 1_999_999]);
    });
  });

  describe('combining filters', () => {
    it('should crosses the search OR with the tier OR and repeats the AND parts', async () => {
      const where = await run({
        search: 'an',
        membershipTiers: [MembershipTierEnum.GOLD],
        statusIds: [1],
        customerCode: 'KH-000007',
      });

      // 4 search branches × (1 override + 1 band) = 8.
      expect(where).toHaveLength(8);
      // Every branch keeps the AND filters, or one of them would leak rows.
      for (const branch of where) {
        expect(branch.id).toBe(7);
        expect(opValue(branch.status.id)).toEqual([1]);
      }
    });

    it('should stays a single unfiltered branch when nothing is asked for', async () => {
      const where = await run({});

      expect(where).toEqual([{}]);
    });
  });
});
