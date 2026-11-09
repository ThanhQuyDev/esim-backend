import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * doitac-0911 #007 — the commission statement email:
 * - subject "Bảng đối soát hoa hồng Tháng 10/2026 - ESIM.VN";
 * - "Tỷ lệ khách hàng mới" and "Tỷ lệ đơn hoàn tiền" right under
 *   "Tỷ lệ ghi nhận qua mã", in the same row style.
 * Rows are added after that row whatever its spacing, once only, so a
 * template edited in the CMS keeps the rest of its wording.
 */
const ROW = (label: string, variable: string) =>
  `
              <tr>
                <td style="padding:8px 0;font-size:14px;color:#666">${label}</td>
                <td style="padding:8px 0;font-size:14px;color:#333;text-align:right;font-weight:600">{{${variable}}}%</td>
              </tr>`;

export class ReconciliationEmailRates1805000000000 implements MigrationInterface {
  name = 'ReconciliationEmailRates1805000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE email_template
          SET subject = 'Bảng đối soát hoa hồng {{periodLabel}} - ESIM.VN',
              "updatedAt" = now()
        WHERE name = 'partner_reconciliation_statement'`,
    );
    await queryRunner.query(
      `UPDATE email_template
          SET "htmlBody" = regexp_replace(
                "htmlBody",
                '(\\{\\{viaCouponPercent\\}\\}%</td>\\s*</tr>)',
                '\\1' || $1),
              "updatedAt" = now()
        WHERE name = 'partner_reconciliation_statement'
          AND "htmlBody" NOT LIKE '%{{newCustomerPercent}}%'`,
      [
        ROW('Tỷ lệ khách hàng mới', 'newCustomerPercent') +
          ROW('Tỷ lệ đơn hoàn tiền', 'refundPercent'),
      ],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE email_template
          SET subject = 'Bảng đối soát {{periodLabel}}',
              "htmlBody" = regexp_replace(
                "htmlBody",
                '\\s*<tr>\\s*<td[^>]*>Tỷ lệ (khách hàng mới|đơn hoàn tiền)</td>\\s*<td[^>]*>\\{\\{(newCustomerPercent|refundPercent)\\}\\}%</td>\\s*</tr>',
                '',
                'g'),
              "updatedAt" = now()
        WHERE name = 'partner_reconciliation_statement'`,
    );
  }
}
