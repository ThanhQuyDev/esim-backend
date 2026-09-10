import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Lets a chat message quote an earlier message in the same room (#073).
 *
 * Support conversations run long and a customer often asks three things at
 * once; without a quote the admin's answer lands as a bare paragraph and
 * nobody can tell which question it belongs to.
 *
 * ON DELETE SET NULL: deleting the quoted message must not take the reply with
 * it — the reply keeps its text and simply stops showing a quote.
 */
export class AddReplyToIdToChatMessage1788025000000 implements MigrationInterface {
  name = 'AddReplyToIdToChatMessage1788025000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "chat_message" ADD COLUMN IF NOT EXISTS "replyToId" integer`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_chat_message_replyToId" ON "chat_message" ("replyToId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_message" ADD CONSTRAINT "FK_chat_message_replyToId" FOREIGN KEY ("replyToId") REFERENCES "chat_message"("id") ON DELETE SET NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "chat_message" DROP CONSTRAINT IF EXISTS "FK_chat_message_replyToId"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_chat_message_replyToId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_message" DROP COLUMN "replyToId"`,
    );
  }
}
