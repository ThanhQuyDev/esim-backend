import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * How long a tier's attribution lasts (#037, #072).
 *
 * The window was one number for everybody. The brief ties it to the tier — a
 * Silver partner is credited for 15 days, a higher tier for longer — and every
 * fresh click restarts that partner's own clock.
 *
 * Existing tiers keep today's behaviour: the default matches the constant the
 * code used before, so nobody's attribution changes length on deploy.
 */
export class AddAttributionDaysToPartnerTier1791400000000 implements MigrationInterface {
  name = 'AddAttributionDaysToPartnerTier1791400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "partner_tier" ADD COLUMN IF NOT EXISTS "attributionDays" integer NOT NULL DEFAULT 30`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "partner_tier" DROP COLUMN IF EXISTS "attributionDays"`,
    );
  }
}
