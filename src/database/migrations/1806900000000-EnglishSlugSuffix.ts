import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * English product page slugs as "<x>-esim" (vande-2011 #015): anh Thọ renamed
 * Thailand by hand (/en/esim-thailand → /en/thailand-esim) and asked for the
 * rest in one go. For every travel destination and region whose English slug
 * is "esim-<x>":
 *
 * - its Vietnamese slug keeps the address it has today: most have no slugVi
 *   and read the shared slug, so slugVi takes the old slug first;
 * - the English slug becomes "<x>-esim", unless another page already uses
 *   that string (then it is left as it is);
 * - an SEO setting keyed by the old English URL follows it.
 *
 * The old English URL keeps working: the page finds the old slug as the
 * Vietnamese one and redirects (308) to the English address. Domestic
 * destinations are left alone — the carrier page lives at /esim-<carrier>.
 * Every change is kept in slug_rename_2011, which `down` reads to undo it.
 */
export class EnglishSlugSuffix1806900000000 implements MigrationInterface {
  name = 'EnglishSlugSuffix1806900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS slug_rename_2011 (
        id SERIAL PRIMARY KEY,
        kind varchar(16) NOT NULL,
        "entityId" integer NOT NULL,
        "oldSlug" varchar NOT NULL,
        "oldSlugVi" varchar,
        "newSlug" varchar NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )`);

    // Every string a page already answers to, so a new slug never collides.
    const taken = `(
      SELECT slug AS s FROM destination UNION SELECT "slugVi" FROM destination
       WHERE "slugVi" IS NOT NULL
      UNION SELECT slug FROM region UNION SELECT "slugVi" FROM region
       WHERE "slugVi" IS NOT NULL)`;

    for (const table of ['destination', 'region']) {
      const local =
        table === 'destination'
          ? `AND COALESCE(t."esimType", 'travel') <> 'local'`
          : '';
      await queryRunner.query(`
        INSERT INTO slug_rename_2011 (kind, "entityId", "oldSlug", "oldSlugVi", "newSlug")
        SELECT '${table}', t.id, t.slug, t."slugVi",
               substring(t.slug FROM 6) || '-esim'
          FROM ${table} t
         WHERE t."deletedAt" IS NULL
           AND t.slug ~ '^esim-[a-z0-9-]+$'
           ${local}
           AND substring(t.slug FROM 6) || '-esim' NOT IN ${taken}
           AND NOT EXISTS (SELECT 1 FROM slug_rename_2011 r
                            WHERE r.kind = '${table}' AND r."entityId" = t.id)`);
      await queryRunner.query(`
        UPDATE ${table} t
           SET "slugVi" = COALESCE(NULLIF(t."slugVi", ''), r."oldSlug"),
               slug = r."newSlug"
          FROM slug_rename_2011 r
         WHERE r.kind = '${table}' AND r."entityId" = t.id
           AND t.slug = r."oldSlug"`);
    }

    await queryRunner.query(`
      UPDATE seo_config c
         SET url = '/en/' || r."newSlug"
        FROM slug_rename_2011 r
       WHERE c."deletedAt" IS NULL
         AND c.url = '/en/' || r."oldSlug"
         AND NOT EXISTS (SELECT 1 FROM seo_config o
                          WHERE o."deletedAt" IS NULL
                            AND o.url = '/en/' || r."newSlug")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const exists: { t: string | null }[] = await queryRunner.query(
      `SELECT to_regclass('slug_rename_2011')::text AS t`,
    );
    if (!exists[0]?.t) return;
    await queryRunner.query(`
      UPDATE seo_config c
         SET url = '/en/' || r."oldSlug"
        FROM slug_rename_2011 r
       WHERE c."deletedAt" IS NULL AND c.url = '/en/' || r."newSlug"`);
    for (const table of ['destination', 'region']) {
      await queryRunner.query(`
        UPDATE ${table} t
           SET slug = r."oldSlug", "slugVi" = r."oldSlugVi"
          FROM slug_rename_2011 r
         WHERE r.kind = '${table}' AND r."entityId" = t.id
           AND t.slug = r."newSlug"`);
    }
    await queryRunner.query(`DROP TABLE slug_rename_2011`);
  }
}
