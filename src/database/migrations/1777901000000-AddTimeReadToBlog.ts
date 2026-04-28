import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTimeReadToBlog1777901000000 implements MigrationInterface {
  name = 'AddTimeReadToBlog1777901000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "blog" ADD "timeRead" integer`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "blog" DROP COLUMN "timeRead"`);
  }
}
