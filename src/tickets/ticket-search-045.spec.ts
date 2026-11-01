import { TicketsRelationalRepository } from './infrastructure/persistence/relational/repositories/ticket.repository';

/**
 * doitac-3010 #045 — the one search box on "Tickets" also finds the order
 * number and the ICCID.
 */
describe('Ticket search (doitac-3010 #045)', () => {
  const run = async (search: string) => {
    const andWhere = jest.fn().mockReturnThis();
    const qb = {
      andWhere,
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    const repo = new TicketsRelationalRepository({
      createQueryBuilder: () => qb,
    } as never);
    await repo.findManyWithPagination({
      filterOptions: { search },
      paginationOptions: { page: 1, limit: 10 },
    } as never);
    return andWhere.mock.calls.find(([sql]) => String(sql).includes('ILIKE'));
  };

  it('should search the order number and the ICCID in the same box', async () => {
    const [sql, params] = (await run('8984048000978915904'))!;
    expect(sql).toContain('ticket."orderId" ILIKE :search');
    expect(sql).toContain('ticket.iccid ILIKE :search');
    expect(params).toEqual({ search: '%8984048000978915904%' });
  });

  it('should still find an order pasted with a leading #', async () => {
    const [, params] = (await run(' #PTN-2611 '))!;
    expect(params).toEqual({ search: '%PTN-2611%' });
  });
});
