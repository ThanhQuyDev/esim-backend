import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * "Từ chối" a deposit request (doitac-1410 #063): the reason the partner reads
 * in their deposit history, who refused it and when. Nothing reaches the
 * wallet, and like a confirmation it cannot be undone.
 */
export class PartnerDepositReject1798600000000 implements MigrationInterface {
  name = 'PartnerDepositReject1798600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "partner_deposit_request"
        ADD COLUMN IF NOT EXISTS "rejectionReason" varchar(500) NULL,
        ADD COLUMN IF NOT EXISTS "rejectedByAdminId" integer NULL,
        ADD COLUMN IF NOT EXISTS "rejectedAt" timestamp NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "partner_deposit_request"
        DROP COLUMN IF EXISTS "rejectionReason",
        DROP COLUMN IF EXISTS "rejectedByAdminId",
        DROP COLUMN IF EXISTS "rejectedAt"`);
  }
}
