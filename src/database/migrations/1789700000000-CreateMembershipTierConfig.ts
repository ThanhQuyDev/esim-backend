import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Membership tiers become editable from the CMS (#024).
 *
 * Seeded with the values that were hardcoded until now, so nothing a customer
 * earns changes on deploy.
 */
export class CreateMembershipTierConfig1789700000000 implements MigrationInterface {
  name = 'CreateMembershipTierConfig1789700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "membership_tier_config" (
        "tier" character varying(32) NOT NULL,
        "minimumSpendVnd" bigint NOT NULL DEFAULT 0,
        "cashbackPercent" numeric(5,2) NOT NULL DEFAULT 0,
        "referralRewardVnd" bigint NOT NULL DEFAULT 0,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_membership_tier_config_tier" PRIMARY KEY ("tier")
      )`,
    );
    await queryRunner.query(
      `INSERT INTO "membership_tier_config" ("tier", "minimumSpendVnd", "cashbackPercent", "referralRewardVnd") VALUES
        ('traveler', 0, 2, 10000),
        ('silver', 1000000, 3, 12000),
        ('gold', 5000000, 4, 15000),
        ('platinum', 25000000, 7, 20000)
      ON CONFLICT ("tier") DO NOTHING`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "membership_tier_config"`);
  }
}
