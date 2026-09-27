import { PartnersService } from './partners.service';

/**
 * "Điểm đến mua nhiều" for one partner (#012).
 *
 * The partner dashboard had a revenue chart but nothing about what was being
 * sold, so a KOL could not see that their audience buys Japan and ignores
 * Europe — the one thing that changes what they post next.
 */

function buildService(rows: Record<string, unknown>[]) {
  const service = Object.create(PartnersService.prototype) as PartnersService;
  const calls: unknown[][] = [];

  Object.assign(service, {
    dataSource: {
      query: jest.fn((_sql: string, params: unknown[]) => {
        calls.push(params);
        return Promise.resolve(rows);
      }),
    },
  });

  return { service, calls };
}

describe('PartnersService — top destinations (#012)', () => {
  it('should return the ranking with numbers, not strings', async () => {
    const { service } = buildService([
      { name: 'Nhật Bản', plansPurchased: '42', revenueVnd: '12600000' },
      { name: 'Hàn Quốc', plansPurchased: '18', revenueVnd: '5400000' },
    ]);

    await expect(
      service.getMyTopDestinations(5, { from: '2026-09-01', to: '2026-09-30' }),
    ).resolves.toEqual([
      { name: 'Nhật Bản', plansPurchased: 42, revenueVnd: 12_600_000 },
      { name: 'Hàn Quốc', plansPurchased: 18, revenueVnd: 5_400_000 },
    ]);
  });

  it('should name a row the query could not resolve', async () => {
    const { service } = buildService([
      { name: null, plansPurchased: 3, revenueVnd: 900000 },
    ]);

    const [row] = await service.getMyTopDestinations(5);

    expect(row.name).toBe('Không xác định');
  });

  it('should keep the requested window and clamp an absurd limit', async () => {
    const { service, calls } = buildService([]);

    await service.getMyTopDestinations(5, { from: '2026-09-01' }, 500);

    const [partnerId, from, to, limit] = calls[0] as [
      number,
      Date,
      Date,
      number,
    ];
    expect(partnerId).toBe(5);
    expect(from.getDate()).toBe(1);
    expect(to.getDate()).toBe(2);
    expect(limit).toBe(20);
  });
});
