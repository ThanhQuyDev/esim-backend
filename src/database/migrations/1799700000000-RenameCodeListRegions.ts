import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Regions still named by a raw country-code list (vande #012): "AT,BE,BG,…
 * PT-20,PT-30,…" (UK+EU45 Local) and "AL,DZ,…,US-HI,VI" (Global 108 Regions)
 * filled the destination column. The sync renames such regions, but did not
 * recognise lists holding subdivision codes. They take the pack name of a plan
 * filed under them — the part of the name before the first "-", as the sync
 * names regions ("UK+EU45 Local-Total20GB-30-A0" → "UK+EU45 Local").
 */
export class RenameCodeListRegions1799700000000 implements MigrationInterface {
  name = 'RenameCodeListRegions1799700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "region" r
         SET "name" = btrim(split_part(p.name, '-', 1))
        FROM (
          SELECT DISTINCT ON ("regionId") "regionId", name
            FROM "plan"
           WHERE "regionId" IS NOT NULL AND "deletedAt" IS NULL
           ORDER BY "regionId", id
        ) p
       WHERE p."regionId" = r.id
         AND r."name" ~ '^[A-Z]{2}(-[A-Z0-9]{1,3})?(\s*,\s*[A-Z]{2}(-[A-Z0-9]{1,3})?)+$'
         AND btrim(split_part(p.name, '-', 1)) <> ''
    `);
  }

  public async down(): Promise<void> {
    // The code lists were the bug; nothing worth restoring.
  }
}
