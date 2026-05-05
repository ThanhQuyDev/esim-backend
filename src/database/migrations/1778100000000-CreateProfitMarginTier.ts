import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProfitMarginTier1778100000000 implements MigrationInterface {
  name = 'CreateProfitMarginTier1778100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "profit_margin_tier" (
        "id" SERIAL NOT NULL,
        "minVnd" integer NOT NULL,
        "maxVnd" integer NOT NULL,
        "percentage" decimal(5,2) NOT NULL DEFAULT 0,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP,
        CONSTRAINT "PK_profit_margin_tier" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_profit_margin_tier_isActive" ON "profit_margin_tier" ("isActive")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_profit_margin_tier_minVnd" ON "profit_margin_tier" ("minVnd")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_profit_margin_tier_maxVnd" ON "profit_margin_tier" ("maxVnd")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_profit_margin_tier_maxVnd"`);
    await queryRunner.query(`DROP INDEX "IDX_profit_margin_tier_minVnd"`);
    await queryRunner.query(`DROP INDEX "IDX_profit_margin_tier_isActive"`);
    await queryRunner.query(`DROP TABLE "profit_margin_tier"`);
  }
}
