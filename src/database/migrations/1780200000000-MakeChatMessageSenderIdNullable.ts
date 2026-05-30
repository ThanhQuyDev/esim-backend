import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakeChatMessageSenderIdNullable1780200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop FK constraint on senderId if it exists
    const table = await queryRunner.getTable('chat_message');
    if (table) {
      const fk = table.foreignKeys.find(
        (fk) => fk.columnNames.indexOf('senderId') !== -1,
      );
      if (fk) {
        await queryRunner.dropForeignKey('chat_message', fk);
      }
    }

    // Make senderId nullable
    await queryRunner.query(
      `ALTER TABLE "chat_message" ALTER COLUMN "senderId" DROP NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "chat_message" ALTER COLUMN "senderId" SET NOT NULL`,
    );
  }
}
