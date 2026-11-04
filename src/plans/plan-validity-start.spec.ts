import { planValidityStart } from './plan-validity-start';

describe('Thời điểm bắt đầu tính gói (vande-0411 #025)', () => {
  const cases: [string, Record<string, unknown>, string | null][] = [
    [
      'Airalo first-usage',
      { provider: 'airalo', supplierActivationPolicy: 'first-usage' },
      'first_connection',
    ],
    [
      'Airalo installation',
      { provider: 'airalo', supplierActivationPolicy: 'installation' },
      'installation',
    ],
    ['Airalo before the next sync', { provider: 'airalo' }, null],
    [
      'eSIM Access on install',
      { provider: 'esimaccess', supplierActiveType: 1 },
      'installation',
    ],
    [
      'eSIM Access on first connection',
      { provider: 'esimaccess', supplierActiveType: 2 },
      'first_connection',
    ],
    [
      'eSIM Access on purchase',
      { provider: 'esimaccess', supplierActiveType: 3 },
      'purchase',
    ],
    ['eSIM Access before the next sync', { provider: 'esimaccess' }, null],
    [
      'Gadget Korea available',
      {
        provider: 'gadgetkorea',
        name: 'Japan 1GB',
        supplierActivationPolicy: 'Available',
      },
      'first_connection',
    ],
    [
      'Gadget Korea not imported yet',
      { provider: 'gadgetkorea', name: 'Japan 1GB' },
      'first_connection',
    ],
    [
      'Gadget Korea only pre-arrival',
      {
        provider: 'gadgetkorea',
        name: 'Europe 42 1GB',
        supplierActivationPolicy: 'Only Pre-Arrival',
      },
      'pre_arrival',
    ],
    [
      'Gadget Korea Turkey by name',
      { provider: 'gadgetkorea', name: 'Turkey 1GB per day' },
      'pre_arrival',
    ],
    [
      'Billion refundable',
      { provider: 'billion', name: 'Vietnam-1GB/Natural day' },
      'first_connection',
    ],
    [
      'Billion local',
      { provider: 'billion', name: 'Japan SoftBank Local 1GB' },
      'installation',
    ],
    [
      'MicroEsim refundable',
      { provider: 'microesim', name: 'Singapore-Daily1GB-7-A1' },
      'first_connection',
    ],
    [
      'MicroEsim local',
      { provider: 'microesim', name: 'Japan-LocalIIJ-Total50GB' },
      'installation',
    ],
    ['Viettel', { provider: 'viettel' }, 'installation'],
    ['a domestic eSIM', { provider: 'itel-noidia' }, 'installation'],
    ['an unknown supplier', { provider: 'other' }, null],
  ];

  it.each(cases)('should read %s', (_label, plan, expected) => {
    expect(planValidityStart(plan)).toBe(expected);
  });

  it('should go by the rule, not an admin override of the refund', () => {
    expect(
      planValidityStart({
        provider: 'billion',
        name: 'Japan SoftBank Local 1GB',
        refundableOverride: true,
      }),
    ).toBe('installation');
  });
});
