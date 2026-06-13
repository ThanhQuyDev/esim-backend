import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddExternalCodeToRegion1778200000000 implements MigrationInterface {
  name = 'AddExternalCodeToRegion1778200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add the nullable column.
    await queryRunner.query(
      `ALTER TABLE "region" ADD COLUMN "externalCode" character varying`,
    );

    // 2. Backfill: the cron sync previously used `slug` as the de-facto
    //    provider identity key, so the current slug is the most reliable
    //    source for the stable externalCode. This keeps every existing
    //    provider-synced region matchable by its original key.
    await queryRunner.query(
      `UPDATE "region" SET "externalCode" = "slug" WHERE "externalCode" IS NULL`,
    );

    // 3. Enforce uniqueness + add the lookup index.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_region_externalCode" ON "region" ("externalCode") WHERE "externalCode" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_region_externalCode" ON "region" ("externalCode")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_region_externalCode"`);
    await queryRunner.query(`DROP INDEX "UQ_region_externalCode"`);
    await queryRunner.query(`ALTER TABLE "region" DROP COLUMN "externalCode"`);
  }
}
