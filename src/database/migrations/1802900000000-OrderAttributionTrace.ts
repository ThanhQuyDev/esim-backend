import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * How each order's partner was chosen (doitac-3010 #022, rule 6): every click
 * and code that was weighed, which won, and the rule that decided. Orders
 * from before have no trace.
 */
export class OrderAttributionTrace1802900000000 implements MigrationInterface {
  name = 'OrderAttributionTrace1802900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "order_attribution_trace" (
        "orderId" integer PRIMARY KEY,
        "rule" character varying(60) NOT NULL,
        "candidates" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now()
      )`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "order_attribution_trace"`);
  }
}
