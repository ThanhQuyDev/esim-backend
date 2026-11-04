import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Domestic plans (vande-0411 #044): a monthly total is a fixed plan, and `call`
 * / `sms` hold how many, from the offer the file gave, not a 1 for "has some".
 */
export class DomesticPlanTypeAndCalls1804000000000 implements MigrationInterface {
  name = 'DomesticPlanTypeAndCalls1804000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "plan" SET "type" = 'fixed' WHERE "type" = 'month'`,
    );
    await queryRunner.query(`
      UPDATE "plan" SET
        "call" = NULLIF(
          COALESCE(("domesticOffer"->>'offNetMinutes')::int, 0) +
          COALESCE(("domesticOffer"->>'onNetMinutes')::int, 0) +
          COALESCE(("domesticOffer"->>'domesticMinutes')::int, 0), 0),
        "sms" = NULLIF(
          COALESCE(("domesticOffer"->>'offNetSms')::int, 0) +
          COALESCE(("domesticOffer"->>'onNetSms')::int, 0), 0)
      WHERE "domesticOffer" IS NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "plan" SET "type" = 'month'
        WHERE "type" = 'fixed'
          AND "domesticOffer"->>'bundleType' = 'month'`,
    );
  }
}
