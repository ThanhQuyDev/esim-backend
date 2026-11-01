import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * How bot-like each click looked, and why (doitac-3010 #020, rule 4). Old
 * clicks were never judged and stay at 0.
 */
export class PartnerClickBotScore1802800000000 implements MigrationInterface {
  name = 'PartnerClickBotScore1802800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "partner_link_click" ADD COLUMN IF NOT EXISTS "botScore" smallint NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "partner_link_click" ADD COLUMN IF NOT EXISTS "botFlags" character varying(200)`,
    );
    // The rate check counts one network's recent clicks on every click.
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_partner_link_click_ip_time"
         ON "partner_link_click" ("ipHash", "clickedAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_partner_link_click_ip_time"`,
    );
    await queryRunner.query(
      `ALTER TABLE "partner_link_click" DROP COLUMN IF EXISTS "botFlags"`,
    );
    await queryRunner.query(
      `ALTER TABLE "partner_link_click" DROP COLUMN IF EXISTS "botScore"`,
    );
  }
}
