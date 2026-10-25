import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * "Nạp tiền thủ công" (vande #068/#069): a partner whose top-ups an admin
 * confirms, and what such a top-up carries — the memo, a note and the proof.
 * Every existing partner stays on automatic, which is how they work today.
 */
export class PartnerManualDeposit1801100000000 implements MigrationInterface {
  name = 'PartnerManualDeposit1801100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "partner" ADD COLUMN IF NOT EXISTS "depositMode" character varying(10) NOT NULL DEFAULT 'auto'`,
    );
    await queryRunner.query(
      `ALTER TABLE "partner_deposit_request" ADD COLUMN IF NOT EXISTS "transferContent" character varying(200)`,
    );
    await queryRunner.query(
      `ALTER TABLE "partner_deposit_request" ADD COLUMN IF NOT EXISTS "partnerNote" character varying(1000)`,
    );
    await queryRunner.query(
      `ALTER TABLE "partner_deposit_request" ADD COLUMN IF NOT EXISTS "proofFiles" jsonb NOT NULL DEFAULT '[]'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "partner_deposit_request" DROP COLUMN IF EXISTS "proofFiles"`,
    );
    await queryRunner.query(
      `ALTER TABLE "partner_deposit_request" DROP COLUMN IF EXISTS "partnerNote"`,
    );
    await queryRunner.query(
      `ALTER TABLE "partner_deposit_request" DROP COLUMN IF EXISTS "transferContent"`,
    );
    await queryRunner.query(
      `ALTER TABLE "partner" DROP COLUMN IF EXISTS "depositMode"`,
    );
  }
}
