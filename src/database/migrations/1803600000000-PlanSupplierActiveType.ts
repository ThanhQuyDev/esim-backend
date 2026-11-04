import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * eSIM Access's `activeType` (vande-0411 #007): when a plan's validity starts.
 * 1 = on install, 2 = on first connection, 3 = right after purchase, and a
 * type 3 plan cannot be refunded. Filled by the next catalogue sync.
 */
export class PlanSupplierActiveType1803600000000 implements MigrationInterface {
  name = 'PlanSupplierActiveType1803600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "plan" ADD COLUMN IF NOT EXISTS "supplierActiveType" int`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "plan" DROP COLUMN IF EXISTS "supplierActiveType"`,
    );
  }
}
