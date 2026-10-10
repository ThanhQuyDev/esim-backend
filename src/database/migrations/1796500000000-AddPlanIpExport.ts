import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * #043 (test round 4) — keep the supplier's exit IP ("SG", "FR/NL/UK", "HK") on
 * the plan, so the CMS can show it and the TikTok/ChatGPT flag can be judged
 * from it. Filled by the next esimaccess sync.
 */
export class AddPlanIpExport1796500000000 implements MigrationInterface {
  name = 'AddPlanIpExport1796500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "plan" ADD COLUMN IF NOT EXISTS "ipExport" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "plan" DROP COLUMN IF EXISTS "ipExport"`,
    );
  }
}
