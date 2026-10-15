import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The link list's new columns and the link's history (doitac-1410 #018).
 *
 * - `lastClickedAt`, so the list can sort by "Lần nhấp gần nhất" without
 *   scanning every click; filled once from the clicks already recorded.
 * - An admin's own suspension of one link, with its reason, kept apart from
 *   the account lock that suspends every link at once.
 * - When the partner appealed, and the ticket it opened.
 * - `partner_link_event`: who did what to a link and when, for the
 *   "Lịch sử thay đổi" in the detail popup. Existing links get their
 *   creation, so no history starts empty.
 * - `partner_notification."partnerId"`: a notice for one partner (a link
 *   suspended or released) rather than an announcement to everyone.
 */
export class PartnerLinkHistory1797500000000 implements MigrationInterface {
  name = 'PartnerLinkHistory1797500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "partner_link"
        ADD COLUMN IF NOT EXISTS "lastClickedAt" timestamptz,
        ADD COLUMN IF NOT EXISTS "suspendedByAdmin" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "suspendedReason" varchar(500),
        ADD COLUMN IF NOT EXISTS "appealedAt" timestamptz,
        ADD COLUMN IF NOT EXISTS "appealTicketId" integer`);
    await queryRunner.query(`
      UPDATE "partner_link" l
         SET "lastClickedAt" = c.last
        FROM (
          SELECT "linkId", MAX("clickedAt") AS last
            FROM "partner_link_click" GROUP BY "linkId"
        ) c
       WHERE c."linkId" = l.id`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "partner_link_event" (
        "id" SERIAL PRIMARY KEY,
        "linkId" integer NOT NULL,
        "partnerId" integer NOT NULL,
        "action" varchar(40) NOT NULL,
        "actorRole" varchar(10) NOT NULL,
        "actorId" integer,
        "detail" jsonb,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_partner_link_event_linkId" ON "partner_link_event" ("linkId", "createdAt")`,
    );
    await queryRunner.query(`
      INSERT INTO "partner_link_event" ("linkId", "partnerId", "action", "actorRole", "detail", "createdAt")
      SELECT l.id, l."partnerId", 'created', 'partner',
             jsonb_build_object('label', l.label, 'targetPath', l."targetPath"),
             l."createdAt"
        FROM "partner_link" l
       WHERE NOT EXISTS (
         SELECT 1 FROM "partner_link_event" e WHERE e."linkId" = l.id
       )`);
    await queryRunner.query(
      `ALTER TABLE "partner_notification" ADD COLUMN IF NOT EXISTS "partnerId" integer`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "partner_notification" DROP COLUMN IF EXISTS "partnerId"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "partner_link_event"`);
    await queryRunner.query(`
      ALTER TABLE "partner_link"
        DROP COLUMN IF EXISTS "lastClickedAt",
        DROP COLUMN IF EXISTS "suspendedByAdmin",
        DROP COLUMN IF EXISTS "suspendedReason",
        DROP COLUMN IF EXISTS "appealedAt",
        DROP COLUMN IF EXISTS "appealTicketId"`);
  }
}
