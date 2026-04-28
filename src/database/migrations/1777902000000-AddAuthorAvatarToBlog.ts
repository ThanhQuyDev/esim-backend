import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAuthorAvatarToBlog1777902000000 implements MigrationInterface {
  name = 'AddAuthorAvatarToBlog1777902000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "blog" ADD "authorAvatar" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "blog" DROP COLUMN "authorAvatar"`);
  }
}
