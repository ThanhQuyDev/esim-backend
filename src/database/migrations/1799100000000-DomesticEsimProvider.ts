import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Domestic eSIMs get a supplier of their own (vande #001): "itel" becomes
 * "itel-noidia", shown as "iTel nội địa", so Viettel's domestic plans no longer
 * share the supplier "viettel" with its travel plans in every filter and chart.
 *
 * The plan slug is rebuilt the way the importer builds it
 * (`<provider>-<providerPlanId>`), or the next upload of the same file would
 * not find the plan and would create a copy. Blog posts that list a renamed
 * plan's code are updated with it.
 *
 * Production had no domestic plan when this was written; beta had a handful.
 */
export class DomesticEsimProvider1799100000000 implements MigrationInterface {
  name = 'DomesticEsimProvider1799100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TEMP TABLE "_domestic_rename" ON COMMIT DROP AS
      SELECT p.id,
             p.slug AS "oldSlug",
             lower(p.provider) || '-noidia' AS "newProvider",
             regexp_replace(
               lower(lower(p.provider) || '-noidia-' || COALESCE(p."providerPlanId", p.id::text)),
               '[^a-z0-9-]', '-', 'g'
             ) AS "newSlug"
      FROM "plan" p
      WHERE p."isDomesticEsim" = true
        AND lower(p.provider) NOT LIKE '%-noidia'
    `);

    // A slug already taken (by a plan the new importer created) keeps the old
    // slug: the provider still moves, and nothing is lost.
    await queryRunner.query(`
      UPDATE "plan" p
      SET "provider" = r."newProvider",
          "slug" = CASE
            WHEN EXISTS (SELECT 1 FROM "plan" o WHERE o.slug = r."newSlug" AND o.id <> p.id)
            THEN p.slug ELSE r."newSlug" END
      FROM "_domestic_rename" r
      WHERE r.id = p.id
    `);

    await queryRunner.query(`
      UPDATE "esim" e
      SET "provider" = p."provider"
      FROM "plan" p
      WHERE e."planId" = p.id
        AND p."isDomesticEsim" = true
        AND e."provider" IS DISTINCT FROM p."provider"
    `);

    await queryRunner.query(`
      UPDATE "blog" b
      SET "planCodes" = regexp_replace(
            b."planCodes",
            '(^|[\\s,;])' || r."oldSlug" || '(?=$|[\\s,;])',
            '\\1' || p.slug,
            'g')
      FROM "_domestic_rename" r
      JOIN "plan" p ON p.id = r.id
      WHERE b."planCodes" ~ ('(^|[\\s,;])' || r."oldSlug" || '($|[\\s,;])')
        AND p.slug <> r."oldSlug"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "plan"
      SET "provider" = left("provider", length("provider") - length('-noidia')),
          "slug" = regexp_replace("slug", '-noidia-', '-')
      WHERE "isDomesticEsim" = true AND "provider" LIKE '%-noidia'
    `);
    await queryRunner.query(`
      UPDATE "esim" e SET "provider" = p."provider"
      FROM "plan" p
      WHERE e."planId" = p.id AND p."isDomesticEsim" = true
    `);
  }
}
