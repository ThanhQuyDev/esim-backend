import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSlugViToDestinationAndRegion1780800000000 implements MigrationInterface {
  name = 'AddSlugViToDestinationAndRegion1780800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "destination" ADD "slugVi" character varying NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "region" ADD "slugVi" character varying NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_destination_slugVi" ON "destination" ("slugVi") WHERE "slugVi" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_region_slugVi" ON "region" ("slugVi") WHERE "slugVi" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_region_slugVi"`);
    await queryRunner.query(`DROP INDEX "UQ_destination_slugVi"`);
    await queryRunner.query(`ALTER TABLE "region" DROP COLUMN "slugVi"`);
    await queryRunner.query(`ALTER TABLE "destination" DROP COLUMN "slugVi"`);
  }
}
