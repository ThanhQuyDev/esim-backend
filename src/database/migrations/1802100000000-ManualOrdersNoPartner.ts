import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * doitac-3010 #003: an order an admin places for a customer ("Đặt đơn hộ
 * khách") is a direct sale — no partner, rate or commission. Orders placed
 * before the rule picked up the partner the customer once clicked through.
 *
 * Their commission rows that never reached a wallet (unpaid / pending /
 * rejected) are removed and the order loses its partner. A commission already
 * CREDITED is left alone: taking money back out of a wallet is an admin's
 * call ("Điều chỉnh Ví & Hoa hồng"), not a migration's.
 */
export class ManualOrdersNoPartner1802100000000 implements MigrationInterface {
  name = 'ManualOrdersNoPartner1802100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM order_partner_commission c
      USING "order" o
      WHERE o.id = c."orderId"
        AND o."paymentMethod" = 'admin_manual'
        AND c.status IN ('unpaid', 'pending', 'rejected')
    `);
    await queryRunner.query(`
      UPDATE "order" o
      SET "attributedPartnerId" = NULL,
          "partnerLinkCode" = NULL,
          "attributionWarning" = NULL
      WHERE o."paymentMethod" = 'admin_manual'
        AND o."attributedPartnerId" IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM order_partner_commission c WHERE c."orderId" = o.id
        )
    `);
  }

  public async down(): Promise<void> {
    // The partner an order was wrongly given is not worth restoring.
  }
}
