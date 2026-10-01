import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * #061 — the ticket status lifecycle.
 *
 * `resolvedAt` is the clock the 48-hour auto-close runs off. It cannot be derived
 * from `updatedAt`: any later edit — a reply, an attachment, a status correction —
 * moves that, which would keep pushing the close back or bring it forward.
 *
 * The closing notice is an `email_template` row like the others, so support can
 * reword it without a deploy.
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
                Nếu vấn đề chưa được giải quyết, bạn chỉ cần trả lời email này — phiếu
                <strong>{{ticketNumber}}</strong> sẽ được mở lại.
              </p>
            </td>
          </tr>
          <tr style="background:#f5f5f5">
            <td style="padding:16px;text-align:center;font-size:12px;color:#999">
              &copy; {{app_name}} &mdash; {{supportEmail}}
            </td>
          </tr>`;

const BODY = `          <tr>
            <td style="padding:32px 32px 8px">
              <h1 style="margin:0 0 16px;font-size:20px;color:#1a1a1a">Yêu cầu {{ticketNumber}} đã được giải quyết</h1>
              <p style="margin:0 0 12px;font-size:15px;color:#333;line-height:1.6">Chào bạn,</p>
              <p style="margin:0 0 12px;font-size:15px;color:#333;line-height:1.6">
                Chúng tôi đã đánh dấu yêu cầu của bạn là &ldquo;Đã giải quyết&rdquo;. Chúng tôi luôn nỗ lực cải thiện
                sản phẩm và dịch vụ, và những phản hồi của bạn đóng vai trò vô cùng quan trọng đối với chúng tôi.
              </p>
              <p style="margin:0 0 12px;font-size:15px;color:#333;line-height:1.6">
                Chúng tôi rất mong được tiếp tục hỗ trợ bạn duy trì kết nối trong những chuyến đi sắp tới. Nếu có bất kỳ
                thắc mắc nào, xin đừng ngần ngại liên hệ với chúng tôi bất cứ lúc nào.
              </p>
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

export class AddTicketResolvedAtAndCloseEmail1794600000000 implements MigrationInterface {
  name = 'AddTicketResolvedAtAndCloseEmail1794600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ticket" ADD COLUMN IF NOT EXISTS "resolvedAt" TIMESTAMP`,
    );

    // Tickets already sitting in `resolved` have no recorded moment, so the clock
    // starts now rather than closing them all on the next sweep.
    await queryRunner.query(
      `UPDATE "ticket" SET "resolvedAt" = NOW()
       WHERE "status" = 'resolved' AND "resolvedAt" IS NULL`,
    );

    // The sweep reads status and resolvedAt together.
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ticket_status_resolvedAt"
       ON "ticket" ("status", "resolvedAt")`,
    );

    await queryRunner.query(
      `INSERT INTO "email_template" ("name", "subject", "htmlBody", "isActive")
       VALUES ('ticket_resolved_closed', '[{{ticketNumber}}] Yêu cầu hỗ trợ của bạn đã được giải quyết', $1, true)
       ON CONFLICT ("name") DO NOTHING`,
      [TEMPLATE],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "email_template" WHERE "name" = 'ticket_resolved_closed'`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_ticket_status_resolvedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ticket" DROP COLUMN IF EXISTS "resolvedAt"`,
    );
  }
}
