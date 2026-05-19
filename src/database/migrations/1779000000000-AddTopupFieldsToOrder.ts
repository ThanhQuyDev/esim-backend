import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Extend the `order` table to support multi-provider Topup orders alongside
 * BUY_NEW orders.
 *
 * - `orderType`: `BUY_NEW` (default) | `TOPUP`
 * - `targetIccid`: only set when `orderType = 'TOPUP'`; the eSIM being topped up
 * - `topupProvider`: cached provider for fast IPN routing without joining `esim`
 * - `topupPackageId`: the provider-specific package identifier submitted at IPN time
 */
export class AddTopupFieldsToOrder1779000000000 implements MigrationInterface {
  name = 'AddTopupFieldsToOrder1779000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "orderType" character varying NOT NULL DEFAULT 'BUY_NEW'`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "targetIccid" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "topupProvider" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "topupPackageId" character varying`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_order_orderType" ON "order" ("orderType")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_order_targetIccid" ON "order" ("targetIccid")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_order_targetIccid"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_order_orderType"`);
    await queryRunner.query(
      `ALTER TABLE "order" DROP COLUMN IF EXISTS "topupPackageId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" DROP COLUMN IF EXISTS "topupProvider"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" DROP COLUMN IF EXISTS "targetIccid"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" DROP COLUMN IF EXISTS "orderType"`,
    );
  }
}
