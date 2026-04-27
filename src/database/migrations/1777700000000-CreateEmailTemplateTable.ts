import { MigrationInterface, QueryRunner } from 'typeorm';

const DEFAULT_ESIM_PURCHASE_TEMPLATE = `<!DOCTYPE html>
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
          <!-- Header -->
          <tr style="background:#00838f">
            <td style="padding:24px;text-align:center;color:#ffffff;font-size:24px;font-weight:700">
              {{app_name}}
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
          <!-- eSIM Details -->
          <tr>
            <td style="padding:0 32px 32px">
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

export class CreateEmailTemplateTable1777700000000 implements MigrationInterface {
  name = 'CreateEmailTemplateTable1777700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "email_template" (
        "id" SERIAL NOT NULL,
        "name" character varying(100) NOT NULL,
        "subject" character varying(255) NOT NULL,
        "htmlBody" text NOT NULL,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_email_template_name" UNIQUE ("name"),
        CONSTRAINT "PK_email_template" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_email_template_name" ON "email_template" ("name")`,
    );

    const escaped = DEFAULT_ESIM_PURCHASE_TEMPLATE.replace(/'/g, "''");
    await queryRunner.query(`
      INSERT INTO "email_template" ("name", "subject", "htmlBody", "isActive")
      VALUES ('esim_purchase', 'Your eSIM is ready — {{orderNumber}}', '${escaped}', true)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_email_template_name"`);
    await queryRunner.query(`DROP TABLE "email_template"`);
  }
}
