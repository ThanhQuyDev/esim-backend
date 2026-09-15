import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Author name and summary in English as well as Vietnamese (#025).
 *
 * Both are optional: an English article falls back to the Vietnamese text until
 * the admin fills them in.
 */
export class AddEnglishToAuthorProfile1789800000000 implements MigrationInterface {
  name = 'AddEnglishToAuthorProfile1789800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "author_profile" ADD COLUMN IF NOT EXISTS "nameEn" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "author_profile" ADD COLUMN IF NOT EXISTS "descriptionEn" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "author_profile" DROP COLUMN IF EXISTS "descriptionEn"`,
    );
    await queryRunner.query(
      `ALTER TABLE "author_profile" DROP COLUMN IF EXISTS "nameEn"`,
    );
  }
}
