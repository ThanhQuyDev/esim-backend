import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * #044 (test round 4) — APNs added automatically from supplier plans start with
 * their app columns unknown, which is not the same as "không hỗ trợ".
 */
export class ApnSupportNeedsReview1796600000000 implements MigrationInterface {
  name = 'ApnSupportNeedsReview1796600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "apn_support" ADD COLUMN IF NOT EXISTS "needsReview" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "apn_support" DROP COLUMN IF EXISTS "needsReview"`,
    );
  }
}
