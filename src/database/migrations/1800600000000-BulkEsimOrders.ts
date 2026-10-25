import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Ordering eSIMs in bulk from a file (vande #057).
 *
 * Mailing a whole travel group's QR codes back to back looks like spam and
 * some never arrive, so an order of the "email" kind has its eSIM emails
 * queued and sent a set number of seconds apart; an order of the "file" kind
 * sends none and hands the eSIMs over as a downloadable list.
 */
export class BulkEsimOrders1800600000000 implements MigrationInterface {
  name = 'BulkEsimOrders1800600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "bulkMode" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "bulkBatch" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "bulkEmailIntervalSec" integer`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_order_bulkBatch" ON "order" ("bulkBatch")`,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "esim_email_queue" (
         "id" SERIAL PRIMARY KEY,
         "batch" character varying NOT NULL,
         "orderNumber" character varying NOT NULL,
         "esimId" integer,
         "payload" jsonb NOT NULL,
         "intervalSec" integer NOT NULL DEFAULT 0,
         "scheduledAt" TIMESTAMPTZ NOT NULL,
         "sendAt" TIMESTAMPTZ NOT NULL,
         "sentAt" TIMESTAMPTZ,
         "attempts" integer NOT NULL DEFAULT 0,
         "lastError" text,
         "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
       )`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_esim_email_queue_due" ON "esim_email_queue" ("sendAt") WHERE "sentAt" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_esim_email_queue_batch" ON "esim_email_queue" ("batch")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "esim_email_queue"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_order_bulkBatch"`);
    await queryRunner.query(
      `ALTER TABLE "order" DROP COLUMN IF EXISTS "bulkEmailIntervalSec"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" DROP COLUMN IF EXISTS "bulkBatch"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" DROP COLUMN IF EXISTS "bulkMode"`,
    );
  }
}
