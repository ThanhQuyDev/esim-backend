import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Why a partner's status changed (#059, #060).
 *
 * Locking an account or putting one on hold is a decision somebody has to
 * answer for later — "để lần sau còn biết vấn đề/sự việc" — and until now the
 * status simply changed with nothing recorded but the new value. The partner
 * rings support a month later and nobody can say why.
 *
 * Rows are written, never edited: this is a log, not a current-state column.
 */
export class AddPartnerStatusChangeLog1792300000000 implements MigrationInterface {
  name = 'AddPartnerStatusChangeLog1792300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "partner_status_change" (
        "id" SERIAL NOT NULL,
        "partnerId" integer NOT NULL,
        "fromStatus" character varying(20),
        "toStatus" character varying(20) NOT NULL,
        "reason" text,
        "changedByAdminId" integer,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_partner_status_change" PRIMARY KEY ("id")
      )
    `);
    // Read as "this partner's history, newest first".
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_partner_status_change_partner" ON "partner_status_change" ("partnerId", "createdAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "partner_status_change"`);
  }
}
