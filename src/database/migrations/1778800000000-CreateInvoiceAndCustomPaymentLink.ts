import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateInvoiceAndCustomPaymentLink1778800000000 implements MigrationInterface {
  name = 'CreateInvoiceAndCustomPaymentLink1778800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // -------------- invoice --------------
    await queryRunner.query(`
      CREATE TABLE "invoice" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "status" character varying NOT NULL DEFAULT 'PENDING',
        "invoiceEmail" character varying NOT NULL,
        "address" character varying NOT NULL,
        "taxCode" character varying NOT NULL,
        "companyName" character varying NOT NULL,
        "orderId" integer NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_invoice" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_invoice_orderId" UNIQUE ("orderId"),
        CONSTRAINT "FK_invoice_order" FOREIGN KEY ("orderId")
          REFERENCES "order"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_invoice_status" ON "invoice" ("status")`,
    );

    // -------------- custom_payment_link --------------
    await queryRunner.query(`
      CREATE TABLE "custom_payment_link" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "virtualOrderId" character varying NOT NULL,
        "customerEmail" character varying NOT NULL,
        "amount" decimal(14,0) NOT NULL,
        "currency" character varying NOT NULL DEFAULT 'VND',
        "description" character varying NOT NULL,
        "paymentUrl" character varying,
        "status" character varying NOT NULL DEFAULT 'PENDING',
        "paymentId" character varying,
        "createdById" integer,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_custom_payment_link" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_custom_payment_link_virtualOrderId" UNIQUE ("virtualOrderId"),
        CONSTRAINT "FK_custom_payment_link_user" FOREIGN KEY ("createdById")
          REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_custom_payment_link_status" ON "custom_payment_link" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_custom_payment_link_customerEmail" ON "custom_payment_link" ("customerEmail")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_custom_payment_link_createdById" ON "custom_payment_link" ("createdById")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_custom_payment_link_createdById"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_custom_payment_link_customerEmail"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_custom_payment_link_status"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "custom_payment_link"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_invoice_status"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "invoice"`);
  }
}
