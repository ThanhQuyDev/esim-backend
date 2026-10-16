import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A distribution partner's eSIM report becomes a support ticket
 * (doitac-1410 #038, #039): "Báo lỗi" or "Yêu cầu hoàn tiền", with files.
 */
export class PartnerEsimFaultTicket1798100000000 implements MigrationInterface {
  name = 'PartnerEsimFaultTicket1798100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "partner_esim_fault_report"
        ADD COLUMN IF NOT EXISTS "kind" varchar(16) NOT NULL DEFAULT 'fault',
        ADD COLUMN IF NOT EXISTS "ticketId" integer,
        ADD COLUMN IF NOT EXISTS "attachments" jsonb`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "partner_esim_fault_report"
        DROP COLUMN IF EXISTS "kind",
        DROP COLUMN IF EXISTS "ticketId",
        DROP COLUMN IF EXISTS "attachments"`);
  }
}
