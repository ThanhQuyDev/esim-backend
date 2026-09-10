import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * One row per partner per weekly tier review, so a partner can see why their
 * tier is what it is and an admin can audit a promotion after the fact.
 */
export class CreatePartnerTierEvaluation1788024500000 implements MigrationInterface {
  name = 'CreatePartnerTierEvaluation1788024500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "partner_tier_evaluation" (
        "id" SERIAL NOT NULL,
        "partnerId" integer NOT NULL,
        "evaluatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "revenueVnd" decimal(14,0) NOT NULL DEFAULT 0,
        "validOrders" integer NOT NULL DEFAULT 0,
        "tierBefore" character varying,
        "tierAfter" character varying,
        "result" character varying NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_partner_tier_evaluation" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_partner_tier_evaluation_partnerId" ON "partner_tier_evaluation" ("partnerId")`,
    );
    await queryRunner.query(`
      ALTER TABLE "partner_tier_evaluation"
        ADD CONSTRAINT "FK_partner_tier_evaluation_partner"
        FOREIGN KEY ("partnerId") REFERENCES "partner"("id") ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "partner_tier_evaluation"`);
  }
}
