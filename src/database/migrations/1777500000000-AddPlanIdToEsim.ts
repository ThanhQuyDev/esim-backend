import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPlanIdToEsim1777500000000 implements MigrationInterface {
  name = 'AddPlanIdToEsim1777500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "esim" ADD "planId" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "esim" ADD CONSTRAINT "FK_esim_plan" FOREIGN KEY ("planId") REFERENCES "plan"("id") ON DELETE SET NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_esim_planId" ON "esim" ("planId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_esim_planId"`);
    await queryRunner.query(
      `ALTER TABLE "esim" DROP CONSTRAINT "FK_esim_plan"`,
    );
    await queryRunner.query(
      `ALTER TABLE "esim" DROP COLUMN IF EXISTS "planId"`,
    );
  }
}
