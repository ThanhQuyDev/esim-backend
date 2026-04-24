import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCartTable1776836128000 implements MigrationInterface {
  name = 'CreateCartTable1776836128000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "cart" (
        "id" SERIAL NOT NULL,
        "userId" integer NOT NULL,
        "planId" integer NOT NULL,
        "quantity" integer NOT NULL DEFAULT 1,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_cart_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_cart_user_plan" UNIQUE ("userId", "planId")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_cart_userId" ON "cart" ("userId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_cart_userId"`);
    await queryRunner.query(`DROP TABLE "cart"`);
  }
}
