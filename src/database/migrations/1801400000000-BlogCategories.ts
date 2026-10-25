import { MigrationInterface, QueryRunner } from 'typeorm';
import {
  BLOG_CATEGORY_SEED,
  blogCategorySlug,
} from '../../blogs/blog-categories';

/**
 * The blog's categories, made in advance (vande #076): a parent and its
 * children, each named in English and Vietnamese with the slug of each name.
 *
 * Safe to run again — a category already there (same slug under the same
 * parent) is left as it is. Posts are not touched: they keep the category
 * they were written under.
 */
export class BlogCategories1801400000000 implements MigrationInterface {
  name = 'BlogCategories1801400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "blog_category" (
         "id" SERIAL PRIMARY KEY,
         "parentId" integer REFERENCES "blog_category"("id") ON DELETE CASCADE,
         "nameEn" character varying(120) NOT NULL,
         "nameVi" character varying(120) NOT NULL,
         "slugEn" character varying(140) NOT NULL,
         "slugVi" character varying(140) NOT NULL,
         "sortOrder" integer NOT NULL DEFAULT 0,
         "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
       )`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_blog_category_slug"
         ON "blog_category" (COALESCE("parentId", 0), "slugEn")`,
    );

    for (const [p, parent] of BLOG_CATEGORY_SEED.entries()) {
      const slugEn = blogCategorySlug(parent.en);
      await queryRunner.query(
        `INSERT INTO "blog_category" ("parentId", "nameEn", "nameVi", "slugEn", "slugVi", "sortOrder")
         SELECT NULL::int, $1::varchar, $2::varchar, $3::varchar, $4::varchar, $5::int
          WHERE NOT EXISTS (SELECT 1 FROM "blog_category"
                             WHERE "parentId" IS NULL AND "slugEn" = $3)`,
        [parent.en, parent.vi, slugEn, blogCategorySlug(parent.vi), p],
      );
      const [{ id }] = (await queryRunner.query(
        `SELECT id FROM "blog_category" WHERE "parentId" IS NULL AND "slugEn" = $1`,
        [slugEn],
      )) as { id: number }[];
      for (const [c, child] of parent.children.entries()) {
        await queryRunner.query(
          `INSERT INTO "blog_category" ("parentId", "nameEn", "nameVi", "slugEn", "slugVi", "sortOrder")
           SELECT $1::int, $2::varchar, $3::varchar, $4::varchar, $5::varchar, $6::int
            WHERE NOT EXISTS (SELECT 1 FROM "blog_category"
                               WHERE "parentId" = $1 AND "slugEn" = $4)`,
          [
            id,
            child.en,
            child.vi,
            blogCategorySlug(child.en),
            blogCategorySlug(child.vi),
            c,
          ],
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "blog_category"`);
  }
}
