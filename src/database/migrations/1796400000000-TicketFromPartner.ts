import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * #042 (test round 4) — tell a partner's ticket from a customer's.
 *
 * A partner writes as the ticket's owner, so the CMS labelled their messages
 * "Khách hàng". The flag is set when the ticket is opened, by whether its email
 * signs in to a partner account; existing tickets are backfilled the same way.
 */
export class TicketFromPartner1796400000000 implements MigrationInterface {
  name = 'TicketFromPartner1796400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ticket" ADD COLUMN IF NOT EXISTS "fromPartner" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `UPDATE "ticket" t SET "fromPartner" = true
        WHERE EXISTS (
          SELECT 1 FROM "partner" p
            JOIN "user" u ON u.id = p."userId"
           WHERE LOWER(u.email) = LOWER(t."customerEmail")
        )`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ticket" DROP COLUMN IF EXISTS "fromPartner"`,
    );
  }
}
