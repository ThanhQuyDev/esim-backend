import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * doitac-0911 #008 — "Gửi email đối soát" on each partner, for every type.
 * Ticked from the start for whoever receives a statement today, so nobody
 * stops getting one: marketing partners, distribution partners running the
 * affiliate programme (commission statement), and those buying on credit
 * (the monthly credit statement, vande #056).
 */
export class PartnerSendReconciliationEmail1805100000000 implements MigrationInterface {
  name = 'PartnerSendReconciliationEmail1805100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "partner" ADD COLUMN IF NOT EXISTS "sendReconciliationEmail" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `UPDATE "partner"
          SET "sendReconciliationEmail" = true
        WHERE "partnerType" = 'kol'
           OR "canAffiliate" = true
           OR "noDepositRequired" = true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "partner" DROP COLUMN IF EXISTS "sendReconciliationEmail"`,
    );
  }
}
