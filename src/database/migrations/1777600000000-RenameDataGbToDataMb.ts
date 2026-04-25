import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameDataGbToDataMb1777600000000 implements MigrationInterface {
  name = 'RenameDataGbToDataMb1777600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add new integer column dataMb
    await queryRunner.query(
      `ALTER TABLE "plan" ADD "dataMb" integer NOT NULL DEFAULT 0`,
    );

    // Migrate existing data: convert GB (decimal) to MB (integer)
    // Use ROUND to handle floating point, e.g. 3.00 GB -> 3072 MB
    await queryRunner.query(
      `UPDATE "plan" SET "dataMb" = ROUND("dataGb" * 1024)::integer`,
    );

    // Drop old column
    await queryRunner.query(`ALTER TABLE "plan" DROP COLUMN "dataGb"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Add back dataGb decimal column
    await queryRunner.query(
      `ALTER TABLE "plan" ADD "dataGb" decimal(10,2) NOT NULL DEFAULT 0`,
    );

    // Convert MB back to GB
    await queryRunner.query(
      `UPDATE "plan" SET "dataGb" = ROUND("dataMb"::decimal / 1024, 2)`,
    );

    // Drop dataMb column
    await queryRunner.query(`ALTER TABLE "plan" DROP COLUMN "dataMb"`);
  }
}
