import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fix the branding of the invoice-request email (#079).
 *
 * Two things were wrong with the stored `invoice_issued` template:
 *   • the header was a plain-text line, so the email carried no logo at all
 *     (the sender never passed `logoUrl` either — that side is fixed in
 *     `MailService.sendInvoiceIssued`);
 *   • the footer told customers to write to `support@esim.vn`, a mailbox we do
 *     not read. The address support answers on is `hotro@esim.com.vn`.
 *
 * The template lives in a table admins can edit, so this migration does two
 * targeted replacements instead of overwriting the row: an edited template
 * keeps its edits, and a replacement that no longer matches simply does
 * nothing. The old address is swapped everywhere it appears (the `mailto:`
 * link and the visible text both).
 */

export const OLD_EMAIL = 'support@esim.vn';
export const NEW_EMAIL = 'hotro@esim.com.vn';

/**
 * The invoice email is rendered with a `supportEmail` context value, so the
 * address lives in one place in code (`mail-branding.ts`) rather than being
 * baked into the stored HTML a second time.
 */
export const SUPPORT_PLACEHOLDER = '{{supportEmail}}';

/** The seeded header cell: brand name and title as text, teal background. */
export const TEXT_HEADER = `          <tr style="background:#00838f">
            <td style="padding:24px;text-align:center;color:#ffffff;font-size:24px;font-weight:700">
              {{app_name}} — Hóa đơn điện tử
            </td>
          </tr>`;

/** Same header with the logo, matching the eSIM delivery email. */
export const LOGO_HEADER = `          <tr style="background:#ffffff;border-bottom:1px solid #e5e7eb">
            <td style="padding:24px;text-align:center;background:#ffffff">
              {{#if logoUrl}}
              <img src="{{logoUrl}}" alt="{{app_name}}" height="48" style="max-height:48px;display:inline-block;border:0;outline:none;text-decoration:none" />
              {{else}}
              <span style="color:#00838f;font-size:24px;font-weight:700">{{app_name}}</span>
              {{/if}}
              <p style="margin:8px 0 0;font-size:15px;color:#00838f;font-weight:600">Hóa đơn điện tử</p>
            </td>
          </tr>`;

function sqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

export class FixInvoiceEmailBranding1788025100000 implements MigrationInterface {
  name = 'FixInvoiceEmailBranding1788025100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "email_template"
      SET "htmlBody" = REPLACE(
        REPLACE("htmlBody", ${sqlLiteral(TEXT_HEADER)}, ${sqlLiteral(LOGO_HEADER)}),
        ${sqlLiteral(OLD_EMAIL)},
        ${sqlLiteral(SUPPORT_PLACEHOLDER)}
      )
      WHERE "name" = 'invoice_issued'
    `);

    // Any other template that still carries the dead address gets it fixed too.
    await queryRunner.query(`
      UPDATE "email_template"
      SET "htmlBody" = REPLACE("htmlBody", ${sqlLiteral(OLD_EMAIL)}, ${sqlLiteral(NEW_EMAIL)})
      WHERE "htmlBody" LIKE ${sqlLiteral(`%${OLD_EMAIL}%`)}
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "email_template"
      SET "htmlBody" = REPLACE(
        REPLACE("htmlBody", ${sqlLiteral(LOGO_HEADER)}, ${sqlLiteral(TEXT_HEADER)}),
        ${sqlLiteral(SUPPORT_PLACEHOLDER)},
        ${sqlLiteral(OLD_EMAIL)}
      )
      WHERE "name" = 'invoice_issued'
    `);
  }
}
