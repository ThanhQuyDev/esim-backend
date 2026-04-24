import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVndPriceToOrderAndOrderItem1776833610000 implements MigrationInterface {
  name = 'AddVndPriceToOrderAndOrderItem1776833610000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "order" ADD "vndPrice" decimal(12,0) NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" ADD "vndCostPrice" decimal(12,0) NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_item" ADD "vndPrice" decimal(12,0) NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_item" ADD "vndCostPrice" decimal(12,0) NOT NULL DEFAULT '0'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "order_item" DROP COLUMN "vndCostPrice"`,
    );
    await queryRunner.query(`ALTER TABLE "order_item" DROP COLUMN "vndPrice"`);
    await queryRunner.query(`ALTER TABLE "order" DROP COLUMN "vndCostPrice"`);
    await queryRunner.query(`ALTER TABLE "order" DROP COLUMN "vndPrice"`);
  }
}
