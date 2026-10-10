import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * #041 (test round 4) — tickets as a conversation.
 *
 * - `lastReplyAt` / `lastReplyRole` / `lastReplyName`: who wrote last and when,
 *   for the CMS list and the sidebar badge (a ticket whose last word is the
 *   customer's is waiting on support). Backfilled from each ticket's latest
 *   real message — the "Hệ thống" notices do not count — else its opening form.
 * - `ticket_closed_reply`: the automatic answer to a customer writing into a
 *   closed ticket, pointing them at the form for a new request.
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

const FOOTER = `          <tr style="background:#f5f5f5">
            <td style="padding:16px;text-align:center;font-size:12px;color:#999">
              &copy; {{app_name}} &mdash; {{supportEmail}}
            </td>
          </tr>`;

const BODY = `          <tr>
            <td style="padding:32px 32px 8px">
              <h1 style="margin:0 0 16px;font-size:20px;color:#1a1a1a">Mã hỗ trợ {{ticketNumber}} đã được đóng</h1>
              <p style="margin:0 0 12px;font-size:15px;color:#333;line-height:1.6">Chào bạn,</p>
              <p style="margin:0 0 12px;font-size:15px;color:#333;line-height:1.6">
                Cảm ơn bạn đã phản hồi. Mã số hỗ trợ <strong>{{ticketNumber}}</strong> đã được đóng lại nên chúng tôi
                không thể tiếp tục xử lý trong luồng này.
              </p>
              <p style="margin:0 0 20px;font-size:15px;color:#333;line-height:1.6">
                Nếu bạn vẫn cần hỗ trợ, vui lòng điền biểu mẫu để tạo mã số hỗ trợ mới — chúng tôi sẽ phản hồi trong thời
                gian sớm nhất.
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

export class TicketConversationState1796300000000 implements MigrationInterface {
  name = 'TicketConversationState1796300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ticket"
         ADD COLUMN IF NOT EXISTS "lastReplyAt" TIMESTAMP,
         ADD COLUMN IF NOT EXISTS "lastReplyRole" character varying,
         ADD COLUMN IF NOT EXISTS "lastReplyName" character varying`,
    );

    await queryRunner.query(
      `UPDATE "ticket" t
          SET "lastReplyAt" = COALESCE(m."createdAt", t."createdAt"),
              "lastReplyRole" = COALESCE(m."authorRole", 'customer'),
              "lastReplyName" = m."authorName"
         FROM "ticket" t2
         LEFT JOIN LATERAL (
           SELECT "createdAt", "authorRole", "authorName"
             FROM "ticket_message"
            WHERE "ticketId" = t2.id
              AND COALESCE("authorName", '') <> 'Hệ thống'
            ORDER BY "createdAt" DESC, id DESC
            LIMIT 1
         ) m ON true
        WHERE t2.id = t.id AND t."lastReplyAt" IS NULL`,
    );

    await queryRunner.query(
      `INSERT INTO "email_template" ("name", "subject", "htmlBody", "isActive")
       VALUES ('ticket_closed_reply', '[{{ticketNumber}}] Mã hỗ trợ đã được đóng', $1, true)
       ON CONFLICT ("name") DO NOTHING`,
      [TEMPLATE],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "email_template" WHERE "name" = 'ticket_closed_reply'`,
    );
    await queryRunner.query(
      `ALTER TABLE "ticket"
         DROP COLUMN IF EXISTS "lastReplyName",
         DROP COLUMN IF EXISTS "lastReplyRole",
         DROP COLUMN IF EXISTS "lastReplyAt"`,
    );
  }
}
