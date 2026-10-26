import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Billion refunds delivered eSIMs through after-sale requests (F017, vande
 * #004), which it reviews and refunds later. One row per request, so its
 * N004 / N005 notices — and the F020 reads standing in for a lost notice —
 * land on the right order as notes for the admin.
 */
export class BillionAfterSale1801600000000 implements MigrationInterface {
  name = 'BillionAfterSale1801600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "billion_after_sale" (
        "id" SERIAL PRIMARY KEY,
        "afterSaleId" character varying(64) NOT NULL,
        "orderId" integer NOT NULL,
        "orderItemId" integer,
        "iccids" text NOT NULL,
        "reason" character varying(8) NOT NULL,
        "status" character varying(20) NOT NULL DEFAULT 'pending',
        "opinion" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_billion_after_sale_id" ON "billion_after_sale" ("afterSaleId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_billion_after_sale_order" ON "billion_after_sale" ("orderId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "billion_after_sale"`);
  }
}
