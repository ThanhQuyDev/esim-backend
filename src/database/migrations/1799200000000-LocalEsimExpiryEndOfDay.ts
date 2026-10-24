import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The "Expried Time" of an imported eSIM is the last day it works, in Vietnam
 * (vande #002). It was stored as midnight UTC — "31/12/2026" showed as
 * "07:00 31/12" and would have ended the eSIM 17 hours early. Move the dates
 * already imported to 23:59:59.999 +07:00 of the same day.
 *
 * Only eSIMs whose date still comes from the file are touched: unsold stock of
 * local plans, and domestic eSIMs (their sale keeps the file's date). A sold
 * Viettel travel eSIM's expiry is the sale time + its days, never a bare
 * midnight, and is left alone.
 */
export class LocalEsimExpiryEndOfDay1799200000000 implements MigrationInterface {
  name = 'LocalEsimExpiryEndOfDay1799200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "esim" e
         SET "expiresAt" = e."expiresAt" + interval '16 hours 59 minutes 59.999 seconds'
        FROM "plan" p
       WHERE p.id = e."planId"
         AND p."isLocalInventory" = true
         AND (e.status = 'available' OR p."isDomesticEsim" = true)
         AND e."expiresAt" IS NOT NULL
         AND e."expiresAt"::time = '00:00:00'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "esim" e
         SET "expiresAt" = e."expiresAt" - interval '16 hours 59 minutes 59.999 seconds'
        FROM "plan" p
       WHERE p.id = e."planId"
         AND p."isLocalInventory" = true
         AND (e.status = 'available' OR p."isDomesticEsim" = true)
         AND e."expiresAt"::time = '16:59:59.999'
    `);
  }
}
