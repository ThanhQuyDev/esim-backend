import { PartnerTypeEnum } from './partners.enum';
import { partnerTypeFor } from './partners.service';

/**
 * #053 (test round 4) — the sign-up form offers tiếp thị, phân phối and tích
 * hợp API. An API partner runs as a distribution partner until its terms are
 * set; the choice itself is kept as `requestedType`.
 */
describe('Partner type from the sign-up choice (#053)', () => {
  const dto = (requestedType?: string) =>
    ({ partnerType: PartnerTypeEnum.KOL, requestedType }) as never;

  it.each([
    ['kol', PartnerTypeEnum.KOL],
    ['distribution', PartnerTypeEnum.DISTRIBUTION],
    ['api', PartnerTypeEnum.DISTRIBUTION],
  ])('should run a %s applicant as %s', (choice, expected) => {
    expect(partnerTypeFor(dto(choice))).toBe(expected);
  });

  it('should keep the old behaviour when no choice is sent', () => {
    expect(partnerTypeFor(dto(undefined))).toBe(PartnerTypeEnum.KOL);
  });
});
