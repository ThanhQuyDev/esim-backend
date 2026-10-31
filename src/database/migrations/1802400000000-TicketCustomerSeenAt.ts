import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * When the customer or partner last opened a ticket's conversation
 * (doitac-3010 #012), so a reply from support after it is "Phản hồi mới".
 * Existing tickets count as read, so nothing old lights up at once.
 */
export class TicketCustomerSeenAt1802400000000 implements MigrationInterface {
  name = 'TicketCustomerSeenAt1802400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ticket" ADD COLUMN IF NOT EXISTS "customerSeenAt" TIMESTAMP`,
    );
    await queryRunner.query(
      `UPDATE "ticket"
          SET "customerSeenAt" = GREATEST("lastReplyAt", "updatedAt", "createdAt")
        WHERE "customerSeenAt" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ticket" DROP COLUMN IF EXISTS "customerSeenAt"`,
    );
  }
}
