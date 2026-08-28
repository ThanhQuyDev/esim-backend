import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBankTransferCodeToOrder1780900000000 implements MigrationInterface {
  name = 'AddBankTransferCodeToOrder1780900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "order" ADD "bankTransferCode" character varying NULL`,
    );
    // Partial unique index: each pending bank-transfer order owns a unique
    // reference code used to match incoming SePay webhook transfers. NULL rows
    // (OnePay / wallet orders) are excluded so they don't collide.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_order_bankTransferCode" ON "order" ("bankTransferCode") WHERE "bankTransferCode" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_order_bankTransferCode"`);
    await queryRunner.query(
      `ALTER TABLE "order" DROP COLUMN "bankTransferCode"`,
    );
  }
}
