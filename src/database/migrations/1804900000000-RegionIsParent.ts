import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * "Làm khu vực cha" (vande-0411 #073). Every region that already has packs under
 * it becomes a parent, so nothing moves on the website.
 *
 * "Nổi bật" now means the home page for a parent and the parent's own page for a
 * pack. A pack that was featured while its parent was not put that group on the
 * home page, so the parent takes the flag and the group stays there.
 */
export class RegionIsParent1804900000000 implements MigrationInterface {
  name = 'RegionIsParent1804900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "region" ADD COLUMN IF NOT EXISTS "isParent" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `UPDATE "region" SET "isParent" = true
        WHERE "id" IN (
          SELECT "parentId" FROM "region"
           WHERE "parentId" IS NOT NULL AND "deletedAt" IS NULL
        )`,
    );
    await queryRunner.query(
      `UPDATE "region" SET "isPopular" = true
        WHERE "isPopular" = false
          AND "id" IN (
            SELECT "parentId" FROM "region"
             WHERE "parentId" IS NOT NULL AND "isPopular" = true AND "deletedAt" IS NULL
          )`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "region" DROP COLUMN IF EXISTS "isParent"`,
    );
  }
}
