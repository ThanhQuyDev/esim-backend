import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * #066 (test round 4) — `plan.costPrice` was numeric(10,4): at most 999.999,9999
 * đồng. A 12-month domestic eSIM costs over 10 million, so importing it failed
 * with "numeric field overflow". Same scale, more whole digits.
 */
export class WidenPlanCostPrice1797000000000 implements MigrationInterface {
  name = 'WidenPlanCostPrice1797000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "plan" ALTER COLUMN "costPrice" TYPE numeric(14,4)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "plan" ALTER COLUMN "costPrice" TYPE numeric(10,4)`,
    );
  }
}
