import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * What a distribution partner deposited in the month a tier review looked at
 * (doitac-3010 #030), kept beside the revenue on each review.
 */
export class PartnerTierEvaluationDeposit1803000000000 implements MigrationInterface {
  name = 'PartnerTierEvaluationDeposit1803000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "partner_tier_evaluation" ADD COLUMN IF NOT EXISTS "depositVnd" numeric(14,0) NOT NULL DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "partner_tier_evaluation" DROP COLUMN IF EXISTS "depositVnd"`,
    );
  }
}
