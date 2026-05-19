import { MigrationInterface, QueryRunner } from 'typeorm';

export class TrimWhyChooseUsType1779600000000 implements MigrationInterface {
  name = 'TrimWhyChooseUsType1779600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Normalize existing values: trim leading/trailing whitespace (incl. NBSP)
    // so equality filters work reliably on `type`.
    await queryRunner.query(`
      UPDATE "why_choose_us"
      SET "type" = NULLIF(TRIM(BOTH FROM REPLACE("type", CHR(160), ' ')), '')
      WHERE "type" IS NOT NULL
        AND "type" <> TRIM(BOTH FROM REPLACE("type", CHR(160), ' '));
    `);
  }

  public async down(): Promise<void> {
    // Data normalization; no rollback.
  }
}
