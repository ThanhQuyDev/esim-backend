import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Documents attached to a partner application (doitac-1410 #013): a business
 * licence, an ID card, a company profile. The files live outside the public
 * uploads folder; this keeps only what the admin's list needs.
 */
export class PartnerApplicationDocuments1797300000000 implements MigrationInterface {
  name = 'PartnerApplicationDocuments1797300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "partner" ADD COLUMN IF NOT EXISTS "documents" jsonb NOT NULL DEFAULT '[]'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "partner" DROP COLUMN IF EXISTS "documents"`,
    );
  }
}
