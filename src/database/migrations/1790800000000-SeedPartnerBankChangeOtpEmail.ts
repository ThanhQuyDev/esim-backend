import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The email that carries the code for a bank account change (#005).
 *
 * It repeats the account being changed to, so a partner who did not ask for
 * this can see what someone is trying to redirect their payouts to.
 */

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
          <tr style="background:#ffffff;border-bottom:1px solid #e5e7eb">
            <td style="padding:20px;text-align:center">
              <img src="{{logoUrl}}" alt="{{app_name}}" height="48" style="max-height:48px;display:inline-block;border:0;outline:none" />
            </td>
          </tr>
          <tr>
            <td style="padding:32px 32px 0">
              <p style="margin:0;font-size:16px;color:#333">Chào {{contactName}},</p>
              <p style="margin:12px 0 0;font-size:15px;color:#333">
                Bạn vừa yêu cầu đổi tài khoản ngân hàng nhận tiền. Nhập mã xác nhận dưới đây
                trong trang quản lý đối tác để hoàn tất, mã có hiệu lực {{expiresInMinutes}} phút.
              </p>
            </td>
          </tr>
          <tr>
            <td style="text-align:center;padding:24px 32px 0">
              <span style="display:inline-block;padding:16px 40px;background:#00838f;color:#ffffff;font-size:32px;font-weight:700;letter-spacing:8px;border-radius:8px">{{otp}}</span>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 0">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;border-radius:6px">
                <tr>
                  <td style="padding:16px">
                    <p style="margin:0;font-size:13px;color:#888">Tài khoản sẽ được cập nhật thành</p>
                    <p style="margin:4px 0 0;font-size:15px;color:#333">{{bankSummary}}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 0">
              <p style="margin:0;font-size:14px;color:#666">
                Nếu bạn không yêu cầu đổi tài khoản, vui lòng bỏ qua email này và liên hệ
                <a href="mailto:{{supportEmail}}" style="color:#00838f">{{supportEmail}}</a> ngay.
              </p>
            </td>
          </tr>
          <tr style="background:#f5f5f5">
            <td style="padding:16px;text-align:center;font-size:12px;color:#999">
              &copy; {{app_name}} — Đây là email tự động, vui lòng không trả lời trực tiếp.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

export class SeedPartnerBankChangeOtpEmail1790800000000 implements MigrationInterface {
  name = 'SeedPartnerBankChangeOtpEmail1790800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "email_template" ("name", "subject", "htmlBody", "isActive")
      VALUES (
        'partner_bank_change_otp',
        'Mã xác nhận đổi tài khoản ngân hàng — {{app_name}}',
        '${TEMPLATE.replace(/'/g, "''")}',
        true
      )
      ON CONFLICT ("name") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "email_template" WHERE "name" = 'partner_bank_change_otp'`,
    );
  }
}
