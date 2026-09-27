import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The rejection email tells the applicant to apply again but never says where
 * (#003). Swap that sentence for the same sentence plus a button to the
 * application form, leaving every other edit an admin has made intact.
 */

const OLD_BLOCK = `              <p style="margin:0;font-size:14px;color:#666">
                Bạn có thể nộp lại hồ sơ sau khi bổ sung thông tin.
              </p>`;

const NEW_BLOCK = `              <p style="margin:0;font-size:14px;color:#666">
                Bạn có thể bổ sung thông tin và điền lại biểu mẫu đăng ký tại đây.
              </p>
              <p style="margin:20px 0 0" align="center">
                <a href="{{registerUrl}}" style="display:inline-block;background:#00838f;color:#ffffff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
                  Điền lại biểu mẫu đăng ký
                </a>
              </p>`;

function swap(from: string, to: string): string {
  return `
    UPDATE "email_template"
    SET "htmlBody" = REPLACE("htmlBody", '${from.replace(/'/g, "''")}', '${to.replace(/'/g, "''")}')
    WHERE "name" = 'partner_application_rejected'
  `;
}

export class AddReapplyLinkToPartnerRejectedEmail1790500000000 implements MigrationInterface {
  name = 'AddReapplyLinkToPartnerRejectedEmail1790500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(swap(OLD_BLOCK, NEW_BLOCK));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(swap(NEW_BLOCK, OLD_BLOCK));
  }
}
