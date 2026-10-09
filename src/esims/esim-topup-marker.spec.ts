import { EsimsService } from './esims.service';
import { EsimsExportService } from './esims-export.service';
import { Workbook } from 'exceljs';

/**
 * #025 — an eSIM that has been topped up needs to say so in the list and in the
 * export.
 *
 * The flag is DERIVED from the paid TOPUP orders against the ICCID rather than
 * stored on the eSIM, so it is also right for eSIMs topped up before this
 * existed and cannot drift away from the orders.
 */
type TopupSummary = {
  count: number;
  lastAt: Date | null;
  vndPrice?: number;
  vndCostPrice?: number;
  packageNames?: string | null;
};

describe('Topup marker on an eSIM (#025)', () => {
  function makeService(topups: Record<string, TopupSummary> = {}) {
    const esimsRepository = {
      findManyWithPagination: jest.fn(),
      findOrderNumbersByOrderItemIds: jest.fn().mockResolvedValue(new Map()),
      countTopupsByIccids: jest.fn((iccids: string[]) => {
        const map = new Map<string, TopupSummary>();
        for (const iccid of iccids) {
          if (topups[iccid]) map.set(iccid, topups[iccid]);
        }
        return Promise.resolve(map);
      }),
    };
    const service = Object.create(EsimsService.prototype) as EsimsService;
    (service as unknown as Record<string, unknown>).esimsRepository =
      esimsRepository;
    return { service, esimsRepository };
  }

  it('should marks the eSIM that was topped up and leaves the others at 0', async () => {
    const lastAt = new Date('2026-09-20T00:00:00.000Z');
    const { service } = makeService({ AAA: { count: 2, lastAt } });

    const result = await service.attachTopupInfo([
      { iccid: 'AAA' },
      { iccid: 'BBB' },
    ] as never);

    expect(result[0]).toMatchObject({ topupCount: 2, lastTopupAt: lastAt });
    expect(result[1]).toMatchObject({ topupCount: 0, lastTopupAt: null });
  });

  it('should asks the database once for the whole page, not once per row', async () => {
    const { service, esimsRepository } = makeService();

    await service.attachTopupInfo([
      { iccid: 'AAA' },
      { iccid: 'BBB' },
      { iccid: 'CCC' },
    ] as never);

    expect(esimsRepository.countTopupsByIccids).toHaveBeenCalledTimes(1);
    expect(esimsRepository.countTopupsByIccids).toHaveBeenCalledWith([
      'AAA',
      'BBB',
      'CCC',
    ]);
  });

  it('should does not query at all for an empty page', async () => {
    const { service, esimsRepository } = makeService();

    await expect(service.attachTopupInfo([])).resolves.toEqual([]);
    expect(esimsRepository.countTopupsByIccids).not.toHaveBeenCalled();
  });
});

describe('Topup columns in the eSIM export (#025)', () => {
  function makeExport(
    esims: Record<string, unknown>[],
    topups: Record<string, TopupSummary> = {},
  ) {
    const esimsRepository = {
      findAllForExport: jest.fn().mockResolvedValue(esims),
      countTopupsByIccids: jest.fn((iccids: string[]) => {
        const map = new Map<string, TopupSummary>();
        for (const iccid of iccids) {
          if (topups[iccid]) map.set(iccid, topups[iccid]);
        }
        return Promise.resolve(map);
      }),
    };
    return new EsimsExportService(esimsRepository as never);
  }

  const ESIM = {
    id: 1,
    iccid: 'AAA',
    status: 'sold',
    createdAt: new Date('2026-09-01T00:00:00.000Z'),
  };

  async function readRows(buffer: Buffer) {
    const workbook = new Workbook();
    await workbook.xlsx.load(buffer as never);
    const sheet = workbook.worksheets[0];
    const rows: unknown[][] = [];
    sheet.eachRow((r) => rows.push(r.values as unknown[]));
    return rows;
  }

  /** The cell under a given header, on the first data row. */
  function cellUnder(rows: unknown[][], header: string): unknown {
    const index = (rows[0] as unknown[]).indexOf(header);
    return (rows[1] as unknown[])[index];
  }

  it('should writes "Topup" and the count for an eSIM that was topped up', async () => {
    const service = makeExport([ESIM], {
      AAA: { count: 3, lastAt: new Date('2026-09-20T00:00:00.000Z') },
    });

    const rows = await readRows(await service.exportToExcel());

    expect(cellUnder(rows, 'Đã Topup')).toBe('Topup');
    expect(cellUnder(rows, 'Số lần Topup')).toBe(3);
    expect(cellUnder(rows, 'Topup lần cuối')).toBeTruthy();
  });

  it('should leaves the columns blank for an eSIM never topped up', async () => {
    // Blank rather than "No" / 0, so the column reads as a list of the ones that
    // were topped up.
    const service = makeExport([ESIM]);

    const rows = await readRows(await service.exportToExcel());

    expect(cellUnder(rows, 'Đã Topup')).toBe('');
    expect(cellUnder(rows, 'Số lần Topup')).toBe('');
    expect(cellUnder(rows, 'Topup lần cuối')).toBe('');
  });

  /**
   * #027 — the file also has to carry Call/SMS, the minutes and SMS figures, the
   * topup package and both prices for the eSIM and for the topups.
   */
  describe('the #027 columns', () => {
    const CALL_SMS_ESIM = {
      ...ESIM,
      plan: {
        name: 'US 1GB',
        call: 10,
        sms: 20,
        vndCostPrice: 90000,
        vndPrice: 150000,
      },
    };

    it('should writes the Call/SMS flag and the two figures', async () => {
      const service = makeExport([CALL_SMS_ESIM]);

      const rows = await readRows(await service.exportToExcel());

      expect(cellUnder(rows, 'Call/SMS')).toBe('Có');
      expect(cellUnder(rows, 'Số phút gọi')).toBe(10);
      expect(cellUnder(rows, 'Số SMS')).toBe(20);
    });

    it('should says Không for a data-only plan and leaves the figures blank', async () => {
      const service = makeExport([
        { ...ESIM, plan: { name: 'US 1GB', call: 0, sms: null } },
      ]);

      const rows = await readRows(await service.exportToExcel());

      expect(cellUnder(rows, 'Call/SMS')).toBe('Không');
      expect(cellUnder(rows, 'Số phút gọi')).toBe('');
      expect(cellUnder(rows, 'Số SMS')).toBe('');
    });

    it("should writes the eSIM's own cost and selling price", async () => {
      const service = makeExport([CALL_SMS_ESIM]);

      const rows = await readRows(await service.exportToExcel());

      expect(cellUnder(rows, 'Giá gốc eSIM (VNĐ)')).toBe(90000);
      expect(cellUnder(rows, 'Giá bán eSIM (VNĐ)')).toBe(150000);
    });

    it('should writes the topup package name and TOTALS the prices over every topup', async () => {
      // Two topups at 179.000 / 120.000 each: the export reconciles on the total,
      // not on the last one.
      const service = makeExport([ESIM], {
        AAA: {
          count: 2,
          lastAt: new Date('2026-09-20T00:00:00.000Z'),
          vndPrice: 358000,
          vndCostPrice: 240000,
          packageNames: 'Vietnam-3days-3gb-topup, Vietnam-3days-3gb-topup',
        },
      });

      const rows = await readRows(await service.exportToExcel());

      expect(cellUnder(rows, 'Gói Topup')).toContain('Vietnam-3days-3gb-topup');
      expect(cellUnder(rows, 'Giá bán Topup (VNĐ)')).toBe(358000);
      expect(cellUnder(rows, 'Giá gốc Topup (VNĐ)')).toBe(240000);
    });

    it('should leaves the topup money blank when there was no topup', async () => {
      const service = makeExport([ESIM]);

      const rows = await readRows(await service.exportToExcel());

      expect(cellUnder(rows, 'Gói Topup')).toBe('');
      expect(cellUnder(rows, 'Giá bán Topup (VNĐ)')).toBe('');
      expect(cellUnder(rows, 'Giá gốc Topup (VNĐ)')).toBe('');
    });
  });
});
