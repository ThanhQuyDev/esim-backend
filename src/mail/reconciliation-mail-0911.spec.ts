import { MailService } from './mail.service';
import { PartnersService } from '../partners/partners.service';

/**
 * doitac-0911 #007 — the commission statement email: its subject, and the
 * two shares under "Tỷ lệ ghi nhận qua mã".
 */
describe('Commission statement email (doitac-0911 #007)', () => {
  it('should fill the new subject and both new shares', async () => {
    const sendMail = jest.fn().mockResolvedValue(undefined);
    const service = Object.create(MailService.prototype) as MailService;
    Object.assign(service, {
      logger: { warn: jest.fn(), error: jest.fn() },
      mailerService: { sendMail },
      configService: {
        get: () => 'https://doitac.esim.vn',
        getOrThrow: () => 'https://esim.vn',
      },
      emailTemplatesService: {
        findByName: jest.fn().mockResolvedValue({
          // As the 1805000000000 migration leaves it.
          subject: 'Bảng đối soát hoa hồng {{periodLabel}} - ESIM.VN',
          htmlBody:
            '<td>Tỷ lệ ghi nhận qua mã</td><td>{{viaCouponPercent}}%</td>' +
            '<td>Tỷ lệ khách hàng mới</td><td>{{newCustomerPercent}}%</td>' +
            '<td>Tỷ lệ đơn hoàn tiền</td><td>{{refundPercent}}%</td>',
        }),
      },
    });

    await service.sendPartnerReconciliationStatement({
      to: 'doitac@example.com',
      contactName: 'Hoàng Hà Mobile',
      periodLabel: 'Tháng 10/2026',
      validOrders: 19,
      esimsSold: 25,
      viaCouponPercent: 10.5,
      newCustomerPercent: 42.1,
      refundPercent: 5,
      revenueVnd: 1_000_000,
      commissionVnd: 200_000,
    });

    const mail = sendMail.mock.calls[0][0];
    // From service@esim.com.vn, not no-reply@ (doitac-0911 #011).
    expect(mail.transportName).toBe('service');
    expect(mail.subject).toBe('Bảng đối soát hoa hồng Tháng 10/2026 - ESIM.VN');
    expect(mail.html).toContain('Tỷ lệ khách hàng mới</td><td>42.1%');
    expect(mail.html).toContain('Tỷ lệ đơn hoàn tiền</td><td>5%');
  });

  it('should send the credit statement from service@ too (doitac-0911 #011)', async () => {
    const sendMail = jest.fn().mockResolvedValue(undefined);
    const service = Object.create(MailService.prototype) as MailService;
    Object.assign(service, {
      logger: { warn: jest.fn(), error: jest.fn() },
      mailerService: { sendMail },
      configService: {
        get: () => 'https://doitac.esim.vn',
        getOrThrow: () => 'https://esim.vn',
      },
      emailTemplatesService: {
        findByName: jest.fn().mockResolvedValue({
          subject: 'Đối soát {{periodLabel}}',
          htmlBody: '<p></p>',
        }),
      },
    });

    await service.sendPartnerCreditStatement({
      to: 'doitac@example.com',
      contactName: 'Hoàng Hà Mobile',
      periodLabel: 'Tháng 10/2026',
      creditLimitVnd: 1,
      orderCount: 1,
      esimCount: 1,
      purchasedVnd: 1,
      refundedVnd: 0,
      amountDueVnd: 1,
    });

    expect(sendMail.mock.calls[0][0].transportName).toBe('service');
  });

  it('should work out both shares for each partner', async () => {
    const service = Object.create(PartnersService.prototype) as PartnersService;
    Object.assign(service as unknown as Record<string, unknown>, {
      dataSource: {
        query: jest.fn().mockResolvedValue([
          {
            partnerId: 8,
            validOrders: 19,
            esimsSold: 25,
            viaCouponOrders: 2,
            newCustomerOrders: 8,
            approvedOrders: 20,
            refundedOrders: 3,
            revenueVnd: 1_000_000,
            commissionVnd: 200_000,
          },
        ]),
      },
    });

    const { rows } = await service.adminListReconciliations({
      period: '2026-10',
    });

    // 8 of 19 orders are a customer's first; 3 of the 20 approved were
    // refunded (one of them in full, so no longer among the 19).
    expect(rows[0].newCustomerPercent).toBe(42.1);
    expect(rows[0].refundPercent).toBe(15);
  });
});
