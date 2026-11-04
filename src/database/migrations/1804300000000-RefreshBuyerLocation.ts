import { MigrationInterface, QueryRunner } from 'typeorm';
import { ipLocation } from '../../orders/buyer-location';

/**
 * Orders placed so far were located with data from 2022 (vande-0411 #051): look
 * their addresses up again in the current database. An address it does not know
 * keeps the place it had.
 */
export class RefreshBuyerLocation1804300000000 implements MigrationInterface {
  name = 'RefreshBuyerLocation1804300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const rows: { ip: string }[] = await queryRunner.query(
      `SELECT DISTINCT "buyerIp" AS ip FROM "order" WHERE "buyerIp" IS NOT NULL`,
    );
    for (const { ip } of rows) {
      const location = await ipLocation(ip);
      if (location) {
        await queryRunner.query(
          `UPDATE "order" SET "buyerLocation" = $1 WHERE "buyerIp" = $2`,
          [location, ip],
        );
      }
    }
  }

  public async down(): Promise<void> {
    // The old places were wrong and were not kept.
  }
}
