import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * The struck-out price shown on a plan with no discount of its own
 * (vande-2011 #012, decided 22/11): set so the badge reads
 * `autoStrikePercent`. 0 = off. Edited in the admin, read by the response
 * scrub (see utils/public-catalog-scrub.ts), cached for a minute there.
 */
export const AUTO_STRIKE_MAX = 90;

@Injectable()
export class PriceDisplayService {
  constructor(private readonly dataSource: DataSource) {}

  async get(): Promise<{ autoStrikePercent: number }> {
    try {
      const rows: { autoStrikePercent: number }[] = await this.dataSource.query(
        `SELECT "autoStrikePercent" FROM "price_display_setting" WHERE "id" = 1`,
      );
      return { autoStrikePercent: Number(rows[0]?.autoStrikePercent) || 0 };
    } catch {
      // Table not there yet (a database the migration has not reached): off.
      return { autoStrikePercent: 0 };
    }
  }

  async set(autoStrikePercent: number): Promise<{ autoStrikePercent: number }> {
    const value = Math.max(
      0,
      Math.min(AUTO_STRIKE_MAX, Math.round(Number(autoStrikePercent) || 0)),
    );
    await this.dataSource.query(
      `INSERT INTO "price_display_setting" ("id", "autoStrikePercent", "updatedAt")
       VALUES (1, $1, now())
       ON CONFLICT ("id") DO UPDATE
         SET "autoStrikePercent" = EXCLUDED."autoStrikePercent", "updatedAt" = now()`,
      [value],
    );
    return { autoStrikePercent: value };
  }
}
