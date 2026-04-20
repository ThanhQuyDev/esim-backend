import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIsAbleMultidateToPlan1776682319266 implements MigrationInterface {
  name = 'AddIsAbleMultidateToPlan1776682319266';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "plan" ADD "isAbleMultidate" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "plan" DROP COLUMN "isAbleMultidate"`);
  }
}
