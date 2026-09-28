import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Force a password change at the next sign-in (#059).
 *
 * An admin adding a VIP partner by hand does not choose their password — the
 * system mints a random one and emails it. That password has travelled through
 * an inbox, so it must not stay the account's password: the partner signs in
 * with it once and is made to set their own.
 */
export class AddMustChangePasswordToUser1792400000000 implements MigrationInterface {
  name = 'AddMustChangePasswordToUser1792400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "mustChangePassword" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" DROP COLUMN IF EXISTS "mustChangePassword"`,
    );
  }
}
