import { PartnersService } from './partners.service';

/** doitac-0911 #016 — a purchase line carries its products for "+ N sản phẩm khác". */
describe('Ledger lines carry the order products (doitac-0911 #016)', () => {
  const build = (rows: Record<string, unknown>[]) => {
    const service = Object.create(PartnersService.prototype) as PartnersService;
    Object.assign(service as unknown as Record<string, unknown>, {
      dataSource: { query: jest.fn().mockResolvedValue(rows) },
    });
    return service;
  };
  const base = {
    id: 1,
    amountVnd: -4920000,
    balanceAfterVnd: 1,
    reason: null,
    createdAt: new Date(),
    orderNumber: 'PTN-1',
    orderType: 'BUY_NEW',
    items: 'A x2, B x1',
    products: [
      {
        planName: 'Discover Global - Total 5 GB - 30 days',
        quantity: 2,
        vndPrice: 920000,
      },
      { planName: 'Finland - Daily 3 GB/day', quantity: 1, vndPrice: 184000 },
    ],
  };

  it('should give each product, its eSIMs and price on a purchase', async () => {
    const [row] = await build([
      { ...base, type: 'order_purchase' },
    ]).getMyLedger(11);
    expect(row.products).toEqual([
      {
        planName: 'Discover Global - Total 5 GB - 30 days',
        quantity: 2,
        vndPrice: 920000,
      },
      { planName: 'Finland - Daily 3 GB/day', quantity: 1, vndPrice: 184000 },
    ]);
  });

  it('should give none on a top-up or a deposit', async () => {
    const rows = await build([
      { ...base, type: 'order_purchase', orderType: 'TOPUP' },
      { ...base, type: 'deposit', orderNumber: null, products: null },
    ]).getMyLedger(11);
    expect(rows.map((r) => r.products)).toEqual([[], []]);
  });
});
