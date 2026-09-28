import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * What a distribution tier is worth, and tiers that are not for everyone.
 *
 * A distribution partner is promoted on revenue OR on the deposit they are
 * holding (#073) — either alone is enough, because a partner who keeps 100
 * triệu on account is as committed as one who has turned over 500 triệu. What
 * the tier buys them is a smaller markup over cost, not a commission.
 *
 * `isInternal` marks a tier that is negotiated rather than earned (#074): it
 * is left out of the public ladder and of the weekly review, and only an admin
 * placing a partner on it by hand puts anybody there.
 */
export class AddDistributionAndInternalTierRules1793000000000 implements MigrationInterface {
  name = 'AddDistributionAndInternalTierRules1793000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "partner_tier"
         ADD COLUMN IF NOT EXISTS "minDepositVnd" numeric(14,0) NOT NULL DEFAULT 0,
         ADD COLUMN IF NOT EXISTS "costMarkupPercent" numeric(5,2) NOT NULL DEFAULT 0,
         ADD COLUMN IF NOT EXISTS "isInternal" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_partner_tier_isInternal"
         ON "partner_tier" ("isInternal")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_partner_tier_isInternal"`,
    );
    await queryRunner.query(
      `ALTER TABLE "partner_tier"
         DROP COLUMN IF EXISTS "minDepositVnd",
         DROP COLUMN IF EXISTS "costMarkupPercent",
         DROP COLUMN IF EXISTS "isInternal"`,
    );
  }
}
