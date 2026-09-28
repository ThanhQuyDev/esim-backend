import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Why an order earned the partner nothing (#041).
 *
 * A self-referral — the buyer's details matching the partner's own registration
 * — has always been refused, but silently, with only a line in the server log.
 * When the partner writes in to ask, whoever answers needs to see the reason,
 * so the refusal is now recorded as a commission row worth 0đ that says which
 * detail matched.
 */
export class AddRejectionReasonToCommission1791800000000 implements MigrationInterface {
  name = 'AddRejectionReasonToCommission1791800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "order_partner_commission" ADD COLUMN IF NOT EXISTS "rejectionReason" character varying(64)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "order_partner_commission" DROP COLUMN IF EXISTS "rejectionReason"`,
    );
  }
}
