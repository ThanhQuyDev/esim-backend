import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Refund requests sent to Airalo (vande-0411 #009). Airalo sends no notice of
 * the outcome, so these are followed by reading the order's status.
 */
export class AiraloRefundRequest1803700000000 implements MigrationInterface {
  name = 'AiraloRefundRequest1803700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "airalo_refund_request" (
        "id" SERIAL PRIMARY KEY,
        "refundId" character varying(64) NOT NULL,
        "orderId" integer NOT NULL,
        "iccids" text NOT NULL,
        "airaloOrderIds" text NOT NULL DEFAULT '',
        "reason" character varying(40) NOT NULL,
        "status" character varying(20) NOT NULL DEFAULT 'pending',
        "statusText" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_airalo_refund_request_id" ON "airalo_refund_request" ("refundId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_airalo_refund_request_order" ON "airalo_refund_request" ("orderId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "airalo_refund_request"`);
  }
}
