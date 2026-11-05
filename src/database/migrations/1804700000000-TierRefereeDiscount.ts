import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * What the friend gets off their first order, per tier of whoever referred them
 * (vande-0411 #056). Every tier starts at the 10,000đ it has always been.
 */
export class TierRefereeDiscount1804700000000 implements MigrationInterface {
  name = 'TierRefereeDiscount1804700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "membership_tier_config" ADD COLUMN IF NOT EXISTS "refereeDiscountVnd" bigint NOT NULL DEFAULT 10000`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "membership_tier_config" DROP COLUMN IF EXISTS "refereeDiscountVnd"`,
    );
  }
}
