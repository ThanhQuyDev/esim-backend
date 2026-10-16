import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Announcements, test round of 14/10 (doitac-1410 #062):
 * - `priority` (normal / important / urgent) sets the banner's colour;
 * - `isFeatured` ("nổi bật") is what puts one at the top of the page, until
 *   an admin untick it;
 * - `updatedAt` / `deletedAt` for "Sửa" and "Xóa" on the sent list;
 * - the email shows the rich-text body as HTML instead of escaped text.
 */
const EMAIL_FROM =
  '<div style="font-size:15px;line-height:1.6;color:#333;white-space:pre-wrap">{{body}}</div>';
const EMAIL_TO =
  '<div style="font-size:15px;line-height:1.6;color:#333">{{{bodyHtml}}}</div>';

export class PartnerNotificationPriority1798500000000 implements MigrationInterface {
  name = 'PartnerNotificationPriority1798500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "partner_notification"
        ADD COLUMN IF NOT EXISTS "priority" varchar(20) NOT NULL DEFAULT 'normal',
        ADD COLUMN IF NOT EXISTS "isFeatured" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "updatedAt" timestamp NULL,
        ADD COLUMN IF NOT EXISTS "deletedAt" timestamp NULL`);
    await queryRunner.query(
      `UPDATE "email_template"
          SET "htmlBody" = replace("htmlBody", $1, $2), "updatedAt" = now()
        WHERE name = 'partner_notification'
          AND position($1 in "htmlBody") > 0`,
      [EMAIL_FROM, EMAIL_TO],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "email_template"
          SET "htmlBody" = replace("htmlBody", $2, $1), "updatedAt" = now()
        WHERE name = 'partner_notification'`,
      [EMAIL_FROM, EMAIL_TO],
    );
    await queryRunner.query(`
      ALTER TABLE "partner_notification"
        DROP COLUMN IF EXISTS "priority",
        DROP COLUMN IF EXISTS "isFeatured",
        DROP COLUMN IF EXISTS "updatedAt",
        DROP COLUMN IF EXISTS "deletedAt"`);
  }
}
