import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * "Danh sách Nhà cung cấp" (vande-1411 #024): every supplier gets a name and
 * the masked code the overview shows, kept with its on/off switch. The current
 * suppliers start with the names and codes the CMS used so far; a row the admin
 * already named keeps its name.
 */
export class ProviderRegistry1806100000000 implements MigrationInterface {
  name = 'ProviderRegistry1806100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "provider_sales_status"
         ADD COLUMN IF NOT EXISTS "displayName" varchar(120),
         ADD COLUMN IF NOT EXISTS "shortCode" varchar(16),
         ADD COLUMN IF NOT EXISTS "isManual" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `INSERT INTO "provider_sales_status" ("provider", "displayName", "shortCode")
       VALUES
         ('airalo', 'Airalo', 'AI'),
         ('esimaccess', 'eSIM Access', 'EA'),
         ('gadgetkorea', 'Gadget Korea', 'GK'),
         ('microesim', 'MicroEsim', 'MI'),
         ('billion', 'Billion Connect', 'BL'),
         ('viettel', 'Viettel', 'VT'),
         ('viettel-noidia', 'Viettel nội địa', 'VT-ND'),
         ('itel-noidia', 'iTel nội địa', 'IT-ND'),
         ('wintel-noidia', 'Wintel nội địa', 'WT-ND'),
         ('vnsky-noidia', 'VNSKY nội địa', 'VS-ND')
       ON CONFLICT ("provider") DO UPDATE SET
         "displayName" = COALESCE("provider_sales_status"."displayName", EXCLUDED."displayName"),
         "shortCode" = COALESCE("provider_sales_status"."shortCode", EXCLUDED."shortCode")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "provider_sales_status"
         DROP COLUMN IF EXISTS "isManual",
         DROP COLUMN IF EXISTS "shortCode",
         DROP COLUMN IF EXISTS "displayName"`,
    );
  }
}
