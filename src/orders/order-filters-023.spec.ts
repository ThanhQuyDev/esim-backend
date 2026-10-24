import { OrdersRelationalRepository } from './infrastructure/persistence/relational/repositories/order.repository';
import { FilterOrderDto } from './dto/query-order.dto';

/** vande #023 — the order list filtered by one affiliate partner, and the single search box. */
describe('Order list filters (vande #023)', () => {
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
    return clauses;
  }

  it('should keep only the orders one affiliate partner earned commission on', () => {
    const clause = capture({ affiliatePartnerId: 8 }).find((c) =>
      c.sql.includes('affiliatePartnerId'),
    );
    expect(clause?.sql).toContain('"order_partner_commission"');
    expect(clause?.params).toEqual({ affiliatePartnerId: 8 });
  });

  it('should search order number, email, ICCID and plan name from one box', () => {
    const clause = capture({ q: 'abc' }).find((c) => c.sql.includes(':q'));
    for (const part of [
      '"order"."orderNumber" ILIKE :q',
      '"u"."email" ILIKE :q',
      '"e"."iccid" ILIKE :q',
      '"p"."name" ILIKE :q',
    ]) {
      expect(clause?.sql).toContain(part);
    }
  });
});
