import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * "Duyệt hoa hồng" / "Xoá hoa hồng" by hand on a commission stuck waiting
 * (vande-1411 #048): who decided, when, and what a removed one was worth.
 */
export class CommissionAdminDecision1806700000000 implements MigrationInterface {
  name = 'CommissionAdminDecision1806700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "order_partner_commission" ADD COLUMN IF NOT EXISTS "decidedByAdminId" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_partner_commission" ADD COLUMN IF NOT EXISTS "decidedAt" timestamp`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_partner_commission" ADD COLUMN IF NOT EXISTS "removedCommissionVnd" numeric(14,0)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "order_partner_commission" DROP COLUMN IF EXISTS "removedCommissionVnd"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_partner_commission" DROP COLUMN IF EXISTS "decidedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_partner_commission" DROP COLUMN IF EXISTS "decidedByAdminId"`,
    );
  }
}
