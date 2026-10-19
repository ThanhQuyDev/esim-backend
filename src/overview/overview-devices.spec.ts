import { OverviewService } from './overview.service';

/** Successful orders by desktop / mobile / tablet (doitac-1410 #083). */
function makeService(rows: Array<{ deviceType: string; orders: string }>) {
  const calls: { where: string[]; selects: string[] } = {
    where: [],
    selects: [],
  };
  const qb: Record<string, jest.Mock> = {};
  const chain =
    (fn?: (...args: unknown[]) => void) =>
    (...args: unknown[]) => {
      fn?.(...args);
      return qb;
    };
  qb.innerJoin = jest.fn(chain());
  qb.where = jest.fn(chain((sql) => calls.where.push(String(sql))));
  qb.andWhere = jest.fn(chain((sql) => calls.where.push(String(sql))));
  qb.select = jest.fn(chain((sql) => calls.selects.push(String(sql))));
  qb.addSelect = jest.fn(chain((sql) => calls.selects.push(String(sql))));
  qb.groupBy = jest.fn(chain());
  qb.getRawMany = jest.fn().mockResolvedValue(rows);
  const service = new OverviewService(
    {} as never,
    { createQueryBuilder: () => qb } as never,
    {} as never,
    {} as never,
  );
  return { service, calls };
}

describe('Orders by device (#083)', () => {
  it('should count and share out the successful orders per device', async () => {
    const { service } = makeService([
      { deviceType: 'mobile', orders: '6' },
      { deviceType: 'desktop', orders: '3' },
      { deviceType: 'unknown', orders: '1' },
    ]);

    const res = await service.getOrdersByDevice({} as never);

    expect(res.total).toBe(10);
    // Fixed order, devices with no orders left out.
    expect(res.data).toEqual([
      { deviceType: 'desktop', orders: 3, percent: 30 },
      { deviceType: 'mobile', orders: 6, percent: 60 },
      { deviceType: 'unknown', orders: 1, percent: 10 },
    ]);
  });

  it('should count an order once and only when one of its lines completed', async () => {
    const { service, calls } = makeService([]);

    const res = await service.getOrdersByDevice({
      provider: 'airalo',
    } as never);

    expect(res).toEqual({ total: 0, data: [] });
    expect(calls.selects.join(' ')).toContain('COUNT(DISTINCT');
    const where = calls.where.join(' ');
    expect(where).toContain('completedOrderStatuses');
    expect(where).toContain('completedOrderItemStatuses');
    expect(where).toContain(':provider');
  });

  it('should round the shares to one decimal', async () => {
    const { service } = makeService([
      { deviceType: 'mobile', orders: '2' },
      { deviceType: 'tablet', orders: '1' },
    ]);
    const res = await service.getOrdersByDevice({} as never);
    expect(res.data.map((d) => d.percent)).toEqual([66.7, 33.3]);
  });
});
