import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The server-side device fingerprint of a click (#039).
 *
 * The backstop for a click id that did not survive the trip — an in-app browser
 * or a share sheet can strip the query string. Matching network address and
 * user agent, both of which the server sees on the click and again on the
 * order, costs the partner nothing when the browser loses everything else.
 */
export class AddDeviceHashToPartnerLinkClick1791600000000 implements MigrationInterface {
  name = 'AddDeviceHashToPartnerLinkClick1791600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "partner_link_click" ADD COLUMN IF NOT EXISTS "deviceHash" character varying(64)`,
    );
    // Looked up as "the newest click from this device", so the date joins it.
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_partner_link_click_deviceHash" ON "partner_link_click" ("deviceHash", "clickedAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_partner_link_click_deviceHash"`,
    );
    await queryRunner.query(
      `ALTER TABLE "partner_link_click" DROP COLUMN IF EXISTS "deviceHash"`,
    );
  }
}
