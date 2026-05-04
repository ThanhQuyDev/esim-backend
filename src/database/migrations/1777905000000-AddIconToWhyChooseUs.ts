import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIconToWhyChooseUs1777905000000 implements MigrationInterface {
  name = 'AddIconToWhyChooseUs1777905000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "why_choose_us" ADD IF NOT EXISTS "icon" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "why_choose_us" DROP COLUMN IF EXISTS "icon"`,
    );
  }
}
