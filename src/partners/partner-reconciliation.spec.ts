import { PartnersService } from './partners.service';

/**
 * The monthly reconciliation statement (#065).
 *
 * The commission list is a row per order, which is the wrong grain for a
 * sign-off: an admin approves "tháng 9 của đối tác A", not four hundred
 * commissions one at a time. Only the decision is stored — the figures are
 * worked out from the commissions every time, because a stored copy stops
 * matching the moment an order is refunded.
 */

function buildService(rows: Record<string, unknown>[] = []) {
  const query = jest.fn().mockResolvedValue(rows);
  const save = jest.fn().mockImplementation((row) => Promise.resolve(row));
  const findOne = jest.fn().mockResolvedValue(null);

  const service = Object.create(PartnersService.prototype) as PartnersService;
  Object.assign(service, {
    dataSource: { query },
    reconciliationRepository: { findOne, save, create: (row: unknown) => row },
  });
  return { service, query, save, findOne };
}

const ROW = {
  partnerId: '8',
  contactName: 'Nguyễn Văn A',
  contactEmail: 'a@example.com',
  validOrders: '40',
  esimsSold: '52',
  viaCouponOrders: '10',
  revenueVnd: '120000000',
  commissionVnd: '18000000',
  storedStatus: null,
  note: null,
};

describe('PartnersService.adminListReconciliations (#065)', () => {
  it('should work the figures out per partner for the period', async () => {
    const { service } = buildService([ROW]);

    const result = await service.adminListReconciliations({
      period: '2026-09',
    });

    expect(result.period).toBe('2026-09');
    expect(result.rows[0]).toMatchObject({
      partnerId: 8,
      validOrders: 40,
      esimsSold: 52,
      revenueVnd: 120_000_000,
      commissionVnd: 18_000_000,
    });
  });

  it('should read "% qua mã" as the share of completed orders with a code', async () => {
    const { service } = buildService([ROW]);

    const result = await service.adminListReconciliations({
      period: '2026-09',
    });

    expect(result.rows[0].viaCouponPercent).toBe(25);
  });

  it('should not divide by nothing for a partner with no valid orders', async () => {
    const { service } = buildService([
      { ...ROW, validOrders: '0', viaCouponOrders: '0' },
    ]);

    const result = await service.adminListReconciliations({});

    expect(result.rows[0].viaCouponPercent).toBe(0);
  });

  it('should default an untouched month to "chờ xác nhận"', async () => {
    // No row in the table means nobody has looked at it yet.
    const { service } = buildService([ROW]);

    const result = await service.adminListReconciliations({
      period: '2026-09',
    });

    expect(result.rows[0].status).toBe('pending');
  });

  it('should carry a decision that was already made', async () => {
    const { service } = buildService([
      { ...ROW, storedStatus: 'approved', note: 'Đã đối chiếu với kế toán' },
    ]);

    const result = await service.adminListReconciliations({});

    expect(result.rows[0]).toMatchObject({
      status: 'approved',
      note: 'Đã đối chiếu với kế toán',
    });
  });

  it('should count each order once however many lines it has', async () => {
    // Joining order_item at the top level would multiply revenue by the number
    // of lines; the aggregate is done per order inside a lateral instead.
    const { service, query } = buildService();

    await service.adminListReconciliations({ period: '2026-09' });

    const [sql] = query.mock.calls[0] as [string];
    expect(sql).toContain('JOIN LATERAL');
    expect(sql).toContain('FROM order_item oi WHERE oi."orderId" = o.id');
  });

  it('should fall back to this month when the period makes no sense', async () => {
    const { service } = buildService();

    const result = await service.adminListReconciliations({
      period: 'tháng chín',
    });

    expect(result.period).toBe(new Date().toISOString().slice(0, 7));
  });

  it('should cut the period at the calendar month', async () => {
    const { service, query } = buildService();

    await service.adminListReconciliations({ period: '2026-09' });

    const [, params] = query.mock.calls[0] as [string, Date[]];
    expect(params[0].getMonth()).toBe(8);
    expect(params[0].getDate()).toBe(1);
    expect(params[1].getMonth()).toBe(9);
  });
});

describe('PartnersService.adminSetReconciliationStatus (#065)', () => {
  it('should create a statement for a month nobody has signed off yet', async () => {
    const { service, save } = buildService();

    await service.adminSetReconciliationStatus(
      {
        partnerIds: [8],
        period: '2026-09',
        status: 'approved',
        note: '  OK  ',
      },
      3,
    );

    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        partnerId: 8,
        period: '2026-09',
        status: 'approved',
        note: 'OK',
        updatedByAdminId: 3,
      }),
    );
  });

  it('should update the one that is already there', async () => {
    const { service, save, findOne } = buildService();
    findOne.mockResolvedValue({
      id: 1,
      partnerId: 8,
      period: '2026-09',
      status: 'pending',
      note: 'Đang hỏi lại đối tác',
    });

    await service.adminSetReconciliationStatus(
      { partnerIds: [8], period: '2026-09', status: 'reviewing' },
      3,
    );

    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, status: 'reviewing' }),
    );
  });

  it('should leave an existing note alone when none was sent', async () => {
    // Approving a row should not silently erase what somebody wrote on it.
    const { service, save, findOne } = buildService();
    findOne.mockResolvedValue({
      id: 1,
      partnerId: 8,
      period: '2026-09',
      status: 'pending',
      note: 'Đang hỏi lại đối tác',
    });

    await service.adminSetReconciliationStatus(
      { partnerIds: [8], period: '2026-09', status: 'approved' },
      3,
    );

    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ note: 'Đang hỏi lại đối tác' }),
    );
  });

  it('should sign off many partners in one decision', async () => {
    const { service, save } = buildService();

    const result = await service.adminSetReconciliationStatus(
      { partnerIds: [8, 9, 8], period: '2026-09', status: 'approved' },
      3,
    );

    // The repeated id is one partner, not two.
    expect(result.updated).toBe(2);
    expect(save).toHaveBeenCalledTimes(2);
  });
});
