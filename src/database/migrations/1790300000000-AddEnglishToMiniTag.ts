import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * English copy for blog mini tags (#059).
 *
 * All optional: an English post falls back to the Vietnamese text until the
 * admin fills them in.
 */
export class AddEnglishToMiniTag1790300000000 implements MigrationInterface {
  name = 'AddEnglishToMiniTag1790300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const column of [
      'titleEn',
      'descriptionEn',
      'contentButtonEn',
      'linkUrlEn',
    ]) {
      await queryRunner.query(
        `ALTER TABLE "mini_tag" ADD COLUMN IF NOT EXISTS "${column}" character varying`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const column of [
      'linkUrlEn',
      'contentButtonEn',
      'descriptionEn',
      'titleEn',
    ]) {
      await queryRunner.query(
        `ALTER TABLE "mini_tag" DROP COLUMN IF EXISTS "${column}"`,
      );
    }
  }
}
