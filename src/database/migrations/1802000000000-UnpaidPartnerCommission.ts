import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * doitac-3010 #002: a partner's share of an order that was never paid counts
 * nowhere. Shares recorded before this rule on orders that are not paid (a
 * failed payment, a cancelled order, one still waiting) become `unpaid`; they
 * turn back into `pending` / `rejected` if the payment ever lands.
 *
 * Only `pending` and `rejected` rows move — nothing was credited on them, so
 * no wallet is touched.
 */
export class UnpaidPartnerCommission1802000000000 implements MigrationInterface {
  name = 'UnpaidPartnerCommission1802000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE order_partner_commission c
      SET status = 'unpaid'
      FROM "order" o
      WHERE o.id = c."orderId"
        AND c.status IN ('pending', 'rejected')
        AND o.status NOT IN ('paid', 'completed', 'refunded', 'partially_refunded')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE order_partner_commission
      SET status = CASE WHEN "rejectionReason" IS NOT NULL THEN 'rejected' ELSE 'pending' END
      WHERE status = 'unpaid'
    `);
  }
}
