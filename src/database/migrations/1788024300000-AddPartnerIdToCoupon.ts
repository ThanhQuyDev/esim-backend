import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A discount code owned by a partner (KOL). The code behaves like any other
 * coupon for the buyer; owning it lets the partner see its performance in their
 * portal. Commission on an order that used it is still calculated on the value
 * AFTER the discount — see OrdersService.createPendingCommissionIfAttributed.
 *
 * Nullable: house-wide coupons have no owner.
 */
export class AddPartnerIdToCoupon1788024300000 implements MigrationInterface {
  name = 'AddPartnerIdToCoupon1788024300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "coupon" ADD COLUMN IF NOT EXISTS "partnerId" integer`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_coupon_partnerId" ON "coupon" ("partnerId")`,
    );
    await queryRunner.query(`
      ALTER TABLE "coupon"
        ADD CONSTRAINT "FK_coupon_partner"
        FOREIGN KEY ("partnerId") REFERENCES "partner"("id") ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "coupon" DROP CONSTRAINT IF EXISTS "FK_coupon_partner"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_coupon_partnerId"`);
    await queryRunner.query(
      `ALTER TABLE "coupon" DROP COLUMN IF EXISTS "partnerId"`,
    );
  }
}
