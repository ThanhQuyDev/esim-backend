import * as ExcelJS from 'exceljs';
import { PartnersService } from './partners.service';
import { ledgerCode, ledgerDescription, ledgerKindOf } from './partner-ledger';

/**
 * "Lịch sử giao dịch" of the deposit wallet (doitac-1410 #031): a kind to
 * filter on, the code to quote, a sentence that says what happened, and one
 * export with the deposits and withdrawals on their own sheets.
 */
const base = {
  reason: null,
  orderNumber: null,
  items: null,
  payoutId: null,
  depositCode: null,
  depositMethod: null,
};

describe('partner ledger lines (doitac-1410 #031)', () => {
  it('should name a purchase and its refund by the order and its plans', () => {
    const row = {
      ...base,
      type: 'order_purchase',
      orderNumber: 'PTN-1',
      items: 'Thái Lan 10GB/ngày x 2',
    };
    expect(ledgerKindOf(row.type)).toBe('purchase');
    expect(ledgerCode(row)).toBe('PTN-1');
    expect(ledgerDescription(row)).toBe('Mua eSIM Thái Lan 10GB/ngày x 2');
    expect(ledgerDescription({ ...row, type: 'order_purchase_reversal' })).toBe(
      'Hoàn tiền eSIM Thái Lan 10GB/ngày x 2',
    );
  });

  it('should give a withdrawal its WD code and a deposit its transfer reference', () => {
    expect(ledgerCode({ ...base, type: 'payout', payoutId: 8 })).toBe(
      'WD-000008',
    );
    expect(ledgerDescription({ ...base, type: 'payout', payoutId: 8 })).toBe(
      'Đối tác rút tiền',
    );
    const deposit = { ...base, type: 'deposit', depositCode: 'ESIMABC' };
    expect(ledgerCode(deposit)).toBe('ESIMABC');
    expect(ledgerDescription(deposit)).toBe(
      'Xác nhận nạp ký quỹ qua chuyển khoản',
    );
  });

  it('should call an admin adjustment what it is, with the reason', () => {
    const row = { ...base, type: 'manual_credit', reason: 'bù phí' };
    expect(ledgerKindOf(row.type)).toBe('adjustment');
    expect(ledgerDescription(row)).toBe('Admin cộng tiền: bù phí');
  });
});

describe('PartnersService.getMyLedger / export (doitac-1410 #031)', () => {
  function build(rows: unknown[]) {
    const service = Object.create(PartnersService.prototype) as PartnersService;
    const query = jest.fn().mockResolvedValue(rows);
    Object.assign(service, {
      dataSource: { query },
      depositRequestRepository: {
        find: jest.fn().mockResolvedValue([
          {
            createdAt: new Date('2026-10-13T18:18:29Z'),
            method: 'bank_transfer',
            amountVnd: 500000,
            feeVnd: 0,
            creditedVnd: 500000,
            bankTransferCode: 'ESIMABC',
            status: 'confirmed',
          },
        ]),
      },
      payoutRepository: {
        find: jest.fn().mockResolvedValue([
          {
            id: 8,
            createdAt: new Date('2026-10-14T01:00:00Z'),
            amountVnd: 200000,
            status: 'pending',
            bankAccountInfo: 'VCB · •••• 3456',
          },
        ]),
      },
    });
    return { service, query };
  }

  it('should pass the filters, with the dates as Vietnamese days', async () => {
    const { service, query } = build([]);

    await service.getMyLedger(11, {
      code: '#PTN-1',
      kind: 'purchase',
      from: '2026-10-14',
      to: '2026-10-14',
    });

    const params = query.mock.calls[0][1];
    expect(params[0]).toBe(11);
    expect(params[1]).toEqual(['order_purchase']);
    expect((params[2] as Date).toISOString()).toBe('2026-10-13T17:00:00.000Z');
    expect((params[3] as Date).toISOString()).toBe('2026-10-14T17:00:00.000Z');
    expect(params[4]).toBe('PTN-1');
  });

  it('should ignore an unknown kind rather than match nothing', async () => {
    const { service, query } = build([]);
    await service.getMyLedger(11, { kind: 'whatever' });
    expect(query.mock.calls[0][1][1]).toBeNull();
  });

  it('should export three sheets', async () => {
    const { service } = build([
      {
        id: 1,
        type: 'order_purchase',
        amountVnd: '-128000',
        balanceAfterVnd: '13412000',
        reason: null,
        createdAt: new Date('2026-10-13T19:33:00Z'),
        orderNumber: 'PTN-1',
        items: 'Thái Lan x 1',
        payoutId: null,
        depositCode: null,
        depositMethod: null,
      },
    ]);

    const buffer = await service.exportMyLedgerToExcel(11);
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(buffer as never);

    expect(book.worksheets.map((s) => s.name)).toEqual([
      'Lịch sử giao dịch',
      'Lịch sử nạp tiền',
      'Lịch sử rút tiền',
    ]);
    const row = book.getWorksheet('Lịch sử giao dịch')!.getRow(2);
    expect(row.getCell(1).value).toBe('02:33:00 14/10/2026');
    expect(row.getCell(2).value).toBe('Mua eSIM');
    expect(row.getCell(3).value).toBe('PTN-1');
    expect(row.getCell(4).value).toBe('Mua eSIM Thái Lan x 1');
    expect(row.getCell(5).value).toBe(-128000);
    expect(
      book.getWorksheet('Lịch sử rút tiền')!.getRow(2).getCell(1).value,
    ).toBe('WD-000008');
  });
});
