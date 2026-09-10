import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A partner's payout bank account, saved once on the profile instead of being
 * retyped as free text on every withdrawal request (`partner_payout.
 * bankAccountInfo`). The payout request keeps its own snapshot so a later
 * profile edit never rewrites the account money was already sent to.
 */
export class AddBankAccountToPartner1788024200000 implements MigrationInterface {
  name = 'AddBankAccountToPartner1788024200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "partner"
        ADD COLUMN IF NOT EXISTS "bankName" character varying,
        ADD COLUMN IF NOT EXISTS "bankAccountNumber" character varying,
        ADD COLUMN IF NOT EXISTS "bankAccountHolder" character varying,
        ADD COLUMN IF NOT EXISTS "bankBranch" character varying
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "partner"
        DROP COLUMN IF EXISTS "bankBranch",
        DROP COLUMN IF EXISTS "bankAccountHolder",
        DROP COLUMN IF EXISTS "bankAccountNumber",
        DROP COLUMN IF EXISTS "bankName"
    `);
  }
}
