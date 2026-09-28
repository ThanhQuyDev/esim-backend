import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * When a partner's tier took effect, and the rate each commission was paid at
 * (#042).
 *
 * A tier change applies from the moment it happens: orders placed after it earn
 * at the new rate, orders before it keep the old one. That is already how the
 * money works — each commission is worked out and stored when the order is
 * placed — but nothing recorded *when* a tier changed by hand, or *what rate*
 * an old commission was paid at, so a partner disputing a period had nothing to
 * be shown.
 */
export class AddTierEffectiveFromAndRateSnapshot1791900000000 implements MigrationInterface {
  name = 'AddTierEffectiveFromAndRateSnapshot1791900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "partner" ADD COLUMN IF NOT EXISTS "tierEffectiveFrom" TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_partner_commission" ADD COLUMN IF NOT EXISTS "commissionPercentSnapshot" numeric(6,3)`,
    );

    // Existing partners have been on their tier since at least their last
    // review; without a date the portal would read "since —", so the best
    // available answer is when the partner record was last touched.
    await queryRunner.query(
      `UPDATE "partner" SET "tierEffectiveFrom" = COALESCE("updatedAt", "createdAt") WHERE "tierCode" IS NOT NULL AND "tierEffectiveFrom" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "order_partner_commission" DROP COLUMN IF EXISTS "commissionPercentSnapshot"`,
    );
    await queryRunner.query(
      `ALTER TABLE "partner" DROP COLUMN IF EXISTS "tierEffectiveFrom"`,
    );
  }
}
