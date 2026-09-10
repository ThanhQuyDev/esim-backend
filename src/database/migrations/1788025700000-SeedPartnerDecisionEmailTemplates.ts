import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Emails telling an affiliate applicant the outcome (#095).
 *
 * The brief is explicit: "được duyệt hay không được duyệt cũng cần gửi email
 * thông báo kết quả". Neither existed — `PartnersService` never touched the
 * mail service — so someone who applied heard nothing back either way and had
 * to keep checking the site.
 *
 * Both templates are rows in `email_template`, so support can reword them in
 * the CMS without a deploy, exactly like the invoice email.
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
                Cần hỗ trợ thêm? Liên hệ
                <a href="mailto:{{supportEmail}}" style="color:#00838f">{{supportEmail}}</a>.
              </p>
            </td>
          </tr>
          <tr style="background:#f5f5f5">
            <td style="padding:16px;text-align:center;font-size:12px;color:#999">
              &copy; {{app_name}} — Đây là email tự động, vui lòng không trả lời trực tiếp.
            </td>
          </tr>`;

const APPROVED_TEMPLATE = `<!DOCTYPE html>
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
                Yêu cầu tham gia chương trình đối tác của bạn đã được <strong>duyệt</strong>.
                Bạn có thể đăng nhập để tạo liên kết giới thiệu và theo dõi hoa hồng.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px">
              <a href="{{portalUrl}}" style="display:inline-block;background:#00838f;color:#ffffff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
                Vào trang đối tác
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

const REJECTED_TEMPLATE = `<!DOCTYPE html>
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
                Cảm ơn bạn đã quan tâm tới chương trình đối tác của {{app_name}}.
                Rất tiếc, lần này hồ sơ của bạn <strong>chưa được duyệt</strong>.
              </p>
            </td>
          </tr>
          {{#if reason}}
          <tr>
            <td style="padding:16px 32px 0">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;border-radius:6px">
                <tr>
                  <td style="padding:16px">
                    <p style="margin:0;font-size:13px;color:#888">Lý do</p>
                    <p style="margin:4px 0 0;font-size:15px;color:#333">{{reason}}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          {{/if}}
          <tr>
            <td style="padding:16px 32px 0">
              <p style="margin:0;font-size:14px;color:#666">
                Bạn có thể nộp lại hồ sơ sau khi bổ sung thông tin.
              </p>
            </td>
          </tr>
${FOOTER}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

function insert(name: string, subject: string, html: string): string {
  const escaped = html.replace(/'/g, "''");
  return `
    INSERT INTO "email_template" ("name", "subject", "htmlBody", "isActive")
    VALUES ('${name}', '${subject.replace(/'/g, "''")}', '${escaped}', true)
    ON CONFLICT ("name") DO NOTHING
  `;
}

export class SeedPartnerDecisionEmailTemplates1788025700000 implements MigrationInterface {
  name = 'SeedPartnerDecisionEmailTemplates1788025700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      insert(
        'partner_application_approved',
        'Hồ sơ đối tác của bạn đã được duyệt — {{app_name}}',
        APPROVED_TEMPLATE,
      ),
    );
    await queryRunner.query(
      insert(
        'partner_application_rejected',
        'Kết quả hồ sơ đối tác — {{app_name}}',
        REJECTED_TEMPLATE,
      ),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "email_template" WHERE "name" IN ('partner_application_approved', 'partner_application_rejected')`,
    );
  }
}
