import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * How many eSIMs each refund gave back (doitac-1410 #020): the partner's order
 * history lists every refund with its eSIM count and time.
 */
export class OrderRefundEsimCount1797700000000 implements MigrationInterface {
  name = 'OrderRefundEsimCount1797700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "order_refund" ADD COLUMN IF NOT EXISTS "esimCount" integer`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "order_refund" DROP COLUMN IF EXISTS "esimCount"`,
    );
  }
}
