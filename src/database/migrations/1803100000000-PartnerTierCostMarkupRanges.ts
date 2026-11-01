import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A tier's markup by cost band, like the admin's Profit Margin Tier
 * (doitac-3010 #040). Empty keeps the flat `costMarkupPercent`.
 */
export class PartnerTierCostMarkupRanges1803100000000 implements MigrationInterface {
  name = 'PartnerTierCostMarkupRanges1803100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "partner_tier" ADD COLUMN IF NOT EXISTS "costMarkupRanges" jsonb NOT NULL DEFAULT '[]'::jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "partner_tier" DROP COLUMN IF EXISTS "costMarkupRanges"`,
    );
  }
}
