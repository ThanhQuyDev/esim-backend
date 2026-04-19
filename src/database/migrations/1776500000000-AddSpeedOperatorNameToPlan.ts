import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSpeedOperatorNameToPlan1776500000000 implements MigrationInterface {
  name = 'AddSpeedOperatorNameToPlan1776500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "plan" ADD "speed" character varying NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "plan" ADD "operatorName" character varying NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "plan" DROP COLUMN "operatorName"`);
    await queryRunner.query(`ALTER TABLE "plan" DROP COLUMN "speed"`);
  }
}
