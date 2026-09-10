import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A USD price every plan can be trusted to have (#037).
 *
 * `plan.price` is USD for API suppliers but VND for local inventory (Viettel
 * and friends are imported from a spreadsheet priced in đồng), so anything
 * reading `price` as dollars got a number ~25,000x too large for those plans.
 * `usdPrice` is always dollars; the hourly exchange-rate job keeps it in step.
 */
export class AddUsdPriceToPlan1788024700000 implements MigrationInterface {
  name = 'AddUsdPriceToPlan1788024700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "plan" ADD COLUMN IF NOT EXISTS "usdPrice" decimal(12,2) NOT NULL DEFAULT 0`,
    );

    // Backfill what we can without an exchange rate: non-local plans already
    // carry dollars in `price`. Local plans are filled by the hourly job.
    await queryRunner.query(
      `UPDATE "plan" SET "usdPrice" = "price" WHERE "isLocalInventory" IS NOT TRUE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "plan" DROP COLUMN "usdPrice"`);
  }
}
