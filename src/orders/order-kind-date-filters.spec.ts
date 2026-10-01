import { OrdersRelationalRepository } from './infrastructure/persistence/relational/repositories/order.repository';
import { FilterOrderDto } from './dto/query-order.dto';

/**
 * #017 — filter the order list by kind (eSIM / Affiliate / Topup) and by the date
 * the order was created.
 *
 * The SQL is asserted rather than the rows: these conditions are easy to get
 * subtly wrong (a `<=` on a bare date silently drops the last day), and that is
 * exactly what the test has to hold.
 */
describe('Order kind and created-date filters (#017)', () => {
  function capture(filters: Partial<FilterOrderDto>) {
    const clauses: { sql: string; params?: Record<string, unknown> }[] = [];
    const qb = {
      andWhere: jest.fn((sql: string, params?: Record<string, unknown>) => {
        clauses.push({ sql, params });
        return qb;
      }),
    };

    const repository = Object.create(
      OrdersRelationalRepository.prototype,
    ) as OrdersRelationalRepository;
    (
      repository as unknown as {
        applyAdvancedFilters: (qb: unknown, f: unknown) => void;
      }
    ).applyAdvancedFilters(qb, filters as FilterOrderDto);

    return { clauses, sql: clauses.map((c) => c.sql).join(' | ') };
  }

  it('should topup matches on orderType', () => {
    const { sql } = capture({ kind: 'topup' });
    expect(sql).toContain(`"order"."orderType" = 'TOPUP'`);
    expect(sql).not.toContain('NOT (');
  });

  it('should affiliate matches orders that earned a commission', () => {
    const { sql } = capture({ kind: 'affiliate' });
    expect(sql).toContain('order_partner_commission');
    expect(sql).not.toContain('NOT (');
  });

  it('should esim excludes both topups and commissioned orders, so the three do not overlap', () => {
    const { sql } = capture({ kind: 'esim' });
    expect(sql).toContain(`<> 'TOPUP'`);
    expect(sql).toContain('NOT (');
    expect(sql).toContain('order_partner_commission');
  });

  it('should treats a missing orderType as an ordinary purchase', () => {
    // Rows created before the column existed are NULL, and they are eSIM orders.
    const { sql } = capture({ kind: 'esim' });
    expect(sql).toContain(`COALESCE("order"."orderType", 'BUY_NEW')`);
  });

  it('should applies no kind condition when none is asked for', () => {
    const { sql } = capture({});
    expect(sql).not.toContain('orderType');
    expect(sql).not.toContain('order_partner_commission');
  });

  it('should createdFrom is inclusive of the day it names', () => {
    const { clauses } = capture({ createdFrom: '2026-09-01' });
    const clause = clauses.find((c) => c.sql.includes('createdFrom'));
    expect(clause?.sql).toContain('>=');
    expect(clause?.params).toEqual({ createdFrom: '2026-09-01' });
  });

  it('should createdTo covers the whole day rather than stopping at its midnight', () => {
    const { clauses } = capture({ createdTo: '2026-09-30' });
    const clause = clauses.find((c) => c.sql.includes('createdTo'));
    // `<= '2026-09-30'` would drop every order placed during that day, which is
    // the day an admin is most likely to be looking at.
    expect(clause?.sql).toContain('<');
    expect(clause?.sql).toContain(`INTERVAL '1 day'`);
    expect(clause?.sql).not.toMatch(/<=\s*:createdTo/);
  });

  it('should accepts both ends of the range together', () => {
    const { sql } = capture({
      createdFrom: '2026-09-01',
      createdTo: '2026-09-30',
    });
    expect(sql).toContain('createdFrom');
    expect(sql).toContain('createdTo');
  });
});
