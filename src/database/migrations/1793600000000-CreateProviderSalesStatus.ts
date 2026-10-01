import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * #005 — Let an admin switch one supplier off, which hides every eSIM plan of
 * that supplier from the storefront in one action (used when a supplier breaks
 * badly mid-day).
 *
 * Two pieces:
 *  • `provider_sales_status` — one row per supplier slug, absent means "selling".
 *  • `plan.disabledByProvider` — marks the plans THIS switch deactivated, so
 *    switching the supplier back on restores exactly those and leaves plans an
 *    admin had deactivated by hand still deactivated.
 */
export class CreateProviderSalesStatus1793600000000 implements MigrationInterface {
  name = 'CreateProviderSalesStatus1793600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "provider_sales_status" (
        "provider" character varying(64) NOT NULL,
        "isEnabled" boolean NOT NULL DEFAULT true,
        "disabledReason" character varying(500),
        "disabledAt" TIMESTAMP,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_provider_sales_status" PRIMARY KEY ("provider")
      )
    `);
    await queryRunner.query(
      `ALTER TABLE "plan" ADD "disabledByProvider" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_plan_disabled_by_provider" ON "plan" ("disabledByProvider")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_plan_disabled_by_provider"`);
    await queryRunner.query(
      `ALTER TABLE "plan" DROP COLUMN "disabledByProvider"`,
    );
    await queryRunner.query(`DROP TABLE "provider_sales_status"`);
  }
}
