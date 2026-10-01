import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * #059 — a support request produced a ticket row but nothing the customer could
 * refer to. Staff had to open their own mail client and write a reply by hand,
 * with no shared reference between the email and the CMS thread.
 *
 * `ticketNumber` is that reference: `HT-000123` ("hỗ trợ"), derived from the id so
 * it needs no sequence and can be backfilled exactly. It goes in the subject line
 * of every support email, which is also what makes matching a customer's reply
 * back to its ticket possible later.
 *
 * Two templates so support can reword them without a deploy, like the others.
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

/**
 * No "do not reply" line, unlike the other templates: replying is exactly what a
 * customer is meant to be able to do with a support email.
 */
const FOOTER = `          <tr>
            <td style="padding:0 32px 24px">
              <p style="margin:0;font-size:14px;color:#666">
                Bạn có thể trả lời trực tiếp email này — phản hồi của bạn sẽ được ghi nhận vào phiếu
                <strong>{{ticketNumber}}</strong>.
              </p>
            </td>
          </tr>
          <tr style="background:#f5f5f5">
            <td style="padding:16px;text-align:center;font-size:12px;color:#999">
              &copy; {{app_name}} &mdash; {{supportEmail}}
            </td>
          </tr>`;

function shell(body: string): string {
  return `<!DOCTYPE html>
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
${body}
${FOOTER}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

const ACKNOWLEDGEMENT_BODY = `          <tr>
            <td style="padding:32px 32px 8px">
              <h1 style="margin:0 0 16px;font-size:20px;color:#1a1a1a">Cảm ơn bạn đã liên hệ với chúng tôi</h1>
              <p style="margin:0 0 12px;font-size:15px;color:#333;line-height:1.6">
                Chúng tôi đã nhận được yêu cầu của bạn và đã tạo một phiếu hỗ trợ (ticket). Mã số phiếu hỗ trợ
                <strong>{{ticketNumber}}</strong> cũng có trong dòng tiêu đề của email này.
              </p>
              <p style="margin:0 0 12px;font-size:15px;color:#333;line-height:1.6">
                Đội ngũ của chúng tôi hiện đang xem xét yêu cầu của bạn và sẽ phản hồi lại bạn trong thời gian sớm nhất.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 16px">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px">
                <tr>
                  <td style="padding:16px">
                    <p style="margin:0 0 4px;font-size:12px;color:#888;text-transform:uppercase">Nội dung bạn đã gửi</p>
                    <p style="margin:0 0 8px;font-size:14px;color:#1a1a1a;font-weight:600">{{ticketSubject}}</p>
                    <p style="margin:0;font-size:14px;color:#333;line-height:1.6;white-space:pre-line">{{ticketDescription}}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 24px">
              <p style="margin:0;font-size:15px;color:#333">Trân trọng,<br />{{app_name}}</p>
            </td>
          </tr>`;

const REPLY_BODY = `          <tr>
            <td style="padding:32px 32px 8px">
              <h1 style="margin:0 0 16px;font-size:20px;color:#1a1a1a">Phản hồi cho phiếu {{ticketNumber}}</h1>
              <p style="margin:0 0 12px;font-size:15px;color:#333;line-height:1.6;white-space:pre-line">{{replyBody}}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 16px">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px">
                <tr>
                  <td style="padding:16px">
                    <p style="margin:0 0 4px;font-size:12px;color:#888;text-transform:uppercase">Yêu cầu của bạn</p>
                    <p style="margin:0;font-size:14px;color:#1a1a1a;font-weight:600">{{ticketSubject}}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 24px">
              <p style="margin:0;font-size:15px;color:#333">Trân trọng,<br />{{app_name}}</p>
            </td>
          </tr>`;

export class AddTicketNumberAndSupportEmails1794500000000 implements MigrationInterface {
  name = 'AddTicketNumberAndSupportEmails1794500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ticket" ADD COLUMN IF NOT EXISTS "ticketNumber" character varying`,
    );

    // Derived from the id, so existing tickets get the number they would have
    // been given had this always existed.
    await queryRunner.query(
      `UPDATE "ticket" SET "ticketNumber" = 'HT-' || LPAD(id::text, 6, '0')
       WHERE "ticketNumber" IS NULL`,
    );

    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_ticket_ticketNumber"
       ON "ticket" ("ticketNumber")`,
    );

    await queryRunner.query(
      `INSERT INTO "email_template" ("name", "subject", "htmlBody", "isActive")
       VALUES ('ticket_acknowledgement', '[{{ticketNumber}}] Đã nhận yêu cầu hỗ trợ của bạn', $1, true)
       ON CONFLICT ("name") DO NOTHING`,
      [shell(ACKNOWLEDGEMENT_BODY)],
    );

    await queryRunner.query(
      `INSERT INTO "email_template" ("name", "subject", "htmlBody", "isActive")
       VALUES ('ticket_admin_reply', '[{{ticketNumber}}] Phản hồi yêu cầu hỗ trợ: {{ticketSubject}}', $1, true)
       ON CONFLICT ("name") DO NOTHING`,
      [shell(REPLY_BODY)],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "email_template" WHERE "name" IN ('ticket_acknowledgement', 'ticket_admin_reply')`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ticket_ticketNumber"`);
    await queryRunner.query(
      `ALTER TABLE "ticket" DROP COLUMN IF EXISTS "ticketNumber"`,
    );
  }
}
