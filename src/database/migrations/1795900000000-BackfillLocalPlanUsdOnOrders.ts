import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Dollar totals of orders that hold local inventory (Viettel, iTel…) (#017,
 * test round 4).
 *
 * Checkout left those lines out of `order.totalAmount` and labelled them
 * "VND" although their `price` was already dollars, so a Viettel-only order
 * read $0.00 in the order list and a mixed order came up short. Code now
 * counts them; this puts the existing orders right:
 *
 * - the order total gains each local line's dollars, less the share of the
 *   coupon the order took (the USD discount was worked out on the other lines
 *   only), and the order is labelled USD;
 * - the local lines are labelled USD.
 *
 * Only lines still labelled VND are touched — that is the marker of an order
 * not yet corrected, so running this twice changes nothing the second time.
 */
export class BackfillLocalPlanUsdOnOrders1795900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      WITH local_lines AS (
        SELECT oi."orderId", SUM(oi.price * oi.quantity) AS usd
          FROM "order_item" oi
          JOIN "plan" p ON p.id = oi."planId"
         WHERE p."isLocalInventory" = true
           AND oi.currency = 'VND'
           AND oi.price < 1000
         GROUP BY oi."orderId"
      )
      UPDATE "order" o
         SET "totalAmount" = ROUND((o."totalAmount" + l.usd * (1 - CASE
               WHEN o."subtotalVndPrice" > 0
               THEN LEAST(o."couponDiscountVndAmount" + o."referralDiscountVndAmount", o."subtotalVndPrice")::numeric / o."subtotalVndPrice"
               ELSE 0 END))::numeric, 2),
             currency = 'USD'
        FROM local_lines l
       WHERE l."orderId" = o.id
         AND o."orderType" <> 'TOPUP'
    `);

    await queryRunner.query(`
      UPDATE "order_item" oi
         SET currency = 'USD'
        FROM "plan" p
       WHERE p.id = oi."planId"
         AND p."isLocalInventory" = true
         AND oi.currency = 'VND'
         AND oi.price < 1000
    `);
  }

  public async down(): Promise<void> {
    // The old figures were wrong; there is nothing worth restoring.
  }
}
