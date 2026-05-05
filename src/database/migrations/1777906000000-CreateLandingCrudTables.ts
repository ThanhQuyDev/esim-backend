import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateLandingCrudTables1777906000000 implements MigrationInterface {
  name = 'CreateLandingCrudTables1777906000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "footer" ("categories" character varying, "url" character varying NOT NULL, "title" character varying NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_footer_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "hero_banner" ("active" boolean NOT NULL, "title" character varying NOT NULL, "firstIcon" character varying NOT NULL, "firstContent" character varying NOT NULL, "secondIcon" character varying NOT NULL, "secondContent" character varying NOT NULL, "description" character varying NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_hero_banner_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "top_bar" ("url" character varying NOT NULL, "buttonContent" character varying NOT NULL, "title" character varying NOT NULL, "iconId" uuid, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "REL_top_bar_iconId" UNIQUE ("iconId"), CONSTRAINT "PK_top_bar_id" PRIMARY KEY ("id"))`,
    );

    await queryRunner.query(
      `ALTER TABLE "footer" ADD COLUMN IF NOT EXISTS "titleVi" character varying`,
    );
    await queryRunner.query(
      `UPDATE "footer" SET "titleVi" = COALESCE("titleVi", "title", '')`,
    );
    await queryRunner.query(
      `ALTER TABLE "footer" ALTER COLUMN "titleVi" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "top_bar" ADD COLUMN IF NOT EXISTS "titleVi" character varying`,
    );
    await queryRunner.query(
      `UPDATE "top_bar" SET "titleVi" = COALESCE("titleVi", "title", '')`,
    );
    await queryRunner.query(
      `ALTER TABLE "top_bar" ALTER COLUMN "titleVi" SET NOT NULL`,
    );

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
    await queryRunner.query(
      `UPDATE "hero_banner" SET "title" = COALESCE("title", ''), "firstIcon" = COALESCE("firstIcon", ''), "firstContent" = COALESCE("firstContent", ''), "secondIcon" = COALESCE("secondIcon", ''), "secondContent" = COALESCE("secondContent", ''), "description" = COALESCE("description", '')`,
    );
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
    await queryRunner.query(
      `ALTER TABLE "hero_banner" DROP CONSTRAINT IF EXISTS "FK_hero_banner_imageId_file"`,
    );
    await queryRunner.query(
      `ALTER TABLE "hero_banner" DROP CONSTRAINT IF EXISTS "REL_hero_banner_imageId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "hero_banner" DROP COLUMN IF EXISTS "imageId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "hero_banner" DROP COLUMN IF EXISTS "image"`,
    );
    await queryRunner.query(
      `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_top_bar_iconId_file') THEN
          ALTER TABLE "top_bar" ADD CONSTRAINT "FK_top_bar_iconId_file" FOREIGN KEY ("iconId") REFERENCES "file"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
      END $$;`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "top_bar" DROP CONSTRAINT IF EXISTS "FK_top_bar_iconId_file"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "top_bar"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "hero_banner"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "footer"`);
  }
}
