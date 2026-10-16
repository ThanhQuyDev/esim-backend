import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The eSIM email in a distribution partner's brand (doitac-1410 #044).
 *
 * Every placeholder falls back to what the email said before, so esim.vn's own
 * orders render unchanged: logo centred, black iOS button, esim.vn footer, no
 * setup-guide block. Each step is a `replace` of an exact piece of the stock
 * template and is skipped when that piece is gone (an admin edited it in the
 * CMS) or already applied.
 */

export const STEPS: { from: string; to: string; marker: string }[] = [
  {
    // Logo position: left / center / right.
    from: '<td style="padding:24px;text-align:center;background:#ffffff">',
    to: '<td style="padding:24px;text-align:{{#if logoAlign}}{{logoAlign}}{{else}}center{{/if}};background:#ffffff">',
    marker: '{{logoAlign}}',
  },
  {
    // "Màu chủ đạo" on the one-tap iOS install button.
    from: 'padding:14px 20px;background:#000000;color:#ffffff',
    to: 'padding:14px 20px;background:{{#if brandColor}}{{brandColor}}{{else}}#000000{{/if}};color:#ffffff',
    marker: '{{brandColor}}',
  },
  {
    // "Hướng dẫn cài đặt eSIM" — only when a partner turned it on.
    from: '<!-- Footer -->',
    to: `{{#if installGuideUrl}}
          <tr>
            <td style="padding:0 32px 24px">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px">
                <tr>
                  <td style="padding:16px;text-align:center">
                    <p style="margin:0 0 4px;font-size:15px;color:#111827;font-weight:600">Hướng dẫn cài đặt eSIM</p>
                    <p style="margin:0 0 12px;font-size:13px;color:#475569">Các bước cài đặt và kích hoạt eSIM trên iPhone và Android. / How to install and activate your eSIM.</p>
                    <a href="{{installGuideUrl}}" style="display:inline-block;padding:12px 24px;background:{{#if brandColor}}{{brandColor}}{{else}}#000000{{/if}};color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;font-family:Arial,sans-serif">Xem hướng dẫn / View guide</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          {{/if}}
          <!-- Footer -->`,
    marker: '{{installGuideUrl}}',
  },
  {
    // The partner's name, slogan, website and support email in the footer.
    from: '&copy; <a href="https://esim.vn" style="color:inherit;text-decoration:none">{{app_name}}</a> — If you did not make this purchase, please contact support.',
    to: `{{#if partnerFooter}}<p style="margin:0;font-size:13px;color:#333;font-weight:600">{{partnerName}}</p>{{#if partnerTagline}}<p style="margin:4px 0 0">{{partnerTagline}}</p>{{/if}}{{#if partnerWebsite}}<p style="margin:4px 0 0"><a href="{{partnerWebsite}}" style="color:{{#if brandColor}}{{brandColor}}{{else}}#999{{/if}}">{{partnerWebsite}}</a></p>{{/if}}{{#if partnerSupportEmail}}<p style="margin:4px 0 0">Hỗ trợ / Support: <a href="mailto:{{partnerSupportEmail}}" style="color:{{#if brandColor}}{{brandColor}}{{else}}#999{{/if}}">{{partnerSupportEmail}}</a></p>{{/if}}{{else}}&copy; <a href="https://esim.vn" style="color:inherit;text-decoration:none">{{app_name}}</a> — If you did not make this purchase, please contact support.{{/if}}`,
    marker: '{{partnerName}}',
  },
];

export class PartnerBrandEsimEmail1798200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const step of STEPS) {
      await queryRunner.query(
        `UPDATE "email_template"
            SET "htmlBody" = replace("htmlBody", $1, $2), "updatedAt" = now()
          WHERE name = 'esim_purchase'
            AND position($1 in "htmlBody") > 0
            AND position($3 in "htmlBody") = 0`,
        [step.from, step.to, step.marker],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const step of [...STEPS].reverse()) {
      await queryRunner.query(
        `UPDATE "email_template"
            SET "htmlBody" = replace("htmlBody", $2, $1), "updatedAt" = now()
          WHERE name = 'esim_purchase'`,
        [step.from, step.to],
      );
    }
  }
}
