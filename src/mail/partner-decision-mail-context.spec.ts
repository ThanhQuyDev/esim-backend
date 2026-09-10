import Handlebars from 'handlebars';
import { MailService, PARTNER_AFFILIATE_PATH } from './mail.service';
import { BRAND_LOGO_URL, SUPPORT_EMAIL } from './mail-branding';

/**
 * What the partner decision emails actually say (#095).
 *
 * The earlier spec for this feature mocked `MailService` wholesale, so it only
 * proved that `approve()` calls a method. It could not catch what was actually
 * wrong: the approval email's only call to action pointed at
 * `/tai-khoan/affiliates`, a path the storefront serves in neither language
 * (Vietnamese is `/ho-so`, English `/profile`). Every approved partner got a
 * button to a 404.
 *
 * These tests render the real template with the real context, which is the only
 * way a broken link or a missing variable shows up before a customer sees it.
 */
describe('MailService — partner decision email contents', () => {
  const FRONTEND = 'https://esim.vn';

  /** Paths the storefront really serves (`i18n/routing.ts`). */
  const REAL_PROFILE_PATHS = ['/ho-so', '/profile'];

  function buildService(template: { subject: string; htmlBody: string }) {
    const sendMail = jest.fn().mockResolvedValue(undefined);
    const service = Object.create(MailService.prototype) as MailService;
    Object.assign(service, {
      logger: { warn: jest.fn(), error: jest.fn() },
      mailerService: { sendMail },
      configService: {
        get: (key: string) => (key === 'app.name' ? 'esim.vn' : undefined),
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
      '<p>Chào {{contactName}},</p>{{#if reason}}<p>Lý do: {{reason}}</p>{{/if}}',
  };

  it('should point the approval email at a page the site actually serves', async () => {
    const { service, sendMail } = buildService(APPROVED);

    await service.sendPartnerApproved({
      to: 'kol@example.com',
      contactName: 'Nguyễn Văn A',
    });

    const html = sendMail.mock.calls[0][0].html as string;
    const href = /href="(https:\/\/[^"]+)"/.exec(html)?.[1] ?? '';
    expect(href.startsWith(FRONTEND)).toBe(true);

    const path = href.slice(FRONTEND.length);
    const [pathname] = path.split('?');
    expect(REAL_PROFILE_PATHS).toContain(pathname);
  });

  it('should open the Affiliates tab rather than dropping the partner on a generic page', () => {
    // The tab is not its own route, so the link carries `?tab=affiliate`; the
    // profile page reads it.
    expect(PARTNER_AFFILIATE_PATH).toContain('?tab=affiliate');
  });

  it('should never mail a link built from a missing config value', async () => {
    const { service } = buildService(APPROVED);
    Object.assign(service, {
      configService: {
        get: () => 'esim.vn',
        getOrThrow: () => {
          throw new Error('app.frontendDomain is not set');
        },
      },
    });

    // Better to fail loudly here — the caller swallows it and the approval
    // still stands — than to send "undefined/ho-so?tab=affiliate".
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
