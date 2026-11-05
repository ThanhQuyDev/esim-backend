import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Customer announcements (vande-0411 #059): "Xoá" takes one off the list and
 * keeps the record of who was mailed. The subject belongs on the subject line,
 * not again under the greeting, and the footer's esim.vn links with https.
 */
export class AnnouncementDeleteAndTemplate1804800000000 implements MigrationInterface {
  name = 'AnnouncementDeleteAndTemplate1804800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "customer_announcement" ADD COLUMN IF NOT EXISTS "deletedAt" timestamptz`,
    );
    await queryRunner.query(
      `UPDATE "email_template"
          SET "htmlBody" = replace(
                regexp_replace("htmlBody", '\\s*<h2[^>]*>\\{\\{title\\}\\}</h2>', ''),
                'tại esim.vn.',
                'tại <a href="{{siteUrl}}" style="color:#00838f">esim.vn</a>.')
        WHERE name = 'customer_announcement'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "customer_announcement" DROP COLUMN IF EXISTS "deletedAt"`,
    );
  }
}
