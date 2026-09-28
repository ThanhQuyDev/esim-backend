import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A server-side id for the click itself (#039).
 *
 * Safari and iOS clear the attribution cookie long before the 30-day window is
 * up, so a cookie is the weakest part of the chain. The server now mints an id
 * when the visitor opens the link, hands it to them in the redirect URL, and
 * reads it back at checkout — the partner keeps the order even when nothing
 * survived in the browser's cookie jar.
 */
export class AddClickIdToPartnerLinkClick1791500000000 implements MigrationInterface {
  name = 'AddClickIdToPartnerLinkClick1791500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "partner_link_click" ADD COLUMN IF NOT EXISTS "clickId" character varying(64)`,
    );
    // Looked up once per order, by this column alone.
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_partner_link_click_clickId" ON "partner_link_click" ("clickId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_partner_link_click_clickId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "partner_link_click" DROP COLUMN IF EXISTS "clickId"`,
    );
  }
}
