import {
  OrdersRelationalRepository,
  hidesPartnerOrders,
} from './order.repository';

/**
 * A distribution partner's own purchases appear in "Đơn hàng đối tác", not in
 * the admin's order list (doitac-1410 #036).
 */
describe('OrdersRelationalRepository — partner purchases (doitac-1410 #036)', () => {
  function setup() {
    const qb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    const typeorm = {
      createQueryBuilder: jest.fn().mockReturnValue(qb),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    return {
      qb,
      typeorm,
      repository: new OrdersRelationalRepository(typeorm as never),
    };
  }
  const paginationOptions = { page: 1, limit: 10 };

  it('should leave partner purchases out of the plain admin list', async () => {
    const { typeorm, repository } = setup();
    await repository.findManyWithPagination({
      filterOptions: {},
      paginationOptions,
    });
    const where = typeorm.findAndCount.mock.calls[0][0].where;
    expect(Array.isArray(where)).toBe(true);
    expect(where).toHaveLength(2);
    expect(JSON.stringify(where)).toContain('partner_wallet');
  });

  it('should leave them out of the filtered list and the export too', async () => {
    const { qb, repository } = setup();
    await repository.findManyWithPagination({
      filterOptions: { orderNumber: 'PTN' },
      paginationOptions,
    });
    const sql = qb.andWhere.mock.calls.map((c) => String(c[0])).join(' ');
    expect(sql).toContain('"order"."paymentMethod" <> :partnerWallet');
  });

  it('should keep them for a customer list and for an explicit lookup', () => {
    expect(hidesPartnerOrders({ userId: 20 })).toBe(false);
    expect(hidesPartnerOrders({ includePartnerOrders: true })).toBe(false);
    expect(hidesPartnerOrders({ includePartnerOrders: 'true' } as never)).toBe(
      false,
    );
    expect(hidesPartnerOrders({})).toBe(true);
    expect(hidesPartnerOrders(null)).toBe(true);
  });
});
