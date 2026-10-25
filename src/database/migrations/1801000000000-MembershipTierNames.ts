import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Membership tiers the admin names, adds and removes (vande #066).
 *
 * The four built-in tiers get their names here, and a row each if the table
 * was never saved from the CMS, so the ladder in the database is complete
 * before anyone adds a fifth.
 */
const BUILT_IN = [
  ['traveler', 'Du khách', 'Traveler', 0, 2, 10000],
  ['silver', 'Du khách bạc', 'Silver Traveler', 1000000, 3, 12000],
  ['gold', 'Du khách vàng', 'Gold Traveler', 5000000, 4, 15000],
  ['platinum', 'Du khách bạch kim', 'Platinum Traveler', 25000000, 7, 20000],
] as const;

export class MembershipTierNames1801000000000 implements MigrationInterface {
  name = 'MembershipTierNames1801000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "membership_tier_config" ADD COLUMN IF NOT EXISTS "name" character varying(60)`,
    );
    await queryRunner.query(
      `ALTER TABLE "membership_tier_config" ADD COLUMN IF NOT EXISTS "nameEn" character varying(60)`,
    );
    for (const [tier, name, nameEn, spend, cashback, reward] of BUILT_IN) {
      await queryRunner.query(
        `INSERT INTO "membership_tier_config"
           ("tier", "minimumSpendVnd", "cashbackPercent", "referralRewardVnd", "name", "nameEn")
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT ("tier") DO UPDATE
           SET "name" = COALESCE("membership_tier_config"."name", EXCLUDED."name"),
               "nameEn" = COALESCE("membership_tier_config"."nameEn", EXCLUDED."nameEn")`,
        [tier, spend, cashback, reward, name, nameEn],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "membership_tier_config" DROP COLUMN IF EXISTS "nameEn"`,
    );
    await queryRunner.query(
      `ALTER TABLE "membership_tier_config" DROP COLUMN IF EXISTS "name"`,
    );
  }
}
