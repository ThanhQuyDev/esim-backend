import { MigrationInterface, QueryRunner } from 'typeorm';

const DEFAULT_INVOICE_ISSUED_TEMPLATE = `<!DOCTYPE html>
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
          <tr style="background:#00838f">
            <td style="padding:24px;text-align:center;color:#ffffff;font-size:24px;font-weight:700">
              {{app_name}} — Hóa đơn điện tử
            </td>
          </tr>
          <tr>
            <td style="padding:32px 32px 0">
              <p style="margin:0;font-size:16px;color:#333">Kính gửi quý khách,</p>
              <p style="margin:12px 0 0;font-size:14px;color:#666">
                Đơn hàng <strong>{{orderNumber}}</strong> của quý khách đã được thanh toán thành công.
                Dưới đây là thông tin hóa đơn theo yêu cầu xuất hóa đơn của quý khách:
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;border-radius:6px;padding:16px">
                <tr>
                  <td style="padding:8px 16px">
                    <p style="margin:0;font-size:13px;color:#888">Tên công ty / Tổ chức</p>
                    <p style="margin:4px 0 0;font-size:15px;color:#333;font-weight:600">{{companyName}}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 16px;border-top:1px solid #eee">
                    <p style="margin:0;font-size:13px;color:#888">Mã số thuế</p>
                    <p style="margin:4px 0 0;font-size:15px;color:#333;font-family:monospace">{{taxCode}}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 16px;border-top:1px solid #eee">
                    <p style="margin:0;font-size:13px;color:#888">Địa chỉ đăng ký kinh doanh</p>
                    <p style="margin:4px 0 0;font-size:15px;color:#333">{{address}}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 16px;border-top:1px solid #eee">
                    <p style="margin:0;font-size:13px;color:#888">Số tiền thanh toán</p>
                    <p style="margin:4px 0 0;font-size:15px;color:#333;font-weight:600">{{totalAmountFormatted}} VND</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 16px;border-top:1px solid #eee">
                    <p style="margin:0;font-size:13px;color:#888">Mã đơn hàng</p>
                    <p style="margin:4px 0 0;font-size:15px;color:#333;font-family:monospace">{{orderNumber}}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 24px">
              <p style="margin:0;font-size:14px;color:#666">
                Hóa đơn điện tử (PDF) sẽ được bộ phận kế toán gửi đến địa chỉ email này
                trong thời gian sớm nhất. Nếu cần hỗ trợ, quý khách vui lòng liên hệ
                <a href="mailto:support@esim.vn" style="color:#00838f">support@esim.vn</a>.
              </p>
            </td>
          </tr>
          <tr style="background:#f5f5f5">
            <td style="padding:16px;text-align:center;font-size:12px;color:#999">
              &copy; {{app_name}} — Đây là email tự động, vui lòng không trả lời trực tiếp.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

export class SeedInvoiceIssuedEmailTemplate1778900000000 implements MigrationInterface {
  name = 'SeedInvoiceIssuedEmailTemplate1778900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const escaped = DEFAULT_INVOICE_ISSUED_TEMPLATE.replace(/'/g, "''");
    await queryRunner.query(`
      INSERT INTO "email_template" ("name", "subject", "htmlBody", "isActive")
      VALUES (
        'invoice_issued',
        'Xác nhận yêu cầu xuất hóa đơn — {{orderNumber}}',
        '${escaped}',
        true
      )
      ON CONFLICT ("name") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "email_template" WHERE "name" = 'invoice_issued'`,
    );
  }
}
