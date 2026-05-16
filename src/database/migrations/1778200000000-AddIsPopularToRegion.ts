import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIsPopularAndIconUrlToRegion1778200000000 implements MigrationInterface {
  name = 'AddIsPopularAndIconUrlToRegion1778200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "region" ADD COLUMN IF NOT EXISTS "isPopular" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_region_isPopular" ON "region" ("isPopular")`,
    );
    await queryRunner.query(
      `ALTER TABLE "region" ADD COLUMN IF NOT EXISTS "iconUrl" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "region" DROP COLUMN IF EXISTS "iconUrl"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_region_isPopular"`);
    await queryRunner.query(
      `ALTER TABLE "region" DROP COLUMN IF EXISTS "isPopular"`,
    );
  }
}
