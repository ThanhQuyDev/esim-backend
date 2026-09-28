import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A reconciliation statement: one partner, one period (#065).
 *
 * The commission list is a row per order, which is the wrong grain for a
 * monthly sign-off — an admin approves "tháng 9 của đối tác A", not four
 * hundred individual commissions. The figures are worked out from the
 * commissions each time, so only what an admin decides is stored: the status of
 * that period and the note explaining it.
 *
 * A partner-period that nobody has touched yet has no row at all and reads as
 * "chờ xác nhận", which is the default the brief asks for.
 */
export class CreatePartnerReconciliation1792800000000 implements MigrationInterface {
  name = 'CreatePartnerReconciliation1792800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "partner_reconciliation" (
        "id" SERIAL NOT NULL,
        "partnerId" integer NOT NULL,
        "period" character varying(7) NOT NULL,
        "status" character varying(20) NOT NULL DEFAULT 'pending',
        "note" text,
        "updatedByAdminId" integer,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_partner_reconciliation" PRIMARY KEY ("id")
      )
    `);
    // One statement per partner per period, and the lookup is always by both.
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_partner_reconciliation_partner_period" ON "partner_reconciliation" ("partnerId", "period")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "partner_reconciliation"`);
  }
}
