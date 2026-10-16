import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Where a distribution partner's order sends its eSIM QR codes (doitac-1410
 * #034): the customer's address the partner typed when buying.
 */
export class OrderDeliveryEmail1798000000000 implements MigrationInterface {
  name = 'OrderDeliveryEmail1798000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "deliveryEmail" varchar(255)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "order" DROP COLUMN IF EXISTS "deliveryEmail"`,
    );
  }
}
