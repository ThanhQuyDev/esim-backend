import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * #047 (test round 4) — the activation window from every supplier.
 *
 * - `activationValidUntil`: Billion states a fixed "activate before" date on some
 *   products; filled by the next sync.
 * - Gadget Korea plans get the 180 days of their price list's Validity column
 *   (confirmed by the tester). The import already reads that column, but its
 *   updates were dropped until the #043 fix, so existing rows never got it; the
 *   next import overwrites this with whatever the sheet says.
 */
export class PlanActivationFromSuppliers1796700000000 implements MigrationInterface {
  name = 'PlanActivationFromSuppliers1796700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "plan" ADD COLUMN IF NOT EXISTS "activationValidUntil" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `UPDATE "plan" SET "activationValidityDays" = 180
        WHERE "provider" = 'gadgetkorea' AND "activationValidityDays" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "plan" DROP COLUMN IF EXISTS "activationValidUntil"`,
    );
  }
}
