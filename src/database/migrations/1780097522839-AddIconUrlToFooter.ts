import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIconUrlToFooter1780097522839 implements MigrationInterface {
  name = 'AddIconUrlToFooter1780097522839';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "footer" ADD "iconUrl" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "footer" DROP COLUMN "iconUrl"`);
  }
}
