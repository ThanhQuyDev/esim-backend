import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A partner asking esim.vn to bring a deleted link back (doitac-1410 #019):
 * after 30 days, or from the second restore on, a person decides.
 */
export class PartnerLinkRestoreRequest1797600000000 implements MigrationInterface {
  name = 'PartnerLinkRestoreRequest1797600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "partner_link"
        ADD COLUMN IF NOT EXISTS "restoreRequestedAt" timestamptz,
        ADD COLUMN IF NOT EXISTS "restoreRequestReason" varchar(1000)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "partner_link"
        DROP COLUMN IF EXISTS "restoreRequestedAt",
        DROP COLUMN IF EXISTS "restoreRequestReason"`);
  }
}
