import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Billion's `accelerationSupport` on each plan (vande #081): whether data can
 * be bought on top of an eSIM later (F015/F016) — 0 no, 1 SIM, 2 eSIM, 3 both.
 * Filled by the next Billion sync.
 */
export class PlanAccelerationSupport1801800000000 implements MigrationInterface {
  name = 'PlanAccelerationSupport1801800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "plan" ADD COLUMN IF NOT EXISTS "accelerationSupport" smallint`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "plan" DROP COLUMN IF EXISTS "accelerationSupport"`,
    );
  }
}
