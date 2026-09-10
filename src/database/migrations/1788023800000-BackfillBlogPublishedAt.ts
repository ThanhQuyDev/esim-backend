import { MigrationInterface, QueryRunner } from 'typeorm';

export class BackfillBlogPublishedAt1788023800000 implements MigrationInterface {
  name = 'BackfillBlogPublishedAt1788023800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Existing published posts predate reliable publication timestamps. Use
    // createdAt as the stable publication date instead of updatedAt, which
    // changes every time the article is edited.
    await queryRunner.query(`
      UPDATE "blog"
      SET "publishedAt" = "createdAt"
      WHERE "isPublished" = true AND "publishedAt" IS NULL
    `);
  }

  public async down(): Promise<void> {
    // Data-only backfill is intentionally not reverted: there is no reliable
    // way to distinguish a backfilled timestamp from an explicitly chosen one.
  }
}
