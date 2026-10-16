import { PartnersService } from './partners.service';

/**
 * Filtering the reconciliation list (#064).
 *
 * The one that needs explaining is "đang kiểm tra". It is not a status of its
 * own in the data: it is a commission still inside its 24-hour hold whose order
 * carries a fraud-watch mark (#036, #040) — the ones somebody should look at
 * before the money is credited. Storing it as a fourth status would mean
 * writing a state that nothing ever clears.
 */

function buildService() {
  const qb: Record<string, jest.Mock> = {};
  for (const method of [
    'createQueryBuilder',
    'leftJoin',
    'andWhere',
    'orderBy',
    'skip',
    'take',
  ]) {
    qb[method] = jest.fn().mockReturnValue(qb);
  }
  qb.getManyAndCount = jest.fn().mockResolvedValue([[], 0]);

  const service = Object.create(PartnersService.prototype) as PartnersService;
  Object.assign(service, {
    commissionRepository: { createQueryBuilder: () => qb },
  });
  return { service, qb };
}

const clauses = (qb: Record<string, jest.Mock>) =>
  (qb.andWhere.mock.calls as [string, Record<string, unknown>?][]).map(
    ([sql]) => sql,
  );

describe('PartnersService.adminListCommissions — filters (#064)', () => {
  it('should read "đang kiểm tra" as a held commission on a flagged order', async () => {
    const { service, qb } = buildService();

    await service.adminListCommissions({ status: 'reviewing' });

    const sql = clauses(qb).join(' ');
    expect(sql).toContain('c.status = :pending');
    expect(sql).toContain('o."attributionWarning" IS NOT NULL');
  });

  it('should filter on a stored status directly', async () => {
    const { service, qb } = buildService();

    await service.adminListCommissions({ status: 'credited' });

    expect(clauses(qb).join(' ')).toContain('c.status = :status');
  });

  it('should treat "all" as no status filter at all', async () => {
    const { service, qb } = buildService();

    await service.adminListCommissions({ status: 'all' });

    expect(clauses(qb).join(' ')).not.toContain('c.status');
  });

  it('should search the partner by name, email, phone or id', async () => {
    const { service, qb } = buildService();

    await service.adminListCommissions({ search: '42' });

    const call = (
      qb.andWhere.mock.calls as [string, Record<string, unknown>][]
    ).find(([sql]) => sql.includes('ILIKE'));
    expect(call?.[0]).toContain('p."contactPhone" ILIKE :search');
    expect(call?.[0]).toContain('p.id = :id');
    expect(call?.[1].id).toBe(42);
  });

  it('should cut a reconciliation period at the calendar month', async () => {
    // Statements are cut monthly, so "kỳ đối soát" is a month, not 30 days.
    const { service, qb } = buildService();

    await service.adminListCommissions({ period: '2026-09' });

    const call = (
      qb.andWhere.mock.calls as [string, Record<string, Date>][]
    ).find(([sql]) => sql.includes('periodStart'));
    const { periodStart, periodEnd } = call![1];
    expect(periodStart.getMonth()).toBe(8);
    expect(periodStart.getDate()).toBe(1);
    expect(periodEnd.getMonth()).toBe(9);
    expect(periodEnd.getDate()).toBe(1);
  });

  it('should ignore a period it cannot read', async () => {
    const { service, qb } = buildService();

    await service.adminListCommissions({ period: 'tháng chín' });

    expect(clauses(qb).join(' ')).not.toContain('periodStart');
  });

  it('should fall back to a from/to range when no period is given', async () => {
    const { service, qb } = buildService();

    await service.adminListCommissions({
      from: '2026-09-01',
      to: '2026-09-07',
    });

    expect(clauses(qb).join(' ')).toContain('c."createdAt" >= :from');
  });

  it('should let the period win over a range, rather than applying both', async () => {
    const { service, qb } = buildService();

    await service.adminListCommissions({
      period: '2026-09',
      from: '2026-01-01',
      to: '2026-01-31',
    });

    const sql = clauses(qb).join(' ');
    expect(sql).toContain('periodStart');
    expect(sql).not.toContain(':from');
  });
});

describe('PartnersService.adminListCommissions — per-order table (doitac-1410 #056)', () => {
  it('should cut the reconciliation period on a Vietnamese month', async () => {
    const { service, qb } = buildService();
    await service.adminListCommissions({ period: '2026-10' });
    const call = (
      qb.andWhere.mock.calls as [string, Record<string, Date>][]
    ).find(([sql]) => sql.includes(':periodStart'))!;
    // 01/10 00:00 → 01/11 00:00 in Vietnam (UTC+7).
    expect(call[1].periodStart.toISOString()).toBe('2026-09-30T17:00:00.000Z');
    expect(call[1].periodEnd.toISOString()).toBe('2026-10-31T17:00:00.000Z');
  });

  it('should search a company by its own name too', async () => {
    const { service, qb } = buildService();
    await service.adminListCommissions({ search: 'ETELECOM' });
    expect(clauses(qb).join(' ')).toContain('p."companyName" ILIKE :search');
  });

  it('should give each commission its partner, order, period and source', async () => {
    const { service, qb } = buildService();
    qb.getManyAndCount.mockResolvedValue([
      [
        {
          id: 7,
          partnerId: 9,
          orderId: 70,
          status: 'credited',
          createdAt: '2026-10-15T03:00:00Z',
        },
        {
          id: 8,
          partnerId: 10,
          orderId: 80,
          status: 'pending',
          createdAt: '2026-10-01T03:00:00Z',
        },
      ],
      2,
    ]);
    Object.assign(service, {
      dataSource: {
        query: jest.fn().mockResolvedValue([
          {
            id: 7,
            legalType: 'company',
            companyName: 'Công ty TNHH ETELECOM',
            contactName: 'Nguyễn A',
            orderNumber: 'ORD-70',
            orderAt: '2026-09-30T18:00:00Z',
            orderRevenueVnd: '500000',
            couponCode: 'GIAM10',
            linkCode: null,
            attributionWarning: null,
          },
          {
            id: 8,
            legalType: 'individual',
            companyName: null,
            contactName: 'Trần B',
            orderNumber: 'ORD-80',
            orderAt: '2026-10-01T03:00:00Z',
            orderRevenueVnd: '300000',
            couponCode: null,
            linkCode: 'VANA2026',
            attributionWarning: 'partner_ip',
          },
        ]),
      },
    });
    const { data } = await service.adminListCommissions({});
    expect(data[0]).toMatchObject({
      partnerName: 'Công ty TNHH ETELECOM',
      orderNumber: 'ORD-70',
      orderRevenueVnd: 500000,
      // 30/09 18:00 UTC is already 01/10 in Vietnam.
      period: '10/2026',
      source: { type: 'coupon', code: 'GIAM10' },
    });
    expect(data[1]).toMatchObject({
      partnerName: 'Trần B',
      source: { type: 'link', code: 'VANA2026' },
      attributionWarning: 'partner_ip',
    });
  });
});
