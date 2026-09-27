import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Say what to sign in with, in the approval email (#004).
 *
 * The button's URL is built in code (it now points at the partner portal's
 * sign-in page); this is the sentence next to it, which never said that the
 * login is the email and password from the application form.
 */

const OLD_TEXT = `                Bạn có thể đăng nhập để tạo liên kết giới thiệu và theo dõi hoa hồng.`;

const NEW_TEXT = `                Bạn đăng nhập trang quản lý đối tác bằng <strong>email</strong> và
                <strong>mật khẩu</strong> đã điền khi đăng ký để tạo liên kết giới thiệu
                và theo dõi hoa hồng.`;

const OLD_BUTTON = `                Vào trang đối tác`;

const NEW_BUTTON = `                Đăng nhập trang đối tác`;

function swap(pairs: [string, string][]): string {
  const expression = pairs.reduce(
    (sql, [from, to]) =>
      `REPLACE(${sql}, '${from.replace(/'/g, "''")}', '${to.replace(/'/g, "''")}')`,
    '"htmlBody"',
  );

  return `
    UPDATE "email_template"
    SET "htmlBody" = ${expression}
    WHERE "name" = 'partner_application_approved'
  `;
}

export class PointPartnerApprovedEmailAtPortalLogin1790600000000 implements MigrationInterface {
  name = 'PointPartnerApprovedEmailAtPortalLogin1790600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      swap([
        [OLD_TEXT, NEW_TEXT],
        [OLD_BUTTON, NEW_BUTTON],
      ]),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      swap([
        [NEW_TEXT, OLD_TEXT],
        [NEW_BUTTON, OLD_BUTTON],
      ]),
    );
  }
}
