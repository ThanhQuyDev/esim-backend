import { standardPlanName } from './standard-plan-name';

const GB5 = 5 * 1024;

/** The 13 examples of vande #020, with "(1/5/10) Mbps" taken as 1 Mbps. */
describe('Standard plan name (vande #020)', () => {
  const cases: [string, Parameters<typeof standardPlanName>[0], string][] = [
    [
      'Vietnam - Total 5 GB - 7 days',
      { type: 'fixed', dataMb: GB5, durationDays: 7 },
      'Vietnam',
    ],
    [
      'Vietnam - Total 5 GB - Unlimited 1 Mbps - 7 days',
      { type: 'fixed', dataMb: GB5, durationDays: 7, fupSpeed: '1 Mbps' },
      'Vietnam',
    ],
    [
      'Vietnam - Total 5 GB - 200 Mins - 200 SMS - 7 days',
      { type: 'fixed', dataMb: GB5, durationDays: 7, call: 200, sms: 200 },
      'Vietnam',
    ],
    [
      'Vietnam - Daily 5 GB/day - 7 days',
      { type: 'daily', dataMb: GB5, durationDays: 7 },
      'Vietnam',
    ],
    [
      'Vietnam - Daily 5 GB/day - 200 Mins - 200 SMS - 7 days',
      { type: 'daily', dataMb: GB5, durationDays: 7, call: 200, sms: 200 },
      'Vietnam',
    ],
    [
      'Vietnam - Unlimited 1 Mbps - 7 days',
      { type: 'unlimited', dataMb: 0, durationDays: 7, fupSpeed: '1Mbps' },
      'Vietnam',
    ],
    [
      'Vietnam - Unlimited 1 Mbps - 200 Mins - 200 SMS - 7 days',
      {
        type: 'unlimited',
        dataMb: 0,
        durationDays: 7,
        fupSpeed: '1 Mbps',
        call: 200,
        sms: 200,
      },
      'Vietnam',
    ],
    [
      'Vietnam - Daily 5 GB/day - Unlimited 1 Mbps - 7 days',
      {
        type: 'unlimited-reduce',
        dataMb: GB5,
        durationDays: 7,
        fupSpeed: '1 Mbps',
      },
      'Vietnam',
    ],
    [
      'Vietnam - Daily 5 GB/day - Unlimited 1 Mbps - 200 Mins - 200 SMS - 7 days',
      {
        type: 'daily',
        dataMb: GB5,
        durationDays: 7,
        fupSpeed: '1 Mbps',
        call: 200,
        sms: 200,
      },
      'Vietnam',
    ],
    [
      'Vietnam - Unlimited - 7 days',
      { type: 'unlimited', dataMb: 0, durationDays: 7 },
      'Vietnam',
    ],
    [
      'Global 45 - Total 5 GB - 7 days',
      { type: 'fixed', dataMb: GB5, durationDays: 7 },
      'Global 45',
    ],
    [
      'Global 45 - Daily 5 GB/day - 7 days',
      { type: 'daily', dataMb: GB5, durationDays: 7 },
      'Global 45',
    ],
    [
      'Global 45 - Unlimited 1 Mbps - 7 days',
      { type: 'unlimited', dataMb: 0, durationDays: 7, fupSpeed: '1 Mbps' },
      'Global 45',
    ],
  ];

  it.each(cases)('should name %s', (expected, plan, location) => {
    expect(standardPlanName(plan, location)).toBe(expected);
  });

  it('should write the speeds suppliers send in one form', () => {
    expect(
      standardPlanName(
        { type: 'daily', dataMb: 1024, durationDays: 1, fupSpeed: '384kbps' },
        'Asia 13',
      ),
    ).toBe('Asia 13 - Daily 1 GB/day - Unlimited 384 Kbps - 1 day');
    expect(
      standardPlanName(
        { type: 'fixed', dataMb: 500, durationDays: 3, fupSpeed: 'Terminate' },
        'Japan',
      ),
    ).toBe('Japan - Total 500 MB - 3 days');
  });

  it('should keep the imported name of our own stock, already standard', () => {
    expect(
      standardPlanName(
        {
          isLocalInventory: true,
          name: 'Viettel - Daily 5 GB/day - 30 days',
          type: 'daily',
          dataMb: GB5,
          durationDays: 30,
        },
        'Vietnam',
      ),
    ).toBe('Viettel - Daily 5 GB/day - 30 days');
  });
});

describe('Standard name of a day pass sold by the day (vande #020)', () => {
  it('should leave out the stored 1 day, which is not what the customer buys', () => {
    expect(
      standardPlanName(
        {
          type: 'unlimited-reduce',
          dataMb: 1024,
          durationDays: 1,
          fupSpeed: '1 Mbps',
          isAbleMultidate: true,
        },
        'China',
      ),
    ).toBe('China - Daily 1 GB/day - Unlimited 1 Mbps');
  });
});
