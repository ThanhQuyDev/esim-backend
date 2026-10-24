import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * One name for "paid with the eXU wallet" (vande #023): an eSIM order paid in
 * full from the wallet was stored as "wallet", a topup paid the same way as
 * "exu_wallet", so the CMS "Thanh toán" column showed two names for one thing.
 */
export class ExuWalletPaymentMethod1800000000000 implements MigrationInterface {
  name = 'ExuWalletPaymentMethod1800000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "order" SET "paymentMethod" = 'exu_wallet' WHERE "paymentMethod" = 'wallet'`,
    );
  }

  public async down(): Promise<void> {
    // Not reversible: the rows that were "wallet" are no longer told apart.
  }
}
