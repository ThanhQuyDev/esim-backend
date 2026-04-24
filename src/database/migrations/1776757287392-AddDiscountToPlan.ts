import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDiscountToPlan1776757287392 implements MigrationInterface {
  name = 'AddDiscountToPlan1776757287392';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "plan" ADD "discount" numeric(5,2) NOT NULL DEFAULT '0'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "plan" DROP COLUMN "discount"`);
  }
}
