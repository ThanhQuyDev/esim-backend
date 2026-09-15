import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tax / fee per supplier, added to its cost before prices are compared (#049).
 *
 * No rows are seeded: every supplier starts at 0%, so the cheapest plans stay
 * exactly what they were until an admin enters a percentage.
 */
export class CreateProviderSurcharge1790000000000 implements MigrationInterface {
  name = 'CreateProviderSurcharge1790000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "provider_surcharge" (
        "provider" character varying(64) NOT NULL,
        "percentage" numeric(6,2) NOT NULL DEFAULT 0,
        "note" character varying(500),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_provider_surcharge_provider" PRIMARY KEY ("provider")
      )`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "provider_surcharge"`);
  }
}
