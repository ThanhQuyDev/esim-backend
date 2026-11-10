import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * doitac-0911 #020 — "Mỗi mốc thời gian đang bị nhân đôi dòng nội dung".
 *
 * The tier review wrote two rows for the same partner and month a few
 * milliseconds apart: it checked "already reviewed?" and then inserted, so
 * two runs at the same moment (the 1st-of-month cron and a click on "Xét
 * hạng", or the cron firing twice) both passed the check. The history showed
 * every month twice.
 *
 * - Duplicates are removed: for a month, the latest row stays (a rerun is the
 *   admin's newer decision); for the older weekly rows without a month, a row
 *   is dropped when the same partner has an identical one within 2 seconds.
 * - One row per partner and month from now on, enforced by the database; the
 *   review updates that row instead of adding one (partners.service).
 */
export class UniqueTierEvaluationPerPeriod1805300000000 implements MigrationInterface {
  name = 'UniqueTierEvaluationPerPeriod1805300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM partner_tier_evaluation e
       USING partner_tier_evaluation keep
       WHERE e.period IS NOT NULL
         AND keep."partnerId" = e."partnerId"
         AND keep.period = e.period
         AND keep.id > e.id
    `);
    await queryRunner.query(`
      DELETE FROM partner_tier_evaluation e
       USING partner_tier_evaluation keep
       WHERE e.period IS NULL AND keep.period IS NULL
         AND keep."partnerId" = e."partnerId"
         AND keep.id < e.id
         AND keep.result = e.result
         AND keep."tierBefore" IS NOT DISTINCT FROM e."tierBefore"
         AND keep."tierAfter" IS NOT DISTINCT FROM e."tierAfter"
         AND keep."revenueVnd" = e."revenueVnd"
         AND abs(extract(epoch FROM (e."evaluatedAt" - keep."evaluatedAt"))) < 2
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_partner_tier_evaluation_partner_period"
        ON partner_tier_evaluation ("partnerId", period)
        WHERE period IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_partner_tier_evaluation_partner_period"`,
    );
  }
}
