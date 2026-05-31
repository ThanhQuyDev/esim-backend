import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIsPopularToBlog1780400000002 implements MigrationInterface {
  name = 'AddIsPopularToBlog1780400000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "blog" ADD "isPopular" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "blog" DROP COLUMN "isPopular"`);
  }
}
