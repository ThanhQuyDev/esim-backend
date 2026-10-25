import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tiers are reviewed per calendar month (vande #053): the revenue of month n
 * decides the tier for month n+1. Each review row records which month it was
 * made on, so the review never runs twice for the same month and the partner
 * portal can say "Tháng 10/2026" instead of a bare date.
 */
export class TierEvaluationPeriod1800400000000 implements MigrationInterface {
  name = 'TierEvaluationPeriod1800400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "partner_tier_evaluation" ADD COLUMN IF NOT EXISTS "period" character varying`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_partner_tier_evaluation_period" ON "partner_tier_evaluation" ("period")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_partner_tier_evaluation_period"`,
    );
    await queryRunner.query(
      `ALTER TABLE "partner_tier_evaluation" DROP COLUMN IF EXISTS "period"`,
    );
  }
}
