import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * "Tỷ lệ trên giá trị đơn" to four decimals (vande #007).
 *
 * With the partner's own code the commission is r x V - D and the rate shown
 * is that over V. It was stored at three decimals after being rounded to two
 * (384 200 / 2 121 000 -> 18.110), so the rate times the order value missed
 * the commission paid by a few hundred đồng. The column now keeps four
 * decimals, and rows of orders that used the partner's own code are worked out
 * again from what was earned: (commission + reversed) / (order value + own
 * discount). Rows without an own code keep the tier rate they hold.
 */
export class CommissionPercentFourDecimals1799500000000 implements MigrationInterface {
  name = 'CommissionPercentFourDecimals1799500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "order_partner_commission" ALTER COLUMN "commissionPercentSnapshot" TYPE numeric(8,4)`,
    );
    await queryRunner.query(`
      UPDATE "order_partner_commission" c
         SET "commissionPercentSnapshot" = ROUND(
               ((c."commissionVnd" + COALESCE(c."reversedCommissionVnd", 0)) * 100.0
                / (COALESCE(o."eligibleSpendVnd", o."payableVndPrice", o."vndPrice", 0)
                   + o."couponDiscountVndAmount"))::numeric, 4)
        FROM "order" o, "coupon" cp
       WHERE o.id = c."orderId"
         AND o."couponDiscountVndAmount" > 0
         AND upper(cp.code) = upper(o."couponCode")
         AND cp."partnerId" = c."partnerId"
         AND c."commissionVnd" + COALESCE(c."reversedCommissionVnd", 0) > 0
         AND COALESCE(o."eligibleSpendVnd", o."payableVndPrice", o."vndPrice", 0)
             + o."couponDiscountVndAmount" > 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "order_partner_commission" ALTER COLUMN "commissionPercentSnapshot" TYPE numeric(6,3)`,
    );
  }
}
