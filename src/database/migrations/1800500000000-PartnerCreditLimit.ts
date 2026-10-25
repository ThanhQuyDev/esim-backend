import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * "Không cần ký quỹ" (vande #056).
 *
 * A partner an admin trusts buys on credit: their wallet is filled to a
 * monthly "hạn mức giao dịch" instead of from deposits, topped back up at 0h
 * on the 1st, and what they spent in month n is emailed to them in month n+1
 * as a statement to pay — the email template is seeded here like the
 * commission statement (1793200000000), so support can reword it.
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
              &copy; {{app_name}} — Đây là email tự động, vui lòng không trả lời trực tiếp.
            </td>
          </tr>`;

const ROW = (label: string, value: string) => `              <tr>
                <td style="padding:8px 0;font-size:14px;color:#666">${label}</td>
                <td style="padding:8px 0;font-size:14px;color:#333;text-align:right;font-weight:600">${value}</td>
              </tr>`;

const TEMPLATE = `<!DOCTYPE html>
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
              <p style="margin:0;font-size:16px;color:#333">Chào {{contactName}},</p>
              <p style="margin:12px 0 0;font-size:15px;color:#333">
                Dưới đây là bảng đối soát tiền hàng {{periodLabel}} của bạn trên {{app_name}}
                (hình thức không ký quỹ, hạn mức giao dịch {{creditLimitVnd}}đ/tháng).
                Chi tiết từng giao dịch có trong file Excel đính kèm.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 0">
              <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e5e7eb">
${ROW('Số đơn đã mua', '{{orderCount}}')}
${ROW('Tổng eSIM đã mua', '{{esimCount}}')}
${ROW('Tiền hàng đã mua', '{{purchasedVnd}}đ')}
${ROW('Đã hoàn lại (đơn huỷ / eSIM lỗi)', '{{refundedVnd}}đ')}
${ROW('Số tiền cần thanh toán', '{{amountDueVnd}}đ')}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 0">
              <p style="margin:0;font-size:14px;color:#333">
                Hạn mức của bạn đã được đặt lại về {{creditLimitVnd}}đ cho tháng mới.
                Vui lòng thanh toán số tiền trên theo thỏa thuận hợp tác với {{app_name}}.
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

export class PartnerCreditLimit1800500000000 implements MigrationInterface {
  name = 'PartnerCreditLimit1800500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "partner" ADD COLUMN IF NOT EXISTS "noDepositRequired" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "partner" ADD COLUMN IF NOT EXISTS "creditLimitVnd" numeric(14,0) NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `INSERT INTO "email_template" ("name", "subject", "htmlBody", "isActive")
       VALUES ('partner_credit_statement', 'Đối soát tiền hàng {{periodLabel}} – {{amountDueVnd}}đ', $1, true)
       ON CONFLICT ("name") DO NOTHING`,
      [TEMPLATE],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "email_template" WHERE "name" = 'partner_credit_statement'`,
    );
    await queryRunner.query(
      `ALTER TABLE "partner" DROP COLUMN IF EXISTS "creditLimitVnd"`,
    );
    await queryRunner.query(
      `ALTER TABLE "partner" DROP COLUMN IF EXISTS "noDepositRequired"`,
    );
  }
}
