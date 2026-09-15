import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The order a blog post's plans were typed in (#057).
 *
 * `blog_plans` has no position column, so the order was lost. Existing posts
 * start with no stored order and keep showing plans as before until they are
 * saved again from the CMS.
 */
export class AddPlanOrderToBlog1790200000000 implements MigrationInterface {
  name = 'AddPlanOrderToBlog1790200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "blog" ADD COLUMN IF NOT EXISTS "planOrder" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "blog" DROP COLUMN IF EXISTS "planOrder"`,
    );
  }
}
