import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Raw clicks and valid clicks (doitac-3010 #018, rule 2). A click is valid
 * once its landing page confirmed it was really shown. Clicks from before
 * this change cannot be told apart any more, so they count as valid — the
 * drop rate starts from the deploy.
 */
export class PartnerLinkValidClick1802700000000 implements MigrationInterface {
  name = 'PartnerLinkValidClick1802700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "partner_link_click" ADD COLUMN IF NOT EXISTS "confirmedAt" TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "partner_link" ADD COLUMN IF NOT EXISTS "validClickCount" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `UPDATE "partner_link_click" SET "confirmedAt" = "clickedAt"
        WHERE "confirmedAt" IS NULL`,
    );
    await queryRunner.query(
      `UPDATE "partner_link" SET "validClickCount" = "clickCount"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "partner_link" DROP COLUMN IF EXISTS "validClickCount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "partner_link_click" DROP COLUMN IF EXISTS "confirmedAt"`,
    );
  }
}
