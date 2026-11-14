import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * vande-1411 #033 — the email a customer or partner gets when a ticket is
 * closed (by an admin, or 48 hours after "Đã giải quyết"). It sent the
 * "Đã giải quyết" notice; it now says the ticket is closed and links to the
 * form for a new one: the storefront's for a customer, the portal's "Hỗ trợ"
 * page for a partner (`supportFormUrl`). Same frame as the other ticket mails.
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

const BODY = `          <tr>
            <td style="padding:32px 32px 8px">
              <h1 style="margin:0 0 16px;font-size:20px;color:#1a1a1a">Mã hỗ trợ {{ticketNumber}} đã được đóng</h1>
              <p style="margin:0 0 12px;font-size:15px;color:#333;line-height:1.6">Chào bạn,</p>
              <p style="margin:0 0 20px;font-size:15px;color:#333;line-height:1.6">
                Mã số hỗ trợ <strong>{{ticketNumber}}</strong> này đã được đóng lại, vui lòng điền biểu mẫu để tạo mã số
                hỗ trợ mới <a href="{{supportFormUrl}}" style="color:#00838f;font-weight:600">Tại đây</a>.
              </p>
              <p style="margin:0 0 24px;text-align:center">
                <a href="{{supportFormUrl}}" style="display:inline-block;background:#00838f;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 24px;border-radius:8px">Tạo yêu cầu hỗ trợ mới</a>
              </p>
              <p style="margin:0 0 12px;font-size:13px;color:#666;line-height:1.6">
                Hoặc mở liên kết: <a href="{{supportFormUrl}}" style="color:#00838f">{{supportFormUrl}}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 24px">
              <p style="margin:0;font-size:15px;color:#333">Trân trọng,<br />{{app_name}}</p>
            </td>
          </tr>`;

const FOOTER = `          <tr style="background:#f5f5f5">
            <td style="padding:16px;text-align:center;font-size:12px;color:#999">
              &copy; {{app_name}} &mdash; {{supportEmail}}
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
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:24px 0">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden">
${HEADER}
${BODY}
${FOOTER}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

export class TicketClosedEmail1806300000000 implements MigrationInterface {
  name = 'TicketClosedEmail1806300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO "email_template" ("name", "subject", "htmlBody", "isActive")
       VALUES ('ticket_closed', '[{{ticketNumber}}] Mã hỗ trợ đã được đóng', $1, true)
       ON CONFLICT ("name") DO NOTHING`,
      [TEMPLATE],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "email_template" WHERE "name" = 'ticket_closed'`,
    );
  }
}
