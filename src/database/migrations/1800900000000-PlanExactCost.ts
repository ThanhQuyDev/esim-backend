import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Cost after the supplier's tax/fee, unrounded (vande #064), for choosing the
 * cheapest plan. The đồng-quoted plans are filled here; the dollar-quoted ones
 * need the exchange rate and are filled by the next rate job — until then the
 * comparison falls back to the rounded figure, as before.
 */
export class PlanExactCost1800900000000 implements MigrationInterface {
  name = 'PlanExactCost1800900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "plan" ADD COLUMN IF NOT EXISTS "vndCostExact" numeric(18,4)`,
    );
    await queryRunner.query(
      `UPDATE "plan" SET "vndCostExact" =
         "costPrice" * (1 + COALESCE((SELECT s."percentage" FROM "provider_surcharge" s
                                       WHERE s."provider" = "plan"."provider"), 0) / 100)
       WHERE "deletedAt" IS NULL
         AND ("isLocalInventory" = true OR "currency" = 'VND')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "plan" DROP COLUMN IF EXISTS "vndCostExact"`,
    );
  }
}
