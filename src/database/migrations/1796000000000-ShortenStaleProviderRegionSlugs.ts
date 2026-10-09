import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Regions the Billion / MicroEsim syncs created were slugged with every
 * country code they cover (#003, test round 4). The sync now gives them a
 * short slug from their name — but only for regions it still touches; one
 * whose packs left the catalogue keeps its 150-character slug in the CMS.
 * This shortens those: the name, slugified, with the id appended so it can
 * never collide with a slug already taken.
 */
export class ShortenStaleProviderRegionSlugs1796000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "region"
         SET slug = trim(both '-' from regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g')) || '-' || id
       WHERE slug = "externalCode"
         AND ("externalCode" LIKE 'billion-%' OR "externalCode" LIKE 'microesim-%')
         AND length(slug) > 60
    `);
  }

  public async down(): Promise<void> {
    // The long slugs were the bug; nothing to restore.
  }
}
