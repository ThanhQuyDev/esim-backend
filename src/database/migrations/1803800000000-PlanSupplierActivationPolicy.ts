import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * What a supplier says about when a plan's days start (vande-0411 #025):
 * Airalo's `activation_policy` (filled by the next sync) and Gadget Korea's
 * "PreInstallation" column. Gadget plans for Turkey, or for a region with
 * Turkey in it, are marked now rather than at the next import.
 */
export class PlanSupplierActivationPolicy1803800000000 implements MigrationInterface {
  name = 'PlanSupplierActivationPolicy1803800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "plan" ADD COLUMN IF NOT EXISTS "supplierActivationPolicy" varchar`,
    );
    await queryRunner.query(`
      UPDATE "plan" p SET "supplierActivationPolicy" = 'Only Pre-Arrival'
       WHERE p."provider" = 'gadgetkorea' AND (
         EXISTS (SELECT 1 FROM destination d
                  WHERE d.id = p."destinationId"
                    AND (d."countryCode" = 'TR' OR d.name ILIKE 'turk%'))
         OR EXISTS (SELECT 1 FROM destination_region dr
                      JOIN destination d ON d.id = dr."destinationId"
                     WHERE dr."regionId" = p."regionId"
                       AND (d."countryCode" = 'TR' OR d.name ILIKE 'turk%'))
       )`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "plan" DROP COLUMN IF EXISTS "supplierActivationPolicy"`,
    );
  }
}
