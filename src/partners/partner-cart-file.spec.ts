import { Workbook } from 'exceljs';
import { PartnersService } from './partners.service';
import { OrdersService } from '../orders/orders.service';

/** "Nhập từ file" for the partner cart and admin "Đặt đơn hộ" (doitac-1410 #084). */
async function xlsx(rows: unknown[][]): Promise<Buffer> {
  const workbook = new Workbook();
  const sheet = workbook.addWorksheet('S');
  rows.forEach((r) => sheet.addRow(r));
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

describe('PartnersService.previewCartFile (doitac-1410 #084)', () => {
  function build(balanceVnd: number) {
    const service = Object.create(PartnersService.prototype) as PartnersService;
    const query = jest.fn().mockResolvedValue([
      { id: 1, slug: 'jp', name: 'Nhật 5GB', destinationName: 'Nhật Bản' },
      { id: 2, slug: 'th', name: 'Thái 3GB', destinationName: 'Thái Lan' },
      { id: 3, slug: 'off', name: 'Gói tắt', destinationName: null },
    ]);
    const price: Record<number, number> = { 1: 100000, 2: 50000, 3: 10000 };
    const quoteCart = jest.fn(
      (_: number, items: { planId: number; quantity: number }[]) => {
        const lines = items.map((i) => ({
          planId: i.planId,
          name: '',
          quantity: i.quantity,
          unitPriceVnd: price[i.planId],
          totalVnd: price[i.planId] * i.quantity,
          listTotalVnd: 0,
          rejection: i.planId === 3 ? 'Gói đang tạm ngưng bán.' : null,
        }));
        return Promise.resolve({
          lines,
          planCount: lines.length,
          esimCount: lines.reduce((s, l) => s + l.quantity, 0),
          totalVnd: lines.reduce((s, l) => s + l.totalVnd, 0),
          listTotalVnd: 0,
          balanceVnd,
          rejection: null,
        });
      },
    );
    Object.assign(service, {
      dataSource: { query },
      quoteCart,
      getOrCreateWallet: jest.fn().mockResolvedValue({ balanceVnd }),
      // A deposit, not credit: "Vui lòng nạp thêm" (vande #056).
      partnerRepository: { findOne: jest.fn().mockResolvedValue(null) },
    });
    return { service, quoteCart, query };
  }

  it('should price each row and group the rows into one order per QR email', async () => {
    const { service, quoteCart } = build(1_000_000);
    const result = await service.previewCartFile(
      8,
      await xlsx([
        ['Mã gói cước', 'Số lượng', 'Email nhận QR'],
        ['jp', 2, 'a@x.vn'],
        ['th', 1, ''],
        ['th', 3, 'A@x.vn'],
      ]),
      'don.xlsx',
    );

    expect(quoteCart.mock.calls.map((c) => c[1])).toEqual([
      [
        { planId: 1, quantity: 2 },
        { planId: 2, quantity: 3 },
      ],
      [{ planId: 2, quantity: 1 }],
    ]);
    expect(result.orders).toEqual([
      { email: 'a@x.vn', planCount: 2, esimCount: 5, totalVnd: 350000 },
      { email: null, planCount: 1, esimCount: 1, totalVnd: 50000 },
    ]);
    expect(result.lines[0]).toMatchObject({
      row: 2,
      planId: 1,
      name: 'Nhật 5GB',
      destinationName: 'Nhật Bản',
      unitPriceVnd: 100000,
      totalVnd: 200000,
      error: null,
    });
    expect(result).toMatchObject({
      totalVnd: 400000,
      balanceVnd: 1_000_000,
      errorCount: 0,
      rejection: null,
    });
  });

  it('should report unknown codes and plans not for sale, and block the order', async () => {
    const { service } = build(1_000_000);
    const result = await service.previewCartFile(
      8,
      await xlsx([
        ['Mã gói cước', 'Số lượng'],
        ['jp', 1],
        ['khong-co', 1],
        ['off', 1],
      ]),
      'don.xlsx',
    );
    expect(result.lines.map((l) => l.error)).toEqual([
      null,
      'Không thấy gói có mã "khong-co" trong bảng giá.',
      'Gói đang tạm ngưng bán.',
    ]);
    expect(result.errorCount).toBe(2);
    expect(result.rejection).toBe('2 dòng có lỗi, hãy sửa file rồi nhập lại.');
  });

  it('should say how much is missing when the wallet does not cover every order', async () => {
    const { service } = build(150000);
    const result = await service.previewCartFile(
      8,
      await xlsx([
        ['Mã gói cước', 'Số lượng', 'Email nhận QR'],
        ['jp', 1, 'a@x.vn'],
        ['jp', 1, 'b@x.vn'],
      ]),
      'don.xlsx',
    );
    expect(result.totalVnd).toBe(200000);
    expect(result.rejection).toBe(
      'Số dư ví không đủ: cần 200.000đ, còn thiếu 50.000đ. Vui lòng nạp thêm.',
    );
  });
});

describe('OrdersService.previewManualOrderFile (doitac-1410 #084)', () => {
  it('should resolve each row to its plan and flag unknown or disabled ones', async () => {
    const plans: Record<string, unknown> = {
      jp: {
        id: 1,
        slug: 'jp',
        providerPlanId: 'JP5',
        name: 'Nhật 5GB',
        vndPrice: 120000,
        isActive: true,
      },
      off: {
        id: 3,
        slug: 'off',
        providerPlanId: 'X',
        name: 'Tắt',
        vndPrice: 1,
        isActive: false,
      },
    };
    const service = Object.create(OrdersService.prototype) as OrdersService;
    Object.assign(service, {
      plansService: {
        findBySlug: jest.fn((slug: string) =>
          Promise.resolve(plans[slug] ?? null),
        ),
      },
    });

    const result = await service.previewManualOrderFile(
      await xlsx([
        ['Mã gói cước', 'Số lượng', 'Email nhận QR'],
        ['jp', 2, 'ignored@x.vn'],
        ['nope', 1],
        ['off', 1],
      ]),
      'don.xlsx',
    );

    expect(result.lines).toEqual([
      {
        row: 2,
        slug: 'jp',
        quantity: 2,
        plan: {
          id: 1,
          slug: 'jp',
          packageCode: 'JP5',
          label: 'Nhật 5GB · 120.000đ',
        },
        error: null,
      },
      {
        row: 3,
        slug: 'nope',
        quantity: 1,
        plan: null,
        error: 'Không thấy gói có mã "nope".',
      },
      {
        row: 4,
        slug: 'off',
        quantity: 1,
        plan: null,
        error: 'Gói đang ngừng bán.',
      },
    ]);
    expect(result.errorCount).toBe(2);
  });
});
