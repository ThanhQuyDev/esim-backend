import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Old orders whose cost was kept without the supplier's tax/fee
 * (vande-1411 #006). The order page showed that cost and the overview counted
 * the fee as profit.
 *
 * Only a line whose cost matches the plan's cost WITHOUT the fee (within 3%,
 * the exchange rate moving between then and now) and not WITH it is raised by
 * the fee; a line that matches neither — its plan's price changed since — is
 * left as it is. The order's own cost is then the sum of its lines again.
 * The lines raised are kept in `order_item_cost_fix_1411`, so `down` can put
 * them back.
 */
export class OrderCostWithSurcharge1805800000000 implements MigrationInterface {
  name = 'OrderCostWithSurcharge1805800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "order_item_cost_fix_1411" (
        "orderItemId" integer PRIMARY KEY,
        "orderId" integer NOT NULL,
        "oldCost" numeric NOT NULL,
        "newCost" numeric NOT NULL,
        "oldOrderCost" numeric
      )`);
    await queryRunner.query(`
      INSERT INTO "order_item_cost_fix_1411"
             ("orderItemId", "orderId", "oldCost", "newCost", "oldOrderCost")
      SELECT x.id, x."orderId", x.stored,
             ROUND(x.stored * (1 + x.pct / 100)), o."vndCostPrice"
        FROM (
          SELECT oi.id, oi."orderId", s.percentage AS pct,
                 oi."vndCostPrice" AS stored,
                 ROUND(p."vndCostExact" *
                   (CASE WHEN p."isAbleMultidate"
                         THEN GREATEST(1, ROUND(COALESCE(oi."periodNum", 1)))
                         ELSE 1 END)) * oi.quantity AS with_fee
            FROM order_item oi
            JOIN plan p ON p.id = oi."planId"
            JOIN provider_surcharge s ON s.provider = lower(p.provider)
           WHERE s.percentage > 0 AND p."vndCostExact" > 0
             AND oi."vndCostPrice" > 0
        ) x
        JOIN "order" o ON o.id = x."orderId"
       WHERE abs(x.stored - x.with_fee / (1 + x.pct / 100))
               <= 0.03 * x.with_fee / (1 + x.pct / 100)
         AND abs(x.stored - x.with_fee) > 0.03 * x.with_fee
      ON CONFLICT ("orderItemId") DO NOTHING`);
    await queryRunner.query(`
      UPDATE order_item oi SET "vndCostPrice" = f."newCost"
        FROM "order_item_cost_fix_1411" f
       WHERE f."orderItemId" = oi.id AND oi."vndCostPrice" = f."oldCost"`);
    await queryRunner.query(`
      UPDATE "order" o SET "vndCostPrice" = t.total
        FROM (SELECT oi."orderId", SUM(oi."vndCostPrice") AS total
                FROM order_item oi
               WHERE oi."orderId" IN (SELECT "orderId" FROM "order_item_cost_fix_1411")
               GROUP BY oi."orderId") t
       WHERE t."orderId" = o.id`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE order_item oi SET "vndCostPrice" = f."oldCost"
        FROM "order_item_cost_fix_1411" f
       WHERE f."orderItemId" = oi.id`);
    await queryRunner.query(`
      UPDATE "order" o SET "vndCostPrice" = f."oldOrderCost"
        FROM (SELECT DISTINCT ON ("orderId") "orderId", "oldOrderCost"
                FROM "order_item_cost_fix_1411") f
       WHERE f."orderId" = o.id AND f."oldOrderCost" IS NOT NULL`);
    await queryRunner.query(`DROP TABLE IF EXISTS "order_item_cost_fix_1411"`);
  }
}
