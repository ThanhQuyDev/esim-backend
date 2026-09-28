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
