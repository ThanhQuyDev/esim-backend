import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * "Ngưỡng rút tiền hoa hồng tối đa" and "Ngưỡng nạp ký quỹ tối đa" in
 * "Cấu hình chung" (doitac-3010 #041). A withdrawal ceiling of 0 means none;
 * the deposit ceiling starts at the 10.000.000đ the code had fixed.
 */
export class PartnerProgramSettingMaxLimits1803200000000 implements MigrationInterface {
  name = 'PartnerProgramSettingMaxLimits1803200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "partner_program_setting"
         ADD COLUMN IF NOT EXISTS "payoutMaxKolVnd" bigint NOT NULL DEFAULT 0,
         ADD COLUMN IF NOT EXISTS "payoutMaxDistributionVnd" bigint NOT NULL DEFAULT 0,
         ADD COLUMN IF NOT EXISTS "depositMaxKolVnd" bigint NOT NULL DEFAULT 10000000,
         ADD COLUMN IF NOT EXISTS "depositMaxDistributionVnd" bigint NOT NULL DEFAULT 10000000`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "partner_program_setting"
         DROP COLUMN IF EXISTS "payoutMaxKolVnd",
         DROP COLUMN IF EXISTS "payoutMaxDistributionVnd",
         DROP COLUMN IF EXISTS "depositMaxKolVnd",
         DROP COLUMN IF EXISTS "depositMaxDistributionVnd"`,
    );
  }
}
