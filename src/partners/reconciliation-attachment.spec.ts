import { Workbook } from 'exceljs';
import { PartnersService } from './partners.service';

/**
 * Gắn file đối soát vào email hằng tháng (#006).
 *
 * Phần email đã chạy từ #076; việc còn lại là file .xlsx đính kèm. Hai điều cần
 * giữ: file phải mang đúng số của đúng đối tác trong đúng kỳ, và nếu dựng file
 * hỏng thì email vẫn phải đi — mất file đính kèm còn hơn mất cả thông báo đối
 * soát của cả tháng.
 */
describe('email đối soát kèm file', () => {
  // Cron lấy kỳ từ ngày hôm nay, nên đồng hồ phải cố định — nếu không thì tên
  // file và dòng "Hôm nay ngày…" đổi theo ngày chạy test.
  const TODAY = new Date(2026, 8, 5); // 05/09/2026 -> kỳ 2026-08

  beforeAll(() => {
    jest.useFakeTimers({
      now: TODAY,
      doNotFake: [
        'setTimeout',
        'setInterval',
        'setImmediate',
        'nextTick',
        'queueMicrotask',
        'performance',
      ],
    });
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  const PARTNER = {
    id: 8,
    companyName: 'CÔNG TY CỔ PHẦN MOBICAST',
    businessAddress: '17 Ngô Quyền, Hà Nội',
    taxCode: '0107591436',
    contactName: 'Trần Hoàng Vũ',
    contractInfo: [
      { label: 'Căn cứ Hợp đồng đại lý số', value: '012025/HĐĐL' },
    ],
  };

  const TRANSACTIONS = [
    {
      orderNumber: 'ORD-A',
      products: 'Ukraine unlimited x2',
      revenueVnd: 900_000,
      source: 'Link - EOKIC5TO',
      customer: 'Khách mới',
      esims: 2,
      commissionPercent: 15,
      commissionVnd: 1_000_000,
      status: 'Đã duyệt',
      createdAt: new Date(2026, 7, 5),
    },
    {
      orderNumber: 'ORD-B',
      products: 'Viettel 5GB / Day - 7Days',
      revenueVnd: 600_000,
      source: 'Mã - ESIMAF',
      customer: 'Khách quay lại',
      esims: 1,
      commissionPercent: 15,
      commissionVnd: 500_000,
      status: 'Chờ xác nhận',
      createdAt: new Date(2026, 7, 12),
    },
  ];

  function build(
    over: {
      partner?: unknown;
      transactions?: unknown[];
      commissionVnd?: number;
    } = {},
  ) {
    const service = Object.create(PartnersService.prototype) as PartnersService;
    const sendPartnerReconciliationStatement = jest
      .fn()
      .mockResolvedValue(undefined);

    Object.assign(service, {
      logger: { log: jest.fn(), error: jest.fn() },
      programSettingRepository: {
        findOne: jest.fn().mockResolvedValue({
          reconciliationEmailEnabled: true,
          reconciliationEmailDayOfMonth: TODAY.getDate(),
        }),
      },
      partnerRepository: {
        findOne: jest
          .fn()
          .mockResolvedValue(
            'partner' in over ? (over.partner as never) : PARTNER,
          ),
      },
      mailService: { sendPartnerReconciliationStatement },
      adminListReconciliations: jest.fn().mockResolvedValue({
        period: '2026-08',
        rows: [
          {
            partnerId: 8,
            contactName: 'Trần Hoàng Vũ',
            contactEmail: 'vu@example.com',
            validOrders: 2,
            esimsSold: 3,
            viaCouponPercent: 50,
            revenueVnd: 1_500_000,
            commissionVnd: over.commissionVnd ?? 1_500_000,
          },
        ],
      }),
      partnerReconciliationTransactions: jest
        .fn()
        .mockResolvedValue(over.transactions ?? TRANSACTIONS),
    });

    return { service, sendPartnerReconciliationStatement };
  }

  const openAttachment = async (content: Buffer) => {
    const wb = new Workbook();
    await wb.xlsx.load(content as never);
    return wb;
  };

  it('should đính kèm file .xlsx 2 sheet', async () => {
    const { service, sendPartnerReconciliationStatement } = build();

    await service.sendScheduledReconciliationEmails();

    const arg = sendPartnerReconciliationStatement.mock.calls[0][0];
    expect(arg.attachment.filename).toBe('doi-soat-2026-08-doi-tac-8.xlsx');

    const wb = await openAttachment(arg.attachment.content);
    expect(wb.worksheets.map((w) => w.name)).toEqual([
      'Đối soát',
      'Chi tiết giao dịch',
    ]);
  });

  it('should điền tên và MST của chính đối tác đó', async () => {
    const { service, sendPartnerReconciliationStatement } = build();

    await service.sendScheduledReconciliationEmails();

    const wb = await openAttachment(
      sendPartnerReconciliationStatement.mock.calls[0][0].attachment.content,
    );
    const sheet = wb.getWorksheet('Đối soát')!;
    const text: string[] = [];
    sheet.eachRow((row) =>
      row.eachCell({ includeEmpty: false }, (c) => text.push(String(c.value))),
    );

    expect(text.join(' | ')).toContain('Bên B: CÔNG TY CỔ PHẦN MOBICAST');
    expect(text.join(' | ')).toContain('MST: 0107591436');
    expect(text.join(' | ')).toContain('012025/HĐĐL');
  });

  it('should để tổng ở sheet chi tiết khớp con số trên biên bản', async () => {
    // Hai sheet nói hai điều khác nhau về cùng một kỳ là lỗi nặng nhất ở đây.
    const { service, sendPartnerReconciliationStatement } = build();

    await service.sendScheduledReconciliationEmails();

    const wb = await openAttachment(
      sendPartnerReconciliationStatement.mock.calls[0][0].attachment.content,
    );
    const detail = wb.getWorksheet('Chi tiết giao dịch')!;
    const totalRow = detail.getRow(detail.rowCount);

    expect(String(totalRow.getCell(2).value)).toBe('TỔNG CỘNG');
    expect(totalRow.getCell(9).value).toBe(1_500_000);
  });

  it('should vẫn gửi email khi dựng file hỏng', async () => {
    // Hồ sơ đối tác bị xoá giữa chừng: mất file đính kèm, không mất email.
    const { service, sendPartnerReconciliationStatement } = build({
      partner: null,
    });

    await service.sendScheduledReconciliationEmails();

    expect(sendPartnerReconciliationStatement).toHaveBeenCalledTimes(1);
    expect(
      sendPartnerReconciliationStatement.mock.calls[0][0].attachment,
    ).toBeUndefined();
  });

  it('should chạy được với đối tác cá nhân, không có tên công ty hay MST', async () => {
    const { service, sendPartnerReconciliationStatement } = build({
      partner: {
        id: 8,
        companyName: null,
        businessAddress: null,
        taxCode: null,
        contactName: 'Nguyễn Văn A',
        contractInfo: null,
      },
    });

    await service.sendScheduledReconciliationEmails();

    const wb = await openAttachment(
      sendPartnerReconciliationStatement.mock.calls[0][0].attachment.content,
    );
    const sheet = wb.getWorksheet('Đối soát')!;
    const text: string[] = [];
    sheet.eachRow((row) =>
      row.eachCell({ includeEmpty: false }, (c) => text.push(String(c.value))),
    );

    // Tên liên hệ thay cho tên công ty, và không in ra chữ "null".
    expect(text.join(' | ')).toContain('Bên B: Nguyễn Văn A');
    expect(text.join(' | ')).not.toContain('null');
  });

  it('should chạy được khi kỳ không có giao dịch', async () => {
    const { service, sendPartnerReconciliationStatement } = build({
      transactions: [],
      commissionVnd: 0,
    });

    await service.sendScheduledReconciliationEmails();

    const wb = await openAttachment(
      sendPartnerReconciliationStatement.mock.calls[0][0].attachment.content,
    );
    expect(wb.getWorksheet('Chi tiết giao dịch')!.rowCount).toBe(2);
  });
});
