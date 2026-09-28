import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The email for an account an admin created by hand (#059).
 *
 * A VIP partner who never filled in the form has no password of their own, so
 * this is the only place they learn how to get in. It says the two things that
 * matter: what their login is, and that the password in the email is temporary
 * — they will be made to change it the first time they sign in.
 *
 * A row in `email_template` like the others, so support can reword it without a
 * deploy.
 */

const HEADER = `          <tr style="background:#ffffff;border-bottom:1px solid #e5e7eb">
            <td style="padding:24px;text-align:center;background:#ffffff">
              {{#if logoUrl}}
              <img src="{{logoUrl}}" alt="{{app_name}}" height="48" style="max-height:48px;display:inline-block;border:0;outline:none;text-decoration:none" />
              {{else}}
              <span style="color:#00838f;font-size:24px;font-weight:700">{{app_name}}</span>
              {{/if}}
            </td>
          </tr>`;

const FOOTER = `          <tr>
            <td style="padding:0 32px 24px">
              <p style="margin:0;font-size:14px;color:#666">
                Cần hỗ trợ thêm? Liên hệ
                <a href="mailto:{{supportEmail}}" style="color:#00838f">{{supportEmail}}</a>.
              </p>
            </td>
          </tr>
          <tr style="background:#f5f5f5">
            <td style="padding:16px;text-align:center;font-size:12px;color:#999">
              &copy; {{app_name}} — Đây là email tự động, vui lòng không trả lời trực tiếp.
            </td>
          </tr>`;

const TEMPLATE = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{{subject}}</title>
</head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f5f5f5">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden">
${HEADER}
          <tr>
            <td style="padding:32px 32px 0">
              <p style="margin:0;font-size:16px;color:#333">Chào {{contactName}},</p>
              <p style="margin:12px 0 0;font-size:15px;color:#333">
                {{app_name}} đã tạo tài khoản đối tác cho bạn. Bạn đăng nhập bằng thông tin dưới đây.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 0">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;border-radius:6px">
                <tr>
                  <td style="padding:16px">
                    <p style="margin:0;font-size:13px;color:#888">Tài khoản đăng nhập</p>
                    <p style="margin:4px 0 0;font-size:15px;color:#333"><strong>{{email}}</strong></p>
                    <p style="margin:12px 0 0;font-size:13px;color:#888">Mật khẩu tạm thời</p>
                    <p style="margin:4px 0 0;font-size:18px;color:#333;letter-spacing:1px"><strong>{{temporaryPassword}}</strong></p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 0">
              <p style="margin:0;font-size:14px;color:#666">
                Mật khẩu trên là <strong>mật khẩu tạm thời</strong>. Ngay lần đăng nhập đầu tiên,
                hệ thống sẽ yêu cầu bạn đổi sang mật khẩu của riêng mình để tiếp tục sử dụng dịch vụ.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px">
              <a href="{{portalUrl}}" style="display:inline-block;background:#00838f;color:#ffffff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
                Đăng nhập trang đối tác
              </a>
            </td>
          </tr>
${FOOTER}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

export class SeedPartnerAccountCreatedEmail1792500000000 implements MigrationInterface {
  name = 'SeedPartnerAccountCreatedEmail1792500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO "email_template" ("name", "subject", "htmlBody", "isActive")
       VALUES ('partner_account_created', 'Tài khoản đối tác của bạn đã được tạo', $1, true)
       ON CONFLICT ("name") DO NOTHING`,
      [TEMPLATE],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "email_template" WHERE "name" = 'partner_account_created'`,
    );
  }
}
