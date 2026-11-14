import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * SePay personal or company account per partner (vande-1411 #046), and which
 * one each order and deposit request's QR named, so the webhook can tell.
 */
export class SepayAccountPerPartner1806600000000 implements MigrationInterface {
  name = 'SepayAccountPerPartner1806600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "partner" ADD COLUMN IF NOT EXISTS "sepayAccount" varchar(16) NOT NULL DEFAULT 'personal'`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "sepayAccount" varchar(16)`,
    );
    await queryRunner.query(
      `ALTER TABLE "partner_deposit_request" ADD COLUMN IF NOT EXISTS "sepayAccount" varchar(16)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "partner_deposit_request" DROP COLUMN IF EXISTS "sepayAccount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" DROP COLUMN IF EXISTS "sepayAccount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "partner" DROP COLUMN IF EXISTS "sepayAccount"`,
    );
  }
}
