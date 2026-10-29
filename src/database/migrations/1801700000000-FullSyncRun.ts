import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * History of the full catalogue sync (vande #078): when each run started and
 * finished and who started it, so the admin can see the latest runs.
 */
export class FullSyncRun1801700000000 implements MigrationInterface {
  name = 'FullSyncRun1801700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "full_sync_run" (
        "id" SERIAL PRIMARY KEY,
        "trigger" character varying(10) NOT NULL,
        "adminId" integer,
        "startedAt" TIMESTAMP NOT NULL,
        "finishedAt" TIMESTAMP,
        "errors" jsonb NOT NULL DEFAULT '[]'
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_full_sync_run_started" ON "full_sync_run" ("startedAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "full_sync_run"`);
  }
}
