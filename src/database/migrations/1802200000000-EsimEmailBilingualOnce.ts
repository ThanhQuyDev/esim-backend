import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * doitac-3010 #004 — the eSIM email, once per eSIM and in both languages.
 *
 * 1. `esim."purchaseEmailSentAt"`: a partner order mailed its eSIMs and the
 *    supplier's webhook mailed them again (4 eSIMs, 7 emails). An eSIM is now
 *    mailed automatically once; "Gửi lại email eSIM" still sends on demand.
 *    eSIMs already handed out count as mailed, so a late webhook for an old
 *    order does not send a copy.
 * 2. The stock template in Vietnamese and English side by side, the Android
 *    button in the partner's colour, and a taller logo for a partner (whose
 *    logo is often square). Same `replace` steps as 1798200000000: a piece an
 *    admin already edited in the CMS is left alone.
 */

export const STEPS: { from: string; to: string; marker: string }[] = [
  {
    from: 'alt="{{app_name}}" height="48" style="max-height:48px;',
    to: 'alt="{{app_name}}" height="{{#if logoHeight}}{{logoHeight}}{{else}}48{{/if}}" style="max-height:{{#if logoHeight}}{{logoHeight}}{{else}}48{{/if}}px;max-width:280px;',
    marker: '{{logoHeight}}',
  },
  {
    from: '<html lang="en">',
    to: '<html lang="vi">',
    marker: '<html lang="vi">',
  },
  {
    from: '>Your eSIM is ready to use!</p>',
    to: '>eSIM của bạn đã sẵn sàng!<br /><span style="color:#666;font-size:14px">Your eSIM is ready to use!</span></p>',
    marker: 'eSIM của bạn đã sẵn sàng!',
  },
  {
    from: '>Order: <strong>{{orderNumber}}</strong></p>',
    to: '>Mã đơn hàng / Order: <strong>{{orderNumber}}</strong></p>',
    marker: 'Mã đơn hàng / Order',
  },
  {
    from: '>Scan this QR code to install your eSIM</p>',
    to: '>Quét mã QR để cài đặt eSIM / Scan this QR code to install your eSIM</p>',
    marker: 'Quét mã QR để cài đặt eSIM',
  },
  {
    from: 'Or install in one tap on a supported device:',
    to: 'Hoặc cài đặt bằng một chạm trên máy hỗ trợ / Or install in one tap on a supported device:',
    marker: 'Hoặc cài đặt bằng một chạm',
  },
  {
    // Room for the two-language labels on one line.
    from: 'width:90%;max-width:240px;padding:14px 20px',
    to: 'width:90%;max-width:340px;padding:14px 20px',
    marker: 'max-width:340px;padding:14px 20px',
  },
  {
    from: 'Install on iOS (17.4+)',
    to: 'Cài trên iPhone / Install on iOS (17.4+)',
    marker: 'Cài trên iPhone',
  },
  {
    from: 'background:#3DDC84;color:#0b3d2e;',
    to: 'background:{{#if androidColor}}{{androidColor}}{{else}}#3DDC84{{/if}};color:{{#if androidColor}}#ffffff{{else}}#0b3d2e{{/if}};',
    marker: '{{androidColor}}',
  },
  {
    from: 'Install on Android (10+)',
    to: 'Cài trên Android / Install on Android (10+)',
    marker: 'Cài trên Android',
  },
  {
    from: 'color:#888">Plan</p>',
    to: 'color:#888">Gói cước / Plan</p>',
    marker: 'Gói cước / Plan',
  },
  {
    from: 'color:#888">Activation Code (LPA)</p>',
    to: 'color:#888">Mã kích hoạt / Activation Code (LPA)</p>',
    marker: 'Mã kích hoạt / Activation Code (LPA)',
  },
  {
    from: 'color:#888">SM-DP+ Address</p>',
    to: 'color:#888">Địa chỉ SM-DP+ / SM-DP+ Address</p>',
    marker: 'Địa chỉ SM-DP+',
  },
  {
    from: 'color:#888">Matching ID / Activation Code</p>',
    to: 'color:#888">Mã ghép nối / Matching ID</p>',
    marker: 'Mã ghép nối / Matching ID',
  },
  {
    from: 'color:#888">Phone Number</p>',
    to: 'color:#888">Số điện thoại / Phone Number</p>',
    marker: 'Số điện thoại / Phone Number',
  },
  {
    from: '— If you did not make this purchase, please contact support.',
    to: '— Nếu bạn không đặt mua đơn này, vui lòng liên hệ hỗ trợ. / If you did not make this purchase, please contact support.',
    marker: 'Nếu bạn không đặt mua đơn này',
  },
];

const SUBJECT_FROM = 'Your eSIM is ready — {{orderNumber}}';
const SUBJECT_TO =
  'eSIM của bạn đã sẵn sàng / Your eSIM is ready — {{orderNumber}}';

export class EsimEmailBilingualOnce1802200000000 implements MigrationInterface {
  name = 'EsimEmailBilingualOnce1802200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "esim" ADD COLUMN IF NOT EXISTS "purchaseEmailSentAt" TIMESTAMP`,
    );
    await queryRunner.query(
      `UPDATE "esim" SET "purchaseEmailSentAt" = "createdAt"
        WHERE "orderItemId" IS NOT NULL AND "purchaseEmailSentAt" IS NULL`,
    );
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
    await queryRunner.query(
      `UPDATE "email_template" SET subject = $2, "updatedAt" = now()
        WHERE name = 'esim_purchase' AND subject = $1`,
      [SUBJECT_FROM, SUBJECT_TO],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "email_template" SET subject = $1, "updatedAt" = now()
        WHERE name = 'esim_purchase' AND subject = $2`,
      [SUBJECT_FROM, SUBJECT_TO],
    );
    for (const step of [...STEPS].reverse()) {
      await queryRunner.query(
        `UPDATE "email_template"
            SET "htmlBody" = replace("htmlBody", $2, $1), "updatedAt" = now()
          WHERE name = 'esim_purchase'`,
        [step.from, step.to],
      );
    }
    await queryRunner.query(
      `ALTER TABLE "esim" DROP COLUMN IF EXISTS "purchaseEmailSentAt"`,
    );
  }
}
