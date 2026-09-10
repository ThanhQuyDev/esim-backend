import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Ledger of the money esim.vn has placed on deposit with each eSIM supplier
 * ("ký quỹ"), plus the balance that supplier reports back.
 *
 * The amount actually SPENT is not stored here — it is summed from completed
 * order items, so it can never drift from the orders themselves. This table
 * only holds what an admin enters by hand.
 */
export class CreateProviderDepositEntry1788024600000 implements MigrationInterface {
  name = 'CreateProviderDepositEntry1788024600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "provider_deposit_entry" (
        "id" SERIAL NOT NULL,
        "provider" character varying(64) NOT NULL,
        "type" character varying(32) NOT NULL DEFAULT 'deposit',
        "amountVnd" decimal(14,0) NOT NULL DEFAULT 0,
        "reportedBalanceVnd" decimal(14,0),
        "note" character varying(500),
        "occurredAt" TIMESTAMP NOT NULL DEFAULT now(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP,
        CONSTRAINT "PK_provider_deposit_entry" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_provider_deposit_entry_provider" ON "provider_deposit_entry" ("provider")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_provider_deposit_entry_occurredAt" ON "provider_deposit_entry" ("occurredAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "provider_deposit_entry"`);
  }
}
