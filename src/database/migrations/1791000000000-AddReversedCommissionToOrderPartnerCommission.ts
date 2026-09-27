import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Partial refunds take back part of a commission (#018).
 *
 * `commissionVnd` is reduced as the refunds land, so every total that already
 * sums it stays correct without being touched. This column keeps the running
 * amount taken back, which is what makes a second refund on the same order
 * charge only the difference instead of the whole share again.
 */
export class AddReversedCommissionToOrderPartnerCommission1791000000000 implements MigrationInterface {
  name = 'AddReversedCommissionToOrderPartnerCommission1791000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "order_partner_commission" ADD "reversedCommissionVnd" numeric(14,0) NOT NULL DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "order_partner_commission" DROP COLUMN "reversedCommissionVnd"`,
    );
  }
}
