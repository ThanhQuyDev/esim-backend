import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Put back "Giờ làm mới mỗi ngày" the supplier syncs blanked (vande #033).
 *
 * 1794700000000 filled these defaults once, but every later re-sync passed the
 * field as undefined and the plan update wrote null over it, so on production
 * almost every esimaccess / airalo plan and every domestic eSIM lost it. The
 * update is fixed; this re-applies the same supplier facts to the rows left
 * empty. Billion and MicroEsim are filled from their own API on the next sync.
 */
export class RefillPlanDailyReset1800100000000 implements MigrationInterface {
  name = 'RefillPlanDailyReset1800100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "plan"
      SET "dailyResetPolicy" = 'rolling_24h'
      WHERE "dailyResetPolicy" IS NULL
        AND "isLocalInventory" = false
        AND LOWER("provider") IN ('gadgetkorea', 'esimaccess', 'airalo')
    `);

    await queryRunner.query(`
      UPDATE "plan"
      SET "dailyResetPolicy" = 'calendar_day',
          "dailyResetUtcOffset" = 7
      WHERE "dailyResetPolicy" IS NULL
        AND ("isLocalInventory" = true OR LOWER("provider") = 'viettel')
    `);
  }

  public async down(): Promise<void> {
    // Data only; the values it filled are correct.
  }
}
