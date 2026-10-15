import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Where a partner themself uses esim.vn from (doitac-1410 #025): the network
 * (hashed) and the device (hash of network + browser), seen when they use the
 * partner portal. An affiliate order from the same network or device as the
 * partner is flagged for an admin — it still earns the commission.
 */
export class PartnerOrigin1797800000000 implements MigrationInterface {
  name = 'PartnerOrigin1797800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "partner_origin" (
        "id" SERIAL PRIMARY KEY,
        "partnerId" integer NOT NULL REFERENCES "partner"("id") ON DELETE CASCADE,
        "ipHash" varchar(32) NOT NULL,
        "deviceHash" varchar(40) NOT NULL DEFAULT '',
        "firstSeenAt" timestamptz NOT NULL DEFAULT now(),
        "lastSeenAt" timestamptz NOT NULL DEFAULT now()
      )`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_partner_origin"
        ON "partner_origin" ("partnerId", "ipHash", "deviceHash")`);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_partner_origin_ipHash"
        ON "partner_origin" ("ipHash")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "partner_origin"`);
  }
}
