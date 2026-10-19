import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Refund support set by hand on a plan (doitac-1410 #080). Null = by the rule
 * in `plan-refund-policy.ts`.
 */
export class PlanRefundableOverride1798900000000 implements MigrationInterface {
  name = 'PlanRefundableOverride1798900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "plan" ADD COLUMN IF NOT EXISTS "refundableOverride" boolean`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "plan" DROP COLUMN IF EXISTS "refundableOverride"`,
    );
  }
}
