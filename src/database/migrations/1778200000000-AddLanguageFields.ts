import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLanguageFields1778200000000 implements MigrationInterface {
  name = 'AddLanguageFields1778200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add language column to hero_banner
    await queryRunner.query(
      `ALTER TABLE "hero_banner" ADD COLUMN IF NOT EXISTS "language" character varying NOT NULL DEFAULT 'en'`,
    );

    // Add language column to top_bar
    await queryRunner.query(
      `ALTER TABLE "top_bar" ADD COLUMN IF NOT EXISTS "language" character varying NOT NULL DEFAULT 'en'`,
    );

    // Drop language-specific columns from top_bar
    await queryRunner.query(
      `ALTER TABLE "top_bar" DROP COLUMN IF EXISTS "buttonContentVi"`,
    );
    await queryRunner.query(
      `ALTER TABLE "top_bar" DROP COLUMN IF EXISTS "titleVi"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Restore language-specific columns to top_bar
    await queryRunner.query(
      `ALTER TABLE "top_bar" ADD COLUMN IF NOT EXISTS "buttonContentVi" character varying NOT NULL DEFAULT ''`,
    );
    await queryRunner.query(
      `ALTER TABLE "top_bar" ADD COLUMN IF NOT EXISTS "titleVi" character varying NOT NULL DEFAULT ''`,
    );

    // Drop language columns
    await queryRunner.query(
      `ALTER TABLE "top_bar" DROP COLUMN IF EXISTS "language"`,
    );
    await queryRunner.query(
      `ALTER TABLE "hero_banner" DROP COLUMN IF EXISTS "language"`,
    );
  }
}
