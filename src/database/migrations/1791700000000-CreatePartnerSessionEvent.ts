import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The shape of a buying session (#040).
 *
 * A real purchase leaves a trail: the visitor compares a couple of plans, adds
 * one to the cart, then goes to pay. An order scripted through the checkout
 * leaves none of that — it jumps from the click straight to payment — and a
 * script driving a browser leaves the opposite tell, dozens of plan views in a
 * few seconds. Storing the steps is what makes either visible.
 *
 * Deliberately thin: an anonymous visitor id, the click it belongs to, what
 * happened and when. No page contents, no addresses beyond the same hash the
 * click log already keeps.
 */
export class CreatePartnerSessionEvent1791700000000 implements MigrationInterface {
  name = 'CreatePartnerSessionEvent1791700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "partner_session_event" (
        "id" SERIAL NOT NULL,
        "visitorId" character varying(64),
        "clickId" character varying(64),
        "eventType" character varying(32) NOT NULL,
        "ref" character varying(160),
        "ipHash" character varying(64),
        "occurredAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_partner_session_event" PRIMARY KEY ("id")
      )
    `);
    // Both reads are "this session's events, oldest first".
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_partner_session_event_visitor" ON "partner_session_event" ("visitorId", "occurredAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_partner_session_event_click" ON "partner_session_event" ("clickId", "occurredAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "partner_session_event"`);
  }
}
