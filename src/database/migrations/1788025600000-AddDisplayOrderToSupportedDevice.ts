import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Admin-controlled order for the supported-devices list (#090).
 *
 * The public list is sorted alphabetically — brand A–Z, model A–Z — so Apple
 * always leads and, inside Apple, "iPhone 11" sits above "iPhone 17". There was
 * no way to put the phones people actually search for at the top.
 *
 * Two numbers per row: `manufacturerOrder` places the brand block, `sortOrder`
 * places the model inside it. Both default to 0, and 0 means "fall back to
 * alphabetical" — so nothing moves until an admin says so.
 */
export class AddDisplayOrderToSupportedDevice1788025600000 implements MigrationInterface {
  name = 'AddDisplayOrderToSupportedDevice1788025600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "supported_device" ADD COLUMN IF NOT EXISTS "manufacturerOrder" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "supported_device" ADD COLUMN IF NOT EXISTS "sortOrder" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_supported_device_order" ON "supported_device" ("type", "manufacturerOrder", "manufacturer", "sortOrder")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_supported_device_order"`,
    );
    await queryRunner.query(
      `ALTER TABLE "supported_device" DROP COLUMN "sortOrder"`,
    );
    await queryRunner.query(
      `ALTER TABLE "supported_device" DROP COLUMN "manufacturerOrder"`,
    );
  }
}
