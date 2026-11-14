import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A day pass sold by the day now says its stored length in its standard name,
 * like every other plan (vande-1411 #011): "Australia - Daily 5 GB/day" →
 * "Australia - Daily 5 GB/day - 1 day". The sync renames plans too; this does
 * the ones already there at once. Our own stock keeps its imported name.
 */
export class DayPassNameWithDay1805900000000 implements MigrationInterface {
  name = 'DayPassNameWithDay1805900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "plan"
         SET "standardName" = "standardName" || ' - ' || "durationDays" ||
             CASE WHEN "durationDays" = 1 THEN ' day' ELSE ' days' END
       WHERE "isAbleMultidate" = true
         AND "isLocalInventory" IS NOT TRUE
         AND "durationDays" > 0
         AND "standardName" IS NOT NULL AND "standardName" <> ''
         AND "standardName" !~ ' - [0-9]+ days?$'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "plan"
         SET "standardName" = regexp_replace("standardName", ' - [0-9]+ days?$', '')
       WHERE "isAbleMultidate" = true
         AND "isLocalInventory" IS NOT TRUE
         AND "standardName" ~ ' - [0-9]+ days?$'`);
  }
}
