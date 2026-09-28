import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * When the account last signed in (#060).
 *
 * The partner list needs "thời gian hoạt động gần nhất (tính theo thời gian đối
 * tác đăng nhập hệ thống gần nhất)". It was standing in with the date of their
 * last order, which is a different thing entirely: a partner who logs in every
 * day to check their commission and has not sold anything for a month looked
 * dormant, and one whose orders come through a link they posted a year ago
 * looked active.
 */
export class AddLastLoginAtToUser1792600000000 implements MigrationInterface {
  name = 'AddLastLoginAtToUser1792600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" DROP COLUMN IF EXISTS "lastLoginAt"`,
    );
  }
}
