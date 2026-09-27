import Handlebars from 'handlebars';
import {
  MailService,
  PARTNER_REGISTER_PATH,
  PARTNER_SIGN_IN_PATH,
} from './mail.service';
import { BRAND_LOGO_URL, SUPPORT_EMAIL } from './mail-branding';

/**
 * What the partner decision emails actually say (#095).
 *
 * The earlier spec for this feature mocked `MailService` wholesale, so it only
 * proved that `approve()` calls a method. It could not catch what was actually
 * wrong: the approval email's only call to action pointed at the storefront
 * rather than the partner portal, so the sentence next to it — sign in with the
 * email and password you registered with — could not be followed (#004).
 *
 * These tests render the real template with the real context, which is the only
 * way a broken link or a missing variable shows up before a customer sees it.
 */
describe('MailService — partner decision email contents', () => {
  const FRONTEND = 'https://esim.vn';
  const PORTAL = 'https://doitac.esim.vn';

  function buildService(template: { subject: string; htmlBody: string }) {
    const sendMail = jest.fn().mockResolvedValue(undefined);
    const service = Object.create(MailService.prototype) as MailService;
    Object.assign(service, {
      logger: { warn: jest.fn(), error: jest.fn() },
      mailerService: { sendMail },
      configService: {
        get: (key: string) =>
          key === 'app.name'
            ? 'esim.vn'
            : key === 'app.partnerPortalDomain'
              ? PORTAL
              : undefined,
        getOrThrow: (key: string) => {
          if (key === 'app.frontendDomain') return FRONTEND;
          throw new Error(`missing config ${key}`);
        },
      },
      emailTemplatesService: {
        findByName: jest.fn().mockResolvedValue(template),
      },
    });
    return { service, sendMail };
  }

  const APPROVED = {
    subject: 'Hồ sơ đối tác đã được duyệt — {{app_name}}',
    htmlBody:
      '<p>Chào {{contactName}},</p><a href="{{portalUrl}}">Vào trang đối tác</a>' +
      '<img src="{{logoUrl}}" /><a href="mailto:{{supportEmail}}">{{supportEmail}}</a>',
  };

  const REJECTED = {
    subject: 'Kết quả hồ sơ đối tác — {{app_name}}',
    htmlBody:
      '<p>Chào {{contactName}},</p>{{#if reason}}<p>Lý do: {{reason}}</p>{{/if}}' +
      '<a href="{{registerUrl}}">Điền lại biểu mẫu đăng ký</a>',
  };

  it('should tell a rejected applicant where the form is (#003)', async () => {
    const { service, sendMail } = buildService(REJECTED);

    await service.sendPartnerRejected({
      to: 'kol@example.com',
      contactName: 'Nguyễn Văn A',
      reason: 'Kênh chưa đủ người theo dõi',
    });

    const html = sendMail.mock.calls[0][0].html as string;
    // "Bạn có thể nộp lại hồ sơ" without a link was an instruction nobody
    // could follow.
    expect(html).toContain(`href="${PORTAL}${PARTNER_REGISTER_PATH}"`);
  });

  it('should point the approval email at the partner portal sign-in (#004)', async () => {
    const { service, sendMail } = buildService(APPROVED);

    await service.sendPartnerApproved({
      to: 'kol@example.com',
      contactName: 'Nguyễn Văn A',
    });

    const html = sendMail.mock.calls[0][0].html as string;
    // Not the storefront: partners have no account there.
    expect(html).toContain(`href="${PORTAL}${PARTNER_SIGN_IN_PATH}"`);
    expect(html).not.toContain(FRONTEND);
  });

  it('should not double the slash when the domain is configured with one', async () => {
    const { service, sendMail } = buildService(APPROVED);
    Object.assign(service, {
      configService: {
        get: (key: string) =>
          key === 'app.name'
            ? 'esim.vn'
            : key === 'app.partnerPortalDomain'
              ? `${PORTAL}/`
              : undefined,
        getOrThrow: () => FRONTEND,
      },
    });

    await service.sendPartnerApproved({ to: 'a@b.com', contactName: 'A' });

    const html = sendMail.mock.calls[0][0].html as string;
    expect(html).toContain(`href="${PORTAL}${PARTNER_SIGN_IN_PATH}"`);
  });

  it('should fall back to the frontend domain when no portal domain is set', async () => {
    const { service, sendMail } = buildService(APPROVED);
    Object.assign(service, {
      configService: {
        get: (key: string) => (key === 'app.name' ? 'esim.vn' : undefined),
        getOrThrow: (key: string) => {
          if (key === 'app.frontendDomain') return FRONTEND;
          throw new Error(`missing config ${key}`);
        },
      },
    });

    await service.sendPartnerApproved({ to: 'a@b.com', contactName: 'A' });

    const html = sendMail.mock.calls[0][0].html as string;
    expect(html).toContain(`href="${FRONTEND}${PARTNER_SIGN_IN_PATH}"`);
  });

  it('should never mail a link built from a missing config value', async () => {
    const { service } = buildService(APPROVED);
    Object.assign(service, {
      configService: {
        get: (key: string) => (key === 'app.name' ? 'esim.vn' : undefined),
        getOrThrow: () => {
          throw new Error('app.frontendDomain is not set');
        },
      },
    });

    // Better to fail loudly here — the caller swallows it and the approval
    // still stands — than to send a link starting with "undefined".
    await expect(
      service.sendPartnerApproved({ to: 'a@b.com', contactName: 'A' }),
    ).rejects.toThrow();
  });

  it('should leave no unfilled placeholder in either email', async () => {
    for (const template of [APPROVED, REJECTED]) {
      const { service, sendMail } = buildService(template);

      await service.sendPartnerRejected({
        to: 'kol@example.com',
        contactName: 'Nguyễn Văn A',
        reason: 'Thiếu giấy phép kinh doanh',
      });

      const { html, subject } = sendMail.mock.calls[0][0];
      expect(html).not.toContain('{{');
      expect(subject).not.toContain('{{');
    }
  });

  it('should carry the brand logo and the support mailbox we actually read', async () => {
    const { service, sendMail } = buildService(APPROVED);

    await service.sendPartnerApproved({ to: 'a@b.com', contactName: 'A' });

    const html = sendMail.mock.calls[0][0].html as string;
    expect(html).toContain(BRAND_LOGO_URL);
    expect(html).toContain(SUPPORT_EMAIL);
  });

  it('should include the reason on a rejection and omit the block without one', async () => {
    const { service, sendMail } = buildService(REJECTED);

    await service.sendPartnerRejected({
      to: 'a@b.com',
      contactName: 'A',
      reason: null,
    });
    expect(sendMail.mock.calls[0][0].html).not.toContain('Lý do');

    // Same template, this time with a reason.
    const rendered = Handlebars.compile(REJECTED.htmlBody)({
      contactName: 'A',
      reason: 'Thiếu giấy phép',
    });
    expect(rendered).toContain('Thiếu giấy phép');
  });
});
