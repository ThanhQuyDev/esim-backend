import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPhoneNumberToEsim1777400000000 implements MigrationInterface {
  name = 'AddPhoneNumberToEsim1777400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "esim" ADD "phoneNumber" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "esim" DROP COLUMN IF EXISTS "phoneNumber"`,
    );
  }
}
