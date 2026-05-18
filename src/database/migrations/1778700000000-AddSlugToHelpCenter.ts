import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSlugToHelpCenter1778700000000 implements MigrationInterface {
  name = 'AddSlugToHelpCenter1778700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "help_center" ADD "slug" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "help_center" DROP COLUMN "slug"`);
  }
}
