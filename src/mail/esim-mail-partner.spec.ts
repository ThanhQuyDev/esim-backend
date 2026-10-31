import { MailService } from './mail.service';

/**
 * eSIM emails of a distribution partner's order (doitac-1410 #034): to the
 * customer address the partner gave, with the partner's own logo.
 */
function build(
  row: Record<string, unknown> | undefined,
  /** Whether this eSIM was mailed before (doitac-3010 #004). */
  mailedBefore = false,
) {
  const sendMail = jest.fn().mockResolvedValue(undefined);
  const query = jest.fn((sql: string) =>
    Promise.resolve(
      sql.includes('purchaseEmailSentAt')
        ? [mailedBefore ? [] : [{ id: 1 }], mailedBefore ? 0 : 1]
        : row
          ? [row]
          : [],
    ),
  );
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

describe('MailService.sendEsimPurchase — once per eSIM (doitac-3010 #004)', () => {
  it('should not mail an eSIM a second time on its own', async () => {
    // The partner order mailed it, then the supplier's webhook tried again.
    const { service, sendMail } = build(undefined, true);

    await service.sendEsimPurchase(DATA);

    expect(sendMail).not.toHaveBeenCalled();
  });

  it('should mail it again when someone presses "Gửi lại email eSIM"', async () => {
    const { service, sendMail } = build(undefined, true);

    await service.sendEsimPurchase(DATA, { force: true });

    expect(sendMail).toHaveBeenCalledTimes(1);
  });

  it("should send a partner's order under the partner's name", async () => {
    const { service, sendMail } = build({
      brandInfo: { displayName: 'Shop Du Lịch', supportEmail: 'hotro@shop.vn' },
    });

    await service.sendEsimPurchase(DATA);

    const mail = sendMail.mock.calls[0][0];
    expect(mail.fromName).toBe('Shop Du Lịch');
    expect(mail.replyTo).toBe('hotro@shop.vn');
  });

  it('should free the eSIM for a retry when the send fails', async () => {
    const { service, sendMail, query } = build(undefined);
    sendMail.mockRejectedValueOnce(new Error('smtp down'));

    await expect(service.sendEsimPurchase(DATA)).rejects.toThrow('smtp down');

    expect(
      query.mock.calls.some(([sql]) =>
        String(sql).includes('"purchaseEmailSentAt" = NULL'),
      ),
    ).toBe(true);
  });
});
