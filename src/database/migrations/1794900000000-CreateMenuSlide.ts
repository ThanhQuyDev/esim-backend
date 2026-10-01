import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The mega-menu "Explore" slideshow, moved out of the code (#073).
 *
 * The four dropdown panels each end in a carousel whose cards were hard-coded in
 * `navbar.tsx`, still pointing at the reference design's NordVPN CDN images. Only
 * a developer could change them.
 *
 * The table starts empty on purpose. The storefront keeps rendering the built-in
 * cards for any panel with no slides configured, so the menu does not go blank
 * between this migration and the admin filling it in — and nobody has to seed
 * somebody else's CDN URLs into our database to get there.
 */
export class CreateMenuSlide1794900000000 implements MigrationInterface {
  name = 'CreateMenuSlide1794900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "menu_slide" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "menuKey" character varying NOT NULL,
        "title" character varying NOT NULL,
        "description" character varying NOT NULL,
        "href" character varying NOT NULL,
        "image" character varying NOT NULL,
        "imageAlt" character varying,
        "language" character varying NOT NULL DEFAULT 'en',
        "sortOrder" integer NOT NULL DEFAULT 0,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_menu_slide_id" PRIMARY KEY ("id")
      )
    `);

    // The navbar reads one language's active slides on every page load, so that
    // is the lookup worth indexing.
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_menu_slide_menuKey" ON "menu_slide" ("menuKey")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_menu_slide_language" ON "menu_slide" ("language")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_menu_slide_isActive" ON "menu_slide" ("isActive")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "menu_slide"`);
  }
}
