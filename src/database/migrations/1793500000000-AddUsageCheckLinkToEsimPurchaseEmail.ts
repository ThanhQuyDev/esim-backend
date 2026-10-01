import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * #003 — Put the "Kiểm tra dung lượng & ưu đãi" link in the eSIM delivery email,
 * so a customer can follow their usage without signing in and can forward the
 * link to whoever is travelling with the eSIM.
 *
 * Unlike the earlier refresh migration, this one does NOT rewrite the whole body:
 * admins edit `esim_purchase` from the CMS and those edits have to survive. It
 * splices the new block in ahead of the footer and skips any row that already
 * mentions `usageCheckUrl`, so re-running it is a no-op. A body that has been
 * edited past recognition (no `<!-- Footer -->` anchor) is left untouched — the
 * block can then be pasted in from the CMS.
 */

const USAGE_CHECK_BLOCK = `<!-- Usage lookup (#003) -->
          {{#if usageCheckUrl}}
          <tr>
            <td style="padding:0 32px 24px">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px">
                <tr>
                  <td style="padding:16px;text-align:center">
                    <p style="margin:0 0 4px;font-size:15px;color:#1e3a8a;font-weight:600">Kiểm tra dung lượng &amp; ưu đãi của eSIM</p>
                    <p style="margin:0 0 12px;font-size:13px;color:#475569">Theo dõi dung lượng còn lại và ngày hết hạn bất cứ lúc nào — không cần đăng nhập. / Check your remaining data and expiry date anytime, no sign-in needed.</p>
                    <a href="{{usageCheckUrl}}"
                       style="display:inline-block;padding:12px 24px;background:#1d4ed8;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;font-family:Arial,sans-serif">
                      Tra cứu eSIM / Check eSIM
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          {{/if}}
          `;

export class AddUsageCheckLinkToEsimPurchaseEmail1793500000000 implements MigrationInterface {
  name = 'AddUsageCheckLinkToEsimPurchaseEmail1793500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const block = (USAGE_CHECK_BLOCK + '<!-- Footer -->').replace(/'/g, "''");
    await queryRunner.query(`
      UPDATE "email_template"
      SET "htmlBody" = replace("htmlBody", '<!-- Footer -->', '${block}'),
          "updatedAt" = now()
      WHERE "name" = 'esim_purchase'
        AND "htmlBody" LIKE '%<!-- Footer -->%'
        AND "htmlBody" NOT LIKE '%usageCheckUrl%'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const block = (USAGE_CHECK_BLOCK + '<!-- Footer -->').replace(/'/g, "''");
    await queryRunner.query(`
      UPDATE "email_template"
      SET "htmlBody" = replace("htmlBody", '${block}', '<!-- Footer -->'),
          "updatedAt" = now()
      WHERE "name" = 'esim_purchase'
    `);
  }
}
