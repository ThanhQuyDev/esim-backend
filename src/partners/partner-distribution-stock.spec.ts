import { PartnersService } from './partners.service';

/**
 * A distribution partner's stock and their own orders (#046).
 *
 * The portal's existing screens answer the marketing question — orders somebody
 * else placed that were credited to the partner. A distribution partner has no
 * such orders and does hold stock, so both of these read from their own user
 * account instead.
 */

function buildService(rows: Record<string, unknown>[]) {
  const query = jest.fn().mockResolvedValue(rows);
  const service = Object.create(PartnersService.prototype) as PartnersService;
  Object.assign(service, {
    dataSource: { query },
    getPartnerOrThrowById: jest
      .fn()
      .mockResolvedValue({ id: 8, userId: 100, partnerType: 'distribution' }),
  });
  return { service, query };
}

describe('PartnersService.getMyEsims (#046)', () => {
  it('should read the eSIMs from the orders this partner placed', async () => {
    const { service, query } = buildService([]);

    await service.getMyEsims(8);

    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('o."userId" = $1');
    expect(params[0]).toBe(100);
  });

  it('should spread a line total over the eSIMs on that line', async () => {
    const { service } = buildService([
      {
        iccid: '8984000000000001',
        status: 'active',
        planName: 'Nhật Bản 5GB',
        destination: 'Nhật Bản',
        orderNumber: 'ORD-1',
        costVnd: '180000',
        dataUsed: '512',
        dataTotal: '5120',
        activatedAt: '2026-09-20T03:00:00.000Z',
        expiresAt: '2026-10-20T03:00:00.000Z',
        createdAt: '2026-09-18T03:00:00.000Z',
      },
    ]);

    await expect(service.getMyEsims(8)).resolves.toEqual([
      {
        iccid: '8984000000000001',
        status: 'active',
        planName: 'Nhật Bản 5GB',
        destination: 'Nhật Bản',
        orderNumber: 'ORD-1',
        costVnd: 180_000,
        dataUsed: 512,
        dataTotal: 5120,
        activatedAt: '2026-09-20T03:00:00.000Z',
        expiresAt: '2026-10-20T03:00:00.000Z',
        createdAt: '2026-09-18T03:00:00.000Z',
      },
    ]);
  });

  it('should pass the search and status through as parameters', async () => {
    // Never interpolated: a partner typing a quote into the box must not be
    // able to reach the query.
    const { service, query } = buildService([]);

    await service.getMyEsims(8, {
      search: "8984'--",
      status: 'active',
      limit: 20,
    });

    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).not.toContain("8984'--");
    expect(params).toEqual([100, 'active', "8984'--", 20]);
  });

  it('should cap how many rows one call can ask for', async () => {
    const { service, query } = buildService([]);

    await service.getMyEsims(8, { limit: 10_000 });

    const [, params] = query.mock.calls[0] as [string, unknown[]];
    expect(params[3]).toBe(500);
  });

  it('should treat an empty filter as no filter', async () => {
    const { service, query } = buildService([]);

    await service.getMyEsims(8, { search: '   ', status: '' });

    const [, params] = query.mock.calls[0] as [string, unknown[]];
    expect(params[1]).toBeNull();
    expect(params[2]).toBeNull();
  });
});

describe('PartnersService.getMyPurchases (#046)', () => {
  it('should list the orders this partner placed themselves', async () => {
    const { service, query } = buildService([]);

    await service.getMyPurchases(8);

    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('o."userId" = $1');
    expect(sql).not.toContain('attributedPartnerId');
    expect(params[0]).toBe(100);
  });

  it('should carry the list price beside what was paid', async () => {
    // The two together are the margin, which is the whole point of the screen.
    const { service } = buildService([
      {
        orderNumber: 'ORD-1',
        // Whose purchase this is — the partner's own screen ignores it, the
        // admin's list across every partner needs it (#071).
        partnerId: '8',
        partnerName: 'Công ty ABC',
        status: 'completed',
        orderType: 'ESIM',
        paidVnd: '900000',
        listVnd: '1000000',
        refundedVnd: '0',
        esimCount: 5,
        createdAt: '2026-09-18T03:00:00.000Z',
        items: [{ planName: 'Nhật Bản 5GB', quantity: 5, vndPrice: 900000 }],
      },
    ]);

    await expect(service.getMyPurchases(8)).resolves.toEqual([
      {
        orderNumber: 'ORD-1',
        partnerId: 8,
        partnerName: 'Công ty ABC',
        status: 'completed',
        orderType: 'ESIM',
        paidVnd: 900_000,
        listVnd: 1_000_000,
        refundedVnd: 0,
        esimCount: 5,
        createdAt: '2026-09-18T03:00:00.000Z',
        items: [{ planName: 'Nhật Bản 5GB', quantity: 5, vndPrice: 900_000 }],
      },
    ]);
  });

  it('should survive an order with no items', async () => {
    const { service } = buildService([
      {
        orderNumber: 'ORD-2',
        status: 'cancelled',
        orderType: null,
        paidVnd: '0',
        listVnd: '0',
        refundedVnd: '0',
        esimCount: 0,
        createdAt: '2026-09-18T03:00:00.000Z',
        items: [],
      },
    ]);

    await expect(service.getMyPurchases(8)).resolves.toMatchObject([
      { orderNumber: 'ORD-2', items: [] },
    ]);
  });

  it('should cap how many orders one call can ask for', async () => {
    const { service, query } = buildService([]);

    await service.getMyPurchases(8, { limit: 5_000 });

    const [, params] = query.mock.calls[0] as [string, unknown[]];
    expect(params[3]).toBe(200);
  });
});
