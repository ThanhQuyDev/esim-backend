import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIsPopularIsPublishedToHelpCenter1779300000000 implements MigrationInterface {
  name = 'AddIsPopularIsPublishedToHelpCenter1779300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "help_center" ADD COLUMN IF NOT EXISTS "isPopular" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "help_center" ADD COLUMN IF NOT EXISTS "isPublished" boolean NOT NULL DEFAULT true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "help_center" DROP COLUMN IF EXISTS "isPublished"`,
    );
    await queryRunner.query(
      `ALTER TABLE "help_center" DROP COLUMN IF EXISTS "isPopular"`,
    );
  }
}
