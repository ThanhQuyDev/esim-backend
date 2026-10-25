import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * "Vị trí & IP" on the admin order page (vande #058): the buyer's address
 * and the city and country it resolves to, recorded when a customer places
 * an order on the website. Older orders only ever kept a hash of the
 * address, so they show none.
 */
export class OrderBuyerLocation1800700000000 implements MigrationInterface {
  name = 'OrderBuyerLocation1800700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "buyerIp" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "buyerLocation" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "order" DROP COLUMN IF EXISTS "buyerLocation"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" DROP COLUMN IF EXISTS "buyerIp"`,
    );
  }
}
