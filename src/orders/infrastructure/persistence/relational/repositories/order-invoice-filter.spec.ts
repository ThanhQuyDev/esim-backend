import { InvoiceStatus } from '../../../../../invoices/invoices.enum';
import { OrdersRelationalRepository } from './order.repository';

/** #051 — "Lọc đơn hàng có yêu cầu xuất hóa đơn". */
describe('OrdersRelationalRepository invoice filter', () => {
  function setup() {
    const qb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    const typeorm = {
      createQueryBuilder: jest.fn().mockReturnValue(qb),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    const repository = new OrdersRelationalRepository(typeorm as never);
    return { qb, typeorm, repository };
  }

  const paginationOptions = { page: 1, limit: 10 };

  function conditions(qb: { andWhere: jest.Mock }): string[] {
    return qb.andWhere.mock.calls.map((call) =>
      String(call[0]).replace(/\s+/g, ' ').trim(),
    );
  }

  it('should list only orders with an invoice request', async () => {
    const { qb, typeorm, repository } = setup();

    await repository.findManyWithPagination({
      filterOptions: { hasInvoice: true },
      paginationOptions,
    });

    expect(typeorm.findAndCount).not.toHaveBeenCalled();
    expect(conditions(qb)).toContain(
      '"order"."id" IN ( SELECT "inv"."orderId" FROM "invoice" "inv" WHERE "inv"."orderId" IS NOT NULL )',
    );
  });

  it('should list only orders without an invoice request', async () => {
    const { qb, repository } = setup();

    await repository.findManyWithPagination({
      filterOptions: { hasInvoice: false },
      paginationOptions,
    });

    expect(
      conditions(qb).some((sql) => sql.startsWith('NOT "order"."id" IN')),
    ).toBe(true);
  });

  it('should filter by the invoice status', async () => {
    const { qb, repository } = setup();

    await repository.findManyWithPagination({
      filterOptions: { invoiceStatus: InvoiceStatus.PENDING, status: 'paid' },
      paginationOptions,
    });

    expect(qb.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('"inv"."status" = :invoiceStatus'),
      { invoiceStatus: 'PENDING' },
    );
    // Combined with the other filters, not instead of them.
    expect(qb.andWhere).toHaveBeenCalledWith('"order"."status" = :status', {
      status: 'paid',
    });
  });

  it('should keep the simple query when no invoice filter is set', async () => {
    const { typeorm, repository } = setup();

    await repository.findManyWithPagination({
      filterOptions: { status: 'paid' },
      paginationOptions,
    });

    expect(typeorm.findAndCount).toHaveBeenCalled();
    expect(typeorm.createQueryBuilder).not.toHaveBeenCalled();
  });
});
