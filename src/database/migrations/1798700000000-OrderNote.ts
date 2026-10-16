import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * "Ghi chú" on an order (doitac-1410 #067): what an admin notes for the
 * record, newest first under "Thông tin đơn hàng". Admin-only; the customer
 * never sees it.
 */
export class OrderNote1798700000000 implements MigrationInterface {
  name = 'OrderNote1798700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "order_note" (
        "id" SERIAL PRIMARY KEY,
        "orderId" integer NOT NULL,
        "adminId" integer,
        "body" varchar(2000) NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_order_note_order" ON "order_note" ("orderId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "order_note"`);
  }
}
