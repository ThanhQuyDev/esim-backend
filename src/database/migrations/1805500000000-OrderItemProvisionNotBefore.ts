import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * When a line of a paced order may first be sent to the supplier
 * (vande-1411 #003). A bulk order used to ask for every eSIM in the same
 * instant and the supplier refused part of them (429); each eSIM now gets its
 * own moment, 10–30 seconds (5–10 for a file) after the one before.
 * NULL — the line is sent at once, as before.
 */
export class OrderItemProvisionNotBefore1805500000000 implements MigrationInterface {
  name = 'OrderItemProvisionNotBefore1805500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "order_item" ADD COLUMN IF NOT EXISTS "provisionNotBefore" TIMESTAMP WITH TIME ZONE`,
    );
    // The dispatcher looks for due lines that were never tried.
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_order_item_provision_not_before"
         ON "order_item" ("provisionNotBefore")
        WHERE "provisionNotBefore" IS NOT NULL AND "provisionAttempts" = 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_order_item_provision_not_before"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_item" DROP COLUMN IF EXISTS "provisionNotBefore"`,
    );
  }
}
