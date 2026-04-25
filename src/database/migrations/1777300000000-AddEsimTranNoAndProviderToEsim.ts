import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEsimTranNoAndProviderToEsim1777300000000 implements MigrationInterface {
  name = 'AddEsimTranNoAndProviderToEsim1777300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "esim" ADD "esimTranNo" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "esim" ADD "provider" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "esim" DROP COLUMN IF EXISTS "provider"`,
    );
    await queryRunner.query(
      `ALTER TABLE "esim" DROP COLUMN IF EXISTS "esimTranNo"`,
    );
  }
}
