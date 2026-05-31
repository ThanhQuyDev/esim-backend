import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddParentToBlog1780400000000 implements MigrationInterface {
  name = 'AddParentToBlog1780400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "blog" ADD "parent" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "blog" DROP COLUMN "parent"`);
  }
}
