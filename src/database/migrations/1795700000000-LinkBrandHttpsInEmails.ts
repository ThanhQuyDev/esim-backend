import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The brand name in the stored email templates links to https://esim.vn
 * (#012, test round 4).
 *
 * The footer printed "© {{app_name}}" as bare text. Mail clients turn
 * anything that looks like a domain into a link, and they make it http — so
 * customers got "ESIM.VN" pointing at http://esim.vn. Every visible
 * `{{app_name}}` is wrapped in an explicit https link instead; the ones inside
 * an attribute (`alt="{{app_name}}"`) are left alone, and subjects are not
 * HTML. (The name itself is now "ESIM.VN" from code, not the API's APP_NAME.)
 */
export const BRAND_LINK =
  '<a href="https://esim.vn" style="color:inherit;text-decoration:none">{{app_name}}</a>';

/** A visible `{{app_name}}`: not right after `="` / `"`. */
export const VISIBLE_APP_NAME = '([^"=])\\{\\{app_name\\}\\}';

export class LinkBrandHttpsInEmails1795700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "email_template"
          SET "htmlBody" = regexp_replace("htmlBody", $1, $2, 'g'),
              "updatedAt" = now()
        WHERE "htmlBody" ~ $1
          AND position($3 in "htmlBody") = 0`,
      [VISIBLE_APP_NAME, `\\1${BRAND_LINK}`, BRAND_LINK],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "email_template"
          SET "htmlBody" = replace("htmlBody", $1, '{{app_name}}')`,
      [BRAND_LINK],
    );
  }
}
