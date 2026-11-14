import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Security 15/11/2026 — "Khoá tài khoản" for any account, not only partners.
 * A locked account cannot sign in and its existing tokens stop working.
 */
export class UserLock1806800000000 implements MigrationInterface {
  name = 'UserLock1806800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "lockedAt" TIMESTAMP NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "lockReason" character varying(500) NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" DROP COLUMN IF EXISTS "lockReason"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" DROP COLUMN IF EXISTS "lockedAt"`,
    );
  }
}
