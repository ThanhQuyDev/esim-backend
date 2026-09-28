import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The payout's own copy of the bank account it is going to (#069).
 *
 * `bankAccountInfo` already snapshots the account, but as one joined string —
 * fine to show, useless to export as columns or to print "4 số đuôi" from. The
 * four fields are stored separately so the admin's detail popup and the
 * spreadsheet can each take the part they need.
 *
 * Old rows keep only the joined string; the list falls back to the partner's
 * current profile for those, which is the best that can honestly be said.
 */
export class AddBankSnapshotToPartnerPayout1792900000000 implements MigrationInterface {
  name = 'AddBankSnapshotToPartnerPayout1792900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "partner_payout"
         ADD COLUMN IF NOT EXISTS "bankName" character varying,
         ADD COLUMN IF NOT EXISTS "bankAccountNumber" character varying,
         ADD COLUMN IF NOT EXISTS "bankAccountHolder" character varying,
         ADD COLUMN IF NOT EXISTS "bankBranch" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "partner_payout"
         DROP COLUMN IF EXISTS "bankName",
         DROP COLUMN IF EXISTS "bankAccountNumber",
         DROP COLUMN IF EXISTS "bankAccountHolder",
         DROP COLUMN IF EXISTS "bankBranch"`,
    );
  }
}
