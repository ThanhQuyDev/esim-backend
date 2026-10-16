import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * "Hạng mặc định" (doitac-1410 #059, #060): the one tier of each partner type
 * a new partner is put on, so an admin no longer assigns it by hand. At most
 * one per type, kept so by a partial unique index.
 */
export class PartnerTierDefault1798400000000 implements MigrationInterface {
  name = 'PartnerTierDefault1798400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "partner_tier" ADD COLUMN IF NOT EXISTS "isDefault" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_partner_tier_default_per_type"
         ON "partner_tier" ("partnerType")
         WHERE "isDefault" AND "deletedAt" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_partner_tier_default_per_type"`,
    );
    await queryRunner.query(
      `ALTER TABLE "partner_tier" DROP COLUMN IF EXISTS "isDefault"`,
    );
  }
}
