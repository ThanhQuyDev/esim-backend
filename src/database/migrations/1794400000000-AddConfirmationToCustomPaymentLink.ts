import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * #056 — a custom payment link sat in "Chờ thanh toán" forever unless OnePay's
 * IPN happened to arrive. There was no way for an admin to say what really
 * happened, and an abandoned link never left the pending tab.
 *
 * - `confirmedAt` / `confirmedByAdminId`: an admin said this was paid or failed.
 *   A manual change to a money record has to be attributable.
 * - `expiredAt`: the sweep gave up on it after OnePay's 30-minute window.
 *
 * `expiredAt` is what separates "nobody paid in time" from "the gateway said
 * no", which matters: a late IPN reporting success may promote an auto-expired
 * link to PAID, but must never overturn a real failure or an admin's decision.
 */
export class AddConfirmationToCustomPaymentLink1794400000000 implements MigrationInterface {
  name = 'AddConfirmationToCustomPaymentLink1794400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "custom_payment_link" ADD COLUMN IF NOT EXISTS "confirmedAt" TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "custom_payment_link" ADD COLUMN IF NOT EXISTS "confirmedByAdminId" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "custom_payment_link" ADD COLUMN IF NOT EXISTS "expiredAt" TIMESTAMP`,
    );
    // The sweep looks for pending links older than the window, so it reads these
    // two together.
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_custom_payment_link_status_createdAt"
       ON "custom_payment_link" ("status", "createdAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_custom_payment_link_status_createdAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "custom_payment_link" DROP COLUMN IF EXISTS "expiredAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "custom_payment_link" DROP COLUMN IF EXISTS "confirmedByAdminId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "custom_payment_link" DROP COLUMN IF EXISTS "confirmedAt"`,
    );
  }
}
