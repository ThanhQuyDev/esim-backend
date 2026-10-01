import { MailService } from './mail.service';

/**
 * #023 — the eSIM delivery email has to state the call minutes and SMS.
 *
 * The trap is a data-only plan: `call`/`sms` come back as 0 or null, and passing
 * those straight through would make Handlebars print "0 phút gọi" on every
 * ordinary eSIM. The context has to hand `{{#if}}` something falsy instead.
 */
describe('sendEsimPurchase — call / SMS in the context (#023)', () => {
  function makeService(htmlBody = '{{callMinutes}}|{{smsCount}}') {
    const sent: { html?: string }[] = [];
    const service = Object.create(MailService.prototype) as MailService;
    const internals = service as unknown as Record<string, unknown>;
    internals.emailTemplatesService = {
      findByName: jest.fn().mockResolvedValue({
        name: 'esim_purchase',
        subject: 'Your eSIM is ready',
        htmlBody,
      }),
    };
    internals.configService = {
      get: jest.fn().mockReturnValue('https://esim.vn'),
    };
    internals.mailerService = {
      sendMail: jest.fn((payload: { html?: string }) => {
        sent.push(payload);
        return Promise.resolve();
      }),
    };
    internals.logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
    return { service, sent };
  }

  const BASE = {
    to: 'a@b.com',
    esimId: 1,
    qrAccessToken: 'token',
    iccid: '8901234567890123456',
    activationCode: 'CODE',
    lpa: 'LPA:1$x$y',
    smdpAddress: 'smdp.example.com',
    apn: 'internet',
    phoneNumber: null,
    planName: 'Japan 5GB',
    orderNumber: 'ORD-1',
  };

  it('should pass the allowance through for a call-and-SMS plan', async () => {
    const { service, sent } = makeService();

    await service.sendEsimPurchase({ ...BASE, callMinutes: 100, smsCount: 50 });

    expect(sent[0].html).toBe('100|50');
  });

  it('should render nothing for a data-only plan instead of "0"', async () => {
    const { service, sent } = makeService();

    await service.sendEsimPurchase({ ...BASE, callMinutes: 0, smsCount: 0 });

    expect(sent[0].html).toBe('|');
  });

  it('should treat a missing allowance the same as zero', async () => {
    const { service, sent } = makeService();

    await service.sendEsimPurchase(BASE);

    expect(sent[0].html).toBe('|');
  });

  it('should leave the {{#if}} blocks out for a data-only plan', async () => {
    const { service, sent } = makeService(
      '{{#if callMinutes}}CALL {{callMinutes}}{{/if}}{{#if smsCount}}SMS {{smsCount}}{{/if}}',
    );

    await service.sendEsimPurchase({
      ...BASE,
      callMinutes: null,
      smsCount: null,
    });

    expect(sent[0].html).toBe('');
  });

  it('should keep one block when only one of the two is included', async () => {
    const { service, sent } = makeService(
      '{{#if callMinutes}}CALL {{callMinutes}}{{/if}}{{#if smsCount}}SMS {{smsCount}}{{/if}}',
    );

    await service.sendEsimPurchase({ ...BASE, callMinutes: 30, smsCount: 0 });

    expect(sent[0].html).toBe('CALL 30');
  });

  it('should still deliver the eSIM when the lookup link cannot be signed (#003)', async () => {
    // No ESIM_LOOKUP_SECRET / AUTH_JWT_SECRET in this environment. The link is a
    // convenience; the email IS the delivery, so it must go out regardless.
    const { service, sent } = makeService('{{iccid}}|{{usageCheckUrl}}');

    await service.sendEsimPurchase({ ...BASE, callMinutes: 10, smsCount: 10 });

    expect(sent).toHaveLength(1);
    expect(sent[0].html).toBe('8901234567890123456|');
  });
});
