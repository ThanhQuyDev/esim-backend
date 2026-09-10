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
      row({ vndCostPrice: 100000, vndPrice: 150000 }),
      row({ vndCostPrice: 200000, vndPrice: 260000 }),
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
        itemStatus: 'refunded',
        vndCostPrice: 999000,
        vndPrice: 999000,
      }),
    ]);

    const { rows } = await readSheet(await service.exportToExcel());
    const totals = rows[rows.length - 1] as unknown[];

    // The refunded line is still in the sheet…
    expect(JSON.stringify(rows)).toContain('refunded');
    // …but money already given back must not be billed to the supplier.
    expect(totals).toContain(100000);
    expect(totals).not.toContain(1099000);
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
