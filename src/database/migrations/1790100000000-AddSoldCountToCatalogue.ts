import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Units sold per plan, destination and region (#053), so the storefront can
 * later show "Đã bán …".
 *
 * Backfilled here from order history; after that the hourly recount in
 * PlansService keeps them current.
 */
export class AddSoldCountToCatalogue1790100000000 implements MigrationInterface {
  name = 'AddSoldCountToCatalogue1790100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['plan', 'destination', 'region']) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "soldCount" integer NOT NULL DEFAULT 0`,
      );
    }

    await queryRunner.query(`
      UPDATE "plan" p SET "soldCount" = s."qty"
      FROM (
        SELECT oi."planId" AS "planId", SUM(oi."quantity")::int AS "qty"
        FROM "order_item" oi
        INNER JOIN "order" o ON o."id" = oi."orderId"
        WHERE oi."status" = 'completed' AND o."status" = 'paid' AND o."deletedAt" IS NULL
        GROUP BY oi."planId"
      ) s
      WHERE p."id" = s."planId"
    `);
    await queryRunner.query(`
      UPDATE "destination" d SET "soldCount" = x."qty"
      FROM (
        SELECT "destinationId" AS "id", SUM("soldCount")::int AS "qty"
        FROM "plan" WHERE "destinationId" IS NOT NULL GROUP BY "destinationId"
      ) x
      WHERE d."id" = x."id"
    `);
    await queryRunner.query(`
      UPDATE "region" r SET "soldCount" = x."qty"
      FROM (
        SELECT "regionId" AS "id", SUM("soldCount")::int AS "qty"
        FROM "plan" WHERE "regionId" IS NOT NULL GROUP BY "regionId"
      ) x
      WHERE r."id" = x."id"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['region', 'destination', 'plan']) {
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP COLUMN IF EXISTS "soldCount"`,
      );
    }
  }
}
