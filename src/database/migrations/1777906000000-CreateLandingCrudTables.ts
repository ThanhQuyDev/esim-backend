import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateLandingCrudTables1777906000000 implements MigrationInterface {
  name = 'CreateLandingCrudTables1777906000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "footer" ("categories" character varying, "url" character varying NOT NULL, "title" character varying NOT NULL, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_footer_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "hero_banner" ("active" boolean NOT NULL, "imageId" uuid, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "REL_hero_banner_imageId" UNIQUE ("imageId"), CONSTRAINT "PK_hero_banner_id" PRIMARY KEY ("id"))`,
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
      `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_hero_banner_imageId_file') THEN
          ALTER TABLE "hero_banner" ADD CONSTRAINT "FK_hero_banner_imageId_file" FOREIGN KEY ("imageId") REFERENCES "file"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
      END $$;`,
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
    await queryRunner.query(
      `ALTER TABLE "hero_banner" DROP CONSTRAINT IF EXISTS "FK_hero_banner_imageId_file"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "top_bar"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "hero_banner"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "footer"`);
  }
}
