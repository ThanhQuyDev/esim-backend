import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Announcements to storefront customers by email (vande #072): the
 * announcement, and one row per customer it goes to — read when sending
 * starts — so emails go out one at a time with the interval the admin chose,
 * and a failed one is retried rather than lost. Plus the email it is framed
 * in, editable in "Mẫu email" like the others.
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
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden">
          <tr style="background:#ffffff;border-bottom:1px solid #e5e7eb">
            <td style="padding:24px;text-align:center;background:#ffffff">
              {{#if logoUrl}}
              <a href="{{siteUrl}}"><img src="{{logoUrl}}" alt="{{app_name}}" height="48" style="max-height:48px;display:inline-block;border:0;outline:none;text-decoration:none" /></a>
              {{else}}
              <span style="color:#00838f;font-size:24px;font-weight:700">{{app_name}}</span>
              {{/if}}
            </td>
          </tr>
          <tr>
            <td style="padding:32px 32px 0">
              <p style="margin:0;font-size:16px;color:#333">Chào {{customerName}},</p>
              <h2 style="margin:16px 0 0;font-size:18px;color:#111">{{title}}</h2>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 32px 0">
              <div style="font-size:15px;line-height:1.6;color:#333">{{{bodyHtml}}}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px">
              <a href="{{siteUrl}}" style="display:inline-block;background:#00838f;color:#ffffff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
                Ghé esim.vn
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 24px">
              <p style="margin:0;font-size:14px;color:#666">
                Cần hỗ trợ? Liên hệ
                <a href="mailto:{{supportEmail}}" style="color:#00838f">{{supportEmail}}</a>.
              </p>
            </td>
          </tr>
          <tr style="background:#f5f5f5">
            <td style="padding:16px;text-align:center;font-size:12px;color:#999">
              &copy; {{app_name}} — Bạn nhận email này vì đã có tài khoản tại esim.vn.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

export class CustomerAnnouncements1801300000000 implements MigrationInterface {
  name = 'CustomerAnnouncements1801300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "customer_announcement" (
         "id" SERIAL PRIMARY KEY,
         "subject" character varying(200) NOT NULL,
         "body" text NOT NULL,
         "audience" character varying(20) NOT NULL,
         "period" character varying(20) NOT NULL,
         "intervalSec" integer NOT NULL DEFAULT 0,
         "scheduledAt" TIMESTAMPTZ NOT NULL,
         "status" character varying(20) NOT NULL DEFAULT 'scheduled',
         "recipientCount" integer,
         "createdByAdminId" integer,
         "createdByName" character varying(120),
         "startedAt" TIMESTAMPTZ,
         "finishedAt" TIMESTAMPTZ,
         "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
       )`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_customer_announcement_due"
         ON "customer_announcement" ("scheduledAt") WHERE "status" = 'scheduled'`,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "customer_announcement_recipient" (
         "id" SERIAL PRIMARY KEY,
         "announcementId" integer NOT NULL
           REFERENCES "customer_announcement"("id") ON DELETE CASCADE,
         "userId" integer,
         "email" character varying NOT NULL,
         "name" character varying,
         "sendAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
         "sentAt" TIMESTAMPTZ,
         "attempts" integer NOT NULL DEFAULT 0,
         "lastError" text,
         CONSTRAINT "UQ_customer_announcement_recipient" UNIQUE ("announcementId", "email")
       )`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_customer_announcement_recipient_due"
         ON "customer_announcement_recipient" ("announcementId", "sendAt") WHERE "sentAt" IS NULL`,
    );
    await queryRunner.query(
      `INSERT INTO "email_template" ("name", "subject", "htmlBody", "isActive")
       VALUES ('customer_announcement', '{{title}}', $1, true)
       ON CONFLICT ("name") DO NOTHING`,
      [TEMPLATE],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "email_template" WHERE "name" = 'customer_announcement'`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "customer_announcement_recipient"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "customer_announcement"`);
  }
}
