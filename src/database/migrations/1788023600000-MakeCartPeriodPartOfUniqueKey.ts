import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakeCartPeriodPartOfUniqueKey1788023600000 implements MigrationInterface {
  name = 'MakeCartPeriodPartOfUniqueKey1788023600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "cart" DROP CONSTRAINT IF EXISTS "UQ_cart_user_plan"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_cart_userId_planId"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_cart_user_plan_period" ON "cart" ("userId", "planId", COALESCE("periodNum", 0))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_cart_user_plan_period"`);

    // Keep the most recently updated row for each plan before restoring the
    // old constraint, since different durations can no longer coexist.
    await queryRunner.query(`
      DELETE FROM "cart" older
      USING "cart" newer
      WHERE older."userId" = newer."userId"
        AND older."planId" = newer."planId"
        AND (
          older."updatedAt" < newer."updatedAt"
          OR (older."updatedAt" = newer."updatedAt" AND older."id" < newer."id")
        )
    `);
    await queryRunner.query(
      `ALTER TABLE "cart" ADD CONSTRAINT "UQ_cart_user_plan" UNIQUE ("userId", "planId")`,
    );
  }
}
