import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Bank account changes wait for an emailed code (#005).
 *
 * The requested account lives here, next to the hash of the code that releases
 * it, so the confirmation can only apply the numbers the partner actually asked
 * for — a code that confirms "some change" would let a second, unseen request
 * ride on a code the partner asked for themselves.
 *
 * Shape: `{ values: { bankName, bankAccountNumber, bankAccountHolder,
 * bankBranch }, otpHash, expiresAt, attempts, requestedAt }`.
 */
export class AddPendingBankChangeToPartner1790700000000 implements MigrationInterface {
  name = 'AddPendingBankChangeToPartner1790700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "partner" ADD "pendingBankChange" jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "partner" DROP COLUMN "pendingBankChange"`,
    );
  }
}
