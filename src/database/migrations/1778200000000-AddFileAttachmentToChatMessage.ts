import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFileAttachmentToChatMessage1778200000000 implements MigrationInterface {
  name = 'AddFileAttachmentToChatMessage1778200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "chat_message" ADD "fileUrl" character varying NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_message" ADD "fileName" character varying NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_message" ADD "fileType" character varying NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_message" ADD "fileSize" integer NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "chat_message" DROP COLUMN "fileSize"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_message" DROP COLUMN "fileType"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_message" DROP COLUMN "fileName"`,
    );
    await queryRunner.query(`ALTER TABLE "chat_message" DROP COLUMN "fileUrl"`);
  }
}
