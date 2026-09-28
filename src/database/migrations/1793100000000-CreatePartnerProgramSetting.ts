import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The partner programme's own settings (#075, #076, #077).
 *
 * The thresholds used to be constants in the source, which meant changing the
 * minimum withdrawal was a deploy. They are also not one number: what a
 * marketing partner may withdraw and what a distribution partner must keep on
 * deposit are different decisions, so each partner type carries its own.
 *
 * One row, seeded with the constants that were in the code, so nothing moves
 * the day this lands.
 */
export class CreatePartnerProgramSetting1793100000000 implements MigrationInterface {
  name = 'CreatePartnerProgramSetting1793100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "partner_program_setting" (
         "id" SERIAL NOT NULL,
         "payoutMinKolVnd" integer NOT NULL DEFAULT 50000,
         "payoutMinDistributionVnd" integer NOT NULL DEFAULT 50000,
         "depositMinKolVnd" integer NOT NULL DEFAULT 100000,
         "depositMinDistributionVnd" integer NOT NULL DEFAULT 100000,
         "lowDepositWarningVnd" integer NOT NULL DEFAULT 500000,
         "reconciliationEmailEnabled" boolean NOT NULL DEFAULT false,
         "reconciliationEmailDayOfMonth" integer NOT NULL DEFAULT 5,
         "updatedByAdminId" integer,
         "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
         "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
         CONSTRAINT "PK_partner_program_setting" PRIMARY KEY ("id")
       )`,
    );

    // The single row. Seeded with today's constants so the change is invisible
    // until somebody edits it on purpose.
    await queryRunner.query(
      `INSERT INTO "partner_program_setting" ("id") VALUES (1)
       ON CONFLICT ("id") DO NOTHING`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "partner_program_setting"`);
  }
}
