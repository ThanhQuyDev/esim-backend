import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Marks eSIM Access packages whose exit IP is local rather than routed through
 * Hong Kong (#041).
 *
 * The provider spells this out in the package name — "Indonesia 5GB 30Days
 * (nonhkip)" — but our plan name and slug are rebuilt from location + data +
 * duration, so the flag was thrown away at sync time and the storefront had no
 * way to tell the two variants apart. Customers who need TikTok or ChatGPT to
 * work care about exactly this.
 */
export class AddIsNonHkIpToPlan1788024800000 implements MigrationInterface {
  name = 'AddIsNonHkIpToPlan1788024800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "plan" ADD COLUMN IF NOT EXISTS "isNonHkIp" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_plan_isNonHkIp" ON "plan" ("isNonHkIp")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_plan_isNonHkIp"`);
    await queryRunner.query(`ALTER TABLE "plan" DROP COLUMN "isNonHkIp"`);
  }
}
