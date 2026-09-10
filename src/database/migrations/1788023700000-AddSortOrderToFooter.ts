import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSortOrderToFooter1788023700000 implements MigrationInterface {
  name = 'AddSortOrderToFooter1788023700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "footer" ADD "sortOrder" integer NOT NULL DEFAULT 0`,
    );
    // Preserve the current visible order for existing rows. New rows can then
    // be placed explicitly before/after them from CMS.
    await queryRunner.query(`
      WITH ranked AS (
        SELECT "id", (ROW_NUMBER() OVER (ORDER BY "createdAt" ASC, "id" ASC) * 10)::int AS position
        FROM "footer"
      )
      UPDATE "footer" AS f
      SET "sortOrder" = ranked.position
      FROM ranked
      WHERE f."id" = ranked."id"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "footer" DROP COLUMN "sortOrder"`);
  }
}
