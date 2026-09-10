import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Bilingual footer column headings (#088).
 *
 * A footer row already carries `title` + `titleVi`, so the LINK text switches
 * language — but the heading it sits under, `categories`, is a single string.
 * Whatever the admin typed showed on both sites, and worse, it doubles as the
 * grouping key: typing "Sản phẩm" on some rows and "Products" on others split
 * one column into two.
 *
 * `categories` stays the default (English) heading and the grouping key;
 * `categoriesVi` is the Vietnamese heading, exactly mirroring title/titleVi.
 */
export class AddCategoriesViToFooter1788025400000 implements MigrationInterface {
  name = 'AddCategoriesViToFooter1788025400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "footer" ADD COLUMN IF NOT EXISTS "categoriesVi" character varying`,
    );
    // Existing rows keep showing what they show today until an admin fills in
    // the Vietnamese heading: same text in both languages, no blank columns.
    await queryRunner.query(
      `UPDATE "footer" SET "categoriesVi" = "categories" WHERE "categoriesVi" IS NULL AND "categories" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "footer" DROP COLUMN "categoriesVi"`);
  }
}
