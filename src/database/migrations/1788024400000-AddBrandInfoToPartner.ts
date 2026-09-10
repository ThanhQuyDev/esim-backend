import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Branding a partner sets for their own portal page: display name, logo,
 * tagline. Stored as jsonb so adding a field later needs no migration — the
 * shape is documented on `PartnerEntity.brandInfo`.
 */
export class AddBrandInfoToPartner1788024400000 implements MigrationInterface {
  name = 'AddBrandInfoToPartner1788024400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "partner" ADD COLUMN IF NOT EXISTS "brandInfo" jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "partner" DROP COLUMN IF EXISTS "brandInfo"`,
    );
  }
}
