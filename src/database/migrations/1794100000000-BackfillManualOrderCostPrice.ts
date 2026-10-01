import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * #042 — đặt đơn hộ orders were created without a USD→VND rate, so every one of
 * them stored `vndCostPrice = 0` on the order and on each item. The order detail
 * page showed no giá vốn and the overview counted them as pure profit.
 *
 * The code no longer does that. This backfills the orders already in the table,
 * from `plan.vndCostPrice` — the plan's CURRENT cost, not the cost on the day of
 * the order, which is not recorded anywhere. For a row sitting at 0 that is
 * strictly closer to the truth; it is not applied to any row that already has a
 * figure, so nothing correct is overwritten.
 *
 * Only manual orders are touched. A normal order at 0 means something else went
 * wrong and should be looked at, not papered over.
 */
export class BackfillManualOrderCostPrice1794100000000 implements MigrationInterface {
  name = 'BackfillManualOrderCostPrice1794100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "order_item" oi
      SET "vndCostPrice" = ROUND(p."vndCostPrice" * GREATEST(oi."quantity", 1))
      FROM "order" o, "plan" p
      WHERE oi."orderId" = o.id
        AND oi."planId" = p.id
        AND COALESCE(oi."vndCostPrice", 0) = 0
        AND p."vndCostPrice" > 0
        AND (o."paymentMethod" = 'admin_manual' OR o."orderNumber" LIKE 'MAN-%')
    `);

    // The order-level figure is the sum of its items, the same way
    // `createPendingOrder` builds it.
    await queryRunner.query(`
      UPDATE "order" o
      SET "vndCostPrice" = s."total"
      FROM (
        SELECT "orderId", SUM("vndCostPrice") AS "total"
        FROM "order_item"
        GROUP BY "orderId"
      ) s
      WHERE s."orderId" = o.id
        AND COALESCE(o."vndCostPrice", 0) = 0
        AND s."total" > 0
        AND (o."paymentMethod" = 'admin_manual' OR o."orderNumber" LIKE 'MAN-%')
    `);
  }

  /**
   * Not reversible: the previous value was 0 for every row this touched, and
   * restoring that would only put the reporting gap back. Left as a no-op rather
   * than pretending to undo it.
   */
  public async down(): Promise<void> {
    // Intentionally empty — see above.
  }
}
