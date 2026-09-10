import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Index for "the newest click on this link" (#095).
 *
 * The 30-day attribution window falls back to the click log when the checkout
 * sends no visit stamp — cookies written before that field existed — and that
 * lookup runs **while an order is being created**:
 *
 *   SELECT ... FROM partner_link_click
 *   WHERE "linkId" = $1 ORDER BY "clickedAt" DESC LIMIT 1
 *
 * `partner_link_click` only had a plain index on `linkId`, so Postgres had to
 * read every click row belonging to that link and sort them to find one. A KOL
 * whose video does well has hundreds of thousands of those rows, and the cost
 * lands on their buyers' checkout, which is the worst possible place for it.
 *
 * The composite index answers it with a single backwards index scan.
 */
export class IndexPartnerLinkClickRecency1788025800000 implements MigrationInterface {
  name = 'IndexPartnerLinkClickRecency1788025800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_partner_link_click_link_recent"
       ON "partner_link_click" ("linkId", "clickedAt" DESC)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_partner_link_click_link_recent"`,
    );
  }
}
