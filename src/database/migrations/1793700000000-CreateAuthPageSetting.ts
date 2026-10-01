import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * #006 — Make the sign-in pages editable, and seed them with real esim.vn copy.
 *
 * Both deployments shipped the starter kit's placeholder: a generic "Logo" glyph
 * and a testimonial from "Random Dude" about how much time the template saved
 * him. Partners were reading that on the page where they first meet esim.vn.
 */
export class CreateAuthPageSetting1793700000000 implements MigrationInterface {
  name = 'CreateAuthPageSetting1793700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "auth_page_setting" (
        "mode" character varying(16) NOT NULL,
        "logoUrl" character varying(500),
        "logoText" character varying(120),
        "coverImageUrl" character varying(500),
        "quote" character varying(500),
        "quoteAuthor" character varying(120),
        "heading" character varying(120),
        "subheading" character varying(300),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_auth_page_setting" PRIMARY KEY ("mode")
      )
    `);

    await queryRunner.query(`
      INSERT INTO "auth_page_setting"
        ("mode", "logoText", "quote", "quoteAuthor", "heading", "subheading")
      VALUES
        (
          'admin',
          'esim.vn',
          'Quản lý gói cước, đơn hàng và eSIM của toàn hệ thống tại một nơi.',
          'esim.vn',
          'Đăng nhập quản trị',
          'Nhập email và mật khẩu quản trị để vào hệ thống.'
        ),
        (
          'partner',
          'esim.vn — Cổng đối tác',
          'Bán eSIM cho khách của bạn, theo dõi hoa hồng và đối soát minh bạch theo từng đơn.',
          'esim.vn',
          'Đăng nhập đối tác',
          'Nhập email và mật khẩu bạn đã đăng ký để vào cổng đối tác.'
        )
      ON CONFLICT ("mode") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "auth_page_setting"`);
  }
}
