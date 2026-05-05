import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateHeroBannerFields1777907000000 implements MigrationInterface {
  name = 'UpdateHeroBannerFields1777907000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add new columns
    await queryRunner.query(
      `ALTER TABLE "hero_banner" ADD COLUMN IF NOT EXISTS "title" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "hero_banner" ADD COLUMN IF NOT EXISTS "firstIcon" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "hero_banner" ADD COLUMN IF NOT EXISTS "firstContent" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "hero_banner" ADD COLUMN IF NOT EXISTS "secondIcon" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "hero_banner" ADD COLUMN IF NOT EXISTS "secondContent" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "hero_banner" ADD COLUMN IF NOT EXISTS "description" character varying`,
    );

    // Fill with empty string for existing rows
    await queryRunner.query(
      `UPDATE "hero_banner" SET "title" = COALESCE("title", ''), "firstIcon" = COALESCE("firstIcon", ''), "firstContent" = COALESCE("firstContent", ''), "secondIcon" = COALESCE("secondIcon", ''), "secondContent" = COALESCE("secondContent", ''), "description" = COALESCE("description", '')`,
    );

    // Set NOT NULL constraints
    await queryRunner.query(
      `ALTER TABLE "hero_banner" ALTER COLUMN "title" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "hero_banner" ALTER COLUMN "firstIcon" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "hero_banner" ALTER COLUMN "firstContent" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "hero_banner" ALTER COLUMN "secondIcon" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "hero_banner" ALTER COLUMN "secondContent" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "hero_banner" ALTER COLUMN "description" SET NOT NULL`,
    );

    // Drop old image column
    await queryRunner.query(
      `ALTER TABLE "hero_banner" DROP COLUMN IF EXISTS "image"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Restore image column
    await queryRunner.query(
      `ALTER TABLE "hero_banner" ADD COLUMN IF NOT EXISTS "image" character varying`,
    );

    // Drop new columns
    await queryRunner.query(
      `ALTER TABLE "hero_banner" DROP COLUMN IF EXISTS "title"`,
    );
    await queryRunner.query(
      `ALTER TABLE "hero_banner" DROP COLUMN IF EXISTS "firstIcon"`,
    );
    await queryRunner.query(
      `ALTER TABLE "hero_banner" DROP COLUMN IF EXISTS "firstContent"`,
    );
    await queryRunner.query(
      `ALTER TABLE "hero_banner" DROP COLUMN IF EXISTS "secondIcon"`,
    );
    await queryRunner.query(
      `ALTER TABLE "hero_banner" DROP COLUMN IF EXISTS "secondContent"`,
    );
    await queryRunner.query(
      `ALTER TABLE "hero_banner" DROP COLUMN IF EXISTS "description"`,
    );
  }
}
