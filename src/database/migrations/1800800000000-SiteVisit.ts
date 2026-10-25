import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Visits to the storefront, for the audience charts on Tổng quan (vande
 * #059): one row per browser per Vietnamese day, with its kind of device, its
 * system and where it is. The address is used to find the city and dropped —
 * it is not stored.
 */
export class SiteVisit1800800000000 implements MigrationInterface {
  name = 'SiteVisit1800800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "site_visit" (
         "id" SERIAL PRIMARY KEY,
         "visitorId" character varying(64) NOT NULL,
         "day" date NOT NULL,
         "deviceType" character varying(16),
         "os" character varying(32),
         "country" character varying(2),
         "city" character varying(80),
         "isNew" boolean NOT NULL DEFAULT false,
         "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
       )`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_site_visit_visitor_day" ON "site_visit" ("visitorId", "day")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_site_visit_createdAt" ON "site_visit" ("createdAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "site_visit"`);
  }
}
