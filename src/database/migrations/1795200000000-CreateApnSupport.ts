import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The APN lookup table that decides which eSIMs work with TikTok and ChatGPT
 * (#065, #066).
 *
 * China blocks both, and whether an eSIM gets around that depends on the APN its
 * traffic exits through. That is not something we can compute: it is a list the
 * team maintains and uploads as a spreadsheet, because carriers change their
 * routing.
 *
 * Shaped to match the confirmed sheet one-to-one (1/10/2026): one row per APN,
 * TikTok split by device platform — `cmhk` works on iPhone but not on Android —
 * and ChatGPT not, since it is blocked by exit IP alone.
 *
 * Starts empty. Until a sheet is uploaded no plan is advertised as working with
 * TikTok, which is the safe direction: the alternative is telling a customer in
 * China that an eSIM works when it does not.
 */
export class CreateApnSupport1795200000000 implements MigrationInterface {
  name = 'CreateApnSupport1795200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "apn_support" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "apn" character varying NOT NULL,
        "apnLabel" character varying NOT NULL,
        "tiktokIos" boolean NOT NULL DEFAULT false,
        "tiktokAndroid" boolean NOT NULL DEFAULT false,
        "chatGpt" boolean NOT NULL DEFAULT false,
        "note" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_apn_support_id" PRIMARY KEY ("id")
      )
    `);

    // The APN is looked up once per plan on every product page, and the unique
    // index is also what stops one upload holding the same APN twice.
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_apn_support_apn" ON "apn_support" ("apn")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "apn_support"`);
  }
}
