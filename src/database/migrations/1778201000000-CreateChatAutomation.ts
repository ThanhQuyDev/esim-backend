import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateChatAutomation1778201000000 implements MigrationInterface {
  name = 'CreateChatAutomation1778201000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "chat_automation" (
        "id" SERIAL NOT NULL,
        "type" character varying NOT NULL,
        "message" text NOT NULL,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_chat_automation_type" UNIQUE ("type"),
        CONSTRAINT "PK_chat_automation" PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "chat_automation"`);
  }
}
