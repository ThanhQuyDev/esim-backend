import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * doitac-0911 #019 — the eSIM email:
 * - "Kiểm tra dung lượng & ưu đãi của eSIM" and "Hướng dẫn cài đặt eSIM" get
 *   their English beside them, as the rest of the email has;
 * - a partner's "Điện thoại liên hệ" in the footer, above "Hỗ trợ / Support".
 * Each step replaces an exact piece and is skipped once applied or when an
 * admin has rewritten that piece in the CMS.
 */
export const STEPS: { from: string; to: string; marker: string }[] = [
  {
    from: '>Kiểm tra dung lượng &amp; ưu đãi của eSIM</p>',
    to: '>Kiểm tra dung lượng &amp; ưu đãi của eSIM / Check your eSIM data &amp; offers</p>',
    marker: 'Check your eSIM data',
  },
  {
    from: '>Hướng dẫn cài đặt eSIM</p>',
    to: '>Hướng dẫn cài đặt eSIM / eSIM installation guide</p>',
    marker: 'eSIM installation guide',
  },
  {
    from: '{{#if partnerSupportEmail}}<p style="margin:4px 0 0">Hỗ trợ / Support:',
    to: '{{#if partnerSupportPhone}}<p style="margin:4px 0 0">Điện thoại liên hệ / Phone: <a href="tel:{{partnerSupportPhoneTel}}" style="color:{{#if brandColor}}{{brandColor}}{{else}}#999{{/if}}">{{partnerSupportPhone}}</a></p>{{/if}}{{#if partnerSupportEmail}}<p style="margin:4px 0 0">Hỗ trợ / Support:',
    marker: '{{partnerSupportPhone}}',
  },
];

export class PartnerBrandPhoneAndEnglishTitles1805200000000 implements MigrationInterface {
  name = 'PartnerBrandPhoneAndEnglishTitles1805200000000';

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
