import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Several notes per brand on the supported-devices page (vande #042).
 *
 * A brand could hold one note per language, so every caveat about iPhones had
 * to be packed into one long note; the CMS refused a second one. The unique
 * constraint goes, and a sort order decides how a brand's notes are listed.
 */
export class ManufacturerNotesMany1800300000000 implements MigrationInterface {
  name = 'ManufacturerNotesMany1800300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "manufacturer_note" DROP CONSTRAINT IF EXISTS "UQ_manufacturer_note_brand_language"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_manufacturer_note_brand_language"`,
    );
    await queryRunner.query(
      `ALTER TABLE "manufacturer_note" ADD COLUMN IF NOT EXISTS "sortOrder" integer NOT NULL DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "manufacturer_note" DROP COLUMN IF EXISTS "sortOrder"`,
    );
  }
}
