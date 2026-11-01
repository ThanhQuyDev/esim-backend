import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * "Số hóa đơn VAT" (doitac-3010 #044): the number the admin issued the
 * invoice under, and whether it went to a company or to a consumer — a
 * consumer invoice needs no company details.
 */
export class InvoiceNumberAndBuyerType1803400000000 implements MigrationInterface {
  name = 'InvoiceNumberAndBuyerType1803400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "invoice"
         ADD COLUMN IF NOT EXISTS "invoiceNumber" varchar(50),
         ADD COLUMN IF NOT EXISTS "buyerType" varchar(16) NOT NULL DEFAULT 'company'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "invoice"
         DROP COLUMN IF EXISTS "invoiceNumber",
         DROP COLUMN IF EXISTS "buyerType"`,
    );
  }
}
