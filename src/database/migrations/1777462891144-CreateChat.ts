import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateChat1777462891144 implements MigrationInterface {
  name = 'CreateChat1777462891144';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "chat_room" ("id" SERIAL NOT NULL, "userId" integer NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_8aa3a52cf74c96469f0ef9fbe3e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_chat_room_userId" ON "chat_room" ("userId")`,
    );
    await queryRunner.query(
      `CREATE TABLE "chat_message" ("id" SERIAL NOT NULL, "chatRoomId" integer NOT NULL, "senderId" integer NOT NULL, "message" text NOT NULL, "isRead" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_3cc0d85193aade457d3077dd06b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_chat_message_chatRoomId" ON "chat_message" ("chatRoomId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_chat_message_senderId" ON "chat_message" ("senderId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_room" ADD CONSTRAINT "FK_chat_room_userId" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_message" ADD CONSTRAINT "FK_chat_message_chatRoomId" FOREIGN KEY ("chatRoomId") REFERENCES "chat_room"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_message" ADD CONSTRAINT "FK_chat_message_senderId" FOREIGN KEY ("senderId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "chat_message" DROP CONSTRAINT "FK_chat_message_senderId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_message" DROP CONSTRAINT "FK_chat_message_chatRoomId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_room" DROP CONSTRAINT "FK_chat_room_userId"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_chat_message_senderId"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_chat_message_chatRoomId"`,
    );
    await queryRunner.query(`DROP TABLE "chat_message"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_chat_room_userId"`);
    await queryRunner.query(`DROP TABLE "chat_room"`);
  }
}
