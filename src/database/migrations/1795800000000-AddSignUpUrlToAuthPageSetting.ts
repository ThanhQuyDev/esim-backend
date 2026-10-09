import { MigrationInterface, QueryRunner } from 'typeorm';

/** Link of the sign-in page's "Đăng ký" button, set in the CMS (#016). */
export class AddSignUpUrlToAuthPageSetting1795800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "auth_page_setting" ADD COLUMN IF NOT EXISTS "signUpUrl" character varying(500)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "auth_page_setting" DROP COLUMN IF EXISTS "signUpUrl"`,
    );
  }
}
