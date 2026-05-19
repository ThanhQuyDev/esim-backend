import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChangeHelpCenterCategoryParentToString1779200000000 implements MigrationInterface {
  name = 'ChangeHelpCenterCategoryParentToString1779200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Convert enum columns to plain varchar
    await queryRunner.query(
      `ALTER TABLE "help_center" ALTER COLUMN "category" TYPE character varying USING "category"::text`,
    );
    await queryRunner.query(
      `ALTER TABLE "help_center" ALTER COLUMN "parent" TYPE character varying USING "parent"::text`,
    );

    // Drop now-unused enum types
    await queryRunner.query(`DROP TYPE IF EXISTS "help_center_category_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "help_center_parent_enum"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Recreate enum types
    await queryRunner.query(
      `CREATE TYPE "help_center_category_enum" AS ENUM ('getting_started','plans_and_payments','troubleshooting','faq')`,
    );
    await queryRunner.query(
      `CREATE TYPE "help_center_parent_enum" AS ENUM ('setting_up','using_esim','device_compatibility','payments','plans','find_an_answer','esim_functions','esim_basics','about_esimvn')`,
    );

    // Convert columns back to enum (rows whose value is not in the enum will fail)
    await queryRunner.query(
      `ALTER TABLE "help_center" ALTER COLUMN "category" TYPE "help_center_category_enum" USING "category"::"help_center_category_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "help_center" ALTER COLUMN "parent" TYPE "help_center_parent_enum" USING "parent"::"help_center_parent_enum"`,
    );
  }
}
