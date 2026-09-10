import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `PartnerTierEntity` and `PartnerLinkEntity` both declare `@DeleteDateColumn()`,
 * but CreatePartnerTables1788023400000 only added `deletedAt` to `partner`.
 * TypeORM selects the column on every read, so every query against
 * `partner_tier` / `partner_link` failed with
 * `column PartnerTierEntity.deletedAt does not exist` (42703) — which took out
 * the whole tier admin screen and every KOL-link operation (create, list,
 * click tracking, order attribution).
 */
export class AddDeletedAtToPartnerTierAndLink1788023900000 implements MigrationInterface {
  name = 'AddDeletedAtToPartnerTierAndLink1788023900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "partner_tier" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "partner_link" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "partner_link" DROP COLUMN IF EXISTS "deletedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "partner_tier" DROP COLUMN IF EXISTS "deletedAt"`,
    );
  }
}
