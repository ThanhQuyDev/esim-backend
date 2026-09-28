import { PartnersService } from './partners.service';

/**
 * The top-30 leaderboard at the foot of the admin overview (#054).
 *
 * Ranked on the same money as the rest of that screen — what esim.vn keeps —
 * because a table that ranks on gross order value beside totals that are net
 * would put a different partner at the top of each.
 */

function buildService(rows: Record<string, unknown>[]) {
  const query = jest.fn().mockResolvedValue(rows);
  const service = Object.create(PartnersService.prototype) as PartnersService;
  Object.assign(service, { dataSource: { query } });
  return { service, query };
}

describe('PartnersService.adminTopPartners (#054)', () => {
  it('should return the partners with their revenue and orders', async () => {
    const { service } = buildService([
      {
        id: '8',
        contactName: 'Nguyễn Văn A',
        partnerType: 'kol',
        tierCode: 'GOLD',
        status: 'active',
        revenueVnd: '82000000',
        commissionVnd: '18000000',
        orders: '128',
      },
    ]);

    await expect(service.adminTopPartners()).resolves.toEqual([
      {
        id: 8,
        contactName: 'Nguyễn Văn A',
        partnerType: 'kol',
        tierCode: 'GOLD',
        status: 'active',
        revenueVnd: 82_000_000,
        commissionVnd: 18_000_000,
        orders: 128,
      },
    ]);
  });

  it('should rank by what esim.vn keeps, not by order value', async () => {
    const { service, query } = buildService([]);

    await service.adminTopPartners();

    const [sql] = query.mock.calls[0] as [string];
    expect(sql).toContain('ORDER BY "revenueVnd" DESC');
    // Net of commission on the affiliate side.
    expect(sql).toContain('reversedCommissionVnd');
  });

  it('should count both sides of the business for one partner', async () => {
    const { service, query } = buildService([]);

    await service.adminTopPartners();

    const [sql] = query.mock.calls[0] as [string];
    expect(sql).toContain('o."attributedPartnerId" IS NOT NULL');
    expect(sql).toContain('pa."userId" = o."userId"');
    expect(sql).toContain('COUNT(DISTINCT t."orderId")');
  });

  it('should ask for thirty rows by default', async () => {
    const { service, query } = buildService([]);

    await service.adminTopPartners();

    const [, params] = query.mock.calls[0] as [string, unknown[]];
    expect(params[3]).toBe(30);
  });

  it('should cap a caller asking for far more', async () => {
    const { service, query } = buildService([]);

    await service.adminTopPartners({}, 5_000);

    const [, params] = query.mock.calls[0] as [string, unknown[]];
    expect(params[3]).toBe(100);
  });

  it('should survive a partner with no contact name', async () => {
    const { service } = buildService([
      {
        id: '9',
        contactName: null,
        partnerType: 'distribution',
        tierCode: null,
        status: 'active',
        revenueVnd: '0',
        commissionVnd: '0',
        orders: '0',
      },
    ]);

    await expect(service.adminTopPartners()).resolves.toMatchObject([
      { id: 9, contactName: null, tierCode: null },
    ]);
  });
});
