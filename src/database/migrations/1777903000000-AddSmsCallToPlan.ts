import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSmsCallToPlan1777903000000 implements MigrationInterface {
  name = 'AddSmsCallToPlan1777903000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "plan" ADD IF NOT EXISTS "sms" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "plan" ADD IF NOT EXISTS "call" integer`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "plan" DROP COLUMN IF EXISTS "call"`);
    await queryRunner.query(`ALTER TABLE "plan" DROP COLUMN IF EXISTS "sms"`);
  }
}
