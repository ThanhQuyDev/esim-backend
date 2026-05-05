import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddButtonContentViToTopBar1778000000000 implements MigrationInterface {
  name = 'AddButtonContentViToTopBar1778000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "top_bar" ADD COLUMN IF NOT EXISTS "buttonContentVi" character varying`,
    );
    await queryRunner.query(
      `UPDATE "top_bar" SET "buttonContentVi" = COALESCE("buttonContentVi", "buttonContent", '')`,
    );
    await queryRunner.query(
      `ALTER TABLE "top_bar" ALTER COLUMN "buttonContentVi" SET NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "top_bar" DROP COLUMN IF EXISTS "buttonContentVi"`,
    );
  }
}
