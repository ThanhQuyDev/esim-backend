import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The buyer's device on an order (doitac-1410 #082, #083): the browser's
 * user-agent, and desktop / mobile / tablet for the overview chart. Orders
 * placed before this stay empty.
 */
export class OrderDevice1799000000000 implements MigrationInterface {
  name = 'OrderDevice1799000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "userAgent" varchar(500)`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "deviceType" varchar(16)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_order_deviceType" ON "order" ("deviceType")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_order_deviceType"`);
    await queryRunner.query(
      `ALTER TABLE "order" DROP COLUMN IF EXISTS "deviceType"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" DROP COLUMN IF EXISTS "userAgent"`,
    );
  }
}
