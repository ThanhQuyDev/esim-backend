import { Workbook } from 'exceljs';
import { MailService } from '../mail/mail.service';
import { OrdersService } from './orders.service';
import {
  BulkEsimRow,
  buildBulkEsimList,
  bulkEmailInterval,
} from './bulk-esim-list';

/**
 * Ordering eSIMs in bulk from a file (vande #057): mailed to each traveller
 * spaced out, or handed over as a list with nothing mailed.
 */

const ESIM_MAIL = {
  to: 'khach@example.com',
  esimId: 7,
  qrAccessToken: 'tok',
  iccid: '8999',
  activationCode: null,
  lpa: 'LPA:1$x$y',
  smdpAddress: null,
  apn: null,
  phoneNumber: null,
  planName: 'Thái Lan 5GB',
  orderNumber: 'MAN-1',
};

function mailService(order: Record<string, unknown> | null) {
  const sendMail = jest.fn().mockResolvedValue(undefined);
  const queries: { sql: string; params: unknown[] }[] = [];
  const query = jest.fn((sql: string, params: unknown[] = []) => {
    queries.push({ sql, params });
    if (sql.includes('FROM "order" o'))
      return Promise.resolve(order ? [order] : []);
    return Promise.resolve([]);
  });
  const service = new MailService(
    { sendMail } as never,
    { get: jest.fn(() => 'https://api.test') } as never,
    {
      findByName: jest
        .fn()
        .mockResolvedValue({ subject: 'eSIM', htmlBody: '<p>{{iccid}}</p>' }),
    } as never,
    {
      query,
      transaction: (fn: (m: unknown) => unknown) => fn({ query }),
    } as never,
  );
  return { service, sendMail, queries };
}

describe('eSIM emails of a bulk order (vande #057)', () => {
  it('should mail nobody for a "file" order', async () => {
    const { service, sendMail, queries } = mailService({
      bulkMode: 'file',
      bulkBatch: 'B1',
    });

    await service.sendEsimPurchase(ESIM_MAIL);

    expect(sendMail).not.toHaveBeenCalled();
    expect(queries.some((q) => q.sql.includes('esim_email_queue'))).toBe(false);
  });

  it('should queue an "email" order instead of sending it at once', async () => {
    const { service, sendMail, queries } = mailService({
      bulkMode: 'email',
      bulkBatch: 'B1',
      bulkEmailIntervalSec: 45,
    });

    await service.sendEsimPurchase(ESIM_MAIL);

    expect(sendMail).not.toHaveBeenCalled();
    const insert = queries.find((q) =>
      q.sql.includes('INSERT INTO esim_email_queue'),
    );
    expect(insert?.params).toEqual(['B1', 'MAN-1', 7, ESIM_MAIL, 45]);
    // The slot is 45s after the last one of the same upload.
    expect(insert?.sql).toContain('max("scheduledAt")');
    expect(insert?.sql).toContain('make_interval(secs => $5)');
  });

  it('should send it when the queue hands it over', async () => {
    const { service, sendMail } = mailService({
      bulkMode: 'email',
      bulkBatch: 'B1',
      bulkEmailIntervalSec: 45,
    });

    await service.sendEsimPurchase(ESIM_MAIL, { queued: true });

    expect(sendMail).toHaveBeenCalledTimes(1);
  });

  it('should leave every other order as it was', async () => {
    const { service, sendMail } = mailService({ bulkMode: null });
    await service.sendEsimPurchase(ESIM_MAIL);
    expect(sendMail).toHaveBeenCalledTimes(1);
  });

  it('should send what is due and mark it sent', async () => {
    const { service, sendMail, queries } = mailService({
      bulkMode: 'email',
      bulkBatch: 'B1',
    });
    const query = (service as unknown as { dataSource: { query: jest.Mock } })
      .dataSource.query;
    query.mockImplementation((sql: string, params: unknown[] = []) => {
      queries.push({ sql, params });
      // What the pg driver really returns for UPDATE … RETURNING.
      if (sql.includes('RETURNING id, payload')) {
        return Promise.resolve([[{ id: 3, payload: ESIM_MAIL }], 1]);
      }
      if (sql.includes('FROM "order" o')) {
        return Promise.resolve([{ bulkMode: 'email', bulkBatch: 'B1' }]);
      }
      return Promise.resolve([]);
    });

    expect(await service.sendDueEsimEmails()).toBe(1);
    expect(sendMail).toHaveBeenCalledTimes(1);
    // One per upload per poll, spaced from the last one actually sent, and
    // re-checked on the row so a second instance cannot claim it too.
    expect(queries[0].sql).toContain('PARTITION BY q.batch');
    expect(queries[0].sql).toContain(
      'p."sentAt" > now() - make_interval(secs => q."intervalSec")',
    );
    expect(queries[0].sql).toContain(
      'AND "sentAt" IS NULL AND "sendAt" <= now()',
    );
    expect(
      queries.find((q) => q.sql.includes('"sentAt" = now()'))?.params,
    ).toEqual([3]);
  });
});

describe('the seconds between emails (vande #057)', () => {
  it('should be 30 when left blank and stay within 0–600', () => {
    expect(bulkEmailInterval(undefined)).toBe(30);
    expect(bulkEmailInterval(null)).toBe(30);
    expect(bulkEmailInterval(5)).toBe(5);
    expect(bulkEmailInterval(-3)).toBe(0);
    expect(bulkEmailInterval(9999)).toBe(600);
  });
});

describe('OrdersService.submitBulkOrders (vande #057)', () => {
  function ordersService() {
    const service = Object.create(OrdersService.prototype) as OrdersService;
    let n = 0;
    const submitManualOrder = jest.fn(() =>
      Promise.resolve({ id: ++n, orderNumber: `MAN-${n}` }),
    );
    const resendEsimEmail = jest.fn().mockResolvedValue({ sent: 1 });
    Object.assign(service, {
      logger: { log: jest.fn(), error: jest.fn() },
      plansService: {
        findBySlug: jest.fn((slug: string) =>
          Promise.resolve(
            slug === 'gone'
              ? null
              : { slug, providerPlanId: `PK-${slug}`, isActive: true },
          ),
        ),
      },
      usersService: {
        findById: jest.fn().mockResolvedValue({ email: 'admin@esim.vn' }),
      },
      submitManualOrder,
      resendEsimEmail,
    });
    return { service, submitManualOrder, resendEsimEmail };
  }

  it('should place one order per customer and queue its emails', async () => {
    const { service, submitManualOrder, resendEsimEmail } = ordersService();

    const result = await service.submitBulkOrders(1, {
      mode: 'email',
      emailIntervalSec: 20,
      rows: [
        { slug: 'th-5gb', quantity: 1, email: 'An@Example.com' },
        { slug: 'jp-3gb', quantity: 2, email: 'an@example.com' },
        { slug: 'th-5gb', quantity: 1, email: 'binh@example.com' },
      ],
    });

    expect(submitManualOrder).toHaveBeenCalledTimes(2);
    const [, first, tag] = submitManualOrder.mock.calls[0] as unknown as [
      number,
      { email: string; items: unknown[] },
      { mode: string; batch: string; intervalSec: number },
    ];
    expect(first.email).toBe('an@example.com');
    expect(first.items).toHaveLength(2);
    expect(tag).toMatchObject({ mode: 'email', intervalSec: 20 });
    // Both orders share one upload, so their emails queue together.
    const secondTag = (submitManualOrder.mock.calls[1] as unknown[])[2];
    expect(secondTag).toBe(tag);
    expect(resendEsimEmail).toHaveBeenCalledTimes(2);
    expect(result.orders.map((o) => o.esims)).toEqual([3, 1]);
  });

  it('should place ONE order under the admin and mail nothing for a file', async () => {
    const { service, submitManualOrder, resendEsimEmail } = ordersService();

    await service.submitBulkOrders(1, {
      mode: 'file',
      rows: [
        { slug: 'th-5gb', quantity: 10, email: 'a@example.com' },
        { slug: 'jp-3gb', quantity: 5 },
      ],
    });

    expect(submitManualOrder).toHaveBeenCalledTimes(1);
    expect((submitManualOrder.mock.calls[0] as unknown[])[1]).toMatchObject({
      email: 'admin@esim.vn',
    });
    expect(resendEsimEmail).not.toHaveBeenCalled();
  });

  it('should need an email on every row to mail them', async () => {
    const { service, submitManualOrder } = ordersService();
    await expect(
      service.submitBulkOrders(1, {
        mode: 'email',
        rows: [{ slug: 'th-5gb', quantity: 1 }],
      }),
    ).rejects.toThrow(/thiếu email/);
    expect(submitManualOrder).not.toHaveBeenCalled();
  });

  it('should stop the whole upload on an unknown plan', async () => {
    const { service, submitManualOrder } = ordersService();
    await expect(
      service.submitBulkOrders(1, {
        mode: 'file',
        rows: [
          { slug: 'th-5gb', quantity: 1 },
          { slug: 'gone', quantity: 1 },
        ],
      }),
    ).rejects.toThrow(/Dòng 2/);
    expect(submitManualOrder).not.toHaveBeenCalled();
  });

  it('should take 50 rows at most', async () => {
    const { service } = ordersService();
    await expect(
      service.submitBulkOrders(1, {
        mode: 'file',
        rows: Array.from({ length: 51 }, () => ({ slug: 'th', quantity: 1 })),
      }),
    ).rejects.toThrow(/tối đa 50/);
  });
});

describe('the eSIM list of a "file" order (vande #057)', () => {
  const row: BulkEsimRow = {
    orderNumber: 'MAN-1',
    iccid: '8999',
    planName: 'Thái Lan 5GB',
    destination: 'Thái Lan',
    planType: 'fixed',
    durationDays: 8,
    dataMb: 5120,
    fupSpeed: null,
    phoneNumber: null,
    call: 0,
    sms: 0,
    topUp: true,
    packageCode: 'PK1',
    slug: 'th-5gb',
    provider: 'airalo',
    costVnd: 90000,
    priceVnd: 150000,
    priceUsd: 5.77,
    createdBy: 'admin@esim.vn',
    orderedAt: new Date('2026-10-25T03:00:00Z'),
    activationDeadline: '2027-04-23',
    lpa: 'LPA:1$x$y',
    qrUrl: 'https://api.test/api/v1/esims/7/qrcode?token=t',
  };

  async function headers(forAdmin: boolean) {
    const wb = new Workbook();
    await wb.xlsx.load((await buildBulkEsimList([row], { forAdmin })) as never);
    const sheet = wb.worksheets[0];
    return {
      sheet,
      titles: (sheet.getRow(1).values as unknown[]).slice(1) as string[],
    };
  }

  it('should carry every column asked for, supplier and cost for the admin', async () => {
    const { titles } = await headers(true);
    expect(titles).toEqual([
      'STT',
      'Mã đơn hàng mua',
      'ICCID',
      'Tên gói cước',
      'Điểm đến',
      'Loại gói',
      'Thời gian',
      'Data',
      'Số điện thoại',
      'Gọi điện',
      'SMS',
      'Hỗ trợ Topup',
      'Mã gói cước',
      'Slug',
      'Nhà cung cấp',
      'Giá vốn (VND)',
      'Giá bán (VND)',
      'Giá bán ($)',
      'Người tạo',
      'Ngày giờ đặt hàng',
      'Ngày hết hạn kích hoạt',
      'Mã LPA',
      'Link xem/tải mã QR',
    ]);
  });

  it('should leave the supplier and the cost out of the partner copy', async () => {
    const { titles } = await headers(false);
    expect(titles).not.toContain('Nhà cung cấp');
    expect(titles).not.toContain('Giá vốn (VND)');
  });

  it('should make the QR link clickable', async () => {
    const { sheet, titles } = await headers(false);
    const cell = sheet
      .getRow(2)
      .getCell(titles.indexOf('Link xem/tải mã QR') + 1);
    expect(cell.value).toMatchObject({ hyperlink: row.qrUrl });
    expect(
      sheet.getRow(2).getCell(titles.indexOf('Ngày hết hạn kích hoạt') + 1)
        .value,
    ).toBe('23/04/2027');
  });
});
