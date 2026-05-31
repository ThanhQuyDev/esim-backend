import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFaqEnabledToBlog1780400000001 implements MigrationInterface {
  name = 'AddFaqEnabledToBlog1780400000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "blog" ADD "faqEnabled" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "blog" DROP COLUMN "faqEnabled"`);
  }
}
