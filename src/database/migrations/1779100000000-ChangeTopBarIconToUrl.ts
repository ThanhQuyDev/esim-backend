import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChangeTopBarIconToUrl1779100000000 implements MigrationInterface {
  name = 'ChangeTopBarIconToUrl1779100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key & old iconId column
    await queryRunner.query(
      `ALTER TABLE "top_bar" DROP CONSTRAINT IF EXISTS "FK_top_bar_iconId_file"`,
    );
    await queryRunner.query(
      `ALTER TABLE "top_bar" DROP CONSTRAINT IF EXISTS "REL_top_bar_iconId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "top_bar" DROP COLUMN IF EXISTS "iconId"`,
    );

    // Add new icon column as a plain URL string
    await queryRunner.query(
      `ALTER TABLE "top_bar" ADD COLUMN IF NOT EXISTS "icon" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "top_bar" DROP COLUMN IF EXISTS "icon"`,
    );
    await queryRunner.query(
      `ALTER TABLE "top_bar" ADD COLUMN IF NOT EXISTS "iconId" uuid`,
    );
    await queryRunner.query(
      `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'REL_top_bar_iconId') THEN
          ALTER TABLE "top_bar" ADD CONSTRAINT "REL_top_bar_iconId" UNIQUE ("iconId");
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
}
