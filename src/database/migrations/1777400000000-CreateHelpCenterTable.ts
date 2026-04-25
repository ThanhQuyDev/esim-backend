import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateHelpCenterTable1777400000000 implements MigrationInterface {
  name = 'CreateHelpCenterTable1777400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "help_center_category_enum" AS ENUM ('getting_started','plans_and_payments','troubleshooting','faq')
    `);
    await queryRunner.query(`
      CREATE TYPE "help_center_parent_enum" AS ENUM ('setting_up','using_esim','device_compatibility','payments','plans','find_an_answer','esim_functions','esim_basics','about_esimvn')
    `);
    await queryRunner.query(`
      CREATE TABLE "help_center" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "title" character varying NOT NULL,
        "content" text NOT NULL,
        "order" integer NOT NULL DEFAULT 0,
        "category" "help_center_category_enum" NOT NULL,
        "parent" "help_center_parent_enum" NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_help_center" PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "help_center"`);
    await queryRunner.query(`DROP TYPE "help_center_parent_enum"`);
    await queryRunner.query(`DROP TYPE "help_center_category_enum"`);
  }
}
