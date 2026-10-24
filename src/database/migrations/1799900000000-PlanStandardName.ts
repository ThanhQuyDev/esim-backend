import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The plan's name under the one naming rule (vande #020) — "Vietnam - Total
 * 5 GB - 7 days" — next to the supplier's own in `name`. Filled by the app on
 * start (PlansService.onApplicationBootstrap) and on every create, update and
 * sync, since the rule lives in TypeScript (standard-plan-name.ts).
 */
export class PlanStandardName1799900000000 implements MigrationInterface {
  name = 'PlanStandardName1799900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "plan" ADD COLUMN IF NOT EXISTS "standardName" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "plan" DROP COLUMN "standardName"`);
  }
}
