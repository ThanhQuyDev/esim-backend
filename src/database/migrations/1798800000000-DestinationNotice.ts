import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * "Ghi chú" on a destination / region (doitac-1410 #078): rich text shown at
 * the top of its website page, e.g. for Turkey, India, China.
 */
export class DestinationNotice1798800000000 implements MigrationInterface {
  name = 'DestinationNotice1798800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['destination', 'region']) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "notice" text`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "noticeVi" text`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['destination', 'region']) {
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP COLUMN IF EXISTS "noticeVi"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP COLUMN IF EXISTS "notice"`,
      );
    }
  }
}
