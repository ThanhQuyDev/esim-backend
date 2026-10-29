import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Customer announcements sent to addresses the admin types in rather than to
 * a customer group (vande #087).
 */
export class AnnouncementEmails1801900000000 implements MigrationInterface {
  name = 'AnnouncementEmails1801900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "customer_announcement" ADD COLUMN IF NOT EXISTS "emails" text[]`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "customer_announcement" DROP COLUMN IF EXISTS "emails"`,
    );
  }
}
