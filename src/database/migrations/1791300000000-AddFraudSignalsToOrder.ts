import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Signals for watching affiliate fraud (#036).
 *
 * An order that comes from the same device and network as another order for
 * the same partner still earns the commission — the brief is explicit — but it
 * is flagged so an admin can look at that partner's other transactions.
 *
 * The IP is stored hashed: it identifies a household well enough for this
 * comparison without keeping the address itself.
 */
export class AddFraudSignalsToOrder1791300000000 implements MigrationInterface {
  name = 'AddFraudSignalsToOrder1791300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "buyerIpHash" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "buyerVisitorId" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "attributionWarning" character varying`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_order_buyerVisitorId" ON "order" ("buyerVisitorId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_order_buyerVisitorId"`);
    await queryRunner.query(
      `ALTER TABLE "order" DROP COLUMN IF EXISTS "attributionWarning"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" DROP COLUMN IF EXISTS "buyerVisitorId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" DROP COLUMN IF EXISTS "buyerIpHash"`,
    );
  }
}
