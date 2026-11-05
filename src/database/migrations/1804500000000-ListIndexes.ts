import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Both CMS lists open newest first (vande-0411 #054). With these they read the
 * first rows straight off an index, however long the tables grow.
 */
export class ListIndexes1804500000000 implements MigrationInterface {
  name = 'ListIndexes1804500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_plan_created_live" ON "plan" ("createdAt" DESC) WHERE "deletedAt" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_esim_created_live" ON "esim" ("createdAt" DESC) WHERE "deletedAt" IS NULL`,
    );
    // Part of an ICCID, anywhere in it.
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_esim_iccid_trgm" ON "esim" USING gin (iccid gin_trgm_ops)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_plan_created_live"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_esim_created_live"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_esim_iccid_trgm"`);
  }
}
