import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Two more entity/migration mismatches from CreatePartnerTables1788023400000,
 * each of which made every read of its table fail (42703) and so took out the
 * screen behind it:
 *
 *  - `PartnerPayoutEntity.bankAccountInfo` (string) was created as `bankInfo`
 *    (jsonb) → partner payouts and the admin payout queue were both dead.
 *  - `PartnerDepositRequestEntity.walletTransactionId` was never created →
 *    deposit requests (the ký quỹ top-up flow) were dead.
 */
export class FixPartnerPayoutAndDepositColumns1788024100000 implements MigrationInterface {
  name = 'FixPartnerPayoutAndDepositColumns1788024100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (
      (await this.hasColumn(queryRunner, 'partner_payout', 'bankInfo')) &&
      !(await this.hasColumn(queryRunner, 'partner_payout', 'bankAccountInfo'))
    ) {
      // jsonb → text keeps whatever was stored readable in the new string column.
      await queryRunner.query(
        `ALTER TABLE "partner_payout" RENAME COLUMN "bankInfo" TO "bankAccountInfo"`,
      );
      await queryRunner.query(
        `ALTER TABLE "partner_payout" ALTER COLUMN "bankAccountInfo" TYPE character varying USING "bankAccountInfo"::text`,
      );
    }

    await queryRunner.query(
      `ALTER TABLE "partner_deposit_request" ADD COLUMN IF NOT EXISTS "walletTransactionId" integer`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "partner_deposit_request" DROP COLUMN IF EXISTS "walletTransactionId"`,
    );

    if (
      await this.hasColumn(queryRunner, 'partner_payout', 'bankAccountInfo')
    ) {
      await queryRunner.query(
        `ALTER TABLE "partner_payout" ALTER COLUMN "bankAccountInfo" TYPE jsonb USING to_jsonb("bankAccountInfo")`,
      );
      await queryRunner.query(
        `ALTER TABLE "partner_payout" RENAME COLUMN "bankAccountInfo" TO "bankInfo"`,
      );
    }
  }

  private async hasColumn(
    queryRunner: QueryRunner,
    table: string,
    column: string,
  ): Promise<boolean> {
    const rows = await queryRunner.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = $2`,
      [table, column],
    );
    return rows.length > 0;
  }
}
