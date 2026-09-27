import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Attribution that follows the customer's account, not their browser (#034).
 *
 * A cookie lives on one device. Somebody who opens a KOL's link on a laptop
 * while signed in, then buys on their phone, is the same customer — and the
 * brief says the partner still earns. One row per account: the latest link the
 * signed-in customer opened wins, which is also what #038 asks for.
 */
export class CreatePartnerMemberAttribution1791200000000 implements MigrationInterface {
  name = 'CreatePartnerMemberAttribution1791200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "partner_member_attribution" (
        "userId" integer NOT NULL,
        "partnerId" integer NOT NULL,
        "linkId" integer,
        "attributedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_partner_member_attribution" PRIMARY KEY ("userId")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_partner_member_attribution_partnerId" ON "partner_member_attribution" ("partnerId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "partner_member_attribution"`);
  }
}
