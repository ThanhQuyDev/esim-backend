import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The five destinations of each tab the home page shows on a phone, picked by
 * the admin instead of the first five featured ones (vande-1411 #021). Null
 * means not picked; nothing is picked to begin with, so the phone keeps showing
 * the first five until the admin chooses.
 */
export class MobileHomeRank1806000000000 implements MigrationInterface {
  name = 'MobileHomeRank1806000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "destination" ADD COLUMN IF NOT EXISTS "mobileHomeRank" smallint`,
    );
    await queryRunner.query(
      `ALTER TABLE "region" ADD COLUMN IF NOT EXISTS "mobileHomeRank" smallint`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "region" DROP COLUMN IF EXISTS "mobileHomeRank"`,
    );
    await queryRunner.query(
      `ALTER TABLE "destination" DROP COLUMN IF EXISTS "mobileHomeRank"`,
    );
  }
}
