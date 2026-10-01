import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * "Giờ làm mới mỗi ngày" on the plan (#063).
 *
 * Two columns rather than one: the policy, and — for a calendar-day reset — the
 * timezone its day ends in. Viettel and the domestic eSIMs run on UTC+7 and the
 * Chinese suppliers on UTC+8, so a single hard-coded offset in the storefront
 * copy would be wrong for one of them.
 *
 * The backfill applies only the defaults that are fixed facts about a supplier
 * (#071): GadgetKorea publishes "reset 24h", esimaccess and airalo both confirmed
 * 24h when asked, and Viettel / domestic eSIMs reset on the Vietnamese calendar
 * day. Billion and MicroEsim are left null on purpose — they state the cycle per
 * plan, so a guess here would have to be unpicked later.
 */
export class AddDailyResetToPlan1794700000000 implements MigrationInterface {
  name = 'AddDailyResetToPlan1794700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "plan" ADD COLUMN IF NOT EXISTS "dailyResetPolicy" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "plan" ADD COLUMN IF NOT EXISTS "dailyResetUtcOffset" integer`,
    );

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

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "plan" DROP COLUMN IF EXISTS "dailyResetUtcOffset"`,
    );
    await queryRunner.query(
      `ALTER TABLE "plan" DROP COLUMN IF EXISTS "dailyResetPolicy"`,
    );
  }
}
