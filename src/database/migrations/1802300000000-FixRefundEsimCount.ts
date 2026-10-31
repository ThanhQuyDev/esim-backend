import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * doitac-3010 #011: a refund that ended an order fully refunded recorded too
 * few eSIMs — other steps had already marked some refunded before the count
 * (ORD-261026231605039-QDNN58: 7 eSIMs refunded 1 + 2 + 4, recorded 1 + 2 + 3).
 * Where an order's refunds add up to fewer eSIMs than it has refunded, the
 * shortfall belongs to its latest refund.
 */
export class FixRefundEsimCount1802300000000 implements MigrationInterface {
  name = 'FixRefundEsimCount1802300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      WITH refunded AS (
        SELECT oi."orderId", COUNT(*)::int AS esims
          FROM esim e JOIN order_item oi ON oi.id = e."orderItemId"
         WHERE e.status = 'refunded'
         GROUP BY oi."orderId"
      ), recorded AS (
        SELECT "orderId", COALESCE(SUM("esimCount"), 0)::int AS esims,
               MAX(id) AS "lastId"
          FROM order_refund
         GROUP BY "orderId"
      )
      UPDATE order_refund r
         SET "esimCount" = COALESCE(r."esimCount", 0) + (f.esims - c.esims)
        FROM refunded f JOIN recorded c ON c."orderId" = f."orderId"
       WHERE r.id = c."lastId" AND f.esims > c.esims
    `);
  }

  public async down(): Promise<void> {
    // The earlier counts were wrong; nothing to go back to.
  }
}
