import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDescriptionViFields1778500000000 implements MigrationInterface {
  name = 'AddDescriptionViFields1778500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "destination" ADD "descriptionVi" character varying NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "region" ADD "description" character varying NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "region" ADD "descriptionVi" character varying NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "region" DROP COLUMN "descriptionVi"`);
    await queryRunner.query(`ALTER TABLE "region" DROP COLUMN "description"`);
    await queryRunner.query(
      `ALTER TABLE "destination" DROP COLUMN "descriptionVi"`,
    );
  }
}
