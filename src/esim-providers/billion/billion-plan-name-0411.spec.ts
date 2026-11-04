import { billionPlanName } from './billion.service';

describe('Tên gói Billion có add-on (vande-0411 #040)', () => {
  const NAME = 'Vietnam-1GB/Natural day - 2 days';
  const VAS = 'mobile.three.com.hk';

  it('should mark the plan that takes add-ons', () => {
    expect(
      billionPlanName(NAME, { topUp: false, accelerationSupport: 3, apn: VAS }),
    ).toBe(`${NAME} Addon`);
  });

  it('should leave its topup twin as it is', () => {
    expect(
      billionPlanName(NAME, { topUp: true, accelerationSupport: 3, apn: VAS }),
    ).toBe(NAME);
  });

  it('should leave a plan outside the APN list, which takes neither', () => {
    expect(
      billionPlanName(NAME, {
        topUp: false,
        accelerationSupport: 3,
        apn: 'other.apn',
      }),
    ).toBe(NAME);
  });

  it('should leave a plan Billion says takes no add-ons', () => {
    expect(
      billionPlanName(NAME, { topUp: false, accelerationSupport: 0, apn: VAS }),
    ).toBe(NAME);
  });
});
