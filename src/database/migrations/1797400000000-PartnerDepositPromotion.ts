import { MigrationInterface, QueryRunner } from 'typeorm';

/** Deposit promotions set up by the admin (doitac-1410 #015). */
export class PartnerDepositPromotion1797400000000 implements MigrationInterface {
  name = 'PartnerDepositPromotion1797400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "partner_deposit_promotion" (
        "id" SERIAL PRIMARY KEY,
        "name" varchar NOT NULL,
        "bonusPercent" numeric(5,2) NOT NULL,
        "minDepositVnd" numeric(14,0) NOT NULL,
        "maxBonusVnd" numeric(14,0),
        "startsAt" timestamptz NOT NULL,
        "endsAt" timestamptz NOT NULL,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdByAdminId" integer,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      )`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "partner_deposit_promotion"`);
  }
}
