import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A "Dữ liệu / Data" line in the eSIM email, above the call minutes (#025,
 * test round 4): "2GB / ngày", "1GB - 7 ngày" or "Không giới hạn".
 */
export const DATA_ROW = `{{#if dataText}}
                <tr>
                  <td style="padding:8px 16px;border-top:1px solid #eee">
                    <p style="margin:0;font-size:13px;color:#888">Dữ liệu / Data</p>
                    <p style="margin:4px 0 0;font-size:15px;color:#333;font-weight:600">{{dataText}}</p>
                  </td>
                </tr>
                {{/if}}
                `;

const ANCHOR = '{{#if callMinutes}}';

export class EsimEmailDataLine1796200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "email_template"
          SET "htmlBody" = replace("htmlBody", $1, $2 || $1), "updatedAt" = now()
        WHERE name = 'esim_purchase'
          AND position($1 in "htmlBody") > 0
          AND position('{{dataText}}' in "htmlBody") = 0`,
      [ANCHOR, DATA_ROW],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "email_template" SET "htmlBody" = replace("htmlBody", $1, '')
        WHERE name = 'esim_purchase'`,
      [DATA_ROW],
    );
  }
}
