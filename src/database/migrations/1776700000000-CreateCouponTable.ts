import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCouponTable1776700000000 implements MigrationInterface {
  name = 'CreateCouponTable1776700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "coupon" (
        "id" SERIAL NOT NULL,
        "code" character varying(50) NOT NULL,
        "discountPercent" numeric(5,2) NOT NULL,
        "maxUsage" integer,
        "maxUsagePerUser" integer,
        "usageCount" integer NOT NULL DEFAULT 0,
        "minOrderAmount" numeric(10,2),
        "expiresAt" TIMESTAMP,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP,
        CONSTRAINT "UQ_coupon_code" UNIQUE ("code"),
        CONSTRAINT "PK_coupon" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_coupon_code" ON "coupon" ("code")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_coupon_isActive" ON "coupon" ("isActive")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_coupon_isActive"`);
    await queryRunner.query(`DROP INDEX "IDX_coupon_code"`);
    await queryRunner.query(`DROP TABLE "coupon"`);
  }
}
