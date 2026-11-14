import { MigrationInterface, QueryRunner } from 'typeorm';

/** Reactions on chat messages, one per person (vande-1411 #037). */
export class ChatMessageReactions1806500000000 implements MigrationInterface {
  name = 'ChatMessageReactions1806500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "chat_message" ADD COLUMN IF NOT EXISTS "reactions" jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "chat_message" DROP COLUMN IF EXISTS "reactions"`,
    );
  }
}
