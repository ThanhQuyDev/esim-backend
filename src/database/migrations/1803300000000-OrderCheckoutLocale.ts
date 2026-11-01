import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The language the buyer checked out in (doitac-3010 #043): an English
 * checkout shows prices in $ but is charged in VND, and the admin wants to
 * count how many of those orders never got paid ("payment $").
 */
export class OrderCheckoutLocale1803300000000 implements MigrationInterface {
  name = 'OrderCheckoutLocale1803300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "checkoutLocale" varchar(5)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "order" DROP COLUMN IF EXISTS "checkoutLocale"`,
    );
  }
}
