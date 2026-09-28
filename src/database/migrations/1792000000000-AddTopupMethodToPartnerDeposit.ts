import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * How a partner topped up, and what actually reached the wallet (#047).
 *
 * Topping up by bank transfer costs the partner nothing, so the amount they
 * send is the amount they get. Paying by card goes through OnePay, which
 * charges, and the brief puts that cost on the partner: send 100.000đ by card
 * and 94.000đ lands in the wallet. Two different numbers, so the row has to
 * carry both — the amount asked for, the fee taken, and the amount credited.
 */
export class AddTopupMethodToPartnerDeposit1792000000000 implements MigrationInterface {
  name = 'AddTopupMethodToPartnerDeposit1792000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "partner_deposit_request" ADD COLUMN IF NOT EXISTS "method" character varying(20) NOT NULL DEFAULT 'bank_transfer'`,
    );
    await queryRunner.query(
      `ALTER TABLE "partner_deposit_request" ADD COLUMN IF NOT EXISTS "feeVnd" numeric(14,0) NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "partner_deposit_request" ADD COLUMN IF NOT EXISTS "creditedVnd" numeric(14,0)`,
    );
    await queryRunner.query(
      `ALTER TABLE "partner_deposit_request" ADD COLUMN IF NOT EXISTS "paymentId" character varying(64)`,
    );

    // Every existing top-up was a bank transfer, which costs nothing: what was
    // sent is what was credited.
    await queryRunner.query(
      `UPDATE "partner_deposit_request" SET "creditedVnd" = "amountVnd" WHERE "creditedVnd" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "partner_deposit_request" DROP COLUMN IF EXISTS "paymentId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "partner_deposit_request" DROP COLUMN IF EXISTS "creditedVnd"`,
    );
    await queryRunner.query(
      `ALTER TABLE "partner_deposit_request" DROP COLUMN IF EXISTS "feeVnd"`,
    );
    await queryRunner.query(
      `ALTER TABLE "partner_deposit_request" DROP COLUMN IF EXISTS "method"`,
    );
  }
}
