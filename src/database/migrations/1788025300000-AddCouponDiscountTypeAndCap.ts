import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Flat-amount codes and a ceiling on percentage ones (#082).
 *
 * Coupons could only be a percentage, with nothing to stop them: "15% off" on
 * a five-million-dong order handed back 750k. Admins asked for the two shapes
 * every shop uses — "50k off" and "15% off, up to 50k".
 *
 * Amounts are VND, the same currency `minOrderAmount` is compared in and the
 * currency the cart validates against.
 */
export class AddCouponDiscountTypeAndCap1788025300000 implements MigrationInterface {
  name = 'AddCouponDiscountTypeAndCap1788025300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "coupon" ADD COLUMN IF NOT EXISTS "discountType" character varying(16) NOT NULL DEFAULT 'percent'`,
    );
    await queryRunner.query(
      `ALTER TABLE "coupon" ADD COLUMN IF NOT EXISTS "discountAmount" numeric(12,2) NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "coupon" ADD COLUMN IF NOT EXISTS "maxDiscountAmount" numeric(12,2)`,
    );

    // Existing codes are all percentages, which is the column default — no
    // backfill needed, and every one of them stays uncapped as it is today.
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "coupon" DROP COLUMN "maxDiscountAmount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "coupon" DROP COLUMN "discountAmount"`,
    );
    await queryRunner.query(`ALTER TABLE "coupon" DROP COLUMN "discountType"`);
  }
}
