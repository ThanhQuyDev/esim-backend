import { PartnersService } from './partners.service';

/** doitac-0911 #015 — "Mã đối chiếu" on each wallet line. */
describe('Wallet lines carry their reference (doitac-0911 #015)', () => {
  it('should give the order code, WD-… or the deposit code', async () => {
    const rows = [
      {
        id: 1,
        orderId: 77,
        sourceType: 'order_partner_commission',
        sourceId: '5',
      },
      { id: 2, orderId: null, sourceType: 'partner_payout', sourceId: '12' },
      {
        id: 3,
        orderId: null,
        sourceType: 'partner_deposit_request',
        sourceId: '4',
      },
      { id: 4, orderId: null, sourceType: 'admin', sourceId: '1' },
    ];
    const query = jest.fn((sql: string) =>
      Promise.resolve(
        /FROM "order"/.test(sql)
          ? [{ id: 77, orderNumber: 'ORD-261105001756147-GPUS6I' }]
          : [{ id: 4, code: 'NAP8K3QX' }],
      ),
    );
    const service = Object.create(PartnersService.prototype) as PartnersService;
    Object.assign(service as unknown as Record<string, unknown>, {
      transactionRepository: { find: jest.fn().mockResolvedValue(rows) },
      dataSource: { query },
    });

    const result = await service.getWalletTransactions(8, 50);

    expect(result.map((r) => r.reference)).toEqual([
      'ORD-261105001756147-GPUS6I',
      'WD-000012',
      'NAP8K3QX',
      null,
    ]);
  });
});
