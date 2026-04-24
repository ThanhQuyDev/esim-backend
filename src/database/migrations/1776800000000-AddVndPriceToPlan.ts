import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVndPriceToPlan1776800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "plan" ADD COLUMN IF NOT EXISTS "vndPrice" bigint NOT NULL DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "plan" DROP COLUMN IF EXISTS "vndPrice"`,
    );
  }
}
