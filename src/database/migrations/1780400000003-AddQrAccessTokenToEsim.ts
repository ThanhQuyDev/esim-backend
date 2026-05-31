import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddQrAccessTokenToEsim1780400000003 implements MigrationInterface {
  name = 'AddQrAccessTokenToEsim1780400000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "esim" ADD "qrAccessToken" uuid DEFAULT uuid_generate_v4()`,
    );
    // Backfill existing rows
    await queryRunner.query(
      `UPDATE "esim" SET "qrAccessToken" = uuid_generate_v4() WHERE "qrAccessToken" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "esim" DROP COLUMN "qrAccessToken"`);
  }
}
