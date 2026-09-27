import { PartnersService } from './partners.service';

/**
 * One order, and how it came to be attributed (#026).
 *
 * The timeline exists for the argument a partner actually starts: "this order
 * was mine". It shows when the customer last touched the link, when they
 * bought, when the eSIM started working, and when the money was approved or
 * taken back.
 */

function buildService(row: Record<string, unknown> | undefined) {
  const service = Object.create(PartnersService.prototype) as PartnersService;
  const sql: string[] = [];

  Object.assign(service, {
    dataSource: {
      query: jest.fn((query: string) => {
        sql.push(query);
        return Promise.resolve(row ? [row] : []);
      }),
    },
  });

  return { service, sql };
}

const PLACED = new Date('2026-09-20T10:00:00Z');

describe('PartnersService — order detail for a partner (#026)', () => {
  it('should read the commission rate back from the money', async () => {
    const { service } = buildService({
      orderNumber: 'ORD-1',
      status: 'paid',
      createdAt: PLACED,
      revenueVnd: '1000000',
      commissionVnd: '150000',
      commissionStatus: 'credited',
      linkCode: 'VANA2026',
      items: [],
    });

    const detail = await service.getMyOrderDetail(5, 'ORD-1');

    // 15%, taken from this order rather than from today's tier — a rate that
    // changed afterwards must not rewrite history.
    expect(detail.commissionPercent).toBe(15);
    expect(detail.source).toEqual({ type: 'link', code: 'VANA2026' });
  });

  it('should treat a Viettel or domestic eSIM as active from the order', async () => {
    const { service } = buildService({
      orderNumber: 'ORD-2',
      createdAt: PLACED,
      revenueVnd: '500000',
      activatedAt: null,
      activatesOnPurchase: true,
      items: [],
    });

    const detail = await service.getMyOrderDetail(5, 'ORD-2');

    expect(detail.timeline.activatedAt).toBe(PLACED);
  });

  it('should leave activation empty for an eSIM the customer has not started', async () => {
    const { service } = buildService({
      orderNumber: 'ORD-3',
      createdAt: PLACED,
      revenueVnd: '500000',
      activatedAt: null,
      activatesOnPurchase: false,
      items: [],
    });

    const detail = await service.getMyOrderDetail(5, 'ORD-3');

    expect(detail.timeline.activatedAt).toBeNull();
  });

  it('should carry the approval and reversal times from the wallet ledger', async () => {
    const credited = new Date('2026-09-21T10:05:00Z');
    const reversed = new Date('2026-09-25T08:00:00Z');
    const { service } = buildService({
      orderNumber: 'ORD-4',
      createdAt: PLACED,
      revenueVnd: '500000',
      commissionVnd: '75000',
      creditedAt: credited,
      reversedAt: reversed,
      items: [],
    });

    const detail = await service.getMyOrderDetail(5, 'ORD-4');

    expect(detail.timeline.creditedAt).toBe(credited);
    expect(detail.timeline.reversedAt).toBe(reversed);
  });

  it('should refuse an order that is not this partner’s', async () => {
    const { service, sql } = buildService(undefined);

    await expect(service.getMyOrderDetail(5, 'ORD-NOPE')).rejects.toThrow(
      'Không tìm thấy đơn hàng',
    );
    // The partner id is part of the lookup, not checked afterwards.
    expect(sql[0]).toContain('o."attributedPartnerId" = $1');
  });
});
