import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Contract details and per-partner deposit limits (#061).
 *
 * `contractInfo` is whatever the monthly reconciliation file has to quote back
 * about this partner — contract number, signing date, payment terms. It is a
 * list rather than a field because no two partners carry the same set, and the
 * brief asks for a "+" to add another line.
 *
 * The deposit limits are per partner because the programme-wide 100.000đ–10
 * triệu (#047) is a default, not a rule: a distributor turning over hundreds of
 * millions should not top up ten million at a time.
 */
export class AddContractInfoAndDepositLimitsToPartner1792700000000 implements MigrationInterface {
  name = 'AddContractInfoAndDepositLimitsToPartner1792700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "partner" ADD COLUMN IF NOT EXISTS "contractInfo" jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "partner" ADD COLUMN IF NOT EXISTS "depositMinVnd" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "partner" ADD COLUMN IF NOT EXISTS "depositMaxVnd" integer`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "partner" DROP COLUMN IF EXISTS "depositMaxVnd"`,
    );
    await queryRunner.query(
      `ALTER TABLE "partner" DROP COLUMN IF EXISTS "depositMinVnd"`,
    );
    await queryRunner.query(
      `ALTER TABLE "partner" DROP COLUMN IF EXISTS "contractInfo"`,
    );
  }
}
