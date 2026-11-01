import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Days bought on a day-pass top-up (doitac-3010 #050): an eSIM Access
 * "1 GB/ngày" package topped up for N days, sent to the supplier as
 * `periodNum` like a new day-pass order.
 */
export class OrderTopupPeriodNum1803500000000 implements MigrationInterface {
  name = 'OrderTopupPeriodNum1803500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "topupPeriodNum" int`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "order" DROP COLUMN IF EXISTS "topupPeriodNum"`,
    );
  }
}
