import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Expiry of the local eSIMs already sold (#024, test round 4): a Viettel
 * travel eSIM runs its plan's days from the PURCHASE (no Vietnamese carrier
 * reports activation), so its expiry is the order date + the plan's days; a
 * domestic eSIM has no end, so its expiry is cleared. New sales set this when
 * the eSIM is assigned; this puts the ones sold before that right.
 */
export class LocalEsimExpiryFromSale1796100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "esim" e
         SET "expiresAt" = o."createdAt" + make_interval(days => p."durationDays")
        FROM "plan" p, "order_item" oi, "order" o
       WHERE p.id = e."planId"
         AND oi.id = e."orderItemId"
         AND o.id = oi."orderId"
         AND p."isLocalInventory" = true
         AND p."isDomesticEsim" = false
         AND p."durationDays" > 0
         AND e.status = 'sold'
    `);
    await queryRunner.query(`
      UPDATE "esim" e
         SET "expiresAt" = NULL
        FROM "plan" p
       WHERE p.id = e."planId"
         AND p."isDomesticEsim" = true
         AND e.status = 'sold'
    `);
  }

  public async down(): Promise<void> {
    // The upload-time dates were the bug; nothing to restore.
  }
}
