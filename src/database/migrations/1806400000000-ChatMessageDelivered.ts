import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * "Đã gửi / Đã nhận / Đã xem" on the CMS chat (vande-1411 #035): when a
 * message reached the other side. Messages already read count as delivered.
 */
export class ChatMessageDelivered1806400000000 implements MigrationInterface {
  name = 'ChatMessageDelivered1806400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "chat_message" ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMP`,
    );
    await queryRunner.query(
      `UPDATE "chat_message" SET "deliveredAt" = "updatedAt" WHERE "isRead" = true AND "deliveredAt" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "chat_message" DROP COLUMN IF EXISTS "deliveredAt"`,
    );
  }
}
