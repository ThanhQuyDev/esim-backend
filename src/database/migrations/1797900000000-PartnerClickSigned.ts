import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Clicks handed out as a signed token (doitac-1410 #026). A bare click id is
 * honoured only for a click minted before tokens existed; for a newer click
 * only its signed token counts.
 */
export class PartnerClickSigned1797900000000 implements MigrationInterface {
  name = 'PartnerClickSigned1797900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "partner_link_click" ADD COLUMN IF NOT EXISTS "signed" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "partner_link_click" DROP COLUMN IF EXISTS "signed"`,
    );
  }
}
