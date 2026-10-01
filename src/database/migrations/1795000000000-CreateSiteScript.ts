import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Site-wide third-party scripts (#075).
 *
 * Until now a script could only be attached to a single page, through
 * `seo_config.structuredData`. Google Analytics and Tag Manager are worthless
 * unless they are on every page, and there is no realistic way to paste them into
 * every SEO record by hand — let alone to remember it for each page added later.
 *
 * Starts empty. Nothing is migrated out of `seo_config`: a page's record may hold
 * JSON-LD that belongs to that page only, and moving it site-wide would duplicate
 * a page's schema across the whole site. Whoever moves an analytics snippet here
 * should delete it from the page record afterwards, or it will load twice.
 */
export class CreateSiteScript1795000000000 implements MigrationInterface {
  name = 'CreateSiteScript1795000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "site_script" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "content" text NOT NULL,
        "placement" character varying NOT NULL DEFAULT 'head',
        "isActive" boolean NOT NULL DEFAULT true,
        "sortOrder" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_site_script_id" PRIMARY KEY ("id")
      )
    `);

    // Every page load reads the active rows for one placement, so those are the
    // columns worth indexing.
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_site_script_placement" ON "site_script" ("placement")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_site_script_isActive" ON "site_script" ("isActive")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "site_script"`);
  }
}
