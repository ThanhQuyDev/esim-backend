import { tierBands } from './tier-bands';
import { MembershipTierEnum } from './tier.enum';
import { TIER_BENEFITS } from './tier.constants';
import { applyTierBenefits } from './tier.registry';

/**
 * #057 — the spend bands that translate a membership tier back into a
 * `lifetimeSpendVnd` range.
 *
 * The effective tier is `tierOverride ?? automaticTier(spend)` and is never
 * stored, so both screens that filter on it — the customer list (#037) and the
 * eXu wallet list — have to reconstruct the range. They now share these bands
 * instead of deriving them separately, which is the only way the two filters can
 * be guaranteed to agree.
 */
describe('Tier spend bands (#057)', () => {
  beforeEach(() => {
    applyTierBenefits({ ...TIER_BENEFITS });
  });

  it('should gives one band per requested tier', () => {
    const bands = tierBands([
      MembershipTierEnum.SILVER,
      MembershipTierEnum.GOLD,
    ]);

    expect(bands.map((band) => band.tier)).toEqual([
      MembershipTierEnum.SILVER,
      MembershipTierEnum.GOLD,
    ]);
  });

  it('should returns them lowest tier first, whatever order was asked for', () => {
    const bands = tierBands([
      MembershipTierEnum.PLATINUM,
      MembershipTierEnum.TRAVELER,
    ]);

    expect(bands.map((band) => band.tier)).toEqual([
      MembershipTierEnum.TRAVELER,
      MembershipTierEnum.PLATINUM,
    ]);
  });

  it('should starts the bottom tier at zero spend', () => {
    const [band] = tierBands([MembershipTierEnum.TRAVELER]);

    expect(band.floorVnd).toBe(0);
    expect(band.ceilingVnd).toBe(
      TIER_BENEFITS[MembershipTierEnum.SILVER].minimumSpendVnd - 1,
    );
  });

  it('should gives the top tier no ceiling', () => {
    const [band] = tierBands([MembershipTierEnum.PLATINUM]);

    expect(band.floorVnd).toBe(
      TIER_BENEFITS[MembershipTierEnum.PLATINUM].minimumSpendVnd,
    );
    expect(band.ceilingVnd).toBeNull();
  });

  it('should leaves no gap or overlap between adjacent bands', () => {
    // A customer sitting exactly on a threshold must land in the upper tier and
    // only there — an off-by-one here mis-buckets everyone on a round number.
    const bands = tierBands([
      MembershipTierEnum.TRAVELER,
      MembershipTierEnum.SILVER,
      MembershipTierEnum.GOLD,
      MembershipTierEnum.PLATINUM,
    ]);

    for (let i = 0; i < bands.length - 1; i += 1) {
      expect(bands[i].ceilingVnd! + 1).toBe(bands[i + 1].floorVnd);
    }
  });

  it('should follows the live ladder, not the hardcoded defaults', () => {
    // A threshold an admin moves in membership_tier_config must move both
    // screens' filters with it.
    applyTierBenefits({
      ...TIER_BENEFITS,
      [MembershipTierEnum.SILVER]: {
        ...TIER_BENEFITS[MembershipTierEnum.SILVER],
        minimumSpendVnd: 2_000_000,
      },
    });

    const [traveler] = tierBands([MembershipTierEnum.TRAVELER]);
    expect(traveler.ceilingVnd).toBe(1_999_999);
  });

  it('should is empty when nothing is asked for', () => {
    expect(tierBands([])).toEqual([]);
  });

  it('should ignores a value that is not a tier', () => {
    expect(tierBands(['nope' as MembershipTierEnum])).toEqual([]);
  });
});
