import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * #009 — Every plan carries its cost and retail price in USD too, whatever
 * currency its supplier quotes.
 *
 * `usdPrice` already did this for the selling price. `costPrice` and
 * `retailPrice` stayed in the supplier's own currency, so a Viettel plan
 * reported đồng where a dollar figure was expected and any total mixing
 * suppliers was meaningless.
 */
export class AddUsdCostAndRetailPriceToPlan1793800000000 implements MigrationInterface {
  name = 'AddUsdCostAndRetailPriceToPlan1793800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "plan" ADD "usdCostPrice" numeric(12,2) NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "plan" ADD "usdRetailPrice" numeric(12,2) NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "plan" ADD "vndCostPrice" bigint NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "plan" ADD "vndRetailPrice" bigint NOT NULL DEFAULT '0'`,
    );

    // Seed the dollar-quoted suppliers straight away; the VND side and the
    // local-inventory rows are filled by the next exchange-rate pass, which
    // needs a live rate this migration has no way to fetch.
    await queryRunner.query(`
      UPDATE "plan"
      SET "usdCostPrice" = "costPrice", "usdRetailPrice" = "retailPrice"
      WHERE "deletedAt" IS NULL
        AND "isLocalInventory" IS NOT TRUE
        AND "currency" <> 'VND'
    `);
    await queryRunner.query(`
      UPDATE "plan"
      SET "vndCostPrice" = ROUND("costPrice"), "vndRetailPrice" = ROUND("retailPrice")
      WHERE "deletedAt" IS NULL
        AND ("isLocalInventory" = true OR "currency" = 'VND')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "plan" DROP COLUMN "vndRetailPrice"`);
    await queryRunner.query(`ALTER TABLE "plan" DROP COLUMN "vndCostPrice"`);
    await queryRunner.query(`ALTER TABLE "plan" DROP COLUMN "usdRetailPrice"`);
    await queryRunner.query(`ALTER TABLE "plan" DROP COLUMN "usdCostPrice"`);
  }
}
