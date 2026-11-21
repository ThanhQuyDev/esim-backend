import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A note for a whole device category (vande-2011 #031, row 32): "Ghi chú
 * theo danh mục thiết bị" — watches, tablets, laptops — shown under the tab's
 * lead line, next to the per-brand notes. A note with a `deviceType` belongs
 * to that category; its `manufacturer` is left empty.
 */
export class CategoryNotes1807200000000 implements MigrationInterface {
  name = 'CategoryNotes1807200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "manufacturer_note" ADD COLUMN IF NOT EXISTS "deviceType" varchar NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "manufacturer_note" WHERE "deviceType" IS NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "manufacturer_note" DROP COLUMN IF EXISTS "deviceType"`,
    );
  }
}
