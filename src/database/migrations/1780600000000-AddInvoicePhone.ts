import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInvoicePhone1780600000000 implements MigrationInterface {
  name = 'AddInvoicePhone1780600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "invoice" ADD "invoicePhone" character varying NOT NULL DEFAULT ''`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoice" ALTER COLUMN "invoicePhone" DROP DEFAULT`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "invoice" DROP COLUMN "invoicePhone"`);
  }
}
