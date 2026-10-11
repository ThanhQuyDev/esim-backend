import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * #066 (test round 4) — the perks of a domestic eSIM plan (minutes by network,
 * first-cycle data, free social data, renewal fee, cycle length…) from the new
 * domestic import template. One JSON column: only domestic plans have it.
 */
export class PlanDomesticOffer1796900000000 implements MigrationInterface {
  name = 'PlanDomesticOffer1796900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "plan" ADD COLUMN IF NOT EXISTS "domesticOffer" jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "plan" DROP COLUMN IF EXISTS "domesticOffer"`,
    );
  }
}
