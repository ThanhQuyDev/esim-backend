import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * doitac-1410 #004 — "Tạm khóa" / "Khóa tài khoản" must put a marketing
 * partner's links and codes into "Bị đình chỉ", and "Mở khóa" must give each
 * one back the state the partner had chosen (on or paused), not switch them all
 * on. The link remembers that state; a code is suspended by a timestamp so the
 * partner's own on/off stays untouched underneath.
 */
export class PartnerSuspendLinksAndCoupons1797100000000 implements MigrationInterface {
  name = 'PartnerSuspendLinksAndCoupons1797100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "partner_link" ADD "statusBeforeSuspend" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "coupon" ADD "suspendedAt" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "coupon" DROP COLUMN "suspendedAt"`);
    await queryRunner.query(
      `ALTER TABLE "partner_link" DROP COLUMN "statusBeforeSuspend"`,
    );
  }
}
