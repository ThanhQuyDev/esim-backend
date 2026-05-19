import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Style 2.1 + Feature 2.4 — Refresh the `esim_purchase` email template:
 *  • White (#ffffff) header background with a centered brand logo image and a
 *    thin bottom border to separate the header from the QR/eSIM details.
 *  • Two big call-to-action buttons (Android / iOS) that deep-link straight
 *    to the OS-level eSIM provisioning flow, parameterised with `${lpa}`.
 *
 * The migration is idempotent: it overwrites the row identified by
 * `name = 'esim_purchase'` and creates it if missing.
 */

const REFRESHED_ESIM_PURCHASE_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{{subject}}</title>
</head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f5f5f5">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden">
          <!-- Header (white background + brand logo + bottom divider) -->
          <tr style="background:#ffffff;border-bottom:1px solid #e5e7eb">
            <td style="padding:24px;text-align:center;background:#ffffff">
              {{#if logoUrl}}
              <img src="{{logoUrl}}" alt="{{app_name}}" height="48" style="max-height:48px;display:inline-block;border:0;outline:none;text-decoration:none" />
              {{else}}
              <span style="color:#00838f;font-size:24px;font-weight:700">{{app_name}}</span>
              {{/if}}
            </td>
          </tr>
          <!-- Greeting -->
          <tr>
            <td style="padding:32px 32px 0">
              <p style="margin:0;font-size:16px;color:#333">Your eSIM is ready to use!</p>
              <p style="margin:8px 0 0;font-size:14px;color:#666">Order: <strong>{{orderNumber}}</strong></p>
            </td>
          </tr>
          <!-- QR Code -->
          <tr>
            <td style="padding:24px 32px;text-align:center">
              <p style="margin:0 0 12px;font-size:14px;color:#666">Scan this QR code to install your eSIM</p>
              <img src="{{qrCodeBase64}}" alt="eSIM QR Code" width="200" height="200" style="border:1px solid #eee;border-radius:4px" />
            </td>
          </tr>
          <!-- Feature 2.4 — One-tap install CTAs (iOS 17.4+ / Android 10+) -->
          {{#if lpa}}
          <tr>
            <td style="padding:0 32px 8px">
              <p style="margin:0 0 12px;font-size:14px;color:#666;text-align:center">
                Or install in one tap on a supported device:
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:6px 8px">
                    <a href="https://esimsetup.apple.com/esim_qrcode_provisioning?carddata={{lpa}}"
                       style="display:inline-block;width:90%;max-width:240px;padding:14px 20px;background:#000000;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;text-align:center;font-family:Arial,sans-serif">
                      Install on iOS (17.4+)
                    </a>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding:6px 8px">
                    <a href="https://esimsetup.android.com/esim_qrcode_provisioning?carddata={{lpa}}"
                       style="display:inline-block;width:90%;max-width:240px;padding:14px 20px;background:#3DDC84;color:#0b3d2e;font-size:15px;font-weight:700;text-decoration:none;border-radius:8px;text-align:center;font-family:Arial,sans-serif">
                      Install on Android (10+)
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          {{/if}}
          <!-- eSIM Details -->
          <tr>
            <td style="padding:16px 32px 32px">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;border-radius:6px;padding:16px">
                <tr>
                  <td style="padding:8px 16px">
                    <p style="margin:0;font-size:13px;color:#888">Plan</p>
                    <p style="margin:4px 0 0;font-size:15px;color:#333;font-weight:600">{{planName}}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 16px;border-top:1px solid #eee">
                    <p style="margin:0;font-size:13px;color:#888">ICCID</p>
                    <p style="margin:4px 0 0;font-size:15px;color:#333;font-family:monospace">{{iccid}}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 16px;border-top:1px solid #eee">
                    <p style="margin:0;font-size:13px;color:#888">Activation Code (LPA)</p>
                    <p style="margin:4px 0 0;font-size:13px;color:#333;font-family:monospace;word-break:break-all">{{lpa}}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 16px;border-top:1px solid #eee">
                    <p style="margin:0;font-size:13px;color:#888">SM-DP+ Address</p>
                    <p style="margin:4px 0 0;font-size:15px;color:#333;font-family:monospace">{{smdpAddress}}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 16px;border-top:1px solid #eee">
                    <p style="margin:0;font-size:13px;color:#888">Matching ID / Activation Code</p>
                    <p style="margin:4px 0 0;font-size:15px;color:#333;font-family:monospace">{{activationCode}}</p>
                  </td>
                </tr>
                {{#if apn}}
                <tr>
                  <td style="padding:8px 16px;border-top:1px solid #eee">
                    <p style="margin:0;font-size:13px;color:#888">APN</p>
                    <p style="margin:4px 0 0;font-size:15px;color:#333;font-family:monospace">{{apn}}</p>
                  </td>
                </tr>
                {{/if}}
                {{#if phoneNumber}}
                <tr>
                  <td style="padding:8px 16px;border-top:1px solid #eee">
                    <p style="margin:0;font-size:13px;color:#888">Phone Number</p>
                    <p style="margin:4px 0 0;font-size:15px;color:#333;font-family:monospace">{{phoneNumber}}</p>
                  </td>
                </tr>
                {{/if}}
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr style="background:#f5f5f5">
            <td style="padding:16px;text-align:center;font-size:12px;color:#999">
              &copy; {{app_name}} — If you did not make this purchase, please contact support.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

export class RefreshEsimPurchaseEmailTemplate1779400000000 implements MigrationInterface {
  name = 'RefreshEsimPurchaseEmailTemplate1779400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const escaped = REFRESHED_ESIM_PURCHASE_TEMPLATE.replace(/'/g, "''");
    await queryRunner.query(`
      INSERT INTO "email_template" ("name", "subject", "htmlBody", "isActive")
      VALUES (
        'esim_purchase',
        'Your eSIM is ready — {{orderNumber}}',
        '${escaped}',
        true
      )
      ON CONFLICT ("name") DO UPDATE SET
        "htmlBody" = EXCLUDED."htmlBody",
        "updatedAt" = now()
    `);
  }

  public async down(): Promise<void> {
    // No-op — reverting to the previous body would require the older string,
    // which is not stored. The template can always be re-edited from the CMS
    // (the persistence bug fix in Bug 2.3 makes those edits durable).
  }
}
