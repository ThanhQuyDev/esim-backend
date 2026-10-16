import { PartnersService } from './partners.service';
import * as ExcelJS from 'exceljs';

/**
 * A distribution partner's stock and their own orders (#046).
 *
 * The portal's existing screens answer the marketing question — orders somebody
 * else placed that were credited to the partner. A distribution partner has no
 * such orders and does hold stock, so both of these read from their own user
 * account instead.
 */

function buildService(rows: Record<string, unknown>[]) {
  const query = jest.fn().mockResolvedValue(rows);
  const service = Object.create(PartnersService.prototype) as PartnersService;
  Object.assign(service, {
    dataSource: { query },
    getPartnerOrThrowById: jest
      .fn()
      .mockResolvedValue({ id: 8, userId: 100, partnerType: 'distribution' }),
  });
  return { service, query };
}

describe('PartnersService.getMyEsims (#046)', () => {
  it('should read the eSIMs from the orders this partner placed', async () => {
    const { service, query } = buildService([]);

    await service.getMyEsims(8);

    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('o."userId" = $1');
    expect(params[0]).toBe(100);
  });

  it('should spread a line total over the eSIMs on that line', async () => {
    const { service } = buildService([
      {
        iccid: '8984000000000001',
        status: 'active',
        planName: 'Nhật Bản 5GB',
        destination: 'Nhật Bản',
        orderNumber: 'ORD-1',
        costVnd: '180000',
        dataUsed: '512',
        dataTotal: '5120',
        activatedAt: '2026-09-20T03:00:00.000Z',
        expiresAt: '2026-10-20T03:00:00.000Z',
        createdAt: '2026-09-18T03:00:00.000Z',
        planType: null,
        topUp: false,
      },
    ]);

    await expect(service.getMyEsims(8)).resolves.toEqual([
      {
        iccid: '8984000000000001',
        status: 'active',
        planName: 'Nhật Bản 5GB',
        destination: 'Nhật Bản',
        orderNumber: 'ORD-1',
        costVnd: 180_000,
        dataUsed: 512,
        dataTotal: 5120,
        activatedAt: '2026-09-20T03:00:00.000Z',
        expiresAt: '2026-10-20T03:00:00.000Z',
        createdAt: '2026-09-18T03:00:00.000Z',
        planType: null,
        topUp: false,
        // doitac-1410 #038
        durationDays: null,
        hasCallSms: false,
        tiktokAi: false,
        refundable: true,
        openReport: null,
      },
    ]);
  });

  it('should pass the search and status through as parameters', async () => {
    // Never interpolated: a partner typing a quote into the box must not be
    // able to reach the query.
    const { service, query } = buildService([]);

    await service.getMyEsims(8, {
      search: "8984'--",
      status: 'active',
      limit: 20,
    });

    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).not.toContain("8984'--");
    expect(params).toEqual([
      100,
      'active',
      "8984'--",
      20,
      null,
      null,
      null,
      null,
    ]);
  });

  it('should cap how many rows one call can ask for', async () => {
    const { service, query } = buildService([]);

    await service.getMyEsims(8, { limit: 10_000 });

    const [, params] = query.mock.calls[0] as [string, unknown[]];
    expect(params[3]).toBe(500);
  });

  it('should treat an empty filter as no filter', async () => {
    const { service, query } = buildService([]);

    await service.getMyEsims(8, { search: '   ', status: '' });

    const [, params] = query.mock.calls[0] as [string, unknown[]];
    expect(params[1]).toBeNull();
    expect(params[2]).toBeNull();
  });
});

describe('PartnersService.getMyPurchases (#046)', () => {
  it('should list the orders this partner placed themselves', async () => {
    const { service, query } = buildService([]);

    await service.getMyPurchases(8);

    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('o."userId" = $1');
    expect(sql).not.toContain('attributedPartnerId');
    expect(params[0]).toBe(100);
  });

  it('should carry the list price beside what was paid', async () => {
    // The two together are the margin, which is the whole point of the screen.
    const { service } = buildService([
      {
        orderNumber: 'ORD-1',
        // Whose purchase this is — the partner's own screen ignores it, the
        // admin's list across every partner needs it (#071).
        partnerId: '8',
        partnerName: 'Công ty ABC',
        status: 'completed',
        orderType: 'ESIM',
        paidVnd: '900000',
        listVnd: '1000000',
        refundedVnd: '0',
        // Giá niêm yết esim.vn và số tiền thật đã trừ ví — hai cột của màn
        // hình "Doanh thu và đơn hàng" (#046, chốt phương án a 02/10/2026).
        listPriceVnd: '1000000',
        walletCostVnd: '900000',
        esimCount: 5,
        createdAt: '2026-09-18T03:00:00.000Z',
        items: [{ planName: 'Nhật Bản 5GB', quantity: 5, vndPrice: 900000 }],
      },
    ]);

    await expect(service.getMyPurchases(8)).resolves.toEqual([
      {
        orderNumber: 'ORD-1',
        partnerId: 8,
        partnerName: 'Công ty ABC',
        status: 'completed',
        orderType: 'ESIM',
        paidVnd: 900_000,
        listVnd: 1_000_000,
        refundedVnd: 0,
        listPriceVnd: 1_000_000,
        walletCostVnd: 900_000,
        marginVnd: 100_000,
        esimCount: 5,
        createdAt: '2026-09-18T03:00:00.000Z',
        items: [{ planName: 'Nhật Bản 5GB', quantity: 5, vndPrice: 900_000 }],
      },
    ]);
  });

  it('should take the cost from the wallet ledger, not from the order total', async () => {
    // Hoàn tiền eSIM lỗi ghi vào sổ ví và không đụng tới tổng đơn. Lấy theo
    // tổng đơn thì sau một lần hoàn, màn hình báo lãi ít hơn thực tế.
    const { service } = buildService([
      {
        orderNumber: 'ORD-3',
        partnerId: '8',
        partnerName: 'Công ty ABC',
        status: 'completed',
        orderType: 'ESIM',
        paidVnd: '900000',
        listVnd: '1000000',
        refundedVnd: '0',
        listPriceVnd: '1000000',
        // 900.000đ trừ đi, 180.000đ hoàn lại cho 1 eSIM lỗi.
        walletCostVnd: '720000',
        esimCount: 4,
        createdAt: '2026-09-18T03:00:00.000Z',
        items: [],
      },
    ]);

    await expect(service.getMyPurchases(8)).resolves.toMatchObject([
      { walletCostVnd: 720_000, marginVnd: 280_000 },
    ]);
  });

  it('should show a negative margin rather than clamping it to zero', async () => {
    // Markup của hạng vượt giá niêm yết là một thoả thuận hợp lệ, nhưng đối
    // tác phải nhìn thấy số âm chứ không phải tưởng mình hoà vốn.
    const { service } = buildService([
      {
        orderNumber: 'ORD-4',
        status: 'completed',
        orderType: 'ESIM',
        paidVnd: '0',
        listVnd: '0',
        refundedVnd: '0',
        listPriceVnd: '300000',
        walletCostVnd: '440000',
        esimCount: 2,
        createdAt: '2026-09-18T03:00:00.000Z',
        items: [],
      },
    ]);

    await expect(service.getMyPurchases(8)).resolves.toMatchObject([
      { marginVnd: -140_000 },
    ]);
  });

  it('should survive an order with no items', async () => {
    const { service } = buildService([
      {
        orderNumber: 'ORD-2',
        status: 'cancelled',
        orderType: null,
        paidVnd: '0',
        listVnd: '0',
        refundedVnd: '0',
        esimCount: 0,
        createdAt: '2026-09-18T03:00:00.000Z',
        items: [],
      },
    ]);

    await expect(service.getMyPurchases(8)).resolves.toMatchObject([
      { orderNumber: 'ORD-2', items: [] },
    ]);
  });

  it('should cap how many orders one call can ask for', async () => {
    const { service, query } = buildService([]);

    await service.getMyPurchases(8, { limit: 5_000 });

    const [, params] = query.mock.calls[0] as [string, unknown[]];
    expect(params[3]).toBe(200);
  });
});

describe('PartnersService.getMyEsims filters (doitac-1410 #037)', () => {
  it('should filter by plan type, top-up and the created range in Vietnamese days', async () => {
    const { service, query } = buildService([]);

    await service.getMyEsims(8, {
      planType: 'daily, unlimited',
      topUp: true,
      from: '2026-10-14',
      to: '2026-10-14',
    });

    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('p.type = ANY($5)');
    expect(sql).toContain('COALESCE(p."topUp", false) = $6');
    expect(params[4]).toEqual(['daily', 'unlimited']);
    expect(params[5]).toBe(true);
    expect((params[6] as Date).toISOString()).toBe('2026-10-13T17:00:00.000Z');
    expect((params[7] as Date).toISOString()).toBe('2026-10-14T17:00:00.000Z');
  });
});

describe('PartnersService — eSIM reports become tickets (doitac-1410 #039)', () => {
  function build(row: Record<string, unknown> | null) {
    const created: unknown[] = [];
    const service = Object.create(PartnersService.prototype) as PartnersService;
    const ticketCreate = jest.fn().mockResolvedValue({ id: 42 });
    Object.assign(service, {
      logger: { error: jest.fn(), warn: jest.fn() },
      getPartnerOrThrowById: jest.fn().mockResolvedValue({
        id: 8,
        userId: 100,
        contactEmail: 'shop@example.com',
      }),
      dataSource: { query: jest.fn().mockResolvedValue(row ? [row] : []) },
      faultReportRepository: {
        findOne: jest.fn().mockResolvedValue(null),
        create: jest.fn((v) => v),
        save: jest.fn((v) => {
          created.push({ ...v });
          return Promise.resolve(v);
        }),
      },
      ticketsService: { create: ticketCreate },
    });
    return { service, ticketCreate, created };
  }
  const ROW = {
    orderId: 7,
    esimStatus: 'sold',
    provider: 'esimaccess',
    planName: 'Nhật 5GB',
    operatorName: null,
  };

  it('should open a ticket with the prefilled subject, order and ICCID', async () => {
    const { service, ticketCreate } = build(ROW);

    const report = await service.reportFaultyEsim(8, {
      orderNumber: 'PTN-1',
      iccid: '8984',
      reason: 'Không kích hoạt được',
      kind: 'refund',
      attachments: ['https://cdn/x.png'],
    });

    const ticket = ticketCreate.mock.calls[0][0];
    expect(ticket.subject).toBe('Hoàn tiền đơn hàng / eSIM lỗi');
    expect(ticket.orderId).toBe('PTN-1');
    expect(ticket.iccid).toBe('8984');
    expect(ticket.attachments).toEqual(['https://cdn/x.png']);
    expect(report.ticketId).toBe(42);
    expect(report.kind).toBe('refund');
  });

  it('should use the fault subject for "Báo lỗi"', async () => {
    const { service, ticketCreate } = build(ROW);
    await service.reportFaultyEsim(8, {
      orderNumber: 'PTN-1',
      iccid: '8984',
      reason: 'Lỗi QR quét',
    });
    expect(ticketCreate.mock.calls[0][0].subject).toBe(
      'eSIM lỗi hoặc không kích hoạt được',
    );
  });

  it('should refuse a refund request for a plan that does not refund', async () => {
    const { service, ticketCreate } = build({
      ...ROW,
      provider: 'viettel',
      planName: 'Viettel 5GB',
    });
    await expect(
      service.reportFaultyEsim(8, {
        orderNumber: 'PTN-1',
        iccid: '8984',
        reason: 'Hoàn giúp',
        kind: 'refund',
      }),
    ).rejects.toThrow('không hỗ trợ hoàn tiền');
    expect(ticketCreate).not.toHaveBeenCalled();
  });
});

describe('PartnersService.reviewEsimFaultReport — approval (doitac-1410 #039)', () => {
  it('should refund the wallet and mark the eSIM, then the whole order, refunded', async () => {
    const query = jest.fn().mockResolvedValue([]);
    const refund = jest.fn().mockResolvedValue(undefined);
    const service = Object.create(PartnersService.prototype) as PartnersService;
    Object.assign(service, {
      dataSource: { query },
      faultReportRepository: {
        findOne: jest.fn().mockResolvedValue({
          id: 3,
          partnerId: 8,
          orderId: 7,
          orderNumber: 'PTN-1',
          iccid: '8984',
          status: 'pending',
        }),
        save: jest.fn((v) => Promise.resolve(v)),
      },
      refundWalletForPurchase: refund,
    });

    const report = await service.reviewEsimFaultReport(3, 1, {
      approve: true,
      refundVnd: 36000,
    });

    expect(report.status).toBe('approved');
    expect(refund.mock.calls[0][1].amountVnd).toBe(36000);
    const sql = query.mock.calls.map((c) => String(c[0]));
    expect(sql[0]).toContain(`UPDATE esim SET status = 'refunded'`);
    expect(sql[1]).toContain(`UPDATE "order" o SET status = 'refunded'`);
    expect(query.mock.calls[1][1]).toEqual([7]);
  });
});

describe('PartnersService.getMyEsimDetail (doitac-1410 #039)', () => {
  const ESIM_ROW = {
    iccid: '8900000633806287368',
    status: 'sold',
    apn: 'internet',
    smdpAddress: 'smdp.example',
    activationCode: 'ABC',
    lpa: 'LPA:1$smdp.example$ABC',
    directAppleInstallationUrl: null,
    dataUsed: null,
    dataTotal: '3072',
    activatedAt: null,
    expiresAt: null,
    createdAt: '2026-10-14T03:13:01.000Z',
    updatedAt: '2026-10-14T03:13:01.000Z',
    orderNumber: 'PTN-1',
    deliveryEmail: null,
    costVnd: '36000',
    planId: 5,
    planName: 'Thailand 3GB / 30day',
    planCode: 'thailand-3gb-30day',
    provider: 'esimaccess',
    operatorName: 'AIS',
    planType: 'fixed',
    dataMb: 3072,
    durationDays: 30,
    call: null,
    sms: null,
    speed: '4G',
    ipExport: null,
    isNonHkIp: true,
    dailyResetPolicy: null,
    dailyResetUtcOffset: null,
    topUp: true,
    destination: 'Thailand',
    openReport: null,
  };

  function build(owned: boolean, topups: Record<string, unknown>[] = []) {
    const query = jest.fn((sql: string) => {
      if (sql.includes('SELECT e.id AS "esimId"')) {
        return Promise.resolve(
          owned ? [{ esimId: 3, orderId: 77, orderNumber: 'PTN-1' }] : [],
        );
      }
      if (sql.includes(`"orderType" = 'TOPUP'`)) return Promise.resolve(topups);
      return Promise.resolve([ESIM_ROW]);
    });
    const service = Object.create(PartnersService.prototype) as PartnersService;
    Object.assign(service, {
      dataSource: { query },
      getPartnerOrThrowById: jest
        .fn()
        .mockResolvedValue({ id: 11, userId: 20 }),
    });
    return { service, query };
  }

  it('should refuse an eSIM another account bought', async () => {
    const { service, query } = build(false);
    await expect(
      service.getMyEsimDetail(11, '8900000633806287368'),
    ).rejects.toThrow('Không tìm thấy eSIM');
    // Ownership is checked against this partner's own user account.
    expect((query.mock.calls[0] as unknown[])[1]).toEqual([
      '8900000633806287368',
      20,
    ]);
  });

  it('should give the install links, plan code and partner prices', async () => {
    const { service } = build(true, [
      {
        orderNumber: 'TOPUP-9',
        status: 'completed',
        vndPrice: '120000',
        topupPackageName: 'Thailand 3GB',
        topupDataText: '3GB',
        topupDurationDays: 7,
        topupIsUnlimited: false,
        createdAt: '2026-10-15T03:00:00.000Z',
      },
    ]);
    const detail = await service.getMyEsimDetail(11, '8900000633806287368');
    expect(detail).toMatchObject({
      planCode: 'thailand-3gb-30day',
      ipExport: 'IP nội địa (không qua Hồng Kông)',
      agentPriceVnd: 36000,
      suggestedRetailVnd: 60000,
      appleInstallUrl:
        'https://esimsetup.apple.com/esim_qrcode_provisioning?carddata=LPA:1$smdp.example$ABC',
      androidInstallUrl:
        'https://esimsetup.android.com/esim_qrcode_provisioning?carddata=LPA:1$smdp.example$ABC',
      refundable: true,
      plan: { name: 'Thailand 3GB / 30day', dataMb: 3072, durationDays: 30 },
      topups: [
        {
          orderNumber: 'TOPUP-9',
          priceVnd: 120000,
          packageName: 'Thailand 3GB',
          durationDays: 7,
        },
      ],
    });
    // No supplier name leaves the server.
    expect(detail).not.toHaveProperty('provider');
  });
});

describe('PartnersService.exportMyEsimsToExcel (doitac-1410 #040)', () => {
  it('should export every filtered eSIM with its install codes and partner prices', async () => {
    const service = Object.create(PartnersService.prototype) as PartnersService;
    const getMyEsims = jest.fn().mockResolvedValue([
      {
        iccid: '8900000633806287368',
        status: 'sold',
        planName: 'Thailand 3GB / 30day',
        destination: 'Thailand',
        orderNumber: 'PTN-1',
        costVnd: 36000,
        dataUsed: null,
        dataTotal: null,
        activatedAt: null,
        expiresAt: null,
        createdAt: '2026-10-14T03:13:06.000Z',
        planType: 'fixed',
        topUp: true,
        durationDays: 30,
        hasCallSms: false,
        tiktokAi: true,
        refundable: true,
        openReport: null,
      },
    ]);
    const query = jest.fn().mockResolvedValue([
      {
        iccid: '8900000633806287368',
        apn: 'globaldata',
        smdpAddress: 'lpa.airalo.com',
        activationCode: 'ABC',
        lpa: 'LPA:1$lpa.airalo.com$ABC',
        directAppleInstallationUrl: null,
        updatedAt: '2026-10-14T03:13:06.000Z',
        planCode: 'thailand-3gb',
        dataMb: 3072,
        call: null,
        sms: null,
        operatorName: 'AIS',
        speed: '5G',
      },
    ]);
    Object.assign(service, { getMyEsims, dataSource: { query } });

    const buffer = await service.exportMyEsimsToExcel(11, { status: 'sold' });

    // The list's filters, without the screen's 500-row cap.
    expect(getMyEsims).toHaveBeenCalledWith(
      11,
      expect.objectContaining({ status: 'sold', unbounded: true }),
    );
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as never);
    const sheet = workbook.getWorksheet('Danh sách eSIM')!;
    const header = (sheet.getRow(1).values as unknown[]).slice(1);
    const row = (sheet.getRow(2).values as unknown[]).slice(1);
    const cell = (name: string) => row[header.indexOf(name)];
    expect(cell('ICCID')).toBe('8900000633806287368');
    expect(cell('Trạng thái')).toBe('Chưa kích hoạt');
    expect(cell('Mã gói cước')).toBe('thailand-3gb');
    expect(cell('Dung lượng')).toBe('3 GB');
    expect(cell('Giá đại lý (VND)')).toBe(36000);
    expect(cell('Giá bán lẻ đề xuất (VND)')).toBe(60000);
    expect(cell('LPA')).toBe('LPA:1$lpa.airalo.com$ABC');
    expect(cell('Link cài đặt Android')).toBe(
      'https://esimsetup.android.com/esim_qrcode_provisioning?carddata=LPA:1$lpa.airalo.com$ABC',
    );
    // VN time, not the UTC wall time stored in the database.
    expect(String(cell('Thời gian tạo'))).toContain('10:13:06');
    expect(sheet.rowCount).toBe(2);
  });
});
