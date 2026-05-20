import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTitleFieldsToDestinationAndRegion1778200000000 implements MigrationInterface {
  name = 'AddTitleFieldsToDestinationAndRegion1778200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "destination" ADD "title" character varying NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "destination" ADD "titleVi" character varying NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "region" ADD "title" character varying NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "region" ADD "titleVi" character varying NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "region" DROP COLUMN "titleVi"`);
    await queryRunner.query(`ALTER TABLE "region" DROP COLUMN "title"`);
    await queryRunner.query(`ALTER TABLE "destination" DROP COLUMN "titleVi"`);
    await queryRunner.query(`ALTER TABLE "destination" DROP COLUMN "title"`);
  }
}
