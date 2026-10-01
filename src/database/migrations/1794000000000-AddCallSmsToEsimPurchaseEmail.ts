import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * #023 — state the call minutes and SMS in the eSIM delivery email.
 *
 * A customer who bought a call-and-SMS eSIM was never told so: not in this email,
 * not in their profile, not in the CMS. This adds the two rows to the details
 * table, right after the plan.
 *
 * Like the #003 migration, it splices rather than rewrites: admins edit this
 * template from the CMS and those edits have to survive. It skips a row that
 * already mentions `callMinutes`, so re-running it is a no-op.
 */

const CALL_SMS_ROWS = `{{#if callMinutes}}
                <tr>
                  <td style="padding:8px 16px;border-top:1px solid #eee">
                    <p style="margin:0;font-size:13px;color:#888">Phút gọi / Call minutes</p>
                    <p style="margin:4px 0 0;font-size:15px;color:#333;font-weight:600">{{callMinutes}}</p>
                  </td>
                </tr>
                {{/if}}
                {{#if smsCount}}
                <tr>
                  <td style="padding:8px 16px;border-top:1px solid #eee">
                    <p style="margin:0;font-size:13px;color:#888">Tin nhắn SMS / SMS</p>
                    <p style="margin:4px 0 0;font-size:15px;color:#333;font-weight:600">{{smsCount}}</p>
                  </td>
                </tr>
                {{/if}}
                `;

/** The ICCID row, which the new rows are inserted in front of. */
const ICCID_ROW_ANCHOR = `<p style="margin:0;font-size:13px;color:#888">ICCID</p>`;

export class AddCallSmsToEsimPurchaseEmail1794000000000 implements MigrationInterface {
  name = 'AddCallSmsToEsimPurchaseEmail1794000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Insert before the <tr> that holds the ICCID: anchor on the label, then
    // rebuild the row opening around it.
    const anchor = `<tr>
                  <td style="padding:8px 16px;border-top:1px solid #eee">
                    ${ICCID_ROW_ANCHOR}`;
    const replacement = (CALL_SMS_ROWS + anchor).replace(/'/g, "''");

    await queryRunner.query(`
      UPDATE "email_template"
      SET "htmlBody" = replace("htmlBody", '${anchor.replace(/'/g, "''")}', '${replacement}'),
          "updatedAt" = now()
      WHERE "name" = 'esim_purchase'
        AND "htmlBody" LIKE '%${ICCID_ROW_ANCHOR.replace(/'/g, "''")}%'
        AND "htmlBody" NOT LIKE '%callMinutes%'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "email_template"
      SET "htmlBody" = replace("htmlBody", '${CALL_SMS_ROWS.replace(/'/g, "''")}', ''),
          "updatedAt" = now()
      WHERE "name" = 'esim_purchase'
    `);
  }
}
