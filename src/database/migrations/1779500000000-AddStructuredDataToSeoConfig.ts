import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Feature 4.1 — Bổ sung trường `structured_data` (LongText) vào bảng
 * `seo_config` để admin có thể dán JSON-LD / Google Analytics / scripts của
 * bên thứ ba và để frontend chèn nguyên văn xuống cuối thẻ <head> sau các
 * thẻ <meta />.
 */
export class AddStructuredDataToSeoConfig1779500000000 implements MigrationInterface {
  name = 'AddStructuredDataToSeoConfig1779500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "seo_config" ADD COLUMN IF NOT EXISTS "structuredData" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "seo_config" DROP COLUMN IF EXISTS "structuredData"`,
    );
  }
}
