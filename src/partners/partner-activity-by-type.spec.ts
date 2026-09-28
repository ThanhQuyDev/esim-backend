import { PartnersService } from './partners.service';

/**
 * Orders, live partners and the settlement queue (#051).
 *
 * The definition that matters: "đối tác nào có phát sinh giao dịch trong 30
 * ngày thì tính là hoạt động". Counting the `active` status instead would call
 * a partner approved a year ago and silent ever since "đang hoạt động", which
 * is the opposite of what the dashboard is for.
 */

function buildService(rows: {
  orders?: Record<string, unknown>[];
  active?: Record<string, unknown>[];
  pending?: Record<string, unknown>[];
  reconcile?: Record<string, unknown>;
}) {
  const query = jest
    .fn()
    .mockResolvedValueOnce(rows.orders ?? [])
    .mockResolvedValueOnce(rows.active ?? [])
    .mockResolvedValueOnce(rows.pending ?? [])
    .mockResolvedValueOnce([
      rows.reconcile ?? { totalVnd: '0', partners: '0' },
    ]);

  const service = Object.create(PartnersService.prototype) as PartnersService;
  Object.assign(service, { dataSource: { query } });
  return { service, query };
}

describe('PartnersService.adminPartnerActivity (#051)', () => {
  it('should split orders by partner type and total them', async () => {
    const { service } = buildService({
      orders: [
        { partnerType: 'kol', orders: '128' },
        { partnerType: 'distribution', orders: '42' },
      ],
    });

    const result = await service.adminPartnerActivity();

    expect(result.orders.total).toBe(170);
    expect(result.orders.byType).toEqual([
      { partnerType: 'distribution', orders: 42 },
      { partnerType: 'kol', orders: 128 },
    ]);
  });

  it('should count a partner as active only if they transacted in the period', async () => {
    const { service, query } = buildService({
      active: [{ partnerType: 'kol', partners: '7' }],
    });

    const result = await service.adminPartnerActivity();

    expect(result.activePartners.total).toBe(7);
    const [sql, params] = query.mock.calls[1] as [string, unknown[]];
    // Driven by orders in the window, not by partner.status.
    expect(sql).toContain('COUNT(DISTINCT "partnerId")');
    expect(sql).toContain('o."createdAt" >= $1');
    expect(sql).not.toContain("status = 'active'");
    expect(params[0]).toBeInstanceOf(Date);
  });

  it('should count a partner once however the order reached them', async () => {
    // Either side of the business counts as a transaction: an order credited to
    // them, or one they placed. A distributor with the affiliate grant (#048)
    // can have both and is still one active partner.
    const { service, query } = buildService({});

    await service.adminPartnerActivity();

    const [sql] = query.mock.calls[0] as [string];
    expect(sql).toContain('p.id = o."attributedPartnerId"');
    expect(sql).toContain('p."userId" = o."userId"');
    expect(sql).toContain('COUNT(DISTINCT "orderId")');
  });

  it('should list partners waiting for approval by type', async () => {
    const { service, query } = buildService({
      pending: [
        { partnerType: 'distribution', partners: '2' },
        { partnerType: 'kol', partners: '5' },
      ],
    });

    const result = await service.adminPartnerActivity();

    expect(result.pendingApprovals.total).toBe(7);
    const [sql] = query.mock.calls[2] as [string];
    expect(sql).toContain("status = 'pending'");
  });

  it('should show the commission queue as money and partners', async () => {
    const { service } = buildService({
      reconcile: { totalVnd: '12400000', partners: '9' },
    });

    const result = await service.adminPartnerActivity();

    expect(result.commissionToReconcile).toEqual({
      totalVnd: 12_400_000,
      partners: 9,
    });
  });

  it('should read an empty programme as zeroes, not as missing', async () => {
    const { service } = buildService({});

    const result = await service.adminPartnerActivity();

    expect(result.orders).toEqual({ total: 0, byType: [] });
    expect(result.activePartners.total).toBe(0);
    expect(result.commissionToReconcile.totalVnd).toBe(0);
  });

  it('should echo the window back for the header', async () => {
    const { service } = buildService({});

    const result = await service.adminPartnerActivity({
      from: '2026-09-01',
      to: '2026-09-30',
    });

    expect(new Date(result.range.from).getDate()).toBe(1);
    expect(new Date(result.range.to).getMonth()).toBe(9);
  });
});
