import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Chat without an account (vande-2011 #023). A visitor's conversation has no
 * user: it is found by the visitor's key (from a token the server signed), and
 * the visitor's own messages have no sender but are flagged `fromGuest`, which
 * tells them from the automatic messages (also without a sender). When the
 * visitor signs in, the conversation moves to the account.
 */
export class ChatGuests1807000000000 implements MigrationInterface {
  name = 'ChatGuests1807000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "chat_room" ALTER COLUMN "userId" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_room" ADD COLUMN IF NOT EXISTS "guestKey" varchar(64)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_chat_room_guestKey" ON "chat_room" ("guestKey")`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_room" ADD COLUMN IF NOT EXISTS "guestIp" varchar(64)`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_message" ADD COLUMN IF NOT EXISTS "fromGuest" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Conversations nobody signed in to cannot go back to a NOT NULL column.
    await queryRunner.query(
      `DELETE FROM "chat_message" WHERE "chatRoomId" IN (SELECT id FROM "chat_room" WHERE "userId" IS NULL)`,
    );
    await queryRunner.query(`DELETE FROM "chat_room" WHERE "userId" IS NULL`);
    await queryRunner.query(
      `ALTER TABLE "chat_message" DROP COLUMN IF EXISTS "fromGuest"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_chat_room_guestKey"`);
    await queryRunner.query(
      `ALTER TABLE "chat_room" DROP COLUMN IF EXISTS "guestIp"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_room" DROP COLUMN IF EXISTS "guestKey"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_room" ALTER COLUMN "userId" SET NOT NULL`,
    );
  }
}
