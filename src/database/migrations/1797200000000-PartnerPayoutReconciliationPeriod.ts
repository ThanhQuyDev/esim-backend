import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The month a withdrawal was raised for, when the system raised it on sending
 * that month's statement (doitac-1410 #012). One per partner per month, so a
 * re-run of the send cannot pay the same month twice.
 */
export class PartnerPayoutReconciliationPeriod1797200000000 implements MigrationInterface {
  name = 'PartnerPayoutReconciliationPeriod1797200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "partner_payout" ADD COLUMN IF NOT EXISTS "reconciliationPeriod" varchar(7)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_partner_payout_reconciliation_period" ON "partner_payout" ("partnerId", "reconciliationPeriod") WHERE "reconciliationPeriod" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_partner_payout_reconciliation_period"`,
    );
    await queryRunner.query(
      `ALTER TABLE "partner_payout" DROP COLUMN IF EXISTS "reconciliationPeriod"`,
    );
  }
}
