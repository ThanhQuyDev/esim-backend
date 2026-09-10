import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Public vs. private discount codes (#081).
 *
 * `GET /coupons` is an unauthenticated endpoint and the cart page lists
 * everything it returns, so every code ever created was advertised to every
 * shopper — including codes meant for one campaign, one customer, or one
 * partner. A code you cannot keep off the cart page is not a private code.
 *
 * Existing rows default to public, which is what the site does today, with one
 * exception: a partner (KOL) code belongs to that partner's audience and was
 * never ours to hand out, so those start private.
 */
export class AddIsPublicToCoupon1788025200000 implements MigrationInterface {
  name = 'AddIsPublicToCoupon1788025200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "coupon" ADD COLUMN IF NOT EXISTS "isPublic" boolean NOT NULL DEFAULT true`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_coupon_isPublic" ON "coupon" ("isPublic")`,
    );
    await queryRunner.query(
      `UPDATE "coupon" SET "isPublic" = false WHERE "partnerId" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_coupon_isPublic"`);
    await queryRunner.query(`ALTER TABLE "coupon" DROP COLUMN "isPublic"`);
  }
}
