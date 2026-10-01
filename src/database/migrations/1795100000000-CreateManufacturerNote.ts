import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Per-brand notes on the supported-devices page (#079).
 *
 * The page could only show one note: a single string in the storefront's locale
 * file, hard-coded to appear under "iPhone". No other brand could carry a caveat,
 * and changing the iPhone wording took a deploy.
 *
 * The iPhone note the page shows today is seeded in both languages, so the page
 * looks the same the moment this runs and the text becomes editable rather than
 * disappearing. The storefront keeps its locale string as a fallback for the case
 * where this table has nothing yet.
 */
export class CreateManufacturerNote1795100000000 implements MigrationInterface {
  name = 'CreateManufacturerNote1795100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "manufacturer_note" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "manufacturer" character varying NOT NULL,
        "language" character varying NOT NULL DEFAULT 'vi',
        "note" text NOT NULL,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_manufacturer_note_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_manufacturer_note_brand_language" UNIQUE ("manufacturer", "language")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_manufacturer_note_manufacturer" ON "manufacturer_note" ("manufacturer")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_manufacturer_note_language" ON "manufacturer_note" ("language")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_manufacturer_note_isActive" ON "manufacturer_note" ("isActive")`,
    );

    // The wording currently hard-coded in the storefront's locale files, so the
    // page is unchanged on deploy. ON CONFLICT keeps a re-run harmless and does
    // not overwrite an edit someone has already made.
    await queryRunner.query(
      `INSERT INTO "manufacturer_note" ("manufacturer", "language", "note")
       VALUES ('iPhone', 'vi', $1), ('iPhone', 'en', $2)
       ON CONFLICT ("manufacturer", "language") DO NOTHING`,
      [
        'iPhone bán ở Trung Quốc đại lục không hỗ trợ eSIM, và chỉ một số model iPhone bán ở Hồng Kông và Macao hỗ trợ eSIM. Nếu bạn mua iPhone ở các quốc gia này, hãy kiểm tra xem iPhone của bạn có tương thích eSIM trước khi cài đặt ứng dụng eSIM.',
        'iPhones sold in mainland China do not support eSIM, and only some iPhone models sold in Hong Kong and Macao do. If you bought your iPhone in one of these places, check that it is eSIM-compatible before installing an eSIM app.',
      ],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "manufacturer_note"`);
  }
}
