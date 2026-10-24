import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Viettel orders still reading "$0.00" in the order list (vande #005).
 *
 * Before the plans got USD columns, a local-inventory line stored its plan's
 * đồng price in `price` (e.g. 278 400) labelled "VND", and the order total
 * left it out. `1795900000000` fixed the lines that already held dollars
 * (`price < 1000`) and skipped these — 38 paid orders on production from
 * 28/06 to 17/10 still showed $0.00.
 *
 * Each such line is converted at its plan's own đồng-to-dollar ratio
 * (`vndPrice / usdPrice`, ~25 800), the order total gains it less the share
 * of the coupon the order took (same rule as `1795900000000`), and both are
 * labelled USD. Only lines still labelled VND with a đồng-sized price are
 * touched, so a second run changes nothing.
 */
export class BackfillLocalVndLinesToUsd1799400000000 implements MigrationInterface {
  name = 'BackfillLocalVndLinesToUsd1799400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TEMP TABLE "_vnd_lines" ON COMMIT DROP AS
      SELECT oi.id,
             oi."orderId",
             oi.quantity,
             ROUND((oi.price / COALESCE(
               NULLIF(p."vndPrice", 0)::numeric / NULLIF(p."usdPrice", 0)::numeric,
               25500))::numeric, 2) AS usd
        FROM "order_item" oi
        JOIN "plan" p ON p.id = oi."planId"
       WHERE p."isLocalInventory" = true
         AND oi.currency = 'VND'
         AND oi.price >= 1000
    `);

    await queryRunner.query(`
      UPDATE "order" o
         SET "totalAmount" = ROUND((o."totalAmount" + l.usd * (1 - CASE
               WHEN o."subtotalVndPrice" > 0
               THEN LEAST(o."couponDiscountVndAmount" + o."referralDiscountVndAmount", o."subtotalVndPrice")::numeric / o."subtotalVndPrice"
               ELSE 0 END))::numeric, 2),
             currency = 'USD'
        FROM (SELECT "orderId", SUM(usd * quantity) AS usd
                FROM "_vnd_lines" GROUP BY "orderId") l
       WHERE l."orderId" = o.id
         AND o."orderType" <> 'TOPUP'
    `);

    await queryRunner.query(`
      UPDATE "order_item" oi
         SET price = l.usd,
             currency = 'USD'
        FROM "_vnd_lines" l
       WHERE l.id = oi.id
    `);
  }

  public async down(): Promise<void> {
    // The $0.00 totals were the bug; there is nothing worth restoring.
  }
}
