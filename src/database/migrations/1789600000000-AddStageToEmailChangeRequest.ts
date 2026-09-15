import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Email change proves the CURRENT address before the new one (#023).
 *
 * A pending request now moves through two stages: `current` (a code was mailed
 * to the address the account already has) and `new` (that code checked out, and
 * a second code was mailed to the new address). Requests created before this
 * change only ever mailed the new address, so they start at `new`.
 */
export class AddStageToEmailChangeRequest1789600000000 implements MigrationInterface {
  name = 'AddStageToEmailChangeRequest1789600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "email_change_request" ADD COLUMN IF NOT EXISTS "stage" character varying(16) NOT NULL DEFAULT 'new'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "email_change_request" DROP COLUMN IF EXISTS "stage"`,
    );
  }
}
