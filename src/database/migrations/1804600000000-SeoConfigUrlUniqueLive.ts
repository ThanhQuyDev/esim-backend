import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A deleted SEO config kept its URL for good: creating that URL again passed the
 * duplicate check, which skips deleted rows, then failed on the index with a 500
 * (vande-0411 #055). Only live configs need a URL of their own.
 */
export class SeoConfigUrlUniqueLive1804600000000 implements MigrationInterface {
  name = 'SeoConfigUrlUniqueLive1804600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_seo_config_url"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_seo_config_url" ON "seo_config" ("url") WHERE "deletedAt" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_seo_config_url"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_seo_config_url" ON "seo_config" ("url")`,
    );
  }
}
