import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCouponFieldsToOrder1776700100000 implements MigrationInterface {
  name = 'AddCouponFieldsToOrder1776700100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "order" ADD "couponCode" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" ADD "discountAmount" numeric(10,2) NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_order_couponCode" ON "order" ("couponCode")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_order_couponCode"`);
    await queryRunner.query(`ALTER TABLE "order" DROP COLUMN "discountAmount"`);
    await queryRunner.query(`ALTER TABLE "order" DROP COLUMN "couponCode"`);
  }
}
