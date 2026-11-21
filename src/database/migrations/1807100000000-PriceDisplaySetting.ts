import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * How the storefront shows a struck-out price on a plan that has no discount
 * of its own (vande-2011 #012, decided 22/11): the struck-out price is set so
 * the badge reads this percent. 0 turns it off. One row, edited in the admin
 * on the profit-margin page.
 */
export class PriceDisplaySetting1807100000000 implements MigrationInterface {
  name = 'PriceDisplaySetting1807100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "price_display_setting" (
        "id" integer PRIMARY KEY DEFAULT 1 CHECK ("id" = 1),
        "autoStrikePercent" integer NOT NULL DEFAULT 0
          CHECK ("autoStrikePercent" >= 0 AND "autoStrikePercent" <= 90),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )`);
    await queryRunner.query(`
      INSERT INTO "price_display_setting" ("id", "autoStrikePercent")
      VALUES (1, 50) ON CONFLICT ("id") DO NOTHING`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "price_display_setting"`);
  }
}
