import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * doitac-0911 #009 — the monthly statement of a distribution partner.
 *
 * It used to go only to partners buying on credit ("Không cần ký quỹ") and
 * spoke only of the credit limit. Now every distribution partner ticked
 * "Gửi email đối soát" gets it, with what anh Thọ listed: số đơn hợp lệ,
 * số eSIM đã bán, tỷ lệ hoàn tiền, tổng doanh số bán ra, số tiền đã thanh
 * toán, số tiền chưa thanh toán; subject "Bảng đối soát công nợ Tháng 10/2026
 * - ESIM.VN".
 *
 * The body is replaced only while it is still the one seeded in
 * 1800500000000 (an admin who reworded it in the CMS keeps their wording);
 * the subject always changes.
 */

const HEADER = `          <tr style="background:#ffffff;border-bottom:1px solid #e5e7eb">
            <td style="padding:24px;text-align:center;background:#ffffff">
              {{#if logoUrl}}
              <img src="{{logoUrl}}" alt="{{app_name}}" height="48" style="max-height:48px;display:inline-block;border:0;outline:none;text-decoration:none" />
              {{else}}
              <span style="color:#00838f;font-size:24px;font-weight:700">{{app_name}}</span>
              {{/if}}
            </td>
          </tr>`;

const FOOTER = `          <tr>
            <td style="padding:0 32px 24px">
              <p style="margin:0;font-size:14px;color:#666">
                Nếu có số liệu chưa khớp, vui lòng phản hồi lại email này hoặc liên hệ
                <a href="mailto:{{supportEmail}}" style="color:#00838f">{{supportEmail}}</a>
                trong vòng 7 ngày.
              </p>
            </td>
          </tr>
          <tr style="background:#f5f5f5">
            <td style="padding:16px;text-align:center;font-size:12px;color:#999">
              &copy; {{app_name}}
            </td>
          </tr>`;

const ROW = (label: string, value: string) => `              <tr>
                <td style="padding:8px 0;font-size:14px;color:#666">${label}</td>
                <td style="padding:8px 0;font-size:14px;color:#333;text-align:right;font-weight:600">${value}</td>
              </tr>`;

export const TEMPLATE = `<!DOCTYPE html>
<html lang="vi">
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
${HEADER}
          <tr>
            <td style="padding:32px 32px 0">
              <p style="margin:0;font-size:16px;color:#333">Kính gửi {{contactName}},</p>
              <p style="margin:12px 0 0;font-size:14px;color:#333;line-height:1.6">
                {{app_name}} xin gửi Quý đối tác bảng đối soát công nợ {{periodLabel}}.
                Biên bản đối soát và chi tiết từng giao dịch có trong file Excel đính kèm.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 0">
              <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e5e7eb">
${ROW('Số đơn hợp lệ', '{{orderCount}}')}
${ROW('Số eSIM đã bán', '{{esimCount}}')}
${ROW('Tỷ lệ hoàn tiền', '{{refundPercent}}%')}
${ROW('Tổng doanh số bán ra', '{{revenueVnd}}đ')}
${ROW('Số tiền đã thanh toán', '{{paidVnd}}đ')}
${ROW('Số tiền chưa thanh toán', '{{amountDueVnd}}đ')}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 0">
              <p style="margin:0;font-size:14px;color:#333;line-height:1.6">
                {{#if hasAmountDue}}Vui lòng thanh toán số tiền chưa thanh toán theo thỏa thuận hợp tác với {{app_name}}.{{else}}Quý đối tác không còn khoản nào cần thanh toán cho kỳ này.{{/if}}
                {{#if onCredit}}Hạn mức giao dịch đã được đặt lại về {{creditLimitVnd}}đ cho tháng mới.{{/if}}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px">
              <a href="{{portalUrl}}" style="display:inline-block;background:#00838f;color:#ffffff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
                Xem chi tiết trong trang đối tác
              </a>
            </td>
          </tr>
${FOOTER}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

/** A phrase only the seeded body has. */
const SEEDED =
  '%(hình thức không ký quỹ, hạn mức giao dịch {{creditLimitVnd}}đ/tháng)%';

export class DistributionStatementEmail1805400000000 implements MigrationInterface {
  name = 'DistributionStatementEmail1805400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE email_template
          SET "htmlBody" = $1, "updatedAt" = now()
        WHERE name = 'partner_credit_statement'
          AND "htmlBody" LIKE $2`,
      [TEMPLATE, SEEDED],
    );
    await queryRunner.query(
      `UPDATE email_template
          SET subject = 'Bảng đối soát công nợ {{periodLabel}} - ESIM.VN',
              "updatedAt" = now()
        WHERE name = 'partner_credit_statement'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // The old body cannot be told apart from an admin's own wording, so only
    // the subject goes back; rerun 1800500000000's seed for the body.
    await queryRunner.query(
      `UPDATE email_template
          SET subject = 'Đối soát tiền hàng {{periodLabel}} – {{amountDueVnd}}đ',
              "updatedAt" = now()
        WHERE name = 'partner_credit_statement'`,
    );
  }
}
