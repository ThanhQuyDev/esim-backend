import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * #048 — the admin list's "Loại trang" column is derived from
 * `destinationId` / `regionId` / `planId`, so a config created by typing only a
 * URL showed as "Trang khác" even for an obvious country or area page. The link
 * was simply never made.
 *
 * The service now infers it on create and on a URL edit. This does the same for
 * the rows already in the table.
 *
 * Matching mirrors `seoUrlSlug`: a single path segment after an optional `/en` or
 * `/vi` prefix, compared against both slug columns, case-insensitively. Only rows
 * with all three ids null are touched, so a link an admin set by hand — even a
 * deliberately unusual one — is never overwritten. The shared `/destination` and
 * `/region` pages are left alone: they are about a kind of page, not one country.
 */
export class BackfillSeoConfigPageTarget1794300000000 implements MigrationInterface {
  name = 'BackfillSeoConfigPageTarget1794300000000';

  /** The single slug segment of `seo_config.url`, or NULL. */
  private readonly slugExpr = `
    CASE
      WHEN array_length(parts.segments, 1) = 1 THEN parts.segments[1]
      WHEN array_length(parts.segments, 1) = 2 AND parts.segments[1] IN ('en', 'vi')
        THEN parts.segments[2]
      ELSE NULL
    END
  `;

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Destinations first: a slug belongs to at most one of the two, and the
    // service resolves in this order too.
    await queryRunner.query(`
      UPDATE "seo_config" s
      SET "destinationId" = d.id
      FROM (
        SELECT s2.id AS "configId", ${this.slugExpr} AS slug
        FROM "seo_config" s2
        CROSS JOIN LATERAL (
          SELECT string_to_array(trim(both '/' from split_part(split_part(s2.url, '?', 1), '#', 1)), '/') AS segments
        ) parts
      ) u
      JOIN "destination" d
        ON (lower(d.slug) = u.slug OR lower(d."slugVi") = u.slug)
       AND d."deletedAt" IS NULL
      WHERE s.id = u."configId"
        AND u.slug IS NOT NULL
        AND u.slug NOT IN ('destination', 'destinations', 'region', 'regions')
        AND s."destinationId" IS NULL
        AND s."regionId" IS NULL
        AND s."planId" IS NULL
    `);

    await queryRunner.query(`
      UPDATE "seo_config" s
      SET "regionId" = r.id
      FROM (
        SELECT s2.id AS "configId", ${this.slugExpr} AS slug
        FROM "seo_config" s2
        CROSS JOIN LATERAL (
          SELECT string_to_array(trim(both '/' from split_part(split_part(s2.url, '?', 1), '#', 1)), '/') AS segments
        ) parts
      ) u
      JOIN "region" r
        ON (lower(r.slug) = u.slug OR lower(r."slugVi") = u.slug)
       AND r."deletedAt" IS NULL
      WHERE s.id = u."configId"
        AND u.slug IS NOT NULL
        AND u.slug NOT IN ('destination', 'destinations', 'region', 'regions')
        AND s."destinationId" IS NULL
        AND s."regionId" IS NULL
        AND s."planId" IS NULL
    `);
  }

  /**
   * Not reversible: the previous value was NULL for every row this touched, and
   * putting that back would only restore the wrong label.
   */
  public async down(): Promise<void> {
    // Intentionally empty — see above.
  }
}
