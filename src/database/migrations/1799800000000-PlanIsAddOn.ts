import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Billion sells data add-ons ("Mua thêm dung lượng") apart from top-ups
 * ("Gia hạn gói"), so the Top-Up column of the plan list needs a third value
 * (vande #019). Set by hand in the CMS: the supplier catalogue does not say.
 */
export class PlanIsAddOn1799800000000 implements MigrationInterface {
  name = 'PlanIsAddOn1799800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "plan" ADD COLUMN IF NOT EXISTS "isAddOn" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "plan" DROP COLUMN "isAddOn"`);
  }
}
