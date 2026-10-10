import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * #053 (test round 4) — keep the partnership an applicant picked on the
 * sign-up form (tiếp thị / phân phối / tích hợp API). Existing partners get
 * the type they already run as.
 */
export class PartnerRequestedType1796800000000 implements MigrationInterface {
  name = 'PartnerRequestedType1796800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "partner" ADD COLUMN IF NOT EXISTS "requestedType" character varying`,
    );
    await queryRunner.query(
      `UPDATE "partner" SET "requestedType" = "partnerType" WHERE "requestedType" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "partner" DROP COLUMN IF EXISTS "requestedType"`,
    );
  }
}
