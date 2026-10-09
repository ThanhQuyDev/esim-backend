import { readFileSync } from 'fs';
import { join } from 'path';
import * as Handlebars from 'handlebars';
import { MailService } from './mail.service';

/**
 * Account emails (#012, test round 4): the reset link led to an error page,
 * the email came from order@, was English only, and said "ESIM.VN API".
 */
describe('password reset email', () => {
  function send(frontendDomain: string) {
    const sent: Array<Record<string, any>> = [];
    const service = new MailService(
      {
        sendMail: jest.fn((mail: Record<string, any>) => {
          sent.push(mail);
          return Promise.resolve();
        }),
      } as never,
      {
        get: jest.fn(() => 'ESIM.VN API'),
        getOrThrow: jest.fn((key: string) =>
          key === 'app.frontendDomain' ? frontendDomain : '/app',
        ),
      } as never,
      {} as never,
    );
    return service
      .forgotPassword({
        to: 'a@b.com',
        data: { hash: 'h1', tokenExpires: 123 },
      })
      .then(() => sent[0]);
  }

  it('should go out from the no-reply address, not order@', async () => {
    const mail = await send('https://shop.example');
    expect(mail.transportName).toBe('otp');
  });

  it('should link to the reset page without a double slash', async () => {
    const mail = await send('https://shop.example/');
    expect(mail.context.url).toBe(
      'https://shop.example/password-change?hash=h1&expires=123',
    );
  });

  it('should be written in Vietnamese and English and say ESIM.VN', async () => {
    const mail = await send('https://shop.example');
    expect(mail.subject).toContain('Đặt lại mật khẩu');
    expect(mail.subject).toContain('Reset your password');
    expect(mail.context.app_name).toBe('ESIM.VN');
    expect(JSON.stringify(mail)).not.toContain('ESIM.VN API');

    const html = Handlebars.compile(
      readFileSync(
        join(__dirname, 'mail-templates', 'auth-action.hbs'),
        'utf8',
      ),
    )(mail.context);
    expect(html).toContain('Bạn gặp khó khăn khi đăng nhập?');
    expect(html).toContain('Trouble signing in?');
    expect(html).toContain('href="https://esim.vn"');
  });
});
