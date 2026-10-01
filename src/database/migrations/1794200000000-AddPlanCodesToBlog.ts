import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * #047 — an article's related plans were linked by numeric plan id, through the
 * `blog_plans` join table. A full re-import of a supplier catalogue deletes and
 * recreates the plan rows, so those ids change and every older article silently
 * loses its plans, with no way to find which ones they were.
 *
 * `planCodes` records a provider-sourced reference per plan instead — the plan's
 * slug, or the supplier's own package code. Both come from the supplier feed and
 * survive a re-import; the slug in particular is what the sync itself matches on
 * when it upserts (`esimaccess.service.ts` → "the upsert matches existing plans
 * by slug"), and it is the only one of the two with a unique index.
 *
 * `blog_plans` stays as-is so nothing that joins on it breaks; it is rewritten
 * from the codes on every save, and the codes win when the two disagree.
 *
 * The backfill uses `plan.slug` rather than `providerPlanId`: it is unique, so an
 * article can never end up pointing at two different suppliers' packages that
 * happen to share a code.
 */
export class AddPlanCodesToBlog1794200000000 implements MigrationInterface {
  name = 'AddPlanCodesToBlog1794200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "blog" ADD COLUMN IF NOT EXISTS "planCodes" text`,
    );

    // Backfill in the order the editor typed, which `planOrder` remembers; plans
    // missing from it keep the join table's order behind them.
    await queryRunner.query(`
      UPDATE "blog" b
      SET "planCodes" = s."codes"
      FROM (
        SELECT bp."blogId", string_agg(p."slug", ',' ORDER BY ord.pos, p.id) AS "codes"
        FROM "blog_plans" bp
        JOIN "plan" p ON p.id = bp."planId"
        LEFT JOIN "blog" b2 ON b2.id = bp."blogId"
        LEFT JOIN LATERAL (
          SELECT idx AS pos
          FROM unnest(string_to_array(COALESCE(b2."planOrder", ''), ',')) WITH ORDINALITY AS t(val, idx)
          WHERE t.val = p.id::text
          LIMIT 1
        ) ord ON TRUE
        WHERE p."slug" IS NOT NULL AND p."slug" <> ''
        GROUP BY bp."blogId"
      ) s
      WHERE s."blogId" = b.id
        AND (b."planCodes" IS NULL OR b."planCodes" = '')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "blog" DROP COLUMN IF EXISTS "planCodes"`,
    );
  }
}
