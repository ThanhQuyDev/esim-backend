import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Every time an order's partner click was turned down, and why (doitac-3010
 * #017, rule 1): a forged or edited cookie, a click the server never minted,
 * one past its window. The order itself goes through — only the credit is
 * refused — so this is the only trace the attempt leaves.
 */
export class PartnerAttributionRejection1802600000000 implements MigrationInterface {
  name = 'PartnerAttributionRejection1802600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "partner_attribution_rejection" (
        "id" SERIAL PRIMARY KEY,
        "reason" character varying(40) NOT NULL,
        "detail" character varying(255),
        "clickValue" character varying(160),
        "linkCode" character varying(100),
        "linkId" integer,
        "partnerId" integer,
        "buyerUserId" integer,
        "ipHash" character varying(64),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now()
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_partner_attribution_rejection_created"
         ON "partner_attribution_rejection" ("createdAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS "partner_attribution_rejection"`,
    );
  }
}
