import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * doitac-3010 #015: link codes are kept as typed ("vana-2026"), so "VANA-2026"
 * must still be taken by it. One code per spelling, whatever the case —
 * deleted links included, as a link's name is never given out again.
 */
export class PartnerLinkCodeCaseInsensitive1802500000000 implements MigrationInterface {
  name = 'PartnerLinkCodeCaseInsensitive1802500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_partner_link_code_upper" ON "partner_link" (UPPER("code"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_partner_link_code_upper"`,
    );
  }
}
