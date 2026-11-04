import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Local eSIMs already sold take their dates from the order (vande-0411 #046):
 * created, installed and activated when it was placed, ending its days later.
 */
export class LocalEsimSaleDates1804200000000 implements MigrationInterface {
  name = 'LocalEsimSaleDates1804200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "esim" e SET
        "createdAt" = o."createdAt",
        "installedAt" = o."createdAt",
        "activatedAt" = o."createdAt",
        "expiresAt" = CASE
          WHEN p."durationDays" > 0
            THEN o."createdAt" + make_interval(days => p."durationDays")
          ELSE e."expiresAt"
        END
      FROM "order_item" oi
      JOIN "order" o ON o.id = oi."orderId"
      JOIN "plan" p ON p.id = oi."planId"
      WHERE e."orderItemId" = oi.id
        AND p."isLocalInventory" = true
        AND e."deletedAt" IS NULL
        AND lower(e."status") <> 'refunded'`);
  }

  public async down(): Promise<void> {
    // The dates they had were not kept.
  }
}
