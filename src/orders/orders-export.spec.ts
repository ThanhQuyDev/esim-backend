import { Workbook } from 'exceljs';
import {
  OrdersExportService,
  exportFileTimestamp,
} from './orders-export.service';

/**
 * Supplier-reconciliation export (#028). What matters is that the sheet can
 * actually be checked against a supplier's statement: one row per supplier
 * line, and totals that exclude money already given back.
 */
function makeService(rows: Record<string, unknown>[]) {
  const orderRepository = {
    findAllForReconciliationExport: jest.fn().mockResolvedValue(rows),
  };
  return new OrdersExportService(orderRepository as never);
}

function row(overrides: Record<string, unknown>) {
  return {
    orderId: 1,
    orderNumber: 'ORD-1',
    orderStatus: 'paid',
    orderCreatedAt: new Date('2026-09-09T03:00:00.000Z'),
    customerEmail: 'a@b.com',
    provider: 'esimaccess',
    planName: 'Japan 5GB',
    providerPlanId: 'JP5',
    providerOrderRef: 'REF1',
    itemStatus: 'completed',
    quantity: 1,
    vndCostPrice: 100000,
    vndPrice: 150000,
    iccids: '8934079000000000001',
    // Order-level columns (#018).
    orderType: 'BUY_NEW',
    paymentMethod: 'onepay',
    couponCode: null,
    referralCode: null,
    couponDiscountVndAmount: 0,
    referralDiscountVndAmount: 0,
    cashbackAmountVnd: 0,
    walletSpentVndAmount: 0,
    partnerName: null,
    partnerCommissionVnd: 0,
    invoiceStatus: null,
    invoiceCompanyName: null,
    invoiceTaxCode: null,
    ...overrides,
  };
}

async function readSheet(buffer: Buffer) {
  const workbook = new Workbook();
  await workbook.xlsx.load(buffer as never);
  const sheet = workbook.worksheets[0];
  const rows: unknown[][] = [];
  sheet.eachRow((r) => rows.push(r.values as unknown[]));
  return { sheet, rows };
}

describe('Order reconciliation export', () => {
  it('should write one row per supplier line, not per order', async () => {
    const service = makeService([
      row({ provider: 'esimaccess' }),
      row({ provider: 'airalo', planName: 'Korea 3GB' }),
    ]);

    const { rows } = await readSheet(await service.exportToExcel());

    // header + 2 lines + totals
    expect(rows).toHaveLength(4);
    const flat = JSON.stringify(rows);
    expect(flat).toContain('esimaccess');
    expect(flat).toContain('airalo');
  });

  it('should total cost, revenue and profit for the supplier statement', async () => {
    const service = makeService([
      row({ orderId: 1, vndCostPrice: 100000, vndPrice: 150000 }),
      row({ orderId: 2, vndCostPrice: 200000, vndPrice: 260000 }),
    ]);

    const { rows } = await readSheet(await service.exportToExcel());
    const totals = rows[rows.length - 1] as unknown[];

    expect(totals).toContain(300000); // cost
    expect(totals).toContain(410000); // revenue
    expect(totals).toContain(110000); // profit
  });

  it('should keep refunded lines visible but out of the totals', async () => {
    const service = makeService([
      row({ vndCostPrice: 100000, vndPrice: 150000 }),
      row({
        orderId: 2,
        itemStatus: 'refunded',
        vndCostPrice: 999000,
        vndPrice: 999000,
      }),
    ]);

    const { rows } = await readSheet(await service.exportToExcel());
    const totals = rows[rows.length - 1] as unknown[];

    // The refunded line is still in the sheetâ€¦
    expect(JSON.stringify(rows)).toContain('refunded');
    // â€¦but money already given back must not be billed to the supplier.
    expect(totals).toContain(100000);
    expect(totals).not.toContain(1099000);
  });
});

/**
 * #018 â€” the sheet also has to carry the affiliate, invoice, payment, discount
 * and eXU columns. They are ORDER-level, while a row is an order LINE, so the
 * thing to pin down is that they are written once per order.
 */
describe('Order-level columns on the reconciliation export (#018)', () => {
  it('should writes the affiliate, invoice, payment and discount columns', async () => {
    const service = makeService([
      row({
        paymentMethod: 'bank_transfer',
        couponCode: 'SALE10',
        referralCode: 'REF-ABC',
        couponDiscountVndAmount: 20000,
        referralDiscountVndAmount: 5000,
        cashbackAmountVnd: 7000,
        walletSpentVndAmount: 30000,
        partnerName: 'Cong ty ABC',
        partnerCommissionVnd: 15000,
        invoiceStatus: 'ISSUED',
        invoiceCompanyName: 'Cong ty XYZ',
        invoiceTaxCode: '0101234567',
      }),
    ]);

    const flat = JSON.stringify(
      (await readSheet(await service.exportToExcel())).rows,
    );

    for (const expected of [
      'bank_transfer',
      'SALE10',
      'REF-ABC',
      'Cong ty ABC',
      'ISSUED',
      'Cong ty XYZ',
      '0101234567',
    ]) {
      expect(flat).toContain(expected);
    }
  });

  it('should adds the coupon and referral discounts together', async () => {
    const service = makeService([
      row({ couponDiscountVndAmount: 20000, referralDiscountVndAmount: 5000 }),
    ]);

    const { rows } = await readSheet(await service.exportToExcel());

    expect(rows[1] as unknown[]).toContain(25000);
  });

  it('should computes profit after discount over the whole order, not one line', async () => {
    // One order, two supplier lines: revenue 300k, cost 200k, discount 25k.
    const service = makeService([
      row({
        orderId: 7,
        vndCostPrice: 100000,
        vndPrice: 150000,
        couponDiscountVndAmount: 25000,
      }),
      row({
        orderId: 7,
        provider: 'airalo',
        vndCostPrice: 100000,
        vndPrice: 150000,
        couponDiscountVndAmount: 25000,
      }),
    ]);

    const { rows } = await readSheet(await service.exportToExcel());

    // 300000 - 200000 - 25000
    expect(rows[1] as unknown[]).toContain(75000);
  });

  it('should only count the discount of what was kept after a refund (#009)', async () => {
    // Two 150k lines, 20k coupon → 10k each; the airalo line was refunded.
    const service = makeService([
      row({
        orderId: 7,
        orderItemId: 1,
        vndCostPrice: 100000,
        vndPrice: 150000,
        couponDiscountVndAmount: 20000,
        refundedAmountVnd: 140000,
      }),
      row({
        orderId: 7,
        orderItemId: 2,
        provider: 'airalo',
        itemStatus: 'refunded',
        vndCostPrice: 100000,
        vndPrice: 150000,
        couponDiscountVndAmount: 20000,
        refundedAmountVnd: 140000,
      }),
    ]);

    const { rows } = await readSheet(await service.exportToExcel());

    // 150000 - 100000 - 10000: the refunded line's 10k share no longer counts.
    expect(rows[1] as unknown[]).toContain(40000);
    expect(rows[1] as unknown[]).toContain(140000);
  });

  it('should count a line refunded eSIM by eSIM for what is left of it (#008)', async () => {
    const service = makeService([
      row({
        orderId: 7,
        quantity: 3,
        refundedEsims: 1,
        vndCostPrice: 90000,
        vndPrice: 300000,
      }),
    ]);

    const { rows } = await readSheet(await service.exportToExcel());
    const totals = rows[rows.length - 1] as unknown[];

    expect(totals).toContain(200000); // revenue of the 2 eSIMs kept
    expect(totals).toContain(60000); // their cost
  });

  it('should writes the order-level money once per order, so a SUM is not multiplied by the line count', async () => {
    const service = makeService([
      row({
        orderId: 7,
        couponDiscountVndAmount: 25000,
        cashbackAmountVnd: 7000,
      }),
      row({
        orderId: 7,
        provider: 'airalo',
        couponDiscountVndAmount: 25000,
        cashbackAmountVnd: 7000,
      }),
    ]);

    const { rows } = await readSheet(await service.exportToExcel());
    const totals = rows[rows.length - 1] as unknown[];

    // 25.000Ä‘ and 7.000Ä‘ once, not twice â€” this is the whole point of writing
    // order-level values on the first line only.
    expect(totals).toContain(25000);
    expect(totals).toContain(7000);
    expect(totals).not.toContain(50000);
    expect(totals).not.toContain(14000);
  });

  it('should labels the kind of order', async () => {
    const service = makeService([
      row({ orderId: 1, orderType: 'TOPUP' }),
      row({
        orderId: 2,
        partnerName: 'Cong ty ABC',
        partnerCommissionVnd: 15000,
      }),
      row({ orderId: 3 }),
    ]);

    const { rows } = await readSheet(await service.exportToExcel());
    const flat = JSON.stringify(rows);

    expect(flat).toContain('Topup');
    expect(flat).toContain('Affiliate');
    expect(flat).toContain('eSIM');
  });

  /** The cell under a given header, on the first data row. */
  function cellUnder(rows: unknown[][], header: string): unknown {
    const index = (rows[0] as unknown[]).indexOf(header);
    return (rows[1] as unknown[])[index];
  }

  it('should leaves the commission percent blank when there is no commission', async () => {
    const service = makeService([row({ partnerCommissionVnd: 0 })]);

    const { rows } = await readSheet(await service.exportToExcel());

    expect(cellUnder(rows, '% hoa hồng')).toBe('');
  });

  it('should states the commission as a share of what the order brought in', async () => {
    // 15.000 / 150.000 = 10%
    const service = makeService([
      row({
        vndPrice: 150000,
        partnerCommissionVnd: 15000,
        partnerName: 'ABC',
      }),
    ]);

    const { rows } = await readSheet(await service.exportToExcel());

    expect(cellUnder(rows, '% hoa hồng')).toBe('10%');
  });
});

describe('Export file name', () => {
  it('should be stamped with the export date and time', () => {
    // 2026-09-09T03:00:00Z = 10:00 on 09/09 in Vietnam.
    const stamp = exportFileTimestamp(new Date('2026-09-09T03:00:00.000Z'));

    expect(stamp).toBe('2026-09-09_10-00-00');
  });

  it('should use Vietnam time, not the server timezone', () => {
    // 18:30 UTC is already the next day in Vietnam.
    const stamp = exportFileTimestamp(new Date('2026-09-09T18:30:00.000Z'));

    expect(stamp).toBe('2026-09-10_01-30-00');
  });
});
