import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * "Ghi chú nội bộ" on a marketing link (doitac-1410 #055): what an admin
 * notes for other admins. Kept apart from `partner_link_event`, which is the
 * history the partner reads.
 */
export class PartnerLinkNote1798300000000 implements MigrationInterface {
  name = 'PartnerLinkNote1798300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "partner_link_note" (
        "id" SERIAL PRIMARY KEY,
        "linkId" integer NOT NULL,
        "adminId" integer,
        "body" varchar(1000) NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_partner_link_note_link" ON "partner_link_note" ("linkId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "partner_link_note"`);
  }
}
