import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Footer link URL for the English site (#043).
 *
 * `url` keeps the Vietnamese URL the rows already hold; the English site uses
 * `urlEn` and falls back to `url` while it is empty.
 */
export class AddUrlEnToFooter1789900000000 implements MigrationInterface {
  name = 'AddUrlEnToFooter1789900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "footer" ADD COLUMN IF NOT EXISTS "urlEn" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "footer" DROP COLUMN IF EXISTS "urlEn"`,
    );
  }
}
