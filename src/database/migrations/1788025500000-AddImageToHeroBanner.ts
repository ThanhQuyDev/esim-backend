import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Hero banner image, chosen by the admin (#089).
 *
 * The storefront hero already reads `banner.image` and falls back to a
 * hardcoded picture when it is missing — but the column never existed, so the
 * fallback was the only image the site could ever show. Changing the hero meant
 * a code change and a deploy.
 *
 * Nullable on purpose: a banner with no image keeps using the built-in one, so
 * every existing row carries on exactly as it does today.
 */
export class AddImageToHeroBanner1788025500000 implements MigrationInterface {
  name = 'AddImageToHeroBanner1788025500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "hero_banner" ADD COLUMN IF NOT EXISTS "image" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "hero_banner" DROP COLUMN "image"`);
  }
}
