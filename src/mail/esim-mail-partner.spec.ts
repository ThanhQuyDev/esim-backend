import { MailService } from './mail.service';

/**
 * eSIM emails of a distribution partner's order (doitac-1410 #034): to the
 * customer address the partner gave, with the partner's own logo.
 */
function build(row: Record<string, unknown> | undefined) {
  const sendMail = jest.fn().mockResolvedValue(undefined);
  const query = jest.fn().mockResolvedValue(row ? [row] : []);
  const service = new MailService(
    { sendMail } as never,
    { get: jest.fn(() => 'https://esim.test') } as never,
    {
      findByName: jest.fn().mockResolvedValue({
        subject: 'eSIM {{orderNumber}}',
        htmlBody: '<img src="{{logoUrl}}">',
      }),
    } as never,
    { query } as never,
  );
  return { service, sendMail, query };
}

const DATA = {
  to: 'partner@shop.vn',
  esimId: 1,
  qrAccessToken: 't',
  iccid: '8984',
  planName: 'Japan 5GB',
  orderNumber: 'PTN-1',
} as never;

describe('MailService.sendEsimPurchase — partner orders (doitac-1410 #034)', () => {
  it('should mail the customer address with the partner logo', async () => {
    const { service, sendMail } = build({
      deliveryEmail: 'khach@example.com',
      brandInfo: { logoUrl: 'https://cdn.test/shop-logo.png' },
    });

    await service.sendEsimPurchase(DATA);

    const mail = sendMail.mock.calls[0][0];
    expect(mail.to).toBe('khach@example.com');
    expect(mail.html).toContain('https://cdn.test/shop-logo.png');
  });

  it('should leave an ordinary order alone', async () => {
    const { service, sendMail } = build(undefined);

    await service.sendEsimPurchase(DATA);

    const mail = sendMail.mock.calls[0][0];
    expect(mail.to).toBe('partner@shop.vn');
    expect(mail.html).not.toContain('shop-logo');
  });
});
